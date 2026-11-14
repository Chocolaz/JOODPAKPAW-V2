/**
 * Challenger M5-2 Empirical Stress & Adversarial Test Suite
 * Target: Milestone 5: CI Design Tokens & /unslop Audit
 * Surfaces: 12 assigned booking and checkout components
 *
 * Invocation: npx tsx tests/e2e/challenger-m5-2-stress.spec.ts
 */

import fs from 'fs';
import path from 'path';
import {
  runTest,
  assert,
  assertEqual,
  testResults,
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

async function runChallengerStressSuite(): Promise<void> {
  console.log('\n================================================================================');
  console.log('       CHALLENGER M5-2: EMPIRICAL STRESS & ADVERSARIAL HARNESS');
  console.log('       Target: CI Design Tokens & /unslop Craft Audit (12 Surfaces)');
  console.log('================================================================================\n');

  // =========================================================================
  // SUITE 1: SPACING RHYTHM & 4PX GRID INVARIANTS
  // =========================================================================

  await runTest('CHALLENGE-M5-SPACE-01', 2, 'Spacing half-steps audit: py-2.5 across all 12 surfaces', () => {
    const matches = scanFilesForRegex(SURFACES_12, /\bpy-2\.5\b/);
    if (matches.length > 0) {
      console.warn(`    [WARN] Found ${matches.length} occurrences of py-2.5:`);
      matches.forEach((m) => console.warn(`      - ${m.relativePath}:${m.line} -> ${m.content}`));
    }
    assertEqual(matches.length, 0, `Expected 0 occurrences of py-2.5, found ${matches.length}`);
  });

  await runTest('CHALLENGE-M5-SPACE-02', 2, 'Spacing half-steps audit: p-3.5, py-3.5, px-3.5 across all 12 surfaces', () => {
    const matches = scanFilesForRegex(SURFACES_12, /\b(p-3\.5|py-3\.5|px-3\.5)\b/);
    if (matches.length > 0) {
      console.warn(`    [WARN] Found ${matches.length} occurrences of p-3.5/py-3.5/px-3.5:`);
      matches.forEach((m) => console.warn(`      - ${m.relativePath}:${m.line} -> ${m.content}`));
    }
    assertEqual(matches.length, 0, `Expected 0 occurrences of p-3.5/py-3.5/px-3.5, found ${matches.length}`);
  });

  await runTest('CHALLENGE-M5-SPACE-03', 2, 'Spacing half-steps audit: p-2.5 and pb-2.5 across all 12 surfaces', () => {
    const matches = scanFilesForRegex(SURFACES_12, /\b(p-2\.5|pb-2\.5|pt-2\.5)\b/);
    if (matches.length > 0) {
      console.warn(`    [WARN] Found ${matches.length} occurrences of p-2.5/pb-2.5/pt-2.5:`);
      matches.forEach((m) => console.warn(`      - ${m.relativePath}:${m.line} -> ${m.content}`));
    }
    assertEqual(matches.length, 0, `Expected 0 occurrences of p-2.5/pb-2.5/pt-2.5, found ${matches.length}`);
  });

  await runTest('CHALLENGE-M5-SPACE-04', 2, 'Spacing half-steps audit: gap-2.5 and gap-3.5 across all 12 surfaces', () => {
    const matches = scanFilesForRegex(SURFACES_12, /\b(gap-2\.5|gap-3\.5)\b/);
    if (matches.length > 0) {
      console.warn(`    [WARN] Found ${matches.length} occurrences of gap-2.5/gap-3.5:`);
      matches.forEach((m) => console.warn(`      - ${m.relativePath}:${m.line} -> ${m.content}`));
    }
    assertEqual(matches.length, 0, `Expected 0 occurrences of gap-2.5/gap-3.5, found ${matches.length}`);
  });

  await runTest('CHALLENGE-M5-SPACE-05', 2, 'Booking detail page skeleton half-step audit: p-3.5 in page wrappers', () => {
    const matches = scanFilesForRegex(WRAPPER_PAGES, /\bp-3\.5\b/);
    if (matches.length > 0) {
      console.warn(`    [WARN] Found ${matches.length} occurrences of p-3.5 in wrapper pages:`);
      matches.forEach((m) => console.warn(`      - ${m.relativePath}:${m.line} -> ${m.content}`));
    }
    assertEqual(matches.length, 0, `Expected 0 occurrences of p-3.5 in page wrapper skeletons, found ${matches.length}`);
  });

  // =========================================================================
  // SUITE 2: CONTAINER WIDTH & OVERFLOW INVARIANTS
  // =========================================================================

  await runTest('CHALLENGE-M5-WIDTH-01', 2, 'Single-column container widths strictly cap at max-w-[560px]', () => {
    const singleColumnSurfaces = [
      'app/booking/confirm/_components/ConfirmBookingDisplay.tsx',
      'app/booking/confirm/_components/PaymentSection.tsx',
      'app/profile/bookings/[bookingId]/_components/BookingDetailDisplay.tsx',
      'app/profile/host/booking/[bookingId]/_components/HostBookingDetailDisplay.tsx',
      'app/profile/bookings/_components/BookingList.tsx',
    ];

    for (const rel of singleColumnSurfaces) {
      const fullPath = path.join(FRONTEND_DIR, rel);
      const content = fs.readFileSync(fullPath, 'utf-8');
      assert(content.includes('max-w-[560px]'), `${rel} must contain max-w-[560px] container constraint`);
    }
  });

  await runTest('CHALLENGE-M5-WIDTH-02', 2, 'Single-column containers avoid unconstrained max-w-2xl or max-w-3xl expansion', () => {
    const singleColumnComponents = [
      'app/booking/confirm/_components/ConfirmBookingDisplay.tsx',
      'app/booking/confirm/_components/PaymentSection.tsx',
      'app/profile/bookings/[bookingId]/_components/BookingDetailDisplay.tsx',
    ];

    const matches = scanFilesForRegex(singleColumnComponents, /\b(max-w-2xl|max-w-3xl|max-w-4xl|max-w-5xl)\b/);
    assertEqual(matches.length, 0, `Single-column booking confirmation/detail must not use expanded max-w-2xl..5xl`);
  });

  await runTest('CHALLENGE-M5-WIDTH-03', 2, 'BookingDrawer container width boundary check', () => {
    const drawerPath = path.join(FRONTEND_DIR, 'app/_components/property-detail/BookingDrawer.tsx');
    const content = fs.readFileSync(drawerPath, 'utf-8');
    // Check drawer content width constraint
    assert(content.includes('max-w-2xl') || content.includes('max-w-[560px]'), 'BookingDrawer should have an explicit max width');
  });

  // =========================================================================
  // SUITE 3: QUIET CHROME & MOTION INVARIANTS
  // =========================================================================

  await runTest('CHALLENGE-M5-CHROME-01', 2, 'Zero shadow-xl or shadow-2xl on cards across all 12 surfaces', () => {
    const matches = scanFilesForRegex(SURFACES_12, /\b(shadow-xl|shadow-2xl)\b/);
    assertEqual(matches.length, 0, `Expected 0 shadow-xl/shadow-2xl across all surfaces, found ${matches.length}`);
  });

  await runTest('CHALLENGE-M5-CHROME-02', 2, 'Zero shadow-lg or shadow-md on content cards across all 12 surfaces', () => {
    const matches = scanFilesForRegex(SURFACES_12, /\b(shadow-lg|shadow-md)\b/);
    assertEqual(matches.length, 0, `Expected 0 shadow-lg/shadow-md across all surfaces, found ${matches.length}`);
  });

  await runTest('CHALLENGE-M5-CHROME-03', 2, 'Dialog backdrops use bg-black/60 backdrop-blur-sm across booking dialogs', () => {
    const dialogFiles = [
      'app/booking/confirm/_components/PaymentSection.tsx',
      'app/profile/bookings/[bookingId]/_components/PendingPaymentSection.tsx',
      'app/profile/bookings/[bookingId]/_components/BookingDetailDisplay.tsx',
      'app/profile/host/booking/[bookingId]/_components/HostBookingDetailDisplay.tsx',
    ];

    for (const rel of dialogFiles) {
      const fullPath = path.join(FRONTEND_DIR, rel);
      const content = fs.readFileSync(fullPath, 'utf-8');
      assert(
        content.includes('bg-black/60') && content.includes('backdrop-blur-sm'),
        `${rel} dialog backdrop must use bg-black/60 backdrop-blur-sm`
      );
    }
  });

  await runTest('CHALLENGE-M5-CHROME-04', 2, 'HostDeclineModal backdrop audit: checks if backdrop uses bg-black/60 backdrop-blur-sm', () => {
    const declineModalPath = path.join(FRONTEND_DIR, 'app/profile/host/booking/[bookingId]/_components/HostDeclineModal.tsx');
    const content = fs.readFileSync(declineModalPath, 'utf-8');
    const hasBackdropToken = content.includes('bg-black/60') && content.includes('backdrop-blur-sm');
    if (!hasBackdropToken) {
      console.warn('    [WARN] HostDeclineModal delegates to Dialog without custom bg-black/60 backdrop-blur-sm overlay.');
    }
    assert(hasBackdropToken, 'HostDeclineModal dialog backdrop should specify bg-black/60 backdrop-blur-sm');
  });

  await runTest('CHALLENGE-M5-MOTION-01', 2, 'Zero bouncy scale transforms (hover:scale or active:scale) across all 12 surfaces', () => {
    const matches = scanFilesForRegex(SURFACES_12, /\b(hover:scale-\d+|active:scale-\d+|hover:scale-\[|active:scale-\[)\b/);
    assertEqual(matches.length, 0, `Expected 0 hover:scale or active:scale transforms, found ${matches.length}`);
  });

  // =========================================================================
  // SUITE 4: TYPOGRAPHY, ANTI-SLOP & DESIGN SYSTEM TOKENS
  // =========================================================================

  await runTest('CHALLENGE-M5-SLOP-01', 2, 'Zero shouting uppercase tracking labels across all 12 surfaces', () => {
    const matches = scanFilesForRegex(SURFACES_12, /\buppercase\b/);
    assertEqual(matches.length, 0, `Expected 0 uppercase classes across all 12 surfaces, found ${matches.length}`);
  });

  await runTest('CHALLENGE-M5-SLOP-02', 2, 'Zero tracking-wider or tracking-widest classes across all 12 surfaces', () => {
    const matches = scanFilesForRegex(SURFACES_12, /\b(tracking-wider|tracking-widest|tracking-wide)\b/);
    assertEqual(matches.length, 0, `Expected 0 tracking-wide/wider/widest classes, found ${matches.length}`);
  });

  await runTest('CHALLENGE-M5-SLOP-03', 2, 'Zero multi-hue gradients on card surfaces across all 12 surfaces', () => {
    const matches = scanFilesForRegex(SURFACES_12, /\bbg-gradient-to-\b/);
    assertEqual(matches.length, 0, `Expected 0 bg-gradient-to-* across all surfaces, found ${matches.length}`);
  });

  await runTest('CHALLENGE-M5-TOKEN-01', 2, 'Harmonized status badge token consistency across Guest and Host components', () => {
    // 1. BookingCard.tsx
    const cardPath = path.join(FRONTEND_DIR, 'app/profile/bookings/_components/BookingCard.tsx');
    const cardContent = fs.readFileSync(cardPath, 'utf-8');
    assert(cardContent.includes('bg-deep-teal/10 text-deep-teal border border-deep-teal/20'), 'BookingCard CONFIRMED token');
    assert(cardContent.includes('bg-amber-50 text-amber-800 border border-amber-200'), 'BookingCard PENDING token');
    assert(cardContent.includes('bg-positive-green/10 text-positive-green border border-positive-green/20'), 'BookingCard SUCCESSFUL token');
    assert(cardContent.includes('bg-red-50 text-red-700 border border-red-200'), 'BookingCard CANCELLED token');

    // 2. BookingDetailDisplay.tsx
    const detailPath = path.join(FRONTEND_DIR, 'app/profile/bookings/[bookingId]/_components/BookingDetailDisplay.tsx');
    const detailContent = fs.readFileSync(detailPath, 'utf-8');
    assert(detailContent.includes('text-deep-teal') && detailContent.includes('bg-deep-teal/10'), 'BookingDetail CONFIRMED token');
    assert(detailContent.includes('text-amber-800') && detailContent.includes('bg-amber-50'), 'BookingDetail PENDING token');
    assert(detailContent.includes('text-positive-green') && detailContent.includes('bg-positive-green/10'), 'BookingDetail SUCCESSFUL token');
    assert(detailContent.includes('text-red-700') && detailContent.includes('bg-red-50'), 'BookingDetail CANCELLED token');

    // 3. HostBookingDetailDisplay.tsx
    const hostDetailPath = path.join(FRONTEND_DIR, 'app/profile/host/booking/[bookingId]/_components/HostBookingDetailDisplay.tsx');
    const hostDetailContent = fs.readFileSync(hostDetailPath, 'utf-8');
    assert(hostDetailContent.includes('text-deep-teal') && hostDetailContent.includes('bg-deep-teal/10'), 'HostDetail CONFIRMED token');
    assert(hostDetailContent.includes('text-amber-800') && hostDetailContent.includes('bg-amber-50'), 'HostDetail PENDING token');
    assert(hostDetailContent.includes('text-positive-green') && hostDetailContent.includes('bg-positive-green/10'), 'HostDetail SUCCESSFUL token');
    assert(hostDetailContent.includes('text-red-700') && hostDetailContent.includes('bg-red-50'), 'HostDetail CANCELLED token');
  });

  await runTest('CHALLENGE-M5-TOKEN-02', 2, 'Primary CTA action buttons consistently utilize bg-accent-orange', () => {
    const ctaSurfaces = [
      'app/_components/property-detail/BookingDrawer.tsx',
      'app/booking/confirm/_components/PaymentSection.tsx',
      'app/profile/bookings/[bookingId]/_components/PendingPaymentSection.tsx',
      'app/profile/bookings/[bookingId]/_components/ReviewSection.tsx',
      'app/profile/host/booking/[bookingId]/_components/HostBookingDetailDisplay.tsx',
    ];

    for (const rel of ctaSurfaces) {
      const fullPath = path.join(FRONTEND_DIR, rel);
      const content = fs.readFileSync(fullPath, 'utf-8');
      assert(content.includes('bg-accent-orange'), `${rel} must use bg-accent-orange for primary action`);
    }
  });

  await runTest('CHALLENGE-M5-TOKEN-03', 2, 'Thai Baht integer price displays enforce tabular-nums formatting', () => {
    const pricingSurfaces = [
      'app/profile/bookings/_components/BookingCard.tsx',
      'app/_components/property-detail/BookingRoomCard.tsx',
      'app/booking/confirm/_components/PaymentSection.tsx',
      'app/profile/bookings/[bookingId]/_components/PendingPaymentSection.tsx',
      'app/booking/confirm/_components/ConfirmBookingDisplay.tsx',
      'app/_components/property-detail/BookingDrawer.tsx',
      'app/profile/host/booking/[bookingId]/_components/HostBookingDetailDisplay.tsx',
    ];

    for (const rel of pricingSurfaces) {
      const fullPath = path.join(FRONTEND_DIR, rel);
      const content = fs.readFileSync(fullPath, 'utf-8');
      assert(content.includes('tabular-nums'), `${rel} must utilize tabular-nums for numeric stability`);
    }
  });

  // =========================================================================
  // PRINT SUMMARY
  // =========================================================================

  console.log('\n================================================================================');
  console.log('                 CHALLENGER STRESS SUITE EXECUTION REPORT');
  console.log('================================================================================');

  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;
  const total = testResults.length;

  console.log(` Total Assertions: ${total}`);
  console.log(` Passed:           \x1b[32m${passed}\x1b[0m`);
  console.log(` Failed:           \x1b[31m${failed}\x1b[0m`);
  console.log('================================================================================\n');

  if (failed > 0) {
    console.error(`\x1b[31m[FAIL] Challenger detected ${failed} invariant violation(s)!\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32m[SUCCESS] All ${total} challenger assertions passed cleanly!\x1b[0m`);
    process.exit(0);
  }
}

runChallengerStressSuite().catch((err) => {
  console.error('[UNCAUGHT ERROR]', err);
  process.exit(1);
});
