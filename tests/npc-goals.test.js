#!/usr/bin/env node
/**
 * NPC Goals Tests (TDD - Tests First)
 *
 * Tests goal state tracking and activation:
 * - Goal structure validation
 * - Active vs background goals
 * - Goal trigger conditions
 * - Priority ordering
 *
 * AUDITOR INSTANCE: 5f069a8e-52eb-42c4-a874-17ce01f2100b
 */

const { strict: assert } = require('assert');

// Import will fail until implementation exists
let npcGoals;
try {
  npcGoals = require('../src/npc-goals');
} catch (e) {
  console.error('NPC-goals module not yet implemented.\n');
  npcGoals = {};
}

const {
  getActiveGoals,
  getGoalsByPriority,
  isGoalTriggered,
  shouldActOnGoal,
  getGoalActions,
  updateGoalStatus
} = npcGoals;

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

// === TEST DATA ===

const sampleNpc = {
  id: 'ag3-gamma',
  name: 'AG-3 Gamma',
  role: 'gunner',
  goals: [
    {
      id: 'maintain-weapons',
      priority: 2,
      description: 'Keep weapons systems operational',
      status: 'background',
      actions: ['repair-weapons', 'calibrate-targeting'],
      trigger: { flag: 'weapons_damaged', value: true }
    },
    {
      id: 'protect-crew',
      priority: 1,
      description: 'Protect crew from threats',
      status: 'active',
      actions: ['fire-weapons', 'alert-crew', 'recommend-evasion'],
      trigger: { flag: 'threat_detected', value: true }
    },
    {
      id: 'standby',
      priority: 3,
      description: 'Maintain readiness',
      status: 'active',
      actions: ['monitor-sensors']
    }
  ]
};

const sampleStoryState = {
  flags: {
    weapons_damaged: false,
    threat_detected: false
  },
  gameDate: '015-1105'
};

// === GET ACTIVE GOALS TESTS ===

const activeGoalsTests = {
  'getActiveGoals returns array': () => {
    const goals = getActiveGoals(sampleNpc, sampleStoryState);
    assert.ok(Array.isArray(goals));
  },

  'getActiveGoals includes status=active goals': () => {
    const goals = getActiveGoals(sampleNpc, sampleStoryState);
    const activeIds = goals.map(g => g.id);
    assert.ok(activeIds.includes('protect-crew'));
    assert.ok(activeIds.includes('standby'));
  },

  'getActiveGoals excludes status=background when trigger not met': () => {
    const goals = getActiveGoals(sampleNpc, sampleStoryState);
    const ids = goals.map(g => g.id);
    assert.ok(!ids.includes('maintain-weapons'));
  },

  'getActiveGoals includes background goal when trigger met': () => {
    const stateWithDamage = {
      ...sampleStoryState,
      flags: { ...sampleStoryState.flags, weapons_damaged: true }
    };
    const goals = getActiveGoals(sampleNpc, stateWithDamage);
    const ids = goals.map(g => g.id);
    assert.ok(ids.includes('maintain-weapons'));
  },

  'getActiveGoals handles NPC with no goals': () => {
    const npcNoGoals = { id: 'npc1', name: 'No Goals' };
    const goals = getActiveGoals(npcNoGoals, sampleStoryState);
    assert.ok(Array.isArray(goals));
    assert.equal(goals.length, 0);
  },

  'getActiveGoals handles null NPC': () => {
    const goals = getActiveGoals(null, sampleStoryState);
    assert.ok(Array.isArray(goals));
    assert.equal(goals.length, 0);
  },

  'getActiveGoals handles null storyState': () => {
    const goals = getActiveGoals(sampleNpc, null);
    assert.ok(Array.isArray(goals));
  }
};

// === PRIORITY ORDERING TESTS ===

const priorityTests = {
  'getGoalsByPriority returns goals sorted by priority': () => {
    const goals = getGoalsByPriority(sampleNpc.goals);
    assert.equal(goals[0].priority, 1);
    assert.equal(goals[1].priority, 2);
    assert.equal(goals[2].priority, 3);
  },

  'getGoalsByPriority handles empty array': () => {
    const goals = getGoalsByPriority([]);
    assert.ok(Array.isArray(goals));
    assert.equal(goals.length, 0);
  },

  'getGoalsByPriority handles null': () => {
    const goals = getGoalsByPriority(null);
    assert.ok(Array.isArray(goals));
    assert.equal(goals.length, 0);
  },

  'getGoalsByPriority preserves goal data': () => {
    const goals = getGoalsByPriority(sampleNpc.goals);
    const protectCrew = goals.find(g => g.id === 'protect-crew');
    assert.ok(protectCrew);
    assert.equal(protectCrew.description, 'Protect crew from threats');
  }
};

// === GOAL TRIGGER TESTS ===

const triggerTests = {
  'isGoalTriggered returns true when flag matches': () => {
    const goal = {
      trigger: { flag: 'weapons_damaged', value: true }
    };
    const state = { flags: { weapons_damaged: true } };
    assert.equal(isGoalTriggered(goal, state), true);
  },

  'isGoalTriggered returns false when flag does not match': () => {
    const goal = {
      trigger: { flag: 'weapons_damaged', value: true }
    };
    const state = { flags: { weapons_damaged: false } };
    assert.equal(isGoalTriggered(goal, state), false);
  },

  'isGoalTriggered returns true for goal without trigger': () => {
    const goal = { id: 'always-active' };
    const state = { flags: {} };
    assert.equal(isGoalTriggered(goal, state), true);
  },

  'isGoalTriggered handles missing flag in state': () => {
    const goal = {
      trigger: { flag: 'missing_flag', value: true }
    };
    const state = { flags: {} };
    assert.equal(isGoalTriggered(goal, state), false);
  },

  'isGoalTriggered handles beat trigger': () => {
    const goal = {
      trigger: { beat: 'eruption_begins' }
    };
    const state = { completedBeats: ['eruption_begins'] };
    assert.equal(isGoalTriggered(goal, state), true);
  },

  'isGoalTriggered handles beat trigger not met': () => {
    const goal = {
      trigger: { beat: 'eruption_begins' }
    };
    const state = { completedBeats: [] };
    assert.equal(isGoalTriggered(goal, state), false);
  },

  'isGoalTriggered handles null goal': () => {
    assert.equal(isGoalTriggered(null, sampleStoryState), false);
  },

  'isGoalTriggered handles null state': () => {
    const goal = { trigger: { flag: 'test', value: true } };
    assert.equal(isGoalTriggered(goal, null), false);
  }
};

// === SHOULD ACT ON GOAL TESTS ===

const shouldActTests = {
  'shouldActOnGoal returns true for active triggered goal': () => {
    const goal = {
      id: 'test-goal',
      status: 'active',
      trigger: { flag: 'ready', value: true }
    };
    const state = { flags: { ready: true } };
    assert.equal(shouldActOnGoal(goal, state, '015-1105'), true);
  },

  'shouldActOnGoal returns false for cooldown period': () => {
    const goal = {
      id: 'test-goal',
      status: 'active',
      cooldown: { hours: 24 },
      lastActed: '015-1105'
    };
    const state = { flags: {} };
    // Same day - should be in cooldown
    assert.equal(shouldActOnGoal(goal, state, '015-1105'), false);
  },

  'shouldActOnGoal returns true after cooldown expires': () => {
    const goal = {
      id: 'test-goal',
      status: 'active',
      cooldown: { hours: 24 },
      lastActed: '010-1105'
    };
    const state = { flags: {} };
    // 5 days later - cooldown expired
    assert.equal(shouldActOnGoal(goal, state, '015-1105'), true);
  },

  'shouldActOnGoal returns false for completed goal': () => {
    const goal = {
      id: 'test-goal',
      status: 'completed'
    };
    assert.equal(shouldActOnGoal(goal, {}, '015-1105'), false);
  },

  'shouldActOnGoal handles null goal': () => {
    assert.equal(shouldActOnGoal(null, {}, '015-1105'), false);
  }
};

// === GET GOAL ACTIONS TESTS ===

const goalActionsTests = {
  'getGoalActions returns actions array': () => {
    const goal = { actions: ['action1', 'action2'] };
    const actions = getGoalActions(goal);
    assert.ok(Array.isArray(actions));
    assert.equal(actions.length, 2);
  },

  'getGoalActions returns empty array for goal without actions': () => {
    const goal = { id: 'no-actions' };
    const actions = getGoalActions(goal);
    assert.ok(Array.isArray(actions));
    assert.equal(actions.length, 0);
  },

  'getGoalActions handles null goal': () => {
    const actions = getGoalActions(null);
    assert.ok(Array.isArray(actions));
    assert.equal(actions.length, 0);
  }
};

// === UPDATE GOAL STATUS TESTS ===

const updateStatusTests = {
  'updateGoalStatus changes status': () => {
    const npc = {
      goals: [{ id: 'goal1', status: 'active' }]
    };
    updateGoalStatus(npc, 'goal1', 'completed');
    assert.equal(npc.goals[0].status, 'completed');
  },

  'updateGoalStatus sets lastActed timestamp': () => {
    const npc = {
      goals: [{ id: 'goal1', status: 'active' }]
    };
    updateGoalStatus(npc, 'goal1', 'active', '015-1105');
    assert.equal(npc.goals[0].lastActed, '015-1105');
  },

  'updateGoalStatus handles unknown goal gracefully': () => {
    const npc = { goals: [] };
    assert.doesNotThrow(() => updateGoalStatus(npc, 'unknown', 'active'));
  },

  'updateGoalStatus handles null npc': () => {
    assert.doesNotThrow(() => updateGoalStatus(null, 'goal1', 'active'));
  }
};

// === INTEGRATION TESTS ===

const integrationTests = {
  'full flow: get active goals sorted by priority': () => {
    const stateWithThreat = {
      flags: { threat_detected: true },
      completedBeats: []
    };

    const activeGoals = getActiveGoals(sampleNpc, stateWithThreat);
    const sorted = getGoalsByPriority(activeGoals);

    // Should include protect-crew (priority 1) and standby (priority 3)
    assert.ok(sorted.length >= 2);
    assert.equal(sorted[0].id, 'protect-crew'); // priority 1 first
  },

  'background goal activates when condition met': () => {
    const stateWithDamage = {
      flags: { weapons_damaged: true },
      completedBeats: []
    };

    const activeGoals = getActiveGoals(sampleNpc, stateWithDamage);
    const maintainGoal = activeGoals.find(g => g.id === 'maintain-weapons');

    assert.ok(maintainGoal, 'maintain-weapons should be active when weapons_damaged=true');
  },

  'module exports are defined': () => {
    assert.ok(typeof getActiveGoals === 'function');
    assert.ok(typeof getGoalsByPriority === 'function');
    assert.ok(typeof isGoalTriggered === 'function');
    assert.ok(typeof shouldActOnGoal === 'function');
    assert.ok(typeof getGoalActions === 'function');
    assert.ok(typeof updateGoalStatus === 'function');
  }
};

// === RUN ALL TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  NPC GOALS TESTS');
console.log('══════════════════════════════════════════\n');

console.log('--- Active Goals Tests ---');
const activeGoals = runTests(activeGoalsTests);

console.log('\n--- Priority Ordering Tests ---');
const priority = runTests(priorityTests);

console.log('\n--- Goal Trigger Tests ---');
const triggers = runTests(triggerTests);

console.log('\n--- Should Act Tests ---');
const shouldAct = runTests(shouldActTests);

console.log('\n--- Goal Actions Tests ---');
const goalActions = runTests(goalActionsTests);

console.log('\n--- Update Status Tests ---');
const updateStatus = runTests(updateStatusTests);

console.log('\n--- Integration Tests ---');
const integration = runTests(integrationTests);

const allPassed = activeGoals && priority && triggers && shouldAct && goalActions && updateStatus && integration;
process.exit(allPassed ? 0 : 1);
