import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/prisma';
import { toSafeIsoString } from './property.controller';
import { AppError } from '../middlewares/errorHandler';
import { cacheService } from '../services/cache.service';

/**
 * Normalizes pet species names so frontend icon/policy checks ('Dog', 'Cat', etc.) work seamlessly
 * whether DB stores 'Dog' or 'สุนัข (Dog)'.
 */
export function normalizePetName(rawName: string): string {
  const trimmed = (rawName || '').trim();
  const parenMatch = /\(([^)]+)\)/.exec(trimmed);
  if (parenMatch && parenMatch[1]) {
    return parenMatch[1].trim();
  }
  const lower = trimmed.toLowerCase();
  if (lower.includes('dog') || lower.includes('สุนัข') || lower.includes('หมา')) return 'Dog';
  if (lower.includes('cat') || lower.includes('แมว')) return 'Cat';
  if (lower.includes('rabbit') || lower.includes('กระต่าย')) return 'Rabbit';
  if (lower.includes('hamster') || lower.includes('แฮมสเตอร์')) return 'Hamster';
  if (lower.includes('bird') || lower.includes('นก')) return 'Bird';
  if (lower.includes('reptile') || lower.includes('สัตว์เลื้อยคลาน')) return 'Reptile';
  return trimmed;
}

/**
 * GET /api/v1/hosts/facilities/all
 */
export async function getAllFacilities(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const dbFacilities = await prisma.facility.findMany({
      where: { deletedAt: null },
      include: {
        category: true,
      },
      orderBy: [{ categoryId: 'asc' }, { id: 'asc' }],
    });

    const hasExplicitIndoor = dbFacilities.some(
      (f) => f.category.name.toLowerCase() === 'indoor'
    );

    const facilities = dbFacilities.map((f) => {
      const catName =
        !hasExplicitIndoor &&
        f.category.name.toLowerCase().includes('comfort')
          ? 'indoor'
          : f.category.name;
      return {
        id: f.id,
        name: f.name,
        category: {
          id: f.category.id,
          name: catName,
        },
      };
    });

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: {
        facilities,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/pets/all
 */
export async function getAllPets(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const dbPets = await prisma.pet.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
    });

    const pets = dbPets.map((p) => ({
      id: p.id,
      name: normalizePetName(p.name),
      rawName: p.name,
    }));

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: {
        pets,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/pets/:petTypeId/pet-breeds/all
 */
export async function getPetBreedsByTypeId(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const petTypeId = parseInt(req.params.petTypeId, 10);
    if (isNaN(petTypeId)) {
      throw new AppError('Invalid petTypeId parameter.', 400, 'T-2007');
    }

    const dbBreeds = await prisma.petBreed.findMany({
      where: {
        petId: petTypeId,
        deletedAt: null,
      },
      include: {
        pet: true,
      },
      orderBy: { id: 'asc' },
    });

    const petBreeds = dbBreeds.map((b) => ({
      id: b.id,
      breed: b.breed,
      petId: b.petId,
      petName: normalizePetName(b.pet.name),
      imageUrl: b.imageUrl || '',
    }));

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: {
        petBreeds,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/pet-size-categories/all
 */
export async function getAllPetSizeCategories(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const dbSizes = await prisma.petSizeCategory.findMany({
      where: { deletedAt: null },
      orderBy: { code: 'asc' },
    });

    const petSizeCategories = dbSizes.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      min: s.min,
      max: s.max,
    }));

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: {
        petSizeCategories,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/report-categories
 */
export async function getReportCategories(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawType =
      typeof req.query.type === 'string' ? req.query.type.trim().toLowerCase() : '';

    let typeFilter: Record<string, unknown> = {};
    if (rawType) {
      if (rawType === 'unban' || rawType === 'unban_property') {
        typeFilter = { type: { in: ['unban', 'unban_property'] } };
      } else {
        typeFilter = { type: rawType };
      }
    }

    const dbCategories = await prisma.reportCategory.findMany({
      where: typeFilter,
      orderBy: { id: 'asc' },
    });

    const reportCategories = dbCategories.map((c) => ({
      id: c.id,
      name: c.name,
      label: c.label || c.name,
      type: c.type,
      createdAt: toSafeIsoString(c.createdAt),
      updatedAt: toSafeIsoString(c.updatedAt),
    }));

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: {
        reportCategories,
      },
    });
  } catch (error) {
    next(error);
  }
}

export interface ProvinceDto {
  id: number;
  code: number;
  nameEn: string;
  nameTh: string;
  propertyCount: number;
}

const PROVINCES_CACHE_KEY = 'locations:provinces';
const PROVINCES_CACHE_TTL_SECONDS = 120;

/**
 * GET /api/v1/locations/provinces
 * Returns all 77 official Thai provinces with active property counts.
 * Supports optional `?q=` substring filter (case-insensitive against nameEn & nameTh).
 */
export async function getAllProvinces(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    let provinces = await cacheService.get<ProvinceDto[]>(PROVINCES_CACHE_KEY);

    if (!provinces) {
      const [dbProvinces, groupedCounts] = await Promise.all([
        prisma.province.findMany({
          orderBy: { nameEn: 'asc' },
          select: {
            id: true,
            code: true,
            nameEn: true,
            nameTh: true,
          },
        }),
        prisma.property.groupBy({
          by: ['province'],
          where: {
            isActive: true,
            deletedAt: null,
            isBannedByAdmin: false,
            province: { not: null },
            host: {
              deletedAt: null,
              bannedAt: null,
              isBannedAllProperties: false,
            },
          },
          _count: {
            _all: true,
          },
        }),
      ]);

      // Pre-compute normalized property counts per province
      const countByProvinceId = new Map<number, number>();
      const normalizedRows = dbProvinces.map((p) => ({
        id: p.id,
        enLower: p.nameEn.trim().toLowerCase(),
        thLower: p.nameTh.trim().toLowerCase(),
      }));

      for (const group of groupedCounts) {
        const rawProv = (group.province || '').trim();
        if (!rawProv) continue;
        const normalized = rawProv
          .replace(/^(จังหวัด|จ\.)\s*/i, '')
          .trim()
          .toLowerCase();

        // Exact match first, then substring fallback (ensuring each group is counted once)
        let matched = normalizedRows.find(
          (r) => r.enLower === normalized || r.thLower === normalized
        );
        if (!matched) {
          matched = normalizedRows.find(
            (r) => normalized.includes(r.enLower) || normalized.includes(r.thLower)
          );
        }

        if (matched) {
          countByProvinceId.set(
            matched.id,
            (countByProvinceId.get(matched.id) || 0) + group._count._all
          );
        }
      }

      provinces = dbProvinces
        .map((p) => ({
          id: p.id,
          code: p.code,
          nameEn: p.nameEn,
          nameTh: p.nameTh,
          propertyCount: countByProvinceId.get(p.id) || 0,
        }))
        .sort((a, b) => {
          if (b.propertyCount !== a.propertyCount) {
            return b.propertyCount - a.propertyCount;
          }
          return a.nameEn.localeCompare(b.nameEn);
        });

      await cacheService.set(PROVINCES_CACHE_KEY, provinces, PROVINCES_CACHE_TTL_SECONDS);
    }

    const filtered = q
      ? provinces.filter(
          (p) =>
            p.nameEn.toLowerCase().includes(q) ||
            p.nameTh.toLowerCase().includes(q)
        )
      : provinces;

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: {
        provinces: filtered,
      },
    });
  } catch (error) {
    next(error);
  }
}
