import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/prisma';
import { AppError } from '../middlewares/errorHandler';
import { cacheService } from '../services/cache.service';

/**
 * GET /api/v1/favorite-folders/all
 * Retrieves all favorite folders belonging to the authenticated user.
 */
export async function getFavoriteFolders(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'A-3001');
    }

    const folders = await prisma.favoriteFolder.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        favoriteProperties: {
          include: {
            property: {
              include: {
                images: {
                  where: { deletedAt: null },
                  orderBy: { id: 'asc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    const favoriteFolders = folders.map((folder) => {
      const activeProperties = folder.favoriteProperties.filter(
        (fp) => fp.property && !fp.property.deletedAt
      );
      const firstProp = activeProperties[0]?.property;
      const firstPropertyImage = firstProp?.images?.[0]?.filePath || '';

      return {
        id: folder.id,
        name: folder.name,
        propertyCount: activeProperties.length,
        firstPropertyImage,
        createdAt: folder.createdAt.toISOString(),
      };
    });

    res.status(200).json({
      code: 'S-0000',
      message: 'Favorite folders retrieved successfully',
      data: {
        favoriteFolders,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/favorite-folders/:folderId
 * Retrieves folder details with its properties for the authenticated user.
 */
export async function getFavoriteFolderById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'A-3001');
    }

    const folderId = Number(req.params.folderId);
    if (isNaN(folderId) || folderId <= 0) {
      throw new AppError('Invalid folder ID', 400, 'T-2007');
    }

    const folder = await prisma.favoriteFolder.findUnique({
      where: { id: folderId },
      include: {
        favoriteProperties: {
          include: {
            property: {
              include: {
                images: {
                  where: { deletedAt: null },
                  orderBy: { id: 'asc' },
                },
                roomCategories: {
                  where: { deletedAt: null },
                  include: {
                    pets: {
                      include: {
                        pet: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!folder || folder.deletedAt) {
      throw new AppError('Favorite folder not found', 404, 'DB-1002');
    }

    if (folder.userId !== userId) {
      throw new AppError('Forbidden: You do not own this favorite folder', 403, 'A-3007');
    }

    const properties = folder.favoriteProperties
      .filter((fp) => fp.property && !fp.property.deletedAt)
      .map((fp) => {
        const p = fp.property;
        const firstImage = p.images?.[0]?.filePath || '';

        const petsMap = new Map<number, { id: number; name: string }>();
        p.roomCategories?.forEach((rc) => {
          rc.pets?.forEach((rcp) => {
            if (rcp.pet && !rcp.pet.deletedAt) {
              petsMap.set(rcp.pet.id, {
                id: rcp.pet.id,
                name: rcp.pet.name,
              });
            }
          });
        });

        return {
          id: p.id,
          title: p.title,
          province: p.province,
          minPrice: Number(p.minPrice || 0),
          avgRating: Number(p.avgRating || 0),
          reviewCount: p.reviewCount || 0,
          firstImage,
          images: p.images || [],
          pets: Array.from(petsMap.values()),
          isFavorite: true,
        };
      });

    const firstPropertyImage = properties[0]?.firstImage || '';

    const folderData = {
      id: folder.id,
      name: folder.name,
      propertyCount: properties.length,
      firstPropertyImage,
      createdAt: folder.createdAt.toISOString(),
      properties,
    };

    res.status(200).json({
      code: 'S-0000',
      message: 'Favorite folder retrieved successfully',
      data: {
        ...folderData,
        folder: folderData,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/favorite-folders
 * Supports 2 modes:
 *  1. Create Folder: { folderName } or { name }
 *  2. Add Property to Favorite: { propertyId, folderId?, folderName? }
 */
export async function createOrAddFavorite(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'A-3001');
    }

    const { propertyId, folderId, folderName, name } = req.body || {};

    // Mode 1: Folder creation only (propertyId is absent)
    if (propertyId === undefined || propertyId === null || propertyId === '') {
      const folderTitle = (folderName || name || '').trim();
      if (!folderTitle) {
        throw new AppError('Folder name is required', 400, 'T-2007');
      }

      const newFolder = await prisma.favoriteFolder.create({
        data: {
          name: folderTitle,
          userId,
        },
      });

      res.status(201).json({
        code: 'S-0000',
        message: 'Favorite folder created successfully',
        data: {
          folder: {
            id: newFolder.id,
            name: newFolder.name,
            propertyCount: 0,
            firstPropertyImage: '',
            createdAt: newFolder.createdAt.toISOString(),
          },
        },
      });
      return;
    }

    // Mode 2: Add property to favorite folder
    const propId = Number(propertyId);
    if (isNaN(propId) || propId <= 0) {
      throw new AppError('Invalid property ID', 400, 'T-2007');
    }

    const property = await prisma.property.findUnique({
      where: { id: propId },
    });

    if (!property || property.deletedAt) {
      throw new AppError('Property not found', 404, 'DB-1002');
    }

    // Duplicate Favorite Guard (409 FF-4101):
    // Check if propertyId is already in ANY active favorite folder of req.user.id
    const existingFav = await prisma.favoriteProperty.findFirst({
      where: {
        propertyId: propId,
        folder: {
          userId,
          deletedAt: null,
        },
      },
      include: { folder: true },
    });

    if (existingFav) {
      throw new AppError('Property already added to favorites', 409, 'FF-4101');
    }

    // Determine target folder
    let targetFolderId: number;

    if (folderId !== undefined && folderId !== null && folderId !== '') {
      const fId = Number(folderId);
      if (isNaN(fId) || fId <= 0) {
        throw new AppError('Invalid folder ID', 400, 'T-2007');
      }

      const folder = await prisma.favoriteFolder.findUnique({
        where: { id: fId },
      });

      if (!folder || folder.deletedAt) {
        throw new AppError('Favorite folder not found', 404, 'DB-1002');
      }

      if (folder.userId !== userId) {
        throw new AppError('Forbidden: You do not own this favorite folder', 403, 'A-3007');
      }

      targetFolderId = folder.id;
    } else if (folderName || name) {
      const targetName = (folderName || name).trim();
      let folder = await prisma.favoriteFolder.findFirst({
        where: {
          userId,
          name: targetName,
          deletedAt: null,
        },
      });

      if (!folder) {
        folder = await prisma.favoriteFolder.create({
          data: {
            name: targetName,
            userId,
          },
        });
      }
      targetFolderId = folder.id;
    } else {
      // No folder specified: find user's first active folder or create default "My Wishlist"
      let folder = await prisma.favoriteFolder.findFirst({
        where: {
          userId,
          deletedAt: null,
        },
        orderBy: { id: 'asc' },
      });

      if (!folder) {
        folder = await prisma.favoriteFolder.create({
          data: {
            name: 'My Wishlist',
            userId,
          },
        });
      }
      targetFolderId = folder.id;
    }

    await prisma.favoriteProperty.create({
      data: {
        folderId: targetFolderId,
        propertyId: propId,
      },
    });

    await cacheService.delByPrefix(`properties:favorite:${userId}`);

    res.status(201).json({
      code: 'S-0000',
      message: 'Property added to favorites successfully',
      data: {
        folderId: targetFolderId,
        propertyId: propId,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/favorite-folders/:folderId
 * Renames an existing favorite folder.
 */
export async function renameFavoriteFolder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'A-3001');
    }

    const folderId = Number(req.params.folderId);
    if (isNaN(folderId) || folderId <= 0) {
      throw new AppError('Invalid folder ID', 400, 'T-2007');
    }

    const newName = (req.body?.name || req.body?.folderName || '').trim();
    if (!newName) {
      throw new AppError('Folder name is required', 400, 'T-2007');
    }

    const folder = await prisma.favoriteFolder.findUnique({
      where: { id: folderId },
    });

    if (!folder || folder.deletedAt) {
      throw new AppError('Favorite folder not found', 404, 'DB-1002');
    }

    if (folder.userId !== userId) {
      throw new AppError('Forbidden: You do not own this favorite folder', 403, 'A-3007');
    }

    const updated = await prisma.favoriteFolder.update({
      where: { id: folderId },
      data: { name: newName },
    });

    res.status(200).json({
      code: 'S-0000',
      message: 'Favorite folder renamed successfully',
      data: {
        folder: {
          id: updated.id,
          name: updated.name,
          createdAt: updated.createdAt.toISOString(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/favorite-folders/:folderId
 * Deletes a favorite folder and its associated FavoriteProperty records.
 */
export async function deleteFavoriteFolder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'A-3001');
    }

    const folderId = Number(req.params.folderId);
    if (isNaN(folderId) || folderId <= 0) {
      throw new AppError('Invalid folder ID', 400, 'T-2007');
    }

    const folder = await prisma.favoriteFolder.findUnique({
      where: { id: folderId },
    });

    if (!folder || folder.deletedAt) {
      throw new AppError('Favorite folder not found', 404, 'DB-1002');
    }

    if (folder.userId !== userId) {
      throw new AppError('Forbidden: You do not own this favorite folder', 403, 'A-3007');
    }

    await prisma.favoriteProperty.deleteMany({
      where: { folderId },
    });

    await prisma.favoriteFolder.update({
      where: { id: folderId },
      data: { deletedAt: new Date() },
    });

    await cacheService.delByPrefix(`properties:favorite:${userId}`);

    res.status(200).json({
      code: 'S-0000',
      message: 'Favorite folder deleted successfully',
      data: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/favorite-properties/:propertyId
 * Removes a property from all favorite folders belonging to the authenticated user.
 */
export async function deleteFavoriteProperty(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'A-3001');
    }

    const propertyId = Number(req.params.propertyId);
    if (isNaN(propertyId) || propertyId <= 0) {
      throw new AppError('Invalid property ID', 400, 'T-2007');
    }

    const userFolders = await prisma.favoriteFolder.findMany({
      where: { userId },
      select: { id: true },
    });

    const folderIds = userFolders.map((f) => f.id);
    if (folderIds.length > 0) {
      await prisma.favoriteProperty.deleteMany({
        where: {
          propertyId,
          folderId: { in: folderIds },
        },
      });
    }

    await cacheService.delByPrefix(`properties:favorite:${userId}`);

    res.status(200).json({
      code: 'S-0000',
      message: 'Favorite property removed successfully',
      data: null,
    });
  } catch (error) {
    next(error);
  }
}
