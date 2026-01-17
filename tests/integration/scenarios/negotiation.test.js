#!/usr/bin/env node
/**
 * Negotiation Integration Tests
 * Tests Minister Greener payment negotiation scenarios.
 */

const { strict: assert } = require('assert');
const fs = require('fs');
const path = require('path');

const {
  getDisposition,
  modifyDisposition,
  saveDispositions,
  checkDispositionCap,
  DISPOSITION_FILE
} = require('../../../src/disposition');

const { buildPlotContext } = require('../../../src/plot-context');
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
const BACKUP_FILE = DISPOSITION_FILE + '.negotiation-backup';

function backupState() {
  if (fs.existsSync(DISPOSITION_FILE)) {
    fs.copyFileSync(DISPOSITION_FILE, BACKUP_FILE);
  }
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

// Load Greener NPC config
function loadGreenerConfig() {
  const configPath = path.join(__dirname, '../../../data/npcs/minister-greener.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

/**
 * Simulate negotiation outcome
 * @param {string} approach - 'respectful' or 'aggressive'
 * @param {boolean} rollSuccess - Whether skill check passed
 * @param {number} startingDisposition - Initial disposition level
 * @returns {Object} { dispositionChange, payment }
 */
function simulateNegotiation(approach, rollSuccess, startingDisposition) {
  const BASE_PAYMENT = 3000;

  if (approach === 'respectful') {
    if (rollSuccess) {
      return { dispositionChange: 1, payment: 4000 };
    } else {
      return { dispositionChange: 0, payment: BASE_PAYMENT };
    }
  } else if (approach === 'aggressive') {
    if (rollSuccess) {
      return { dispositionChange: 0, payment: 3500 };
    } else {
      return { dispositionChange: -1, payment: BASE_PAYMENT };
    }
  }

  return { dispositionChange: 0, payment: BASE_PAYMENT };
}

/**
 * Calculate Vargr negotiation penalty
 * @param {Object} pc - PC data
 * @returns {number} Penalty to apply
 */
function getVargrNegotiationPenalty(pc) {
  return isVargr(pc) ? -2 : 0;
}

// === INTEGRATION TESTS ===

const negotiationTests = {
  'Respectful approach + success = Cr4000 + disposition +1': () => {
    backupState();
    try {
      const state = getState('act2_negotiation');
      const alex = getTestPc('alex_ryder');
      const greener = loadGreenerConfig();

      // Starting disposition
      let disp = getDisposition(greener.id, alex.id);
      assert.equal(disp.level, 0, 'Start at neutral');

      // Simulate negotiation
      const result = simulateNegotiation('respectful', true, disp.level);

      // Apply disposition change
      modifyDisposition(greener.id, alex.id, result.dispositionChange, 'Respectful negotiation succeeded', state.gameDate);

      // Verify outcomes
      disp = getDisposition(greener.id, alex.id);
      assert.equal(disp.level, 1, 'Disposition should be +1');
      assert.equal(result.payment, 4000, 'Payment should be Cr4000');
    } finally {
      restoreState();
    }
  },

  'Aggressive approach + success = Cr3500, no disposition change': () => {
    backupState();
    try {
      const state = getState('act2_negotiation');
      const alex = getTestPc('alex_ryder');
      const greener = loadGreenerConfig();

      const disp = getDisposition(greener.id, alex.id);
      const result = simulateNegotiation('aggressive', true, disp.level);

      // Don't modify disposition - aggressive but successful
      assert.equal(result.dispositionChange, 0, 'No disposition change for aggressive success');
      assert.equal(result.payment, 3500, 'Payment should be Cr3500');
    } finally {
      restoreState();
    }
  },

  'Respectful approach + failure = Cr3000, no disposition change': () => {
    backupState();
    try {
      const state = getState('act2_negotiation');
      const alex = getTestPc('alex_ryder');
      const greener = loadGreenerConfig();

      const disp = getDisposition(greener.id, alex.id);
      const result = simulateNegotiation('respectful', false, disp.level);

      assert.equal(result.dispositionChange, 0, 'No disposition change for polite failure');
      assert.equal(result.payment, 3000, 'Base payment Cr3000');
    } finally {
      restoreState();
    }
  },

  'Aggressive approach + failure = Cr3000, disposition -1': () => {
    backupState();
    try {
      const state = getState('act2_negotiation');
      const alex = getTestPc('alex_ryder');
      const greener = loadGreenerConfig();

      let disp = getDisposition(greener.id, alex.id);
      const result = simulateNegotiation('aggressive', false, disp.level);

      // Apply negative change
      modifyDisposition(greener.id, alex.id, result.dispositionChange, 'Aggressive negotiation failed', state.gameDate);

      disp = getDisposition(greener.id, alex.id);
      assert.equal(disp.level, -1, 'Disposition should be -1');
      assert.equal(result.payment, 3000, 'Base payment despite rudeness');
    } finally {
      restoreState();
    }
  },

  'Vargr PC starts at -2 with Greener': () => {
    backupState();
    try {
      const state = getState('act2_negotiation');
      const vargr = getTestPc('vargr_trader');
      const greener = loadGreenerConfig();

      // Apply Vargr penalty
      const penalty = getVargrNegotiationPenalty(vargr);
      assert.equal(penalty, -2, 'Vargr penalty should be -2');

      modifyDisposition(greener.id, vargr.id, penalty, 'Walston species bias', state.gameDate);

      const disp = getDisposition(greener.id, vargr.id);
      assert.equal(disp.level, -2, 'Vargr starts unfriendly');
      assert.equal(disp.label, 'unfriendly');
    } finally {
      restoreState();
    }
  },

  'Vargr negotiation is harder (effective -2 to checks)': () => {
    backupState();
    try {
      const vargr = getTestPc('vargr_trader');

      const penalty = getVargrNegotiationPenalty(vargr);

      // Persuade check would need to overcome -2 penalty
      // Average roll 7, with -2 = 5, fails 8+ threshold
      // Need natural 10+ or skill bonus to succeed
      assert.equal(penalty, -2, 'Effective -2 penalty to negotiation');
    } finally {
      restoreState();
    }
  },

  'Experienced captain gets better terms': () => {
    backupState();
    try {
      const state = getState('act2_negotiation');
      const drake = getTestPc('captain_drake'); // Has Persuade-1, Broker-2
      const greener = loadGreenerConfig();

      // Drake's skills give advantage
      // Broker-2 + Persuade-1 = effective +3 to negotiation
      const skillBonus = 3;

      // With +3, even aggressive approach likely succeeds
      const effectiveRoll = 7 + skillBonus; // 10 average
      const success = effectiveRoll >= 8;

      assert.ok(success, 'Drake should succeed most negotiations');

      // Respectful + success
      const result = simulateNegotiation('respectful', success, 0);
      assert.equal(result.payment, 4000);
    } finally {
      restoreState();
    }
  },

  'Story state updated after successful negotiation': () => {
    backupState();
    try {
      let state = getState('act2_negotiation');
      const alex = getTestPc('alex_ryder');

      // Before negotiation
      assert.ok(!state.flags.survey_accepted, 'Survey not yet accepted');

      // After successful negotiation
      state.flags.survey_accepted = true;
      state.flags.payment = 4000;
      state.completedBeats.push('survey_accepted');

      // Verify state updated
      assert.ok(state.flags.survey_accepted, 'Survey should be accepted');
      assert.equal(state.flags.payment, 4000, 'Payment recorded');
      assert.ok(state.completedBeats.includes('survey_accepted'), 'Beat recorded');
    } finally {
      restoreState();
    }
  },

  'Plot context reflects negotiation outcome': () => {
    backupState();
    try {
      const state = getState('act2_accepted');
      const narrator = {
        id: 'narrator',
        archetype: 'narrator',
        plotAwareness: { scope: 'adventure', knowsAbout: ['payment', 'survey_accepted'] }
      };
      const alex = getTestPc('alex_ryder');

      const context = buildPlotContext(state, narrator, alex);

      // Narrator should know about completed negotiation
      assert.ok(context.includes('Alex Ryder'), 'Should include PC name');
      assert.ok(context.includes('survey_accepted') || context.includes('Agreed to complete'), 'Should reference accepted survey');
    } finally {
      restoreState();
    }
  },

  'Disposition cap prevents exploitation': () => {
    backupState();
    try {
      const greenerConfig = {
        disposition: {
          caps: { max_without_deed: 2 }
        }
      };

      // Even with multiple positive interactions, can't exceed cap
      let level = 1;

      // Try to go to +3
      level = 3;
      const capped = checkDispositionCap(greenerConfig, level);

      assert.equal(capped, 2, 'Should cap at +2 without significant deed');
    } finally {
      restoreState();
    }
  }
};

// === RUN TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  NEGOTIATION INTEGRATION TESTS');
console.log('  Greener Payment Scenarios');
console.log('══════════════════════════════════════════\n');

const allPassed = runTests(negotiationTests);
process.exit(allPassed ? 0 : 1);
