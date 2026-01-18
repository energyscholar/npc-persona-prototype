/**
 * Tests for Act 2 scene ordering
 *
 * Audit: .claude/plans/act2-scene-order-audit.md
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Helper to load act JSON
function loadAct(adventureId, actId) {
  const actPath = path.join(
    __dirname,
    '../data/adventures',
    adventureId,
    'acts',
    `${actId}.json`
  );
  return JSON.parse(fs.readFileSync(actPath, 'utf8'));
}

// Helper to load scene JSON
function loadScene(adventureId, sceneId) {
  const scenePath = path.join(
    __dirname,
    '../data/adventures',
    adventureId,
    'scenes',
    `${sceneId}.json`
  );
  return JSON.parse(fs.readFileSync(scenePath, 'utf8'));
}

// TEST A2.1: Act 2 scenes in correct order
test('Act 2 scenes in correct order', () => {
  const act = loadAct('high-and-dry', 'act-2-walston');
  assert.deepStrictEqual(act.scenes, [
    'starport-arrival',
    'startown-investigation',
    'meeting-greener'
  ], 'Startown should come before meeting-greener');
});

// TEST A2.2: Startown comes before meeting-greener by order field
test('Startown order < meeting-greener order', () => {
  const startown = loadScene('high-and-dry', 'startown-investigation');
  const meeting = loadScene('high-and-dry', 'meeting-greener');
  assert.ok(
    startown.order < meeting.order,
    `Startown order (${startown.order}) should be less than meeting (${meeting.order})`
  );
});

// TEST A2.3: Startown not marked as optional in description
test('Startown not marked as optional', () => {
  const startown = loadScene('high-and-dry', 'startown-investigation');
  assert.ok(
    !startown.description.toLowerCase().includes('optional'),
    'Startown should not be described as optional - it is the logical next step after arrival'
  );
});

// TEST A2.4: Startown has stages for logical progression
test('Startown has stages for hotel/intel progression', () => {
  const startown = loadScene('high-and-dry', 'startown-investigation');
  assert.ok(startown.stages, 'Startown should have stages array');
  assert.ok(
    startown.stages.length >= 2,
    'Startown should have at least 2 stages (lodging, intel)'
  );

  // Check for lodging-related stage
  const hasLodging = startown.stages.some(s =>
    s.name.toLowerCase().includes('lodging') ||
    s.name.toLowerCase().includes('hotel') ||
    s.objective?.toLowerCase().includes('inn') ||
    s.objective?.toLowerCase().includes('room')
  );
  assert.ok(hasLodging, 'Startown should have a lodging/hotel stage');
});

// TEST A2.5: Meeting-greener trigger references travel to capital
test('Meeting-greener trigger references travel', () => {
  const meeting = loadScene('high-and-dry', 'meeting-greener');
  const entry = meeting.triggers.entry.toLowerCase();
  assert.ok(
    entry.includes('rail') ||
    entry.includes('travel') ||
    entry.includes('capital') ||
    entry.includes('startown'),
    'Meeting-greener entry trigger should reference travel from startown to capital'
  );
});

// Run tests
async function runTests() {
  console.log('Running Act 2 scene order tests...\n');

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
