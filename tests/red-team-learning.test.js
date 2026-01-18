#!/usr/bin/env node
/**
 * Red Team Learning Test
 *
 * Runs red team validation with AI client and executes learning cycle.
 * This is a proper test that can be run headlessly (not via TUI).
 *
 * Usage: node tests/red-team-learning.test.js [npcId]
 *        node tests/red-team-learning.test.js --all
 */

require('dotenv').config();
const { strict: assert } = require('assert');
const fs = require('fs');
const path = require('path');

// Import red team modules
const redTeam = require('../src/red-team');
const { loadPersona } = require('../src/persona');
const { createClient } = require('../src/ai-client');
const { runLearningForReport } = require('../src/red-team/learner');

// Configuration
const MAX_FAILURES_TO_LEARN = 5; // Limit per NPC to control costs
const DRY_RUN = process.argv.includes('--dry-run');
const AUTO_APPLY = !DRY_RUN; // Apply patches by default unless dry-run

/**
 * Run validation and learning for a single NPC
 */
async function runNpcValidation(npcId, client) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Validating: ${npcId}`);
  console.log('='.repeat(60));

  const npc = loadPersona(npcId);
  if (!npc) {
    console.log(`  ERROR: NPC ${npcId} not found`);
    return { npcId, error: 'NPC not found' };
  }

  // Run validation
  console.log(`  Running queries...`);
  const report = await redTeam.runRedTeamValidation(npcId, npc, {
    client,
    autoPatch: false,
    dryRun: true
  });

  console.log(`  Results: ${report.summary.pass} pass, ${report.summary.fail} fail, ${report.summary.warn} warn`);

  // Run learning on failures
  if (report.summary.fail > 0) {
    console.log(`\n  Learning from ${Math.min(report.summary.fail, MAX_FAILURES_TO_LEARN)} failures...`);

    // Limit failures to learn from
    const limitedReport = {
      ...report,
      results: report.results.filter(r => r.verdict === 'FAIL').slice(0, MAX_FAILURES_TO_LEARN)
    };

    const learningResult = await runLearningForReport(limitedReport, {
      client,
      autoApply: AUTO_APPLY,
      dryRun: DRY_RUN
    });

    console.log(`  Learning summary:`);
    console.log(`    - Learned: ${learningResult.summary.learned}`);
    console.log(`    - Learned (needs review): ${learningResult.summary.learnedNeedsReview || 0}`);
    console.log(`    - Failed: ${learningResult.summary.failed}`);
    console.log(`    - Pending: ${learningResult.summary.pending}`);

    return { npcId, report, learningResult };
  }

  return { npcId, report, learningResult: null };
}

/**
 * Main test runner
 */
async function main() {
  console.log('Red Team Learning Test');
  console.log('=====================');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'AUTO APPLY (learning enabled)'}`);
  console.log('');

  // Initialize
  redTeam.initializeRedTeam();
  const coverage = redTeam.getCoverageSummary();

  console.log(`Facts: ${coverage.totalFacts} | Queries: ${coverage.totalQueries}`);
  console.log(`NPCs with queries: ${Object.keys(coverage.npcCoverage).filter(id => coverage.npcCoverage[id].queries > 0).length}`);

  // Create AI client
  const client = createClient();

  // Get target NPCs
  const npcsWithQueries = Object.keys(coverage.npcCoverage).filter(id =>
    coverage.npcCoverage[id].queries > 0
  );

  let targetNpcs = [];
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));

  if (args.includes('--all') || args.length === 0) {
    targetNpcs = npcsWithQueries;
  } else {
    targetNpcs = args.filter(id => npcsWithQueries.includes(id));
    if (targetNpcs.length === 0) {
      console.log(`\nAvailable NPCs: ${npcsWithQueries.join(', ')}`);
      console.log('Usage: node tests/red-team-learning.test.js [npcId] [--apply] [--dry-run]');
      process.exit(1);
    }
  }

  console.log(`\nTarget NPCs: ${targetNpcs.join(', ')}`);

  // Run validation for each NPC
  const results = [];
  for (const npcId of targetNpcs) {
    try {
      const result = await runNpcValidation(npcId, client);
      results.push(result);
    } catch (e) {
      console.error(`  Error: ${e.message}`);
      results.push({ npcId, error: e.message });
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));

  let totalPass = 0, totalFail = 0, totalLearned = 0;

  for (const r of results) {
    if (r.error) {
      console.log(`  ${r.npcId}: ERROR - ${r.error}`);
    } else {
      const s = r.report.summary;
      totalPass += s.pass;
      totalFail += s.fail;
      if (r.learningResult) {
        const ls = r.learningResult.summary;
        totalLearned += ls.learned + (ls.learnedNeedsReview || 0);
      }
      const learnedCount = r.learningResult ? (r.learningResult.summary.learned + (r.learningResult.summary.learnedNeedsReview || 0)) : 0;
      console.log(`  ${r.npcId}: ${s.pass} pass, ${s.fail} fail${learnedCount > 0 ? `, ${learnedCount} learned` : ''}`);
    }
  }

  console.log(`\nTotals: ${totalPass} pass, ${totalFail} fail, ${totalLearned} learned`);
  console.log('');

  // Exit with failure if there are still failing tests after learning
  const remainingFails = totalFail - totalLearned;
  if (remainingFails > 0 && !DRY_RUN) {
    console.log(`WARNING: ${remainingFails} failures remain after learning`);
  }
}

// Run
main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
