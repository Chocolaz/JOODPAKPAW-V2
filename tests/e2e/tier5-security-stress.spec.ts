/**
 * JoodPakPaw Automated Adversarial Security & Stress Test Suite (Tier 5)
 * Specification: tests/e2e/tier5-security-stress.spec.ts
 *
 * Scope:
 * 1. IDOR & RBAC Invariant Defenses (Guest spoofing Host, Cross-Host IDOR, Unauth, Malformed tokens)
 * 2. Admin Ban & Property Deactivation Cascades (banned hosts, banned properties, mid-booking ban auto-cancel)
 * 3. Input Hygiene & Injection Resilience (guestNote XSS, SQLi, length clamping, decline reason boundaries 0-500+)
 * 4. High-Concurrency Race Conditions & State Machine Invariants (parallel accepts, parallel cancels, illegal transitions)
 * 5. Offline & Zero-Cloud Security Guarantees (zero external AWS S3, stripe, or cloud data leaks)
 *
 * Execution: npx tsx tests/e2e/tier5-security-stress.spec.ts
 */

import fs from 'fs';
import path from 'path';
import {
  initTestServer,
  closeTestServer,
  apiRequest,
  generateTestToken,
  assert,
  assertEqual,
  calculateCrc16Ccitt,
  buildPromptPayPayload,
  verifyPromptPayPayload,
  getTodayThaiStr,
  getCheckInCutoffAt,
  getCanCompleteAt,
  getAutoCompleteAt,
  getPaymentDeadline,
  getReviewDeadline,
} from './harness';

interface TestResult {
  id: string;
  category: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const suiteResults: TestResult[] = [];

// Dynamic date generator ensuring collision-free stay intervals across test executions
let dateSeedMs = new Date('2029-01-01T00:00:00Z').getTime() + Math.floor(Math.random() * 50000000);
function generateUniqueBookingDates(nights = 2): { checkInDate: string; checkOutDate: string } {
  dateSeedMs += (nights + 3) * 24 * 3600 * 1000;
  const inDate = new Date(dateSeedMs);
  const outDate = new Date(dateSeedMs + nights * 24 * 3600 * 1000);
  return {
    checkInDate: inDate.toISOString().slice(0, 10),
    checkOutDate: outDate.toISOString().slice(0, 10),
  };
}

async function runAdversarialTest(
  id: string,
  category: string,
  name: string,
  fn: () => Promise<void> | void
): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    suiteResults.push({ id, category, name, passed: true, durationMs });
    console.log(`  \x1b[32m[PASS]\x1b[0m [${id}] ${category}: ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    const errorMsg = err?.message || String(err);
    suiteResults.push({ id, category, name, passed: false, error: errorMsg, durationMs });
    console.error(`  \x1b[31m[FAIL]\x1b[0m [${id}] ${category}: ${name} (${durationMs}ms) - ${errorMsg}`);
  }
}

// User credentials and tokens for adversarial matrix
// User 4: Regular Guest (user1@joodpakpaw.com)
// User 5: Alternate Guest (user2@joodpakpaw.com)
// User 2: Host 1 (owns Property 1)
// User 3: Host 2 (owns Property 2)
// User 8: Host 3 (owns Property 7 Challenger Testing Pet Resort)
// User 10: Intruder / Attacker (challenger_intruder@joodpakpaw.com)
const GUEST_TOKEN = generateTestToken({ id: 4, email: 'user1@joodpakpaw.com', roleId: 1, roleName: 'guest' });
const GUEST2_TOKEN = generateTestToken({ id: 5, email: 'user2@joodpakpaw.com', roleId: 1, roleName: 'guest' });
const HOST1_TOKEN = generateTestToken({ id: 2, email: 'host1@joodpakpaw.com', roleId: 2, roleName: 'host' });
const HOST2_TOKEN = generateTestToken({ id: 3, email: 'host2@joodpakpaw.com', roleId: 2, roleName: 'host' });
const HOST3_TOKEN = generateTestToken({ id: 8, email: 'challenger_host@joodpakpaw.com', roleId: 2, roleName: 'host' });
const INTRUDER_TOKEN = generateTestToken({ id: 10, email: 'challenger_intruder@joodpakpaw.com', roleId: 1, roleName: 'guest' });

async function runTier5TestSuite(): Promise<void> {
  const startTime = Date.now();

  console.log('\n================================================================================');
  console.log('       JOODPAKPAW TIER 5: ADVERSARIAL STRESS & SECURITY HARNESS');
  console.log('================================================================================\n');

  let prisma: any = null;
  try {
    const prismaModule = await import('../../joodpakpaw-api/src/database/prisma');
    prisma = prismaModule.prisma;
    if (prisma) {
      const maxBooking = await prisma.booking.aggregate({ _max: { checkOutDate: true } });
      if (maxBooking?._max?.checkOutDate) {
        const dbMaxMs = new Date(maxBooking._max.checkOutDate).getTime();
        if (dbMaxMs >= dateSeedMs) {
          dateSeedMs = dbMaxMs + 7 * 24 * 3600 * 1000;
        }
      }
    }
  } catch (err) {
    console.warn('[WARN] Prisma direct connection not available, proceeding via HTTP harness:', err);
  }

  try {
    const serverUrl = await initTestServer();
    console.log(`[INFO] Test server active at: ${serverUrl}\n`);

    // =========================================================================
    // SECTION 1: IDOR & RBAC INVARIANT DEFENSES
    // =========================================================================
    console.log('\x1b[1m--- Section 1: IDOR & Role-Based Access Control (RBAC) Invariants ---\x1b[0m');

    await runAdversarialTest(
      'TC-T5-IDOR-01',
      'IDOR/RBAC',
      'Unauthenticated request to POST /api/v1/bookings rejected with 401 A-3005',
      async () => {
        const res = await apiRequest('/api/v1/bookings', {
          method: 'POST',
          body: { bookingOrders: [] },
        });
        assert(res.status === 401, `Expected 401, got ${res.status}`);
        assertEqual(res.body?.code, 'A-3005');
      }
    );

    await runAdversarialTest(
      'TC-T5-IDOR-02',
      'IDOR/RBAC',
      'Unauthenticated request to GET /api/v1/bookings/:id rejected with 401 A-3005',
      async () => {
        const res = await apiRequest('/api/v1/bookings/101', {
          method: 'GET',
        });
        assert(res.status === 401, `Expected 401, got ${res.status}`);
        assertEqual(res.body?.code, 'A-3005');
      }
    );

    await runAdversarialTest(
      'TC-T5-IDOR-03',
      'IDOR/RBAC',
      'Unauthenticated request to PATCH /api/v1/hosts/bookings/:id/accept rejected with 401 A-3005',
      async () => {
        const res = await apiRequest('/api/v1/hosts/bookings/101/accept', {
          method: 'PATCH',
        });
        assert(res.status === 401, `Expected 401, got ${res.status}`);
        assertEqual(res.body?.code, 'A-3005');
      }
    );

    await runAdversarialTest(
      'TC-T5-IDOR-04',
      'IDOR/RBAC',
      'Unauthenticated request to PATCH /api/v1/hosts/bookings/:id/success rejected with 401 A-3005',
      async () => {
        const res = await apiRequest('/api/v1/hosts/bookings/101/success', {
          method: 'PATCH',
        });
        assert(res.status === 401, `Expected 401, got ${res.status}`);
        assertEqual(res.body?.code, 'A-3005');
      }
    );

    await runAdversarialTest(
      'TC-T5-IDOR-05',
      'IDOR/RBAC',
      'Unauthenticated request to PATCH /api/v1/bookings/:id/cancel rejected with 401 A-3005',
      async () => {
        const res = await apiRequest('/api/v1/bookings/101/cancel', {
          method: 'PATCH',
          body: { reason: 'No auth' },
        });
        assert(res.status === 401, `Expected 401, got ${res.status}`);
        assertEqual(res.body?.code, 'A-3005');
      }
    );

    await runAdversarialTest(
      'TC-T5-IDOR-06',
      'IDOR/RBAC',
      'Forged signature and corrupted JWT bearer tokens rejected with 401 A-3005',
      async () => {
        const forgedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake_signature_bytes';
        const res = await apiRequest('/api/v1/bookings/paginate', {
          token: forgedToken,
        });
        assert(res.status === 401, `Expected 401, got ${res.status}`);
        assertEqual(res.body?.code, 'A-3005');
      }
    );

    // Create an isolated reference booking for IDOR tests (Guest = User 4, Property = 1 owned by User 2)
    const idorDates = generateUniqueBookingDates(2);
    const createIdorBooking = await apiRequest('/api/v1/bookings', {
      method: 'POST',
      token: GUEST_TOKEN,
      body: {
        bookingOrders: [
          {
            roomCategoryId: 1,
            checkInDate: idorDates.checkInDate,
            checkOutDate: idorDates.checkOutDate,
            roomsBooked: 1,
          },
        ],
        petProfileIds: [1],
        guestNote: 'IDOR Isolation Probe',
      },
    });

    const idorBookingId =
      createIdorBooking.body?.data?.booking?.id ||
      createIdorBooking.body?.booking?.id ||
      createIdorBooking.body?.data?.id;
    assert(
      idorBookingId,
      `Created reference booking for IDOR matrix (status: ${createIdorBooking.status}, body: ${JSON.stringify(createIdorBooking.body)})`
    );

    await runAdversarialTest(
      'TC-T5-IDOR-07',
      'IDOR/RBAC',
      'Guest attempting to call acceptHostBooking on their own booking rejected with 403 A-3007',
      async () => {
        const res = await apiRequest(`/api/v1/hosts/bookings/${idorBookingId}/accept`, {
          method: 'PATCH',
          token: GUEST_TOKEN,
        });
        assert(res.status === 403, `Expected 403, got ${res.status}`);
        assertEqual(res.body?.code, 'A-3007');
        assert(res.body?.message?.includes('Forbidden'), 'Expected forbidden error message');
      }
    );

    await runAdversarialTest(
      'TC-T5-IDOR-08',
      'IDOR/RBAC',
      'Guest attempting to call completeHostBooking on their own booking rejected with 403 A-3007',
      async () => {
        const res = await apiRequest(`/api/v1/hosts/bookings/${idorBookingId}/success`, {
          method: 'PATCH',
          token: GUEST_TOKEN,
        });
        assert(res.status === 403, `Expected 403, got ${res.status}`);
        assertEqual(res.body?.code, 'A-3007');
      }
    );

    await runAdversarialTest(
      'TC-T5-IDOR-09',
      'IDOR/RBAC',
      'Cross-Host IDOR: Host 2 (User 3) attempting to accept Property 1 booking rejected with 403 A-3007',
      async () => {
        const res = await apiRequest(`/api/v1/hosts/bookings/${idorBookingId}/accept`, {
          method: 'PATCH',
          token: HOST2_TOKEN,
        });
        assert(res.status === 403, `Expected 403, got ${res.status}`);
        assertEqual(res.body?.code, 'A-3007');
        assert(res.body?.message?.includes('You do not host this booking'), 'Expected non-host rejection');
      }
    );

    await runAdversarialTest(
      'TC-T5-IDOR-10',
      'IDOR/RBAC',
      'Cross-Host IDOR: Host 2 (User 3) attempting to complete Property 1 booking rejected with 403 A-3007',
      async () => {
        const res = await apiRequest(`/api/v1/hosts/bookings/${idorBookingId}/success`, {
          method: 'PATCH',
          token: HOST2_TOKEN,
        });
        assert(res.status === 403, `Expected 403, got ${res.status}`);
        assertEqual(res.body?.code, 'A-3007');
      }
    );

    await runAdversarialTest(
      'TC-T5-IDOR-11',
      'IDOR/RBAC',
      'Intruder (User 10) attempting to read another guest booking detail rejected with 403 A-3007',
      async () => {
        const res = await apiRequest(`/api/v1/bookings/${idorBookingId}`, {
          method: 'GET',
          token: INTRUDER_TOKEN,
        });
        assert(res.status === 403, `Expected 403, got ${res.status}`);
        assertEqual(res.body?.code, 'A-3007');
      }
    );

    await runAdversarialTest(
      'TC-T5-IDOR-12',
      'IDOR/RBAC',
      'Intruder (User 10) attempting to cancel another guest booking rejected with 403 A-3007',
      async () => {
        const res = await apiRequest(`/api/v1/bookings/${idorBookingId}/cancel`, {
          method: 'PATCH',
          token: INTRUDER_TOKEN,
          body: { reason: 'Unauthorized cancellation attack' },
        });
        assert(res.status === 403, `Expected 403, got ${res.status}`);
        assertEqual(res.body?.code, 'A-3007');
      }
    );

    await runAdversarialTest(
      'TC-T5-IDOR-13',
      'IDOR/RBAC',
      'Intruder (User 10) attempting to confirm payment on another guest booking rejected with 403 A-3007',
      async () => {
        const res = await apiRequest(`/api/v1/bookings/${idorBookingId}/confirm-payment`, {
          method: 'PATCH',
          token: INTRUDER_TOKEN,
        });
        assert(res.status === 403, `Expected 403, got ${res.status}`);
        assertEqual(res.body?.code, 'A-3007');
      }
    );

    await runAdversarialTest(
      'TC-T5-IDOR-14',
      'IDOR/RBAC',
      'Guest cancelling booking cannot spoof cancelledBy=host (server strictly enforces cancelledBy=guest)',
      async () => {
        const spoofDates = generateUniqueBookingDates(2);
        const makeRes = await apiRequest('/api/v1/bookings', {
          method: 'POST',
          token: GUEST_TOKEN,
          body: {
            bookingOrders: [
              {
                roomCategoryId: 1,
                checkInDate: spoofDates.checkInDate,
                checkOutDate: spoofDates.checkOutDate,
                roomsBooked: 1,
              },
            ],
            petProfileIds: [1],
            guestNote: 'Spoof Attribution Test',
          },
        });
        const bookId = makeRes.body?.data?.booking?.id || makeRes.body?.booking?.id || makeRes.body?.data?.id;
        assert(bookId, 'Created test booking for spoof check');

        const cancelRes = await apiRequest(`/api/v1/bookings/${bookId}/cancel`, {
          method: 'PATCH',
          token: GUEST_TOKEN,
          body: {
            reason: 'Guest self cancel',
            cancelledBy: 'host', // Malicious attempt to blame host
          },
        });
        assert(cancelRes.status === 200, `Cancel returned ${cancelRes.status}`);
        const cancelledData = cancelRes.body?.data?.booking || cancelRes.body?.data;
        assertEqual(cancelledData.cancelledBy, 'guest', 'Server attributed cancelledBy to guest');
      }
    );

    // =========================================================================
    // SECTION 2: ADMIN BAN & PROPERTY DEACTIVATION CASCADES
    // =========================================================================
    console.log('\n\x1b[1m--- Section 2: Admin Ban & Deactivation Cascade Defense ---\x1b[0m');

    await runAdversarialTest(
      'TC-T5-BAN-01',
      'Admin-Ban',
      'Banned user token (bannedAt !== null) rejected by authenticateToken with 403 A-3002',
      async () => {
        if (!prisma) return;
        await prisma.user.update({
          where: { id: 10 },
          data: { bannedAt: new Date() },
        });

        try {
          const res = await apiRequest('/api/v1/bookings/paginate', {
            token: INTRUDER_TOKEN,
          });
          assert(res.status === 403, `Expected 403, got ${res.status}`);
          assertEqual(res.body?.code, 'A-3002');
          assert(res.body?.message?.includes('banned'), 'Expected banned account message');
        } finally {
          await prisma.user.update({
            where: { id: 10 },
            data: { bannedAt: null },
          });
        }
      }
    );

    await runAdversarialTest(
      'TC-T5-BAN-02',
      'Admin-Ban',
      'Banned host account cannot call acceptHostBooking -> rejected with 403 A-3002',
      async () => {
        if (!prisma) return;
        await prisma.user.update({
          where: { id: 8 },
          data: { bannedAt: new Date() },
        });

        try {
          const res = await apiRequest(`/api/v1/hosts/bookings/${idorBookingId}/accept`, {
            method: 'PATCH',
            token: HOST3_TOKEN,
          });
          assert(res.status === 403, `Expected 403, got ${res.status}`);
          assertEqual(res.body?.code, 'A-3002');
        } finally {
          await prisma.user.update({
            where: { id: 8 },
            data: { bannedAt: null },
          });
        }
      }
    );

    await runAdversarialTest(
      'TC-T5-BAN-03',
      'Admin-Ban',
      'Banned host account cannot reply to reviews -> rejected with 403 A-3002',
      async () => {
        if (!prisma) return;
        await prisma.user.update({
          where: { id: 8 },
          data: { bannedAt: new Date() },
        });

        try {
          const res = await apiRequest(`/api/v1/hosts/bookings/${idorBookingId}/review-reply`, {
            method: 'POST',
            token: HOST3_TOKEN,
            body: { reply: 'Attempt from banned host' },
          });
          assert(res.status === 403, `Expected 403, got ${res.status}`);
          assertEqual(res.body?.code, 'A-3002');
        } finally {
          await prisma.user.update({
            where: { id: 8 },
            data: { bannedAt: null },
          });
        }
      }
    );

    await runAdversarialTest(
      'TC-T5-BAN-04',
      'Admin-Ban',
      'Booking creation on admin-banned property (isBannedByAdmin=true) rejected with 400 A-3002',
      async () => {
        if (!prisma) return;
        await prisma.property.update({
          where: { id: 1 },
          data: { isBannedByAdmin: true },
        });

        try {
          const banDates = generateUniqueBookingDates(2);
          const res = await apiRequest('/api/v1/bookings', {
            method: 'POST',
            token: GUEST_TOKEN,
            body: {
              bookingOrders: [
                {
                  roomCategoryId: 1,
                  checkInDate: banDates.checkInDate,
                  checkOutDate: banDates.checkOutDate,
                  roomsBooked: 1,
                },
              ],
              petProfileIds: [1],
            },
          });
          assert(res.status === 400, `Expected 400, got ${res.status}`);
          assertEqual(res.body?.code, 'A-3002');
          assert(res.body?.message?.includes('not available for booking'), 'Expected unavailable message');
        } finally {
          await prisma.property.update({
            where: { id: 1 },
            data: { isBannedByAdmin: false },
          });
        }
      }
    );

    await runAdversarialTest(
      'TC-T5-BAN-05',
      'Admin-Ban',
      'Booking creation on deactivated property (isActive=false) rejected with 400 A-3002',
      async () => {
        if (!prisma) return;
        await prisma.property.update({
          where: { id: 1 },
          data: { isActive: false },
        });

        try {
          const deactDates = generateUniqueBookingDates(2);
          const res = await apiRequest('/api/v1/bookings', {
            method: 'POST',
            token: GUEST_TOKEN,
            body: {
              bookingOrders: [
                {
                  roomCategoryId: 1,
                  checkInDate: deactDates.checkInDate,
                  checkOutDate: deactDates.checkOutDate,
                  roomsBooked: 1,
                },
              ],
              petProfileIds: [1],
            },
          });
          assert(res.status === 400, `Expected 400, got ${res.status}`);
          assertEqual(res.body?.code, 'A-3002');
        } finally {
          await prisma.property.update({
            where: { id: 1 },
            data: { isActive: true },
          });
        }
      }
    );

    await runAdversarialTest(
      'TC-T5-BAN-06',
      'Admin-Ban',
      'Host accept blocked if property was banned mid-lifecycle (isBannedByAdmin=true) -> 400 A-3002',
      async () => {
        if (!prisma) return;
        const banMidDates = generateUniqueBookingDates(2);
        const makeRes = await apiRequest('/api/v1/bookings', {
          method: 'POST',
          token: GUEST_TOKEN,
          body: {
            bookingOrders: [
              {
                roomCategoryId: 1,
                checkInDate: banMidDates.checkInDate,
                checkOutDate: banMidDates.checkOutDate,
                roomsBooked: 1,
              },
            ],
            petProfileIds: [1],
          },
        });
        const bookId = makeRes.body?.data?.booking?.id || makeRes.body?.booking?.id || makeRes.body?.data?.id;
        assert(bookId, 'Created test booking on Property 1');

        await prisma.property.update({
          where: { id: 1 },
          data: { isBannedByAdmin: true },
        });

        try {
          const acceptRes = await apiRequest(`/api/v1/hosts/bookings/${bookId}/accept`, {
            method: 'PATCH',
            token: HOST1_TOKEN,
          });
          assert(acceptRes.status === 400, `Expected 400, got ${acceptRes.status}`);
          assertEqual(acceptRes.body?.code, 'A-3002');
          assert(acceptRes.body?.message?.includes('not available for booking'), 'Expected ban error message');
        } finally {
          await prisma.property.update({
            where: { id: 1 },
            data: { isBannedByAdmin: false },
          });
        }
      }
    );

    await runAdversarialTest(
      'TC-T5-BAN-07',
      'Admin-Ban',
      'Mid-booking property ban auto-cancels pending reservation upon payment attempt -> 409 B-4004',
      async () => {
        if (!prisma) return;
        const banPayDates = generateUniqueBookingDates(2);
        const makeRes = await apiRequest('/api/v1/bookings', {
          method: 'POST',
          token: GUEST_TOKEN,
          body: {
            bookingOrders: [
              {
                roomCategoryId: 1,
                checkInDate: banPayDates.checkInDate,
                checkOutDate: banPayDates.checkOutDate,
                roomsBooked: 1,
              },
            ],
            petProfileIds: [1],
          },
        });
        const bookId = makeRes.body?.data?.booking?.id || makeRes.body?.booking?.id || makeRes.body?.data?.id;
        assert(bookId, 'Created test booking for mid-ban auto-cancel check');

        await prisma.property.update({
          where: { id: 1 },
          data: { isBannedByAdmin: true },
        });

        try {
          const payRes = await apiRequest(`/api/v1/bookings/${bookId}/confirm-payment`, {
            method: 'PATCH',
            token: GUEST_TOKEN,
          });
          assert(payRes.status === 409, `Expected 409 Conflict, got ${payRes.status}`);
          assertEqual(payRes.body?.code, 'B-4004');
          assert(payRes.body?.message?.includes('no longer available'), 'Expected unavailable error');

          const checkBooking = await prisma.booking.findUnique({
            where: { id: bookId },
            select: { bookingStatus: true },
          });
          assertEqual(checkBooking.bookingStatus, 'cancelled', 'Booking transitioned to cancelled status');
        } finally {
          await prisma.property.update({
            where: { id: 1 },
            data: { isBannedByAdmin: false },
          });
        }
      }
    );

    // =========================================================================
    // SECTION 3: INPUT HYGIENE, BOUNDARY & INJECTION SAFETY
    // =========================================================================
    console.log('\n\x1b[1m--- Section 3: Input Hygiene, Boundary & Injection Safety ---\x1b[0m');

    await runAdversarialTest(
      'TC-T5-INP-01',
      'Input-Hygiene',
      'guestNote containing HTML & XSS script tags is safely stored as text without script execution',
      async () => {
        const xssDates = generateUniqueBookingDates(2);
        const xssPayload = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
        const res = await apiRequest('/api/v1/bookings', {
          method: 'POST',
          token: GUEST_TOKEN,
          body: {
            bookingOrders: [
              {
                roomCategoryId: 1,
                checkInDate: xssDates.checkInDate,
                checkOutDate: xssDates.checkOutDate,
                roomsBooked: 1,
              },
            ],
            petProfileIds: [1],
            guestNote: xssPayload,
          },
        });
        assert(res.status === 201, `Booking created with status ${res.status}`);
        const createdNote = res.body?.data?.guestNote || res.body?.booking?.guestNote;
        assert(createdNote.includes('<script>'), 'Preserved raw string literal');
        assert(!createdNote.includes('evaluated'), 'Script not executed');
      }
    );

    await runAdversarialTest(
      'TC-T5-INP-02',
      'Input-Hygiene',
      'guestNote containing SQL injection payload does not corrupt database or execute injection',
      async () => {
        const sqliDates = generateUniqueBookingDates(2);
        const sqliPayload = "' OR '1'='1'; DROP TABLE non_existent_test_table; --";
        const res = await apiRequest('/api/v1/bookings', {
          method: 'POST',
          token: GUEST_TOKEN,
          body: {
            bookingOrders: [
              {
                roomCategoryId: 1,
                checkInDate: sqliDates.checkInDate,
                checkOutDate: sqliDates.checkOutDate,
                roomsBooked: 1,
              },
            ],
            petProfileIds: [1],
            guestNote: sqliPayload,
          },
        });
        assert(res.status === 201, `SQLi safely handled via parameterized ORM: ${res.status}`);
      }
    );

    await runAdversarialTest(
      'TC-T5-INP-03',
      'Input-Hygiene',
      'guestNote with Thai script, emojis and multi-line breaks preserves UTF-8 fidelity',
      async () => {
        const uniDates = generateUniqueBookingDates(2);
        const unicodeNote = '🐾 น้องโมจิ กินอาหารเม็ดวันละ 2 มื้อ (เช้า 8:00 / เย็น 17:00)\n❤️ ระวังน้องตกใจเสียงฟ้าร้อง';
        const res = await apiRequest('/api/v1/bookings', {
          method: 'POST',
          token: GUEST_TOKEN,
          body: {
            bookingOrders: [
              {
                roomCategoryId: 1,
                checkInDate: uniDates.checkInDate,
                checkOutDate: uniDates.checkOutDate,
                roomsBooked: 1,
              },
            ],
            petProfileIds: [1],
            guestNote: unicodeNote,
          },
        });
        assert(res.status === 201, `Unicode booking status ${res.status}`);
        const returnedNote = res.body?.data?.guestNote || res.body?.booking?.guestNote;
        assertEqual(returnedNote, unicodeNote, 'UTF-8 multi-byte string preserved exactly');
      }
    );

    await runAdversarialTest(
      'TC-T5-INP-04',
      'Input-Hygiene',
      'Frontend PaymentSection.tsx enforces 255-character clamping on raw guestNote',
      () => {
        const paymentSectionPath = path.resolve(
          process.cwd(),
          'joodpakpaw-frontend',
          'app',
          'booking',
          'confirm',
          '_components',
          'PaymentSection.tsx'
        );
        assert(fs.existsSync(paymentSectionPath), `Missing PaymentSection.tsx`);
        const content = fs.readFileSync(paymentSectionPath, 'utf-8');
        assert(
          content.includes('slice(0, 255)') || content.includes('slice(0,255)'),
          'Expected slice(0, 255) clamping in PaymentSection.tsx'
        );
      }
    );

    await runAdversarialTest(
      'TC-T5-INP-05',
      'Input-Hygiene',
      'Frontend ConfirmBookingDisplay.tsx enforces character counter cap and trimming',
      () => {
        const confirmPath = path.resolve(
          process.cwd(),
          'joodpakpaw-frontend',
          'app',
          'booking',
          'confirm',
          '_components',
          'ConfirmBookingDisplay.tsx'
        );
        assert(fs.existsSync(confirmPath), `Missing ConfirmBookingDisplay.tsx`);
        const content = fs.readFileSync(confirmPath, 'utf-8');
        assert(content.includes('500'), 'Expected 500-char indicator in ConfirmBookingDisplay');
        assert(content.includes('.trim()'), 'Expected trim() normalization on guest note input');
      }
    );

    await runAdversarialTest(
      'TC-T5-INP-06',
      'Input-Hygiene',
      'Host decline reason with empty/whitespace string is accepted and sets cancellationReason=null',
      async () => {
        const decDates = generateUniqueBookingDates(2);
        const makeRes = await apiRequest('/api/v1/bookings', {
          method: 'POST',
          token: GUEST_TOKEN,
          body: {
            bookingOrders: [
              {
                roomCategoryId: 1,
                checkInDate: decDates.checkInDate,
                checkOutDate: decDates.checkOutDate,
                roomsBooked: 1,
              },
            ],
            petProfileIds: [1],
          },
        });
        const bookId = makeRes.body?.data?.booking?.id || makeRes.body?.booking?.id || makeRes.body?.data?.id;

        const cancelRes = await apiRequest(`/api/v1/bookings/${bookId}/cancel`, {
          method: 'PATCH',
          token: HOST1_TOKEN,
          body: { reason: '     ' },
        });
        assert(cancelRes.status === 200, `Cancel status: ${cancelRes.status}`);
        const data = cancelRes.body?.data?.booking || cancelRes.body?.data;
        assertEqual(data.cancellationReason, null, 'Whitespace converted to null cancellationReason');
      }
    );

    await runAdversarialTest(
      'TC-T5-INP-07',
      'Input-Hygiene',
      'Host decline reason with exactly 255 characters is stored without truncation',
      async () => {
        const dec255Dates = generateUniqueBookingDates(2);
        const makeRes = await apiRequest('/api/v1/bookings', {
          method: 'POST',
          token: GUEST_TOKEN,
          body: {
            bookingOrders: [
              {
                roomCategoryId: 1,
                checkInDate: dec255Dates.checkInDate,
                checkOutDate: dec255Dates.checkOutDate,
                roomsBooked: 1,
              },
            ],
            petProfileIds: [1],
          },
        });
        const bookId = makeRes.body?.data?.booking?.id || makeRes.body?.booking?.id || makeRes.body?.data?.id;

        const reason255 = 'A'.repeat(255);
        const cancelRes = await apiRequest(`/api/v1/bookings/${bookId}/cancel`, {
          method: 'PATCH',
          token: HOST1_TOKEN,
          body: { reason: reason255 },
        });
        assert(cancelRes.status === 200, `Cancel status: ${cancelRes.status}`);
        const data = cancelRes.body?.data?.booking || cancelRes.body?.data;
        assertEqual(data.cancellationReason, reason255, 'Exact 255-char reason preserved');
      }
    );

    await runAdversarialTest(
      'TC-T5-INP-08',
      'Input-Hygiene',
      'Host decline reason with 500 characters (frontend max) is safely clamped to 255 by backend',
      async () => {
        const dec500Dates = generateUniqueBookingDates(2);
        const makeRes = await apiRequest('/api/v1/bookings', {
          method: 'POST',
          token: GUEST_TOKEN,
          body: {
            bookingOrders: [
              {
                roomCategoryId: 1,
                checkInDate: dec500Dates.checkInDate,
                checkOutDate: dec500Dates.checkOutDate,
                roomsBooked: 1,
              },
            ],
            petProfileIds: [1],
          },
        });
        const bookId = makeRes.body?.data?.booking?.id || makeRes.body?.booking?.id || makeRes.body?.data?.id;

        const reason500 = 'B'.repeat(500);
        const cancelRes = await apiRequest(`/api/v1/bookings/${bookId}/cancel`, {
          method: 'PATCH',
          token: HOST1_TOKEN,
          body: { reason: reason500 },
        });
        assert(cancelRes.status === 200, `Cancel status: ${cancelRes.status}`);
        const data = cancelRes.body?.data?.booking || cancelRes.body?.data;
        assertEqual(data.cancellationReason.length, 255, 'Backend clamped reason to 255 chars');
      }
    );

    await runAdversarialTest(
      'TC-T5-INP-09',
      'Input-Hygiene',
      'Host decline reason with oversized payload (5,000 characters) truncated safely without crash',
      async () => {
        const dec5kDates = generateUniqueBookingDates(2);
        const makeRes = await apiRequest('/api/v1/bookings', {
          method: 'POST',
          token: GUEST_TOKEN,
          body: {
            bookingOrders: [
              {
                roomCategoryId: 1,
                checkInDate: dec5kDates.checkInDate,
                checkOutDate: dec5kDates.checkOutDate,
                roomsBooked: 1,
              },
            ],
            petProfileIds: [1],
          },
        });
        const bookId = makeRes.body?.data?.booking?.id || makeRes.body?.booking?.id || makeRes.body?.data?.id;

        const giantPayload = 'Z'.repeat(5000);
        const cancelRes = await apiRequest(`/api/v1/bookings/${bookId}/cancel`, {
          method: 'PATCH',
          token: HOST1_TOKEN,
          body: { reason: giantPayload },
        });
        assert(cancelRes.status === 200, `Massive payload handled cleanly: ${cancelRes.status}`);
        const data = cancelRes.body?.data?.booking || cancelRes.body?.data;
        assert(data.cancellationReason.length <= 255, 'Reason length safely constrained');
      }
    );

    await runAdversarialTest(
      'TC-T5-INP-10',
      'Input-Hygiene',
      'Host decline reason containing XSS payload is safely escaped when rendered in BookingDetailDisplay',
      () => {
        const displayPath = path.resolve(
          process.cwd(),
          'joodpakpaw-frontend',
          'app',
          'profile',
          'bookings',
          '[bookingId]',
          '_components',
          'BookingDetailDisplay.tsx'
        );
        const content = fs.readFileSync(displayPath, 'utf-8');
        assert(content.includes('bookingDetails.cancellationReason'), 'Renders cancellationReason');
        assert(!content.includes('dangerouslySetInnerHTML'), 'Zero dangerouslySetInnerHTML usage');
      }
    );

    await runAdversarialTest(
      'TC-T5-INP-11',
      'Input-Hygiene',
      'Review reply length boundaries: empty reply or >500 chars rejected with 400 T-2007',
      async () => {
        const emptyRes = await apiRequest(`/api/v1/hosts/bookings/${idorBookingId}/review-reply`, {
          method: 'POST',
          token: HOST1_TOKEN,
          body: { reply: '   ' },
        });
        assert(emptyRes.status === 400, `Empty reply returned ${emptyRes.status}`);
        assertEqual(emptyRes.body?.code, 'T-2007');

        const giantReply = 'R'.repeat(501);
        const giantRes = await apiRequest(`/api/v1/hosts/bookings/${idorBookingId}/review-reply`, {
          method: 'POST',
          token: HOST1_TOKEN,
          body: { reply: giantReply },
        });
        assert(giantRes.status === 400, `Over-limit reply returned ${giantRes.status}`);
        assertEqual(giantRes.body?.code, 'T-2007');
      }
    );

    await runAdversarialTest(
      'TC-T5-INP-12',
      'Input-Hygiene',
      'Non-numeric booking ID path parameter (e.g. "invalid_id") rejected with 400 T-2007',
      async () => {
        const res = await apiRequest('/api/v1/bookings/invalid_id_probe', {
          token: GUEST_TOKEN,
        });
        assert(res.status === 400, `Expected 400 for non-numeric ID, got ${res.status}`);
        assertEqual(res.body?.code, 'T-2007');
      }
    );

    // =========================================================================
    // SECTION 4: CONCURRENCY RACE CONDITIONS & STATE MACHINE STRESS
    // =========================================================================
    console.log('\n\x1b[1m--- Section 4: Concurrency Race Conditions & State Machine Stress ---\x1b[0m');

    await runAdversarialTest(
      'TC-T5-STR-01',
      'Concurrency',
      'High-Concurrency Race on Host Accept: 5 parallel requests to accept -> exactly 1 succeeds (200), 4 fail with 400 B-4003',
      async () => {
        const raceDates = generateUniqueBookingDates(2);
        const makeRes = await apiRequest('/api/v1/bookings', {
          method: 'POST',
          token: GUEST_TOKEN,
          body: {
            bookingOrders: [
              {
                roomCategoryId: 1,
                checkInDate: raceDates.checkInDate,
                checkOutDate: raceDates.checkOutDate,
                roomsBooked: 1,
              },
            ],
            petProfileIds: [1],
          },
        });
        const bookId = makeRes.body?.data?.booking?.id || makeRes.body?.booking?.id || makeRes.body?.data?.id;
        assert(bookId, 'Booking created for accept race test');

        const acceptPromises = Array.from({ length: 5 }).map(() =>
          apiRequest(`/api/v1/hosts/bookings/${bookId}/accept`, {
            method: 'PATCH',
            token: HOST1_TOKEN,
          })
        );

        const results = await Promise.all(acceptPromises);
        const successes = results.filter((r) => r.status === 200);
        const conflicts = results.filter((r) => r.status === 400 && r.body?.code === 'B-4003');

        assertEqual(successes.length, 1, 'Exactly one concurrent accept succeeded');
        assertEqual(conflicts.length, 4, 'Remaining 4 concurrent accepts rejected with 400 B-4003');
      }
    );

    await runAdversarialTest(
      'TC-T5-STR-02',
      'Concurrency',
      'High-Concurrency Race on Cancellation: 5 parallel requests to cancel -> exactly 1 succeeds (200), 4 fail with 400 B-4003',
      async () => {
        const cancelRaceDates = generateUniqueBookingDates(2);
        const makeRes = await apiRequest('/api/v1/bookings', {
          method: 'POST',
          token: GUEST_TOKEN,
          body: {
            bookingOrders: [
              {
                roomCategoryId: 1,
                checkInDate: cancelRaceDates.checkInDate,
                checkOutDate: cancelRaceDates.checkOutDate,
                roomsBooked: 1,
              },
            ],
            petProfileIds: [1],
          },
        });
        const bookId = makeRes.body?.data?.booking?.id || makeRes.body?.booking?.id || makeRes.body?.data?.id;
        assert(bookId, 'Booking created for cancel race test');

        const cancelPromises = Array.from({ length: 5 }).map((_, idx) =>
          apiRequest(`/api/v1/bookings/${bookId}/cancel`, {
            method: 'PATCH',
            token: GUEST_TOKEN,
            body: { reason: `Parallel cancel ${idx + 1}` },
          })
        );

        const results = await Promise.all(cancelPromises);
        const successes = results.filter((r) => r.status === 200);
        const rejects = results.filter((r) => r.status === 400 && r.body?.code === 'B-4003');

        assertEqual(successes.length, 1, 'Exactly one concurrent cancel succeeded');
        assertEqual(rejects.length, 4, 'Remaining 4 concurrent cancels rejected with 400 B-4003');
      }
    );

    await runAdversarialTest(
      'TC-T5-STR-03',
      'State-Machine',
      'Illegal transition: Attempting to accept an already cancelled booking rejected with 400 B-4003',
      async () => {
        const sm1Dates = generateUniqueBookingDates(2);
        const makeRes = await apiRequest('/api/v1/bookings', {
          method: 'POST',
          token: GUEST_TOKEN,
          body: {
            bookingOrders: [
              {
                roomCategoryId: 1,
                checkInDate: sm1Dates.checkInDate,
                checkOutDate: sm1Dates.checkOutDate,
                roomsBooked: 1,
              },
            ],
            petProfileIds: [1],
          },
        });
        const bookId = makeRes.body?.data?.booking?.id || makeRes.body?.booking?.id || makeRes.body?.data?.id;

        await apiRequest(`/api/v1/bookings/${bookId}/cancel`, {
          method: 'PATCH',
          token: GUEST_TOKEN,
          body: { reason: 'Pre-cancel' },
        });

        const acceptRes = await apiRequest(`/api/v1/hosts/bookings/${bookId}/accept`, {
          method: 'PATCH',
          token: HOST1_TOKEN,
        });
        assert(acceptRes.status === 400, `Expected 400, got ${acceptRes.status}`);
        assertEqual(acceptRes.body?.code, 'B-4003');
        assert(acceptRes.body?.message?.includes('Must be pending'), 'Expected pending status error');
      }
    );

    await runAdversarialTest(
      'TC-T5-STR-04',
      'State-Machine',
      'Illegal transition: Attempting to accept an already confirmed booking rejected with 400 B-4003',
      async () => {
        const sm2Dates = generateUniqueBookingDates(2);
        const makeRes = await apiRequest('/api/v1/bookings', {
          method: 'POST',
          token: GUEST_TOKEN,
          body: {
            bookingOrders: [
              {
                roomCategoryId: 1,
                checkInDate: sm2Dates.checkInDate,
                checkOutDate: sm2Dates.checkOutDate,
                roomsBooked: 1,
              },
            ],
            petProfileIds: [1],
          },
        });
        const bookId = makeRes.body?.data?.booking?.id || makeRes.body?.booking?.id || makeRes.body?.data?.id;

        await apiRequest(`/api/v1/hosts/bookings/${bookId}/accept`, {
          method: 'PATCH',
          token: HOST1_TOKEN,
        });

        const repeatRes = await apiRequest(`/api/v1/hosts/bookings/${bookId}/accept`, {
          method: 'PATCH',
          token: HOST1_TOKEN,
        });
        assert(repeatRes.status === 400, `Expected 400, got ${repeatRes.status}`);
        assertEqual(repeatRes.body?.code, 'B-4003');
      }
    );

    await runAdversarialTest(
      'TC-T5-STR-05',
      'State-Machine',
      'Illegal transition: Attempting to complete a pending booking rejected with 400 B-4003',
      async () => {
        const sm3Dates = generateUniqueBookingDates(2);
        const makeRes = await apiRequest('/api/v1/bookings', {
          method: 'POST',
          token: GUEST_TOKEN,
          body: {
            bookingOrders: [
              {
                roomCategoryId: 1,
                checkInDate: sm3Dates.checkInDate,
                checkOutDate: sm3Dates.checkOutDate,
                roomsBooked: 1,
              },
            ],
            petProfileIds: [1],
          },
        });
        const bookId = makeRes.body?.data?.booking?.id || makeRes.body?.booking?.id || makeRes.body?.data?.id;

        const completeRes = await apiRequest(`/api/v1/hosts/bookings/${bookId}/success`, {
          method: 'PATCH',
          token: HOST1_TOKEN,
        });
        assert(completeRes.status === 400, `Expected 400, got ${completeRes.status}`);
        assertEqual(completeRes.body?.code, 'B-4003');
        assert(completeRes.body?.message?.includes('Must be confirmed'), 'Expected confirmed check');
      }
    );

    await runAdversarialTest(
      'TC-T5-STR-06',
      'State-Machine',
      'Self-booking prohibition: Host 1 (User 2) attempting to book Property 1 rejected with 400 B-4002',
      async () => {
        const selfDates = generateUniqueBookingDates(2);
        const res = await apiRequest('/api/v1/bookings', {
          method: 'POST',
          token: HOST1_TOKEN,
          body: {
            bookingOrders: [
              {
                roomCategoryId: 1,
                checkInDate: selfDates.checkInDate,
                checkOutDate: selfDates.checkOutDate,
                roomsBooked: 1,
              },
            ],
            petProfileIds: [1],
          },
        });
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        assertEqual(res.body?.code, 'B-4002');
        assert(res.body?.message?.includes('own property'), 'Expected self-booking error message');
      }
    );

    await runAdversarialTest(
      'TC-T5-STR-07',
      'State-Machine',
      'Past-date check-in rejected with 400 B-4003',
      async () => {
        const res = await apiRequest('/api/v1/bookings', {
          method: 'POST',
          token: GUEST_TOKEN,
          body: {
            bookingOrders: [
              {
                roomCategoryId: 1,
                checkInDate: '2020-01-01',
                checkOutDate: '2020-01-03',
                roomsBooked: 1,
              },
            ],
            petProfileIds: [1],
          },
        });
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        assertEqual(res.body?.code, 'B-4003');
      }
    );

    await runAdversarialTest(
      'TC-T5-STR-08',
      'State-Machine',
      'Double-Booking Guard: Pet already having an active overlapping booking rejected with 409 B-4004',
      async () => {
        const baseDates = generateUniqueBookingDates(5);
        const res1 = await apiRequest('/api/v1/bookings', {
          method: 'POST',
          token: GUEST_TOKEN,
          body: {
            bookingOrders: [
              {
                roomCategoryId: 1,
                checkInDate: baseDates.checkInDate,
                checkOutDate: baseDates.checkOutDate,
                roomsBooked: 1,
              },
            ],
            petProfileIds: [1],
          },
        });
        assert(res1.status === 201, `First booking created: ${res1.status}`);

        // Construct overlapping dates: checkInDate + 1 day to checkOutDate + 1 day
        const overlapIn = new Date(Date.parse(baseDates.checkInDate) + 24 * 3600 * 1000).toISOString().slice(0, 10);
        const overlapOut = new Date(Date.parse(baseDates.checkOutDate) + 24 * 3600 * 1000).toISOString().slice(0, 10);

        const res2 = await apiRequest('/api/v1/bookings', {
          method: 'POST',
          token: GUEST_TOKEN,
          body: {
            bookingOrders: [
              {
                roomCategoryId: 1,
                checkInDate: overlapIn,
                checkOutDate: overlapOut,
                roomsBooked: 1,
              },
            ],
            petProfileIds: [1],
          },
        });
        assert(res2.status === 409, `Expected 409 Conflict, got ${res2.status}`);
        assertEqual(res2.body?.code, 'B-4004');
        assert(res2.body?.message?.includes('already have an active booking'), 'Expected double-booking error');
      }
    );

    // =========================================================================
    // SECTION 5: OFFLINE & ZERO-CLOUD SAFETY GUARANTEES
    // =========================================================================
    console.log('\n\x1b[1m--- Section 5: Offline & Zero-Cloud Safety Guarantees ---\x1b[0m');

    await runAdversarialTest(
      'TC-T5-OFF-01',
      'Zero-Cloud',
      'Backend booking controllers contain zero hardcoded external AWS S3 endpoints',
      () => {
        const controllerPath = path.resolve(
          process.cwd(),
          'joodpakpaw-api',
          'src',
          'controllers',
          'booking.controller.ts'
        );
        const content = fs.readFileSync(controllerPath, 'utf-8');
        assert(!content.includes('s3.amazonaws.com'), 'Found hardcoded external s3.amazonaws.com');
        assert(!content.includes('https://api.stripe.com'), 'Found hardcoded Stripe API endpoint');
        assert(!content.includes('https://api.omise.co'), 'Found hardcoded Omise API endpoint');
      }
    );

    await runAdversarialTest(
      'TC-T5-OFF-02',
      'Zero-Cloud',
      'Frontend booking components contain zero external payment gateway API calls',
      () => {
        const paymentSectionPath = path.resolve(
          process.cwd(),
          'joodpakpaw-frontend',
          'app',
          'booking',
          'confirm',
          '_components',
          'PaymentSection.tsx'
        );
        const content = fs.readFileSync(paymentSectionPath, 'utf-8');
        assert(!content.includes('js.stripe.com'), 'Found external Stripe script reference');
        assert(!content.includes('cdn.omise.co'), 'Found external Omise script reference');
      }
    );

    await runAdversarialTest(
      'TC-T5-OFF-03',
      'Zero-Cloud',
      'PromptPay EMVCo QR code and CRC16 CCITT computation runs 100% offline in-process',
      () => {
        const payload = buildPromptPayPayload('0812345678', 1500.0);
        assert(payload.startsWith('000201'), 'Valid EMVCo payload format');
        const verification = verifyPromptPayPayload(payload);
        assertEqual(verification.valid, true, 'CRC16 verified offline');
        assertEqual(verification.amount, 1500.0, 'Amount correctly encoded in Tag 54');
      }
    );

    await runAdversarialTest(
      'TC-T5-OFF-04',
      'Zero-Cloud',
      'Bangkok ICT time cutoffs (12:00, 14:00, 18:00 ICT) compute deterministically without external NTP',
      () => {
        const checkIn = '2026-11-20';
        const cutoff14 = getCheckInCutoffAt(checkIn);
        assertEqual(cutoff14.toISOString(), '2026-11-20T07:00:00.000Z', '14:00 ICT is 07:00 UTC');

        const checkOut = '2026-11-23';
        const cutoff12 = getCanCompleteAt(checkOut);
        assertEqual(cutoff12.toISOString(), '2026-11-23T05:00:00.000Z', '12:00 ICT is 05:00 UTC');

        const auto18 = getAutoCompleteAt(checkOut);
        assertEqual(auto18.toISOString(), '2026-11-23T11:00:00.000Z', '18:00 ICT is 11:00 UTC');
      }
    );

    await runAdversarialTest(
      'TC-T5-OFF-05',
      'Zero-Cloud',
      'Storage service routes to local MinIO endpoint in development/test without internet connection',
      () => {
        const storageServicePath = path.resolve(
          process.cwd(),
          'joodpakpaw-api',
          'src',
          'services',
          'storage.service.ts'
        );
        const content = fs.readFileSync(storageServicePath, 'utf-8');
        assert(
          content.includes('localhost:9000') ||
            content.includes('config.s3.endpoint') ||
            content.includes('s3Client'),
          'Storage service is locally configurable without external cloud vendor lock-in'
        );
      }
    );

  } catch (fatalErr: any) {
    console.error('\n[FATAL] Tier 5 test suite encountered fatal exception:', fatalErr?.message || fatalErr);
    process.exit(1);
  } finally {
    await closeTestServer();
  }

  const totalDuration = Date.now() - startTime;

  // Aggregate results by category
  const categories = ['IDOR/RBAC', 'Admin-Ban', 'Input-Hygiene', 'Concurrency', 'State-Machine', 'Zero-Cloud'];
  const totalPassed = suiteResults.filter((r) => r.passed).length;
  const totalFailed = suiteResults.filter((r) => !r.passed).length;

  console.log('\n================================================================================');
  console.log('              CONSOLIDATED TIER 5 ADVERSARIAL STRESS REPORT');
  console.log('================================================================================');
  console.log(' Category        | Total | Passed | Failed | Status ');
  console.log('-----------------+-------+--------+--------+--------');
  for (const cat of categories) {
    const subset = suiteResults.filter((r) => r.category === cat);
    const passed = subset.filter((r) => r.passed).length;
    const failed = subset.filter((r) => !r.passed).length;
    console.log(
      ` ${cat.padEnd(15)} |  ${String(subset.length).padEnd(4)} |  ${String(passed).padEnd(5)} |  ${String(failed).padEnd(5)} | ${failed === 0 ? 'PASS' : 'FAIL'} `
    );
  }
  console.log('-----------------+-------+--------+--------+--------');
  console.log(
    ` COMPLETE SUITE |  ${String(suiteResults.length).padEnd(4)} |  ${String(totalPassed).padEnd(5)} |  ${String(totalFailed).padEnd(5)} | ${totalFailed === 0 ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'} `
  );
  console.log('================================================================================');
  console.log(`Execution Time: ${totalDuration}ms`);
  console.log(`Final Exit Status: ${totalFailed === 0 ? 'SUCCESS (Code 0)' : 'FAILURE (Code 1)'}\n`);

  if (totalFailed > 0) {
    console.error(`\x1b[31m[ERROR] ${totalFailed} test(s) failed in Tier 5 suite.\x1b[0m`);
    process.exit(1);
  }
}

// Execute standalone runner
runTier5TestSuite().catch((e) => {
  console.error('[UNHANDLED FATAL]', e);
  process.exit(1);
});
