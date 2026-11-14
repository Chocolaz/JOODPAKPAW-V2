/**
 * JoodPakPaw Automated E2E Test Suite & Runner
 * Specification: tests/e2e/booking-flow.spec.ts
 *
 * Tier 1: Feature Coverage (105 tests - 21 features × 5 tests)
 * Tier 2: Boundary & Corner Cases (105 tests - 21 features × 5 tests)
 * Tier 3: Cross-Feature Combinations (12 tests)
 * Tier 4: Real-World Workload Scenarios (8 tests)
 * Total: 230 tests
 *
 * Invocation: npx tsx tests/e2e/booking-flow.spec.ts
 */

import { initTestServer, closeTestServer, testResults } from './harness';
import { runTier1Tests } from './tier1.spec';
import { runTier2Tests } from './tier2.spec';
import { runTier3Tests } from './tier3.spec';
import { runTier4Tests } from './tier4.spec';

async function runAllSuites(): Promise<void> {
  const suiteStartTime = Date.now();

  console.log('\n================================================================================');
  console.log('       JOODPAKPAW PET BOARDING E2E TEST SUITE (TIERS 1 - 4)');
  console.log('================================================================================\n');

  try {
    // 1. Initialize local test server
    const serverUrl = await initTestServer();
    console.log(`[INFO] Local test server active at: ${serverUrl}\n`);

    // 2. Execute Tier 1: Feature Coverage (105 tests)
    await runTier1Tests();

    // 3. Execute Tier 2: Boundary & Corner Cases (105 tests)
    await runTier2Tests();

    // 4. Execute Tier 3: Cross-Feature Combinations (12 tests)
    await runTier3Tests();

    // 5. Execute Tier 4: Real-World Application Scenarios (8 tests)
    await runTier4Tests();
  } catch (fatalErr: any) {
    console.error('\n[FATAL] Test runner encountered unhandled error:', fatalErr?.message || fatalErr);
    process.exit(1);
  } finally {
    await closeTestServer();
  }

  const totalDuration = Date.now() - suiteStartTime;

  // 6. Aggregate results by Tier
  const tier1Results = testResults.filter((r) => r.tier === 1);
  const tier2Results = testResults.filter((r) => r.tier === 2);
  const tier3Results = testResults.filter((r) => r.tier === 3);
  const tier4Results = testResults.filter((r) => r.tier === 4);

  const t1Passed = tier1Results.filter((r) => r.passed).length;
  const t1Failed = tier1Results.filter((r) => !r.passed).length;

  const t2Passed = tier2Results.filter((r) => r.passed).length;
  const t2Failed = tier2Results.filter((r) => !r.passed).length;

  const t3Passed = tier3Results.filter((r) => r.passed).length;
  const t3Failed = tier3Results.filter((r) => !r.passed).length;

  const t4Passed = tier4Results.filter((r) => r.passed).length;
  const t4Failed = tier4Results.filter((r) => !r.passed).length;

  const totalPassed = testResults.filter((r) => r.passed).length;
  const totalFailed = testResults.filter((r) => !r.passed).length;

  // 7. Print Consolidated Summary Table
  console.log('\n================================================================================');
  console.log('                        CONSOLIDATED TEST EXECUTION REPORT');
  console.log('================================================================================');
  console.log(' Tier | Category Name                      | Total | Passed | Failed | Status ');
  console.log('------+------------------------------------+-------+--------+--------+--------');
  console.log(
    `  1   | Feature Coverage (Happy Path)      |  ${String(tier1Results.length).padEnd(4)} |  ${String(t1Passed).padEnd(5)} |  ${String(t1Failed).padEnd(5)} | ${t1Failed === 0 ? 'PASS' : 'FAIL'} `
  );
  console.log(
    `  2   | Boundary & Corner Cases            |  ${String(tier2Results.length).padEnd(4)} |  ${String(t2Passed).padEnd(5)} |  ${String(t2Failed).padEnd(5)} | ${t2Failed === 0 ? 'PASS' : 'FAIL'} `
  );
  console.log(
    `  3   | Cross-Feature Combinations         |  ${String(tier3Results.length).padEnd(4)} |  ${String(t3Passed).padEnd(5)} |  ${String(t3Failed).padEnd(5)} | ${t3Failed === 0 ? 'PASS' : 'FAIL'} `
  );
  console.log(
    `  4   | Real-World Application Scenarios   |  ${String(tier4Results.length).padEnd(4)} |  ${String(t4Passed).padEnd(5)} |  ${String(t4Failed).padEnd(5)} | ${t4Failed === 0 ? 'PASS' : 'FAIL'} `
  );
  console.log('------+------------------------------------+-------+--------+--------+--------');
  console.log(
    ` TOTAL| Complete 4-Tier Test Suite         |  ${String(testResults.length).padEnd(4)} |  ${String(totalPassed).padEnd(5)} |  ${String(totalFailed).padEnd(5)} | ${totalFailed === 0 ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'} `
  );
  console.log('================================================================================');
  console.log(`Execution Time: ${totalDuration}ms`);
  console.log(`Final Exit Status: ${totalFailed === 0 ? 'SUCCESS (Code 0)' : 'FAILURE (Code 1)'}\n`);

  if (totalFailed > 0) {
    console.error(`\x1b[31m[ERROR] ${totalFailed} test(s) failed in suite.\x1b[0m`);
    process.exit(1);
  } else {
    console.log('\x1b[32m[SUCCESS] All 230 test cases passed with zero regressions!\x1b[0m');
    process.exit(0);
  }
}

runAllSuites().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
