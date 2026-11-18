import { prisma } from '../database/prisma';
import { emitToUser } from './socket.service';

export interface CreateNotificationInput {
  userId: number;
  roleId?: number | null;
  roleName?: 'guest' | 'host' | 'admin' | string | null;
  actionName: string;
  title: string;
  message?: string | null;
  category?: string | null;
  type?: string | null;
  referenceTable?: string | null;
  referenceId?: number | null;
}

export interface ServerNotificationDto {
  id: number;
  title: string;
  message: string;
  category: string;
  type: string;
  isRead: boolean;
  referenceTable: string | null;
  referenceId: number | null;
  roleName: string | null;
  actionName: string | null;
  createdAt: string;
}

const notificationActionCache = new Map<string, number>();
const roleCache = new Map<string, number>();

/**
 * Resolves and caches a NotificationAction ID by name, upserting if missing.
 * Returns null without throwing if the database or mock store is unavailable.
 */
export async function resolveNotificationActionId(actionName: string): Promise<number | null> {
  const normalizedName = actionName.trim().slice(0, 100);
  if (!normalizedName) return null;

  const cachedId = notificationActionCache.get(normalizedName);
  if (cachedId !== undefined) {
    return cachedId;
  }

  try {
    const model = (prisma as any)?.notificationAction;
    if (!model) return null;

    let actionRecord: { id: number } | null = null;
    if (typeof model.upsert === 'function') {
      actionRecord = await model.upsert({
        where: { name: normalizedName },
        update: {},
        create: { name: normalizedName },
      });
    } else if (typeof model.findUnique === 'function') {
      actionRecord = await model.findUnique({ where: { name: normalizedName } });
      if (!actionRecord && typeof model.create === 'function') {
        actionRecord = await model.create({ data: { name: normalizedName } });
      }
    }

    if (actionRecord && typeof actionRecord.id === 'number') {
      notificationActionCache.set(normalizedName, actionRecord.id);
      return actionRecord.id;
    }
  } catch (err) {
    console.warn(`[Notification] Could not resolve notification_action "${normalizedName}":`, err);
  }

  return null;
}

/**
 * Resolves and caches a Role ID by name ('guest', 'host', 'admin').
 */
export async function resolveRoleId(roleName?: string | null): Promise<number | null> {
  if (!roleName) return null;
  const normalized = roleName.trim().toLowerCase();
  if (!normalized) return null;

  const cached = roleCache.get(normalized);
  if (cached !== undefined) return cached;

  try {
    const roleModel = (prisma as any)?.role;
    if (roleModel) {
      let roleRecord: { id: number } | null = null;
      if (typeof roleModel.findUnique === 'function') {
        roleRecord = await roleModel.findUnique({ where: { name: normalized } });
      }
      if (!roleRecord && typeof roleModel.findFirst === 'function') {
        roleRecord = await roleModel.findFirst({ where: { name: normalized } });
      }

      if (roleRecord && typeof roleRecord.id === 'number') {
        roleCache.set(normalized, roleRecord.id);
        return roleRecord.id;
      }
    }
  } catch (err) {
    console.warn(`[Notification] Could not resolve role "${normalized}":`, err);
  }

  // Standard fallback IDs
  if (normalized === 'admin') return 3;
  if (normalized === 'host') return 2;
  if (normalized === 'guest' || normalized === 'user') return 1;

  return null;
}

/**
 * Clears the in-memory notification action and role caches (primarily for tests).
 */
export function clearNotificationActionCache(): void {
  notificationActionCache.clear();
  roleCache.clear();
}

/**
 * Safely creates a notification record without crashing the caller's main flow
 * when the database is unavailable or partially mocked.
 * Emits real-time Socket.IO notification event to target user room.
 */
export async function createNotificationSafe(
  input: CreateNotificationInput
): Promise<ServerNotificationDto | null> {
  try {
    if (!input.userId || !input.title) {
      return null;
    }

    const notifModel = (prisma as any)?.notification;
    if (!notifModel || typeof notifModel.create !== 'function') {
      return null;
    }

    const notificationActionId = await resolveNotificationActionId(input.actionName);
    const resolvedRoleId = input.roleId ?? (await resolveRoleId(input.roleName));

    const created = await notifModel.create({
      data: {
        userId: input.userId,
        roleId: resolvedRoleId ?? null,
        notificationActionId,
        title: input.title.trim().slice(0, 100),
        message: input.message ?? null,
        category: input.category ? input.category.trim().slice(0, 50) : null,
        type: input.type ? input.type.trim().slice(0, 50) : null,
        referenceTable: input.referenceTable ? input.referenceTable.trim().slice(0, 100) : null,
        referenceId: input.referenceId ?? null,
        isRead: false,
      },
      include: {
        role: true,
        action: true,
      },
    });

    if (!created) return null;

    const dto: ServerNotificationDto = {
      id: created.id,
      title: created.title,
      message: created.message ?? '',
      category: created.category ?? 'system',
      type: created.type ?? 'info',
      isRead: Boolean(created.isRead),
      referenceTable: created.referenceTable ?? null,
      referenceId: created.referenceId ?? null,
      roleName: created.role?.name ?? (input.roleName ? String(input.roleName) : null),
      actionName: created.action?.name ?? input.actionName ?? null,
      createdAt: created.createdAt ? new Date(created.createdAt).toISOString() : new Date().toISOString(),
    };

    // Emit real-time notification to the target user socket room
    emitToUser(input.userId, 'notification', dto);

    return dto;
  } catch (err) {
    console.warn('[Notification] Failed to create notification safely:', err);
    return null;
  }
}
