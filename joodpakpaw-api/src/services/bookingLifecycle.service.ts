import { prisma } from '../database/prisma';
import { cacheService } from './cache.service';
import { createNotificationSafe } from './notification.service';

export const TERMINAL_BOOKING_STATUSES: string[] = [
  'cancelled',
  'rejected',
  'completed',
  'success',
  'successful',
  'expired',
];

export const REAL_STAY_STATUSES: string[] = [
  'confirmed',
  'successful',
  'completed',
  'success',
];

export const REVIEWABLE_STATUSES: string[] = [
  'successful',
  'success',
  'completed',
];

export const REVIEW_WINDOW_DAYS = 14;

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

let isSweepRunning = false;
let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Extracts a YYYY-MM-DD string from a Date or date-like string.
 */
export function toDateStr(dateInput: Date | string): string {
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? '' : dateInput.toISOString().slice(0, 10);
  }
  return String(dateInput || '').slice(0, 10);
}

/**
 * Returns today's YYYY-MM-DD calendar date in Asia/Bangkok (UTC+7).
 */
export function getTodayThaiStr(now: Date = new Date()): string {
  return new Date(now.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Returns tomorrow's YYYY-MM-DD calendar date in Asia/Bangkok (UTC+7).
 */
export function getTomorrowThaiStr(now: Date = new Date()): string {
  const bangkokNow = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const tomorrowBangkok = new Date(bangkokNow.getTime() + DAY_MS);
  return tomorrowBangkok.toISOString().slice(0, 10);
}

/**
 * Returns an array of YYYY-MM-DD date strings for each night in [startDate, endDate).
 */
export function getDatesInRange(startDateStr: string | Date, endDateStr: string | Date): string[] {
  const dates: string[] = [];
  const startRaw = toDateStr(startDateStr);
  const endRaw = toDateStr(endDateStr);

  const start = new Date(`${startRaw}T00:00:00.000Z`);
  const end = new Date(`${endRaw}T00:00:00.000Z`);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return dates;
  }

  const cursor = new Date(start);
  while (cursor < end && dates.length < 90) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export const MAX_ADVANCE_BOOKING_DAYS = 180;
export const SAME_DAY_CUTOFF_HOUR_ICT = 18;

/**
 * Returns deterministic Bangkok (UTC+7) booking window bounds:
 * - isPastSameDayCutoff: true when current ICT hour >= 18:00
 * - minCheckInStr: tomorrow if past 18:00 ICT, otherwise today
 * - maxAdvanceStr: today + MAX_ADVANCE_BOOKING_DAYS (180 days)
 */
export function getBookingDateBounds(now: Date = new Date()): {
  todayThaiStr: string;
  isPastSameDayCutoff: boolean;
  minCheckInStr: string;
  maxAdvanceStr: string;
} {
  const todayThaiStr = getTodayThaiStr(now);
  const bangkokNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const isPastSameDayCutoff = bangkokNow.getUTCHours() >= SAME_DAY_CUTOFF_HOUR_ICT;

  const todayMidnight = new Date(`${todayThaiStr}T00:00:00.000Z`);
  const minDate = new Date(todayMidnight);
  if (isPastSameDayCutoff) {
    minDate.setUTCDate(minDate.getUTCDate() + 1);
  }
  const maxDate = new Date(todayMidnight);
  maxDate.setUTCDate(maxDate.getUTCDate() + MAX_ADVANCE_BOOKING_DAYS);

  return {
    todayThaiStr,
    isPastSameDayCutoff,
    minCheckInStr: minDate.toISOString().slice(0, 10),
    maxAdvanceStr: maxDate.toISOString().slice(0, 10),
  };
}

/**
 * Converts a YYYY-MM-DD date + hour in Asia/Bangkok (UTC+7) to a deterministic UTC Date.
 * Example: hourICT = 14 -> T07:00:00.000Z, 12 -> T05:00:00.000Z, 18 -> T11:00:00.000Z.
 */
export function toBangkokTimestamp(dateInput: Date | string, hourICT: number): Date {
  const dateStr = toDateStr(dateInput);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(NaN);
  }
  const midnightUtcMs = Date.parse(`${dateStr}T00:00:00.000Z`);
  if (isNaN(midnightUtcMs)) {
    return new Date(NaN);
  }
  return new Date(midnightUtcMs + (hourICT - 7) * 60 * 60 * 1000);
}

/**
 * Check-in cutoff time (14:00 ICT on check-in date) after which guests cannot cancel confirmed bookings.
 */
export function getCheckInCutoffAt(checkInDate: Date | string): Date {
  return toBangkokTimestamp(checkInDate, 14);
}

/**
 * Earliest time Host can manually mark a stay as completed (12:00 ICT on check-out date).
 */
export function getCanCompleteAt(checkOutDate: Date | string): Date {
  return toBangkokTimestamp(checkOutDate, 12);
}

/**
 * Auto-completion timestamp (18:00 ICT on check-out date).
 */
export function getAutoCompleteAt(checkOutDate: Date | string): Date {
  return toBangkokTimestamp(checkOutDate, 18);
}

/**
 * Payment window deadline:
 * - If booked before check-in (14:00 ICT): min(createdAt + 24h, checkIn 14:00 ICT)
 * - If booked same-day at or after check-in (14:00 ICT): min(createdAt + 15m, checkOut 12:00 ICT)
 */
export function getPaymentDeadline(
  createdAt: Date | string,
  checkInDate: Date | string,
  checkOutDate?: Date | string
): Date {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const plus24h = new Date(created.getTime() + DAY_MS);
  const checkInCutoff = getCheckInCutoffAt(checkInDate);

  if (!isNaN(checkInCutoff.getTime())) {
    if (created.getTime() < checkInCutoff.getTime()) {
      return plus24h.getTime() <= checkInCutoff.getTime() ? plus24h : checkInCutoff;
    }

    const immediateWindow = new Date(created.getTime() + 15 * 60 * 1000);
    const checkOutCutoff = checkOutDate ? getCanCompleteAt(checkOutDate) : new Date(NaN);
    if (!isNaN(checkOutCutoff.getTime()) && checkOutCutoff.getTime() < immediateWindow.getTime()) {
      return checkOutCutoff;
    }
    return immediateWindow;
  }

  return plus24h;
}

/**
 * Verified-stay review deadline: (successedAt ?? checkOut 18:00 ICT) + 14 days.
 */
export function getReviewDeadline(
  successedAt: Date | string | null | undefined,
  checkOutDate: Date | string
): Date {
  const fallback = getAutoCompleteAt(checkOutDate);
  const parsedSuccess = successedAt
    ? successedAt instanceof Date
      ? successedAt
      : new Date(successedAt)
    : null;
  const base = parsedSuccess && !isNaN(parsedSuccess.getTime()) ? parsedSuccess : fallback;
  return new Date(base.getTime() + REVIEW_WINDOW_DAYS * DAY_MS);
}

/**
 * Synchronizes the materialized booking_count column for a property using real stay statuses only.
 */
export async function syncPropertyBookingCount(propertyId: number): Promise<void> {
  const bookingCount = await prisma.booking.count({
    where: {
      propertyId,
      deletedAt: null,
      bookingStatus: { in: REAL_STAY_STATUSES },
    },
  });
  await prisma.property.update({
    where: { id: propertyId },
    data: { bookingCount },
  });
  await cacheService.delByPrefix('properties:');
}

async function syncPropertyBookingCountSafe(propertyId: number): Promise<void> {
  try {
    await syncPropertyBookingCount(propertyId);
  } catch (err) {
    console.warn('[BookingLifecycle] Failed to sync property booking count:', err);
  }
}

export interface RestoreQuotaOrderInput {
  roomCategoryId: number;
  checkInDate: Date | string;
  checkOutDate: Date | string;
  roomsBooked: number;
}

/**
 * Atomically restores room calendar quota inside an existing Prisma transaction using SELECT ... FOR UPDATE.
 * Only restores nights >= todayThaiStr so historical past-night calendar stats are never mutated.
 */
export async function restoreCalendarQuotaInTx(
  tx: any,
  bookingOrders: RestoreQuotaOrderInput[],
  options?: { todayThaiStr?: string }
): Promise<void> {
  const todayThaiStr = options?.todayThaiStr ?? getTodayThaiStr();

  for (const order of bookingOrders) {
    const nights = getDatesInRange(order.checkInDate, order.checkOutDate);
    for (const nightStr of nights) {
      if (nightStr < todayThaiStr) {
        continue;
      }

      const nightDate = new Date(`${nightStr}T00:00:00.000Z`);
      const cal = await tx.roomCategoryCalendar.findUnique({
        where: {
          roomCategoryId_date: {
            roomCategoryId: order.roomCategoryId,
            date: nightDate,
          },
        },
      });

      if (!cal) continue;

      try {
        await tx.$queryRawUnsafe(
          `SELECT id, available_rooms, booked_rooms, unavailable_rooms FROM room_category_calendars WHERE id = $1 FOR UPDATE`,
          cal.id
        );
      } catch {
        // Fallback for in-memory/mock test harnesses
      }

      const curCal = await tx.roomCategoryCalendar.findUnique({
        where: { id: cal.id },
      });

      const bookedRooms = curCal ? curCal.bookedRooms : cal.bookedRooms;
      const unavailableRooms = curCal ? curCal.unavailableRooms : cal.unavailableRooms;

      const rc = await tx.roomCategory.findUnique({
        where: { id: order.roomCategoryId },
      });
      const totalRoom = rc ? rc.totalRoom : cal.availableRooms + bookedRooms;
      const newBooked = Math.max(0, bookedRooms - order.roomsBooked);
      const newAvailable = Math.max(0, totalRoom - newBooked - unavailableRooms);

      await tx.roomCategoryCalendar.update({
        where: { id: cal.id },
        data: {
          bookedRooms: newBooked,
          availableRooms: newAvailable,
        },
      });
    }
  }
}

export interface LifecycleReconcileScope {
  guestId?: number;
  hostId?: number;
  propertyId?: number;
  bookingId?: number;
}

function matchesScope(booking: any, scope?: LifecycleReconcileScope): boolean {
  if (!scope) return true;
  if (scope.bookingId !== undefined && booking.id !== scope.bookingId) return false;
  if (scope.guestId !== undefined && booking.guestId !== scope.guestId) return false;
  if (scope.propertyId !== undefined && booking.propertyId !== scope.propertyId) return false;
  if (scope.hostId !== undefined && booking.property?.hostId !== scope.hostId) return false;
  return true;
}

/**
 * Atomically locks a booking row with SELECT ... FOR UPDATE and cancels it if still pending,
 * restoring room calendar quota safely without double-restoration under concurrent requests.
 */
export async function autoCancelPendingBookingInTx(
  tx: any,
  bookingId: number,
  reason: string,
  options?: {
    todayThaiStr?: string;
    fallbackOrders?: RestoreQuotaOrderInput[];
    shouldCancel?: (cur: any) => boolean;
  }
): Promise<{ cancelled: boolean; curStatus: string | null }> {
  try {
    await tx.$queryRawUnsafe(
      `SELECT id, booking_status FROM bookings WHERE id = $1 FOR UPDATE`,
      bookingId
    );
  } catch {
    // Fallback for mocks
  }

  const cur = await tx.booking.findUnique({
    where: { id: bookingId },
    include: { bookingOrders: true, property: true },
  });

  if (!cur || cur.deletedAt !== null || cur.bookingStatus !== 'pending') {
    return { cancelled: false, curStatus: cur?.bookingStatus ?? null };
  }

  if (options?.shouldCancel && !options.shouldCancel(cur)) {
    return { cancelled: false, curStatus: cur.bookingStatus };
  }

  const orders =
    Array.isArray(cur.bookingOrders) && cur.bookingOrders.length > 0
      ? cur.bookingOrders
      : options?.fallbackOrders ?? [];

  await restoreCalendarQuotaInTx(tx, orders, {
    todayThaiStr: options?.todayThaiStr,
  });

  await tx.booking.update({
    where: { id: cur.id },
    data: {
      bookingStatus: 'cancelled',
      cancelledBy: 'system',
      cancellationReason: reason,
    },
  });

  return { cancelled: true, curStatus: 'cancelled' };
}

async function expireOverduePendingBooking(
  booking: any,
  now: Date,
  todayThaiStr: string
): Promise<boolean> {
  const { cancelled } = await prisma.$transaction(
    (tx) =>
      autoCancelPendingBookingInTx(tx, booking.id, 'Payment window expired', {
        todayThaiStr,
        shouldCancel: (cur) => {
          const deadline = getPaymentDeadline(cur.createdAt, cur.checkInDate, cur.checkOutDate);
          return !isNaN(deadline.getTime()) && now.getTime() > deadline.getTime();
        },
      }),
    { maxWait: 10000, timeout: 30000 }
  );

  if (!cancelled) return false;

  await syncPropertyBookingCountSafe(booking.propertyId);
  await createNotificationSafe({
    userId: booking.guestId,
    roleName: 'guest',
    actionName: 'booking_cancelled',
    title: 'Booking expired',
    message: `Booking #${booking.id} was automatically cancelled because the payment window expired.`,
    category: 'booking',
    type: 'warning',
    referenceTable: 'bookings',
    referenceId: booking.id,
  });

  return true;
}

async function completeOverdueConfirmedBooking(booking: any, now: Date): Promise<boolean> {
  const result = await prisma.$transaction(
    async (tx) => {
      try {
        await tx.$queryRawUnsafe(
          `SELECT id, booking_status FROM bookings WHERE id = $1 FOR UPDATE`,
          booking.id
        );
      } catch {
        // Fallback for mocks
      }

      const cur = await tx.booking.findUnique({
        where: { id: booking.id },
        include: { property: true },
      });

      if (!cur || cur.deletedAt !== null || cur.bookingStatus !== 'confirmed') {
        return null;
      }

      const autoCompleteAt = getAutoCompleteAt(cur.checkOutDate);
      if (isNaN(autoCompleteAt.getTime()) || now.getTime() < autoCompleteAt.getTime()) {
        return null;
      }

      const updated = await tx.booking.update({
        where: { id: cur.id },
        data: {
          bookingStatus: 'successful',
          successedAt: autoCompleteAt,
        },
      });

      return { updated, cur };
    },
    { maxWait: 10000, timeout: 30000 }
  );

  if (!result) return false;

  await syncPropertyBookingCountSafe(booking.propertyId);

  await createNotificationSafe({
    userId: booking.guestId,
    roleName: 'guest',
    actionName: 'booking_completed',
    title: 'Stay completed',
    message: `Your stay for booking #${booking.id} is complete! You have ${REVIEW_WINDOW_DAYS} days to leave a review.`,
    category: 'booking',
    type: 'success',
    referenceTable: 'bookings',
    referenceId: booking.id,
  });

  const hostId = result.cur?.property?.hostId ?? booking.property?.hostId;
  if (hostId) {
    await createNotificationSafe({
      userId: hostId,
      roleName: 'host',
      actionName: 'booking_completed',
      title: 'Booking auto-completed',
      message: `Booking #${booking.id} was automatically marked as completed after check-out.`,
      category: 'booking',
      type: 'info',
      referenceTable: 'bookings',
      referenceId: booking.id,
    });
  }

  return true;
}

/**
 * Sweeps upcoming confirmed bookings for tomorrow (Asia/Bangkok) and sends
 * check-in reminders to both guest and host idempotently (once per booking).
 */
export async function sendUpcomingCheckInReminders(
  now: Date = new Date()
): Promise<{ remindersSent: number }> {
  let remindersSent = 0;
  try {
    const tomorrowThaiStr = getTomorrowThaiStr(now);
    const targetStart = new Date(`${tomorrowThaiStr}T00:00:00.000Z`);
    const targetEnd = new Date(targetStart.getTime() + DAY_MS);

    const upcomingBookings = await prisma.booking.findMany({
      where: {
        bookingStatus: 'confirmed',
        deletedAt: null,
        checkInDate: {
          gte: targetStart,
          lt: targetEnd,
        },
      },
      include: {
        property: true,
      },
    });

    if (!Array.isArray(upcomingBookings) || upcomingBookings.length === 0) {
      return { remindersSent: 0 };
    }

    const actionModel = (prisma as any)?.notificationAction;
    let actionRecord: { id: number } | null = null;
    if (actionModel && typeof actionModel.findUnique === 'function') {
      try {
        actionRecord = await actionModel.findUnique({ where: { name: 'check_in_reminder' } });
      } catch {
        // Safe fallback
      }
    }
    const notifActionId = actionRecord?.id;

    for (const booking of upcomingBookings) {
      if (!booking || booking.deletedAt !== null || booking.bookingStatus !== 'confirmed') {
        continue;
      }

      // Guest reminder idempotency
      let existingGuestNotif = null;
      try {
        const notifModel = (prisma as any)?.notification;
        if (notifModel && typeof notifModel.findFirst === 'function') {
          existingGuestNotif = await notifModel.findFirst({
            where: {
              userId: booking.guestId,
              referenceTable: 'bookings',
              referenceId: booking.id,
              deletedAt: null,
              ...(notifActionId
                ? { notificationActionId: notifActionId }
                : { action: { name: 'check_in_reminder' } }),
            },
          });
        }
      } catch (err) {
        console.warn(`[BookingLifecycle] Idempotency check failed for guest ${booking.guestId}:`, err);
      }

      if (!existingGuestNotif) {
        const sent = await createNotificationSafe({
          userId: booking.guestId,
          roleName: 'guest',
          actionName: 'check_in_reminder',
          title: 'Upcoming check-in tomorrow',
          message: `Reminder: Your stay at "${booking.property?.title ?? 'your booked property'}" begins tomorrow (${tomorrowThaiStr}).`,
          category: 'booking',
          type: 'reminder',
          referenceTable: 'bookings',
          referenceId: booking.id,
        });
        if (sent) remindersSent++;
      }

      // Host reminder idempotency
      const hostId = booking.property?.hostId;
      if (hostId) {
        let existingHostNotif = null;
        try {
          const notifModel = (prisma as any)?.notification;
          if (notifModel && typeof notifModel.findFirst === 'function') {
            existingHostNotif = await notifModel.findFirst({
              where: {
                userId: hostId,
                referenceTable: 'bookings',
                referenceId: booking.id,
                deletedAt: null,
                ...(notifActionId
                  ? { notificationActionId: notifActionId }
                  : { action: { name: 'check_in_reminder' } }),
              },
            });
          }
        } catch (err) {
          console.warn(`[BookingLifecycle] Idempotency check failed for host ${hostId}:`, err);
        }

        if (!existingHostNotif) {
          const sent = await createNotificationSafe({
            userId: hostId,
            roleName: 'host',
            actionName: 'check_in_reminder',
            title: 'Guest checking in tomorrow',
            message: `Reminder: Booking #${booking.id} check-in is scheduled for tomorrow (${tomorrowThaiStr}) at "${booking.property?.title ?? 'your property'}".`,
            category: 'booking',
            type: 'reminder',
            referenceTable: 'bookings',
            referenceId: booking.id,
          });
          if (sent) remindersSent++;
        }
      }
    }
  } catch (err) {
    console.warn('[BookingLifecycle] Error in sendUpcomingCheckInReminders:', err);
  }

  return { remindersSent };
}

/**
 * Reconciles overdue pending (auto-expire) and confirmed (auto-complete) bookings.
 * Safe against mocked/unavailable DBs and concurrent global sweeps.
 */
export async function reconcileLifecycleBookings(
  scope?: LifecycleReconcileScope
): Promise<{ expiredCount: number; completedCount: number; remindersCount?: number }> {
  const isGlobal =
    !scope ||
    (scope.guestId === undefined &&
      scope.hostId === undefined &&
      scope.propertyId === undefined &&
      scope.bookingId === undefined);

  if (isGlobal && isSweepRunning) {
    return { expiredCount: 0, completedCount: 0 };
  }

  if (isGlobal) {
    isSweepRunning = true;
  }

  let expiredCount = 0;
  let completedCount = 0;
  let remindersCount = 0;

  try {
    const now = new Date();
    const todayThaiStr = getTodayThaiStr(now);

    const baseWhere: Record<string, any> = { deletedAt: null };
    if (scope?.bookingId !== undefined) baseWhere.id = scope.bookingId;
    if (scope?.guestId !== undefined) baseWhere.guestId = scope.guestId;
    if (scope?.propertyId !== undefined) baseWhere.propertyId = scope.propertyId;
    if (scope?.hostId !== undefined) {
      baseWhere.property = { hostId: scope.hostId };
    }

    // 1. Auto-expire overdue pending bookings
    const pendingCandidates = await prisma.booking.findMany({
      where: { ...baseWhere, bookingStatus: 'pending' },
      include: { property: true, bookingOrders: true },
    });

    if (Array.isArray(pendingCandidates)) {
      for (const b of pendingCandidates) {
        if (!b || b.deletedAt != null || b.bookingStatus !== 'pending') continue;
        if (!b.createdAt || !b.checkOutDate) continue;
        if (!matchesScope(b, scope)) continue;

        const deadline = getPaymentDeadline(b.createdAt, b.checkInDate, b.checkOutDate);
        if (isNaN(deadline.getTime()) || now.getTime() <= deadline.getTime()) continue;

        const expired = await expireOverduePendingBooking(b, now, todayThaiStr);
        if (expired) expiredCount++;
      }
    }

    // 2. Auto-complete overdue confirmed bookings
    const confirmedCandidates = await prisma.booking.findMany({
      where: { ...baseWhere, bookingStatus: 'confirmed' },
      include: { property: true },
    });

    if (Array.isArray(confirmedCandidates)) {
      for (const b of confirmedCandidates) {
        if (!b || b.deletedAt != null || b.bookingStatus !== 'confirmed') continue;
        if (!b.checkOutDate) continue;
        if (!matchesScope(b, scope)) continue;

        const autoCompleteAt = getAutoCompleteAt(b.checkOutDate);
        if (isNaN(autoCompleteAt.getTime()) || now.getTime() < autoCompleteAt.getTime()) continue;

        const completed = await completeOverdueConfirmedBooking(b, now);
        if (completed) completedCount++;
      }
    }

    // 3. Send upcoming check-in reminders (only during global sweeps)
    if (isGlobal) {
      const res = await sendUpcomingCheckInReminders(now);
      remindersCount = res.remindersSent;
    }
  } catch (err) {
    console.warn('[BookingLifecycle] Sweep error (non-blocking):', err);
  } finally {
    if (isGlobal) {
      isSweepRunning = false;
    }
  }

  return { expiredCount, completedCount, ...(isGlobal ? { remindersCount } : {}) };
}

/**
 * Starts the 15-minute in-process lifecycle reconciliation scheduler (skipped in test env).
 */
export function startBookingLifecycleScheduler(): void {
  if (process.env.NODE_ENV === 'test' || schedulerInterval !== null) {
    return;
  }

  schedulerInterval = setInterval(() => {
    void reconcileLifecycleBookings();
  }, SWEEP_INTERVAL_MS);

  if (typeof schedulerInterval.unref === 'function') {
    schedulerInterval.unref();
  }

  // Run an initial non-blocking sweep shortly after startup
  const startupTimer = setTimeout(() => {
    void reconcileLifecycleBookings();
  }, 5000);
  if (typeof startupTimer.unref === 'function') {
    startupTimer.unref();
  }
}

/**
 * Stops the in-process booking lifecycle scheduler cleanly during shutdown.
 */
export function stopBookingLifecycleScheduler(): void {
  if (schedulerInterval !== null) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
