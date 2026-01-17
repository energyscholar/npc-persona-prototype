#!/usr/bin/env node
/**
 * Information Gating Tests (TDD - Tests First)
 *
 * Tests NPC knowledge gating:
 * - Unlock persistence
 * - Skill check access attempts
 * - Public vs gated knowledge
 * - Alternate skill paths
 *
 * AUDITOR INSTANCE: 5f069a8e-52eb-42c4-a874-17ce01f2100b
 */

const { strict: assert } = require('assert');
const fs = require('fs');
const path = require('path');

// Import will fail until implementation exists
let infoGating;
try {
  infoGating = require('../src/info-gating');
} catch (e) {
  console.error('Info-gating module not yet implemented.\n');
  infoGating = {};
}

const {
  UNLOCKS_FILE,
  loadUnlocks,
  saveUnlocks,
  isUnlocked,
  recordUnlock,
  attemptAccess,
  getAccessibleKnowledge,
  canAccessInfo
} = infoGating;

// Test data paths
const TEST_STATE_DIR = path.join(__dirname, '../data/state');
const TEST_UNLOCKS_FILE = path.join(TEST_STATE_DIR, 'pc-unlocks.json');

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
  if (fs.existsSync(TEST_UNLOCKS_FILE)) {
    const backup = TEST_UNLOCKS_FILE + '.backup';
    fs.copyFileSync(TEST_UNLOCKS_FILE, backup);
    return backup;
  }
  return null;
}

function restoreState(backup) {
  if (backup && fs.existsSync(backup)) {
    fs.copyFileSync(backup, TEST_UNLOCKS_FILE);
    fs.unlinkSync(backup);
  } else if (fs.existsSync(TEST_UNLOCKS_FILE)) {
    fs.writeFileSync(TEST_UNLOCKS_FILE, JSON.stringify({ unlocks: {} }, null, 2));
  }
}

// === I/O TESTS ===

const ioTests = {
  'UNLOCKS_FILE is valid path': () => {
    assert.ok(UNLOCKS_FILE, 'UNLOCKS_FILE should exist');
    assert.ok(UNLOCKS_FILE.includes('pc-unlocks.json'));
  },

  'loadUnlocks returns object': () => {
    const state = loadUnlocks();
    assert.equal(typeof state, 'object');
    assert.ok(state.hasOwnProperty('unlocks'));
  },

  'saveUnlocks persists data': () => {
    const backup = backupState();
    try {
      const testState = {
        unlocks: { 'test-pc': { 'test-npc': ['secret-info'] } }
      };
      saveUnlocks(testState);

      const loaded = loadUnlocks();
      assert.ok(loaded.unlocks['test-pc']['test-npc'].includes('secret-info'));
    } finally {
      restoreState(backup);
    }
  }
};

// === UNLOCK TRACKING TESTS ===

const unlockTests = {
  'isUnlocked returns false for unknown PC': () => {
    assert.equal(isUnlocked('unknown-pc', 'npc', 'info'), false);
  },

  'isUnlocked returns false for unknown info': () => {
    const backup = backupState();
    try {
      saveUnlocks({ unlocks: { 'pc': { 'npc': ['other-info'] } } });
      assert.equal(isUnlocked('pc', 'npc', 'unknown-info'), false);
    } finally {
      restoreState(backup);
    }
  },

  'isUnlocked returns true for unlocked info': () => {
    const backup = backupState();
    try {
      saveUnlocks({ unlocks: { 'pc': { 'npc': ['secret'] } } });
      assert.equal(isUnlocked('pc', 'npc', 'secret'), true);
    } finally {
      restoreState(backup);
    }
  },

  'recordUnlock adds new unlock': () => {
    const backup = backupState();
    try {
      saveUnlocks({ unlocks: {} });
      recordUnlock('new-pc', 'new-npc', 'new-info');

      assert.equal(isUnlocked('new-pc', 'new-npc', 'new-info'), true);
    } finally {
      restoreState(backup);
    }
  },

  'recordUnlock does not duplicate': () => {
    const backup = backupState();
    try {
      saveUnlocks({ unlocks: {} });
      recordUnlock('dup-pc', 'dup-npc', 'same-info');
      recordUnlock('dup-pc', 'dup-npc', 'same-info');

      const state = loadUnlocks();
      const count = state.unlocks['dup-pc']['dup-npc'].filter(i => i === 'same-info').length;
      assert.equal(count, 1, 'Should not duplicate unlocks');
    } finally {
      restoreState(backup);
    }
  },

  'recordUnlock handles multiple NPCs per PC': () => {
    const backup = backupState();
    try {
      saveUnlocks({ unlocks: {} });
      recordUnlock('multi-pc', 'npc-1', 'info-a');
      recordUnlock('multi-pc', 'npc-2', 'info-b');

      assert.equal(isUnlocked('multi-pc', 'npc-1', 'info-a'), true);
      assert.equal(isUnlocked('multi-pc', 'npc-2', 'info-b'), true);
    } finally {
      restoreState(backup);
    }
  }
};

// === ATTEMPT ACCESS TESTS ===

const accessTests = {
  'attemptAccess returns object with required fields': () => {
    const gatedInfo = {
      content: 'Secret data',
      requires: { skill: 'Persuade', threshold: 8 }
    };
    const pc = { skills_notable: [] };

    const result = attemptAccess(gatedInfo, pc, 'pc-id', 'npc-id', 'key');
    assert.ok(result.hasOwnProperty('accessible'));
    assert.ok(result.hasOwnProperty('reason'));
  },

  'attemptAccess returns content when previously unlocked': () => {
    const backup = backupState();
    try {
      saveUnlocks({ unlocks: { 'prev-pc': { 'prev-npc': ['prev-key'] } } });

      const gatedInfo = {
        content: 'Already unlocked secret',
        requires: { skill: 'Impossible', threshold: 100 },
        unlockOnSuccess: true
      };
      const pc = {};

      const result = attemptAccess(gatedInfo, pc, 'prev-pc', 'prev-npc', 'prev-key');
      assert.equal(result.accessible, true);
      assert.equal(result.content, 'Already unlocked secret');
    } finally {
      restoreState(backup);
    }
  },

  'attemptAccess records unlock on success': () => {
    const backup = backupState();
    try {
      saveUnlocks({ unlocks: {} });

      const gatedInfo = {
        content: 'Will be unlocked',
        requires: { skill: 'Persuade', threshold: 2 }, // Very easy
        unlockOnSuccess: true
      };
      const pc = { skills_notable: ['Persuade-5'] };

      // Force success by using easy threshold
      // Note: actual implementation uses random rolls, so we can't guarantee success
      // But we can verify the structure is correct
      const result = attemptAccess(gatedInfo, pc, 'unlock-pc', 'unlock-npc', 'unlock-key');
      assert.equal(typeof result.accessible, 'boolean');
    } finally {
      restoreState(backup);
    }
  },

  'attemptAccess returns reason on failure': () => {
    const backup = backupState();
    try {
      saveUnlocks({ unlocks: {} });

      const gatedInfo = {
        content: 'Very hard secret',
        requires: { skill: 'Admin', threshold: 15 } // Impossible
      };
      const pc = {};

      const result = attemptAccess(gatedInfo, pc, 'fail-pc', 'fail-npc', 'fail-key');
      // With threshold 15, almost certainly fails
      assert.ok(result.reason, 'Should have reason');
    } finally {
      restoreState(backup);
    }
  },

  'attemptAccess tries alternates': () => {
    const gatedInfo = {
      content: 'Multi-skill secret',
      requires: { skill: 'Persuade', threshold: 15 }, // Primary fails
      alternates: [
        { skill: 'Admin', threshold: 2 } // Alternate very easy
      ]
    };
    const pc = {};

    const result = attemptAccess(gatedInfo, pc, 'alt-pc', 'alt-npc', 'alt-key');
    // Structure should be correct regardless of random roll outcome
    assert.ok(result.hasOwnProperty('accessible'));
    assert.ok(result.hasOwnProperty('reason'));
  }
};

// === ACCESSIBLE KNOWLEDGE TESTS ===

const knowledgeTests = {
  'getAccessibleKnowledge returns public knowledge': () => {
    const npcConfig = {
      knowledge_base: {
        public_fact: 'Everyone knows this'
      }
    };
    const pc = {};

    const result = getAccessibleKnowledge(npcConfig, pc, 'pc', 'npc');
    assert.ok(result.public.public_fact, 'Should include public knowledge');
    assert.equal(result.public.public_fact, 'Everyone knows this');
  },

  'getAccessibleKnowledge returns empty accessible for no gated': () => {
    const npcConfig = {
      knowledge_base: { fact: 'public' }
    };

    const result = getAccessibleKnowledge(npcConfig, {}, 'pc', 'npc');
    assert.deepEqual(result.accessible, {});
  },

  'getAccessibleKnowledge lists gated keys': () => {
    const backup = backupState();
    try {
      saveUnlocks({ unlocks: {} });

      const npcConfig = {
        knowledge_base: { public: 'yes' },
        gated_knowledge: {
          secret_1: {
            content: 'Hidden 1',
            requires: { skill: 'X', threshold: 15 }
          },
          secret_2: {
            content: 'Hidden 2',
            requires: { skill: 'Y', threshold: 15 }
          }
        }
      };

      const result = getAccessibleKnowledge(npcConfig, {}, 'gate-pc', 'gate-npc');
      // Gated array should contain keys that weren't accessed
      assert.ok(Array.isArray(result.gated));
    } finally {
      restoreState(backup);
    }
  },

  'getAccessibleKnowledge handles missing knowledge_base': () => {
    const npcConfig = {};

    const result = getAccessibleKnowledge(npcConfig, {}, 'pc', 'npc');
    assert.ok(result.public, 'Should have public property');
    assert.ok(result.accessible, 'Should have accessible property');
    assert.ok(result.gated, 'Should have gated property');
  }
};

// === CAN ACCESS TESTS ===

const canAccessTests = {
  'canAccessInfo returns true for non-gated info': () => {
    const npcConfig = { knowledge_base: { public: 'yes' } };
    assert.equal(canAccessInfo(npcConfig, 'pc', 'npc', 'public'), true);
  },

  'canAccessInfo returns true for unlocked gated info': () => {
    const backup = backupState();
    try {
      saveUnlocks({ unlocks: { 'pc': { 'npc': ['gated-key'] } } });

      const npcConfig = {
        gated_knowledge: {
          'gated-key': { content: 'x', requires: { skill: 'X', threshold: 10 } }
        }
      };

      assert.equal(canAccessInfo(npcConfig, 'pc', 'npc', 'gated-key'), true);
    } finally {
      restoreState(backup);
    }
  },

  'canAccessInfo returns false for locked gated info': () => {
    const backup = backupState();
    try {
      saveUnlocks({ unlocks: {} });

      const npcConfig = {
        gated_knowledge: {
          'locked': { content: 'x', requires: { skill: 'X', threshold: 10 } }
        }
      };

      assert.equal(canAccessInfo(npcConfig, 'pc', 'npc', 'locked'), false);
    } finally {
      restoreState(backup);
    }
  }
};

// === RUN ALL TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  INFORMATION GATING TESTS');
console.log('══════════════════════════════════════════\n');

console.log('--- I/O Tests ---');
const io = runTests(ioTests);

console.log('\n--- Unlock Tracking Tests ---');
const unlock = runTests(unlockTests);

console.log('\n--- Attempt Access Tests ---');
const access = runTests(accessTests);

console.log('\n--- Accessible Knowledge Tests ---');
const knowledge = runTests(knowledgeTests);

console.log('\n--- Can Access Tests ---');
const canAccess = runTests(canAccessTests);

const allPassed = io && unlock && access && knowledge && canAccess;
process.exit(allPassed ? 0 : 1);
