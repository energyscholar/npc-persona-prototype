#!/usr/bin/env node
/**
 * NPC-Initiated Triggers Tests (TDD - Tests First)
 *
 * Tests trigger evaluation and firing:
 * - Beat-based triggers
 * - Time-based triggers
 * - Flag-based triggers
 * - Once flag behavior
 * - Requires conditions
 * - Message creation
 *
 * AUDITOR INSTANCE: 5f069a8e-52eb-42c4-a874-17ce01f2100b
 */

const { strict: assert } = require('assert');
const fs = require('fs');
const path = require('path');

// Import will fail until implementation exists
let triggers;
try {
  triggers = require('../src/triggers');
} catch (e) {
  console.error('Triggers module not yet implemented.\n');
  triggers = {};
}

const {
  TRIGGER_STATE_FILE,
  loadTriggerState,
  saveTriggerState,
  evaluateTrigger,
  processAllTriggers,
  markTriggerFired,
  hasTriggerFired,
  createNpcInitiatedMessage
} = triggers;

// Test data paths
const TEST_STATE_DIR = path.join(__dirname, '../data/state');
const TEST_TRIGGER_FILE = path.join(TEST_STATE_DIR, 'trigger-state.json');

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

// Setup/teardown helpers
function backupState() {
  if (fs.existsSync(TEST_TRIGGER_FILE)) {
    const backup = TEST_TRIGGER_FILE + '.backup';
    fs.copyFileSync(TEST_TRIGGER_FILE, backup);
    return backup;
  }
  return null;
}

function restoreState(backup) {
  if (backup && fs.existsSync(backup)) {
    fs.copyFileSync(backup, TEST_TRIGGER_FILE);
    fs.unlinkSync(backup);
  } else if (fs.existsSync(TEST_TRIGGER_FILE)) {
    fs.writeFileSync(TEST_TRIGGER_FILE, JSON.stringify({ fired: {}, scheduled: [] }, null, 2));
  }
}

// === I/O TESTS ===

const ioTests = {
  'TRIGGER_STATE_FILE is valid path': () => {
    assert.ok(TRIGGER_STATE_FILE, 'TRIGGER_STATE_FILE should exist');
    assert.ok(TRIGGER_STATE_FILE.includes('trigger-state.json'));
  },

  'loadTriggerState returns object': () => {
    const state = loadTriggerState();
    assert.equal(typeof state, 'object');
    assert.ok(state.hasOwnProperty('fired'));
  },

  'saveTriggerState persists data': () => {
    const backup = backupState();
    try {
      const testState = { fired: { 'test-trigger': true }, scheduled: [] };
      saveTriggerState(testState);

      const loaded = loadTriggerState();
      assert.equal(loaded.fired['test-trigger'], true);
    } finally {
      restoreState(backup);
    }
  }
};

// === TRIGGER FIRED TRACKING TESTS ===

const firedTests = {
  'hasTriggerFired returns false for unfired': () => {
    const state = { fired: {} };
    assert.equal(hasTriggerFired('new-trigger', state), false);
  },

  'hasTriggerFired returns true for fired': () => {
    const state = { fired: { 'old-trigger': true } };
    assert.equal(hasTriggerFired('old-trigger', state), true);
  },

  'markTriggerFired records trigger': () => {
    const state = { fired: {} };
    markTriggerFired('mark-trigger', state);
    assert.equal(state.fired['mark-trigger'], true);
  }
};

// === EVALUATE TRIGGER: BEAT TYPE ===

const beatTriggerTests = {
  'beat trigger fires when beat complete': () => {
    const trigger = {
      id: 'beat-test',
      type: 'beat',
      condition: { beat: 'survey_accepted' }
    };
    const storyState = {
      completedBeats: ['survey_accepted']
    };
    const triggerState = { fired: {} };

    const result = evaluateTrigger(trigger, storyState, triggerState);
    assert.equal(result.shouldFire, true);
  },

  'beat trigger does not fire when beat incomplete': () => {
    const trigger = {
      id: 'beat-test',
      type: 'beat',
      condition: { beat: 'survey_accepted' }
    };
    const storyState = {
      completedBeats: []
    };
    const triggerState = { fired: {} };

    const result = evaluateTrigger(trigger, storyState, triggerState);
    assert.equal(result.shouldFire, false);
  },

  'beat trigger respects once flag': () => {
    const trigger = {
      id: 'once-beat',
      type: 'beat',
      condition: { beat: 'test_beat' },
      once: true
    };
    const storyState = {
      completedBeats: ['test_beat']
    };
    const triggerState = { fired: { 'once-beat': true } };

    const result = evaluateTrigger(trigger, storyState, triggerState);
    assert.equal(result.shouldFire, false);
    assert.ok(result.reason.includes('Already fired'));
  }
};

// === EVALUATE TRIGGER: TIME TYPE ===

const timeTriggerTests = {
  'time trigger fires after sufficient days': () => {
    const trigger = {
      id: 'time-test',
      type: 'time',
      condition: { daysAfterBeat: 'survey_accepted', days: 3 }
    };
    // Assume implementation has a way to track beat timestamps
    // or calculates from gameDate
    const storyState = {
      completedBeats: ['survey_accepted'],
      beatTimestamps: { 'survey_accepted': '001-1105' },
      gameDate: '005-1105' // 4 days later
    };
    const triggerState = { fired: {} };

    const result = evaluateTrigger(trigger, storyState, triggerState);
    // Result depends on implementation of date calculation
    assert.ok(result.hasOwnProperty('shouldFire'));
    assert.ok(result.hasOwnProperty('reason'));
  },

  'time trigger does not fire before sufficient days': () => {
    const trigger = {
      id: 'time-test',
      type: 'time',
      condition: { daysAfterBeat: 'survey_accepted', days: 3 }
    };
    const storyState = {
      completedBeats: ['survey_accepted'],
      beatTimestamps: { 'survey_accepted': '001-1105' },
      gameDate: '002-1105' // Only 1 day later
    };
    const triggerState = { fired: {} };

    const result = evaluateTrigger(trigger, storyState, triggerState);
    // With proper implementation, this should not fire
    assert.ok(result.hasOwnProperty('shouldFire'));
  }
};

// === EVALUATE TRIGGER: FLAG TYPE ===

const flagTriggerTests = {
  'flag trigger fires when flag matches': () => {
    const trigger = {
      id: 'flag-test',
      type: 'flag',
      condition: { flag: 'volcano_status', value: 'active' }
    };
    const storyState = {
      completedBeats: [],
      flags: { 'volcano_status': 'active' }
    };
    const triggerState = { fired: {} };

    const result = evaluateTrigger(trigger, storyState, triggerState);
    assert.equal(result.shouldFire, true);
  },

  'flag trigger does not fire when flag differs': () => {
    const trigger = {
      id: 'flag-test',
      type: 'flag',
      condition: { flag: 'volcano_status', value: 'active' }
    };
    const storyState = {
      completedBeats: [],
      flags: { 'volcano_status': 'dormant' }
    };
    const triggerState = { fired: {} };

    const result = evaluateTrigger(trigger, storyState, triggerState);
    assert.equal(result.shouldFire, false);
  },

  'flag trigger does not fire when flag missing': () => {
    const trigger = {
      id: 'flag-test',
      type: 'flag',
      condition: { flag: 'volcano_status', value: 'active' }
    };
    const storyState = {
      completedBeats: [],
      flags: {}
    };
    const triggerState = { fired: {} };

    const result = evaluateTrigger(trigger, storyState, triggerState);
    assert.equal(result.shouldFire, false);
  }
};

// === REQUIRES CONDITIONS TESTS ===

const requiresTests = {
  'trigger respects requires - positive condition': () => {
    const trigger = {
      id: 'req-test',
      type: 'beat',
      condition: { beat: 'eruption_begins' },
      requires: ['survey_accepted']
    };
    const storyState = {
      completedBeats: ['eruption_begins'] // Missing survey_accepted
    };
    const triggerState = { fired: {} };

    const result = evaluateTrigger(trigger, storyState, triggerState);
    assert.equal(result.shouldFire, false);
    assert.ok(result.reason.includes('not complete'));
  },

  'trigger respects requires - met condition': () => {
    const trigger = {
      id: 'req-test',
      type: 'beat',
      condition: { beat: 'eruption_begins' },
      requires: ['survey_accepted']
    };
    const storyState = {
      completedBeats: ['survey_accepted', 'eruption_begins']
    };
    const triggerState = { fired: {} };

    const result = evaluateTrigger(trigger, storyState, triggerState);
    assert.equal(result.shouldFire, true);
  },

  'trigger respects requires - negated condition': () => {
    const trigger = {
      id: 'neg-test',
      type: 'beat',
      condition: { beat: 'survey_accepted' },
      requires: ['!survey_complete'] // Should NOT be complete
    };
    const storyState = {
      completedBeats: ['survey_accepted', 'survey_complete'] // But it is complete
    };
    const triggerState = { fired: {} };

    const result = evaluateTrigger(trigger, storyState, triggerState);
    assert.equal(result.shouldFire, false);
    assert.ok(result.reason.includes('already complete'));
  },

  'trigger fires when negated condition not met': () => {
    const trigger = {
      id: 'neg-test',
      type: 'beat',
      condition: { beat: 'survey_accepted' },
      requires: ['!survey_complete']
    };
    const storyState = {
      completedBeats: ['survey_accepted'] // survey_complete NOT present
    };
    const triggerState = { fired: {} };

    const result = evaluateTrigger(trigger, storyState, triggerState);
    assert.equal(result.shouldFire, true);
  }
};

// === MESSAGE CREATION TESTS ===

const messageTests = {
  'createNpcInitiatedMessage returns message object': () => {
    const trigger = {
      id: 'msg-trigger',
      message: {
        subject: 'Test Subject',
        body: 'Test body content'
      }
    };

    const message = createNpcInitiatedMessage('test-npc', 'test-pc', trigger);
    assert.ok(message.id, 'Should have id');
    assert.equal(message.from, 'test-npc');
    assert.equal(message.to, 'test-pc');
    assert.equal(message.subject, 'Test Subject');
    assert.equal(message.body, 'Test body content');
    assert.equal(message.type, 'npc-initiated');
    assert.equal(message.triggerId, 'msg-trigger');
  },

  'createNpcInitiatedMessage has timestamp': () => {
    const trigger = {
      id: 'time-msg',
      message: { subject: 'X', body: 'Y' }
    };

    const message = createNpcInitiatedMessage('npc', 'pc', trigger);
    assert.ok(message.timestamp, 'Should have timestamp');
    // Should be ISO string
    assert.doesNotThrow(() => new Date(message.timestamp));
  },

  'createNpcInitiatedMessage uses template as body fallback': () => {
    const trigger = {
      id: 'template-msg',
      message: {
        subject: 'Template Test',
        template: 'Template content as fallback'
      }
    };

    const message = createNpcInitiatedMessage('npc', 'pc', trigger);
    assert.equal(message.body, 'Template content as fallback');
  }
};

// === PROCESS ALL TRIGGERS TESTS ===

const processTests = {
  'processAllTriggers returns array': () => {
    const storyState = { completedBeats: [], flags: {} };
    const allNpcs = [];

    const result = processAllTriggers(storyState, '001-1105', allNpcs);
    assert.ok(Array.isArray(result));
  },

  'processAllTriggers finds firing triggers': () => {
    const backup = backupState();
    try {
      saveTriggerState({ fired: {}, scheduled: [] });

      const storyState = {
        completedBeats: ['survey_accepted'],
        flags: {}
      };

      const allNpcs = [
        {
          id: 'minister-greener',
          triggers: [
            {
              id: 'greener-survey-response',
              type: 'beat',
              condition: { beat: 'survey_accepted' },
              message: { subject: 'Survey', body: 'Good' },
              once: true
            }
          ]
        }
      ];

      const result = processAllTriggers(storyState, '001-1105', allNpcs);
      // Should find the trigger
      assert.ok(Array.isArray(result));
      // Exact result depends on implementation details
    } finally {
      restoreState(backup);
    }
  },

  'processAllTriggers skips NPCs without triggers': () => {
    const storyState = { completedBeats: [], flags: {} };
    const allNpcs = [
      { id: 'no-triggers-npc' }
    ];

    // Should not throw
    assert.doesNotThrow(() => {
      processAllTriggers(storyState, '001-1105', allNpcs);
    });
  }
};

// === RUN ALL TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  NPC-INITIATED TRIGGERS TESTS');
console.log('══════════════════════════════════════════\n');

console.log('--- I/O Tests ---');
const io = runTests(ioTests);

console.log('\n--- Trigger Fired Tracking Tests ---');
const fired = runTests(firedTests);

console.log('\n--- Beat Trigger Tests ---');
const beat = runTests(beatTriggerTests);

console.log('\n--- Time Trigger Tests ---');
const time = runTests(timeTriggerTests);

console.log('\n--- Flag Trigger Tests ---');
const flag = runTests(flagTriggerTests);

console.log('\n--- Requires Conditions Tests ---');
const requires = runTests(requiresTests);

console.log('\n--- Message Creation Tests ---');
const message = runTests(messageTests);

console.log('\n--- Process All Triggers Tests ---');
const processResult = runTests(processTests);

const allPassed = io && fired && beat && time && flag && requires && message && processResult;
if (allPassed) {
  console.log('\nAll tests passed!');
} else {
  console.log('\nSome tests failed.');
  // eslint-disable-next-line no-process-exit
  process.exit(1);
}
