import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma';
import { AppError } from '../middlewares/errorHandler';
import { normalizePetName } from './lookup.controller';
import { cacheService } from '../services/cache.service';
import {
  invalidateAllRecommendationCaches,
  rankCandidateProperties,
  RecommendationItem,
  RecommendationMeta,
  triggerMlRefresh,
  UserLocation,
} from '../services/recommendation.service';
import {
  syncPropertyBookingCount as syncPropertyBookingCountCanonical,
  getBookingDateBounds,
  getDatesInRange,
} from '../services/bookingLifecycle.service';
/**
 * Safely converts any Date object, ISO string, or timestamp into an ISO string.
 * Falls back to current date or custom fallback if input is null or undefined.
 */
export function toSafeIsoString(dateVal: any, fallback?: string): string {
  if (!dateVal) return fallback !== undefined ? fallback : new Date().toISOString();
  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? (fallback !== undefined ? fallback : new Date().toISOString()) : dateVal.toISOString();
  }
  const parsed = new Date(dateVal);
  return isNaN(parsed.getTime()) ? (fallback !== undefined ? fallback : new Date().toISOString()) : parsed.toISOString();
}


/**
 * Helper to fetch user's favorite property map (propertyId -> folderId)
 */
export async function getUserFavoriteMap(userId?: number): Promise<Map<number, number>> {
  const favMap = new Map<number, number>();
  if (!userId) return favMap;

  const favs = await prisma.favoriteProperty.findMany({
    where: {
      folder: {
        userId,
        deletedAt: null,
      },
    },
    select: {
      propertyId: true,
      folderId: true,
    },
  });

  for (const fav of favs) {
    favMap.set(fav.propertyId, fav.folderId);
  }
  return favMap;
}

/**
 * Formats a Prisma Property record into the frontend Property DTO shape
 */
export function formatPropertyDto(
  prop: any,
  favMap: Map<number, number>,
  options?: {
    hostAvgRating?: number;
    chatRoomId?: number | null;
    includeReviews?: boolean;
  }
) {
  const ratedBookings = Array.isArray(prop.bookings)
    ? prop.bookings.filter((b: any) => typeof b.rating === 'number' && b.rating > 0)
    : [];

  const reviewCount =
    typeof prop.reviewCount === 'number'
      ? prop.reviewCount
      : ratedBookings.length;

  const avgRating =
    typeof prop.avgRating === 'number'
      ? Number(prop.avgRating)
      : reviewCount > 0
      ? Number(
          (
            ratedBookings.reduce((sum: number, b: any) => sum + (b.rating || 0), 0) /
            reviewCount
          ).toFixed(2)
        )
      : 0;

  const images = Array.isArray(prop.images)
    ? prop.images.map((img: any) => ({
        id: img.id,
        fileName: img.fileName || '',
        filePath: img.filePath,
        fileContentType: img.fileContentType || 'image/webp',
        fileExtensionName: img.fileExtensionName || 'webp',
        fileSize: img.fileSize || 0,
      }))
    : [];

  // Aggregate unique allowed pets across all room categories
  const petMap = new Map<number, { id: number; name: string }>();
  const roomCategories = Array.isArray(prop.roomCategories)
    ? prop.roomCategories.map((rc: any) => {
        const rcPets = Array.isArray(rc.pets)
          ? rc.pets.map((rcp: any) => {
              const petObj = rcp.pet || rcp;
              const normalized = {
                id: petObj.id,
                name: normalizePetName(petObj.name),
              };
              petMap.set(normalized.id, normalized);
              return normalized;
            })
          : [];

        const basePriceNum = Number(rc.basePrice || 0);

        return {
          id: rc.id,
          name: rc.name || '',
          totalRoom: rc.totalRoom ?? 1,
          numberOfPets: rc.numberOfPets ?? 1,
          basePrice: basePriceNum,
          roomSizeWidth: rc.roomSizeWidth != null ? Number(rc.roomSizeWidth) : null,
          roomSizeLength: rc.roomSizeLength != null ? Number(rc.roomSizeLength) : null,
          roomSizeHeight: rc.roomSizeHeight != null ? Number(rc.roomSizeHeight) : null,
          propertyId: rc.propertyId ?? prop.id,
          petSizeCategoryId: rc.petSizeCategoryId ?? undefined,
          isAvailable: (rc.totalRoom ?? 1) > 0,
          isCapacityInsufficient: false,
          isBooked: false,
          availability: {
            roomsNeeded: 1,
            availableRooms: rc.totalRoom ?? 1,
            totalPrice: basePriceNum,
            dates: [],
          },
          ...(rc.petSizeCategory
            ? {
                petSizeCategory: {
                  id: rc.petSizeCategory.id,
                  name: rc.petSizeCategory.name,
                  code: rc.petSizeCategory.code,
                  min: rc.petSizeCategory.min,
                  max: rc.petSizeCategory.max,
                },
              }
            : {}),
          pets: rcPets,
          facilities: Array.isArray(rc.facilities)
            ? rc.facilities.map((rcf: any) => ({
                id: rcf.facility?.id ?? rcf.id,
                name: rcf.facility?.name ?? rcf.name,
              }))
            : [],
          images: Array.isArray(rc.images)
            ? rc.images.map((img: any) => ({
                id: img.id,
                fileName: img.fileName || '',
                filePath: img.filePath,
                fileContentType: img.fileContentType || 'image/webp',
                fileExtensionName: img.fileExtensionName || 'webp',
                fileSize: img.fileSize || 0,
              }))
            : [],
        };
      })
    : [];

  const facilities = Array.isArray(prop.facilities)
    ? prop.facilities.map((pf: any) => ({
        id: pf.facility.id,
        name: pf.facility.name,
        category: pf.facility.category
          ? {
              id: pf.facility.category.id,
              name: pf.facility.category.name,
            }
          : { id: pf.facility.categoryId || 0, name: '' },
      }))
    : [];

  const lowestPrice =
    prop.minPrice !== undefined && prop.minPrice !== null && Number(prop.minPrice) > 0
      ? Number(prop.minPrice)
      : roomCategories.length > 0
      ? Math.min(...roomCategories.map((rc: any) => rc.basePrice))
      : 0;

  const resolvedHostAvgRating =
    options?.hostAvgRating !== undefined ? options.hostAvgRating : avgRating;

  const hostDto = prop.host
    ? {
        id: prop.host.id,
        firstName: prop.host.firstName || 'Host',
        lastName: prop.host.lastName || '',
        avatar: prop.host.avatar || '',
        hostAvgRating: resolvedHostAvgRating,
        isVerifiedHost: Boolean(prop.host.isVerifiedHost),
      }
    : undefined;

  const reviews =
    options?.includeReviews && Array.isArray(prop.bookings)
      ? ratedBookings.map((b: any) => ({
          bookingId: b.id,
          firstName: b.guest?.firstName || 'Guest',
          lastName: b.guest?.lastName || '',
          avatar: b.guest?.avatar || null,
          comment: b.comment || '',
          rating: b.rating || 0,
          reviewedAt: toSafeIsoString(b.reviewedAt || b.updatedAt || b.createdAt),
          hostReply: b.hostReply || null,
          hostRepliedAt: b.hostRepliedAt ? toSafeIsoString(b.hostRepliedAt) : null,
          reviewImages: Array.isArray(b.reviewImages)
            ? b.reviewImages.map((img: any) => ({
                id: img.id,
                fileName: img.fileName || '',
                filePath: img.filePath,
                fileContentType: img.fileContentType || 'image/webp',
                fileExtensionName: img.fileExtensionName || 'webp',
                fileSize: img.fileSize || 0,
              }))
            : [],
        }))
      : undefined;

  return {
    id: prop.id,
    title: prop.title,
    description: prop.description || '',
    address: prop.address || '',
    province: prop.province || '',
    district: prop.district || '',
    subdistrict: prop.subdistrict || '',
    country: prop.country || 'Thailand',
    latitude: prop.latitude ?? 0,
    longitude: prop.longitude ?? 0,
    zipcode: prop.zipcode || '',
    isActive: prop.isActive,
    isBannedByAdmin: prop.isBannedByAdmin,
    isBannedBeforeAccountBan: prop.isBannedBeforeAccountBan,
    isFavorite: favMap.has(prop.id),
    favoriteFolderId: favMap.get(prop.id) ?? null,
    avgRating,
    reviewCount,
    lowestPrice,
    hostId: prop.hostId,
    hostAvgRating: resolvedHostAvgRating,
    propertyTypeId: prop.propertyTypeId || 1,
    propertyType: prop.propertyType
      ? {
          id: prop.propertyType.id,
          name: prop.propertyType.name,
        }
      : undefined,
    images,
    roomCategories,
    totalRoomCategories: roomCategories.length,
    facilities,
    pets: Array.from(petMap.values()),
    host: hostDto,
    ...(reviews !== undefined ? { reviews } : {}),
    chatRoomId: options?.chatRoomId ?? null,
    createdAt: toSafeIsoString(prop.createdAt),
    publishedAt: prop.publishedAt ? toSafeIsoString(prop.publishedAt) : undefined,
    updatedAt: toSafeIsoString(prop.updatedAt),
    _bookingCount:
      typeof prop.bookingCount === 'number'
        ? prop.bookingCount
        : Array.isArray(prop.bookings)
        ? prop.bookings.length
        : 0,
  };
}

/**
 * Invalidate all property-related caches.
 */
export async function invalidatePropertyCaches(): Promise<number> {
  const deleted = await cacheService.delByPrefix('properties:');
  await cacheService.del('locations:provinces');
  await invalidateAllRecommendationCaches();
  triggerMlRefresh();
  return deleted;
}

/**
 * Synchronizes the materialized min_price column for a given property.
 */
export async function syncPropertyMinPrice(propertyId: number): Promise<void> {
  const roomCategories = await prisma.roomCategory.findMany({
    where: { propertyId, deletedAt: null },
    select: { basePrice: true },
  });
  let minPrice = 0;
  if (roomCategories.length > 0) {
    minPrice = Math.min(...roomCategories.map((rc) => Number(rc.basePrice)));
    if (!isFinite(minPrice) || minPrice < 0) minPrice = 0;
  }
  await prisma.property.update({
    where: { id: propertyId },
    data: { minPrice },
  });
  await invalidatePropertyCaches();
}

/**
 * Synchronizes the materialized avg_rating and review_count columns for a given property.
 */
export async function syncPropertyRating(propertyId: number): Promise<void> {
  const ratedBookings = await prisma.booking.findMany({
    where: {
      propertyId,
      deletedAt: null,
      rating: { not: null, gt: 0 },
    },
    select: { rating: true },
  });
  const reviewCount = ratedBookings.length;
  const avgRating =
    reviewCount > 0
      ? Number(
          (
            ratedBookings.reduce((sum, b) => sum + (b.rating || 0), 0) /
            reviewCount
          ).toFixed(2)
        )
      : 0;
  await prisma.property.update({
    where: { id: propertyId },
    data: { avgRating, reviewCount },
  });
  await invalidatePropertyCaches();
}

/**
 * Synchronizes the materialized booking_count column for a given property.
 */
export async function syncPropertyBookingCount(propertyId: number): Promise<void> {
  return syncPropertyBookingCountCanonical(propertyId);
}

export async function getProperties(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // ------------------------------------------------------------------
    // 0. Parse & validate discovery query params upfront (before cache)
    // ------------------------------------------------------------------
    const checkInRaw =
      typeof req.query.checkIn === 'string' ? req.query.checkIn.trim() : '';
    const checkOutRaw =
      typeof req.query.checkOut === 'string' ? req.query.checkOut.trim() : '';
    const hasDateFilter = Boolean(checkInRaw || checkOutRaw);
    let nightDateStrs: string[] = [];

    if (hasDateFilter) {
      if (!checkInRaw || !checkOutRaw) {
        throw new AppError(
          'Both checkIn and checkOut are required when filtering by dates.',
          400,
          'B-4003'
        );
      }

      const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!isoDateRegex.test(checkInRaw) || !isoDateRegex.test(checkOutRaw)) {
        throw new AppError(
          'Invalid date format. Expected YYYY-MM-DD for checkIn and checkOut.',
          400,
          'B-4003'
        );
      }

      const checkInDate = new Date(`${checkInRaw}T00:00:00.000Z`);
      const checkOutDate = new Date(`${checkOutRaw}T00:00:00.000Z`);
      if (
        isNaN(checkInDate.getTime()) ||
        isNaN(checkOutDate.getTime()) ||
        checkInDate.toISOString().slice(0, 10) !== checkInRaw ||
        checkOutDate.toISOString().slice(0, 10) !== checkOutRaw
      ) {
        throw new AppError(
          'Invalid calendar date for checkIn or checkOut.',
          400,
          'B-4003'
        );
      }

      if (checkOutRaw <= checkInRaw) {
        throw new AppError(
          'Check-out date must be after check-in date.',
          400,
          'B-4003'
        );
      }

      const { todayThaiStr, maxAdvanceStr } = getBookingDateBounds();
      if (checkInRaw < todayThaiStr) {
        throw new AppError(
          'Check-in date cannot be in the past.',
          400,
          'B-4003'
        );
      }

      if (checkOutRaw > maxAdvanceStr) {
        throw new AppError(
          'Dates cannot exceed 180 days in advance.',
          400,
          'B-4003'
        );
      }

      const diffDays = Math.round(
        (checkOutDate.getTime() - checkInDate.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (diffDays <= 0 || diffDays > 90) {
        throw new AppError(
          'Stay length must be between 1 and 90 nights.',
          400,
          'B-4003'
        );
      }

      nightDateStrs = getDatesInRange(checkInRaw, checkOutRaw);
    }

    const petSizeCategoryIdRaw =
      req.query.petSizeCategoryId !== undefined
        ? String(req.query.petSizeCategoryId).trim()
        : '';
    let petSizeCategoryId: number | null = null;
    if (petSizeCategoryIdRaw !== '') {
      if (!/^\d+$/.test(petSizeCategoryIdRaw)) {
        throw new AppError(
          'petSizeCategoryId must be a positive integer.',
          400,
          'T-2007'
        );
      }
      const parsed = parseInt(petSizeCategoryIdRaw, 10);
      if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new AppError(
          'petSizeCategoryId must be a positive integer.',
          400,
          'T-2007'
        );
      }
      petSizeCategoryId = parsed;
    }

    const petProfileIdsRaw =
      req.query.petProfileIds !== undefined
        ? Array.isArray(req.query.petProfileIds)
          ? req.query.petProfileIds.join(',')
          : String(req.query.petProfileIds).trim()
        : '';
    const parsedPetProfileIds: number[] = [];
    if (petProfileIdsRaw !== '') {
      const seen = new Set<number>();
      for (const tok of petProfileIdsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)) {
        if (!/^\d+$/.test(tok)) {
          throw new AppError(
            'petProfileIds must be comma-separated positive integers.',
            400,
            'T-2007'
          );
        }
        const num = parseInt(tok, 10);
        if (!Number.isSafeInteger(num) || num <= 0) {
          throw new AppError(
            'petProfileIds must be comma-separated positive integers.',
            400,
            'T-2007'
          );
        }
        if (!seen.has(num)) {
          seen.add(num);
          parsedPetProfileIds.push(num);
        }
      }
    }

    const propertyTypeIdRaw =
      req.query.propertyTypeId !== undefined
        ? String(req.query.propertyTypeId).trim()
        : '';
    let propertyTypeId: number | null = null;
    if (propertyTypeIdRaw !== '') {
      if (!/^\d+$/.test(propertyTypeIdRaw)) {
        throw new AppError(
          'propertyTypeId must be a positive integer.',
          400,
          'T-2007'
        );
      }
      const parsed = parseInt(propertyTypeIdRaw, 10);
      if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new AppError(
          'propertyTypeId must be a positive integer.',
          400,
          'T-2007'
        );
      }
      propertyTypeId = parsed;
    }

    const propertyTypeRaw =
      typeof req.query.propertyType === 'string'
        ? req.query.propertyType.trim()
        : '';

    const facilitiesRaw =
      req.query.facilities !== undefined
        ? Array.isArray(req.query.facilities)
          ? req.query.facilities.join(',')
          : String(req.query.facilities).trim()
        : '';
    const parsedFacilities = facilitiesRaw
      ? facilitiesRaw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const minPriceRaw =
      req.query.minPrice !== undefined ? String(req.query.minPrice).trim() : '';
    let minPrice = NaN;
    if (minPriceRaw !== '') {
      minPrice = parseFloat(minPriceRaw);
      if (!Number.isFinite(minPrice) || minPrice < 0) {
        throw new AppError(
          'minPrice must be a non-negative number.',
          400,
          'T-2007'
        );
      }
    }

    const latRaw = req.query.lat;
    const lngRaw = req.query.lng;
    const latStr = Array.isArray(latRaw)
      ? ''
      : latRaw !== undefined
      ? String(latRaw).trim()
      : '';
    const lngStr = Array.isArray(lngRaw)
      ? ''
      : lngRaw !== undefined
      ? String(lngRaw).trim()
      : '';
    const hasLatParam = latRaw !== undefined && (Array.isArray(latRaw) || latStr !== '');
    const hasLngParam = lngRaw !== undefined && (Array.isArray(lngRaw) || lngStr !== '');
    let userLocation: UserLocation | null = null;
    if (hasLatParam || hasLngParam) {
      if (!hasLatParam || !hasLngParam) {
        throw new AppError(
          'Both lat and lng are required when filtering or ranking by location.',
          400,
          'T-2007'
        );
      }
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
        throw new AppError(
          'lat must be between -90 and 90, and lng must be between -180 and 180.',
          400,
          'T-2007'
        );
      }
      userLocation = { lat, lng };
    }

    const sortBy =
      typeof req.query.sortBy === 'string'
        ? req.query.sortBy.trim().toLowerCase()
        : '';
    const isMlRecommendedSort = sortBy === 'recommended' && req.query.ids === undefined;

    // Scope cache key by user & rounded geo when sortBy=recommended (prevents cross-user ranking leak)
    const queryForCache: Record<string, unknown> = { ...req.query };
    if (isMlRecommendedSort && userLocation) {
      queryForCache.lat = userLocation.lat.toFixed(2);
      queryForCache.lng = userLocation.lng.toFixed(2);
    }
    const cacheScopeParts: string[] = [];
    if (isMlRecommendedSort) {
      cacheScopeParts.push(`user:${req.user?.id ?? 'guest'}`);
      if (userLocation) {
        cacheScopeParts.push(`loc:${userLocation.lat.toFixed(2)},${userLocation.lng.toFixed(2)}`);
      }
    } else if (parsedPetProfileIds.length > 0) {
      cacheScopeParts.push(`u:${req.user?.id ?? 'anon'}`);
    }
    const cacheScope =
      cacheScopeParts.length > 0 ? `${cacheScopeParts.join(':')}:` : '';
    const cacheKey = `properties:list:${cacheScope}${JSON.stringify(queryForCache)}`;
    const cached = await cacheService.get<any>(cacheKey);

    if (cached) {
      if (!req.user?.id) {
        res.status(200).json(cached);
        return;
      }
      const favMap = await getUserFavoriteMap(req.user.id);
      const personalizedData = cached.data.map((p: any) => ({
        ...p,
        isFavorite: favMap.has(p.id),
        favoriteFolderId: favMap.get(p.id) ?? null,
      }));
      res.status(200).json({
        ...cached,
        data: personalizedData,
      });
      return;
    }

    if (req.query.ids !== undefined) {
      const rawIds = Array.isArray(req.query.ids)
        ? req.query.ids.join(',')
        : String(req.query.ids);
      const tokens = rawIds
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      if (tokens.length === 0 || tokens.length > 50) {
        throw new AppError(
          'ids must contain between 1 and 50 positive integers.',
          400,
          'T-2007'
        );
      }

      const parsedIds: number[] = [];
      const seenIds = new Set<number>();
      for (const tok of tokens) {
        if (!/^\d+$/.test(tok)) {
          throw new AppError('ids must be comma-separated positive integers.', 400, 'T-2007');
        }
        const num = parseInt(tok, 10);
        if (!Number.isSafeInteger(num) || num <= 0) {
          throw new AppError('ids must be comma-separated positive integers.', 400, 'T-2007');
        }
        if (!seenIds.has(num)) {
          seenIds.add(num);
          parsedIds.push(num);
        }
      }

      const dbProperties = await prisma.property.findMany({
        where: {
          id: { in: parsedIds },
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
            take: 5,
          },
          propertyType: true,
          roomCategories: {
            where: { deletedAt: null },
            select: {
              id: true,
              basePrice: true,
              pets: {
                select: {
                  pet: true,
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
      });

      const anonymousFavMap = new Map<number, number>();
      const byId = new Map<number, any>();
      for (const p of dbProperties) {
        const dto = formatPropertyDto(p, anonymousFavMap);
        const { _bookingCount, ...rest } = dto;
        byId.set(p.id, rest);
      }

      const orderedData = parsedIds.map((id) => byId.get(id)).filter(Boolean);
      const baseBatchResponse = {
        code: 'S-0000',
        message: 'Success',
        data: orderedData,
        pagination: {
          page: 1,
          limit: orderedData.length,
          totalRows: orderedData.length,
          totalPages: orderedData.length > 0 ? 1 : 0,
        },
      };

      await cacheService.set(cacheKey, baseBatchResponse, 60);

      if (req.user?.id) {
        const favMap = await getUserFavoriteMap(req.user.id);
        const personalizedData = orderedData.map((p: any) => ({
          ...p,
          isFavorite: favMap.has(p.id),
          favoriteFolderId: favMap.get(p.id) ?? null,
        }));
        res.status(200).json({
          ...baseBatchResponse,
          data: personalizedData,
        });
        return;
      }

      res.status(200).json(baseBatchResponse);
      return;
    }

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20)
    );
    const minRating =
      req.query.minRating !== undefined
        ? parseFloat(String(req.query.minRating))
        : 0;
    const days =
      req.query.days !== undefined ? parseInt(String(req.query.days), 10) : NaN;
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const province =
      typeof req.query.province === 'string' ? req.query.province.trim() : '';
    const petTypesRaw =
      typeof req.query.petTypes === 'string' ? req.query.petTypes.trim() : '';
    const maxPrice =
      req.query.maxPrice !== undefined && String(req.query.maxPrice).trim() !== ''
        ? parseFloat(String(req.query.maxPrice))
        : NaN;

    // Load authenticated user's selected pet profiles (if petProfileIds passed)
    let userPets: Array<{
      id: number;
      petTypeId: number;
      weight: number | null;
      petSizeCategoryId: number | null;
      sizeCode: number | null;
    }> = [];
    const uniquePetProfileIds = Array.from(new Set(parsedPetProfileIds));
    if (uniquePetProfileIds.length > 0) {
      if (!req.user?.id) {
        res.status(401).json({
          code: 'A-3005',
          message: 'Authentication required to filter by pet profiles',
        });
        return;
      }

      const dbPets = await prisma.petProfile.findMany({
        where: {
          id: { in: uniquePetProfileIds },
          guestId: req.user.id,
          deletedAt: null,
        },
        include: {
          petSizeCategory: true,
        },
      });

      if (dbPets.length !== uniquePetProfileIds.length) {
        res.status(403).json({
          code: 'A-3007',
          message: 'Forbidden: one or more pet profiles do not belong to your account',
        });
        return;
      }

      userPets = dbPets.map((p) => ({
        id: p.id,
        petTypeId: p.petTypeId,
        weight: p.weight != null ? Number(p.weight) : null,
        petSizeCategoryId: p.petSizeCategoryId ?? null,
        sizeCode: p.petSizeCategory?.code ?? null,
      }));
    }

    // Resolve requested petSizeCategory code (if petSizeCategoryId passed)
    let reqSizeCode: number | null = null;
    if (petSizeCategoryId !== null) {
      const sizeCat = await prisma.petSizeCategory.findUnique({
        where: { id: petSizeCategoryId },
        select: { id: true, code: true },
      });
      reqSizeCode = sizeCat?.code ?? null;
    }

    const andConditions: Prisma.PropertyWhereInput[] = [
      { isActive: true },
      { deletedAt: null },
      { isBannedByAdmin: false },
      {
        host: {
          deletedAt: null,
          bannedAt: null,
          isBannedAllProperties: false,
        },
      },
    ];

    if (search) {
      andConditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { province: { contains: search, mode: 'insensitive' } },
          { district: { contains: search, mode: 'insensitive' } },
          { subdistrict: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (province) {
      const normalizedProvQuery = province.replace(/^(จังหวัด|จ\.)\s*/i, '').trim();
      const matchedProvince = await prisma.province.findFirst({
        where: {
          OR: [
            { nameEn: { equals: normalizedProvQuery, mode: 'insensitive' } },
            { nameTh: { equals: normalizedProvQuery, mode: 'insensitive' } },
          ],
        },
        select: { nameEn: true, nameTh: true },
      });

      if (matchedProvince) {
        andConditions.push({
          OR: [
            { province: { contains: matchedProvince.nameEn, mode: 'insensitive' } },
            { province: { contains: matchedProvince.nameTh, mode: 'insensitive' } },
          ],
        });
      } else {
        andConditions.push({
          province: { contains: province, mode: 'insensitive' },
        });
      }
    }

    if (!isNaN(days) && days > 0) {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      andConditions.push({
        createdAt: { gte: cutoffDate },
      });
    }

    const petTypeTokens = petTypesRaw
      ? petTypesRaw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    if (petTypeTokens.length > 0) {
      const petOrFilters: Prisma.RoomCategoryPetWhereInput[] = [];
      for (const token of petTypeTokens) {
        const numId = Number(token);
        if (!isNaN(numId) && Number.isInteger(numId) && numId > 0) {
          petOrFilters.push({ petId: numId });
        } else {
          petOrFilters.push({
            pet: {
              name: { contains: token, mode: 'insensitive' },
            },
          });
        }
      }
      andConditions.push({
        roomCategories: {
          some: {
            deletedAt: null,
            pets: {
              some: {
                OR: petOrFilters,
              },
            },
          },
        },
      });
    }

    // Lifestyle / Intent filters: facilities, propertyType, propertyTypeId, minPrice
    if (parsedFacilities.length > 0) {
      const facilityOrFilters: Prisma.PropertyFacilityWhereInput[] = [];
      for (const token of parsedFacilities) {
        if (/^\d+$/.test(token)) {
          const numId = parseInt(token, 10);
          if (Number.isSafeInteger(numId) && numId > 0) {
            facilityOrFilters.push({ facilityId: numId });
            continue;
          }
        }
        facilityOrFilters.push({
          facility: {
            name: { contains: token, mode: 'insensitive' },
          },
        });
      }
      if (facilityOrFilters.length > 0) {
        andConditions.push({
          facilities: {
            some: {
              OR: facilityOrFilters,
            },
          },
        });
      }
    }

    if (propertyTypeId !== null) {
      andConditions.push({ propertyTypeId });
    }

    if (propertyTypeRaw) {
      andConditions.push({
        propertyType: {
          is: {
            OR: [
              { name: { contains: propertyTypeRaw, mode: 'insensitive' } },
              { label: { contains: propertyTypeRaw, mode: 'insensitive' } },
            ],
          },
        },
      });
    }

    // 1. Push minRating directly to SQL
    if (!isNaN(minRating) && minRating > 0) {
      andConditions.push({ avgRating: { gte: minRating } });
    }

    // 2. Push minPrice & maxPrice directly to SQL
    if (!isNaN(minPrice) && minPrice >= 0) {
      andConditions.push({ minPrice: { gte: minPrice } });
    }
    if (!isNaN(maxPrice) && maxPrice >= 0) {
      andConditions.push({ minPrice: { lte: maxPrice, gt: 0 } });
    }

    // 3. Push sorting directly to SQL
    let orderBy:
      | Prisma.PropertyOrderByWithRelationInput
      | Prisma.PropertyOrderByWithRelationInput[];
    if (sortBy === 'price' || sortBy === 'price_asc' || sortBy === 'best_value') {
      orderBy = { minPrice: 'asc' };
    } else if (sortBy === 'price_desc') {
      orderBy = { minPrice: 'desc' };
    } else if (sortBy === 'rating' || sortBy === 'top_rated') {
      orderBy = [{ avgRating: 'desc' }, { reviewCount: 'desc' }];
    } else if (sortBy === 'trending' || sortBy === 'popular') {
      orderBy = [
        { bookingCount: 'desc' },
        { reviewCount: 'desc' },
        { avgRating: 'desc' },
      ];
    } else {
      orderBy = { createdAt: 'desc' };
    }

    const needsRoomLevelEval =
      hasDateFilter || petSizeCategoryId !== null || userPets.length > 0;

    type CandidatePropertyEntry = {
      prop: any;
      stayNights?: number;
      stayTotalPrice?: number;
    };

    let paginatedData: any[] = [];
    let totalRows = 0;
    let totalPages = 0;
    let mlRankCandidates: CandidatePropertyEntry[] | null = null;
    let rankMeta: RecommendationMeta | undefined;

    if (!needsRoomLevelEval) {
      const baseInclude = {
        images: {
          where: { deletedAt: null },
          orderBy: { id: 'asc' as const },
          take: 5,
        },
        propertyType: true,
        roomCategories: {
          where: { deletedAt: null },
          select: {
            id: true,
            basePrice: true,
            pets: {
              select: {
                pet: true,
              },
            },
          },
          orderBy: { basePrice: 'asc' as const },
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
      };

      if (isMlRecommendedSort) {
        // Collect all Stage A matching candidate properties (up to 500) for ML context-aware re-ranking
        const dbProperties = await prisma.property.findMany({
          where: { AND: andConditions },
          include: baseInclude,
          orderBy: { createdAt: 'desc' },
          take: 500,
        });
        mlRankCandidates = dbProperties.map((prop) => ({ prop }));
      } else {
        // Fast SQL-paginated path (100% backward compatible)
        totalRows = await prisma.property.count({
          where: { AND: andConditions },
        });
        totalPages = totalRows > 0 ? Math.ceil(totalRows / limit) : 0;

        const dbProperties =
          totalRows > 0
            ? await prisma.property.findMany({
                where: { AND: andConditions },
                include: baseInclude,
                orderBy,
                skip: (page - 1) * limit,
                take: limit,
              })
            : [];

        const anonymousFavMap = new Map<number, number>();
        paginatedData = dbProperties.map((p) => {
          const dto = formatPropertyDto(p, anonymousFavMap);
          const { _bookingCount, ...rest } = dto;
          return rest;
        });
      }
    } else {
      // Room-level availability & pet-safe eligibility path
      const candidateProperties = await prisma.property.findMany({
        where: { AND: andConditions },
        include: {
          images: {
            where: { deletedAt: null },
            orderBy: { id: 'asc' },
            take: 5,
          },
          propertyType: true,
          roomCategories: {
            where: { deletedAt: null },
            select: {
              id: true,
              name: true,
              totalRoom: true,
              numberOfPets: true,
              basePrice: true,
              propertyId: true,
              petSizeCategoryId: true,
              petSizeCategory: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  min: true,
                  max: true,
                },
              },
              pets: {
                select: {
                  petId: true,
                  pet: true,
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
        orderBy,
      });

      // Batch fetch room_category_calendars across [checkIn, checkOut) if dates provided
      const calendarMap = new Map<
        string,
        { bookedRooms: number; unavailableRooms: number; priceAdjustment: any }
      >();
      if (hasDateFilter && candidateProperties.length > 0 && nightDateStrs.length > 0) {
        const allRcIds: number[] = [];
        for (const prop of candidateProperties) {
          for (const rc of prop.roomCategories) {
            allRcIds.push(rc.id);
          }
        }
        if (allRcIds.length > 0) {
          const firstNight = new Date(`${nightDateStrs[0]}T00:00:00.000Z`);
          const lastNight = new Date(
            `${nightDateStrs[nightDateStrs.length - 1]}T00:00:00.000Z`
          );
          const calendars = await prisma.roomCategoryCalendar.findMany({
            where: {
              roomCategoryId: { in: allRcIds },
              deletedAt: null,
              date: {
                gte: firstNight,
                lte: lastNight,
              },
            },
            select: {
              roomCategoryId: true,
              date: true,
              bookedRooms: true,
              unavailableRooms: true,
              priceAdjustment: true,
            },
          });
          for (const cal of calendars) {
            const key = `${cal.roomCategoryId}:${toSafeIsoString(cal.date).slice(0, 10)}`;
            calendarMap.set(key, {
              bookedRooms: cal.bookedRooms,
              unavailableRooms: cal.unavailableRooms,
              priceAdjustment: cal.priceAdjustment,
            });
          }
        }
      }

      const rcMatchesPetTypesFilter = (rc: any): boolean => {
        if (petTypeTokens.length === 0) return true;
        return rc.pets.some((rcp: any) => {
          const petId = rcp.petId ?? rcp.pet?.id;
          const petName = String(rcp.pet?.name || '').toLowerCase();
          return petTypeTokens.some((tok) => {
            const numId = Number(tok);
            if (!isNaN(numId) && Number.isInteger(numId) && numId > 0) {
              return petId === numId;
            }
            return petName.includes(tok.toLowerCase());
          });
        });
      };

      const rcMatchesSizeFilter = (rc: any): boolean => {
        if (petSizeCategoryId === null) return true;
        if (rc.petSizeCategoryId == null) return true;
        const rcSizeCode = rc.petSizeCategory?.code ?? null;
        if (reqSizeCode !== null && rcSizeCode !== null) {
          return reqSizeCode <= rcSizeCode;
        }
        return petSizeCategoryId <= rc.petSizeCategoryId;
      };

      const rcMatchesUserPet = (
        rc: any,
        pet: {
          petTypeId: number;
          weight: number | null;
          petSizeCategoryId: number | null;
          sizeCode: number | null;
        }
      ): boolean => {
        const speciesMatch = rc.pets.some(
          (rcp: any) => (rcp.petId ?? rcp.pet?.id) === pet.petTypeId
        );
        if (!speciesMatch) return false;
        if (rc.petSizeCategoryId == null) return true;
        const rcSizeCode = rc.petSizeCategory?.code ?? null;
        if (pet.sizeCode !== null && rcSizeCode !== null) {
          return pet.sizeCode <= rcSizeCode;
        }
        if (pet.weight !== null && rc.petSizeCategory?.max != null) {
          return pet.weight <= Number(rc.petSizeCategory.max);
        }
        if (pet.petSizeCategoryId !== null) {
          return pet.petSizeCategoryId <= rc.petSizeCategoryId;
        }
        return false;
      };

      const evaluateRcAvailability = (
        rc: any
      ): { available: boolean; stayTotal: number } => {
        const totalRoom = rc.totalRoom ?? 0;
        if (totalRoom <= 0) return { available: false, stayTotal: 0 };
        const basePrice = Number(rc.basePrice || 0);
        let stayTotal = 0;
        for (const dateKey of nightDateStrs) {
          const cal = calendarMap.get(`${rc.id}:${dateKey}`);
          const booked = cal ? cal.bookedRooms : 0;
          const unavailable = cal ? cal.unavailableRooms : 0;
          if (totalRoom - booked - unavailable < 1) {
            return { available: false, stayTotal: 0 };
          }
          const priceAdj = cal ? Number(cal.priceAdjustment || 0) : 0;
          stayTotal += Math.max(0, basePrice + priceAdj);
        }
        return { available: true, stayTotal };
      };

      const evaluatedProperties: Array<{
        prop: any;
        stayNights?: number;
        stayTotalPrice?: number;
      }> = [];

      for (const prop of candidateProperties) {
        const eligibleRcs: Array<{ rc: any; stayTotal: number }> = [];

        for (const rc of prop.roomCategories) {
          if (!rcMatchesPetTypesFilter(rc)) continue;
          if (!rcMatchesSizeFilter(rc)) continue;

          if (hasDateFilter) {
            const avail = evaluateRcAvailability(rc);
            if (!avail.available) continue;
            eligibleRcs.push({ rc, stayTotal: avail.stayTotal });
          } else {
            eligibleRcs.push({ rc, stayTotal: Number(rc.basePrice || 0) });
          }
        }

        if (eligibleRcs.length === 0) continue;

        let pricingPool = eligibleRcs;
        if (userPets.length > 0) {
          // Every selected pet must have at least 1 eligible (and date-available) room category
          let allPetsMatched = true;
          const matchedRcSet = new Set<number>();
          for (const pet of userPets) {
            let petHasRoom = false;
            for (const entry of eligibleRcs) {
              if (rcMatchesUserPet(entry.rc, pet)) {
                petHasRoom = true;
                matchedRcSet.add(entry.rc.id);
              }
            }
            if (!petHasRoom) {
              allPetsMatched = false;
              break;
            }
          }
          if (!allPetsMatched) continue;
          pricingPool = eligibleRcs.filter((e) => matchedRcSet.has(e.rc.id));
        }

        if (hasDateFilter) {
          const stayTotalPrice = Math.min(...pricingPool.map((e) => e.stayTotal));
          evaluatedProperties.push({
            prop,
            stayNights: nightDateStrs.length,
            stayTotalPrice,
          });
        } else {
          evaluatedProperties.push({ prop });
        }
      }

      if (isMlRecommendedSort) {
        mlRankCandidates = evaluatedProperties.slice(0, 500);
      } else {
        // Sort by stayTotalPrice when date-filtered and price sorting is requested
        if (hasDateFilter) {
          if (
            sortBy === 'price' ||
            sortBy === 'price_asc' ||
            sortBy === 'best_value'
          ) {
            evaluatedProperties.sort(
              (a, b) => (a.stayTotalPrice ?? 0) - (b.stayTotalPrice ?? 0)
            );
          } else if (sortBy === 'price_desc') {
            evaluatedProperties.sort(
              (a, b) => (b.stayTotalPrice ?? 0) - (a.stayTotalPrice ?? 0)
            );
          }
        }

        totalRows = evaluatedProperties.length;
        totalPages = totalRows > 0 ? Math.ceil(totalRows / limit) : 0;
        const pageSlice = evaluatedProperties.slice(
          (page - 1) * limit,
          page * limit
        );

        const anonymousFavMap = new Map<number, number>();
        paginatedData = pageSlice.map(({ prop, stayNights, stayTotalPrice }) => {
          const dto = formatPropertyDto(prop, anonymousFavMap);
          const { _bookingCount, ...rest } = dto;
          return hasDateFilter
            ? {
                ...rest,
                stayNights,
                stayTotalPrice,
              }
            : rest;
        });
      }
    }

    if (isMlRecommendedSort && mlRankCandidates !== null) {
      const candidatePropertyIds = mlRankCandidates.map((c) => c.prop.id);
      const rankResult = await rankCandidateProperties({
        userId: req.user?.id ?? null,
        candidatePropertyIds,
        filterContext: {
          petTypes: petTypeTokens,
          petProfileIds: userPets.map((p) => p.id),
          facilities: parsedFacilities,
          maxPrice: !isNaN(maxPrice) ? maxPrice : undefined,
          province: province || undefined,
        },
        userLocation,
      });

      const candidateById = new Map(mlRankCandidates.map((c) => [c.prop.id, c]));
      const orderedRanked: Array<{
        candidate: CandidatePropertyEntry;
        rec: RecommendationItem;
      }> = [];
      const seenRankedIds = new Set<number>();

      for (const rec of rankResult.recommendations) {
        const cand = candidateById.get(rec.propertyId);
        if (cand && !seenRankedIds.has(rec.propertyId)) {
          seenRankedIds.add(rec.propertyId);
          orderedRanked.push({ candidate: cand, rec });
        }
      }
      for (const cand of mlRankCandidates) {
        if (!seenRankedIds.has(cand.prop.id)) {
          seenRankedIds.add(cand.prop.id);
          orderedRanked.push({
            candidate: cand,
            rec: {
              propertyId: cand.prop.id,
              score: 0,
              matchTier: 'context_fallback',
              matchReasons: ['Matches your filter'],
            },
          });
        }
      }

      totalRows = orderedRanked.length;
      totalPages = totalRows > 0 ? Math.ceil(totalRows / limit) : 0;
      const pageSlice = orderedRanked.slice((page - 1) * limit, page * limit);

      const anonymousFavMap = new Map<number, number>();
      paginatedData = pageSlice.map(({ candidate: { prop, stayNights, stayTotalPrice }, rec }) => {
        const dto = formatPropertyDto(prop, anonymousFavMap);
        const { _bookingCount, ...rest } = dto;
        return {
          ...rest,
          ...(hasDateFilter ? { stayNights, stayTotalPrice } : {}),
          matchReasons: rec.matchReasons,
          recommendationScore: rec.score,
          matchTier: rec.matchTier,
        };
      });
      rankMeta = rankResult.meta;
    }

    const baseResponse = {
      code: 'S-0000',
      message: 'Success',
      data: paginatedData,
      pagination: {
        page,
        limit,
        totalRows,
        totalPages,
      },
      ...(rankMeta ? { meta: rankMeta } : {}),
    };

    // Cache the result (shorter TTL when date-filtered, pet-scoped, or ML-ranked)
    await cacheService.set(
      cacheKey,
      baseResponse,
      hasDateFilter || parsedPetProfileIds.length > 0 || isMlRecommendedSort ? 30 : 60
    );

    if (req.user?.id) {
      const favMap = await getUserFavoriteMap(req.user.id);
      const personalizedData = paginatedData.map((p: any) => ({
        ...p,
        isFavorite: favMap.has(p.id),
        favoriteFolderId: favMap.get(p.id) ?? null,
      }));
      res.status(200).json({
        ...baseResponse,
        data: personalizedData,
      });
      return;
    }

    res.status(200).json(baseResponse);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/properties/featured-sections
 * Returns the 7 curated featured sections for the homepage with caching and personalization.
 */
export async function getFeaturedSections(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const cacheKey = 'properties:featured_sections:base';
    let baseData = await cacheService.get<any>(cacheKey);

    if (!baseData) {
      const dbProperties = await prisma.property.findMany({
        where: {
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
            take: 5,
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
              images: {
                where: { deletedAt: null },
                orderBy: { id: 'asc' },
              },
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
          host: true,
          bookings: {
            where: { deletedAt: null },
            select: {
              id: true,
              rating: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const anonymousFavMap = new Map<number, number>();
      const formattedList = dbProperties.map((p) =>
        formatPropertyDto(p, anonymousFavMap)
      );

      const stripInternalFields = ({ _bookingCount, ...rest }: any) => rest;

      // 1. allProperties: first 12 properties
      const allPropertiesTotal = formattedList.length;
      const allPropertiesTotalPages =
        allPropertiesTotal > 0 ? Math.ceil(allPropertiesTotal / 12) : 0;
      const allProperties = formattedList
        .slice(0, 12)
        .map(stripInternalFields);

      // 2. topRated: filter avgRating >= 4.0, sort by avgRating desc, reviewCount desc, slice 8
      const topRatedFiltered = formattedList
        .filter((p) => typeof p.avgRating === 'number' && p.avgRating >= 4.0)
        .sort((a, b) => b.avgRating - a.avgRating || b.reviewCount - a.reviewCount);
      const topRatedTotal = topRatedFiltered.length;
      const topRated = topRatedFiltered.slice(0, 8).map(stripInternalFields);

      // 3. bestValue: filter lowestPrice > 0, sort by lowestPrice asc, slice 8
      const bestValueFiltered = formattedList
        .filter((p) => typeof p.lowestPrice === 'number' && p.lowestPrice > 0)
        .sort((a, b) => a.lowestPrice - b.lowestPrice);
      const bestValueTotal = bestValueFiltered.length;
      const bestValue = bestValueFiltered.slice(0, 8).map(stripInternalFields);

      // 4. newListings: filter createdAt within last 30 days, sort by createdAt desc, slice 8
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const newListingsFiltered = formattedList
        .filter((p) => new Date(p.createdAt).getTime() >= thirtyDaysAgo)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      const newListingsTotal = newListingsFiltered.length;
      const newListings = newListingsFiltered
        .slice(0, 8)
        .map(stripInternalFields);

      // 5. trending: sort by _bookingCount desc, reviewCount desc, avgRating desc, slice 8
      const trendingSorted = [...formattedList].sort(
        (a, b) =>
          b._bookingCount - a._bookingCount ||
          b.reviewCount - a.reviewCount ||
          b.avgRating - a.avgRating
      );
      const trendingTotal = trendingSorted.length;
      const trending = trendingSorted.slice(0, 8).map(stripInternalFields);

      // 6. dogFriendly: filter pets having name containing 'dog' or 'สุนัข', slice 8
      const dogFriendlyFiltered = formattedList.filter(
        (p) =>
          Array.isArray(p.pets) &&
          p.pets.some((pet: any) => {
            const name = String(pet.name || '').toLowerCase();
            return name.includes('dog') || name.includes('สุนัข');
          })
      );
      const dogFriendlyTotal = dogFriendlyFiltered.length;
      const dogFriendly = dogFriendlyFiltered
        .slice(0, 8)
        .map(stripInternalFields);

      // 7. catFriendly: filter pets having name containing 'cat' or 'แมว', slice 8
      const catFriendlyFiltered = formattedList.filter(
        (p) =>
          Array.isArray(p.pets) &&
          p.pets.some((pet: any) => {
            const name = String(pet.name || '').toLowerCase();
            return name.includes('cat') || name.includes('แมว');
          })
      );
      const catFriendlyTotal = catFriendlyFiltered.length;
      const catFriendly = catFriendlyFiltered
        .slice(0, 8)
        .map(stripInternalFields);

      baseData = {
        allProperties,
        allPropertiesTotal,
        allPropertiesTotalPages,
        topRated,
        topRatedTotal,
        bestValue,
        bestValueTotal,
        newListings,
        newListingsTotal,
        trending,
        trendingTotal,
        dogFriendly,
        dogFriendlyTotal,
        catFriendly,
        catFriendlyTotal,
      };

      await cacheService.set(cacheKey, baseData, 60);
    }

    // If user is authenticated, map isFavorite & favoriteFolderId dynamically in <0.1ms
    if (req.user?.id) {
      const favMap = await getUserFavoriteMap(req.user.id);
      const mapFavorites = (items: any[]) =>
        items.map((p) => ({
          ...p,
          isFavorite: favMap.has(p.id),
          favoriteFolderId: favMap.get(p.id) ?? null,
        }));

      const personalizedData = {
        allProperties: mapFavorites(baseData.allProperties),
        allPropertiesTotal: baseData.allPropertiesTotal,
        allPropertiesTotalPages: baseData.allPropertiesTotalPages,
        topRated: mapFavorites(baseData.topRated),
        topRatedTotal: baseData.topRatedTotal,
        bestValue: mapFavorites(baseData.bestValue),
        bestValueTotal: baseData.bestValueTotal,
        newListings: mapFavorites(baseData.newListings),
        newListingsTotal: baseData.newListingsTotal,
        trending: mapFavorites(baseData.trending),
        trendingTotal: baseData.trendingTotal,
        dogFriendly: mapFavorites(baseData.dogFriendly),
        dogFriendlyTotal: baseData.dogFriendlyTotal,
        catFriendly: mapFavorites(baseData.catFriendly),
        catFriendlyTotal: baseData.catFriendlyTotal,
      };

      res.status(200).json({
        code: 'S-0000',
        message: 'Featured sections retrieved successfully',
        data: personalizedData,
      });
      return;
    }

    res.status(200).json({
      code: 'S-0000',
      message: 'Featured sections retrieved successfully',
      data: baseData,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/properties/:propertyId
 */
export async function getPropertyById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const propertyId = parseInt(req.params.propertyId, 10);
    if (isNaN(propertyId)) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    const prop = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        images: {
          where: { deletedAt: null },
          orderBy: { id: 'asc' },
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
            images: {
              where: { deletedAt: null },
              orderBy: { id: 'asc' },
            },
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
        host: true,
        bookings: {
          where: {
            deletedAt: null,
            rating: { not: null },
          },
          include: {
            guest: true,
            reviewImages: {
              where: { deletedAt: null },
              orderBy: { id: 'asc' },
            },
          },
          orderBy: { reviewedAt: 'desc' },
        },
      },
    });

    if (!prop || prop.deletedAt !== null) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    const isOwner = req.user?.id === prop.hostId;
    const isAdmin = Boolean(
      req.user?.roles?.some((r) => r.name.toLowerCase() === 'admin')
    );

    if (
      !isOwner &&
      !isAdmin &&
      (!prop.isActive ||
        prop.isBannedByAdmin ||
        prop.host.isBannedAllProperties ||
        prop.host.bannedAt !== null ||
        prop.host.deletedAt !== null)
    ) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    // Calculate host average rating across all of the host's properties
    const hostRatedBookings = await prisma.booking.findMany({
      where: {
        property: {
          hostId: prop.hostId,
          deletedAt: null,
        },
        rating: { not: null },
        deletedAt: null,
      },
      select: {
        rating: true,
      },
    });

    const hostAvgRating =
      hostRatedBookings.length > 0
        ? Number(
            (
              hostRatedBookings.reduce((sum, b) => sum + (b.rating || 0), 0) /
              hostRatedBookings.length
            ).toFixed(2)
          )
        : 0;

    // Check existing chatRoomId between authenticated user and host
    let chatRoomId: number | null = null;
    if (req.user && req.user.id !== prop.hostId) {
      const existingRoom = await prisma.chatRoom.findFirst({
        where: {
          OR: [
            { participant1Id: req.user.id, participant2Id: prop.hostId },
            { participant1Id: prop.hostId, participant2Id: req.user.id },
          ],
        },
        select: { id: true },
      });
      chatRoomId = existingRoom?.id ?? null;
    }

    const favMap = await getUserFavoriteMap(req.user?.id);
    const { _bookingCount, ...propertyDto } = formatPropertyDto(prop, favMap, {
      hostAvgRating,
      chatRoomId,
      includeReviews: true,
    });

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: {
        property: propertyDto,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/properties/hosts/:hostId/profile
 */
export async function getHostProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const hostId = parseInt(req.params.hostId, 10);
    if (isNaN(hostId)) {
      throw new AppError('Host not found.', 404, 'DB-1002');
    }

    const hostUser = await prisma.user.findUnique({
      where: { id: hostId },
    });

    if (!hostUser || hostUser.deletedAt !== null) {
      throw new AppError('Host not found.', 404, 'DB-1002');
    }

    const favMap = await getUserFavoriteMap(req.user?.id);

    const dbProperties = await prisma.property.findMany({
      where: {
        hostId,
        isActive: true,
        isBannedByAdmin: false,
        deletedAt: null,
      },
      include: {
        images: {
          where: { deletedAt: null },
          orderBy: { id: 'asc' },
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
            images: {
              where: { deletedAt: null },
              orderBy: { id: 'asc' },
            },
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
        host: true,
        bookings: {
          where: {
            deletedAt: null,
            rating: { not: null },
          },
          select: {
            id: true,
            rating: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const hostRatedBookings = await prisma.booking.findMany({
      where: {
        property: {
          hostId,
          deletedAt: null,
        },
        rating: { not: null },
        deletedAt: null,
      },
      select: {
        rating: true,
      },
    });

    const reviewCount = hostRatedBookings.length;
    const avgRating =
      reviewCount > 0
        ? Number(
            (
              hostRatedBookings.reduce((sum, b) => sum + (b.rating || 0), 0) /
              reviewCount
            ).toFixed(2)
          )
        : 0;

    let chatRoomId: number | null = null;
    if (req.user && req.user.id !== hostId) {
      const existingRoom = await prisma.chatRoom.findFirst({
        where: {
          OR: [
            { participant1Id: req.user.id, participant2Id: hostId },
            { participant1Id: hostId, participant2Id: req.user.id },
          ],
        },
        select: { id: true },
      });
      chatRoomId = existingRoom?.id ?? null;
    }

    const formattedProperties = dbProperties.map((p) => {
      const { _bookingCount, ...dto } = formatPropertyDto(p, favMap, {
        hostAvgRating: avgRating,
      });
      return dto;
    });

    const hostProfile = {
      id: hostUser.id,
      firstName: hostUser.firstName || 'Host',
      lastName: hostUser.lastName || '',
      avatar: hostUser.avatar || null,
      createdAt: toSafeIsoString(hostUser.createdAt),
      avgRating,
      reviewCount,
      totalProperties: formattedProperties.length,
      properties: formattedProperties,
      isVerifiedHost: hostUser.isVerifiedHost,
      chatRoomId,
    };

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: {
        host: hostProfile,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/properties/hosts/:hostId/reviews
 */
export async function getHostReviews(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const hostId = parseInt(req.params.hostId, 10);
    if (isNaN(hostId)) {
      throw new AppError('Host not found.', 404, 'DB-1002');
    }

    const hostUser = await prisma.user.findUnique({
      where: { id: hostId },
      select: { id: true, deletedAt: true },
    });

    if (!hostUser || hostUser.deletedAt !== null) {
      throw new AppError('Host not found.', 404, 'DB-1002');
    }

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || '10'), 10) || 10)
    );
    const propertyIdFilter =
      req.query.propertyId !== undefined
        ? parseInt(String(req.query.propertyId), 10)
        : NaN;
    const ratingFilter =
      req.query.rating !== undefined
        ? parseInt(String(req.query.rating), 10)
        : NaN;

    const whereClause: Prisma.BookingWhereInput = {
      property: {
        hostId,
        deletedAt: null,
      },
      rating: !isNaN(ratingFilter) ? ratingFilter : { not: null },
      deletedAt: null,
      ...(!isNaN(propertyIdFilter) ? { propertyId: propertyIdFilter } : {}),
    };

    const [totalRows, bookings] = await Promise.all([
      prisma.booking.count({ where: whereClause }),
      prisma.booking.findMany({
        where: whereClause,
        include: {
          guest: true,
          property: {
            select: {
              id: true,
              title: true,
            },
          },
          reviewImages: {
            where: { deletedAt: null },
            orderBy: { id: 'asc' },
          },
        },
        orderBy: [{ reviewedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = totalRows > 0 ? Math.ceil(totalRows / limit) : 0;

    const formattedReviews = bookings.map((b) => ({
      id: b.id,
      bookingId: b.id,
      rating: b.rating || 0,
      comment: b.comment || '',
      propertyId: b.property.id,
      propertyName: b.property.title,
      reviewedAt: toSafeIsoString(b.reviewedAt || b.updatedAt || b.createdAt),
      hostReply: b.hostReply || null,
      hostRepliedAt: b.hostRepliedAt ? toSafeIsoString(b.hostRepliedAt) : null,
      guestProfile: {
        id: b.guest.id,
        firstName: b.guest.firstName || 'Guest',
        lastName: b.guest.lastName || '',
        avatar: b.guest.avatar || '',
      },
      reviewImages: (Array.isArray(b.reviewImages) ? b.reviewImages : []).map((img) => ({
        id: img.id,
        fileName: img.fileName || '',
        filePath: img.filePath,
        fileContentType: img.fileContentType || 'image/webp',
        fileExtensionName: img.fileExtensionName || 'webp',
        fileSize: img.fileSize || 0,
      })),
    }));

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: formattedReviews,
      pagination: {
        page,
        limit,
        totalRows,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/properties/:propertyId/room-categories/search
 * Calculates available_rooms = total_rooms - booked_rooms - unavailable_rooms across [checkIn, checkOut)
 */
export async function searchPropertyRoomCategories(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const propertyId = parseInt(req.params.propertyId, 10);
    if (isNaN(propertyId)) {
      throw new AppError('Invalid property ID.', 400, 'T-2007');
    }

    const checkInStr = String(
      req.query.checkInDate || req.query.checkIn || ''
    ).trim();
    const checkOutStr = String(
      req.query.checkOutDate || req.query.checkOut || ''
    ).trim();
    const numberOfPets = Math.max(
      1,
      parseInt(String(req.query.numberOfPets || '1'), 10) || 1
    );
    const petSizeId =
      req.query.petSizeId !== undefined && req.query.petSizeId !== ''
        ? parseInt(String(req.query.petSizeId), 10)
        : req.query.petSizeCategoryId !== undefined && req.query.petSizeCategoryId !== ''
        ? parseInt(String(req.query.petSizeCategoryId), 10)
        : NaN;
    const petTypesParam = String(req.query.petTypes || '').trim();

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, title: true, address: true, deletedAt: true },
    });

    if (!property || property.deletedAt !== null) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    // Build array of date strings (YYYY-MM-DD) for each night in [checkIn, checkOut)
    const nightDates: Date[] = [];
    if (checkInStr && checkOutStr) {
      const start = new Date(`${checkInStr.slice(0, 10)}T00:00:00.000Z`);
      const end = new Date(`${checkOutStr.slice(0, 10)}T00:00:00.000Z`);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
        const cursor = new Date(start);
        while (cursor < end && nightDates.length < 365) {
          nightDates.push(new Date(cursor));
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
      }
    }

    if (nightDates.length === 0) {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      nightDates.push(today);
    }

    let reqSizeCode: number | null = null;
    if (!isNaN(petSizeId)) {
      const sizeCat = await prisma.petSizeCategory.findUnique({
        where: { id: petSizeId },
        select: { code: true },
      });
      reqSizeCode = sizeCat?.code ?? null;
    }

    const roomCategories = await prisma.roomCategory.findMany({
      where: {
        propertyId,
        deletedAt: null,
        ...(!isNaN(petSizeId)
          ? reqSizeCode !== null
            ? { petSizeCategory: { code: { gte: reqSizeCode } } }
            : { petSizeCategoryId: { gte: petSizeId } }
          : {}),
      },
      include: {
        petSizeCategory: true,
        pets: { include: { pet: true } },
        facilities: { include: { facility: true } },
        images: { where: { deletedAt: null }, orderBy: { id: 'asc' } },
        calendars: {
          where: {
            deletedAt: null,
            date: {
              gte: nightDates[0],
              lte: nightDates[nightDates.length - 1],
            },
          },
        },
      },
      orderBy: { basePrice: 'asc' },
    });

    const requestedPets = petTypesParam
      ? petTypesParam.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
      : [];

    const activeRoomCategories = requestedPets.length > 0
      ? roomCategories.filter((rc) =>
          rc.pets.some(
            (p) =>
              requestedPets.includes(p.pet.name.toLowerCase()) ||
              requestedPets.includes(String(p.pet.id))
          )
        )
      : roomCategories;

    const formattedRoomCategories = activeRoomCategories.map((rc) => {
      const basePrice = Number(rc.basePrice);
      const calendarByDate = new Map<string, any>();
      for (const cal of rc.calendars) {
        calendarByDate.set(toSafeIsoString(cal.date).slice(0, 10), cal);
      }

      let minAvailableRooms = rc.totalRoom;
      let totalPrice = 0;

      const dates = nightDates.map((d) => {
        const dateKey = toSafeIsoString(d).slice(0, 10);
        const cal = calendarByDate.get(dateKey);
        const booked = cal ? cal.bookedRooms : 0;
        const unavailable = cal ? cal.unavailableRooms : 0;
        const avail = Math.max(0, rc.totalRoom - booked - unavailable);
        if (avail < minAvailableRooms) {
          minAvailableRooms = avail;
        }
        const priceAdj = cal ? Number(cal.priceAdjustment) : 0;
        const finalPrice = Math.max(0, basePrice + priceAdj);
        totalPrice += finalPrice;

        return {
          date: dateKey,
          availableRooms: avail,
          priceAdjustment: priceAdj,
          finalPrice,
        };
      });

      const roomsNeeded =
        rc.numberOfPets > 0
          ? Math.ceil(numberOfPets / rc.numberOfPets)
          : 1;
      const isCapacityInsufficient = minAvailableRooms < roomsNeeded;
      const isBooked = minAvailableRooms === 0;
      const isAvailable = minAvailableRooms >= roomsNeeded && minAvailableRooms > 0;

      return {
        id: rc.id,
        name: rc.name || '',
        totalRoom: rc.totalRoom,
        numberOfPets: rc.numberOfPets,
        basePrice,
        propertyId: rc.propertyId,
        isAvailable,
        isCapacityInsufficient,
        isBooked,
        availability: {
          roomsNeeded,
          availableRooms: minAvailableRooms,
          totalPrice: totalPrice * roomsNeeded,
          dates,
        },
        petSizeCategory: rc.petSizeCategory
          ? {
              id: rc.petSizeCategory.id,
              name: rc.petSizeCategory.name,
              code: rc.petSizeCategory.code,
              min: rc.petSizeCategory.min,
              max: rc.petSizeCategory.max,
            }
          : undefined,
        property: {
          id: property.id,
          title: property.title,
          address: property.address || '',
        },
        pets: rc.pets.map((rcp) => ({
          id: rcp.pet.id,
          name: normalizePetName(rcp.pet.name),
        })),
        facilities: rc.facilities.map((rcf) => ({
          id: rcf.facility.id,
          name: rcf.facility.name,
        })),
        images: rc.images.map((img) => ({
          id: img.id,
          fileName: img.fileName || '',
          filePath: img.filePath,
          fileContentType: img.fileContentType || 'image/webp',
          fileExtensionName: img.fileExtensionName || 'webp',
          fileSize: img.fileSize || 0,
        })),
      };
    });

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: {
        roomCategories: formattedRoomCategories,
      },
    });
  } catch (error) {
    next(error);
  }
}
