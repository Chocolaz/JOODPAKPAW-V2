import { prisma } from '../database/prisma';

export interface CreateNotificationInput {
  userId: number;
  roleId?: number | null;
  actionName: string;
  title: string;
  message?: string | null;
  category?: string | null;
  type?: string | null;
  referenceTable?: string | null;
  referenceId?: number | null;
}

const notificationActionCache = new Map<string, number>();

/**
 * Resolves and caches a NotificationAction ID by name, upserting if missing.
 * Returns null without throwing if the database or mock store is unavailable.
 */
async function resolveNotificationActionId(actionName: string): Promise<number | null> {
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
 * Clears the in-memory notification action cache (primarily for tests).
 */
export function clearNotificationActionCache(): void {
  notificationActionCache.clear();
}

/**
 * Safely creates a notification record without crashing the caller's main flow
 * when the database is unavailable or partially mocked.
 */
export async function createNotificationSafe(
  input: CreateNotificationInput
): Promise<{ id: number } | null> {
  try {
    if (!input.userId || !input.title) {
      return null;
    }

    const notifModel = (prisma as any)?.notification;
    if (!notifModel || typeof notifModel.create !== 'function') {
      return null;
    }

    const notificationActionId = await resolveNotificationActionId(input.actionName);

    const created = await notifModel.create({
      data: {
        userId: input.userId,
        roleId: input.roleId ?? null,
        notificationActionId,
        title: input.title.trim().slice(0, 100),
        message: input.message ?? null,
        category: input.category ? input.category.trim().slice(0, 50) : null,
        type: input.type ? input.type.trim().slice(0, 50) : null,
        referenceTable: input.referenceTable ? input.referenceTable.trim().slice(0, 100) : null,
        referenceId: input.referenceId ?? null,
        isRead: false,
      },
    });

    return created ?? null;
  } catch (err) {
    console.warn('[Notification] Failed to create notification safely:', err);
    return null;
  }
}
