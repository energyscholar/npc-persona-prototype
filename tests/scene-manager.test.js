/**
 * Tests for scene-manager.js - Non-linear scene transitions and time control
 */

const assert = require('assert');
const {
  parseSceneDirective,
  applyTimeSkip,
  DIRECTIVE_TYPES
} = require('../src/scene-manager');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Test parseSceneDirective
test('parseSceneDirective parses simple SCENE directive', () => {
  const result = parseSceneDirective('[SCENE: scout-office]');
  assert.ok(result);
  assert.strictEqual(result.type, DIRECTIVE_TYPES.SCENE);
  assert.strictEqual(result.sceneId, 'scout-office');
  assert.strictEqual(result.timeSkip, null);
});

test('parseSceneDirective parses SCENE with time skip', () => {
  const result = parseSceneDirective('[SCENE: ship-repairs, TIME: +3d]');
  assert.ok(result);
  assert.strictEqual(result.type, DIRECTIVE_TYPES.SCENE);
  assert.strictEqual(result.sceneId, 'ship-repairs');
  assert.deepStrictEqual(result.timeSkip, { amount: 3, unit: 'd' });
});

test('parseSceneDirective parses SCENE with hours', () => {
  const result = parseSceneDirective('[SCENE: landing, TIME: +6h]');
  assert.ok(result);
  assert.deepStrictEqual(result.timeSkip, { amount: 6, unit: 'h' });
});

test('parseSceneDirective parses SCENE with weeks', () => {
  const result = parseSceneDirective('[SCENE: journey, TIME: +2w]');
  assert.ok(result);
  assert.deepStrictEqual(result.timeSkip, { amount: 2, unit: 'w' });
});

test('parseSceneDirective parses FLASHBACK directive', () => {
  const result = parseSceneDirective('[FLASHBACK: departure-flammarion]');
  assert.ok(result);
  assert.strictEqual(result.type, DIRECTIVE_TYPES.FLASHBACK);
  assert.strictEqual(result.sceneId, 'departure-flammarion');
});

test('parseSceneDirective parses MONTAGE directive', () => {
  const result = parseSceneDirective('[MONTAGE: scene1, scene2, scene3]');
  assert.ok(result);
  assert.strictEqual(result.type, DIRECTIVE_TYPES.MONTAGE);
  assert.deepStrictEqual(result.scenes, ['scene1', 'scene2', 'scene3']);
});

test('parseSceneDirective parses NEXT_SCENE (legacy)', () => {
  const result = parseSceneDirective('[NEXT_SCENE: volcano-survey]');
  assert.ok(result);
  assert.strictEqual(result.type, DIRECTIVE_TYPES.SCENE);
  assert.strictEqual(result.sceneId, 'volcano-survey');
});

test('parseSceneDirective returns null for no directive', () => {
  const result = parseSceneDirective('Just some narrative text.');
  assert.strictEqual(result, null);
});

test('parseSceneDirective is case-insensitive', () => {
  const result1 = parseSceneDirective('[scene: test-scene]');
  assert.ok(result1);
  assert.strictEqual(result1.sceneId, 'test-scene');

  const result2 = parseSceneDirective('[SCENE: test-scene]');
  assert.ok(result2);
  assert.strictEqual(result2.sceneId, 'test-scene');
});

// Test applyTimeSkip
test('applyTimeSkip advances days correctly', () => {
  const state = { gameDate: '010-1105' };
  applyTimeSkip(state, { amount: 5, unit: 'd' });
  assert.strictEqual(state.gameDate, '015-1105');
});

test('applyTimeSkip advances weeks correctly', () => {
  const state = { gameDate: '010-1105' };
  applyTimeSkip(state, { amount: 2, unit: 'w' });
  assert.strictEqual(state.gameDate, '024-1105');  // 10 + 14 = 24
});

test('applyTimeSkip handles year rollover', () => {
  const state = { gameDate: '360-1105' };
  applyTimeSkip(state, { amount: 10, unit: 'd' });
  assert.strictEqual(state.gameDate, '005-1106');  // 360 + 10 - 365 = 5, year + 1
});

test('applyTimeSkip handles multi-year rollover', () => {
  const state = { gameDate: '300-1105' };
  applyTimeSkip(state, { amount: 100, unit: 'w' });  // 700 days
  // 300 + 700 = 1000, 1000 - 365 = 635, 635 - 365 = 270
  assert.strictEqual(state.gameDate, '270-1107');  // year + 2
});

test('applyTimeSkip ignores hours (minimal impact)', () => {
  const state = { gameDate: '010-1105' };
  applyTimeSkip(state, { amount: 12, unit: 'h' });
  assert.strictEqual(state.gameDate, '010-1105');  // unchanged
});

test('applyTimeSkip handles missing gameDate', () => {
  const state = {};
  // Should not throw
  applyTimeSkip(state, { amount: 5, unit: 'd' });
  assert.ok(!state.gameDate);  // Still undefined
});

test('applyTimeSkip pads day numbers correctly', () => {
  const state = { gameDate: '003-1105' };
  applyTimeSkip(state, { amount: 2, unit: 'd' });
  assert.strictEqual(state.gameDate, '005-1105');  // Padded to 3 digits
});

// Test DIRECTIVE_TYPES enum
test('DIRECTIVE_TYPES has expected values', () => {
  assert.strictEqual(DIRECTIVE_TYPES.SCENE, 'SCENE');
  assert.strictEqual(DIRECTIVE_TYPES.FLASHBACK, 'FLASHBACK');
  assert.strictEqual(DIRECTIVE_TYPES.MONTAGE, 'MONTAGE');
  assert.strictEqual(DIRECTIVE_TYPES.TIME_SKIP, 'TIME_SKIP');
});

// Run tests
async function runTests() {
  console.log('Running scene-manager tests...\n');
  let passed = 0;
  let failed = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e) {
      console.log(`  ✗ ${name}`);
      console.log(`    ${e.message}`);
      failed++;
    }
  }

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

if (require.main === module) {
  runTests().then(success => process.exit(success ? 0 : 1));
}

module.exports = { runTests };
