/**
 * Learning Integration - Bridge between extracted facts and the learning loop
 *
 * Phase 4 of knowledge extraction pipeline.
 * Enables the learner to process failures from generated queries.
 */

const fs = require('fs');
const path = require('path');
const { loadFacts: loadExtractedFacts } = require('./scene-extractor');

const EXTRACTED_FACTS_DIR = path.join(__dirname, '../../data/red-team/extracted-facts');

/**
 * Get list of adventures with extracted facts
 * @returns {string[]} Adventure IDs
 */
function getAdventuresWithFacts() {
  if (!fs.existsSync(EXTRACTED_FACTS_DIR)) {
    return [];
  }

  return fs.readdirSync(EXTRACTED_FACTS_DIR)
    .filter(f => {
      const factPath = path.join(EXTRACTED_FACTS_DIR, f, 'facts.json');
      return fs.existsSync(factPath);
    });
}

/**
 * Load all extracted facts from all adventures
 * @returns {Array} All extracted facts
 */
function loadAllExtractedFacts() {
  const adventures = getAdventuresWithFacts();
  const allFacts = [];

  for (const adventureId of adventures) {
    const facts = loadExtractedFacts(adventureId);
    if (facts) {
      allFacts.push(...facts);
    }
  }

  return allFacts;
}

/**
 * Get an extracted fact by ID
 * @param {string} factId - Extracted fact ID (starts with EXT_)
 * @returns {Object|null} Fact object or null
 */
function getExtractedFact(factId) {
  if (!factId || !factId.startsWith('EXT_')) {
    return null;
  }

  const allFacts = loadAllExtractedFacts();
  return allFacts.find(f => f.id === factId) || null;
}

/**
 * Get extraction coverage metrics
 * @returns {Object} Metrics about extracted facts
 */
function getExtractionMetrics() {
  const adventures = getAdventuresWithFacts();
  let totalFacts = 0;
  let byPriority = { 1: 0, 2: 0, 3: 0 };
  let byAdventure = {};

  for (const adventureId of adventures) {
    const facts = loadExtractedFacts(adventureId);
    if (facts) {
      byAdventure[adventureId] = facts.length;
      totalFacts += facts.length;

      for (const fact of facts) {
        byPriority[fact.priority] = (byPriority[fact.priority] || 0) + 1;
      }
    }
  }

  return {
    extracted_facts_count: totalFacts,
    adventures_covered: adventures.length,
    by_adventure: byAdventure,
    by_priority: byPriority,
    extraction_coverage: adventures.length > 0 ? totalFacts / adventures.length : 0
  };
}

/**
 * Build index of extracted facts for fast lookup
 * @returns {Object} { byId: {}, byScene: {}, byNpc: {} }
 */
function buildExtractedFactIndex() {
  const allFacts = loadAllExtractedFacts();
  const byId = {};
  const byScene = {};
  const byNpc = {};

  for (const fact of allFacts) {
    byId[fact.id] = fact;

    // Index by scene (from source field)
    const sceneMatch = fact.source?.match(/^([^.]+)\.json/);
    if (sceneMatch) {
      const scene = sceneMatch[1];
      if (!byScene[scene]) byScene[scene] = [];
      byScene[scene].push(fact);
    }

    // Index by NPC
    for (const npcId of fact.relevant_npcs || []) {
      if (!byNpc[npcId]) byNpc[npcId] = [];
      byNpc[npcId].push(fact);
    }
  }

  return { byId, byScene, byNpc, facts: allFacts };
}

/**
 * Get extracted facts for a specific NPC
 * @param {string} npcId - NPC identifier
 * @returns {Array} Facts relevant to this NPC
 */
function getExtractedFactsForNpc(npcId) {
  const index = buildExtractedFactIndex();
  return index.byNpc[npcId] || [];
}

/**
 * Check if a fact ID is an extracted fact
 * @param {string} factId - Fact identifier
 * @returns {boolean}
 */
function isExtractedFact(factId) {
  return Boolean(factId && factId.startsWith('EXT_'));
}

module.exports = {
  // Core lookup
  getExtractedFact,
  isExtractedFact,

  // Batch operations
  loadAllExtractedFacts,
  buildExtractedFactIndex,
  getExtractedFactsForNpc,

  // Discovery
  getAdventuresWithFacts,

  // Metrics
  getExtractionMetrics,

  // Constants
  EXTRACTED_FACTS_DIR
};
