import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthenticatedUser } from '../middlewares/auth.middleware';
import { formatPropertyDto, getUserFavoriteMap } from './property.controller';
import {
  getMlServiceStatus,
  getSimilarPropertyRecommendations,
  getUserOrColdStartRecommendations,
  invalidateUserRecommendationCache,
  RecommendationItem,
  recordUserBehaviorSafe,
  refreshMlCaches,
} from '../services/recommendation.service';

function parsePositiveInt(raw: unknown): number | null {
  const str = String(raw ?? '').trim();
  if (!/^\d+$/.test(str)) return null;
  const num = parseInt(str, 10);
  if (!Number.isSafeInteger(num) || num <= 0) return null;
  return num;
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
    const asUserIdRaw =
      req.query.asUserId !== undefined ? String(req.query.asUserId).trim() : '';
    const hasAsUserId = asUserIdRaw !== '';

    if ((debugRequested || hasAsUserId) && !isAdminUser(req.user)) {
      throw new AppError('Access forbidden. Insufficient permissions.', 403, 'A-3007');
    }

    let targetUserId: number | null = req.user?.id ?? null;
    if (hasAsUserId) {
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

    const recResult = await getUserOrColdStartRecommendations(
      targetUserId,
      50,
      debugRequested
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

    const status = await getMlServiceStatus();
    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: status,
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
