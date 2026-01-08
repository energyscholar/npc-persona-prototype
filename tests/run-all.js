#!/usr/bin/env node
/**
 * Run all tests
 */

const { execSync } = require('child_process');
const path = require('path');

const tests = [
  'memory.test.js',
  'persona.test.js',
  'prompts.test.js'
];

let allPassed = true;

console.log('═══════════════════════════════════════════════════');
console.log('  NPC PERSONA PROTOTYPE - TEST SUITE');
console.log('═══════════════════════════════════════════════════\n');

for (const test of tests) {
  const testPath = path.join(__dirname, test);
  try {
    console.log(`\n▶ Running ${test}...`);
    execSync(`node ${testPath}`, { stdio: 'inherit' });
  } catch (e) {
    allPassed = false;
  }
}

console.log('\n═══════════════════════════════════════════════════');
if (allPassed) {
  console.log('  ALL TESTS PASSED ✓');
} else {
  console.log('  SOME TESTS FAILED ✗');
}
console.log('═══════════════════════════════════════════════════\n');

process.exit(allPassed ? 0 : 1);
