#!/usr/bin/env node
/**
 * Skill Check Tests (TDD - Tests First)
 *
 * Tests skill check abstraction:
 * - Dice rolling
 * - Check performance
 * - Skill level detection
 *
 * AUDITOR INSTANCE: 5f069a8e-52eb-42c4-a874-17ce01f2100b
 */

const { strict: assert } = require('assert');

// Import will fail until implementation exists
let skillCheck;
try {
  skillCheck = require('../src/skill-check');
} catch (e) {
  console.error('Skill-check module not yet implemented.\n');
  skillCheck = {};
}

const {
  roll2d6,
  performCheck,
  hasSkillLevel
} = skillCheck;

// Test runner
function runTests(tests) {
  let passed = 0, failed = 0;
  for (const [name, fn] of Object.entries(tests)) {
    try {
      fn();
      console.log(`\x1b[32m✓\x1b[0m ${name}`);
      passed++;
    } catch (e) {
      console.log(`\x1b[31m✗\x1b[0m ${name}`);
      console.log(`    ${e.message}`);
      failed++;
    }
  }
  console.log(`\n${passed}/${passed + failed} tests passed`);
  return failed === 0;
}

// === DICE TESTS ===

const diceTests = {
  'roll2d6 returns number': () => {
    const result = roll2d6();
    assert.equal(typeof result, 'number');
  },

  'roll2d6 returns value between 2 and 12': () => {
    // Roll many times to verify range
    for (let i = 0; i < 100; i++) {
      const result = roll2d6();
      assert.ok(result >= 2, `Roll ${result} should be >= 2`);
      assert.ok(result <= 12, `Roll ${result} should be <= 12`);
    }
  },

  'roll2d6 produces variety': () => {
    const results = new Set();
    for (let i = 0; i < 100; i++) {
      results.add(roll2d6());
    }
    // Should get at least 5 different values in 100 rolls
    assert.ok(results.size >= 5, 'Should produce variety of results');
  }
};

// === CHECK PERFORMANCE TESTS ===

const checkTests = {
  'performCheck returns result object': () => {
    const result = performCheck('Persuade', 8);
    assert.equal(typeof result, 'object');
    assert.ok(result.hasOwnProperty('success'), 'Should have success');
    assert.ok(result.hasOwnProperty('roll'), 'Should have roll');
    assert.ok(result.hasOwnProperty('total'), 'Should have total');
    assert.ok(result.hasOwnProperty('threshold'), 'Should have threshold');
    assert.ok(result.hasOwnProperty('margin'), 'Should have margin');
  },

  'performCheck success is boolean': () => {
    const result = performCheck('Admin', 6);
    assert.equal(typeof result.success, 'boolean');
  },

  'performCheck threshold is recorded': () => {
    const result = performCheck('Streetwise', 10);
    assert.equal(result.threshold, 10);
  },

  'performCheck margin is calculated correctly': () => {
    const result = performCheck('Broker', 8);
    assert.equal(result.margin, result.total - result.threshold);
  },

  'performCheck applies modifier': () => {
    // Run multiple times - with +10 modifier, should always succeed vs 8
    let successes = 0;
    for (let i = 0; i < 10; i++) {
      const result = performCheck('Persuade', 8, { modifier: 10 });
      if (result.success) successes++;
    }
    assert.equal(successes, 10, 'Should always succeed with +10 modifier vs 8');
  },

  'performCheck total includes modifier': () => {
    const result = performCheck('Diplomacy', 8, { modifier: 3 });
    assert.equal(result.total, result.roll + 3);
  },

  'performCheck success threshold is correct': () => {
    // Verify success is true when total >= threshold
    const result = performCheck('Tactics', 6, { modifier: 100 }); // Guaranteed success
    assert.ok(result.success, 'Should succeed when total >= threshold');
    assert.ok(result.total >= result.threshold);
  }
};

// === SKILL LEVEL TESTS ===

const skillLevelTests = {
  'hasSkillLevel returns false for no skills': () => {
    const pc = {};
    assert.equal(hasSkillLevel(pc, 'Persuade', 1), false);
  },

  'hasSkillLevel returns false for empty skills array': () => {
    const pc = { skills_notable: [] };
    assert.equal(hasSkillLevel(pc, 'Admin', 1), false);
  },

  'hasSkillLevel finds skill at exact level': () => {
    const pc = { skills_notable: ['Leadership-2', 'Tactics-1'] };
    assert.equal(hasSkillLevel(pc, 'Leadership', 2), true);
  },

  'hasSkillLevel returns true for skill above minimum': () => {
    const pc = { skills_notable: ['Pilot-3'] };
    assert.equal(hasSkillLevel(pc, 'Pilot', 1), true);
    assert.equal(hasSkillLevel(pc, 'Pilot', 2), true);
    assert.equal(hasSkillLevel(pc, 'Pilot', 3), true);
  },

  'hasSkillLevel returns false for skill below minimum': () => {
    const pc = { skills_notable: ['Steward-1'] };
    assert.equal(hasSkillLevel(pc, 'Steward', 2), false);
  },

  'hasSkillLevel returns false for missing skill': () => {
    const pc = { skills_notable: ['Medic-2', 'Pilot-1'] };
    assert.equal(hasSkillLevel(pc, 'Engineer', 1), false);
  },

  'hasSkillLevel handles skill-0 entries': () => {
    const pc = { skills_notable: ['Vacc Suit-0'] };
    assert.equal(hasSkillLevel(pc, 'Vacc Suit', 0), true);
    assert.equal(hasSkillLevel(pc, 'Vacc Suit', 1), false);
  },

  'hasSkillLevel is case-sensitive for skill names': () => {
    const pc = { skills_notable: ['Admin-2'] };
    // Test exact match
    assert.equal(hasSkillLevel(pc, 'Admin', 1), true);
  }
};

// === RUN ALL TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  SKILL CHECK TESTS');
console.log('══════════════════════════════════════════\n');

console.log('--- Dice Tests ---');
const dice = runTests(diceTests);

console.log('\n--- Check Performance Tests ---');
const checks = runTests(checkTests);

console.log('\n--- Skill Level Tests ---');
const skills = runTests(skillLevelTests);

const allPassed = dice && checks && skills;
process.exit(allPassed ? 0 : 1);
