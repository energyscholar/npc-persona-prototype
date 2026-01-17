/**
 * Tests for decision-tracker.js - Player decision recording and consequence propagation
 */

const assert = require('assert');
const {
  recordDecision,
  setFlag,
  getFlag,
  getDecisionSummary,
  checkDecisionMade,
  getDecisionConsequence,
  listDecisions,
  buildDecisionContext
} = require('../src/decision-tracker');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Helper to create fresh story state
function createStoryState() {
  return {
    adventure: 'test-adventure',
    pcId: 'test-pc',
    currentScene: 'test-scene',
    decisions: {},
    flags: {}
  };
}

// Test setFlag
test('setFlag creates flags object if missing', () => {
  const state = {};
  setFlag(state, 'test_flag', true);
  assert.ok(state.flags);
  assert.strictEqual(state.flags.test_flag, true);
});

test('setFlag sets flag value', () => {
  const state = { flags: {} };
  setFlag(state, 'wolf_tamed', true);
  setFlag(state, 'reputation', 'high');
  assert.strictEqual(state.flags.wolf_tamed, true);
  assert.strictEqual(state.flags.reputation, 'high');
});

// Test getFlag
test('getFlag returns flag value', () => {
  const state = { flags: { test: 'value' } };
  assert.strictEqual(getFlag(state, 'test'), 'value');
});

test('getFlag returns undefined for missing flag', () => {
  const state = { flags: {} };
  assert.strictEqual(getFlag(state, 'missing'), undefined);
});

test('getFlag handles null state', () => {
  assert.strictEqual(getFlag(null, 'test'), undefined);
});

// Test recordDecision
test('recordDecision creates decisions object if missing', () => {
  const state = { currentScene: 'test' };
  recordDecision(state, {
    id: 'test_decision',
    choice: 'option_a',
    details: 'Chose option A',
    consequences: {}
  });
  assert.ok(state.decisions);
  assert.ok(state.decisions.test_decision);
});

test('recordDecision records decision with metadata', () => {
  const state = createStoryState();
  recordDecision(state, {
    id: 'rescue_choice',
    choice: 'barvinn',
    details: 'Chose to rescue Barvinn villagers',
    consequences: {}
  });

  const decision = state.decisions.rescue_choice;
  assert.ok(decision.timestamp);
  assert.strictEqual(decision.scene, 'test-scene');
  assert.strictEqual(decision.choice, 'barvinn');
  assert.strictEqual(decision.details, 'Chose to rescue Barvinn villagers');
});

test('recordDecision applies flag consequences', () => {
  const state = createStoryState();
  recordDecision(state, {
    id: 'wolf_encounter',
    choice: 'tame',
    details: 'Tamed the wolf',
    consequences: {
      flag_wolf_tamed: true,
      flag_wolf_friendly: 'yes'
    }
  });

  assert.strictEqual(state.flags.wolf_tamed, true);
  assert.strictEqual(state.flags.wolf_friendly, 'yes');
});

test('recordDecision applies disposition consequences', () => {
  const state = createStoryState();
  state.disposition = { level: 0 };

  recordDecision(state, {
    id: 'greener_deal',
    choice: 'accept',
    details: 'Accepted the deal professionally',
    consequences: {
      disposition_change: 1
    }
  });

  assert.strictEqual(state.disposition.level, 1);
});

// Test checkDecisionMade
test('checkDecisionMade returns true for existing decision', () => {
  const state = createStoryState();
  recordDecision(state, { id: 'test', choice: 'a', details: 'test', consequences: {} });
  assert.strictEqual(checkDecisionMade(state, 'test'), true);
});

test('checkDecisionMade returns false for missing decision', () => {
  const state = createStoryState();
  assert.strictEqual(checkDecisionMade(state, 'missing'), false);
});

// Test getDecisionConsequence
test('getDecisionConsequence returns consequence value', () => {
  const state = createStoryState();
  recordDecision(state, {
    id: 'test',
    choice: 'a',
    details: 'test',
    consequences: { result: 'success' }
  });
  assert.strictEqual(getDecisionConsequence(state, 'test', 'result'), 'success');
});

test('getDecisionConsequence returns undefined for missing', () => {
  const state = createStoryState();
  assert.strictEqual(getDecisionConsequence(state, 'missing', 'key'), undefined);
});

// Test listDecisions
test('listDecisions returns array of decisions', () => {
  const state = createStoryState();
  recordDecision(state, { id: 'first', choice: 'a', details: 'test1', consequences: {} });
  recordDecision(state, { id: 'second', choice: 'b', details: 'test2', consequences: {} });

  const list = listDecisions(state);
  assert.strictEqual(list.length, 2);
  assert.ok(list.find(d => d.id === 'first'));
  assert.ok(list.find(d => d.id === 'second'));
});

test('listDecisions returns empty array for no decisions', () => {
  const state = {};
  assert.deepStrictEqual(listDecisions(state), []);
});

// Test getDecisionSummary
test('getDecisionSummary returns message for no decisions', () => {
  const state = createStoryState();
  const summary = getDecisionSummary(state);
  assert.ok(summary.includes('No major decisions'));
});

test('getDecisionSummary formats decisions', () => {
  const state = createStoryState();
  recordDecision(state, {
    id: 'rescue',
    choice: 'barvinn',
    details: 'Rescued the villagers',
    consequences: { saved: 11 }
  });

  const summary = getDecisionSummary(state);
  assert.ok(summary.includes('barvinn'));
  assert.ok(summary.includes('Rescued the villagers'));
  assert.ok(summary.includes('saved: 11'));
});

// Test buildDecisionContext
test('buildDecisionContext returns empty for no decisions', () => {
  const state = createStoryState();
  const context = buildDecisionContext(state);
  assert.strictEqual(context, '');
});

test('buildDecisionContext includes decision instructions', () => {
  const state = createStoryState();
  recordDecision(state, { id: 'test', choice: 'a', details: 'test', consequences: {} });

  const context = buildDecisionContext(state);
  assert.ok(context.includes('PLAYER DECISIONS'));
  assert.ok(context.includes('MUST influence'));
  assert.ok(context.includes('Reference past choices'));
});

// Run tests
async function runTests() {
  console.log('Running decision-tracker tests...\n');
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
