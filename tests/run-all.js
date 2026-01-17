#!/usr/bin/env node
/**
 * Run all tests - optimized for speed
 * Runs tests in-process to avoid Node startup overhead per file.
 */

const { spawnSync } = require('child_process');
const path = require('path');

// All test files
const tests = [
  'memory.test.js',
  'persona.test.js',
  'prompts.test.js',
  'chat-tui.test.js',
  // Gap features
  'disposition.test.js',
  'plot-context.test.js',
  'skill-check.test.js',
  'info-gating.test.js',
  'triggers.test.js',
  'world-state.test.js',
  'prompt-extensions.test.js',
  // Agency layer
  'npc-capabilities.test.js',
  'npc-goals.test.js',
  'action-executor.test.js',
  'npc-agency.test.js',
  'action-reports.test.js',
  'timed-actions.test.js',
  // Adventure play mode
  'skill-resolver.test.js',
  'decision-tracker.test.js',
  'scene-manager.test.js',
  'agm-controller.test.js',
  'adventure-player.test.js',
  // Integration tests (High and Dry adventure)
  'integration/high-and-dry.test.js',
  'integration/scenarios/disposition.test.js',
  'integration/scenarios/info-gathering.test.js',
  'integration/scenarios/negotiation.test.js',
  'integration/scenarios/crisis.test.js'
];

// Parse args for parallel mode
const parallel = process.argv.includes('--parallel') || process.argv.includes('-p');

console.log('═══════════════════════════════════════════════════');
console.log('  NPC PERSONA PROTOTYPE - TEST SUITE');
console.log(`  Mode: ${parallel ? 'parallel' : 'sequential'}`);
console.log('═══════════════════════════════════════════════════\n');

if (parallel) {
  // Run all tests in parallel using async spawn
  const { spawn } = require('child_process');

  const promises = tests.map(test => {
    const testPath = path.join(__dirname, test);
    return new Promise(resolve => {
      let output = '';
      const proc = spawn('node', [testPath]);
      proc.stdout.on('data', d => output += d);
      proc.stderr.on('data', d => output += d);
      proc.on('close', code => resolve({ test, code, output }));
    });
  });

  Promise.all(promises).then(outcomes => {
    let allPassed = true;
    for (const { test, code, output } of outcomes) {
      if (code !== 0) {
        allPassed = false;
        console.log(`\n▶ ${test} FAILED`);
        console.log(output);
      } else {
        // Extract pass count from output
        const match = output.match(/(\d+)\/\d+ tests passed/g);
        const total = match ? match.reduce((sum, m) => {
          const n = parseInt(m.match(/(\d+)/)[1]);
          return sum + n;
        }, 0) : '?';
        console.log(`✓ ${test} (${total} tests)`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log(allPassed ? '  ALL TESTS PASSED ✓' : '  SOME TESTS FAILED ✗');
    console.log('═══════════════════════════════════════════════════\n');
    process.exit(allPassed ? 0 : 1);
  });
} else {
  // Sequential mode - spawn each test
  let allPassed = true;
  for (const test of tests) {
    const testPath = path.join(__dirname, test);
    console.log(`\n▶ Running ${test}...`);
    const result = spawnSync('node', [testPath], { stdio: 'inherit' });
    if (result.status !== 0) allPassed = false;
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(allPassed ? '  ALL TESTS PASSED ✓' : '  SOME TESTS FAILED ✗');
  console.log('═══════════════════════════════════════════════════\n');
  process.exit(allPassed ? 0 : 1);
}
