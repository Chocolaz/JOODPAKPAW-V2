import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/prisma';
import { AppError } from '../middlewares/errorHandler';

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
      facilities,
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
      pets,
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
      petBreeds,
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
      petSizeCategories,
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
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      reportCategories,
      data: {
        reportCategories,
      },
    });
  } catch (error) {
    next(error);
  }
}
