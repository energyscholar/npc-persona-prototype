#!/usr/bin/env node
/**
 * Disposition Integration Tests
 * Tests disposition lifecycle with High and Dry NPCs and PCs.
 */

const { strict: assert } = require('assert');
const fs = require('fs');
const path = require('path');

const {
  getDisposition,
  modifyDisposition,
  getDispositionPromptModifier,
  getInitialDisposition,
  checkDispositionCap,
  saveDispositions,
  DISPOSITION_FILE
} = require('../../../src/disposition');

const { getState } = require('../fixtures/story-states');
const { getTestPc, isVargr } = require('../fixtures/test-pcs');

// Test helper
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

// State management
const BACKUP_FILE = DISPOSITION_FILE + '.integration-backup';

function backupState() {
  if (fs.existsSync(DISPOSITION_FILE)) {
    fs.copyFileSync(DISPOSITION_FILE, BACKUP_FILE);
  }
  // Start with clean state
  saveDispositions({ relationships: {} });
}

function restoreState() {
  if (fs.existsSync(BACKUP_FILE)) {
    fs.copyFileSync(BACKUP_FILE, DISPOSITION_FILE);
    fs.unlinkSync(BACKUP_FILE);
  } else {
    saveDispositions({ relationships: {} });
  }
}

// Load NPC config for realistic testing
function loadNpcConfig(npcId) {
  const npcPath = path.join(__dirname, '../../../data/npcs', `${npcId}.json`);
  if (fs.existsSync(npcPath)) {
    return JSON.parse(fs.readFileSync(npcPath, 'utf8'));
  }
  return null;
}

// === INTEGRATION TESTS ===

const integrationTests = {
  'Initial neutral disposition for Greener + Alex Ryder': () => {
    backupState();
    try {
      const alex = getTestPc('alex_ryder');
      const disp = getDisposition('minister-greener', alex.id);

      assert.equal(disp.level, 0, 'Initial level should be 0');
      assert.equal(disp.label, 'neutral', 'Initial label should be neutral');
      assert.deepEqual(disp.history, [], 'History should be empty');
    } finally {
      restoreState();
    }
  },

  'Vargr PC gets -2 penalty with Greener (simulated)': () => {
    backupState();
    try {
      const vargr = getTestPc('vargr_trader');
      assert.ok(isVargr(vargr), 'Should identify as Vargr');

      // Simulate species penalty: Greener has traditional Walston views
      // In a real implementation, getInitialDisposition would check PC species
      const speciesPenalty = isVargr(vargr) ? -2 : 0;
      const initialLevel = 0 + speciesPenalty;

      // Set the disposition with penalty
      modifyDisposition('minister-greener', vargr.id, speciesPenalty, 'Walston species bias', '015-1105');

      const disp = getDisposition('minister-greener', vargr.id);
      assert.equal(disp.level, -2, 'Vargr should start at -2 with Greener');
      assert.equal(disp.label, 'unfriendly', 'Label should be unfriendly');
    } finally {
      restoreState();
    }
  },

  'Positive modifier after fair negotiation': () => {
    backupState();
    try {
      const state = getState('act2_negotiation');
      const alex = getTestPc('alex_ryder');

      // Start neutral
      let disp = getDisposition('minister-greener', alex.id);
      assert.equal(disp.level, 0);

      // Fair negotiation succeeds - apply +1
      const newLevel = modifyDisposition(
        'minister-greener',
        alex.id,
        1,
        'Respectful negotiation, accepted fair terms',
        state.gameDate
      );

      assert.equal(newLevel, 1, 'Level should be 1 after +1 modifier');

      disp = getDisposition('minister-greener', alex.id);
      assert.equal(disp.level, 1);
      assert.equal(disp.label, 'favorable');
    } finally {
      restoreState();
    }
  },

  'Cap enforcement prevents exceeding max_without_deed': () => {
    backupState();
    try {
      // Greener has implicit cap - won't go above +2 without significant deed
      const greenerConfig = {
        disposition: {
          caps: { max_without_deed: 2 }
        }
      };

      // Try to get to level 3
      let currentLevel = 3;
      const capped = checkDispositionCap(greenerConfig, currentLevel);

      assert.equal(capped, 2, 'Should cap at 2 without deed');

      // Below cap should pass through
      currentLevel = 1;
      const notCapped = checkDispositionCap(greenerConfig, currentLevel);
      assert.equal(notCapped, 1, 'Should not cap value below threshold');
    } finally {
      restoreState();
    }
  },

  'History tracking across multiple changes': () => {
    backupState();
    try {
      const alex = getTestPc('alex_ryder');
      const npcId = 'minister-greener';

      // Series of interactions
      modifyDisposition(npcId, alex.id, 1, 'Polite introduction', '015-1105');
      modifyDisposition(npcId, alex.id, -1, 'Aggressive haggling', '015-1105');
      modifyDisposition(npcId, alex.id, 1, 'Accepted fair terms', '015-1105');
      modifyDisposition(npcId, alex.id, 1, 'Completed survey successfully', '018-1105');

      const disp = getDisposition(npcId, alex.id);

      assert.equal(disp.history.length, 4, 'Should have 4 history entries');
      assert.equal(disp.level, 2, 'Net change should be +2');

      // Check history entries have required fields
      for (const entry of disp.history) {
        assert.ok(entry.date, 'Entry should have date');
        assert.ok(entry.reason, 'Entry should have reason');
        assert.ok(typeof entry.change === 'number', 'Entry should have change amount');
        assert.ok(typeof entry.from === 'number', 'Entry should have from level');
        assert.ok(typeof entry.to === 'number', 'Entry should have to level');
      }

      // Check first and last entries
      assert.equal(disp.history[0].reason, 'Polite introduction');
      assert.equal(disp.history[3].reason, 'Completed survey successfully');
    } finally {
      restoreState();
    }
  },

  'Prompt modifier contains disposition keywords': () => {
    // Test all levels produce appropriate prompts
    const expectations = [
      { level: -3, keywords: ['hostile', 'cold', 'refuse'] },
      { level: -2, keywords: ['unfriendly', 'curt', 'unhelpful'] },
      { level: -1, keywords: ['wary', 'cautious', 'reserved'] },
      { level: 0, keywords: ['neutral', 'professional'] },
      { level: 1, keywords: ['favorable', 'helpful'] },
      { level: 2, keywords: ['friendly', 'warm', 'helpful'] },
      { level: 3, keywords: ['allied', 'friend', 'trust'] }
    ];

    for (const { level, keywords } of expectations) {
      const modifier = getDispositionPromptModifier(level);
      const lower = modifier.toLowerCase();

      const hasKeyword = keywords.some(kw => lower.includes(kw));
      assert.ok(
        hasKeyword,
        `Level ${level} modifier should contain one of: ${keywords.join(', ')}. Got: ${modifier}`
      );
    }
  },

  'Bartender starts friendly with travelers': () => {
    backupState();
    try {
      const alex = getTestPc('alex_ryder');

      // Bartender Tannen has friendly-curious initial relationship
      // Simulate this as starting at +1
      modifyDisposition('startown-bartender', alex.id, 1, 'Friendly to offworlders', '015-1105');

      const disp = getDisposition('startown-bartender', alex.id);
      assert.equal(disp.level, 1, 'Bartender should start favorable');
      assert.equal(disp.label, 'favorable');
    } finally {
      restoreState();
    }
  },

  'Buying drinks gives +2 modifier with bartender': () => {
    backupState();
    try {
      const alex = getTestPc('alex_ryder');

      // Start at friendly
      modifyDisposition('startown-bartender', alex.id, 1, 'Friendly to offworlders', '015-1105');

      // Buy drinks - significant positive modifier
      modifyDisposition('startown-bartender', alex.id, 2, 'Bought rounds for the bar', '015-1105');

      const disp = getDisposition('startown-bartender', alex.id);
      assert.equal(disp.level, 3, 'Should reach allied after buying drinks');
      assert.equal(disp.label, 'allied');
    } finally {
      restoreState();
    }
  },

  'Disposition clamps at boundaries': () => {
    backupState();
    try {
      const alex = getTestPc('alex_ryder');

      // Try to go way negative
      modifyDisposition('test-npc', alex.id, -10, 'Maximum offense', '001-1105');
      let disp = getDisposition('test-npc', alex.id);
      assert.equal(disp.level, -3, 'Should clamp to -3');

      // Reset and try to go way positive
      saveDispositions({ relationships: {} });
      modifyDisposition('test-npc', alex.id, 10, 'Maximum favor', '001-1105');
      disp = getDisposition('test-npc', alex.id);
      assert.equal(disp.level, 3, 'Should clamp to +3');
    } finally {
      restoreState();
    }
  },

  'Customs officer stays professional regardless of charm': () => {
    backupState();
    try {
      const social = getTestPc('social_specialist');

      // Corfe is professional-bored, won't get too positive
      const corfeConfig = {
        disposition: {
          caps: { max_without_deed: 1 }
        }
      };

      // Try to charm up
      modifyDisposition('customs-officer-walston', social.id, 2, 'Attempted charm', '015-1105');

      const disp = getDisposition('customs-officer-walston', social.id);
      const capped = checkDispositionCap(corfeConfig, disp.level);

      assert.equal(capped, 1, 'Corfe caps at favorable - purely professional');
    } finally {
      restoreState();
    }
  }
};

// === RUN TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  DISPOSITION INTEGRATION TESTS');
console.log('  High and Dry Adventure');
console.log('══════════════════════════════════════════\n');

const allPassed = runTests(integrationTests);
process.exit(allPassed ? 0 : 1);
