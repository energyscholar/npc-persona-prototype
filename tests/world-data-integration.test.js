/**
 * Tests for world data integration
 *
 * Audit: .claude/plans/world-knowledge-integration-audit.md
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// TEST W.1: Subsector data loads
test('Subsector data loads', () => {
  const { initialize, getWorld } = require('../src/subsector-data');
  initialize();
  const world = getWorld('567-908');
  assert.ok(world, 'Should find 567-908');
});

// TEST W.2: Correct UWP returned
test('Correct UWP returned for 567-908', () => {
  const { getWorld } = require('../src/subsector-data');
  const world = getWorld('567-908');
  assert.strictEqual(world.uwp, 'E532000-0', 'UWP should be E532000-0, not X200000-0');
});

// TEST W.3: Lookup by hex works
test('Lookup by hex works', () => {
  const { getWorldByHex } = require('../src/subsector-data');
  const world = getWorldByHex('1031');
  assert.ok(world, 'Should find world at hex 1031');
  assert.strictEqual(world.name, '567-908');
});

// TEST W.4: Walston data correct
test('Walston data correct', () => {
  const { getWorld } = require('../src/subsector-data');
  const walston = getWorld('Walston');
  assert.ok(walston, 'Should find Walston');
  assert.strictEqual(walston.uwp, 'C544338-8');
  assert.strictEqual(walston.techLevel, 8);
});

// TEST W.5: World context builds correctly
test('World context builds correctly', () => {
  const { buildWorldContext } = require('../src/subsector-data');
  const ctx = buildWorldContext('567-908');
  assert.ok(ctx, 'Should build context');
  assert.ok(ctx.includes('E532000-0'), 'Context should include correct UWP');
  assert.ok(
    ctx.includes('Starport E') || ctx.includes('starport') || ctx.includes('frontier'),
    'Context should describe starport'
  );
});

// TEST W.6: Multiple subsectors loaded
test('Multiple subsectors loaded', () => {
  const { getWorld } = require('../src/subsector-data');

  // From different subsectors
  const worlds = [
    'Walston',      // Glisten
    '567-908',      // District 268
    'Flammarion',   // Should be in data if present
  ];

  let found = 0;
  for (const name of worlds) {
    const world = getWorld(name);
    if (world) found++;
  }

  assert.ok(found >= 2, 'Should find worlds from multiple subsectors');
});

// Run tests
async function runTests() {
  console.log('Running world data integration tests...\n');

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✓ ${t.name}`);
      passed++;
    } catch (err) {
      console.log(`✗ ${t.name}`);
      console.log(`  ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
