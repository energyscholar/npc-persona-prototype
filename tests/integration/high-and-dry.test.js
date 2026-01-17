#!/usr/bin/env node
/**
 * High and Dry Integration Test Suite
 * End-to-end validation of all NPC systems using the High and Dry adventure.
 *
 * This is the main integration test that simulates a complete playthrough.
 */

const { strict: assert } = require('assert');
const fs = require('fs');
const path = require('path');

// Core modules under test
const disposition = require('../../src/disposition');
const infoGating = require('../../src/info-gating');
const plotContext = require('../../src/plot-context');
const beatSummaries = require('../../src/beat-summaries');
const actionReports = require('../../src/action-reports');

// Fixtures
const { getState, advanceToState, STORY_STATES } = require('./fixtures/story-states');
const { getTestPc, isVargr } = require('./fixtures/test-pcs');

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

// State management for integration tests
function resetAllState() {
  // Reset dispositions
  disposition.saveDispositions({ relationships: {} });

  // Reset unlocks
  infoGating.saveUnlocks({ unlocks: {} });

  // Clear action reports
  actionReports.clearReports();
}

// Load NPC config helper
function loadNpc(npcId) {
  const npcPath = path.join(__dirname, '../../data/npcs', `${npcId}.json`);
  if (fs.existsSync(npcPath)) {
    return JSON.parse(fs.readFileSync(npcPath, 'utf8'));
  }
  return null;
}

// === PLAYTHROUGH SIMULATION ===

const playthroughTests = {
  'Act 1: Journey begins with clean state': () => {
    resetAllState();

    const state = getState('act1_journey');
    const alex = getTestPc('alex_ryder');
    const corelli = loadNpc('captain-corelli');

    // Verify initial state
    assert.equal(state.currentAct, 'act-1-journey');
    assert.equal(state.completedBeats.length, 0);

    // Corelli should be available
    assert.ok(corelli, 'Captain Corelli should load');
    assert.equal(corelli.archetype, 'crew');
  },

  'Act 2: Arrival on Walston': () => {
    resetAllState();

    const state = getState('act2_arrival');
    const alex = getTestPc('alex_ryder');

    // Verify arrival state
    assert.ok(state.completedBeats.includes('arrival_walston'));
    assert.ok(state.flags.customs_cleared);

    // Beat summary should exist
    const summary = beatSummaries.getBeatSummary('arrival_walston', 'high-and-dry');
    assert.ok(summary, 'Arrival summary should exist');
    assert.ok(summary.includes('Walston'), 'Summary should mention Walston');
  },

  'Act 2: Initial disposition with Greener': () => {
    resetAllState();

    const state = getState('act2_negotiation');
    const alex = getTestPc('alex_ryder');
    const greener = loadNpc('minister-greener');

    // Initial disposition should be neutral
    const disp = disposition.getDisposition(greener.id, alex.id);
    assert.equal(disp.level, 0);
    assert.equal(disp.label, 'neutral');
  },

  'Act 2: Vargr PC faces prejudice': () => {
    resetAllState();

    const vargr = getTestPc('vargr_trader');
    const greener = loadNpc('minister-greener');

    assert.ok(isVargr(vargr), 'Should identify as Vargr');

    // Apply species penalty
    disposition.modifyDisposition(greener.id, vargr.id, -2, 'Walston species bias', '015-1105');

    const disp = disposition.getDisposition(greener.id, vargr.id);
    assert.equal(disp.level, -2);
    assert.equal(disp.label, 'unfriendly');
  },

  'Act 2: Successful negotiation with Greener': () => {
    resetAllState();

    let state = getState('act2_negotiation');
    const alex = getTestPc('alex_ryder');
    const greener = loadNpc('minister-greener');

    // Negotiate successfully
    disposition.modifyDisposition(greener.id, alex.id, 1, 'Fair negotiation', state.gameDate);

    const disp = disposition.getDisposition(greener.id, alex.id);
    assert.equal(disp.level, 1);
    assert.equal(disp.label, 'favorable');

    // Update state
    state.flags.survey_accepted = true;
    state.flags.payment = 4000;
    state.completedBeats.push('survey_accepted');

    assert.ok(state.flags.survey_accepted);
  },

  'Act 2: Gather intel from bartender': () => {
    resetAllState();

    const alex = getTestPc('alex_ryder');

    // Unlock crew_trouble (Carouse 6+ passed)
    infoGating.recordUnlock(alex.id, 'startown-bartender', 'crew_trouble');

    assert.ok(infoGating.isUnlocked(alex.id, 'startown-bartender', 'crew_trouble'));

    // Higher tiers still locked
    assert.ok(!infoGating.isUnlocked(alex.id, 'startown-bartender', 'sabotage_rumors'));
  },

  'Act 3: Journey to ship and discovery': () => {
    resetAllState();

    const state = getState('act3_ship_found');
    const alex = getTestPc('alex_ryder');

    assert.ok(state.completedBeats.includes('found_ship'));
    assert.ok(state.flags.ship_located);

    const summary = beatSummaries.getBeatSummary('found_ship', 'high-and-dry');
    assert.ok(summary, 'Found ship summary should exist');
  },

  'Act 4: Crisis state validated': () => {
    resetAllState();

    const state = getState('act4_crisis');

    assert.ok(state.flags.volcano_active);
    assert.ok(state.flags.evacuation_ordered);
    assert.ok(state.completedBeats.includes('eruption_begins'));
  },

  'Act 4: Moral choice - rescue Vargr': () => {
    resetAllState();

    const state = getState('act4_crisis');
    const alex = getTestPc('alex_ryder');

    // Player chooses to rescue Vargr
    state.flags.vargr_rescued = true;
    state.flags.barvinn_rescued = false;

    // Chauffeur disposition changes dramatically
    disposition.modifyDisposition('vargr-chauffeur', alex.id, 3, 'Heroic rescue', state.gameDate);

    const disp = disposition.getDisposition('vargr-chauffeur', alex.id);
    assert.equal(disp.level, 3);
    assert.equal(disp.label, 'allied');
  },

  'Narrator context includes completed beats': () => {
    resetAllState();

    const state = getState('act2_accepted');
    const narrator = loadNpc('narrator-high-and-dry');
    const alex = getTestPc('alex_ryder');

    const context = plotContext.buildPlotContext(state, narrator, alex);

    // Narrator should have full context
    assert.ok(context.includes('Alex Ryder'), 'PC name included');
    assert.ok(context.includes('WHAT HAS ALREADY HAPPENED'), 'Beat section included');
    assert.ok(context.includes('Agreed to complete') || context.includes('survey'), 'Survey mentioned');
    assert.ok(context.includes('Do not re-narrate'), 'Re-narration warning included');
  },

  'NPC context is appropriately scoped': () => {
    resetAllState();

    const state = getState('act2_startown');
    const bartender = loadNpc('startown-bartender');
    const alex = getTestPc('alex_ryder');

    // Bartender has limited scope - not full adventure awareness
    const bartenderConfig = {
      ...bartender,
      plotAwareness: { scope: 'scene' }
    };

    const context = plotContext.buildPlotContext(state, bartenderConfig, alex);

    // Scene-scoped NPC gets current scene, not full beat history
    assert.ok(context.includes('Current Scene') || context.includes('ADVENTURE STATE'));
  },

  'Action reports filter by visibility': () => {
    resetAllState();

    const alex = getTestPc('alex_ryder');
    const drake = getTestPc('captain_drake');

    // Direct message to Alex
    const directReport = actionReports.generateActionReport(
      { id: 'distress', visibility: 'direct', targetPc: alex.id },
      { id: 'vargr-chauffeur', name: 'Chauffeur' },
      { success: true, message: 'Help!' }
    );
    actionReports.queueReport(directReport);

    // Witnessed event
    const witnessedReport = actionReports.generateActionReport(
      { id: 'eruption', visibility: 'witnessed' },
      { id: 'narrator', name: 'Narrator' },
      { success: true, message: 'The volcano erupts!' }
    );
    actionReports.queueReport(witnessedReport);

    // Alex sees both
    const alexReports = actionReports.getReportsForPc(alex.id);
    assert.equal(alexReports.length, 2);

    // Drake only sees witnessed
    const drakeReports = actionReports.getReportsForPc(drake.id);
    assert.equal(drakeReports.length, 1);
    assert.equal(drakeReports[0].visibility, 'witnessed');
  },

  'Disposition history tracks full journey': () => {
    resetAllState();

    const alex = getTestPc('alex_ryder');

    // Series of interactions with Greener
    disposition.modifyDisposition('minister-greener', alex.id, 1, 'Polite introduction', '015-1105');
    disposition.modifyDisposition('minister-greener', alex.id, 1, 'Accepted fair terms', '015-1105');
    disposition.modifyDisposition('minister-greener', alex.id, 1, 'Completed survey', '018-1105');

    const disp = disposition.getDisposition('minister-greener', alex.id);

    assert.equal(disp.level, 3);
    assert.equal(disp.history.length, 3);
    assert.equal(disp.history[0].reason, 'Polite introduction');
    assert.equal(disp.history[2].reason, 'Completed survey');
  },

  'Full playthrough simulation': () => {
    resetAllState();

    // This simulates a complete successful playthrough
    const alex = getTestPc('alex_ryder');

    // Act 1: Journey (no significant interactions)
    let state = getState('act1_journey');

    // Act 2: Arrival
    state = advanceToState(state, 'act2_arrival');

    // Meet Greener, negotiate successfully
    disposition.modifyDisposition('minister-greener', alex.id, 1, 'Fair negotiation', state.gameDate);

    // Gather intel at bar
    infoGating.recordUnlock(alex.id, 'startown-bartender', 'crew_trouble');

    // Act 3: Find ship
    state = advanceToState(state, 'act3_ship_found');

    // Act 4: Crisis
    state = advanceToState(state, 'act4_crisis');

    // Make moral choice - rescue both (risky)
    state.flags.vargr_rescued = true;
    state.flags.barvinn_rescued = true;

    // Both groups grateful
    disposition.modifyDisposition('vargr-chauffeur', alex.id, 2, 'Rescued family', state.gameDate);

    // Verify final state
    const greenerDisp = disposition.getDisposition('minister-greener', alex.id);
    const chauffeurDisp = disposition.getDisposition('vargr-chauffeur', alex.id);

    assert.equal(greenerDisp.level, 1, 'Greener favorable');
    assert.equal(chauffeurDisp.level, 2, 'Chauffeur friendly');

    assert.ok(infoGating.isUnlocked(alex.id, 'startown-bartender', 'crew_trouble'));

    // All major systems exercised
    console.log('      Full playthrough completed successfully');
  }
};

// === ARCHETYPE TESTS ===

const archetypeTests = {
  'Patron archetype: Minister Greener': () => {
    const greener = loadNpc('minister-greener');

    assert.equal(greener.archetype, 'patron');
    assert.ok(greener.knowledge_base.the_job, 'Patron provides job info');
    assert.ok(greener.knowledge_base.the_payment, 'Patron discusses payment');
  },

  'Official archetype: Customs Officer Corfe': () => {
    const corfe = loadNpc('customs-officer-walston');

    assert.equal(corfe.archetype, 'official');
    assert.ok(corfe.knowledge_base.procedures, 'Official knows procedures');
  },

  'Contact archetype: Bartender Tannen': () => {
    const bartender = loadNpc('startown-bartender');

    assert.equal(bartender.archetype, 'contact');
    assert.ok(bartender.knowledge_base.local_tips, 'Contact provides local info');
  },

  'Official archetype: Dictator Masterton': () => {
    const masterton = loadNpc('dictator-masterton');

    assert.equal(masterton.archetype, 'official');
    assert.ok(masterton.knowledge_base.crisis_mode, 'Crisis authority present');
  },

  'Crew archetype: Captain Corelli': () => {
    const corelli = loadNpc('captain-corelli');

    assert.equal(corelli.archetype, 'crew');
  },

  'Narrator archetype: Omniscient context': () => {
    const narrator = loadNpc('narrator-high-and-dry');

    assert.equal(narrator.archetype, 'narrator');
    assert.ok(narrator.knowledge_base.adventure_overview, 'Knows full adventure');
    assert.ok(narrator.story_beats, 'Has story beats list');
  }
};

// === RUN ALL TESTS ===

console.log('\n══════════════════════════════════════════════════════════════');
console.log('  HIGH AND DRY INTEGRATION TEST SUITE');
console.log('  End-to-end validation of NPC systems');
console.log('══════════════════════════════════════════════════════════════\n');

// Ensure clean starting state
resetAllState();

console.log('--- Playthrough Simulation Tests ---');
const playthrough = runTests(playthroughTests);

console.log('\n--- Archetype Tests ---');
const archetypes = runTests(archetypeTests);

// Final cleanup
resetAllState();

const allPassed = playthrough && archetypes;

console.log('\n══════════════════════════════════════════════════════════════');
if (allPassed) {
  console.log('  ALL INTEGRATION TESTS PASSED ✓');
} else {
  console.log('  SOME INTEGRATION TESTS FAILED ✗');
}
console.log('══════════════════════════════════════════════════════════════\n');

process.exit(allPassed ? 0 : 1);
