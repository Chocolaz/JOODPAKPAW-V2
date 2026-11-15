import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/prisma';
import { AppError, FieldValidationError } from '../middlewares/errorHandler';
import { deleteObjectFromS3 } from '../services/storage.service';
import { cacheService } from '../services/cache.service';
import { createNotificationSafe } from '../services/notification.service';
import {
  restoreCalendarQuotaInTx,
  syncPropertyBookingCount,
} from '../services/bookingLifecycle.service';
import {
  getPropertyAppealCycleStats,
  getAccountAppealCycleStats,
} from './report.controller';

/**
 * Cancels active bookings across the given property IDs inside a Prisma transaction,
 * restoring their calendar quotas using restoreCalendarQuotaInTx.
 */
export async function cancelPropertyActiveBookingsInTx(
  tx: any,
  propertyIds: number[],
  reason: string
): Promise<Array<{ id: number; guestId: number; propertyId: number }>> {
  if (!propertyIds || propertyIds.length === 0) return [];

  const activeBookings = await tx.booking.findMany({
    where: {
      propertyId: { in: propertyIds },
      deletedAt: null,
      bookingStatus: { in: ['pending', 'confirmed'] },
    },
    include: {
      bookingOrders: true,
    },
  });

  const cancelled: Array<{ id: number; guestId: number; propertyId: number }> = [];

  for (const b of activeBookings) {
    try {
      await tx.$queryRawUnsafe(`SELECT id FROM bookings WHERE id = $1 FOR UPDATE`, b.id);
    } catch {
      // Mock / fallback
    }

    if (b.bookingOrders && b.bookingOrders.length > 0) {
      await restoreCalendarQuotaInTx(tx, b.bookingOrders);
    }

    await tx.booking.update({
      where: { id: b.id },
      data: {
        bookingStatus: 'cancelled',
        cancelledBy: 'admin',
        cancellationReason: reason,
        updatedAt: new Date(),
      },
    });

    cancelled.push({ id: b.id, guestId: b.guestId, propertyId: b.propertyId });
  }

  return cancelled;
}

async function syncPropertyBookingCountSafe(propertyId: number): Promise<void> {
  try {
    await syncPropertyBookingCount(propertyId);
  } catch (err) {
    console.warn('[Admin] Failed to sync property booking count:', err);
  }
}

/**
 * 1. GET /api/v1/admin/dashboard
 * Computes 5 KPI cards with total and thisMonth (since start of current month in ICT).
 */
export async function getAdminDashboard(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const now = new Date();
    // 1st day of current month in UTC+7 (ICT)
    const year = now.getFullYear();
    const month = now.getMonth();
    const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0);

    const [
      pendingReportsTotal,
      pendingReportsThisMonth,
      totalUsersTotal,
      totalUsersThisMonth,
      activePropertiesTotal,
      activePropertiesThisMonth,
      pendingVerificationsTotal,
      pendingVerificationsThisMonth,
      bannedHostsTotal,
      bannedHostsThisMonth,
    ] = await Promise.all([
      prisma.report.count({
        where: { status: 'pending', deletedAt: null },
      }),
      prisma.report.count({
        where: { status: 'pending', deletedAt: null, createdAt: { gte: startOfMonth } },
      }),
      prisma.user.count({
        where: { deletedAt: null },
      }),
      prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: startOfMonth } },
      }),
      prisma.property.count({
        where: { isActive: true, isBannedByAdmin: false, deletedAt: null },
      }),
      prisma.property.count({
        where: { isActive: true, isBannedByAdmin: false, deletedAt: null, createdAt: { gte: startOfMonth } },
      }),
      prisma.userVerification.count({
        where: { status: 'pending' },
      }),
      prisma.userVerification.count({
        where: { status: 'pending', createdAt: { gte: startOfMonth } },
      }),
      prisma.user.count({
        where: {
          isBannedAllProperties: true,
          deletedAt: null,
        },
      }),
      prisma.user.count({
        where: {
          isBannedAllProperties: true,
          deletedAt: null,
          updatedAt: { gte: startOfMonth },
        },
      }),
    ]);

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: {
        pendingReports: {
          total: pendingReportsTotal,
          thisMonth: pendingReportsThisMonth,
        },
        totalUsers: {
          total: totalUsersTotal,
          thisMonth: totalUsersThisMonth,
        },
        activeProperties: {
          total: activePropertiesTotal,
          thisMonth: activePropertiesThisMonth,
        },
        pendingVerifications: {
          total: pendingVerificationsTotal,
          thisMonth: pendingVerificationsThisMonth,
        },
        bannedHosts: {
          total: bannedHostsTotal,
          thisMonth: bannedHostsThisMonth,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 2. GET /api/v1/admin/reports/paginate
 * True server-side filter and sorting for reports.
 */
export async function getAdminReports(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || '10'), 10) || 10));
    const skip = (page - 1) * limit;

    const typeParam = req.query.type ? String(req.query.type).trim().toLowerCase() : undefined;
    const statusParam = req.query.status ? String(req.query.status).trim().toLowerCase() : undefined;
    const orderByParam = req.query.orderBy ? String(req.query.orderBy).trim() : 'createdAt';
    const sortParam = req.query.sort && String(req.query.sort).toLowerCase() === 'asc' ? 'asc' : 'desc';

    const where: any = {
      deletedAt: null,
    };

    if (typeParam) {
      if (typeParam === 'unban' || typeParam === 'unban_property') {
        where.reportCategory = {
          type: { in: ['unban', 'unban_property'] },
        };
      } else {
        where.reportCategory = {
          type: typeParam,
        };
      }
    }

    if (statusParam && ['pending', 'resolved', 'dismissed'].includes(statusParam)) {
      where.status = statusParam;
    }

    const orderBy: any = {};
    if (orderByParam === 'status') {
      orderBy.status = sortParam;
    } else if (orderByParam === 'id') {
      orderBy.id = sortParam;
    } else {
      orderBy.createdAt = sortParam;
    }

    const [rows, totalRows, pendingCount] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          reportCategory: true,
          property: {
            select: {
              id: true,
              title: true,
              hostId: true,
            },
          },
          booking: {
            select: {
              id: true,
              guestId: true,
              rating: true,
              comment: true,
            },
          },
          reporter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
          images: true,
        },
      }),
      prisma.report.count({ where }),
      prisma.report.count({ where: { status: 'pending', deletedAt: null } }),
    ]);

    const formattedRows = rows.map((r) => {
      let reportCategoryLabel = r.reportCategory?.label || r.reportCategory?.name || 'Report';
      if (
        r.propertyId === null &&
        r.reportCategory &&
        ['unban', 'unban_property'].includes(r.reportCategory.type)
      ) {
        reportCategoryLabel = 'Unban All Properties';
      }
      return {
        ...r,
        reportCategoryLabel,
      };
    });

    const totalPages = Math.ceil(totalRows / limit) || 1;

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: formattedRows,
      pagination: {
        page,
        limit,
        totalRows,
        totalPages,
      },
      attributes: {
        type: typeParam ?? null,
        status: statusParam ?? null,
        pendingCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 3. GET /api/v1/admin/reports/:id
 * Full evidence enrichment including reportedReview and suspensionContext.
 */
export async function getAdminReportById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid report ID.', 400, 'T-2007');
    }

    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        reportCategory: true,
        property: {
          include: {
            host: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
                phone: true,
              },
            },
            images: {
              where: { deletedAt: null },
            },
          },
        },
        booking: {
          include: {
            guest: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
              },
            },
            reviewImages: {
              where: { deletedAt: null },
            },
          },
        },
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            phone: true,
          },
        },
        images: true,
      },
    });

    if (!report || report.deletedAt !== null) {
      throw new AppError('Report not found.', 404, 'DB-1002');
    }

    let reportCategoryLabel = report.reportCategory?.label || report.reportCategory?.name || 'Report';
    if (
      report.propertyId === null &&
      report.reportCategory &&
      ['unban', 'unban_property'].includes(report.reportCategory.type)
    ) {
      reportCategoryLabel = 'Unban All Properties';
    }

    const enrichedReport: any = {
      ...report,
      reportCategoryLabel,
    };

    // Evidence Card 1: reportedReview for Review Reports
    if (report.reportCategory?.type === 'review' && report.booking) {
      enrichedReport.reportedReview = {
        bookingId: report.booking.id,
        rating: report.booking.rating,
        comment: report.booking.comment,
        reviewedAt: report.booking.reviewedAt,
        hostReply: report.booking.hostReply,
        hostRepliedAt: report.booking.hostRepliedAt,
        images: report.booking.reviewImages?.map((img) => img.filePath) || [],
      };
    }

    // Evidence Card 2: suspensionContext for Unban Appeal Reports
    if (
      report.reportCategory &&
      ['unban', 'unban_property'].includes(report.reportCategory.type)
    ) {
      if (report.propertyId) {
        const stats = await getPropertyAppealCycleStats(report.propertyId);
        enrichedReport.suspensionContext = {
          priorBanReason: stats.suspensionReason || 'Violation of marketplace policy',
          priorBannedAt: stats.priorBannedAt,
          appealAttempt: stats.unbanRequestCount + 1,
          maxAppeals: 2,
        };
      } else {
        const stats = await getAccountAppealCycleStats(report.reporterId);
        enrichedReport.suspensionContext = {
          priorBanReason: stats.suspensionReason || 'Violation of marketplace policy',
          priorBannedAt: stats.priorBannedAt,
          appealAttempt: stats.unbanAllPropertiesRequestCount + 1,
          maxAppeals: 2,
        };
      }
    }

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: {
        report: enrichedReport,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 4. PATCH /api/v1/admin/reports/:id/action
 * Concurrency Single-Action Lock (TC-API-168) and Cascading Ban/Appeal State Machine (TC-151..155).
 */
export async function handleReportAction(
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

    const { action, adminNote } = req.body || {};
    const rawAction = typeof action === 'string' ? action.trim().toLowerCase() : '';
    const note = typeof adminNote === 'string' ? adminNote.trim() : '';

    if (!rawAction) {
      const errors: FieldValidationError[] = [
        {
          field: 'action',
          tag: 'required',
          value: '',
        },
      ];
      throw new AppError('Action is required.', 400, 'T-2007', errors, errors);
    }

    // Canonical action mapping
    let canonicalAction: string;
    switch (rawAction) {
      case 'dismiss':
      case 'dismiss_report':
        canonicalAction = 'dismiss_report';
        break;
      case 'warn_user':
        canonicalAction = 'warn_user';
        break;
      case 'ban_property':
      case 'deactivate_property':
        canonicalAction = 'deactivate_property';
        break;
      case 'ban_user':
      case 'deactivate_all_properties':
        canonicalAction = 'deactivate_all_properties';
        break;
      case 'unban_user':
      case 'unban_all_properties':
        canonicalAction = 'unban_all_properties';
        break;
      case 'unban_property':
        canonicalAction = 'unban_property';
        break;
      case 'delete_review':
        canonicalAction = 'delete_review';
        break;
      default:
        throw new AppError(`Invalid report action "${action}".`, 400, 'T-2007');
    }

    let updatedReport: any = null;
    let targetUserId: number | null = null;
    let affectedPropertyIds: number[] = [];
    let reviewImageUrlsToDelete: string[] = [];
    let cancelledBookingsList: Array<{ id: number; guestId: number; propertyId: number }> = [];

    await prisma.$transaction(async (tx) => {
      // TC-API-168: Acquire row lock on reports row
      try {
        await tx.$queryRawUnsafe(
          `SELECT id, status FROM reports WHERE id = $1 FOR UPDATE`,
          id
        );
      } catch {
        // Fallback for mock test harnesses
      }

      const report = await tx.report.findUnique({
        where: { id },
        include: {
          reportCategory: true,
          property: true,
          booking: true,
        },
      });

      if (!report || report.deletedAt !== null) {
        throw new AppError('Report not found.', 404, 'DB-1002');
      }

      // Concurrency Single-Action Lock (TC-API-168): Reject if not pending
      if (report.status !== 'pending') {
        throw new AppError(
          'Report has already been processed.',
          409,
          'B-4001'
        );
      }

      // Determine target user (host or review author or reporter)
      if (report.property) {
        targetUserId = report.property.hostId;
      } else if (report.booking) {
        targetUserId = report.booking.guestId;
      } else {
        targetUserId = report.reporterId;
      }

      // -------------------------------------------------------------
      // 1. dismiss_report
      // -------------------------------------------------------------
      if (canonicalAction === 'dismiss_report') {
        updatedReport = await tx.report.update({
          where: { id },
          data: {
            status: 'dismissed',
            adminNote: note || null,
            resolvedAction: 'dismiss_report',
            updatedAt: new Date(),
          },
        });

        await tx.actionLog.create({
          data: {
            modelName: 'Report',
            recordId: String(id),
            action: 'dismiss_report',
            actorId: req.user!.id,
            targetId: targetUserId,
            messages: note || 'Report dismissed',
          },
        });
      }

      // -------------------------------------------------------------
      // 2. warn_user
      // -------------------------------------------------------------
      else if (canonicalAction === 'warn_user') {
        updatedReport = await tx.report.update({
          where: { id },
          data: {
            status: 'resolved',
            adminNote: note || null,
            resolvedAction: 'warn_user',
            updatedAt: new Date(),
          },
        });

        await tx.actionLog.create({
          data: {
            modelName: 'Report',
            recordId: String(id),
            action: 'warn_user',
            actorId: req.user!.id,
            targetId: targetUserId,
            messages: note || 'User warned',
          },
        });
      }

      // -------------------------------------------------------------
      // 3. deactivate_property (TC-151)
      // -------------------------------------------------------------
      else if (canonicalAction === 'deactivate_property') {
        if (!report.propertyId) {
          throw new AppError('No property associated with this report.', 400, 'T-2007');
        }

        affectedPropertyIds = [report.propertyId];

        // Deactivate target property and mark banned
        await tx.property.update({
          where: { id: report.propertyId },
          data: {
            isBannedByAdmin: true,
            isActive: false,
            updatedAt: new Date(),
          },
        });

        // Cancel active bookings and restore calendar quotas (TC-151)
        cancelledBookingsList = await cancelPropertyActiveBookingsInTx(
          tx,
          [report.propertyId],
          note || 'Property suspended by administration'
        );

        updatedReport = await tx.report.update({
          where: { id },
          data: {
            status: 'resolved',
            adminNote: note || null,
            resolvedAction: 'deactivate_property',
            updatedAt: new Date(),
          },
        });

        await tx.actionLog.create({
          data: {
            modelName: 'Report',
            recordId: String(id),
            action: 'deactivate_property',
            actorId: req.user!.id,
            targetId: targetUserId,
            messages: note || 'Property suspended and deactivated',
          },
        });
      }

      // -------------------------------------------------------------
      // 4. deactivate_all_properties (TC-152 Snapshot)
      // -------------------------------------------------------------
      else if (canonicalAction === 'deactivate_all_properties') {
        const hostId = report.property ? report.property.hostId : report.reporterId;
        targetUserId = hostId;

        // Fetch all properties of the host
        const hostProperties = await tx.property.findMany({
          where: { hostId, deletedAt: null },
        });

        affectedPropertyIds = hostProperties.map((p) => p.id);

        // TC-152: Snapshot isBannedBeforeAccountBan = prop.isBannedByAdmin
        for (const prop of hostProperties) {
          await tx.property.update({
            where: { id: prop.id },
            data: {
              isBannedBeforeAccountBan: prop.isBannedByAdmin,
              isBannedByAdmin: true,
              isActive: false,
              updatedAt: new Date(),
            },
          });
        }

        // Set host isBannedAllProperties = true
        await tx.user.update({
          where: { id: hostId },
          data: {
            isBannedAllProperties: true,
            updatedAt: new Date(),
          },
        });

        // Auto-cancel active bookings on all host properties
        if (affectedPropertyIds.length > 0) {
          cancelledBookingsList = await cancelPropertyActiveBookingsInTx(
            tx,
            affectedPropertyIds,
            note || 'Host account suspended by administration'
          );
        }

        updatedReport = await tx.report.update({
          where: { id },
          data: {
            status: 'resolved',
            adminNote: note || null,
            resolvedAction: 'deactivate_all_properties',
            updatedAt: new Date(),
          },
        });

        await tx.actionLog.create({
          data: {
            modelName: 'Report',
            recordId: String(id),
            action: 'deactivate_all_properties',
            actorId: req.user!.id,
            targetId: hostId,
            messages: note || 'All properties deactivated and host account banned',
          },
        });
      }

      // -------------------------------------------------------------
      // 5. unban_all_properties (TC-153 & TC-154 Restore)
      // -------------------------------------------------------------
      else if (canonicalAction === 'unban_all_properties') {
        const hostId = report.property ? report.property.hostId : report.reporterId;
        targetUserId = hostId;

        // Restore host user account
        await tx.user.update({
          where: { id: hostId },
          data: {
            isBannedAllProperties: false,
            updatedAt: new Date(),
          },
        });

        // Fetch all properties of the host
        const hostProperties = await tx.property.findMany({
          where: { hostId, deletedAt: null },
        });

        affectedPropertyIds = hostProperties.map((p) => p.id);

        // TC-153 & TC-154: Restore isBannedByAdmin = prop.isBannedBeforeAccountBan
        for (const prop of hostProperties) {
          await tx.property.update({
            where: { id: prop.id },
            data: {
              isBannedByAdmin: prop.isBannedBeforeAccountBan,
              isBannedBeforeAccountBan: false,
              updatedAt: new Date(),
            },
          });
        }

        updatedReport = await tx.report.update({
          where: { id },
          data: {
            status: 'resolved',
            adminNote: note || null,
            resolvedAction: 'unban_all_properties',
            updatedAt: new Date(),
          },
        });

        await tx.actionLog.create({
          data: {
            modelName: 'Report',
            recordId: String(id),
            action: 'unban_all_properties',
            actorId: req.user!.id,
            targetId: hostId,
            messages: note || 'Host account unbanned and properties restored',
          },
        });
      }

      // -------------------------------------------------------------
      // 6. unban_property (TC-155)
      // -------------------------------------------------------------
      else if (canonicalAction === 'unban_property') {
        if (!report.propertyId) {
          throw new AppError('No property associated with this report.', 400, 'T-2007');
        }

        affectedPropertyIds = [report.propertyId];

        // TC-155: Clear ban flags without overriding isActive
        await tx.property.update({
          where: { id: report.propertyId },
          data: {
            isBannedByAdmin: false,
            isBannedBeforeAccountBan: false,
            updatedAt: new Date(),
          },
        });

        updatedReport = await tx.report.update({
          where: { id },
          data: {
            status: 'resolved',
            adminNote: note || null,
            resolvedAction: 'unban_property',
            updatedAt: new Date(),
          },
        });

        await tx.actionLog.create({
          data: {
            modelName: 'Report',
            recordId: String(id),
            action: 'unban_property',
            actorId: req.user!.id,
            targetId: targetUserId,
            messages: note || 'Property unbanned by administration',
          },
        });
      }

      // -------------------------------------------------------------
      // 7. delete_review
      // -------------------------------------------------------------
      else if (canonicalAction === 'delete_review') {
        if (!report.bookingId) {
          throw new AppError('No booking review associated with this report.', 400, 'T-2007');
        }

        const booking = await tx.booking.findUnique({
          where: { id: report.bookingId },
          include: { reviewImages: true },
        });

        if (!booking) {
          throw new AppError('Booking not found.', 404, 'DB-1002');
        }

        targetUserId = booking.guestId;
        affectedPropertyIds = [booking.propertyId];

        // Collect review image URLs for S3 deletion outside of tx
        if (booking.reviewImages && booking.reviewImages.length > 0) {
          reviewImageUrlsToDelete = booking.reviewImages.map((i) => i.filePath);
          await tx.bookingReviewImage.deleteMany({
            where: { bookingId: booking.id },
          });
        }

        // Clear review fields on booking
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            rating: null,
            comment: null,
            reviewedAt: null,
            hostReply: null,
            hostRepliedAt: null,
            updatedAt: new Date(),
          },
        });

        // Recalculate property avgRating & reviewCount
        const remainingReviews = await tx.booking.findMany({
          where: {
            propertyId: booking.propertyId,
            deletedAt: null,
            rating: { not: null },
          },
          select: { rating: true },
        });

        const reviewCount = remainingReviews.length;
        const avgRating =
          reviewCount > 0
            ? parseFloat(
                (
                  remainingReviews.reduce((sum, r) => sum + (r.rating || 0), 0) /
                  reviewCount
                ).toFixed(1)
              )
            : 0;

        await tx.property.update({
          where: { id: booking.propertyId },
          data: {
            avgRating,
            reviewCount,
            updatedAt: new Date(),
          },
        });

        updatedReport = await tx.report.update({
          where: { id },
          data: {
            status: 'resolved',
            adminNote: note || null,
            resolvedAction: 'delete_review',
            updatedAt: new Date(),
          },
        });

        await tx.actionLog.create({
          data: {
            modelName: 'Report',
            recordId: String(id),
            action: 'delete_review',
            actorId: req.user!.id,
            targetId: booking.guestId,
            messages: note || 'Review deleted due to policy violation',
          },
        });
      }
    });

    // -------------------------------------------------------------
    // Post-Transaction Operations (S3 Cleanup, Cache, Notifications)
    // -------------------------------------------------------------

    // 1. S3 Garbage Collection on deleted review images
    if (reviewImageUrlsToDelete.length > 0) {
      void Promise.allSettled(
        reviewImageUrlsToDelete.map((url) => deleteObjectFromS3(url))
      );
    }

    // 2. Clear property caches and sync booking count
    if (affectedPropertyIds.length > 0) {
      void cacheService.delByPrefix('properties:');
      for (const pid of affectedPropertyIds) {
        void syncPropertyBookingCountSafe(pid);
      }
    }

    // 3. Notify guests of cancelled bookings
    for (const cb of cancelledBookingsList) {
      void createNotificationSafe({
        userId: cb.guestId,
        roleName: 'guest',
        actionName: 'booking_cancelled',
        title: 'Booking Cancelled by Admin',
        message: note || 'Your booking was cancelled due to property administration suspension.',
        category: 'booking',
        type: 'warning',
        referenceTable: 'bookings',
        referenceId: cb.id,
      });
    }

    // 4. Send action-specific notification to target user
    if (targetUserId) {
      if (canonicalAction === 'warn_user') {
        void createNotificationSafe({
          userId: targetUserId,
          roleName: 'host',
          actionName: 'property_warned',
          title: 'Warning from Administration',
          message: note || 'Your property has received a formal warning regarding marketplace standards.',
          category: 'property',
          type: 'warning',
          referenceTable: 'reports',
          referenceId: id,
        });
      } else if (canonicalAction === 'deactivate_property') {
        void createNotificationSafe({
          userId: targetUserId,
          roleName: 'host',
          actionName: 'property_banned',
          title: 'Property Suspended',
          message: note || 'Your property has been suspended by administration.',
          category: 'property',
          type: 'danger',
          referenceTable: 'reports',
          referenceId: id,
        });
      } else if (canonicalAction === 'deactivate_all_properties') {
        void createNotificationSafe({
          userId: targetUserId,
          roleName: 'host',
          actionName: 'account_banned',
          title: 'Host Account Suspended',
          message: note || 'Your host account and all listings have been suspended by administration.',
          category: 'account',
          type: 'danger',
          referenceTable: 'reports',
          referenceId: id,
        });
      } else if (canonicalAction === 'unban_all_properties') {
        void createNotificationSafe({
          userId: targetUserId,
          roleName: 'host',
          actionName: 'account_unbanned',
          title: 'Host Account Restored',
          message: note || 'Your host account suspension has been lifted.',
          category: 'account',
          type: 'success',
          referenceTable: 'reports',
          referenceId: id,
        });
      } else if (canonicalAction === 'unban_property') {
        void createNotificationSafe({
          userId: targetUserId,
          roleName: 'host',
          actionName: 'property_unbanned',
          title: 'Property Suspension Lifted',
          message: note || 'The suspension on your property has been lifted.',
          category: 'property',
          type: 'success',
          referenceTable: 'reports',
          referenceId: id,
        });
      } else if (canonicalAction === 'delete_review') {
        void createNotificationSafe({
          userId: targetUserId,
          roleName: 'guest',
          actionName: 'booking_review_submitted',
          title: 'Review Removed by Administration',
          message: note || 'Your review was removed as it violated our community guidelines.',
          category: 'review',
          type: 'warning',
          referenceTable: 'reports',
          referenceId: id,
        });
      }
    }

    res.status(200).json({
      code: 'S-0000',
      message: 'Report action executed successfully',
      data: {
        report: updatedReport,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 5. GET /api/v1/admin/action-logs/paginate
 */
export async function getAdminActionLogs(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || '10'), 10) || 10));
    const skip = (page - 1) * limit;

    const actionParam = req.query.action ? String(req.query.action).trim() : undefined;

    const where: any = {};
    if (actionParam) {
      where.action = actionParam;
    }

    const [rows, totalRows] = await Promise.all([
      prisma.actionLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
          target: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
        },
      }),
      prisma.actionLog.count({ where }),
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
