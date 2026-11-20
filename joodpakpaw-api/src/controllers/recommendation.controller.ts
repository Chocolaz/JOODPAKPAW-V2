import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthenticatedUser } from '../middlewares/auth.middleware';
import { formatPropertyDto, getUserFavoriteMap } from './property.controller';
import { normalizePetName } from './lookup.controller';
import { cacheService } from '../services/cache.service';
import {
  getMlServiceStatus,
  getSimilarPropertyRecommendations,
  getUserOrColdStartRecommendations,
  invalidateUserRecommendationCache,
  RecommendationItem,
  recordUserBehaviorSafe,
  refreshMlCaches,
  UserLocation,
} from '../services/recommendation.service';

function parsePositiveInt(raw: unknown): number | null {
  const str = String(raw ?? '').trim();
  if (!/^\d+$/.test(str)) return null;
  const num = parseInt(str, 10);
  if (!Number.isSafeInteger(num) || num <= 0) return null;
  return num;
}

function parseOptionalLocation(rawLat: unknown, rawLng: unknown): UserLocation | null {
  if (rawLat === undefined || rawLng === undefined) return null;
  const latStr = String(rawLat).trim();
  const lngStr = String(rawLng).trim();
  if (!latStr || !lngStr) return null;
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return { lat, lng };
}

function isAdminUser(user?: AuthenticatedUser): boolean {
  if (!user) return false;
  if (user.roleName && user.roleName.toLowerCase() === 'admin') return true;
  if (Array.isArray(user.roles)) {
    return user.roles.some((r) => {
      const name = typeof r === 'string' ? r : r?.name;
      return typeof name === 'string' && name.toLowerCase() === 'admin';
    });
  }
  return false;
}

async function hydrateRecommendationItems(
  items: RecommendationItem[],
  viewerUserId: number | undefined,
  includeScoreBreakdown: boolean
): Promise<any[]> {
  if (items.length === 0) return [];

  const ids = items.map((item) => item.propertyId);
  const [dbProperties, favMap] = await Promise.all([
    prisma.property.findMany({
      where: {
        id: { in: ids },
        isActive: true,
        deletedAt: null,
        isBannedByAdmin: false,
        host: {
          deletedAt: null,
          bannedAt: null,
          isBannedAllProperties: false,
        },
      },
      include: {
        images: {
          where: { deletedAt: null },
          orderBy: { id: 'asc' },
          take: 3,
        },
        propertyType: true,
        facilities: {
          include: {
            facility: {
              include: {
                category: true,
              },
            },
          },
        },
        roomCategories: {
          where: { deletedAt: null },
          include: {
            petSizeCategory: true,
            pets: {
              include: {
                pet: true,
              },
            },
            facilities: {
              include: {
                facility: true,
              },
            },
          },
          orderBy: { basePrice: 'asc' },
        },
        host: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isVerifiedHost: true,
          },
        },
      },
    }),
    getUserFavoriteMap(viewerUserId),
  ]);

  const dtoById = new Map<number, any>();
  for (const prop of dbProperties) {
    const dto = formatPropertyDto(prop, favMap);
    const { _bookingCount, ...rest } = dto;
    dtoById.set(prop.id, rest);
  }

  const hydrated: any[] = [];
  for (const item of items) {
    const propDto = dtoById.get(item.propertyId);
    if (!propDto) continue;

    const enriched: Record<string, unknown> = {
      ...propDto,
      matchReasons: item.matchReasons,
      recommendationScore: item.score,
      matchTier: item.matchTier,
    };

    if (includeScoreBreakdown && item.scoreBreakdown) {
      enriched.scoreBreakdown = item.scoreBreakdown;
    }

    hydrated.push(enriched);
  }

  return hydrated;
}

/**
 * POST /api/v1/user-behaviors/view-property/:propertyId
 */
export async function trackPropertyView(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Authentication required.', 401, 'A-3005');
    }

    const propertyId = parsePositiveInt(req.params.propertyId);
    if (propertyId === null) {
      throw new AppError('Invalid property ID.', 400, 'T-2007');
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, hostId: true, deletedAt: true },
    });

    if (!property || property.deletedAt !== null) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    if (property.hostId === userId) {
      res.status(200).json({
        code: 'S-0000',
        message: 'Self-view skipped',
        data: {
          propertyId,
          tracked: false,
          deduplicated: false,
          skippedSelfView: true,
        },
      });
      return;
    }

    const { tracked, deduplicated } = await recordUserBehaviorSafe(userId, propertyId, 'view');
    if (tracked) {
      await invalidateUserRecommendationCache(userId);
    }

    res.status(200).json({
      code: 'S-0000',
      message: tracked
        ? 'Property view tracked successfully'
        : 'Property view deduplicated within 10-minute cooldown',
      data: {
        propertyId,
        tracked,
        deduplicated,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/properties/recommend
 */
export async function getRecommendedProperties(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const debugRequested =
      String(req.query.debug || '').trim().toLowerCase() === 'true';
    const coldStartRequested =
      String(req.query.coldStart || '').trim().toLowerCase() === 'true';
    const asUserIdRaw =
      req.query.asUserId !== undefined ? String(req.query.asUserId).trim() : '';
    const hasAsUserId = asUserIdRaw !== '';

    if ((debugRequested || hasAsUserId || coldStartRequested) && !isAdminUser(req.user)) {
      throw new AppError('Access forbidden. Insufficient permissions.', 403, 'A-3007');
    }

    let targetUserId: number | null = req.user?.id ?? null;
    if (coldStartRequested || asUserIdRaw.toLowerCase() === 'guest') {
      targetUserId = null;
    } else if (hasAsUserId) {
      const parsedAsUserId = parsePositiveInt(asUserIdRaw);
      if (parsedAsUserId === null) {
        throw new AppError('Invalid asUserId parameter.', 400, 'T-2007');
      }
      targetUserId = parsedAsUserId;
    }

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit || '8'), 10) || 8)
    );
    const userLocation = parseOptionalLocation(req.query.lat, req.query.lng);

    const recResult = await getUserOrColdStartRecommendations(
      targetUserId,
      50,
      debugRequested,
      userLocation
    );

    const total = recResult.recommendations.length;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
    const start = (page - 1) * limit;
    const pageItems = recResult.recommendations.slice(start, start + limit);

    const hydratedData = await hydrateRecommendationItems(
      pageItems,
      req.user?.id,
      debugRequested
    );

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: hydratedData,
      pagination: {
        page,
        limit,
        total,
        totalRows: total,
        totalPages,
      },
      meta: recResult.meta,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/properties/recommend/property/:propertyId
 */
export async function getSimilarProperties(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const propertyId = parsePositiveInt(req.params.propertyId);
    if (propertyId === null) {
      throw new AppError('Invalid property ID.', 400, 'T-2007');
    }

    const debugRequested =
      String(req.query.debug || '').trim().toLowerCase() === 'true';
    if (debugRequested && !isAdminUser(req.user)) {
      throw new AppError('Access forbidden. Insufficient permissions.', 403, 'A-3007');
    }

    const sourceProperty = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        host: {
          select: {
            deletedAt: true,
            bannedAt: true,
            isBannedAllProperties: true,
          },
        },
      },
    });

    if (
      !sourceProperty ||
      sourceProperty.deletedAt !== null ||
      !sourceProperty.isActive ||
      sourceProperty.isBannedByAdmin ||
      !sourceProperty.host ||
      sourceProperty.host.deletedAt !== null ||
      sourceProperty.host.bannedAt !== null ||
      sourceProperty.host.isBannedAllProperties
    ) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit || '8'), 10) || 8)
    );

    const recResult = await getSimilarPropertyRecommendations(
      propertyId,
      limit,
      req.user?.id ?? null,
      debugRequested
    );

    if (!recResult) {
      res.status(200).json({
        code: 'S-0000',
        message: 'Success',
        data: [],
        meta: {
          source: 'in_process_fallback',
          strategy: 'similar_properties',
          snapshotAgeSeconds: 0,
          latencyMs: 1,
          totalCandidates: 0,
        },
      });
      return;
    }

    const hydratedData = await hydrateRecommendationItems(
      recResult.recommendations,
      req.user?.id,
      debugRequested
    );

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: hydratedData,
      meta: recResult.meta,
    });
  } catch (error) {
    next(error);
  }
}

const EPHEMERAL_EMAIL_PREFIXES = ['challenger_', 'smoke_', 'test_', 'qa_', 'audit_'];
const ADMIN_ML_SAMPLES_CACHE_KEY = 'admin:ml:status:samples';
const ADMIN_ML_SAMPLES_TTL_SECONDS = 15;

export interface MlSampleUserPet {
  id: number;
  name: string;
  species: string;
  weight: number | null;
  sizeName: string | null;
  energyRating: number | null;
}

export interface MlSampleUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  behaviorCount: number;
  pets: MlSampleUserPet[];
}

export interface MlSampleProperty {
  id: number;
  title: string;
  province: string;
  avgRating: number;
}

interface AdminMlSamplesPayload {
  sampleUsers: MlSampleUser[];
  sampleProperties: MlSampleProperty[];
  totalUsers: number;
  totalActiveProperties: number;
}

const ADMIN_USER_SAMPLE_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  userRoles: {
    where: { role: { deletedAt: null } },
    select: {
      role: {
        select: {
          name: true,
        },
      },
    },
  },
  _count: {
    select: {
      userBehaviors: true,
    },
  },
  petProfiles: {
    where: { deletedAt: null },
    orderBy: { id: 'asc' as const },
    select: {
      id: true,
      name: true,
      weight: true,
      petType: {
        select: {
          name: true,
        },
      },
      petSizeCategory: {
        select: {
          name: true,
        },
      },
      energy: {
        select: {
          rating: true,
        },
      },
    },
  },
};

const ADMIN_PROPERTY_SAMPLE_SELECT = {
  id: true,
  title: true,
  province: true,
  avgRating: true,
};

function buildActiveUserBaseWhere() {
  return {
    deletedAt: null,
    bannedAt: null,
    NOT: EPHEMERAL_EMAIL_PREFIXES.map((prefix) => ({
      email: { startsWith: prefix, mode: 'insensitive' as const },
    })),
  };
}

function buildActivePropertyBaseWhere() {
  return {
    isActive: true,
    deletedAt: null,
    isBannedByAdmin: false,
    host: {
      deletedAt: null,
      bannedAt: null,
      isBannedAllProperties: false,
    },
  };
}

function formatMlSampleUser(u: any): MlSampleUser {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName || '',
    lastName: u.lastName || '',
    roles: u.userRoles.map((ur: any) => ur.role.name),
    behaviorCount: u._count.userBehaviors,
    pets: u.petProfiles.map((pet: any) => ({
      id: pet.id,
      name: pet.name,
      species: normalizePetName(pet.petType.name),
      weight: pet.weight !== null ? Number(pet.weight) : null,
      sizeName: pet.petSizeCategory?.name ?? null,
      energyRating: pet.energy?.rating ?? null,
    })),
  };
}

function formatMlSampleProperty(p: any): MlSampleProperty {
  return {
    id: p.id,
    title: p.title,
    province: p.province || '',
    avgRating: Number(p.avgRating ?? 0),
  };
}

function buildPetProfileSignature(user: MlSampleUser): string {
  const countBucket = user.pets.length > 1 ? 'multi' : 'single';
  const species = Array.from(new Set(user.pets.map((p) => p.species))).sort().join(',');
  const sizes = Array.from(new Set(user.pets.map((p) => p.sizeName || 'unknown')))
    .sort()
    .join(',');
  return `${countBucket}:${species}|${sizes}`;
}

async function fetchFeaturedAdminSampleUsers(): Promise<MlSampleUser[]> {
  const baseWhere = buildActiveUserBaseWhere();

  const petOwnerCandidatesRaw = await prisma.user.findMany({
    where: {
      ...baseWhere,
      petProfiles: { some: { deletedAt: null } },
    },
    orderBy: { id: 'asc' },
    take: 24,
    select: ADMIN_USER_SAMPLE_SELECT,
  });

  const petOwnerCandidates = petOwnerCandidatesRaw.map(formatMlSampleUser);

  // Pick up to 4 pet-owning users with distinct pet profiles
  const selectedPetOwners: MlSampleUser[] = [];
  const seenSignatures = new Set<string>();
  const pickedIds = new Set<number>();

  for (const candidate of petOwnerCandidates) {
    if (selectedPetOwners.length >= 4) break;
    const sig = buildPetProfileSignature(candidate);
    if (!seenSignatures.has(sig)) {
      seenSignatures.add(sig);
      selectedPetOwners.push(candidate);
      pickedIds.add(candidate.id);
    }
  }
  for (const candidate of petOwnerCandidates) {
    if (selectedPetOwners.length >= 4) break;
    if (!pickedIds.has(candidate.id)) {
      selectedPetOwners.push(candidate);
      pickedIds.add(candidate.id);
    }
  }

  // Pick 1 host persona (distinct from selected pet owners)
  const hostRaw = await prisma.user.findFirst({
    where: {
      ...baseWhere,
      ...(pickedIds.size > 0 ? { id: { notIn: Array.from(pickedIds) } } : {}),
      userRoles: {
        some: {
          role: {
            name: 'host',
            deletedAt: null,
          },
        },
      },
    },
    orderBy: { id: 'asc' },
    select: ADMIN_USER_SAMPLE_SELECT,
  });

  const extras: MlSampleUser[] = [];
  if (hostRaw) {
    const formattedHost = formatMlSampleUser(hostRaw);
    extras.push(formattedHost);
    pickedIds.add(formattedHost.id);
  }

  // Pick 1 no-pet / admin persona (prefer admin without pets, fallback to any no-pet user)
  let noPetRaw = await prisma.user.findFirst({
    where: {
      ...baseWhere,
      ...(pickedIds.size > 0 ? { id: { notIn: Array.from(pickedIds) } } : {}),
      petProfiles: { none: { deletedAt: null } },
      userRoles: {
        some: {
          role: {
            name: 'admin',
            deletedAt: null,
          },
        },
      },
    },
    orderBy: { id: 'asc' },
    select: ADMIN_USER_SAMPLE_SELECT,
  });

  if (!noPetRaw) {
    noPetRaw = await prisma.user.findFirst({
      where: {
        ...baseWhere,
        ...(pickedIds.size > 0 ? { id: { notIn: Array.from(pickedIds) } } : {}),
        petProfiles: { none: { deletedAt: null } },
      },
      orderBy: { id: 'asc' },
      select: ADMIN_USER_SAMPLE_SELECT,
    });
  }

  if (noPetRaw) {
    const formattedNoPet = formatMlSampleUser(noPetRaw);
    extras.push(formattedNoPet);
    pickedIds.add(formattedNoPet.id);
  }

  const combined = [...selectedPetOwners, ...extras];
  const withPets = combined.filter((u) => u.pets.length > 0);
  const withoutPets = combined.filter((u) => u.pets.length === 0);
  return [...withPets, ...withoutPets].slice(0, 6);
}

async function fetchFeaturedAdminSampleProperties(): Promise<MlSampleProperty[]> {
  const properties = await prisma.property.findMany({
    where: buildActivePropertyBaseWhere(),
    orderBy: [{ avgRating: 'desc' }, { bookingCount: 'desc' }, { id: 'asc' }],
    take: 12,
    select: ADMIN_PROPERTY_SAMPLE_SELECT,
  });

  return properties.map(formatMlSampleProperty);
}

async function getAdminMlSamplesCached(): Promise<AdminMlSamplesPayload> {
  const cached = await cacheService.get<AdminMlSamplesPayload>(ADMIN_ML_SAMPLES_CACHE_KEY);
  if (cached) return cached;

  const [sampleUsers, sampleProperties, totalUsers, totalActiveProperties] = await Promise.all([
    fetchFeaturedAdminSampleUsers(),
    fetchFeaturedAdminSampleProperties(),
    prisma.user.count({ where: buildActiveUserBaseWhere() }),
    prisma.property.count({ where: buildActivePropertyBaseWhere() }),
  ]);

  const payload: AdminMlSamplesPayload = {
    sampleUsers,
    sampleProperties,
    totalUsers,
    totalActiveProperties,
  };

  await cacheService.set(ADMIN_ML_SAMPLES_CACHE_KEY, payload, ADMIN_ML_SAMPLES_TTL_SECONDS);
  return payload;
}

/**
 * GET /api/v1/admin/ml/status
 */
export async function getAdminMlStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isAdminUser(req.user)) {
      throw new AppError('Access forbidden. Insufficient permissions.', 403, 'A-3007');
    }

    const [status, samples] = await Promise.all([
      getMlServiceStatus(),
      getAdminMlSamplesCached(),
    ]);
    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: {
        ...status,
        sampleUsers: samples.sampleUsers,
        sampleProperties: samples.sampleProperties,
        totalUsers: samples.totalUsers,
        totalActiveProperties: samples.totalActiveProperties,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/ml/users/search?q=&limit=10
 */
export async function searchAdminMlUsers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isAdminUser(req.user)) {
      throw new AppError('Access forbidden. Insufficient permissions.', 403, 'A-3007');
    }

    const q = String(req.query.q ?? '').trim();
    const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || '10'), 10) || 10));
    const numericId = /^\d+$/.test(q) ? parsePositiveInt(q) : null;

    const where: Record<string, unknown> = {
      ...buildActiveUserBaseWhere(),
    };

    if (q) {
      const orConditions: Record<string, unknown>[] = [
        { email: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
      ];
      if (numericId !== null) {
        orConditions.unshift({ id: numericId });
      }
      where.OR = orConditions;
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { id: 'asc' },
      take: limit,
      select: ADMIN_USER_SAMPLE_SELECT,
    });

    const formatted = users.map(formatMlSampleUser);
    if (numericId !== null) {
      formatted.sort((a, b) => {
        if (a.id === numericId && b.id !== numericId) return -1;
        if (b.id === numericId && a.id !== numericId) return 1;
        return a.id - b.id;
      });
    }

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/ml/properties/search?q=&limit=10
 */
export async function searchAdminMlProperties(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isAdminUser(req.user)) {
      throw new AppError('Access forbidden. Insufficient permissions.', 403, 'A-3007');
    }

    const q = String(req.query.q ?? '').trim();
    const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || '10'), 10) || 10));
    const numericId = /^\d+$/.test(q) ? parsePositiveInt(q) : null;

    const where: Record<string, unknown> = {
      ...buildActivePropertyBaseWhere(),
    };

    if (q) {
      const orConditions: Record<string, unknown>[] = [
        { title: { contains: q, mode: 'insensitive' } },
        { province: { contains: q, mode: 'insensitive' } },
        { district: { contains: q, mode: 'insensitive' } },
      ];
      if (numericId !== null) {
        orConditions.unshift({ id: numericId });
      }
      where.OR = orConditions;
    }

    const properties = await prisma.property.findMany({
      where,
      orderBy: { id: 'asc' },
      take: limit,
      select: ADMIN_PROPERTY_SAMPLE_SELECT,
    });

    const formatted = properties.map(formatMlSampleProperty);
    if (numericId !== null) {
      formatted.sort((a, b) => {
        if (a.id === numericId && b.id !== numericId) return -1;
        if (b.id === numericId && a.id !== numericId) return 1;
        return a.id - b.id;
      });
    }

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/admin/ml/refresh
 */
export async function refreshAdminMlCache(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isAdminUser(req.user)) {
      throw new AppError('Access forbidden. Insufficient permissions.', 403, 'A-3007');
    }

    await cacheService.del(ADMIN_ML_SAMPLES_CACHE_KEY);
    const result = await refreshMlCaches();
    res.status(200).json({
      code: 'S-0000',
      message: 'ML recommendation caches refreshed successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
