import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/prisma';
import { AppError, FieldValidationError } from '../middlewares/errorHandler';
import { uploadMultipleImagesAsWebp } from '../services/storage.service';

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
 * Resolves a ReportCategory ID for unban appeals if not provided
 */
async function resolveUnbanCategoryId(providedId?: number | null): Promise<number> {
  if (providedId && providedId > 0) {
    const cat = await prisma.reportCategory.findUnique({ where: { id: providedId } });
    if (cat) return cat.id;
  }
  const found = await prisma.reportCategory.findFirst({
    where: { type: { in: ['unban', 'unban_property'] } },
    orderBy: { id: 'asc' },
  });
  if (found) return found.id;
  return 1;
}

export interface PropertyAppealCycleStats {
  unbanRequestCount: number;
  hasPendingUnbanRequest: boolean;
  suspensionReason: string | null;
  lastAppealNote: string | null;
  priorBannedAt: string | null;
}

/**
 * Computes cycle-aware appeal quota and suspension details for a property.
 * Resets quota to 0 upon unban. Max 2 rejected appeals per suspension cycle.
 */
export async function getPropertyAppealCycleStats(propertyId: number): Promise<PropertyAppealCycleStats> {
  // Check if property is currently banned
  const prop = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { isBannedByAdmin: true },
  });

  if (!prop || !prop.isBannedByAdmin) {
    return {
      unbanRequestCount: 0,
      hasPendingUnbanRequest: false,
      suspensionReason: null,
      lastAppealNote: null,
      priorBannedAt: null,
    };
  }

  // Find the last successful unban event for this property
  const lastUnbanReport = await prisma.report.findFirst({
    where: {
      propertyId,
      resolvedAction: 'unban_property',
      status: 'resolved',
      deletedAt: null,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const lastUnbanAt = lastUnbanReport ? lastUnbanReport.updatedAt : null;

  // Find the report that initiated the current suspension
  const banReport = await prisma.report.findFirst({
    where: {
      propertyId,
      resolvedAction: 'deactivate_property',
      status: 'resolved',
      deletedAt: null,
      ...(lastUnbanAt ? { createdAt: { gt: lastUnbanAt } } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Find all appeal reports in this current cycle
  const appealReports = await prisma.report.findMany({
    where: {
      propertyId,
      reportCategory: {
        type: { in: ['unban', 'unban_property'] },
      },
      deletedAt: null,
      ...(lastUnbanAt ? { createdAt: { gt: lastUnbanAt } } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  const hasPendingUnbanRequest = appealReports.some((r) => r.status === 'pending');
  const dismissedAppeals = appealReports.filter((r) => r.status === 'dismissed');
  const unbanRequestCount = dismissedAppeals.length;

  const lastDismissed = dismissedAppeals[0];
  const lastAppealNote = lastDismissed?.adminNote ?? null;
  const suspensionReason = banReport?.adminNote ?? (banReport?.description ?? null);
  const priorBannedAt = banReport ? banReport.updatedAt.toISOString() : null;

  return {
    unbanRequestCount,
    hasPendingUnbanRequest,
    suspensionReason,
    lastAppealNote,
    priorBannedAt,
  };
}

export interface AccountAppealCycleStats {
  unbanAllPropertiesRequestCount: number;
  hasPendingUnbanAllPropertiesRequest: boolean;
  suspensionReason: string | null;
  lastAppealNote: string | null;
  priorBannedAt: string | null;
}

/**
 * Computes cycle-aware appeal quota and suspension details for a host account.
 * Resets quota to 0 upon unban. Max 2 rejected appeals per suspension cycle.
 */
export async function getAccountAppealCycleStats(userId: number): Promise<AccountAppealCycleStats> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isBannedAllProperties: true },
  });

  if (!user || !user.isBannedAllProperties) {
    return {
      unbanAllPropertiesRequestCount: 0,
      hasPendingUnbanAllPropertiesRequest: false,
      suspensionReason: null,
      lastAppealNote: null,
      priorBannedAt: null,
    };
  }

  // Find the last successful unban report for this account
  const lastUnbanReport = await prisma.report.findFirst({
    where: {
      reporterId: userId,
      propertyId: null,
      resolvedAction: 'unban_all_properties',
      status: 'resolved',
      deletedAt: null,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const lastUnbanAt = lastUnbanReport ? lastUnbanReport.updatedAt : null;

  // Find the ban report that initiated the account ban
  const banReport = await prisma.report.findFirst({
    where: {
      resolvedAction: 'deactivate_all_properties',
      status: 'resolved',
      deletedAt: null,
      ...(lastUnbanAt ? { createdAt: { gt: lastUnbanAt } } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Find all account appeal reports in this current cycle
  const appealReports = await prisma.report.findMany({
    where: {
      reporterId: userId,
      propertyId: null,
      reportCategory: {
        type: { in: ['unban', 'unban_property'] },
      },
      deletedAt: null,
      ...(lastUnbanAt ? { createdAt: { gt: lastUnbanAt } } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  const hasPendingUnbanAllPropertiesRequest = appealReports.some((r) => r.status === 'pending');
  const dismissedAppeals = appealReports.filter((r) => r.status === 'dismissed');
  const unbanAllPropertiesRequestCount = dismissedAppeals.length;

  const lastDismissed = dismissedAppeals[0];
  const lastAppealNote = lastDismissed?.adminNote ?? null;
  const suspensionReason = banReport?.adminNote ?? (banReport?.description ?? null);
  const priorBannedAt = banReport ? banReport.updatedAt.toISOString() : null;

  return {
    unbanAllPropertiesRequestCount,
    hasPendingUnbanAllPropertiesRequest,
    suspensionReason,
    lastAppealNote,
    priorBannedAt,
  };
}

/**
 * 1. POST /api/v1/reports/property
 */
export async function submitPropertyReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'A-3005');
    }

    const { propertyId, reportCategoryId, description } = req.body || {};
    const parsedPropertyId = parseInt(String(propertyId), 10);
    const parsedCategoryId = parseInt(String(reportCategoryId), 10);

    const validationErrors: FieldValidationError[] = [];
    if (isNaN(parsedPropertyId) || parsedPropertyId <= 0) {
      validationErrors.push({
        field: 'propertyId',
        tag: 'required',
        value: String(propertyId ?? ''),
      });
    }
    if (isNaN(parsedCategoryId) || parsedCategoryId <= 0) {
      validationErrors.push({
        field: 'reportCategoryId',
        tag: 'required',
        value: String(reportCategoryId ?? ''),
      });
    }

    if (validationErrors.length > 0) {
      throw new AppError('Validation failed.', 400, 'T-2007', validationErrors, validationErrors);
    }

    const property = await prisma.property.findUnique({
      where: { id: parsedPropertyId, deletedAt: null },
    });

    if (!property) {
      throw new AppError('Property not found.', 404, 'DB-1002');
    }

    // Self-Report Guard: Cannot report your own property
    if (property.hostId === req.user.id) {
      throw new AppError('Cannot report your own property.', 400, 'T-2007');
    }

    const category = await prisma.reportCategory.findUnique({
      where: { id: parsedCategoryId },
    });

    if (!category || category.type !== 'property') {
      throw new AppError('Invalid property report category.', 400, 'T-2007');
    }

    // Duplicate Pending Guard
    const pendingReport = await prisma.report.findFirst({
      where: {
        propertyId: parsedPropertyId,
        reporterId: req.user.id,
        status: 'pending',
        deletedAt: null,
      },
    });

    if (pendingReport) {
      throw new AppError('You already have a pending report for this property.', 409, 'B-4001');
    }

    // Upload images as WebP if any
    const files = extractUploadedFiles(req);
    const imageUrls = await uploadMultipleImagesAsWebp(files, 'reports');

    const report = await prisma.$transaction(async (tx) => {
      const createdReport = await tx.report.create({
        data: {
          propertyId: parsedPropertyId,
          reportCategoryId: parsedCategoryId,
          reporterId: req.user!.id,
          description: typeof description === 'string' ? description.trim() : null,
          status: 'pending',
          images: {
            create: imageUrls.map((url) => ({
              filePath: url,
              fileName: 'evidence.webp',
              fileContentType: 'image/webp',
              fileExtensionName: 'webp',
              fileSize: 1024,
            })),
          },
        },
        include: {
          images: true,
          reportCategory: true,
        },
      });

      // Increment property.reportCount
      await tx.property.update({
        where: { id: parsedPropertyId },
        data: { reportCount: { increment: 1 } },
      });

      return createdReport;
    });

    res.status(201).json({
      code: 'S-0000',
      message: 'Report submitted successfully',
      data: {
        report,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 2. POST /api/v1/reports/review
 */
export async function submitReviewReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'A-3005');
    }

    const { bookingId, reportCategoryId, description } = req.body || {};
    const parsedBookingId = parseInt(String(bookingId), 10);
    const parsedCategoryId = parseInt(String(reportCategoryId), 10);

    const validationErrors: FieldValidationError[] = [];
    if (isNaN(parsedBookingId) || parsedBookingId <= 0) {
      validationErrors.push({
        field: 'bookingId',
        tag: 'required',
        value: String(bookingId ?? ''),
      });
    }
    if (isNaN(parsedCategoryId) || parsedCategoryId <= 0) {
      validationErrors.push({
        field: 'reportCategoryId',
        tag: 'required',
        value: String(reportCategoryId ?? ''),
      });
    }

    if (validationErrors.length > 0) {
      throw new AppError('Validation failed.', 400, 'T-2007', validationErrors, validationErrors);
    }

    const booking = await prisma.booking.findUnique({
      where: { id: parsedBookingId, deletedAt: null },
    });

    if (!booking) {
      throw new AppError('Booking not found.', 404, 'DB-1002');
    }

    // Must have a review
    if (booking.rating === null) {
      throw new AppError('This booking does not have a review to report.', 400, 'T-2007');
    }

    // Self-Report Guard: Cannot report your own review
    if (booking.guestId === req.user.id) {
      throw new AppError('Cannot report your own review.', 400, 'T-2007');
    }

    const category = await prisma.reportCategory.findUnique({
      where: { id: parsedCategoryId },
    });

    if (!category || category.type !== 'review') {
      throw new AppError('Invalid review report category.', 400, 'T-2007');
    }

    // Duplicate Pending Guard
    const pendingReport = await prisma.report.findFirst({
      where: {
        bookingId: parsedBookingId,
        reporterId: req.user.id,
        status: 'pending',
        deletedAt: null,
      },
    });

    if (pendingReport) {
      throw new AppError('You already have a pending report for this review.', 409, 'B-4001');
    }

    const files = extractUploadedFiles(req);
    const imageUrls = await uploadMultipleImagesAsWebp(files, 'reports');

    const report = await prisma.report.create({
      data: {
        bookingId: parsedBookingId,
        propertyId: booking.propertyId, // Attach propertyId so listing context is preserved
        reportCategoryId: parsedCategoryId,
        reporterId: req.user.id,
        description: typeof description === 'string' ? description.trim() : null,
        status: 'pending',
        images: {
          create: imageUrls.map((url) => ({
            filePath: url,
            fileName: 'evidence.webp',
            fileContentType: 'image/webp',
            fileExtensionName: 'webp',
            fileSize: 1024,
          })),
        },
      },
      include: {
        images: true,
        reportCategory: true,
      },
    });

    res.status(201).json({
      code: 'S-0000',
      message: 'Review report submitted successfully',
      data: {
        report,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 3. POST /api/v1/reports/unban-property (Host Appeals)
 * Mode A: propertyId provided -> Property-level appeal
 * Mode B: propertyId omitted/null -> Account-level appeal
 */
export async function submitUnbanAppeal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'A-3005');
    }

    const { propertyId, reportCategoryId, description } = req.body || {};
    const normalizedDescription = typeof description === 'string' ? description.trim() : '';

    if (!normalizedDescription) {
      const errors: FieldValidationError[] = [
        {
          field: 'description',
          tag: 'required',
          value: '',
        },
      ];
      throw new AppError('Appeal statement (description) is required.', 400, 'T-2007', errors, errors);
    }

    const parsedPropertyId = propertyId !== undefined && propertyId !== null && propertyId !== ''
      ? parseInt(String(propertyId), 10)
      : null;

    const categoryId = await resolveUnbanCategoryId(
      reportCategoryId ? parseInt(String(reportCategoryId), 10) : null
    );

    const files = extractUploadedFiles(req);
    const imageUrls = await uploadMultipleImagesAsWebp(files, 'reports');

    if (parsedPropertyId && !isNaN(parsedPropertyId) && parsedPropertyId > 0) {
      // -------------------------------------------------------------
      // Mode A: Property-Level Appeal
      // -------------------------------------------------------------
      const property = await prisma.property.findUnique({
        where: { id: parsedPropertyId, deletedAt: null },
      });

      if (!property) {
        throw new AppError('Property not found.', 404, 'DB-1002');
      }

      // Owner IDOR Guard: Must be the host of this property
      if (property.hostId !== req.user.id) {
        throw new AppError('You do not own this property.', 403, 'A-3007');
      }

      if (!property.isBannedByAdmin) {
        throw new AppError('This property is not banned.', 400, 'T-2007');
      }

      // If user is banned at account level, must submit account appeal
      if (req.user.isBannedAllProperties) {
        throw new AppError(
          'Your entire host account is suspended. Please submit an account appeal instead.',
          409,
          'B-4001'
        );
      }

      const stats = await getPropertyAppealCycleStats(parsedPropertyId);

      // Duplicate Pending Guard
      if (stats.hasPendingUnbanRequest) {
        throw new AppError('An appeal for this property is already pending.', 409, 'B-4001');
      }

      // Max 2 Appeals Per Suspension Cycle
      if (stats.unbanRequestCount >= 2) {
        throw new AppError(
          'Maximum appeal limit (2/2) reached for this suspension.',
          409,
          'B-4001'
        );
      }

      const report = await prisma.report.create({
        data: {
          propertyId: parsedPropertyId,
          reportCategoryId: categoryId,
          reporterId: req.user.id,
          description: normalizedDescription,
          status: 'pending',
          images: {
            create: imageUrls.map((url) => ({
              filePath: url,
              fileName: 'appeal_evidence.webp',
              fileContentType: 'image/webp',
              fileExtensionName: 'webp',
              fileSize: 1024,
            })),
          },
        },
        include: {
          images: true,
          reportCategory: true,
        },
      });

      res.status(201).json({
        code: 'S-0000',
        message: 'Appeal submitted successfully',
        data: {
          report,
        },
      });
    } else {
      // -------------------------------------------------------------
      // Mode B: Account-Level Appeal (propertyId: null)
      // -------------------------------------------------------------
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (!user?.isBannedAllProperties) {
        throw new AppError('Your host account is not suspended.', 400, 'T-2007');
      }

      const stats = await getAccountAppealCycleStats(req.user.id);

      // Duplicate Pending Guard
      if (stats.hasPendingUnbanAllPropertiesRequest) {
        throw new AppError('An account unban appeal is already pending.', 409, 'B-4001');
      }

      // Max 2 Appeals Per Suspension Cycle
      if (stats.unbanAllPropertiesRequestCount >= 2) {
        throw new AppError(
          'Maximum appeal limit (2/2) reached for this suspension.',
          409,
          'B-4001'
        );
      }

      const report = await prisma.report.create({
        data: {
          propertyId: null,
          reportCategoryId: categoryId,
          reporterId: req.user.id,
          description: normalizedDescription,
          status: 'pending',
          images: {
            create: imageUrls.map((url) => ({
              filePath: url,
              fileName: 'appeal_evidence.webp',
              fileContentType: 'image/webp',
              fileExtensionName: 'webp',
              fileSize: 1024,
            })),
          },
        },
        include: {
          images: true,
          reportCategory: true,
        },
      });

      res.status(201).json({
        code: 'S-0000',
        message: 'Account appeal submitted successfully',
        data: {
          report,
        },
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * 4. GET /api/v1/reports/me/paginate
 */
export async function getMyReports(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'A-3005');
    }

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || '10'), 10) || 10));
    const skip = (page - 1) * limit;

    const where = {
      reporterId: req.user.id,
      deletedAt: null,
    };

    const [rows, totalRows] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reportCategory: true,
          property: {
            select: {
              id: true,
              title: true,
            },
          },
          booking: {
            select: {
              id: true,
              rating: true,
              comment: true,
            },
          },
          images: true,
        },
      }),
      prisma.report.count({ where }),
    ]);

    const totalPages = Math.ceil(totalRows / limit) || 1;

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: rows,
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
 * 5. GET /api/v1/reports/me/:id
 */
export async function getMyReportById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'A-3005');
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid report ID.', 400, 'T-2007');
    }

    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        reportCategory: true,
        property: {
          select: {
            id: true,
            title: true,
          },
        },
        booking: {
          select: {
            id: true,
            rating: true,
            comment: true,
          },
        },
        images: true,
      },
    });

    if (!report || report.deletedAt !== null) {
      throw new AppError('Report not found.', 404, 'DB-1002');
    }

    // Owner IDOR Guard: User can only view their own reports
    if (report.reporterId !== req.user.id) {
      throw new AppError('Access forbidden. You do not own this report.', 403, 'A-3007');
    }

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: {
        report,
      },
    });
  } catch (error) {
    next(error);
  }
}
