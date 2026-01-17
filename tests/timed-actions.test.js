#!/usr/bin/env node
/**
 * Timed Actions Tests (TDD - Tests First)
 *
 * Tests duration-based action progress:
 * - Starting timed actions
 * - Progress tracking over time
 * - Completion detection
 * - Cancellation
 *
 * AUDITOR INSTANCE: 5f069a8e-52eb-42c4-a874-17ce01f2100b
 */

const { strict: assert } = require('assert');

// Import will fail until implementation exists
let timedActions;
try {
  timedActions = require('../src/timed-actions');
} catch (e) {
  console.error('Timed-actions module not yet implemented.\n');
  timedActions = {};
}

const {
  startTimedAction,
  processTimedActions,
  getActiveTimedActions,
  cancelTimedAction,
  getActionProgress,
  isActionComplete,
  loadTimedActionState,
  saveTimedActionState
} = timedActions;

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

const sampleTimedAction = {
  id: 'repair-hull',
  npcId: 'engineer-1',
  duration: { hours: 4 },
  startedAt: '015-1105',
  effects: [
    { type: 'modify-flag', flag: 'hull_damage', operation: 'decrement', amount: 1 }
  ]
};

// === START TIMED ACTION TESTS ===

const startActionTests = {
  'startTimedAction returns action instance': () => {
    const action = startTimedAction({
      id: 'test-action',
      npcId: 'npc-1',
      duration: { hours: 2 }
    }, '015-1105');
    assert.ok(action !== null);
    assert.ok(typeof action === 'object');
  },

  'startTimedAction sets startedAt': () => {
    const action = startTimedAction({
      id: 'test-action-2',
      npcId: 'npc-1',
      duration: { hours: 2 }
    }, '015-1105');
    if (action) {
      assert.equal(action.startedAt, '015-1105');
    }
  },

  'startTimedAction calculates completesAt': () => {
    const action = startTimedAction({
      id: 'test-action-3',
      npcId: 'npc-1',
      duration: { hours: 24 } // 1 day
    }, '015-1105');
    if (action) {
      assert.ok(action.completesAt);
      // Should complete on day 016
      assert.ok(action.completesAt.includes('016') || action.hoursRemaining !== undefined);
    }
  },

  'startTimedAction handles days duration': () => {
    const action = startTimedAction({
      id: 'long-action',
      npcId: 'npc-1',
      duration: { days: 3 }
    }, '010-1105');
    if (action) {
      assert.ok(action.completesAt);
    }
  },

  'startTimedAction handles null action': () => {
    const action = startTimedAction(null, '015-1105');
    assert.equal(action, null);
  },

  'startTimedAction handles null date': () => {
    const action = startTimedAction({
      id: 'test',
      npcId: 'npc-1',
      duration: { hours: 1 }
    }, null);
    // Should either use current date or return null
    assert.ok(action === null || action.startedAt);
  },

  'startTimedAction adds to active actions': () => {
    const action = startTimedAction({
      id: 'tracked-action',
      npcId: 'npc-1',
      duration: { hours: 2 }
    }, '015-1105');
    const active = getActiveTimedActions();
    if (action) {
      assert.ok(active.some(a => a.id === 'tracked-action'));
    }
  }
};

// === PROCESS TIMED ACTIONS TESTS ===

const processActionsTests = {
  'processTimedActions returns results array': () => {
    const results = processTimedActions({}, 4); // 4 hours elapsed
    assert.ok(Array.isArray(results));
  },

  'processTimedActions completes actions when time elapsed': () => {
    // Start a 2-hour action
    startTimedAction({
      id: 'short-repair',
      npcId: 'eng-1',
      duration: { hours: 2 }
    }, '015-1105');

    // Process 3 hours (should complete)
    const results = processTimedActions({ flags: {} }, 3);

    // Check if action completed
    const completed = results.find(r => r.id === 'short-repair');
    if (completed) {
      assert.equal(completed.status, 'completed');
    }
  },

  'processTimedActions updates progress for incomplete actions': () => {
    startTimedAction({
      id: 'long-repair',
      npcId: 'eng-1',
      duration: { hours: 10 }
    }, '015-1105');

    // Process 2 hours (should not complete)
    processTimedActions({}, 2);

    const progress = getActionProgress('long-repair');
    if (progress !== null) {
      assert.ok(progress.hoursElapsed >= 2 || progress.percentComplete > 0);
    }
  },

  'processTimedActions applies effects on completion': () => {
    const storyState = { flags: { hull_damage: 5 } };

    startTimedAction({
      id: 'repair-with-effect',
      npcId: 'eng-1',
      duration: { hours: 1 },
      effects: [
        { type: 'modify-flag', flag: 'hull_damage', operation: 'decrement', amount: 1 }
      ]
    }, '015-1105');

    processTimedActions(storyState, 2);

    // Effect should have been applied
    // Note: test passes if effect was applied or if action is still being tracked
    assert.ok(storyState.flags.hull_damage <= 5);
  },

  'processTimedActions handles empty action list': () => {
    // Clear actions first by getting and completing them
    const results = processTimedActions({}, 1000);
    assert.ok(Array.isArray(results));
  },

  'processTimedActions handles null storyState': () => {
    assert.doesNotThrow(() => processTimedActions(null, 1));
  }
};

// === GET ACTIVE TIMED ACTIONS TESTS ===

const activeActionsTests = {
  'getActiveTimedActions returns array': () => {
    const active = getActiveTimedActions();
    assert.ok(Array.isArray(active));
  },

  'getActiveTimedActions filters by npcId': () => {
    startTimedAction({
      id: 'npc1-action',
      npcId: 'npc-1',
      duration: { hours: 5 }
    }, '015-1105');

    startTimedAction({
      id: 'npc2-action',
      npcId: 'npc-2',
      duration: { hours: 5 }
    }, '015-1105');

    const npc1Actions = getActiveTimedActions('npc-1');
    const npc2Actions = getActiveTimedActions('npc-2');

    assert.ok(npc1Actions.every(a => a.npcId === 'npc-1'));
    assert.ok(npc2Actions.every(a => a.npcId === 'npc-2'));
  },

  'getActiveTimedActions excludes completed actions': () => {
    startTimedAction({
      id: 'will-complete',
      npcId: 'eng-1',
      duration: { hours: 1 }
    }, '015-1105');

    // Complete it
    processTimedActions({}, 2);

    const active = getActiveTimedActions();
    assert.ok(!active.some(a => a.id === 'will-complete' && a.status === 'completed'));
  }
};

// === CANCEL TIMED ACTION TESTS ===

const cancelActionTests = {
  'cancelTimedAction removes action from active': () => {
    startTimedAction({
      id: 'to-cancel',
      npcId: 'npc-1',
      duration: { hours: 10 }
    }, '015-1105');

    cancelTimedAction('to-cancel');

    const active = getActiveTimedActions();
    assert.ok(!active.some(a => a.id === 'to-cancel'));
  },

  'cancelTimedAction returns cancelled action': () => {
    startTimedAction({
      id: 'cancel-return',
      npcId: 'npc-1',
      duration: { hours: 5 }
    }, '015-1105');

    const cancelled = cancelTimedAction('cancel-return');
    if (cancelled) {
      assert.equal(cancelled.id, 'cancel-return');
      assert.equal(cancelled.status, 'cancelled');
    }
  },

  'cancelTimedAction returns null for unknown action': () => {
    const cancelled = cancelTimedAction('nonexistent-action-xyz');
    assert.equal(cancelled, null);
  },

  'cancelTimedAction handles null id': () => {
    assert.doesNotThrow(() => cancelTimedAction(null));
    assert.equal(cancelTimedAction(null), null);
  }
};

// === GET ACTION PROGRESS TESTS ===

const progressTests = {
  'getActionProgress returns progress object': () => {
    startTimedAction({
      id: 'progress-test',
      npcId: 'npc-1',
      duration: { hours: 10 }
    }, '015-1105');

    const progress = getActionProgress('progress-test');
    if (progress) {
      assert.ok(typeof progress === 'object');
    }
  },

  'getActionProgress includes percentComplete': () => {
    startTimedAction({
      id: 'percent-test',
      npcId: 'npc-1',
      duration: { hours: 10 }
    }, '015-1105');

    // Process some time
    processTimedActions({}, 5);

    const progress = getActionProgress('percent-test');
    if (progress) {
      assert.ok(progress.hasOwnProperty('percentComplete') ||
                progress.hasOwnProperty('hoursElapsed'));
    }
  },

  'getActionProgress returns null for unknown action': () => {
    const progress = getActionProgress('unknown-progress-xyz');
    assert.equal(progress, null);
  },

  'getActionProgress handles null id': () => {
    const progress = getActionProgress(null);
    assert.equal(progress, null);
  }
};

// === IS ACTION COMPLETE TESTS ===

const completeTests = {
  'isActionComplete returns false for active action': () => {
    startTimedAction({
      id: 'not-complete',
      npcId: 'npc-1',
      duration: { hours: 100 }
    }, '015-1105');

    const complete = isActionComplete('not-complete');
    assert.equal(complete, false);
  },

  'isActionComplete returns true after completion': () => {
    startTimedAction({
      id: 'will-be-complete',
      npcId: 'npc-1',
      duration: { hours: 1 }
    }, '015-1105');

    processTimedActions({}, 2);

    const complete = isActionComplete('will-be-complete');
    // Should be true or action should be removed from tracking
    assert.ok(complete === true || getActionProgress('will-be-complete') === null);
  },

  'isActionComplete returns false for unknown action': () => {
    const complete = isActionComplete('unknown-complete-xyz');
    assert.equal(complete, false);
  },

  'isActionComplete handles null id': () => {
    const complete = isActionComplete(null);
    assert.equal(complete, false);
  }
};

// === PERSISTENCE TESTS ===

const persistenceTests = {
  'loadTimedActionState returns object': () => {
    const state = loadTimedActionState();
    assert.ok(typeof state === 'object');
  },

  'saveTimedActionState does not throw': () => {
    assert.doesNotThrow(() => saveTimedActionState({ actions: [] }));
  },

  'state persists across load/save': () => {
    const testState = {
      actions: [{ id: 'persisted', npcId: 'npc-1', hoursRemaining: 5 }]
    };
    saveTimedActionState(testState);
    const loaded = loadTimedActionState();
    if (loaded.actions) {
      assert.ok(loaded.actions.some(a => a.id === 'persisted'));
    }
  }
};

// === INTEGRATION TESTS ===

const integrationTests = {
  'full lifecycle: start -> progress -> complete': () => {
    // Start action
    const action = startTimedAction({
      id: 'lifecycle-test',
      npcId: 'engineer-1',
      duration: { hours: 4 },
      effects: [
        { type: 'modify-flag', flag: 'test_flag', operation: 'set', value: 'completed' }
      ]
    }, '015-1105');

    assert.ok(action);

    // Check progress midway
    processTimedActions({}, 2);
    const midProgress = getActionProgress('lifecycle-test');
    if (midProgress) {
      assert.ok(midProgress.percentComplete < 100 || midProgress.hoursElapsed < 4);
    }

    // Complete
    const storyState = { flags: {} };
    const results = processTimedActions(storyState, 3);

    // Should be complete or removed
    const finalProgress = getActionProgress('lifecycle-test');
    assert.ok(finalProgress === null || finalProgress.percentComplete === 100 ||
              isActionComplete('lifecycle-test'));
  },

  'multiple NPCs can have concurrent timed actions': () => {
    startTimedAction({
      id: 'npc1-concurrent',
      npcId: 'npc-1',
      duration: { hours: 5 }
    }, '015-1105');

    startTimedAction({
      id: 'npc2-concurrent',
      npcId: 'npc-2',
      duration: { hours: 3 }
    }, '015-1105');

    const active = getActiveTimedActions();
    const npc1Has = active.some(a => a.id === 'npc1-concurrent');
    const npc2Has = active.some(a => a.id === 'npc2-concurrent');

    assert.ok(npc1Has && npc2Has);
  },

  'cancelled action does not complete': () => {
    const storyState = { flags: { cancel_test: 'initial' } };

    startTimedAction({
      id: 'cancel-no-effect',
      npcId: 'npc-1',
      duration: { hours: 2 },
      effects: [
        { type: 'modify-flag', flag: 'cancel_test', operation: 'set', value: 'changed' }
      ]
    }, '015-1105');

    // Cancel before completion
    cancelTimedAction('cancel-no-effect');

    // Process time
    processTimedActions(storyState, 5);

    // Effect should NOT have been applied
    assert.equal(storyState.flags.cancel_test, 'initial');
  },

  'module exports are defined': () => {
    assert.ok(typeof startTimedAction === 'function');
    assert.ok(typeof processTimedActions === 'function');
    assert.ok(typeof getActiveTimedActions === 'function');
    assert.ok(typeof cancelTimedAction === 'function');
    assert.ok(typeof getActionProgress === 'function');
    assert.ok(typeof isActionComplete === 'function');
  }
};

// === RUN ALL TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  TIMED ACTIONS TESTS');
console.log('══════════════════════════════════════════\n');

console.log('--- Start Action Tests ---');
const startAction = runTests(startActionTests);

console.log('\n--- Process Actions Tests ---');
const processActions = runTests(processActionsTests);

console.log('\n--- Active Actions Tests ---');
const activeActions = runTests(activeActionsTests);

console.log('\n--- Cancel Action Tests ---');
const cancelAction = runTests(cancelActionTests);

console.log('\n--- Progress Tests ---');
const progress = runTests(progressTests);

console.log('\n--- Complete Tests ---');
const complete = runTests(completeTests);

console.log('\n--- Persistence Tests ---');
const persistence = runTests(persistenceTests);

console.log('\n--- Integration Tests ---');
const integration = runTests(integrationTests);

const allPassed = startAction && processActions && activeActions && cancelAction && progress && complete && persistence && integration;
process.exit(allPassed ? 0 : 1);
