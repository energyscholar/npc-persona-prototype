/**
 * Tests for skill-resolver.js - Dice rolling and modifier calculation
 */

const assert = require('assert');
const {
  rollDice,
  getSkillModifier,
  getAttributeModifier,
  resolveCheck,
  formatCheckResult,
  formatDetailedResult,
  SKILL_ATTRIBUTES
} = require('../src/skill-resolver');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Test rollDice
test('rollDice returns value in expected range for 2d6', () => {
  for (let i = 0; i < 100; i++) {
    const result = rollDice(2, 6);
    assert.ok(result >= 2 && result <= 12, `2d6 should be 2-12, got ${result}`);
  }
});

test('rollDice returns value in expected range for 1d6', () => {
  for (let i = 0; i < 50; i++) {
    const result = rollDice(1, 6);
    assert.ok(result >= 1 && result <= 6, `1d6 should be 1-6, got ${result}`);
  }
});

// Test getSkillModifier
test('getSkillModifier returns 0 for null PC', () => {
  assert.strictEqual(getSkillModifier(null, 'Pilot'), 0);
});

test('getSkillModifier returns 0 for PC without skills', () => {
  assert.strictEqual(getSkillModifier({ name: 'Test' }, 'Pilot'), 0);
});

test('getSkillModifier finds exact skill match', () => {
  const pc = {
    skills: [
      { name: 'Pilot', level: 2 },
      { name: 'Astrogation', level: 1 }
    ]
  };
  assert.strictEqual(getSkillModifier(pc, 'Pilot'), 2);
  assert.strictEqual(getSkillModifier(pc, 'Astrogation'), 1);
});

test('getSkillModifier handles case-insensitive matching', () => {
  const pc = {
    skills: [{ name: 'Pilot', level: 3 }]
  };
  assert.strictEqual(getSkillModifier(pc, 'pilot'), 3);
  assert.strictEqual(getSkillModifier(pc, 'PILOT'), 3);
});

test('getSkillModifier handles partial matching', () => {
  const pc = {
    skills: [{ name: 'Vacc Suit', level: 1 }]
  };
  assert.strictEqual(getSkillModifier(pc, 'vacc_suit'), 1);
});

// Test getAttributeModifier
test('getAttributeModifier returns 0 for null PC', () => {
  assert.strictEqual(getAttributeModifier(null, 'Pilot'), 0);
});

test('getAttributeModifier calculates modifier correctly', () => {
  // Traveller formula: (attribute - 7) / 3, rounded down
  const pc = {
    characteristics: {
      dex: 10,  // (10-7)/3 = 1
      int: 7,   // (7-7)/3 = 0
      str: 4    // (4-7)/3 = -1
    }
  };
  assert.strictEqual(getAttributeModifier(pc, 'Pilot'), 1);  // uses DEX
  assert.strictEqual(getAttributeModifier(pc, 'Investigate'), 0);  // uses INT
});

test('getAttributeModifier uses correct attribute for skill', () => {
  const pc = {
    characteristics: { dex: 12, soc: 9, edu: 6 }
  };
  // DEX-based skills
  assert.strictEqual(getAttributeModifier(pc, 'Pilot'), 1);  // (12-7)/3 = 1
  assert.strictEqual(getAttributeModifier(pc, 'Athletics'), 1);

  // SOC-based skills
  assert.strictEqual(getAttributeModifier(pc, 'Persuade'), 0);  // (9-7)/3 = 0
});

// Test SKILL_ATTRIBUTES mapping
test('SKILL_ATTRIBUTES has expected mappings', () => {
  assert.strictEqual(SKILL_ATTRIBUTES.pilot, 'dex');
  assert.strictEqual(SKILL_ATTRIBUTES.persuade, 'soc');
  assert.strictEqual(SKILL_ATTRIBUTES.medic, 'edu');
  assert.strictEqual(SKILL_ATTRIBUTES.survival, 'end');
  assert.strictEqual(SKILL_ATTRIBUTES.investigate, 'int');
});

// Test resolveCheck
test('resolveCheck returns correct structure', () => {
  const check = { skill: 'Pilot', difficulty: 8, reason: 'landing' };
  const pc = { skills: [{ name: 'Pilot', level: 2 }], characteristics: { dex: 10 } };
  const result = resolveCheck(check, pc);

  assert.ok('roll' in result);
  assert.ok('skillMod' in result);
  assert.ok('attrMod' in result);
  assert.ok('total' in result);
  assert.ok('difficulty' in result);
  assert.ok('success' in result);
  assert.ok('exceptional' in result);
  assert.ok('fumble' in result);
  assert.ok('margin' in result);
  assert.ok('narrative' in result);
});

test('resolveCheck with forced roll calculates correctly', () => {
  const check = { skill: 'Pilot', difficulty: 8, reason: 'test' };
  const pc = {
    skills: [{ name: 'Pilot', level: 2 }],
    characteristics: { dex: 10 }  // +1 modifier
  };

  // Force roll of 7: 7 + 2 (skill) + 1 (attr) = 10 vs 8 = success
  const result = resolveCheck(check, pc, 7);
  assert.strictEqual(result.roll, 7);
  assert.strictEqual(result.skillMod, 2);
  assert.strictEqual(result.attrMod, 1);
  assert.strictEqual(result.total, 10);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.margin, 2);
});

test('resolveCheck detects exceptional success', () => {
  const check = { skill: 'Pilot', difficulty: 8, reason: 'test' };
  const pc = { skills: [], characteristics: {} };

  // Force roll of 12: 12 + 0 + 0 = 12 vs 8 (margin 4, need 6 for exceptional)
  const result = resolveCheck(check, pc, 12);
  assert.strictEqual(result.exceptional, false);

  // With skill bonus to get margin >= 6
  const pcSkilled = { skills: [{ name: 'Pilot', level: 4 }], characteristics: { dex: 10 } };
  const result2 = resolveCheck(check, pcSkilled, 10);  // 10 + 4 + 1 = 15, margin 7
  assert.strictEqual(result2.exceptional, true);
});

test('resolveCheck detects fumble on snake eyes', () => {
  const check = { skill: 'Pilot', difficulty: 8, reason: 'test' };
  const pc = { skills: [], characteristics: {} };

  const result = resolveCheck(check, pc, 2);
  assert.strictEqual(result.fumble, true);
});

// Test formatCheckResult
test('formatCheckResult formats success', () => {
  const check = { skill: 'Pilot', difficulty: 8 };
  const result = formatCheckResult(check, 10, true);
  assert.ok(result.includes('Pilot'));
  assert.ok(result.includes('10'));
  assert.ok(result.includes('8+'));
  assert.ok(result.includes('Success'));
});

test('formatCheckResult formats failure', () => {
  const check = { skill: 'Athletics', difficulty: 10 };
  const result = formatCheckResult(check, 6, false);
  assert.ok(result.includes('Failure'));
});

// Test formatDetailedResult
test('formatDetailedResult includes all details', () => {
  const checkResult = {
    roll: 8,
    skillMod: 2,
    attrMod: 1,
    total: 11,
    difficulty: 8,
    success: true,
    exceptional: false,
    fumble: false,
    margin: 3,
    check: { skill: 'Pilot', difficulty: 8, reason: 'landing' }
  };

  const result = formatDetailedResult(checkResult);
  assert.ok(result.includes('2D6'));
  assert.ok(result.includes('Pilot'));
  assert.ok(result.includes('8'));  // roll
  assert.ok(result.includes('11'));  // total
  assert.ok(result.includes('Success by 3'));
});

test('formatDetailedResult shows fumble', () => {
  const checkResult = {
    roll: 2,
    skillMod: 1,
    attrMod: 0,
    total: 3,
    difficulty: 8,
    success: false,
    exceptional: false,
    fumble: true,
    margin: -5,
    check: { skill: 'Pilot', difficulty: 8, reason: 'test' }
  };

  const result = formatDetailedResult(checkResult);
  assert.ok(result.includes('FUMBLE'));
});

// Run tests
async function runTests() {
  console.log('Running skill-resolver tests...\n');
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
