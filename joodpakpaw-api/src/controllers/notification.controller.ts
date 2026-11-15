import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/prisma';
import { AppError } from '../middlewares/errorHandler';
import { ServerNotificationDto } from '../services/notification.service';

function formatNotificationDto(n: any): ServerNotificationDto {
  return {
    id: n.id,
    title: n.title,
    message: n.message ?? '',
    category: n.category ?? 'system',
    type: n.type ?? 'info',
    isRead: Boolean(n.isRead),
    referenceTable: n.referenceTable ?? null,
    referenceId: n.referenceId ?? null,
    roleName: n.role?.name ?? null,
    actionName: n.action?.name ?? null,
    createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : new Date(n.createdAt).toISOString(),
  };
}

/**
 * GET /api/v1/notifications
 * Retrieves all notifications for the authenticated user (max 100).
 */
export async function getNotifications(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        role: true,
        action: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    const list: ServerNotificationDto[] = (notifications || []).map(formatNotificationDto);

    res.status(200).json({
      code: 'S-0000',
      message: 'Success',
      data: {
        notifications: list,
      },
      notifications: list, // Backward-compatibility alias
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/notifications/read-all
 * Marks all unread notifications for the authenticated user as read.
 */
export async function markAllAsRead(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;

    const result = await prisma.notification.updateMany({
      where: {
        userId,
        deletedAt: null,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    res.status(200).json({
      code: 'S-0000',
      message: 'All notifications marked as read',
      data: {
        updatedCount: result.count,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/notifications/:id/read
 * Marks a single notification as read with ownership validation.
 */
export async function markAsRead(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const notifId = parseInt(req.params.id, 10);

    if (isNaN(notifId) || notifId <= 0) {
      throw new AppError('Invalid notification ID', 400, 'T-2007');
    }

    const notification = await prisma.notification.findUnique({
      where: { id: notifId },
      include: {
        role: true,
        action: true,
      },
    });

    if (!notification || notification.deletedAt !== null) {
      throw new AppError('Notification not found', 404, 'DB-1002');
    }

    if (notification.userId !== userId) {
      throw new AppError('Access forbidden. You do not own this notification.', 403, 'A-3007');
    }

    const updated = await prisma.notification.update({
      where: { id: notifId },
      data: { isRead: true },
      include: {
        role: true,
        action: true,
      },
    });

    const dto = formatNotificationDto(updated);

    res.status(200).json({
      code: 'S-0000',
      message: 'Notification marked as read',
      data: {
        notification: dto,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/notifications
 * Soft-deletes all notifications for the authenticated user.
 */
export async function deleteAllNotifications(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;

    await prisma.notification.updateMany({
      where: {
        userId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    res.status(200).json({
      code: 'S-0000',
      message: 'All notifications deleted',
      data: null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/notifications/:id
 * Soft-deletes a single notification with ownership validation.
 */
export async function deleteNotification(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const notifId = parseInt(req.params.id, 10);

    if (isNaN(notifId) || notifId <= 0) {
      throw new AppError('Invalid notification ID', 400, 'T-2007');
    }

    const notification = await prisma.notification.findUnique({
      where: { id: notifId },
    });

    if (!notification || notification.deletedAt !== null) {
      throw new AppError('Notification not found', 404, 'DB-1002');
    }

    if (notification.userId !== userId) {
      throw new AppError('Access forbidden. You do not own this notification.', 403, 'A-3007');
    }

    await prisma.notification.update({
      where: { id: notifId },
      data: { deletedAt: new Date() },
    });

    res.status(200).json({
      code: 'S-0000',
      message: 'Notification deleted',
      data: null,
    });
  } catch (error) {
    next(error);
  }
}
