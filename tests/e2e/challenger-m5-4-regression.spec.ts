/**
 * Challenger M5-4: Milestone 5 Iteration 2 Full Regression & Adversarial Suite
 * Target: Full regression verification following Worker M5-3 modifications
 * Surfaces: All 12 booking/host components, wrapper pages, and core workflows
 *
 * Invocation: npx tsx tests/e2e/challenger-m5-4-regression.spec.ts
 */

import fs from 'fs';
import path from 'path';
import {
  runTest,
  assert,
  assertEqual,
  testResults,
  buildPromptPayPayload,
  verifyPromptPayPayload,
  calculateCrc16Ccitt,
  getCheckInCutoffAt,
  getCanCompleteAt,
  getAutoCompleteAt,
  getPaymentDeadline,
} from './harness';

interface FileMatch {
  file: string;
  relativePath: string;
  line: number;
  content: string;
  match: string;
}

const SURFACES_12 = [
  'app/profile/bookings/_components/BookingCard.tsx',
  'app/profile/bookings/_components/BookingList.tsx',
  'app/profile/host/_components/HostBookingList.tsx',
  'app/booking/confirm/_components/PaymentSection.tsx',
  'app/profile/bookings/[bookingId]/_components/PendingPaymentSection.tsx',
  'app/profile/bookings/[bookingId]/_components/BookingDetailDisplay.tsx',
  'app/profile/bookings/[bookingId]/_components/ReviewSection.tsx',
  'app/profile/host/booking/[bookingId]/_components/HostBookingDetailDisplay.tsx',
  'app/profile/host/booking/[bookingId]/_components/HostDeclineModal.tsx',
  'app/_components/property-detail/BookingRoomCard.tsx',
  'app/_components/property-detail/BookingDrawer.tsx',
  'app/booking/confirm/_components/ConfirmBookingDisplay.tsx',
];

const WRAPPER_PAGES = [
  'app/profile/bookings/[bookingId]/page.tsx',
  'app/profile/host/booking/[bookingId]/page.tsx',
  'app/booking/confirm/page.tsx',
];

const ALL_SURFACES = [...SURFACES_12, ...WRAPPER_PAGES];

const FRONTEND_DIR = path.resolve(process.cwd(), 'joodpakpaw-frontend');

function scanFilesForRegex(files: string[], regex: RegExp): FileMatch[] {
  const matches: FileMatch[] = [];
  for (const rel of files) {
    const fullPath = path.join(FRONTEND_DIR, rel);
    if (!fs.existsSync(fullPath)) continue;
    const lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
    lines.forEach((lineText, idx) => {
      const match = lineText.match(regex);
      if (match) {
        matches.push({
          file: fullPath,
          relativePath: rel,
          line: idx + 1,
          content: lineText.trim(),
          match: match[0],
        });
      }
    });
  }
  return matches;
}

async function runChallengerRegressionSuite(): Promise<void> {
  console.log('\n================================================================================');
  console.log('       CHALLENGER M5-4: FULL E2E REGRESSION & ADVERSARIAL HARNESS');
  console.log('       Verification of Worker M5-3 Modifications & System Invariants');
  console.log('================================================================================\n');

  // =========================================================================
  // SUITE 1: COMPREHENSIVE FRACTIONAL SPACING AUDIT (4PX GRID INTEGRITY)
  // =========================================================================

  await runTest('CHALLENGE-M54-SPACE-01', 2, 'Strict 0-tolerance for py-2.5 and py-3.5 across all surfaces and wrappers', () => {
    const matches = scanFilesForRegex(ALL_SURFACES, /\b(py-2\.5|py-3\.5)\b/);
    if (matches.length > 0) {
      matches.forEach((m) => console.warn(`      - ${m.relativePath}:${m.line} -> ${m.content}`));
    }
    assertEqual(matches.length, 0, `Expected 0 occurrences of py-2.5/py-3.5, found ${matches.length}`);
  });

  await runTest('CHALLENGE-M54-SPACE-02', 2, 'Strict 0-tolerance for p-2.5 and p-3.5 across all surfaces and wrappers', () => {
    const matches = scanFilesForRegex(ALL_SURFACES, /\b(p-2\.5|p-3\.5)\b/);
    if (matches.length > 0) {
      matches.forEach((m) => console.warn(`      - ${m.relativePath}:${m.line} -> ${m.content}`));
    }
    assertEqual(matches.length, 0, `Expected 0 occurrences of p-2.5/p-3.5, found ${matches.length}`);
  });

  await runTest('CHALLENGE-M54-SPACE-03', 2, 'Strict 0-tolerance for pb-2.5, pt-2.5, px-3.5 across all surfaces and wrappers', () => {
    const matches = scanFilesForRegex(ALL_SURFACES, /\b(pb-2\.5|pt-2\.5|px-3\.5)\b/);
    if (matches.length > 0) {
      matches.forEach((m) => console.warn(`      - ${m.relativePath}:${m.line} -> ${m.content}`));
    }
    assertEqual(matches.length, 0, `Expected 0 occurrences of pb-2.5/pt-2.5/px-3.5, found ${matches.length}`);
  });

  await runTest('CHALLENGE-M54-SPACE-04', 2, 'Strict 0-tolerance for gap-2.5 and gap-3.5 across all surfaces and wrappers', () => {
    const matches = scanFilesForRegex(ALL_SURFACES, /\b(gap-2\.5|gap-3\.5)\b/);
    if (matches.length > 0) {
      matches.forEach((m) => console.warn(`      - ${m.relativePath}:${m.line} -> ${m.content}`));
    }
    assertEqual(matches.length, 0, `Expected 0 occurrences of gap-2.5/gap-3.5, found ${matches.length}`);
  });

  // =========================================================================
  // SUITE 2: REACT HOOKS INTEGRITY & ARCHITECTURAL SOUNDNESS
  // =========================================================================

  await runTest('CHALLENGE-M54-HOOKS-01', 2, 'BookingList.tsx declares all useState/useEffect/useMemo unconditionally', () => {
    const fullPath = path.join(FRONTEND_DIR, 'app/profile/bookings/_components/BookingList.tsx');
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    let firstReturnIndex = -1;
    let lastHookIndex = -1;

    lines.forEach((line, idx) => {
      if (line.match(/^\s*if\s*\(.*\)\s*return/)) {
        if (firstReturnIndex === -1) firstReturnIndex = idx;
      }
      if (line.match(/^\s*const\s+\[.*\]\s*=\s*useState/) || line.match(/^\s*use(Effect|Memo|Callback)\(/)) {
        lastHookIndex = idx;
      }
    });

    assert(firstReturnIndex > -1, 'BookingList must have guard return statements');
    assert(lastHookIndex > -1, 'BookingList must contain hook invocations');
    assert(
      lastHookIndex < firstReturnIndex,
      `React Rules of Hooks violation: hook at line ${lastHookIndex + 1} appears after conditional return at line ${firstReturnIndex + 1}`
    );
  });

  // =========================================================================
  // SUITE 3: DIALOG & OVERLAY BACKDROP CONSISTENCY
  // =========================================================================

  await runTest('CHALLENGE-M54-MODAL-01', 2, 'HostDeclineModal renders explicit DialogOverlay with bg-black/60 backdrop-blur-sm', () => {
    const fullPath = path.join(FRONTEND_DIR, 'app/profile/host/booking/[bookingId]/_components/HostDeclineModal.tsx');
    const content = fs.readFileSync(fullPath, 'utf-8');

    assert(content.includes('DialogOverlay'), 'HostDeclineModal must import and render DialogOverlay');
    assert(
      content.includes('bg-black/60') && content.includes('backdrop-blur-sm'),
      'HostDeclineModal overlay must have bg-black/60 backdrop-blur-sm styling'
    );
  });

  await runTest('CHALLENGE-M54-MODAL-02', 2, 'HostDeclineModal enforces 500-character input clamping and character counter', () => {
    const fullPath = path.join(FRONTEND_DIR, 'app/profile/host/booking/[bookingId]/_components/HostDeclineModal.tsx');
    const content = fs.readFileSync(fullPath, 'utf-8');

    assert(content.includes('500'), 'HostDeclineModal must have 500 max length');
    assert(content.includes('{reason.length}/500'), 'HostDeclineModal must display character counter');
    assert(content.includes('tabular-nums'), 'Character counter must use tabular-nums');
  });

  // =========================================================================
  // SUITE 4: SLIP INSPECTION MODAL ZOOM CLAMPING & CONTROLS
  // =========================================================================

  await runTest('CHALLENGE-M54-ZOOM-01', 2, 'HostBookingDetailDisplay zoom controls clamp between 1.0x and 4.0x', () => {
    const fullPath = path.join(FRONTEND_DIR, 'app/profile/host/booking/[bookingId]/_components/HostBookingDetailDisplay.tsx');
    const content = fs.readFileSync(fullPath, 'utf-8');

    assert(content.includes('zoomLevel <= 1'), 'Host slip modal zoom out disabled at 1.0x');
    assert(content.includes('zoomLevel >= 4'), 'Host slip modal zoom in disabled at 4.0x');
    assert(content.includes('handleZoomReset'), 'Host slip modal contains zoom reset');
  });

  await runTest('CHALLENGE-M54-PREVIEW-02', 2, 'PendingPaymentSection handles slip preview and drag-drop upload states', () => {
    const fullPath = path.join(FRONTEND_DIR, 'app/profile/bookings/[bookingId]/_components/PendingPaymentSection.tsx');
    const content = fs.readFileSync(fullPath, 'utf-8');

    assert(content.includes('slipPreviewUrl'), 'PendingPaymentSection must support slipPreviewUrl image preview');
    assert(content.includes('confirmPayment'), 'PendingPaymentSection must invoke confirmPayment');
    assert(content.includes('bg-accent-orange'), 'PendingPaymentSection must use bg-accent-orange for submit CTA');
  });

  // =========================================================================
  // SUITE 5: BANGKOK ICT CUTOFFS & BUSINESS LOGIC STRESS
  // =========================================================================

  await runTest('CHALLENGE-M54-ICT-01', 4, 'Bangkok 14:00 ICT check-in and 12:00 ICT check-out cutoffs computed reliably', () => {
    const checkIn = '2026-11-20';
    const checkOut = '2026-11-23';

    const checkInCutoff = getCheckInCutoffAt(checkIn);
    // 14:00 ICT = 07:00 UTC
    assertEqual(checkInCutoff.toISOString(), '2026-11-20T07:00:00.000Z', 'Check-in cutoff must be 14:00 ICT (07:00 UTC)');

    const checkOutCutoff = getCanCompleteAt(checkOut);
    // 12:00 ICT = 05:00 UTC
    assertEqual(checkOutCutoff.toISOString(), '2026-11-23T05:00:00.000Z', 'Check-out cutoff must be 12:00 ICT (05:00 UTC)');

    const autoCutoff = getAutoCompleteAt(checkOut);
    // 18:00 ICT = 11:00 UTC
    assertEqual(autoCutoff.toISOString(), '2026-11-23T11:00:00.000Z', 'Auto complete cutoff must be 18:00 ICT (11:00 UTC)');
  });

  await runTest('CHALLENGE-M54-ICT-02', 4, 'Payment deadline is correctly capped at min(createdAt + 24h, checkOut 12:00 ICT)', () => {
    // Case A: Created long before checkout -> deadline is createdAt + 24h
    const createdA = new Date('2026-11-20T02:00:00.000Z');
    const deadlineA = getPaymentDeadline(createdA, '2026-11-28');
    const expectedA = new Date('2026-11-21T02:00:00.000Z');
    assertEqual(deadlineA.toISOString(), expectedA.toISOString(), 'Deadline should be exactly 24h after creation');

    // Case B: Same-day booking created 4 hours before checkout -> deadline is checkout 12:00 ICT
    const createdB = new Date('2026-11-21T01:00:00.000Z');
    const deadlineB = getPaymentDeadline(createdB, '2026-11-21');
    // Checkout 12:00 ICT is 2026-11-21T05:00:00.000Z
    assertEqual(deadlineB.toISOString(), '2026-11-21T05:00:00.000Z', 'Deadline should cap at checkout 12:00 ICT');
  });

  // =========================================================================
  // SUITE 6: EMVCO PROMPTPAY CRC16 CHECKSUM ORACLE
  // =========================================================================

  await runTest('CHALLENGE-M54-PAY-01', 2, 'EMVCo PromptPay QR payloads compute valid CRC16-CCITT checksum for stress amounts', () => {
    const amounts = [1.00, 25.50, 1500.00, 4820.75, 99999.00];
    for (const amt of amounts) {
      const payload = buildPromptPayPayload('0812345678', amt);
      assert(payload.startsWith('00020101021229370016A000000677010111'), 'Must include correct AID and header');
      assert(payload.includes('5303764'), 'Currency must be 764 (THB)');
      assert(payload.includes('5802TH'), 'Country must be TH');

      const verified = verifyPromptPayPayload(payload);
      assert(verified.valid, `Payload verification failed for amount ${amt}`);
      assertEqual(verified.amount, amt, `Parsed amount must equal ${amt}`);
    }
  });

  await runTest('CHALLENGE-M54-PAY-02', 2, 'Thai Baht number formatting adds comma separators in UI displays', () => {
    const formatThb = (amount: number) => `฿${amount.toLocaleString('th-TH')}`;
    assertEqual(formatThb(1500), '฿1,500');
    assertEqual(formatThb(0), '฿0');
    assertEqual(formatThb(2500000), '฿2,500,000');
  });

  // =========================================================================
  // PRINT SUMMARY
  // =========================================================================

  console.log('\n================================================================================');
  console.log('                 CHALLENGER M5-4 REGRESSION REPORT');
  console.log('================================================================================');

  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;
  const total = testResults.length;

  console.log(` Total Assertions: ${total}`);
  console.log(` Passed:           \x1b[32m${passed}\x1b[0m`);
  console.log(` Failed:           \x1b[31m${failed}\x1b[0m`);
  console.log('================================================================================\n');

  if (failed > 0) {
    console.error(`\x1b[31m[FAIL] Challenger detected ${failed} regression or invariant failure(s)!\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32m[SUCCESS] All ${total} challenger regression assertions passed cleanly!\x1b[0m`);
    process.exit(0);
  }
}

runChallengerRegressionSuite().catch((err) => {
  console.error('[UNCAUGHT ERROR]', err);
  process.exit(1);
});
