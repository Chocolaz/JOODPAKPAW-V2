import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/prisma';
import { AppError } from '../middlewares/errorHandler';
import { uploadImageAsWebp, deleteObjectFromS3 } from '../services/storage.service';

/**
 * Calculates pet age in whole years from birthDate.
 */
function calculateAge(birthDate: Date | string | null | undefined): number {
  if (!birthDate) return 0;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

/**
 * Calculates pet age in years and months from birthDate.
 */
function calculateAgeMonths(birthDate: Date | string | null | undefined): { ageYears: number; ageMonths: number } {
  if (!birthDate) return { ageYears: 0, ageMonths: 0 };
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return { ageYears: 0, ageMonths: 0 };
  const now = new Date();
  let totalMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) {
    totalMonths--;
  }
  if (totalMonths < 0) totalMonths = 0;
  return {
    ageYears: Math.floor(totalMonths / 12),
    ageMonths: totalMonths % 12,
  };
}

/**
 * Formats PetProfile record into full DTO matching frontend PetProfile interface.
 */
export function formatPetProfileDto(pet: any) {
  const birthDateStr = pet.birthDate
    ? pet.birthDate instanceof Date
      ? pet.birthDate.toISOString().slice(0, 10)
      : String(pet.birthDate).slice(0, 10)
    : '';

  const age = calculateAge(pet.birthDate);
  const { ageYears, ageMonths } = calculateAgeMonths(pet.birthDate);

  return {
    id: pet.id,
    name: pet.name,
    image: pet.image || null,
    birthDate: birthDateStr,
    age,
    ageYears,
    ageMonths,
    sex: (pet.petSex as 'male' | 'female' | 'other') || 'male',
    petSex: pet.petSex || 'male',
    weight:
      pet.weight !== null && pet.weight !== undefined
        ? Number(pet.weight)
        : null,
    petTypeId: pet.petTypeId,
    petId: pet.petTypeId,
    petTypeName: pet.petType?.name || '',
    petBreedId: pet.breedId || null,
    breedId: pet.breedId || null,
    petBreedName: pet.breed?.breed || '',
    breedName: pet.breed?.breed || '',
    petSizeCategoryId: pet.petSizeCategoryId || null,
    petSizeId: pet.petSizeCategoryId || null,
    petSizeName: pet.petSizeCategory?.name || '',
    petEnergyId: pet.petEnergyId || null,
    petActivityLevel: pet.petEnergyId || null,
    rating: pet.energy?.rating || pet.petEnergyId || null,
    contactName: pet.contactName || '',
    contactPhone: pet.contactPhone || '',
    note: pet.note || '',
    guestId: pet.guestId,
    createdAt: pet.createdAt ? new Date(pet.createdAt).toISOString() : '',
    updatedAt: pet.updatedAt ? new Date(pet.updatedAt).toISOString() : '',
  };
}

/**
 * GET /api/v1/profiles/pet-profiles/all
 * Returns all active pets for the authenticated user ordered by id ASC.
 */
export async function getAllPetProfiles(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Authentication required.', 401, 'A-3001');
    }

    const pets = await prisma.petProfile.findMany({
      where: {
        guestId: userId,
        deletedAt: null,
      },
      include: {
        petType: true,
        breed: true,
        petSizeCategory: true,
        energy: true,
      },
      orderBy: { id: 'asc' },
    });

    const formattedPets = pets.map(formatPetProfileDto);

    res.status(200).json({
      code: 'S-0000',
      message: 'Pet profiles retrieved successfully',
      data: {
        petProfiles: formattedPets,
      },
      petProfiles: formattedPets,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/profiles/pet-profiles/:id
 * Returns a single pet profile with IDOR ownership check.
 */
export async function getPetProfileById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Authentication required.', 401, 'A-3001');
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid pet profile ID.', 400, 'T-2007');
    }

    const pet = await prisma.petProfile.findUnique({
      where: { id },
      include: {
        petType: true,
        breed: true,
        petSizeCategory: true,
        energy: true,
      },
    });

    if (!pet || pet.deletedAt !== null) {
      throw new AppError('Pet profile not found.', 404, 'DB-1002');
    }

    if (pet.guestId !== userId) {
      throw new AppError(
        'Forbidden. You do not own this pet profile.',
        403,
        'A-3007'
      );
    }

    const formatted = formatPetProfileDto(pet);

    res.status(200).json({
      code: 'S-0000',
      message: 'Pet profile retrieved successfully',
      data: {
        petProfile: formatted,
      },
      petProfile: formatted,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/profiles/pet-profiles
 * Creates a new pet profile with optional image upload to S3 (.webp).
 */
export async function createPetProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Authentication required.', 401, 'A-3001');
    }

    const name = String(req.body.name || req.body.petName || '').trim();
    const petTypeIdRaw = req.body.petTypeId || req.body.petId || req.body.petType;
    const petTypeId = parseInt(String(petTypeIdRaw), 10);

    const contactName = String(req.body.contactName || '').trim();
    const contactPhone = String(req.body.contactPhone || '').trim();
    const note = req.body.note !== undefined ? String(req.body.note) : req.body.petNote !== undefined ? String(req.body.petNote) : '';

    const errors: Array<{ field: string; tag: string; value: string }> = [];
    if (!name) {
      errors.push({ field: 'name', tag: 'required', value: '' });
    }
    if (isNaN(petTypeId)) {
      errors.push({ field: 'petTypeId', tag: 'required', value: '' });
    }
    if (!contactName) {
      errors.push({ field: 'contactName', tag: 'required', value: '' });
    }
    if (!contactPhone) {
      errors.push({ field: 'contactPhone', tag: 'required', value: '' });
    }

    if (errors.length > 0) {
      throw new AppError('Validation failed', 400, 'T-2007', errors);
    }

    const breedIdRaw = req.body.petBreedId || req.body.breedId;
    const breedId = breedIdRaw !== undefined && breedIdRaw !== '' ? parseInt(String(breedIdRaw), 10) : null;

    const petSizeIdRaw = req.body.petSizeCategoryId || req.body.petSizeId;
    let petSizeCategoryId = petSizeIdRaw !== undefined && petSizeIdRaw !== '' ? parseInt(String(petSizeIdRaw), 10) : null;

    const petEnergyRaw = req.body.petEnergyId || req.body.petActivityLevel;
    const petEnergyId = petEnergyRaw !== undefined && petEnergyRaw !== '' ? parseInt(String(petEnergyRaw), 10) : null;

    const sex = String(req.body.sex || req.body.petSex || req.body.petGender || 'male').toLowerCase();

    let birthDate: Date | null = null;
    const rawBirthDate = req.body.birthDate || req.body.petBirthDate;
    if (rawBirthDate) {
      const parsed = new Date(rawBirthDate);
      if (!isNaN(parsed.getTime())) {
        birthDate = parsed;
      }
    } else if (req.body.ageYears !== undefined || req.body.ageMonths !== undefined) {
      const years = parseInt(String(req.body.ageYears || '0'), 10) || 0;
      const months = parseInt(String(req.body.ageMonths || '0'), 10) || 0;
      const totalMonths = years * 12 + months;
      if (totalMonths > 0) {
        const d = new Date();
        d.setMonth(d.getMonth() - totalMonths);
        birthDate = d;
      }
    }

    let weight: number | null = null;
    if (req.body.weight !== undefined && req.body.weight !== null && req.body.weight !== '') {
      const parsedWeight = parseFloat(String(req.body.weight));
      if (!isNaN(parsedWeight)) {
        weight = parsedWeight;
      }
    }

    // Auto-map pet size category if not explicitly provided
    if (!petSizeCategoryId) {
      if (weight !== null) {
        if (weight <= 5) {
          petSizeCategoryId = 1; // Small (0-5 kg)
        } else if (weight <= 15) {
          petSizeCategoryId = 2; // Medium (5-15 kg)
        } else if (weight <= 30) {
          petSizeCategoryId = 3; // Large (15-30 kg)
        } else {
          petSizeCategoryId = 4; // Giant (>30 kg)
        }
      } else if (breedId && !isNaN(breedId)) {
        const breedRecord = await prisma.petBreed.findUnique({ where: { id: breedId } });
        if (breedRecord) {
          const bLower = breedRecord.breed.toLowerCase();
          if (bLower.includes('giant') || bLower.includes('maine coon') || bLower.includes('dane')) {
            petSizeCategoryId = 4;
          } else if (
            bLower.includes('golden') ||
            bLower.includes('labrador') ||
            bLower.includes('husky') ||
            bLower.includes('shepherd') ||
            bLower.includes('bangkaew') ||
            bLower.includes('ridgeback') ||
            bLower.includes('ragdoll')
          ) {
            petSizeCategoryId = 3;
          } else if (
            bLower.includes('corgi') ||
            bLower.includes('beagle') ||
            bLower.includes('bulldog') ||
            bLower.includes('shorthair') ||
            bLower.includes('persian') ||
            bLower.includes('bengal') ||
            bLower.includes('siamese')
          ) {
            petSizeCategoryId = 2;
          } else {
            petSizeCategoryId = 1;
          }
        }
      } else {
        // Fallback default: Dog -> 2 (Medium), Cat/Exotic -> 1 (Small)
        petSizeCategoryId = petTypeId === 1 ? 2 : 1;
      }
    }

    // Handle image upload
    let imageUrl: string | null = null;
    const file =
      req.file ||
      (Array.isArray(req.files) ? req.files[0] : null) ||
      (req.files && typeof req.files === 'object' && (req.files as any).image
        ? (req.files as any).image[0]
        : null);

    if (file && file.buffer) {
      imageUrl = await uploadImageAsWebp(file.buffer, 'pets', file.originalname);
    } else if (typeof req.body.image === 'string' && req.body.image.startsWith('http')) {
      imageUrl = req.body.image;
    }

    const createdPet = await prisma.petProfile.create({
      data: {
        name,
        petSex: sex,
        birthDate,
        weight,
        contactName,
        contactPhone,
        note,
        image: imageUrl,
        guestId: userId,
        petTypeId,
        breedId: isNaN(breedId as number) ? null : breedId,
        petSizeCategoryId: isNaN(petSizeCategoryId as number) ? null : petSizeCategoryId,
        petEnergyId: isNaN(petEnergyId as number) ? null : petEnergyId,
      },
      include: {
        petType: true,
        breed: true,
        petSizeCategory: true,
        energy: true,
      },
    });

    const formatted = formatPetProfileDto(createdPet);

    res.status(201).json({
      code: 'S-0000',
      message: 'Pet profile created successfully',
      data: {
        petProfile: formatted,
      },
      petProfile: formatted,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/profiles/pet-profiles/:id
 * Updates an existing pet profile with IDOR ownership check and S3 garbage collection.
 */
export async function updatePetProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Authentication required.', 401, 'A-3001');
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid pet profile ID.', 400, 'T-2007');
    }

    const existingPet = await prisma.petProfile.findUnique({
      where: { id },
      include: {
        petType: true,
        breed: true,
        petSizeCategory: true,
        energy: true,
      },
    });

    if (!existingPet || existingPet.deletedAt !== null) {
      throw new AppError('Pet profile not found.', 404, 'DB-1002');
    }

    if (existingPet.guestId !== userId) {
      throw new AppError(
        'Forbidden. You do not own this pet profile.',
        403,
        'A-3007'
      );
    }

    const file =
      req.file ||
      (Array.isArray(req.files) ? req.files[0] : null) ||
      (req.files && typeof req.files === 'object' && (req.files as any).image
        ? (req.files as any).image[0]
        : null);

    const removeImage =
      req.body.removeImage === 'true' || req.body.removeImage === true;

    let newImageUrl = existingPet.image;

    if (file && file.buffer) {
      // S3 Garbage Collection: delete old image if exists
      if (existingPet.image) {
        await deleteObjectFromS3(existingPet.image);
      }
      newImageUrl = await uploadImageAsWebp(file.buffer, 'pets', file.originalname);
    } else if (removeImage) {
      if (existingPet.image) {
        await deleteObjectFromS3(existingPet.image);
      }
      newImageUrl = null;
    } else if (typeof req.body.image === 'string' && req.body.image.startsWith('http')) {
      newImageUrl = req.body.image;
    }

    const updateData: any = {
      image: newImageUrl,
    };

    if (req.body.name !== undefined || req.body.petName !== undefined) {
      updateData.name = String(req.body.name || req.body.petName || '').trim();
    }
    if (req.body.sex !== undefined || req.body.petSex !== undefined || req.body.petGender !== undefined) {
      updateData.petSex = String(req.body.sex || req.body.petSex || req.body.petGender || '').toLowerCase();
    }
    if (req.body.contactName !== undefined) {
      updateData.contactName = String(req.body.contactName).trim();
    }
    if (req.body.contactPhone !== undefined) {
      updateData.contactPhone = String(req.body.contactPhone).trim();
    }
    if (req.body.note !== undefined || req.body.petNote !== undefined) {
      updateData.note = String(req.body.note !== undefined ? req.body.note : req.body.petNote || '');
    }

    const rawBirthDate = req.body.birthDate || req.body.petBirthDate;
    if (rawBirthDate !== undefined) {
      if (rawBirthDate === '' || rawBirthDate === null) {
        updateData.birthDate = null;
      } else {
        const parsed = new Date(rawBirthDate);
        if (!isNaN(parsed.getTime())) {
          updateData.birthDate = parsed;
        }
      }
    } else if (req.body.ageYears !== undefined || req.body.ageMonths !== undefined) {
      const years = parseInt(String(req.body.ageYears || '0'), 10) || 0;
      const months = parseInt(String(req.body.ageMonths || '0'), 10) || 0;
      const totalMonths = years * 12 + months;
      if (totalMonths > 0) {
        const d = new Date();
        d.setMonth(d.getMonth() - totalMonths);
        updateData.birthDate = d;
      }
    }

    if (req.body.weight !== undefined) {
      if (req.body.weight === '' || req.body.weight === null) {
        updateData.weight = null;
      } else {
        const parsedWeight = parseFloat(String(req.body.weight));
        if (!isNaN(parsedWeight)) {
          updateData.weight = parsedWeight;
        }
      }
    }

    const petTypeIdRaw = req.body.petTypeId || req.body.petId || req.body.petType;
    if (petTypeIdRaw !== undefined) {
      const parsedTypeId = parseInt(String(petTypeIdRaw), 10);
      if (!isNaN(parsedTypeId)) {
        updateData.petTypeId = parsedTypeId;
      }
    }

    const breedIdRaw = req.body.petBreedId || req.body.breedId;
    if (breedIdRaw !== undefined) {
      if (breedIdRaw === '' || breedIdRaw === null) {
        updateData.breedId = null;
      } else {
        const parsedBreedId = parseInt(String(breedIdRaw), 10);
        updateData.breedId = isNaN(parsedBreedId) ? null : parsedBreedId;
      }
    }

    const petSizeIdRaw = req.body.petSizeCategoryId || req.body.petSizeId;
    if (petSizeIdRaw !== undefined) {
      if (petSizeIdRaw === '' || petSizeIdRaw === null) {
        updateData.petSizeCategoryId = null;
      } else {
        const parsedSizeId = parseInt(String(petSizeIdRaw), 10);
        updateData.petSizeCategoryId = isNaN(parsedSizeId) ? null : parsedSizeId;
      }
    }

    const petEnergyRaw = req.body.petEnergyId || req.body.petActivityLevel;
    if (petEnergyRaw !== undefined) {
      if (petEnergyRaw === '' || petEnergyRaw === null) {
        updateData.petEnergyId = null;
      } else {
        const parsedEnergyId = parseInt(String(petEnergyRaw), 10);
        updateData.petEnergyId = isNaN(parsedEnergyId) ? null : parsedEnergyId;
      }
    }

    const updatedPet = await prisma.petProfile.update({
      where: { id },
      data: updateData,
      include: {
        petType: true,
        breed: true,
        petSizeCategory: true,
        energy: true,
      },
    });

    const formatted = formatPetProfileDto(updatedPet);

    res.status(200).json({
      code: 'S-0000',
      message: 'Pet profile updated successfully',
      data: {
        petProfile: formatted,
      },
      petProfile: formatted,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/profiles/pet-profiles/:id
 * Soft deletes pet profile and purges S3 image, guarded by active booking check (B-4001).
 */
export async function deletePetProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Authentication required.', 401, 'A-3001');
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid pet profile ID.', 400, 'T-2007');
    }

    const pet = await prisma.petProfile.findUnique({
      where: { id },
    });

    if (!pet || pet.deletedAt !== null) {
      throw new AppError('Pet profile not found.', 404, 'DB-1002');
    }

    if (pet.guestId !== userId) {
      throw new AppError(
        'Forbidden. You do not own this pet profile.',
        403,
        'A-3007'
      );
    }

    // Active Booking Guard (B-4001):
    // Check if pet is referenced in booking_pet_profiles with status pending/confirmed and checkOutDate >= now
    const now = new Date();
    const activeBookingOrder = await prisma.bookingPetProfile.findFirst({
      where: {
        petProfileId: id,
        booking: {
          bookingStatus: { in: ['pending', 'confirmed'] },
          checkOutDate: { gte: now },
          deletedAt: null,
        },
      },
    });

    if (activeBookingOrder) {
      throw new AppError(
        'Cannot delete pet profile with active or upcoming bookings',
        409,
        'B-4001'
      );
    }

    // Soft delete pet profile
    await prisma.petProfile.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // S3 Garbage Collection
    if (pet.image) {
      await deleteObjectFromS3(pet.image);
    }

    res.status(200).json({
      code: 'S-0000',
      message: 'Pet profile deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
