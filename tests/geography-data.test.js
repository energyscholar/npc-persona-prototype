/**
 * Tests for Settlement Island geography data
 *
 * Audit: .claude/plans/settlement-island-geography-audit.md
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Helper to load geography JSON
function loadGeography(adventureId, geoId) {
  const geoPath = path.join(
    __dirname,
    '../data/adventures',
    adventureId,
    'geography',
    `${geoId}.json`
  );
  if (!fs.existsSync(geoPath)) return null;
  return JSON.parse(fs.readFileSync(geoPath, 'utf8'));
}

// TEST G.1: Geography data loads
test('Geography data loads', () => {
  const geo = loadGeography('high-and-dry', 'settlement-island');
  assert.ok(geo, 'Settlement Island geography should exist');
  assert.strictEqual(geo.population, 3000);
});

// TEST G.2: Settlements queryable
test('Settlements are queryable', () => {
  const geo = loadGeography('high-and-dry', 'settlement-island');
  assert.ok(geo.settlements, 'Should have settlements array');

  const central = geo.settlements.find(s => s.id === 'central');
  assert.ok(central, 'Should have Central settlement');
  assert.strictEqual(central.type, 'capital');
});

// TEST G.3: Rail connections defined
test('Rail connections defined', () => {
  const geo = loadGeography('high-and-dry', 'settlement-island');
  const central = geo.settlements.find(s => s.id === 'central');

  assert.ok(central.rail_connections, 'Central should have rail_connections');
  assert.ok(central.rail_connections.includes('startown'), 'Central should connect to startown');
});

// TEST G.4: Travel time calculable
test('Travel time calculable', () => {
  const { getTravelTime } = require('../src/geography-data');
  const time = getTravelTime('high-and-dry', 'startown', 'central', 'rail');
  assert.ok(time, 'Should return travel time');
  assert.ok(time.includes('hour'), 'Travel time should be in hours');
});

// TEST G.5: Evacuation zones marked
test('Evacuation zones marked', () => {
  const geo = loadGeography('high-and-dry', 'settlement-island');
  const evac = geo.settlements.filter(s => s.evacuation_zone);
  assert.ok(evac.length >= 2, 'Should have at least 2 evacuation zones (Salbarii, Barvinn)');

  const salbarii = geo.settlements.find(s => s.id === 'salbarii');
  assert.ok(salbarii.evacuation_zone, 'Salbarii should be evacuation zone');
});

// Run tests
async function runTests() {
  console.log('Running geography data tests...\n');

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
