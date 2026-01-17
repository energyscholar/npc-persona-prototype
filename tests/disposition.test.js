#!/usr/bin/env node
/**
 * Disposition Tracking Tests (TDD - Tests First)
 *
 * Tests NPC-PC relationship tracking:
 * - Level management (-3 to +3)
 * - History recording
 * - Prompt modifier generation
 * - Beat-triggered changes
 * - Disposition caps
 *
 * AUDITOR INSTANCE: 5f069a8e-52eb-42c4-a874-17ce01f2100b
 */

const { strict: assert } = require('assert');
const fs = require('fs');
const path = require('path');

// Import will fail until implementation exists
let disposition;
try {
  disposition = require('../src/disposition');
} catch (e) {
  console.error('Disposition module not yet implemented.\n');
  disposition = {};
}

const {
  DISPOSITION_LABELS,
  DISPOSITION_FILE,
  loadDispositions,
  saveDispositions,
  getDisposition,
  modifyDisposition,
  getDispositionPromptModifier,
  getInitialDisposition,
  applyBeatModifier,
  checkDispositionCap
} = disposition;

// Test data
const TEST_STATE_DIR = path.join(__dirname, '../data/state');
const TEST_DISPOSITIONS_FILE = path.join(TEST_STATE_DIR, 'dispositions.json');

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
  if (fs.existsSync(TEST_DISPOSITIONS_FILE)) {
    const backup = TEST_DISPOSITIONS_FILE + '.backup';
    fs.copyFileSync(TEST_DISPOSITIONS_FILE, backup);
    return backup;
  }
  return null;
}

function restoreState(backup) {
  if (backup && fs.existsSync(backup)) {
    fs.copyFileSync(backup, TEST_DISPOSITIONS_FILE);
    fs.unlinkSync(backup);
  } else if (fs.existsSync(TEST_DISPOSITIONS_FILE)) {
    // Reset to empty state
    fs.writeFileSync(TEST_DISPOSITIONS_FILE, JSON.stringify({ relationships: {} }, null, 2));
  }
}

// === CONSTANTS TESTS ===

const constantsTests = {
  'DISPOSITION_LABELS contains all levels': () => {
    assert.ok(DISPOSITION_LABELS, 'DISPOSITION_LABELS should exist');
    assert.equal(DISPOSITION_LABELS['-3'], 'hostile');
    assert.equal(DISPOSITION_LABELS['-2'], 'unfriendly');
    assert.equal(DISPOSITION_LABELS['-1'], 'wary');
    assert.equal(DISPOSITION_LABELS['0'], 'neutral');
    assert.equal(DISPOSITION_LABELS['1'], 'favorable');
    assert.equal(DISPOSITION_LABELS['2'], 'friendly');
    assert.equal(DISPOSITION_LABELS['3'], 'allied');
  },

  'DISPOSITION_FILE is valid path': () => {
    assert.ok(DISPOSITION_FILE, 'DISPOSITION_FILE should exist');
    assert.ok(DISPOSITION_FILE.includes('dispositions.json'), 'Should point to dispositions.json');
  }
};

// === LOAD/SAVE TESTS ===

const ioTests = {
  'loadDispositions returns object': () => {
    const state = loadDispositions();
    assert.equal(typeof state, 'object');
    assert.ok(state.hasOwnProperty('relationships'), 'Should have relationships key');
  },

  'loadDispositions returns empty relationships for new file': () => {
    const state = loadDispositions();
    assert.ok(state.relationships, 'Should have relationships');
    assert.equal(typeof state.relationships, 'object');
  },

  'saveDispositions persists data': () => {
    const backup = backupState();
    try {
      const testState = {
        relationships: {
          'test-npc': {
            'test-pc': { level: 1, label: 'favorable', history: [], impressions: [] }
          }
        }
      };
      saveDispositions(testState);

      const loaded = loadDispositions();
      assert.deepEqual(loaded.relationships['test-npc']['test-pc'].level, 1);
    } finally {
      restoreState(backup);
    }
  }
};

// === GET DISPOSITION TESTS ===

const getDispositionTests = {
  'getDisposition returns default for unknown NPC': () => {
    const result = getDisposition('unknown-npc', 'unknown-pc');
    assert.equal(result.level, 0);
    assert.equal(result.label, 'neutral');
    assert.ok(Array.isArray(result.history));
    assert.ok(Array.isArray(result.impressions));
  },

  'getDisposition returns stored value': () => {
    const backup = backupState();
    try {
      saveDispositions({
        relationships: {
          'test-npc': {
            'test-pc': {
              level: 2,
              label: 'friendly',
              history: [{ change: 2, reason: 'test' }],
              impressions: ['helpful']
            }
          }
        }
      });

      const result = getDisposition('test-npc', 'test-pc');
      assert.equal(result.level, 2);
      assert.equal(result.label, 'friendly');
      assert.equal(result.history.length, 1);
      assert.equal(result.impressions[0], 'helpful');
    } finally {
      restoreState(backup);
    }
  },

  'getDisposition never throws': () => {
    // Should not throw even with bad input
    assert.doesNotThrow(() => getDisposition(null, null));
    assert.doesNotThrow(() => getDisposition(undefined, undefined));
    assert.doesNotThrow(() => getDisposition('', ''));
  }
};

// === MODIFY DISPOSITION TESTS ===

const modifyDispositionTests = {
  'modifyDisposition increases level': () => {
    const backup = backupState();
    try {
      const newLevel = modifyDisposition('mod-npc', 'mod-pc', 1, 'helped', '001-1105');
      assert.equal(newLevel, 1);

      const disp = getDisposition('mod-npc', 'mod-pc');
      assert.equal(disp.level, 1);
      assert.equal(disp.label, 'favorable');
    } finally {
      restoreState(backup);
    }
  },

  'modifyDisposition decreases level': () => {
    const backup = backupState();
    try {
      const newLevel = modifyDisposition('mod-npc', 'mod-pc', -2, 'insulted', '001-1105');
      assert.equal(newLevel, -2);

      const disp = getDisposition('mod-npc', 'mod-pc');
      assert.equal(disp.level, -2);
      assert.equal(disp.label, 'unfriendly');
    } finally {
      restoreState(backup);
    }
  },

  'modifyDisposition clamps to +3': () => {
    const backup = backupState();
    try {
      // Start at 2
      modifyDisposition('clamp-npc', 'clamp-pc', 2, 'start', '001-1105');
      // Try to add 5 more
      const newLevel = modifyDisposition('clamp-npc', 'clamp-pc', 5, 'huge bonus', '002-1105');
      assert.equal(newLevel, 3, 'Should clamp to 3');
    } finally {
      restoreState(backup);
    }
  },

  'modifyDisposition clamps to -3': () => {
    const backup = backupState();
    try {
      modifyDisposition('clamp-npc', 'clamp-pc', -2, 'start', '001-1105');
      const newLevel = modifyDisposition('clamp-npc', 'clamp-pc', -5, 'huge penalty', '002-1105');
      assert.equal(newLevel, -3, 'Should clamp to -3');
    } finally {
      restoreState(backup);
    }
  },

  'modifyDisposition records history': () => {
    const backup = backupState();
    try {
      modifyDisposition('hist-npc', 'hist-pc', 1, 'first change', '001-1105');
      modifyDisposition('hist-npc', 'hist-pc', 1, 'second change', '002-1105');

      const disp = getDisposition('hist-npc', 'hist-pc');
      assert.equal(disp.history.length, 2);
      assert.equal(disp.history[0].reason, 'first change');
      assert.equal(disp.history[0].date, '001-1105');
      assert.equal(disp.history[1].reason, 'second change');
    } finally {
      restoreState(backup);
    }
  },

  'modifyDisposition updates label correctly': () => {
    const backup = backupState();
    try {
      // Test each label transition
      modifyDisposition('label-npc', 'label-pc', -3, 'hostile', '001-1105');
      assert.equal(getDisposition('label-npc', 'label-pc').label, 'hostile');

      // Reset and check allied
      saveDispositions({ relationships: {} });
      modifyDisposition('label-npc', 'label-pc', 3, 'allied', '001-1105');
      assert.equal(getDisposition('label-npc', 'label-pc').label, 'allied');
    } finally {
      restoreState(backup);
    }
  }
};

// === PROMPT MODIFIER TESTS ===

const promptModifierTests = {
  'getDispositionPromptModifier returns string for all levels': () => {
    for (let level = -3; level <= 3; level++) {
      const modifier = getDispositionPromptModifier(level);
      assert.equal(typeof modifier, 'string', `Level ${level} should return string`);
      assert.ok(modifier.length > 0, `Level ${level} should return non-empty string`);
    }
  },

  'getDispositionPromptModifier hostile is negative': () => {
    const modifier = getDispositionPromptModifier(-3);
    assert.ok(
      modifier.toLowerCase().includes('hostile') ||
      modifier.toLowerCase().includes('cold') ||
      modifier.toLowerCase().includes('refuse'),
      'Hostile modifier should indicate negative attitude'
    );
  },

  'getDispositionPromptModifier neutral is balanced': () => {
    const modifier = getDispositionPromptModifier(0);
    assert.ok(
      modifier.toLowerCase().includes('neutral') ||
      modifier.toLowerCase().includes('professional'),
      'Neutral modifier should indicate balanced attitude'
    );
  },

  'getDispositionPromptModifier allied is positive': () => {
    const modifier = getDispositionPromptModifier(3);
    assert.ok(
      modifier.toLowerCase().includes('allied') ||
      modifier.toLowerCase().includes('friend') ||
      modifier.toLowerCase().includes('trust'),
      'Allied modifier should indicate positive attitude'
    );
  },

  'getDispositionPromptModifier handles out of range': () => {
    // Should not throw for out of range values
    assert.doesNotThrow(() => getDispositionPromptModifier(-5));
    assert.doesNotThrow(() => getDispositionPromptModifier(10));
  }
};

// === NPC CONFIG TESTS ===

const npcConfigTests = {
  'getInitialDisposition returns 0 for no config': () => {
    const result = getInitialDisposition({}, 'pc-id');
    assert.equal(result, 0);
  },

  'getInitialDisposition returns configured initial': () => {
    const npcConfig = {
      disposition: { initial: 1 }
    };
    const result = getInitialDisposition(npcConfig, 'pc-id');
    assert.equal(result, 1);
  },

  'getInitialDisposition applies species penalty': () => {
    const npcConfig = {
      disposition: {
        initial: 0,
        caps: { species_penalty: { 'Vargr': -1 } }
      }
    };
    // Mock PC with Vargr species would need to be handled by implementation
    // This test verifies the function exists and handles basic case
    const result = getInitialDisposition(npcConfig, 'pc-id');
    assert.equal(typeof result, 'number');
  },

  'applyBeatModifier finds matching trigger': () => {
    const backup = backupState();
    try {
      const npcConfig = {
        disposition: {
          modifiers: [
            { trigger: 'survey_accepted', change: 1 },
            { trigger: 'chauffeur_rescue', change: 2 }
          ]
        }
      };

      const result = applyBeatModifier('beat-npc', 'beat-pc', 'survey_accepted', npcConfig);
      assert.equal(result, 1, 'Should return new level after applying +1');
    } finally {
      restoreState(backup);
    }
  },

  'applyBeatModifier returns null for no match': () => {
    const npcConfig = {
      disposition: {
        modifiers: [
          { trigger: 'survey_accepted', change: 1 }
        ]
      }
    };

    const result = applyBeatModifier('npc', 'pc', 'unknown_beat', npcConfig);
    assert.equal(result, null);
  },

  'checkDispositionCap enforces max_without_deed': () => {
    const npcConfig = {
      disposition: {
        caps: { max_without_deed: 1 }
      }
    };

    const capped = checkDispositionCap(npcConfig, 2);
    assert.equal(capped, 1, 'Should cap at max_without_deed');
  },

  'checkDispositionCap allows below cap': () => {
    const npcConfig = {
      disposition: {
        caps: { max_without_deed: 2 }
      }
    };

    const result = checkDispositionCap(npcConfig, 1);
    assert.equal(result, 1, 'Should not change value below cap');
  },

  'checkDispositionCap returns value when no cap': () => {
    const result = checkDispositionCap({}, 3);
    assert.equal(result, 3, 'Should return unchanged when no cap');
  }
};

// === RUN ALL TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  DISPOSITION TRACKING TESTS');
console.log('══════════════════════════════════════════\n');

console.log('--- Constants Tests ---');
const constants = runTests(constantsTests);

console.log('\n--- I/O Tests ---');
const io = runTests(ioTests);

console.log('\n--- Get Disposition Tests ---');
const get = runTests(getDispositionTests);

console.log('\n--- Modify Disposition Tests ---');
const modify = runTests(modifyDispositionTests);

console.log('\n--- Prompt Modifier Tests ---');
const prompt = runTests(promptModifierTests);

console.log('\n--- NPC Config Tests ---');
const npc = runTests(npcConfigTests);

const allPassed = constants && io && get && modify && prompt && npc;
process.exit(allPassed ? 0 : 1);
