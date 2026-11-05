import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { prisma } from '../database/prisma';
import { AppError, FieldValidationError } from '../middlewares/errorHandler';
import { uploadMultipleImagesAsWebp, deleteObjectFromS3 } from '../services/storage.service';
import { formatPropertyDto } from './property.controller';
import { normalizePetName } from './lookup.controller';

function isAdminUser(req: Request): boolean {
  return Boolean(
    req.user?.roles?.some((r) => r.name.toLowerCase() === 'admin')
  );
}

/**
 * Parses an array of integer IDs from JSON string, array, or comma-separated string
 */
function parseIdArray(raw: unknown): number[] {
  if (raw === undefined || raw === null || raw === '') return [];
  if (Array.isArray(raw)) {
    return Array.from(
      new Set(
        raw
          .map((item) =>
            typeof item === 'object' && item !== null && 'id' in item
              ? Number((item as { id: unknown }).id)
              : Number(item)
          )
          .filter((n) => !isNaN(n) && Number.isInteger(n) && n > 0)
      )
    );
  }
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) {
    return [raw];
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseIdArray(parsed);
      } catch {
        // fall through to comma split
      }
    }
    return Array.from(
      new Set(
        trimmed
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => !isNaN(n) && Number.isInteger(n) && n > 0)
      )
    );
  }
  return [];
}

/**
 * Extracts all uploaded files from req.files or req.file
 */
function extractUploadedFiles(req: Request): Express.Multer.File[] {
  if (Array.isArray(req.files)) {
    return req.files;
  }
  if (req.files && typeof req.files === 'object') {
    const map = req.files as Record<string, Express.Multer.File[]>;
    const all: Express.Multer.File[] = [];
    for (const key of Object.keys(map)) {
      if (Array.isArray(map[key])) {
        all.push(...map[key]);
      }
    }
    return all;
  }
  if (req.file) {
    return [req.file];
  }
  return [];
}

/**
 * Fetches full property with relations for host responses
 */
async function fetchFullHostProperty(propertyId: number) {
  return prisma.property.findUnique({
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
      reports: {
        where: {
          deletedAt: null,
          reportCategory: {
            type: { in: ['unban', 'unban_property'] },
          },
        },
        select: {
          id: true,
          status: true,
        },
      },
    },
  });
}

function formatHostPropertyWithUnbanStats(prop: any) {
  const { _bookingCount, ...baseDto } = formatPropertyDto(prop, new Map(), {
    includeReviews: true,
  });
  const unbanReports = Array.isArray(prop.reports) ? prop.reports : [];
  const unbanRequestCount = unbanReports.length;
  const hasPendingUnbanRequest = unbanReports.some(
    (r: any) => r.status === 'pending'
  );
  return {
    ...baseDto,
    unbanRequestCount,
    hasPendingUnbanRequest,
  };
}

function formatSingleRoomCategory(rc: any, propertyInfo?: { id: number; title: string; address: string }) {
  const basePrice = Number(rc.basePrice || 0);
  return {
    id: rc.id,
    name: rc.name || '',
    totalRoom: rc.totalRoom,
    numberOfPets: rc.numberOfPets,
    basePrice,
    roomSizeWidth: rc.roomSizeWidth != null ? Number(rc.roomSizeWidth) : null,
    roomSizeLength: rc.roomSizeLength != null ? Number(rc.roomSizeLength) : null,
    roomSizeHeight: rc.roomSizeHeight != null ? Number(rc.roomSizeHeight) : null,
    propertyId: rc.propertyId,
    petSizeCategoryId: rc.petSizeCategoryId ?? undefined,
    isAvailable: rc.totalRoom > 0,
    isCapacityInsufficient: false,
    isBooked: false,
    availability: {
      roomsNeeded: 1,
      availableRooms: rc.totalRoom,
      totalPrice: basePrice,
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
    ...(propertyInfo ? { property: propertyInfo } : {}),
    pets: Array.isArray(rc.pets)
      ? rc.pets.map((rcp: any) => ({
          id: rcp.pet.id,
          name: normalizePetName(rcp.pet.name),
        }))
      : [],
    facilities: Array.isArray(rc.facilities)
      ? rc.facilities.map((rcf: any) => ({
          id: rcf.facility.id,
          name: rcf.facility.name,
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
}

/**
 * 1. GET /api/v1/hosts/properties/all
 */
export async function getHostProperties(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'A-3005');
    }

    const dbProperties = await prisma.property.findMany({
      where: {
        hostId: req.user.id,
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
        reports: {
          where: {
            deletedAt: null,
            reportCategory: {
              type: { in: ['unban', 'unban_property'] },
            },
          },
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const properties = dbProperties.map((p) => formatHostPropertyWithUnbanStats(p));

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: {
        properties,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 2. GET /api/v1/hosts/properties/:propertyId
 */
export async function getHostPropertyById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'A-3005');
    }

    const propertyId = parseInt(req.params.propertyId, 10);
    if (isNaN(propertyId)) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    const prop = await fetchFullHostProperty(propertyId);
    if (!prop || prop.deletedAt !== null) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    if (prop.hostId !== req.user.id && !isAdminUser(req)) {
      throw new AppError(
        'Access forbidden. You do not own this property.',
        403,
        'A-3007'
      );
    }

    const propertyDto = formatHostPropertyWithUnbanStats(prop);

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
 * 3. POST /api/v1/hosts/properties
 */
export async function createHostProperty(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'A-3005');
    }

    const hostUser = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!hostUser || hostUser.deletedAt !== null) {
      throw new AppError('User not found.', 404, 'DB-1002');
    }

    if (hostUser.isBannedAllProperties || hostUser.bannedAt !== null) {
      throw new AppError(
        'Your host account is currently suspended.',
        403,
        'A-3002'
      );
    }

    const body = req.body || {};
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description =
      typeof body.description === 'string' ? body.description.trim() : '';

    const validationErrors: FieldValidationError[] = [];
    if (!title) {
      validationErrors.push({
        field: 'title',
        tag: 'required',
        value: String(body.title ?? ''),
      });
    }

    if (validationErrors.length > 0) {
      throw new AppError(
        'Validation failed.',
        400,
        'T-2007',
        validationErrors,
        validationErrors
      );
    }

    const rawPropTypeId = Number(body.propertyTypeId);
    let propertyTypeId: number | null =
      !isNaN(rawPropTypeId) && rawPropTypeId > 0 ? rawPropTypeId : null;

    if (propertyTypeId) {
      const ptExists = await prisma.propertyType.findUnique({
        where: { id: propertyTypeId },
      });
      if (!ptExists) {
        const firstPt = await prisma.propertyType.findFirst();
        propertyTypeId = firstPt?.id ?? null;
      }
    } else {
      const firstPt = await prisma.propertyType.findFirst();
      propertyTypeId = firstPt?.id ?? null;
    }

    const latitude =
      body.latitude !== undefined && body.latitude !== ''
        ? parseFloat(String(body.latitude))
        : 13.7563;
    const longitude =
      body.longitude !== undefined && body.longitude !== ''
        ? parseFloat(String(body.longitude))
        : 100.5018;
    const country =
      typeof body.country === 'string' && body.country.trim()
        ? body.country.trim()
        : 'Thailand';
    const province =
      typeof body.province === 'string' && body.province.trim()
        ? body.province.trim()
        : typeof body.geocodedProvince === 'string'
        ? body.geocodedProvince.trim()
        : 'Bangkok';
    const district =
      typeof body.district === 'string' && body.district.trim()
        ? body.district.trim()
        : typeof body.geocodedDistrict === 'string'
        ? body.geocodedDistrict.trim()
        : '';
    const subdistrict =
      typeof body.subdistrict === 'string' ? body.subdistrict.trim() : '';
    const address =
      typeof body.address === 'string' ? body.address.trim() : '';
    const zipcode =
      typeof body.zipcode === 'string' ? body.zipcode.trim() : '';

    const facilityIds = parseIdArray(body.facilities);

    // Upload images to WebP via StorageService
    const uploadedFiles = extractUploadedFiles(req);
    const uploadedUrls = await uploadMultipleImagesAsWebp(
      uploadedFiles,
      'properties'
    );

    const imageRecords = uploadedUrls.map((url, idx) => {
      const originalFile = uploadedFiles[idx];
      return {
        fileName: originalFile
          ? `${path.basename(
              originalFile.originalname,
              path.extname(originalFile.originalname)
            )}.webp`
          : `property-${idx + 1}.webp`,
        filePath: url,
        fileContentType: 'image/webp',
        fileExtensionName: 'webp',
        fileSize: originalFile?.size || 0,
      };
    });

    // Also support string URLs if sent in JSON body during automated API tests
    if (
      imageRecords.length === 0 &&
      Array.isArray(body.images) &&
      body.images.every((item: unknown) => typeof item === 'string')
    ) {
      for (const [idx, url] of (body.images as string[]).entries()) {
        imageRecords.push({
          fileName: `property-${idx + 1}.webp`,
          filePath: url,
          fileContentType: 'image/webp',
          fileExtensionName: 'webp',
          fileSize: 0,
        });
      }
    }

    // Filter valid facilityIds in DB
    const validFacilities =
      facilityIds.length > 0
        ? await prisma.facility.findMany({
            where: { id: { in: facilityIds }, deletedAt: null },
            select: { id: true },
          })
        : [];

    // Promote user to host & assign host role if not yet assigned
    const hostRole = await prisma.role.upsert({
      where: { name: 'host' },
      update: {},
      create: {
        name: 'host',
        label: 'เจ้าของที่พัก (Host)',
        description: 'Property Host role',
      },
    });

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        isBecomeToHost: true,
        userRoles: {
          connectOrCreate: {
            where: {
              userId_roleId: {
                userId: req.user.id,
                roleId: hostRole.id,
              },
            },
            create: {
              roleId: hostRole.id,
            },
          },
        },
      },
    });

    const created = await prisma.property.create({
      data: {
        title,
        description,
        propertyTypeId,
        latitude: isNaN(latitude) ? 13.7563 : latitude,
        longitude: isNaN(longitude) ? 100.5018 : longitude,
        country,
        province,
        district,
        subdistrict,
        address,
        zipcode,
        isActive: body.isActive === true || body.isActive === 'true',
        hostId: req.user.id,
        ...(imageRecords.length > 0
          ? {
              images: {
                create: imageRecords,
              },
            }
          : {}),
        ...(validFacilities.length > 0
          ? {
              facilities: {
                create: validFacilities.map((f) => ({
                  facilityId: f.id,
                })),
              },
            }
          : {}),
      },
    });

    const fullProp = await fetchFullHostProperty(created.id);
    const propertyDto = fullProp
      ? formatHostPropertyWithUnbanStats(fullProp)
      : { id: created.id, title: created.title };

    res.status(201).json({
      code: 'S-0000',
      message: 'Property created successfully',
      data: {
        id: created.id,
        property: propertyDto,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 4. PUT /api/v1/hosts/properties/:propertyId
 */
export async function updateHostProperty(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'A-3005');
    }

    const propertyId = parseInt(req.params.propertyId, 10);
    if (isNaN(propertyId)) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    const existing = await prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!existing || existing.deletedAt !== null) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    if (existing.hostId !== req.user.id && !isAdminUser(req)) {
      throw new AppError(
        'Access forbidden. You do not own this property.',
        403,
        'A-3007'
      );
    }

    const body = req.body || {};
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) {
      const trimmedTitle = String(body.title).trim();
      if (!trimmedTitle) {
        const errors: FieldValidationError[] = [
          { field: 'title', tag: 'required', value: '' },
        ];
        throw new AppError('Validation failed.', 400, 'T-2007', errors, errors);
      }
      updateData.title = trimmedTitle;
    }

    if (body.description !== undefined) {
      updateData.description = String(body.description).trim();
    }
    if (body.propertyTypeId !== undefined) {
      const ptId = Number(body.propertyTypeId);
      if (!isNaN(ptId) && ptId > 0) {
        updateData.propertyTypeId = ptId;
      }
    }
    if (body.latitude !== undefined && body.latitude !== '') {
      const lat = parseFloat(String(body.latitude));
      if (!isNaN(lat)) updateData.latitude = lat;
    }
    if (body.longitude !== undefined && body.longitude !== '') {
      const lon = parseFloat(String(body.longitude));
      if (!isNaN(lon)) updateData.longitude = lon;
    }
    if (body.country !== undefined) {
      updateData.country = String(body.country).trim();
    }
    if (body.province !== undefined) {
      updateData.province = String(body.province).trim();
    }
    if (body.district !== undefined) {
      updateData.district = String(body.district).trim();
    }
    if (body.subdistrict !== undefined) {
      updateData.subdistrict = String(body.subdistrict).trim();
    }
    if (body.address !== undefined) {
      updateData.address = String(body.address).trim();
    }
    if (body.zipcode !== undefined) {
      updateData.zipcode = String(body.zipcode).trim();
    }

    await prisma.property.update({
      where: { id: propertyId },
      data: updateData,
    });

    // Update facilities if provided
    if (body.facilities !== undefined) {
      const facilityIds = parseIdArray(body.facilities);
      const validFacilities =
        facilityIds.length > 0
          ? await prisma.facility.findMany({
              where: { id: { in: facilityIds }, deletedAt: null },
              select: { id: true },
            })
          : [];

      await prisma.propertyFacility.deleteMany({
        where: { propertyId },
      });

      if (validFacilities.length > 0) {
        await prisma.propertyFacility.createMany({
          data: validFacilities.map((f) => ({
            propertyId,
            facilityId: f.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Delete removed images if deleteImageIds / deletedImageIds provided
    const deleteImageIds = parseIdArray(
      body.deleteImageIds ?? body.deletedImageIds
    );
    if (deleteImageIds.length > 0) {
      const imagesToDelete = await prisma.propertyImage.findMany({
        where: {
          propertyId,
          id: { in: deleteImageIds },
        },
        select: { filePath: true },
      });
      await prisma.propertyImage.updateMany({
        where: {
          propertyId,
          id: { in: deleteImageIds },
        },
        data: {
          deletedAt: new Date(),
        },
      });
      for (const img of imagesToDelete) {
        if (img.filePath) {
          await deleteObjectFromS3(img.filePath);
        }
      }
    }

    // Upload new images if any
    const uploadedFiles = extractUploadedFiles(req);
    if (uploadedFiles.length > 0) {
      const uploadedUrls = await uploadMultipleImagesAsWebp(
        uploadedFiles,
        'properties'
      );
      await prisma.propertyImage.createMany({
        data: uploadedUrls.map((url, idx) => ({
          propertyId,
          fileName: uploadedFiles[idx]
            ? `${path.basename(
                uploadedFiles[idx].originalname,
                path.extname(uploadedFiles[idx].originalname)
              )}.webp`
            : `property-${idx + 1}.webp`,
          filePath: url,
          fileContentType: 'image/webp',
          fileExtensionName: 'webp',
          fileSize: uploadedFiles[idx]?.size || 0,
        })),
      });
    }

    const fullProp = await fetchFullHostProperty(propertyId);
    const propertyDto = fullProp
      ? formatHostPropertyWithUnbanStats(fullProp)
      : { id: propertyId };

    res.status(200).json({
      code: 'S-0000',
      message: 'Property updated successfully',
      data: {
        property: propertyDto,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 5. DELETE /api/v1/hosts/properties/:propertyId
 */
export async function deleteHostProperty(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'A-3005');
    }

    const propertyId = parseInt(req.params.propertyId, 10);
    if (isNaN(propertyId)) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    const existing = await prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!existing || existing.deletedAt !== null) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    if (existing.hostId !== req.user.id && !isAdminUser(req)) {
      throw new AppError(
        'Access forbidden. You do not own this property.',
        403,
        'A-3007'
      );
    }

    // Active Booking Guard: block deletion if active/upcoming bookings exist
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const activeBookingCount = await prisma.booking.count({
      where: {
        propertyId,
        deletedAt: null,
        OR: [
          {
            bookingStatus: {
              in: ['pending', 'waiting', 'confirmed', 'checked_in'],
            },
          },
          {
            bookingStatus: {
              notIn: ['cancelled', 'rejected', 'completed', 'success', 'expired'],
            },
            checkOutDate: { gte: today },
          },
        ],
      },
    });

    if (activeBookingCount > 0) {
      throw new AppError(
        'Cannot delete property with active or upcoming bookings.',
        409,
        'B-4001'
      );
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.property.update({
        where: { id: propertyId },
        data: {
          isActive: false,
          deletedAt: now,
        },
      }),
      prisma.roomCategory.updateMany({
        where: { propertyId, deletedAt: null },
        data: { deletedAt: now },
      }),
    ]);

    res.status(200).json({
      code: 'S-0000',
      message: 'Property deleted successfully',
      data: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 6. PATCH /api/v1/hosts/properties/:propertyId/is-active
 */
export async function updateHostPropertyIsActive(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'A-3005');
    }

    const propertyId = parseInt(req.params.propertyId, 10);
    if (isNaN(propertyId)) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    const existing = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        host: true,
      },
    });

    if (!existing || existing.deletedAt !== null) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    if (existing.hostId !== req.user.id && !isAdminUser(req)) {
      throw new AppError(
        'Access forbidden. You do not own this property.',
        403,
        'A-3007'
      );
    }

    const rawIsActive = req.body?.isActive;
    let nextIsActive: boolean;
    if (typeof rawIsActive === 'boolean') {
      nextIsActive = rawIsActive;
    } else if (rawIsActive === 'true') {
      nextIsActive = true;
    } else if (rawIsActive === 'false') {
      nextIsActive = false;
    } else {
      nextIsActive = !existing.isActive;
    }

    if (nextIsActive) {
      if (
        existing.isBannedByAdmin ||
        existing.host.isBannedAllProperties ||
        existing.host.bannedAt !== null
      ) {
        throw new AppError(
          'Cannot activate a suspended property.',
          403,
          'A-3002'
        );
      }

      const roomCategoriesCount = await prisma.roomCategory.count({
        where: {
          propertyId,
          deletedAt: null,
        },
      });

      if (roomCategoriesCount === 0) {
        throw new AppError(
          'Cannot publish property without at least one room category.',
          400,
          'P-5001'
        );
      }
    }

    const updated = await prisma.property.update({
      where: { id: propertyId },
      data: {
        isActive: nextIsActive,
        publishedAt:
          nextIsActive && !existing.publishedAt
            ? new Date()
            : existing.publishedAt,
        updatedAt: new Date(),
      },
    });

    const fullProp = await fetchFullHostProperty(propertyId);
    const propertyDto = fullProp
      ? formatHostPropertyWithUnbanStats(fullProp)
      : { id: propertyId, isActive: updated.isActive };

    res.status(200).json({
      code: 'S-0000',
      message: 'Property active status updated successfully',
      data: {
        isActive: updated.isActive,
        property: propertyDto,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 7. GET /api/v1/hosts/properties/:propertyId/room-categories/all
 */
export async function getHostRoomCategories(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'A-3005');
    }

    const propertyId = parseInt(req.params.propertyId, 10);
    if (isNaN(propertyId)) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    const prop = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        title: true,
        address: true,
        hostId: true,
        deletedAt: true,
      },
    });

    if (!prop || prop.deletedAt !== null) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    if (prop.hostId !== req.user.id && !isAdminUser(req)) {
      throw new AppError(
        'Access forbidden. You do not own this property.',
        403,
        'A-3007'
      );
    }

    const dbRooms = await prisma.roomCategory.findMany({
      where: {
        propertyId,
        deletedAt: null,
      },
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
    });

    const roomCategories = dbRooms.map((rc) =>
      formatSingleRoomCategory(rc, {
        id: prop.id,
        title: prop.title,
        address: prop.address || '',
      })
    );

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: {
        roomCategories,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 8. POST /api/v1/hosts/properties/:propertyId/room-categories
 */
export async function createHostRoomCategory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'A-3005');
    }

    const propertyId = parseInt(req.params.propertyId, 10);
    if (isNaN(propertyId)) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    const prop = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        title: true,
        address: true,
        hostId: true,
        deletedAt: true,
      },
    });

    if (!prop || prop.deletedAt !== null) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    if (prop.hostId !== req.user.id && !isAdminUser(req)) {
      throw new AppError(
        'Access forbidden. You do not own this property.',
        403,
        'A-3007'
      );
    }

    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const totalRoom = parseInt(
      String(body.totalRoom ?? body.totalRooms ?? '1'),
      10
    );
    const numberOfPets = parseInt(
      String(body.numberOfPets ?? body.maxPets ?? '1'),
      10
    );
    const basePrice = parseFloat(
      String(body.basePrice ?? body.pricePerNight ?? '0')
    );

    const validationErrors: FieldValidationError[] = [];
    if (!name) {
      validationErrors.push({
        field: 'name',
        tag: 'required',
        value: '',
      });
    }
    if (isNaN(totalRoom) || totalRoom < 1) {
      validationErrors.push({
        field: 'totalRoom',
        tag: 'min',
        value: String(body.totalRoom ?? ''),
      });
    }
    if (isNaN(numberOfPets) || numberOfPets < 1) {
      validationErrors.push({
        field: 'numberOfPets',
        tag: 'min',
        value: String(body.numberOfPets ?? ''),
      });
    }
    if (isNaN(basePrice) || basePrice <= 0) {
      validationErrors.push({
        field: 'basePrice',
        tag: 'min',
        value: String(body.basePrice ?? ''),
      });
    }

    if (validationErrors.length > 0) {
      throw new AppError(
        'Validation failed.',
        400,
        'T-2007',
        validationErrors,
        validationErrors
      );
    }

    const rawPetSizeId = Number(
      body.petSizeCategoryId ?? body.petSizeCategories ?? body.petSizeId
    );
    let petSizeCategoryId: number | null =
      !isNaN(rawPetSizeId) && rawPetSizeId > 0 ? rawPetSizeId : null;

    if (petSizeCategoryId) {
      const sizeExists = await prisma.petSizeCategory.findUnique({
        where: { id: petSizeCategoryId },
      });
      if (!sizeExists) {
        const firstSize = await prisma.petSizeCategory.findFirst();
        petSizeCategoryId = firstSize?.id ?? null;
      }
    } else {
      const firstSize = await prisma.petSizeCategory.findFirst();
      petSizeCategoryId = firstSize?.id ?? null;
    }

    const petIds = parseIdArray(body.pets ?? body.petTypes);
    const facilityIds = parseIdArray(body.facilities);

    const validPets =
      petIds.length > 0
        ? await prisma.pet.findMany({
            where: { id: { in: petIds }, deletedAt: null },
            select: { id: true },
          })
        : [];

    const validFacilities =
      facilityIds.length > 0
        ? await prisma.facility.findMany({
            where: { id: { in: facilityIds }, deletedAt: null },
            select: { id: true },
          })
        : [];

    const uploadedFiles = extractUploadedFiles(req);
    const uploadedUrls = await uploadMultipleImagesAsWebp(
      uploadedFiles,
      'rooms'
    );

    const imageRecords = uploadedUrls.map((url, idx) => {
      const originalFile = uploadedFiles[idx];
      return {
        fileName: originalFile
          ? `${path.basename(
              originalFile.originalname,
              path.extname(originalFile.originalname)
            )}.webp`
          : `room-${idx + 1}.webp`,
        filePath: url,
        fileContentType: 'image/webp',
        fileExtensionName: 'webp',
        fileSize: originalFile?.size || 0,
      };
    });

    if (
      imageRecords.length === 0 &&
      Array.isArray(body.images) &&
      body.images.every((item: unknown) => typeof item === 'string')
    ) {
      for (const [idx, url] of (body.images as string[]).entries()) {
        imageRecords.push({
          fileName: `room-${idx + 1}.webp`,
          filePath: url,
          fileContentType: 'image/webp',
          fileExtensionName: 'webp',
          fileSize: 0,
        });
      }
    }

    const createdRoom = await prisma.roomCategory.create({
      data: {
        name,
        totalRoom,
        numberOfPets,
        basePrice,
        propertyId,
        petSizeCategoryId,
        roomSizeWidth:
          body.roomSizeWidth !== undefined
            ? parseFloat(String(body.roomSizeWidth)) || null
            : null,
        roomSizeLength:
          body.roomSizeLength !== undefined
            ? parseFloat(String(body.roomSizeLength)) || null
            : null,
        roomSizeHeight:
          body.roomSizeHeight !== undefined
            ? parseFloat(String(body.roomSizeHeight)) || null
            : null,
        ...(imageRecords.length > 0
          ? {
              images: {
                create: imageRecords,
              },
            }
          : {}),
        ...(validPets.length > 0
          ? {
              pets: {
                create: validPets.map((p) => ({
                  petId: p.id,
                })),
              },
            }
          : {}),
        ...(validFacilities.length > 0
          ? {
              facilities: {
                create: validFacilities.map((f) => ({
                  facilityId: f.id,
                })),
              },
            }
          : {}),
      },
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
    });

    const formattedRoom = formatSingleRoomCategory(createdRoom, {
      id: prop.id,
      title: prop.title,
      address: prop.address || '',
    });

    res.status(201).json({
      code: 'S-0000',
      message: 'Room category created successfully',
      data: {
        id: createdRoom.id,
        roomCategory: formattedRoom,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 9. PUT /api/v1/hosts/properties/:propertyId/room-categories/:roomId
 */
export async function updateHostRoomCategory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'A-3005');
    }

    const propertyId = parseInt(req.params.propertyId, 10);
    const roomId = parseInt(req.params.roomId, 10);
    if (isNaN(propertyId) || isNaN(roomId)) {
      throw new AppError('Room category not found.', 404, 'DB-1002');
    }

    const prop = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        title: true,
        address: true,
        hostId: true,
        deletedAt: true,
      },
    });

    if (!prop || prop.deletedAt !== null) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    if (prop.hostId !== req.user.id && !isAdminUser(req)) {
      throw new AppError(
        'Access forbidden. You do not own this property.',
        403,
        'A-3007'
      );
    }

    const existingRoom = await prisma.roomCategory.findFirst({
      where: {
        id: roomId,
        propertyId,
        deletedAt: null,
      },
    });

    if (!existingRoom) {
      throw new AppError('Room category not found.', 404, 'DB-1002');
    }

    const body = req.body || {};
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) {
      const trimmed = String(body.name).trim();
      if (!trimmed) {
        const errors: FieldValidationError[] = [
          { field: 'name', tag: 'required', value: '' },
        ];
        throw new AppError('Validation failed.', 400, 'T-2007', errors, errors);
      }
      updateData.name = trimmed;
    }

    if (body.totalRoom !== undefined || body.totalRooms !== undefined) {
      const tr = parseInt(String(body.totalRoom ?? body.totalRooms), 10);
      if (isNaN(tr) || tr < 1) {
        const errors: FieldValidationError[] = [
          { field: 'totalRoom', tag: 'min', value: String(body.totalRoom) },
        ];
        throw new AppError('Validation failed.', 400, 'T-2007', errors, errors);
      }
      updateData.totalRoom = tr;
    }

    if (body.numberOfPets !== undefined || body.maxPets !== undefined) {
      const np = parseInt(String(body.numberOfPets ?? body.maxPets), 10);
      if (isNaN(np) || np < 1) {
        const errors: FieldValidationError[] = [
          {
            field: 'numberOfPets',
            tag: 'min',
            value: String(body.numberOfPets),
          },
        ];
        throw new AppError('Validation failed.', 400, 'T-2007', errors, errors);
      }
      updateData.numberOfPets = np;
    }

    if (body.basePrice !== undefined || body.pricePerNight !== undefined) {
      const bp = parseFloat(String(body.basePrice ?? body.pricePerNight));
      if (isNaN(bp) || bp <= 0) {
        const errors: FieldValidationError[] = [
          { field: 'basePrice', tag: 'min', value: String(body.basePrice) },
        ];
        throw new AppError('Validation failed.', 400, 'T-2007', errors, errors);
      }
      updateData.basePrice = bp;
    }

    const rawPetSizeId =
      body.petSizeCategoryId ?? body.petSizeCategories ?? body.petSizeId;
    if (rawPetSizeId !== undefined) {
      const parsedSizeId = parseInt(String(rawPetSizeId), 10);
      if (!isNaN(parsedSizeId) && parsedSizeId > 0) {
        updateData.petSizeCategoryId = parsedSizeId;
      }
    }

    await prisma.roomCategory.update({
      where: { id: roomId },
      data: updateData,
    });

    // Update allowed pets if provided
    if (body.pets !== undefined || body.petTypes !== undefined) {
      const petIds = parseIdArray(body.pets ?? body.petTypes);
      const validPets =
        petIds.length > 0
          ? await prisma.pet.findMany({
              where: { id: { in: petIds }, deletedAt: null },
              select: { id: true },
            })
          : [];

      await prisma.roomCategoryPet.deleteMany({
        where: { roomCategoryId: roomId },
      });

      if (validPets.length > 0) {
        await prisma.roomCategoryPet.createMany({
          data: validPets.map((p) => ({
            roomCategoryId: roomId,
            petId: p.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Update room facilities if provided
    if (body.facilities !== undefined) {
      const facilityIds = parseIdArray(body.facilities);
      const validFacilities =
        facilityIds.length > 0
          ? await prisma.facility.findMany({
              where: { id: { in: facilityIds }, deletedAt: null },
              select: { id: true },
            })
          : [];

      await prisma.roomCategoryFacility.deleteMany({
        where: { roomCategoryId: roomId },
      });

      if (validFacilities.length > 0) {
        await prisma.roomCategoryFacility.createMany({
          data: validFacilities.map((f) => ({
            roomCategoryId: roomId,
            facilityId: f.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Soft-delete removed images
    const deleteImageIds = parseIdArray(
      body.deleteImageIds ?? body.deletedImageIds
    );
    if (deleteImageIds.length > 0) {
      const roomImagesToDelete = await prisma.roomCategoryImage.findMany({
        where: {
          roomCategoryId: roomId,
          id: { in: deleteImageIds },
        },
        select: { filePath: true },
      });
      await prisma.roomCategoryImage.updateMany({
        where: {
          roomCategoryId: roomId,
          id: { in: deleteImageIds },
        },
        data: {
          deletedAt: new Date(),
        },
      });
      for (const img of roomImagesToDelete) {
        if (img.filePath) {
          await deleteObjectFromS3(img.filePath);
        }
      }
    }

    // Upload new images if provided
    const uploadedFiles = extractUploadedFiles(req);
    if (uploadedFiles.length > 0) {
      const uploadedUrls = await uploadMultipleImagesAsWebp(
        uploadedFiles,
        'rooms'
      );
      await prisma.roomCategoryImage.createMany({
        data: uploadedUrls.map((url, idx) => ({
          roomCategoryId: roomId,
          fileName: uploadedFiles[idx]
            ? `${path.basename(
                uploadedFiles[idx].originalname,
                path.extname(uploadedFiles[idx].originalname)
              )}.webp`
            : `room-${idx + 1}.webp`,
          filePath: url,
          fileContentType: 'image/webp',
          fileExtensionName: 'webp',
          fileSize: uploadedFiles[idx]?.size || 0,
        })),
      });
    }

    const updatedRoom = await prisma.roomCategory.findUnique({
      where: { id: roomId },
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
    });

    const formattedRoom = updatedRoom
      ? formatSingleRoomCategory(updatedRoom, {
          id: prop.id,
          title: prop.title,
          address: prop.address || '',
        })
      : { id: roomId };

    res.status(200).json({
      code: 'S-0000',
      message: 'Room category updated successfully',
      data: {
        roomCategory: formattedRoom,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 10. DELETE /api/v1/hosts/properties/:propertyId/room-categories/:roomCategoryId
 */
export async function deleteHostRoomCategory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'A-3005');
    }

    const propertyId = parseInt(req.params.propertyId, 10);
    const roomCategoryId = parseInt(
      req.params.roomCategoryId || req.params.roomId,
      10
    );
    if (isNaN(propertyId) || isNaN(roomCategoryId)) {
      throw new AppError('Room category not found.', 404, 'DB-1002');
    }

    const prop = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, hostId: true, deletedAt: true },
    });

    if (!prop || prop.deletedAt !== null) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    if (prop.hostId !== req.user.id && !isAdminUser(req)) {
      throw new AppError(
        'Access forbidden. You do not own this property.',
        403,
        'A-3007'
      );
    }

    const existingRoom = await prisma.roomCategory.findFirst({
      where: {
        id: roomCategoryId,
        propertyId,
        deletedAt: null,
      },
    });

    if (!existingRoom) {
      throw new AppError('Room category not found.', 404, 'DB-1002');
    }

    // Active Booking Guard: block deletion if active/upcoming booking_orders exist for this room category
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const activeOrderCount = await prisma.bookingOrder.count({
      where: {
        roomCategoryId,
        deletedAt: null,
        booking: {
          deletedAt: null,
          OR: [
            {
              bookingStatus: {
                in: ['pending', 'waiting', 'confirmed', 'checked_in'],
              },
            },
            {
              bookingStatus: {
                notIn: [
                  'cancelled',
                  'rejected',
                  'completed',
                  'success',
                  'expired',
                ],
              },
              checkOutDate: { gte: today },
            },
          ],
        },
      },
    });

    if (activeOrderCount > 0) {
      throw new AppError(
        'Cannot delete room category with active or upcoming bookings.',
        409,
        'B-4001'
      );
    }

    await prisma.roomCategory.update({
      where: { id: roomCategoryId },
      data: {
        deletedAt: new Date(),
      },
    });

    res.status(200).json({
      code: 'S-0000',
      message: 'Room category deleted successfully',
      data: null,
    });
  } catch (error) {
    next(error);
  }
}
