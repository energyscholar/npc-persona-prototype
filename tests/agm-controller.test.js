/**
 * Tests for agm-controller.js - AGM prompt building and response parsing
 */

const assert = require('assert');
const {
  buildPCContext,
  parseAgmResponse,
  formatFlags,
  DIRECTIVE_PATTERNS
} = require('../src/agm-controller');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Test buildPCContext
test('buildPCContext handles null PC', () => {
  const result = buildPCContext(null);
  assert.strictEqual(result, 'No PC loaded.');
});

test('buildPCContext formats PC name and background', () => {
  const pc = { name: 'Test Character', background: 'Merchant background' };
  const result = buildPCContext(pc);
  assert.ok(result.includes('Name: Test Character'));
  assert.ok(result.includes('Background: Merchant background'));
});

test('buildPCContext formats characteristics', () => {
  const pc = {
    name: 'Test',
    characteristics: { str: 9, dex: 10, end: 8 }
  };
  const result = buildPCContext(pc);
  assert.ok(result.includes('STR: 9'));
  assert.ok(result.includes('DEX: 10'));
});

test('buildPCContext formats skills', () => {
  const pc = {
    name: 'Test',
    skills: [
      { name: 'Pilot', level: 2 },
      { name: 'Astrogation', level: 1 }
    ]
  };
  const result = buildPCContext(pc);
  assert.ok(result.includes('Pilot-2'));
  assert.ok(result.includes('Astrogation-1'));
});

// Test parseAgmResponse
test('parseAgmResponse extracts SKILL_CHECK directive', () => {
  const response = 'You attempt the climb. [SKILL_CHECK: Athletics 8+ climbing the cliff] The rocks are slippery.';
  const result = parseAgmResponse(response);

  assert.ok(result.skillCheck);
  assert.strictEqual(result.skillCheck.skill, 'Athletics');
  assert.strictEqual(result.skillCheck.difficulty, 8);
  assert.strictEqual(result.skillCheck.reason, 'climbing the cliff');
  assert.ok(!result.narrativeText.includes('[SKILL_CHECK'));
});

test('parseAgmResponse extracts NPC_DIALOGUE directive', () => {
  const response = 'The minister looks up from his desk. [NPC_DIALOGUE: minister-greener] He gestures to a chair.';
  const result = parseAgmResponse(response);

  assert.ok(result.enterNpcDialogue);
  assert.strictEqual(result.npcId, 'minister-greener');
  assert.ok(!result.narrativeText.includes('[NPC_DIALOGUE'));
});

test('parseAgmResponse extracts BEAT_COMPLETE directive', () => {
  const response = 'You have reached an agreement. [BEAT_COMPLETE: meeting_greener]';
  const result = parseAgmResponse(response);

  assert.strictEqual(result.beatComplete, 'meeting_greener');
  assert.ok(!result.narrativeText.includes('[BEAT_COMPLETE'));
});

test('parseAgmResponse extracts SCENE directive with time skip', () => {
  const response = 'Three days pass as you repair the ship. [SCENE: ship-repairs, TIME: +3d]';
  const result = parseAgmResponse(response);

  assert.ok(result.advanceScene);
  assert.strictEqual(result.nextSceneId, 'ship-repairs');
  assert.deepStrictEqual(result.timeSkip, { amount: 3, unit: 'd' });
});

test('parseAgmResponse extracts FLASHBACK directive', () => {
  const response = 'You remember the departure. [FLASHBACK: departure-flammarion]';
  const result = parseAgmResponse(response);

  assert.ok(result.advanceScene);
  assert.ok(result.isFlashback);
  assert.strictEqual(result.nextSceneId, 'departure-flammarion');
});

test('parseAgmResponse extracts DECISION directive', () => {
  const response = 'Your choice is made. [DECISION: rescue_choice = barvinn]';
  const result = parseAgmResponse(response);

  assert.ok(result.decision);
  assert.strictEqual(result.decision.id, 'rescue_choice');
  assert.strictEqual(result.decision.choice, 'barvinn');
});

test('parseAgmResponse handles response with no directives', () => {
  const response = 'The wind howls across the landing field. You see the customs office ahead.';
  const result = parseAgmResponse(response);

  assert.strictEqual(result.skillCheck, null);
  assert.ok(!result.enterNpcDialogue);
  assert.strictEqual(result.beatComplete, null);
  assert.ok(!result.advanceScene);
  assert.strictEqual(result.narrativeText, response);
});

// Test formatFlags
test('formatFlags handles empty flags', () => {
  assert.strictEqual(formatFlags(null), 'None set.');
  assert.strictEqual(formatFlags({}), 'None set.');
});

test('formatFlags formats flag pairs', () => {
  const flags = { wolf_tamed: true, greener_impressed: 'high' };
  const result = formatFlags(flags);
  assert.ok(result.includes('wolf_tamed: true'));
  assert.ok(result.includes('greener_impressed: high'));
});

// Test DIRECTIVE_PATTERNS
test('DIRECTIVE_PATTERNS match expected formats', () => {
  // SKILL_CHECK pattern
  assert.ok(DIRECTIVE_PATTERNS.SKILL_CHECK.test('[SKILL_CHECK: Pilot 10+ landing]'));

  // NPC_DIALOGUE pattern
  assert.ok(DIRECTIVE_PATTERNS.NPC_DIALOGUE.test('[NPC_DIALOGUE: minister-greener]'));

  // BEAT_COMPLETE pattern
  assert.ok(DIRECTIVE_PATTERNS.BEAT_COMPLETE.test('[BEAT_COMPLETE: volcano_survey]'));

  // SCENE pattern
  assert.ok(DIRECTIVE_PATTERNS.SCENE.test('[SCENE: scout-office]'));
  assert.ok(DIRECTIVE_PATTERNS.SCENE.test('[SCENE: scout-office, TIME: +2d]'));

  // FLASHBACK pattern
  assert.ok(DIRECTIVE_PATTERNS.FLASHBACK.test('[FLASHBACK: departure]'));

  // DECISION pattern
  assert.ok(DIRECTIVE_PATTERNS.DECISION.test('[DECISION: choice_id = option]'));
});

// Run tests
async function runTests() {
  console.log('Running agm-controller tests...\n');
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
