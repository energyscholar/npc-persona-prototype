#!/usr/bin/env node
/**
 * Multi-NPC World State Tests (TDD - Tests First)
 *
 * Tests shared facts and cross-NPC awareness:
 * - Shared facts management
 * - NPC mention tracking
 * - Contradiction detection
 * - Faction-based filtering
 *
 * AUDITOR INSTANCE: 5f069a8e-52eb-42c4-a874-17ce01f2100b
 */

const { strict: assert } = require('assert');
const fs = require('fs');
const path = require('path');

// Import will fail until implementation exists
let worldState;
try {
  worldState = require('../src/world-state');
} catch (e) {
  console.error('World-state module not yet implemented.\n');
  worldState = {};
}

const {
  WORLD_FACTS_FILE,
  loadWorldFacts,
  saveWorldFacts,
  addSharedFact,
  getSharedFacts,
  recordNpcMention,
  getMentionsAbout,
  checkContradiction,
  getFactionsForNpc,
  filterByFaction
} = worldState;

// Test data paths
const TEST_STATE_DIR = path.join(__dirname, '../data/state');
const TEST_FACTS_FILE = path.join(TEST_STATE_DIR, 'world-facts.json');

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
  if (fs.existsSync(TEST_FACTS_FILE)) {
    const backup = TEST_FACTS_FILE + '.backup';
    fs.copyFileSync(TEST_FACTS_FILE, backup);
    return backup;
  }
  return null;
}

function restoreState(backup) {
  if (backup && fs.existsSync(backup)) {
    fs.copyFileSync(backup, TEST_FACTS_FILE);
    fs.unlinkSync(backup);
  } else if (fs.existsSync(TEST_FACTS_FILE)) {
    fs.writeFileSync(TEST_FACTS_FILE, JSON.stringify({
      sharedFacts: [],
      npcMentions: {},
      factionKnowledge: {}
    }, null, 2));
  }
}

// === I/O TESTS ===

const ioTests = {
  'WORLD_FACTS_FILE is valid path': () => {
    assert.ok(WORLD_FACTS_FILE, 'WORLD_FACTS_FILE should exist');
    assert.ok(WORLD_FACTS_FILE.includes('world-facts.json'));
  },

  'loadWorldFacts returns object': () => {
    const state = loadWorldFacts();
    assert.equal(typeof state, 'object');
    assert.ok(state.hasOwnProperty('sharedFacts'));
    assert.ok(state.hasOwnProperty('npcMentions'));
  },

  'saveWorldFacts persists data': () => {
    const backup = backupState();
    try {
      const testState = {
        sharedFacts: [{ id: 'test', content: 'test content', knownBy: ['all'] }],
        npcMentions: {},
        factionKnowledge: {}
      };
      saveWorldFacts(testState);

      const loaded = loadWorldFacts();
      assert.equal(loaded.sharedFacts.length, 1);
      assert.equal(loaded.sharedFacts[0].content, 'test content');
    } finally {
      restoreState(backup);
    }
  }
};

// === SHARED FACTS TESTS ===

const sharedFactsTests = {
  'addSharedFact adds new fact': () => {
    const backup = backupState();
    try {
      saveWorldFacts({ sharedFacts: [], npcMentions: {}, factionKnowledge: {} });

      addSharedFact('volcano-active', 'Mount Salbarii shows volcanic activity', ['all']);

      const state = loadWorldFacts();
      assert.equal(state.sharedFacts.length, 1);
      assert.equal(state.sharedFacts[0].id, 'volcano-active');
    } finally {
      restoreState(backup);
    }
  },

  'addSharedFact updates existing fact': () => {
    const backup = backupState();
    try {
      saveWorldFacts({
        sharedFacts: [{ id: 'update-test', content: 'old', knownBy: ['npc-1'] }],
        npcMentions: {},
        factionKnowledge: {}
      });

      addSharedFact('update-test', 'new content', ['all']);

      const state = loadWorldFacts();
      assert.equal(state.sharedFacts.length, 1);
      assert.equal(state.sharedFacts[0].content, 'new content');
      assert.deepEqual(state.sharedFacts[0].knownBy, ['all']);
    } finally {
      restoreState(backup);
    }
  },

  'addSharedFact defaults knownBy to all': () => {
    const backup = backupState();
    try {
      saveWorldFacts({ sharedFacts: [], npcMentions: {}, factionKnowledge: {} });

      addSharedFact('default-test', 'Some fact');

      const state = loadWorldFacts();
      assert.deepEqual(state.sharedFacts[0].knownBy, ['all']);
    } finally {
      restoreState(backup);
    }
  },

  'getSharedFacts returns facts for all': () => {
    const backup = backupState();
    try {
      saveWorldFacts({
        sharedFacts: [
          { id: 'public', content: 'Public fact', knownBy: ['all'] }
        ],
        npcMentions: {},
        factionKnowledge: {}
      });

      const facts = getSharedFacts('any-npc', 'any-adventure');
      assert.equal(facts.length, 1);
      assert.equal(facts[0].content, 'Public fact');
    } finally {
      restoreState(backup);
    }
  },

  'getSharedFacts filters by NPC ID': () => {
    const backup = backupState();
    try {
      saveWorldFacts({
        sharedFacts: [
          { id: 'greener-only', content: 'Greener secret', knownBy: ['minister-greener'] },
          { id: 'public', content: 'Public', knownBy: ['all'] }
        ],
        npcMentions: {},
        factionKnowledge: {}
      });

      const greenerFacts = getSharedFacts('minister-greener', 'high-and-dry');
      assert.equal(greenerFacts.length, 2, 'Greener should see both facts');

      const otherFacts = getSharedFacts('other-npc', 'high-and-dry');
      assert.equal(otherFacts.length, 1, 'Other NPC should only see public');
    } finally {
      restoreState(backup);
    }
  },

  'getSharedFacts returns empty array for no matches': () => {
    const backup = backupState();
    try {
      saveWorldFacts({
        sharedFacts: [
          { id: 'private', content: 'Private', knownBy: ['specific-npc'] }
        ],
        npcMentions: {},
        factionKnowledge: {}
      });

      const facts = getSharedFacts('other-npc', 'adventure');
      assert.deepEqual(facts, []);
    } finally {
      restoreState(backup);
    }
  }
};

// === NPC MENTION TESTS ===

const mentionTests = {
  'recordNpcMention stores mention': () => {
    const backup = backupState();
    try {
      saveWorldFacts({ sharedFacts: [], npcMentions: {}, factionKnowledge: {} });

      recordNpcMention('bartender', 'minister-greener', 'captain-drake', 'You should talk to Minister Greener about the job');

      const state = loadWorldFacts();
      assert.ok(state.npcMentions['minister-greener'], 'Should have entry for mentioned NPC');
      assert.ok(state.npcMentions['minister-greener']['captain-drake'], 'Should have entry for PC');
      assert.equal(state.npcMentions['minister-greener']['captain-drake'].length, 1);
    } finally {
      restoreState(backup);
    }
  },

  'recordNpcMention includes metadata': () => {
    const backup = backupState();
    try {
      saveWorldFacts({ sharedFacts: [], npcMentions: {}, factionKnowledge: {} });

      recordNpcMention('npc-a', 'npc-b', 'pc', 'content');

      const state = loadWorldFacts();
      const mention = state.npcMentions['npc-b']['pc'][0];
      assert.equal(mention.from, 'npc-a');
      assert.equal(mention.content, 'content');
      assert.ok(mention.timestamp, 'Should have timestamp');
    } finally {
      restoreState(backup);
    }
  },

  'recordNpcMention handles multiple mentions': () => {
    const backup = backupState();
    try {
      saveWorldFacts({ sharedFacts: [], npcMentions: {}, factionKnowledge: {} });

      recordNpcMention('npc-1', 'target', 'pc', 'First mention');
      recordNpcMention('npc-2', 'target', 'pc', 'Second mention');

      const state = loadWorldFacts();
      assert.equal(state.npcMentions['target']['pc'].length, 2);
    } finally {
      restoreState(backup);
    }
  },

  'getMentionsAbout returns mentions for NPC': () => {
    const backup = backupState();
    try {
      saveWorldFacts({
        sharedFacts: [],
        npcMentions: {
          'minister-greener': {
            'captain-drake': [
              { from: 'bartender', content: 'He handles offworld jobs', timestamp: '2025-01-01T00:00:00Z' }
            ]
          }
        },
        factionKnowledge: {}
      });

      const mentions = getMentionsAbout('minister-greener', 'captain-drake');
      assert.equal(mentions.length, 1);
      assert.equal(mentions[0].from, 'bartender');
    } finally {
      restoreState(backup);
    }
  },

  'getMentionsAbout returns empty for unknown': () => {
    const backup = backupState();
    try {
      saveWorldFacts({ sharedFacts: [], npcMentions: {}, factionKnowledge: {} });

      const mentions = getMentionsAbout('unknown', 'unknown');
      assert.deepEqual(mentions, []);
    } finally {
      restoreState(backup);
    }
  }
};

// === CONTRADICTION TESTS ===

const contradictionTests = {
  'checkContradiction finds conflict with same ID': () => {
    const newFact = { id: 'volcano-status', content: 'Volcano is dormant' };
    const existingFacts = [
      { id: 'volcano-status', content: 'Volcano is active' }
    ];

    const result = checkContradiction(newFact, existingFacts);
    assert.equal(result.hasConflict, true);
    assert.equal(result.conflicts.length, 1);
  },

  'checkContradiction returns no conflict for different IDs': () => {
    const newFact = { id: 'new-fact', content: 'New info' };
    const existingFacts = [
      { id: 'other-fact', content: 'Other info' }
    ];

    const result = checkContradiction(newFact, existingFacts);
    assert.equal(result.hasConflict, false);
    assert.equal(result.conflicts.length, 0);
  },

  'checkContradiction returns no conflict for same content': () => {
    const newFact = { id: 'same', content: 'Same content' };
    const existingFacts = [
      { id: 'same', content: 'Same content' }
    ];

    const result = checkContradiction(newFact, existingFacts);
    assert.equal(result.hasConflict, false);
  },

  'checkContradiction handles empty existing facts': () => {
    const newFact = { id: 'any', content: 'any' };

    const result = checkContradiction(newFact, []);
    assert.equal(result.hasConflict, false);
    assert.deepEqual(result.conflicts, []);
  }
};

// === FACTION TESTS ===

const factionTests = {
  'getFactionsForNpc returns empty for no factions': () => {
    const npcConfig = { id: 'no-faction-npc' };
    const factions = getFactionsForNpc(npcConfig);
    assert.ok(Array.isArray(factions));
    assert.equal(factions.length, 0);
  },

  'getFactionsForNpc returns configured factions': () => {
    const npcConfig = {
      id: 'faction-npc',
      factions: ['government', 'merchants']
    };
    const factions = getFactionsForNpc(npcConfig);
    assert.deepEqual(factions, ['government', 'merchants']);
  },

  'filterByFaction includes matching faction facts': () => {
    const facts = [
      { id: 'gov-secret', content: 'Government only', knownBy: ['faction:government'] },
      { id: 'public', content: 'Public', knownBy: ['all'] }
    ];
    const factions = ['government'];

    const filtered = filterByFaction(facts, factions);
    // Should include gov-secret (faction match) and public (all)
    assert.equal(filtered.length, 2);
  },

  'filterByFaction excludes non-matching faction facts': () => {
    const facts = [
      { id: 'criminal-only', content: 'Criminal secret', knownBy: ['faction:criminals'] }
    ];
    const factions = ['government'];

    const filtered = filterByFaction(facts, factions);
    assert.equal(filtered.length, 0);
  },

  'filterByFaction handles empty factions': () => {
    const facts = [
      { id: 'public', content: 'Public', knownBy: ['all'] },
      { id: 'faction-only', content: 'Secret', knownBy: ['faction:x'] }
    ];

    const filtered = filterByFaction(facts, []);
    // Should only include 'all' facts
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, 'public');
  }
};

// === RUN ALL TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  MULTI-NPC WORLD STATE TESTS');
console.log('══════════════════════════════════════════\n');

console.log('--- I/O Tests ---');
const io = runTests(ioTests);

console.log('\n--- Shared Facts Tests ---');
const shared = runTests(sharedFactsTests);

console.log('\n--- NPC Mention Tests ---');
const mention = runTests(mentionTests);

console.log('\n--- Contradiction Tests ---');
const contradiction = runTests(contradictionTests);

console.log('\n--- Faction Tests ---');
const faction = runTests(factionTests);

const allPassed = io && shared && mention && contradiction && faction;
process.exit(allPassed ? 0 : 1);
