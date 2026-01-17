/**
 * Red Team Validation - Main entry point
 *
 * Exports all red team validation functionality.
 */

const factDatabase = require('./fact-database');
const queryEngine = require('./query-engine');
const validator = require('./validator');
const patchGenerator = require('./patch-generator');
const learner = require('./learner');
const learningLog = require('./learning-log');

/**
 * Run complete red team validation for an NPC
 * @param {string} npcId - NPC identifier
 * @param {Object} npc - NPC data
 * @param {Object} options - { client, autoPatch, dryRun }
 * @returns {Object} Validation report with patches
 */
async function runRedTeamValidation(npcId, npc, options = {}) {
  const { client = null, autoPatch = false, dryRun = true } = options;

  // Execute queries
  const queryResults = await queryEngine.executeAllQueriesForNpc(npcId, npc, client);

  // Validate responses
  const report = validator.runNpcValidation(npcId, queryResults);

  // Generate patches
  const patches = patchGenerator.generatePatchesFromReport(report);
  report.patches = patches;

  // Apply patches if requested
  if (autoPatch && patches.length > 0) {
    const patchResults = patchGenerator.applyPatches(patches, { dryRun });
    report.patchResults = patchResults;
  }

  // Save report
  const reportPath = validator.saveValidationReport(report);
  report.reportPath = reportPath;

  return report;
}

/**
 * Initialize the red team system
 * Creates fact database and query database
 */
function initializeRedTeam() {
  console.log('Initializing red team validation system...');

  // Initialize facts
  const facts = factDatabase.initializeFactDatabase();
  console.log(`  - Loaded ${facts.length} facts`);

  // Initialize queries
  const queries = queryEngine.initializeQueries();
  console.log(`  - Loaded ${queries.length} queries`);

  console.log('Red team system ready.');

  return { facts, queries };
}

/**
 * Get summary of red team coverage
 * @returns {Object} Coverage summary
 */
function getCoverageSummary() {
  const db = factDatabase.loadFacts();
  const queries = queryEngine.loadQueries();

  const npcCoverage = {};
  for (const fact of db.facts) {
    for (const npcId of fact.relevant_npcs || []) {
      if (!npcCoverage[npcId]) {
        npcCoverage[npcId] = { facts: 0, queries: 0 };
      }
      npcCoverage[npcId].facts++;
    }
  }

  for (const query of queries) {
    for (const npcId of query.target_npcs || []) {
      if (!npcCoverage[npcId]) {
        npcCoverage[npcId] = { facts: 0, queries: 0 };
      }
      npcCoverage[npcId].queries++;
    }
  }

  return {
    totalFacts: db.facts.length,
    totalQueries: queries.length,
    categories: Object.keys(db.byCategory).length,
    npcCoverage
  };
}

module.exports = {
  // Main API
  runRedTeamValidation,
  initializeRedTeam,
  getCoverageSummary,

  // Sub-modules
  factDatabase,
  queryEngine,
  validator,
  patchGenerator,
  learner,
  learningLog
};
