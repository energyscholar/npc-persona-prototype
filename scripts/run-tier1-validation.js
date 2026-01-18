#!/usr/bin/env node
/**
 * Tier 1 Validation Runner
 *
 * Runs all CRITICAL (Tier 1) queries against target NPCs,
 * validates responses, and runs auto-learn cycle for failures.
 *
 * Usage: node scripts/run-tier1-validation.js [--auto-learn] [--force]
 */

require('dotenv').config();

const { loadPersona } = require('../src/persona');
const { buildSystemPrompt } = require('../src/prompts');
const { createClient, chat, HAIKU_MODEL } = require('../src/ai-client');
const {
  queryEngine,
  validator,
  learner
} = require('../src/red-team');

// Parse args
const args = process.argv.slice(2);
const autoLearn = args.includes('--auto-learn');
const forceRun = args.includes('--force');

// Target NPCs for Tier 1 validation
const TARGET_NPCS = [
  'narrator-high-and-dry',
  'mr-casarii',
  'customs-officer-walston',
  'minister-greener'
];

/**
 * Execute a query against an NPC using full persona system
 */
async function executeQueryWithPersona(query, npcId, client) {
  const persona = loadPersona(npcId);
  const systemPrompt = buildSystemPrompt(persona);

  const messages = [
    { role: 'user', content: query.query }
  ];

  const response = await chat(client, systemPrompt, messages, {
    maxTokens: 500
  });

  return {
    query_id: query.id,
    npc_id: npcId,
    query_text: query.query,
    response: response.content,
    timestamp: new Date().toISOString()
  };
}

/**
 * Run validation for a single NPC
 */
async function validateNpc(npcId, client) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Validating: ${npcId}`);
  console.log('='.repeat(60));

  // Check cache
  if (!forceRun) {
    const skipCheck = validator.shouldSkipValidation(npcId, 1);
    if (skipCheck.skip) {
      console.log(`  [CACHED] ${skipCheck.reason}`);
      return { npcId, skipped: true, reason: skipCheck.reason };
    }
  }

  // Get Tier 1 queries for this NPC
  const queries = queryEngine.getCriticalQueriesForNpc(npcId);

  if (queries.length === 0) {
    console.log(`  No Tier 1 queries for this NPC`);
    return { npcId, skipped: true, reason: 'No Tier 1 queries' };
  }

  console.log(`  Running ${queries.length} Tier 1 queries...`);

  const results = [];

  for (const query of queries) {
    process.stdout.write(`  ${query.id}: "${query.query.slice(0, 40)}..." `);

    try {
      const queryResult = await executeQueryWithPersona(query, npcId, client);
      const validation = validator.validateResponse(queryResult.response, query);

      const result = {
        ...queryResult,
        ...validation,
        fact_id: query.fact_id
      };

      results.push(result);

      // Print verdict
      const icon = validation.verdict === 'PASS' ? '✓' :
                   validation.verdict === 'WARN' ? '⚠' : '✗';
      console.log(`${icon} ${validation.verdict}`);

      if (validation.verdict !== 'PASS') {
        console.log(`    Response: "${queryResult.response.slice(0, 80)}..."`);
        console.log(`    Details: ${validation.details}`);
      }
    } catch (error) {
      console.log(`✗ ERROR: ${error.message}`);
      results.push({
        query_id: query.id,
        npc_id: npcId,
        verdict: 'FAIL',
        error: error.message
      });
    }
  }

  // Create report
  const report = {
    npc_id: npcId,
    tier: 1,
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      pass: results.filter(r => r.verdict === 'PASS').length,
      warn: results.filter(r => r.verdict === 'WARN').length,
      fail: results.filter(r => r.verdict === 'FAIL').length
    }
  };

  // Update cache
  validator.updateValidationCache(npcId, report);

  // Save report
  const reportPath = validator.saveValidationReport(report);
  console.log(`  Report: ${reportPath}`);

  return { npcId, report };
}

/**
 * Run learning cycle for failures
 */
async function learnFromFailures(npcResults, client) {
  const allFailures = [];

  for (const result of npcResults) {
    if (result.skipped || !result.report) continue;

    const failures = result.report.results.filter(r => r.verdict === 'FAIL');
    for (const failure of failures) {
      allFailures.push({
        ...failure,
        npc_id: result.npcId
      });
    }
  }

  if (allFailures.length === 0) {
    console.log('\nNo failures to learn from.');
    return [];
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running auto-learn for ${allFailures.length} failures`);
  console.log('='.repeat(60));

  const learnResults = [];

  for (const failure of allFailures) {
    console.log(`\nLearning: ${failure.npc_id} / ${failure.query_id}`);

    try {
      const cycle = await learner.runLearningCycle(failure, {
        autoApply: true,
        humanReview: false,
        client
      });

      learnResults.push(cycle);

      console.log(`  Status: ${cycle.final_status}`);
      if (cycle.generated_entry) {
        console.log(`  Generated: ${cycle.generated_entry.topic}`);
      }
      if (cycle.backup_path) {
        console.log(`  Backup: ${cycle.backup_path}`);
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
      learnResults.push({ error: error.message, npc_id: failure.npc_id });
    }
  }

  return learnResults;
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           TIER 1 (CRITICAL) VALIDATION RUNNER              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nOptions: auto-learn=${autoLearn}, force=${forceRun}`);
  console.log(`Target NPCs: ${TARGET_NPCS.join(', ')}`);

  // Create AI client
  let client;
  try {
    client = createClient();
    console.log('\nAI client initialized.');
  } catch (error) {
    console.error(`\nFailed to create AI client: ${error.message}`);
    process.exit(1);
  }

  // Run validation for each NPC
  const npcResults = [];
  for (const npcId of TARGET_NPCS) {
    try {
      const result = await validateNpc(npcId, client);
      npcResults.push(result);
    } catch (error) {
      console.error(`\nError validating ${npcId}: ${error.message}`);
      npcResults.push({ npcId, error: error.message });
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(60));

  let totalPass = 0, totalFail = 0, totalWarn = 0;

  for (const result of npcResults) {
    if (result.skipped) {
      console.log(`  ${result.npcId}: SKIPPED (${result.reason})`);
    } else if (result.error) {
      console.log(`  ${result.npcId}: ERROR - ${result.error}`);
    } else if (result.report) {
      const s = result.report.summary;
      console.log(`  ${result.npcId}: ${s.pass}✓ ${s.warn}⚠ ${s.fail}✗`);
      totalPass += s.pass;
      totalFail += s.fail;
      totalWarn += s.warn;
    }
  }

  console.log(`\n  TOTAL: ${totalPass} pass, ${totalWarn} warn, ${totalFail} fail`);

  // Auto-learn if enabled and there are failures
  if (autoLearn && totalFail > 0) {
    const learnResults = await learnFromFailures(npcResults, client);

    // Re-run validation after learning
    if (learnResults.some(r => r.final_status === 'LEARNED')) {
      console.log(`\n${'='.repeat(60)}`);
      console.log('RE-VALIDATION AFTER LEARNING');
      console.log('='.repeat(60));

      // Clear cache for learned NPCs
      const learnedNpcs = new Set(
        learnResults
          .filter(r => r.final_status === 'LEARNED')
          .map(r => r.npc_id)
      );

      for (const npcId of learnedNpcs) {
        validator.clearValidationCache(npcId);
      }

      // Re-validate
      for (const npcId of learnedNpcs) {
        await validateNpc(npcId, client);
      }
    }
  } else if (totalFail > 0 && !autoLearn) {
    console.log(`\n  ${totalFail} failures detected. Run with --auto-learn to fix.`);
  }

  // Final status
  const exitCode = totalFail === 0 ? 0 : 1;
  console.log(`\n${exitCode === 0 ? '✓ All Tier 1 checks passed!' : '✗ Some checks failed.'}`);
  process.exit(exitCode);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
