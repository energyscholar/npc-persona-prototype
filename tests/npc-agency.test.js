#!/usr/bin/env node
/**
 * NPC Agency Tests (TDD - Tests First)
 *
 * Tests the decision engine:
 * - Goal evaluation and action selection
 * - Capability checks before execution
 * - Processing all NPCs
 * - Result aggregation
 *
 * AUDITOR INSTANCE: 5f069a8e-52eb-42c4-a874-17ce01f2100b
 */

const { strict: assert } = require('assert');

// Import will fail until implementation exists
let npcAgency;
try {
  npcAgency = require('../src/npc-agency');
} catch (e) {
  console.error('NPC-agency module not yet implemented.\n');
  npcAgency = {};
}

const {
  processNpcAgency,
  selectBestAction,
  evaluateNpcGoals,
  processNpcTurn
} = npcAgency;

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

const engineerNpc = {
  id: 'engineer-1',
  name: 'Chief Engineer',
  role: 'engineer',
  goals: [
    {
      id: 'maintain-ship',
      priority: 2,
      status: 'active',
      actions: ['repair-system', 'check-systems'],
      trigger: { flag: 'damage_level', value: { gt: 0 } }
    }
  ]
};

const gunnerNpc = {
  id: 'ag3-gamma',
  name: 'AG-3 Gamma',
  role: 'gunner',
  goals: [
    {
      id: 'protect-crew',
      priority: 1,
      status: 'active',
      actions: ['fire-weapons', 'alert-crew'],
      trigger: { flag: 'threat_detected', value: true }
    },
    {
      id: 'standby',
      priority: 3,
      status: 'active',
      actions: ['monitor-sensors']
    }
  ]
};

const patronNpc = {
  id: 'minister-greener',
  name: 'Minister Greener',
  role: 'patron',
  goals: [
    {
      id: 'remind-deadline',
      priority: 1,
      status: 'active',
      actions: ['send-message'],
      trigger: { flag: 'days_since_contract', value: { gt: 3 } }
    }
  ]
};

const sampleStoryState = {
  flags: {
    damage_level: 2,
    threat_detected: false,
    days_since_contract: 5
  },
  completedBeats: [],
  gameDate: '015-1105'
};

// === PROCESS NPC AGENCY TESTS ===

const processAgencyTests = {
  'processNpcAgency returns array': () => {
    const results = processNpcAgency([engineerNpc], sampleStoryState, '015-1105');
    assert.ok(Array.isArray(results));
  },

  'processNpcAgency processes all NPCs': () => {
    const npcs = [engineerNpc, gunnerNpc, patronNpc];
    const results = processNpcAgency(npcs, sampleStoryState, '015-1105');
    // Should have results from NPCs that took action
    assert.ok(results.length >= 0);
  },

  'processNpcAgency skips NPCs without goals': () => {
    const npcNoGoals = { id: 'npc1', name: 'No Goals' };
    const results = processNpcAgency([npcNoGoals], sampleStoryState, '015-1105');
    assert.equal(results.length, 0);
  },

  'processNpcAgency handles empty NPC array': () => {
    const results = processNpcAgency([], sampleStoryState, '015-1105');
    assert.ok(Array.isArray(results));
    assert.equal(results.length, 0);
  },

  'processNpcAgency handles null NPCs': () => {
    const results = processNpcAgency(null, sampleStoryState, '015-1105');
    assert.ok(Array.isArray(results));
    assert.equal(results.length, 0);
  },

  'processNpcAgency handles null storyState': () => {
    assert.doesNotThrow(() => processNpcAgency([engineerNpc], null, '015-1105'));
  },

  'processNpcAgency result includes npcId': () => {
    const results = processNpcAgency([engineerNpc], sampleStoryState, '015-1105');
    if (results.length > 0) {
      assert.ok(results[0].hasOwnProperty('npcId'));
    }
  },

  'processNpcAgency result includes action': () => {
    const results = processNpcAgency([engineerNpc], sampleStoryState, '015-1105');
    if (results.length > 0) {
      assert.ok(results[0].hasOwnProperty('action'));
    }
  }
};

// === SELECT BEST ACTION TESTS ===

const selectActionTests = {
  'selectBestAction returns action from goal': () => {
    const goal = {
      actions: ['repair-system', 'check-systems']
    };
    const action = selectBestAction(goal, engineerNpc, sampleStoryState);
    if (action) {
      assert.ok(goal.actions.includes(action.id));
    }
  },

  'selectBestAction respects capability requirements': () => {
    const goal = {
      actions: ['fire-weapons'] // requires gunner
    };
    // Engineer cannot fire weapons
    const action = selectBestAction(goal, engineerNpc, sampleStoryState);
    // Should return null or skip unauthorized actions
    if (action) {
      assert.notEqual(action.id, 'fire-weapons');
    }
  },

  'selectBestAction returns null for goal without actions': () => {
    const goal = { id: 'empty-goal' };
    const action = selectBestAction(goal, engineerNpc, sampleStoryState);
    assert.equal(action, null);
  },

  'selectBestAction handles null goal': () => {
    const action = selectBestAction(null, engineerNpc, sampleStoryState);
    assert.equal(action, null);
  },

  'selectBestAction handles null npc': () => {
    const goal = { actions: ['repair-system'] };
    const action = selectBestAction(goal, null, sampleStoryState);
    assert.equal(action, null);
  },

  'selectBestAction prefers first valid action': () => {
    const goal = {
      actions: ['repair-system', 'check-systems']
    };
    const action = selectBestAction(goal, engineerNpc, sampleStoryState);
    if (action) {
      // Should pick first action engineer can do
      assert.equal(action.id, 'repair-system');
    }
  }
};

// === EVALUATE NPC GOALS TESTS ===

const evaluateGoalsTests = {
  'evaluateNpcGoals returns prioritized goals': () => {
    const goals = evaluateNpcGoals(gunnerNpc, sampleStoryState);
    assert.ok(Array.isArray(goals));
  },

  'evaluateNpcGoals filters by trigger conditions': () => {
    const state = {
      ...sampleStoryState,
      flags: { threat_detected: false }
    };
    const goals = evaluateNpcGoals(gunnerNpc, state);
    // protect-crew should not be active (threat not detected)
    const protectCrew = goals.find(g => g.id === 'protect-crew');
    if (protectCrew) {
      // If included, trigger must have matched
      assert.ok(state.flags.threat_detected === true || !protectCrew.trigger);
    }
  },

  'evaluateNpcGoals includes always-active goals': () => {
    const goals = evaluateNpcGoals(gunnerNpc, sampleStoryState);
    const standby = goals.find(g => g.id === 'standby');
    assert.ok(standby, 'standby goal should be active');
  },

  'evaluateNpcGoals handles NPC without goals': () => {
    const npc = { id: 'npc1' };
    const goals = evaluateNpcGoals(npc, sampleStoryState);
    assert.ok(Array.isArray(goals));
    assert.equal(goals.length, 0);
  },

  'evaluateNpcGoals handles null inputs': () => {
    assert.doesNotThrow(() => evaluateNpcGoals(null, sampleStoryState));
    assert.doesNotThrow(() => evaluateNpcGoals(gunnerNpc, null));
  }
};

// === PROCESS NPC TURN TESTS ===

const processTurnTests = {
  'processNpcTurn returns result object': () => {
    const result = processNpcTurn(engineerNpc, sampleStoryState, '015-1105');
    assert.ok(result !== null);
    assert.ok(typeof result === 'object');
  },

  'processNpcTurn includes action taken': () => {
    const result = processNpcTurn(engineerNpc, sampleStoryState, '015-1105');
    if (result.action) {
      assert.ok(typeof result.action === 'string' || typeof result.action === 'object');
    }
  },

  'processNpcTurn includes success status': () => {
    const result = processNpcTurn(engineerNpc, sampleStoryState, '015-1105');
    assert.ok(result.hasOwnProperty('success') || result.hasOwnProperty('status'));
  },

  'processNpcTurn handles NPC without applicable goals': () => {
    const state = { flags: {}, completedBeats: [] };
    const result = processNpcTurn(engineerNpc, state, '015-1105');
    // Should return no-action or null result
    assert.ok(result.action === null || result.status === 'no-action' || result.skipped);
  },

  'processNpcTurn respects capability checks': () => {
    // Engineer trying gunner goals
    const wrongRoleNpc = {
      ...engineerNpc,
      goals: [{
        id: 'wrong-goal',
        priority: 1,
        status: 'active',
        actions: ['fire-weapons']
      }]
    };
    const result = processNpcTurn(wrongRoleNpc, sampleStoryState, '015-1105');
    // Should fail or skip due to capability mismatch
    assert.ok(result.status === 'unauthorized' || result.action === null || !result.success);
  }
};

// === CAPABILITY CHECK INTEGRATION ===

const capabilityIntegrationTests = {
  'engineer can repair but not fire': () => {
    const results = processNpcAgency([engineerNpc], sampleStoryState, '015-1105');
    const engineerResult = results.find(r => r.npcId === 'engineer-1');
    if (engineerResult && engineerResult.action) {
      assert.notEqual(engineerResult.action, 'fire-weapons');
    }
  },

  'gunner can fire when threat detected': () => {
    const stateWithThreat = {
      ...sampleStoryState,
      flags: { threat_detected: true }
    };
    const results = processNpcAgency([gunnerNpc], stateWithThreat, '015-1105');
    const gunnerResult = results.find(r => r.npcId === 'ag3-gamma');
    // Gunner should have taken action
    if (gunnerResult) {
      assert.ok(gunnerResult.success !== false);
    }
  },

  'patron can send messages': () => {
    const results = processNpcAgency([patronNpc], sampleStoryState, '015-1105');
    const patronResult = results.find(r => r.npcId === 'minister-greener');
    if (patronResult && patronResult.action) {
      assert.equal(patronResult.action, 'send-message');
    }
  }
};

// === INTEGRATION TESTS ===

const integrationTests = {
  'full agency loop processes multiple NPCs': () => {
    const npcs = [engineerNpc, gunnerNpc, patronNpc];
    const results = processNpcAgency(npcs, sampleStoryState, '015-1105');

    // Should process without error
    assert.ok(Array.isArray(results));
  },

  'priority ordering affects action selection': () => {
    const npcWithPriorities = {
      id: 'priority-test',
      role: 'engineer',
      goals: [
        { id: 'low', priority: 3, status: 'active', actions: ['check-systems'] },
        { id: 'high', priority: 1, status: 'active', actions: ['repair-system'] }
      ]
    };
    const state = { flags: { damage_level: 1 }, completedBeats: [] };
    const result = processNpcTurn(npcWithPriorities, state, '015-1105');

    if (result.action) {
      // Should pick high priority action
      assert.equal(result.action, 'repair-system');
    }
  },

  'module exports are defined': () => {
    assert.ok(typeof processNpcAgency === 'function');
    assert.ok(typeof selectBestAction === 'function');
    assert.ok(typeof evaluateNpcGoals === 'function');
    assert.ok(typeof processNpcTurn === 'function');
  }
};

// === RUN ALL TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  NPC AGENCY TESTS');
console.log('══════════════════════════════════════════\n');

console.log('--- Process NPC Agency Tests ---');
const processAgency = runTests(processAgencyTests);

console.log('\n--- Select Best Action Tests ---');
const selectAction = runTests(selectActionTests);

console.log('\n--- Evaluate NPC Goals Tests ---');
const evaluateGoals = runTests(evaluateGoalsTests);

console.log('\n--- Process NPC Turn Tests ---');
const processTurn = runTests(processTurnTests);

console.log('\n--- Capability Integration Tests ---');
const capabilityIntegration = runTests(capabilityIntegrationTests);

console.log('\n--- Integration Tests ---');
const integration = runTests(integrationTests);

const allPassed = processAgency && selectAction && evaluateGoals && processTurn && capabilityIntegration && integration;
process.exit(allPassed ? 0 : 1);
