/**
 * Query Generator - Generate validation queries from extracted facts
 *
 * Phase 2 of knowledge extraction pipeline.
 * Transforms facts into testable queries for NPC validation.
 */

const fs = require('fs');
const path = require('path');
const { loadFacts, PRIORITY } = require('./scene-extractor');

const OUTPUT_DIR = path.join(__dirname, '../../data/red-team/generated-queries');

/**
 * Query templates by fact category
 */
const TEMPLATES = {
  mechanics: [
    'What are the effects of {topic}?',
    'How does {topic} work?',
    'What penalties apply for {topic}?'
  ],
  geography: [
    'Describe {location}',
    "What's the terrain like at {location}?",
    'Tell me about {location}'
  ],
  ship: [
    "What's wrong with the ship?",
    'What repairs are needed?',
    "What's the status of {system}?"
  ],
  hazards: [
    'What dangers should I watch for?',
    'What are the environmental hazards?',
    'What conditions affect the area?'
  ],
  stages: [
    'What are the stages of {topic}?',
    'Describe the route for {topic}',
    'What should I know about {topic}?'
  ],
  skill_checks: [
    'What checks are required for {topic}?',
    'When do I need to roll for {topic}?'
  ]
};

/**
 * Map fact source to template category
 * @param {Object} fact - Extracted fact
 * @returns {string} Template category
 */
function categorize(fact) {
  const source = fact.source.toLowerCase();

  if (source.includes('altitude_sickness')) return 'mechanics';
  if (source.includes('stages')) return 'geography';
  if (source.includes('ship_condition')) return 'ship';
  if (source.includes('repair_requirements')) return 'ship';
  if (source.includes('environmental_hazards')) return 'hazards';
  if (source.includes('skill_checks')) return 'skill_checks';

  // Default based on priority
  if (fact.priority === PRIORITY.mechanics) return 'mechanics';
  return 'geography';
}

/**
 * Extract topic from fact for template substitution
 * @param {Object} fact - Extracted fact
 * @returns {string} Topic string
 */
function extractTopic(fact) {
  const source = fact.source.toLowerCase();

  if (source.includes('altitude_sickness')) return 'altitude sickness';
  if (source.includes('stages') && !source.includes('[')) return 'climbing Mount Salbarii';
  if (source.includes('stages[')) {
    // Extract stage name from content
    const match = fact.content.match(/^([^:]+):/);
    return match ? match[1] : 'the climb';
  }
  if (source.includes('ship_condition')) {
    const match = source.match(/ship_condition\.(\w+)/);
    return match ? `the ${match[1].replace('_', ' ')}` : 'the ship';
  }
  if (source.includes('repair_requirements')) return 'ship repairs';
  if (source.includes('environmental_hazards')) return 'the area';
  if (source.includes('skill_checks')) {
    const match = fact.content.match(/triggers when (.+)$/);
    return match ? match[1] : 'this action';
  }

  return 'this';
}

/**
 * Select best template for a fact
 * @param {Object} fact - Extracted fact
 * @returns {string} Template string with {topic} placeholder
 */
function selectTemplate(fact) {
  const category = categorize(fact);
  const templates = TEMPLATES[category] || TEMPLATES.geography;

  // Use first template by default, could randomize or rotate
  return templates[0];
}

/**
 * Generate a single query from a fact
 * @param {Object} fact - Extracted fact
 * @param {number} index - Query index for ID generation
 * @returns {Object} Query object
 */
function generateQuery(fact, index) {
  const template = selectTemplate(fact);
  const topic = extractTopic(fact);
  const query = template.replace('{topic}', topic)
                        .replace('{location}', topic)
                        .replace('{system}', topic);

  return {
    id: `GEN_Q${index.toString().padStart(3, '0')}`,
    source: 'extracted',
    fact_id: fact.id,
    tier: fact.priority,
    target_npcs: fact.relevant_npcs || ['narrator-high-and-dry'],
    query,
    expected_keywords: fact.keywords || [],
    failure_keywords: []
  };
}

/**
 * Generate queries from an array of facts
 * @param {Array} facts - Extracted facts
 * @returns {Array} Generated queries
 */
function generateQueries(facts) {
  const queries = [];
  const seenFactIds = new Set();
  let index = 1;

  for (const fact of facts) {
    // Skip duplicates (one query per fact)
    if (seenFactIds.has(fact.id)) continue;
    seenFactIds.add(fact.id);

    queries.push(generateQuery(fact, index));
    index++;
  }

  return queries;
}

/**
 * Generate queries for an adventure from its extracted facts
 * @param {string} adventureId - Adventure identifier
 * @returns {Object} { queries: Array, count: number, errors: Array }
 */
function generateQueriesForAdventure(adventureId) {
  const facts = loadFacts(adventureId);

  if (!facts) {
    return {
      queries: [],
      count: 0,
      errors: [`No facts found for adventure: ${adventureId}`]
    };
  }

  const queries = generateQueries(facts);

  return { queries, count: queries.length, errors: [] };
}

/**
 * Save generated queries to output file
 * @param {string} adventureId - Adventure identifier
 * @param {Array} queries - Generated queries
 * @returns {string} Output file path
 */
function saveGeneratedQueries(adventureId, queries) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outPath = path.join(OUTPUT_DIR, `${adventureId}.json`);

  fs.writeFileSync(outPath, JSON.stringify({
    version: '1.0',
    generated: new Date().toISOString(),
    adventure: adventureId,
    count: queries.length,
    queries
  }, null, 2));

  return outPath;
}

/**
 * Load generated queries for an adventure
 * @param {string} adventureId - Adventure identifier
 * @returns {Array|null} Queries array or null if not found
 */
function loadGeneratedQueries(adventureId) {
  const queriesPath = path.join(OUTPUT_DIR, `${adventureId}.json`);

  if (!fs.existsSync(queriesPath)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(queriesPath, 'utf8'));
    return data.queries || [];
  } catch (e) {
    return null;
  }
}

/**
 * Generate and save queries for an adventure
 * @param {string} adventureId - Adventure identifier
 * @returns {Object} { path: string, count: number, errors: Array }
 */
function generateAndSave(adventureId) {
  const result = generateQueriesForAdventure(adventureId);

  if (result.errors.length > 0) {
    return { path: null, count: 0, errors: result.errors };
  }

  const outPath = saveGeneratedQueries(adventureId, result.queries);

  return { path: outPath, count: result.count, errors: [] };
}

module.exports = {
  // Core generation
  generateQueries,
  generateQuery,
  generateQueriesForAdventure,

  // Template utilities
  categorize,
  extractTopic,
  selectTemplate,
  TEMPLATES,

  // Persistence
  saveGeneratedQueries,
  loadGeneratedQueries,
  generateAndSave,

  // Constants
  OUTPUT_DIR
};
