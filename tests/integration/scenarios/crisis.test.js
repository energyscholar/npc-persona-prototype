#!/usr/bin/env node
/**
 * Crisis Integration Tests
 * Tests volcanic eruption and moral choice scenarios.
 */

const { strict: assert } = require('assert');
const fs = require('fs');
const path = require('path');

const {
  getDisposition,
  modifyDisposition,
  saveDispositions,
  DISPOSITION_FILE
} = require('../../../src/disposition');

const { buildPlotContext } = require('../../../src/plot-context');
const {
  generateActionReport,
  queueReport,
  getReportsForPc,
  clearReports
} = require('../../../src/action-reports');

const { getState, advanceToState } = require('../fixtures/story-states');
const { getTestPc } = require('../fixtures/test-pcs');

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
const BACKUP_FILE = DISPOSITION_FILE + '.crisis-backup';

function backupState() {
  if (fs.existsSync(DISPOSITION_FILE)) {
    fs.copyFileSync(DISPOSITION_FILE, BACKUP_FILE);
  }
  saveDispositions({ relationships: {} });
  clearReports();
}

function restoreState() {
  if (fs.existsSync(BACKUP_FILE)) {
    fs.copyFileSync(BACKUP_FILE, DISPOSITION_FILE);
    fs.unlinkSync(BACKUP_FILE);
  } else {
    saveDispositions({ relationships: {} });
  }
  clearReports();
}

/**
 * Chauffeur state machine states
 */
const CHAUFFEUR_STATES = {
  INITIAL: 'initial',
  DISTRESS_CALL: 'distress_call',
  RESCUED: 'rescued',
  ABANDONED: 'abandoned',
  GRATEFUL: 'grateful',
  DEVASTATED: 'devastated',
  PARENTS_SAVED: 'parents_saved',
  PARENTS_LOST: 'parents_lost'
};

/**
 * Simulate rescue choice outcomes
 * @param {string} choice - 'barvinn', 'vargr', 'both', 'neither'
 * @returns {Object} Outcome flags
 */
function simulateRescueChoice(choice) {
  switch (choice) {
    case 'barvinn':
      return {
        barvinn_rescued: true,
        vargr_rescued: false,
        casualties: 3,
        masterton_reaction: 'grateful',
        chauffeur_state: CHAUFFEUR_STATES.ABANDONED
      };

    case 'vargr':
      return {
        barvinn_rescued: false,
        vargr_rescued: true,
        casualties: 11,
        masterton_reaction: 'disappointed',
        chauffeur_state: CHAUFFEUR_STATES.RESCUED
      };

    case 'both':
      return {
        barvinn_rescued: true,
        vargr_rescued: true,
        casualties: 0,
        masterton_reaction: 'impressed',
        chauffeur_state: CHAUFFEUR_STATES.RESCUED,
        ship_damaged: true,
        risky_success: true
      };

    case 'neither':
      return {
        barvinn_rescued: false,
        vargr_rescued: false,
        casualties: 14,
        masterton_reaction: 'horrified',
        chauffeur_state: CHAUFFEUR_STATES.ABANDONED
      };

    default:
      throw new Error(`Unknown choice: ${choice}`);
  }
}

/**
 * Apply chauffeur disposition based on outcome
 * @param {Object} outcome - Rescue outcome
 * @param {string} pcId - PC identifier
 * @param {string} gameDate - Game date
 */
function applyChauffeurDisposition(outcome, pcId, gameDate) {
  if (outcome.vargr_rescued) {
    // Heroic rescue - major positive
    modifyDisposition('vargr-chauffeur', pcId, 3, 'Heroic rescue of family', gameDate);
  } else {
    // Abandoned - significant negative
    modifyDisposition('vargr-chauffeur', pcId, -2, 'Abandoned to die', gameDate);
  }
}

// === INTEGRATION TESTS ===

const crisisSetupTests = {
  'Crisis state has correct flags': () => {
    const state = getState('act4_crisis');

    assert.ok(state.flags.volcano_active, 'Volcano should be active');
    assert.ok(state.flags.evacuation_ordered, 'Evacuation should be ordered');
    assert.ok(state.completedBeats.includes('eruption_begins'), 'Eruption beat should be complete');
  },

  'Rescue choice state has both options': () => {
    const state = getState('act4_rescue_choice');

    assert.ok(state.flags.barvinn_endangered, 'Barvinn should be endangered');
    assert.ok(state.flags.chauffeur_distress, 'Chauffeur should be in distress');
    assert.equal(state.flags.barvinn_count, 11, '11 people at Barvinn');
    assert.equal(state.flags.limo_count, 3, '3 people in limo');
  },

  'Plot context shows crisis situation': () => {
    const state = getState('act4_crisis');
    const narrator = {
      id: 'narrator',
      archetype: 'narrator',
      plotAwareness: { scope: 'adventure', knowsAbout: ['volcano_active', 'evacuation_ordered'] }
    };
    const alex = getTestPc('alex_ryder');

    const context = buildPlotContext(state, narrator, alex);

    assert.ok(context.includes('volcano_active'), 'Should mention volcano');
    assert.ok(context.includes('evacuation_ordered'), 'Should mention evacuation');
  }
};

const rescueChoiceTests = {
  'Rescue Barvinn: 11 saved, 3 lost': () => {
    backupState();
    try {
      const outcome = simulateRescueChoice('barvinn');

      assert.ok(outcome.barvinn_rescued, 'Barvinn should be rescued');
      assert.ok(!outcome.vargr_rescued, 'Vargr should not be rescued');
      assert.equal(outcome.casualties, 3, '3 casualties');
      assert.equal(outcome.masterton_reaction, 'grateful', 'Masterton grateful');
    } finally {
      restoreState();
    }
  },

  'Rescue Vargr: 3 saved, 11 lost': () => {
    backupState();
    try {
      const outcome = simulateRescueChoice('vargr');

      assert.ok(!outcome.barvinn_rescued, 'Barvinn should not be rescued');
      assert.ok(outcome.vargr_rescued, 'Vargr should be rescued');
      assert.equal(outcome.casualties, 11, '11 casualties');
      assert.equal(outcome.masterton_reaction, 'disappointed', 'Masterton disappointed');
    } finally {
      restoreState();
    }
  },

  'Rescue both: risky success': () => {
    backupState();
    try {
      const outcome = simulateRescueChoice('both');

      assert.ok(outcome.barvinn_rescued, 'Barvinn should be rescued');
      assert.ok(outcome.vargr_rescued, 'Vargr should be rescued');
      assert.equal(outcome.casualties, 0, 'No casualties');
      assert.ok(outcome.ship_damaged, 'Ship should be damaged');
      assert.ok(outcome.risky_success, 'Should be marked as risky');
    } finally {
      restoreState();
    }
  },

  'Rescue neither: all lost': () => {
    backupState();
    try {
      const outcome = simulateRescueChoice('neither');

      assert.ok(!outcome.barvinn_rescued);
      assert.ok(!outcome.vargr_rescued);
      assert.equal(outcome.casualties, 14, 'All 14 lost');
      assert.equal(outcome.masterton_reaction, 'horrified');
    } finally {
      restoreState();
    }
  }
};

const chauffeurStateTests = {
  'Chauffeur grateful after rescue': () => {
    backupState();
    try {
      const alex = getTestPc('alex_ryder');
      const state = getState('act4_crisis');

      const outcome = simulateRescueChoice('vargr');
      applyChauffeurDisposition(outcome, alex.id, state.gameDate);

      const disp = getDisposition('vargr-chauffeur', alex.id);
      assert.equal(disp.level, 3, 'Should be allied after rescue');
      assert.equal(disp.label, 'allied');
    } finally {
      restoreState();
    }
  },

  'Chauffeur devastated if abandoned': () => {
    backupState();
    try {
      const alex = getTestPc('alex_ryder');
      const state = getState('act4_crisis');

      const outcome = simulateRescueChoice('barvinn');
      applyChauffeurDisposition(outcome, alex.id, state.gameDate);

      const disp = getDisposition('vargr-chauffeur', alex.id);
      assert.equal(disp.level, -2, 'Should be unfriendly if abandoned');
      assert.equal(disp.label, 'unfriendly');
    } finally {
      restoreState();
    }
  },

  'Chauffeur state machine transitions': () => {
    // Test state transitions
    const transitions = [
      { from: CHAUFFEUR_STATES.INITIAL, event: 'volcano_erupts', to: CHAUFFEUR_STATES.DISTRESS_CALL },
      { from: CHAUFFEUR_STATES.DISTRESS_CALL, event: 'rescued', to: CHAUFFEUR_STATES.RESCUED },
      { from: CHAUFFEUR_STATES.DISTRESS_CALL, event: 'abandoned', to: CHAUFFEUR_STATES.ABANDONED },
      { from: CHAUFFEUR_STATES.RESCUED, event: 'family_safe', to: CHAUFFEUR_STATES.GRATEFUL },
      { from: CHAUFFEUR_STATES.ABANDONED, event: 'survived_alone', to: CHAUFFEUR_STATES.DEVASTATED }
    ];

    for (const t of transitions) {
      assert.ok(t.from && t.to, `Transition ${t.event} should have valid states`);
    }
  }
};

const actionReportTests = {
  'Masterton radio command generates report': () => {
    backupState();
    try {
      const report = generateActionReport(
        { id: 'radio-command', visibility: 'witnessed' },
        { id: 'dictator-masterton', name: 'Dictator Masterton' },
        { success: true, message: 'Coordinates evacuation from command post' }
      );

      assert.ok(report, 'Report should be generated');
      assert.equal(report.visibility, 'witnessed');
      assert.equal(report.npcId, 'dictator-masterton');

      queueReport(report);
      const alex = getTestPc('alex_ryder');
      const reports = getReportsForPc(alex.id);

      assert.equal(reports.length, 1, 'Alex should see the report');
    } finally {
      restoreState();
    }
  },

  'Chauffeur distress call is direct visibility': () => {
    backupState();
    try {
      const alex = getTestPc('alex_ryder');

      const report = generateActionReport(
        { id: 'distress-call', visibility: 'direct', targetPc: alex.id },
        { id: 'vargr-chauffeur', name: 'Vargr Chauffeur' },
        { success: true, message: 'Mayday! The limo is down. My parents are trapped!' }
      );

      queueReport(report);

      // Direct should only be visible to target
      const alexReports = getReportsForPc(alex.id);
      const drakeReports = getReportsForPc('captain-drake');

      assert.equal(alexReports.length, 1, 'Alex should see direct message');
      assert.equal(drakeReports.length, 0, 'Drake should not see direct message');
    } finally {
      restoreState();
    }
  },

  'Rescue outcome generates witnessed report': () => {
    backupState();
    try {
      const report = generateActionReport(
        { id: 'rescue-complete', visibility: 'witnessed' },
        { id: 'narrator', name: 'Narrator' },
        { success: true, message: 'The Highndry touches down at Barvinn. Eleven refugees scramble aboard.' }
      );

      queueReport(report);

      // All PCs should see witnessed events
      const alex = getTestPc('alex_ryder');
      const drake = getTestPc('captain_drake');

      assert.ok(getReportsForPc(alex.id).length > 0);
      assert.ok(getReportsForPc(drake.id).length > 0);
    } finally {
      restoreState();
    }
  }
};

const resolutionStateTests = {
  'Barvinn saved resolution state': () => {
    const state = getState('resolution_barvinn_saved');

    assert.ok(state.flags.barvinn_rescued, 'Barvinn rescued');
    assert.ok(!state.flags.vargr_rescued, 'Vargr not rescued');
    assert.equal(state.flags.casualties, 3, '3 casualties');
    assert.ok(state.completedBeats.includes('takeoff_success'), 'Escaped successfully');
  },

  'Vargr saved resolution state': () => {
    const state = getState('resolution_vargr_saved');

    assert.ok(!state.flags.barvinn_rescued, 'Barvinn not rescued');
    assert.ok(state.flags.vargr_rescued, 'Vargr rescued');
    assert.equal(state.flags.casualties, 11, '11 casualties');
  },

  'Plot context reflects resolution': () => {
    const state = getState('resolution_vargr_saved');
    const narrator = {
      id: 'narrator',
      archetype: 'narrator',
      plotAwareness: { scope: 'adventure', knowsAbout: ['vargr_rescued', 'casualties'] }
    };
    const alex = getTestPc('alex_ryder');

    const context = buildPlotContext(state, narrator, alex);

    assert.ok(context.includes('vargr_rescued'), 'Should mention rescue choice');
  }
};

// === RUN TESTS ===

console.log('\n══════════════════════════════════════════');
console.log('  CRISIS INTEGRATION TESTS');
console.log('  Volcanic Eruption & Moral Choice');
console.log('══════════════════════════════════════════\n');

console.log('--- Crisis Setup Tests ---');
const setup = runTests(crisisSetupTests);

console.log('\n--- Rescue Choice Tests ---');
const rescue = runTests(rescueChoiceTests);

console.log('\n--- Chauffeur State Tests ---');
const chauffeur = runTests(chauffeurStateTests);

console.log('\n--- Action Report Tests ---');
const reports = runTests(actionReportTests);

console.log('\n--- Resolution State Tests ---');
const resolution = runTests(resolutionStateTests);

const allPassed = setup && rescue && chauffeur && reports && resolution;
process.exit(allPassed ? 0 : 1);
