/**
 * Run All Extension Tests
 *
 * Usage: node extension/tests/run-all.js
 */

const { execSync } = require('child_process');
const path = require('path');

const testDir = __dirname;
const tests = [
  'manifest.test.js',
  'links.test.js'
];

console.log('╔════════════════════════════════════════════╗');
console.log('║     Recall Extension Test Suite            ║');
console.log('╚════════════════════════════════════════════╝\n');

let allPassed = true;

for (const testFile of tests) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Running: ${testFile}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  try {
    execSync(`node ${path.join(testDir, testFile)}`, {
      stdio: 'inherit',
      encoding: 'utf8'
    });
  } catch (error) {
    allPassed = false;
  }
}

console.log('\n╔════════════════════════════════════════════╗');
if (allPassed) {
  console.log('║     ✓ ALL TEST SUITES PASSED               ║');
} else {
  console.log('║     ✗ SOME TESTS FAILED                    ║');
}
console.log('╚════════════════════════════════════════════╝\n');

process.exit(allPassed ? 0 : 1);
