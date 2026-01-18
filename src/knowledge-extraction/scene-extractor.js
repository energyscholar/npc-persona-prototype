/**
 * Scene Extractor - Extract facts from adventure scene JSONs
 *
 * Extracts:
 * - Structured fields (stages, altitude_sickness, ship_condition, etc.)
 * - Prose fields via LLM (description, atmosphere, narrator_prompt)
 *
 * Output: Array of facts with id, source, priority, content, keywords
 */

const fs = require('fs');
const path = require('path');
const { createClient, quickChat } = require('../ai-client');

const SCENES_DIR = path.join(__dirname, '../../data/adventures');
const OUTPUT_DIR = path.join(__dirname, '../../data/red-team/extracted-facts');

// Structured fields to extract directly (no LLM needed)
const STRUCTURED_FIELDS = [
  'stages',
  'altitude_sickness',
  'repair_requirements',
  'environmental_hazards',
  'ship_condition',
  'skill_checks'
];

// Prose fields to extract via LLM
const PROSE_FIELDS = [
  'description',
  'atmosphere',
  'narrator_prompt'
];

// Priority mapping
const PRIORITY = {
  mechanics: 1,    // DMs, skill checks, repair requirements
  key_facts: 2,    // stages, conditions, hazards
  flavor: 3        // atmosphere, descriptions
};

/**
 * Generate unique fact ID
 * @param {string} sceneId - Scene identifier
 * @param {string} field - Field name
 * @param {number} index - Optional index for array items
 * @returns {string} Fact ID like "EXT_MC_001"
 */
function generateFactId(sceneId, field, index = null) {
  const prefix = sceneId
    .split('-')
    .map(w => w[0].toUpperCase())
    .join('')
    .slice(0, 3);
  const suffix = index !== null ? `_${index.toString().padStart(3, '0')}` : '';
  const fieldCode = field.slice(0, 3).toUpperCase();
  return `EXT_${prefix}_${fieldCode}${suffix}`;
}

/**
 * Extract keywords from content string
 * @param {string} content - Text to extract keywords from
 * @returns {string[]} Array of keywords
 */
function extractKeywords(content) {
  const keywords = [];

  // Extract numbers with units (altitude, DM modifiers, etc.)
  const numbers = content.match(/\d+m|\d+%|DM[-+]?\d+|\d+\s*hours?/gi) || [];
  keywords.push(...numbers.map(n => n.toLowerCase()));

  // Extract quoted terms
  const quoted = content.match(/"([^"]+)"/g) || [];
  keywords.push(...quoted.map(q => q.replace(/"/g, '')));

  // Extract key game terms
  const gameTerms = [
    'offline', 'functional', 'depleted', 'intact', 'operational',
    'thin atmosphere', 'altitude', 'volcanic', 'crater', 'sickness',
    'fuel', 'power', 'jump drive', 'maneuver', 'life support',
    'scramble', 'climb', 'descent', 'hazard'
  ];

  const lowerContent = content.toLowerCase();
  gameTerms.forEach(term => {
    if (lowerContent.includes(term)) {
      keywords.push(term);
    }
  });

  // Dedupe and return
  return [...new Set(keywords)];
}

/**
 * Determine priority based on field type and content
 * @param {string} field - Field name
 * @param {string} content - Content text
 * @returns {number} Priority 1-3
 */
function determinePriority(field, content) {
  const lowerContent = content.toLowerCase();

  // Priority 1: Mechanics (DMs, skill checks, requirements)
  if (field === 'altitude_sickness' || field === 'skill_checks' || field === 'repair_requirements') {
    return PRIORITY.mechanics;
  }
  if (lowerContent.includes('dm-') || lowerContent.includes('dm+') || lowerContent.includes('check')) {
    return PRIORITY.mechanics;
  }

  // Priority 2: Key facts (stages, conditions, hazards)
  if (field === 'stages' || field === 'ship_condition' || field === 'environmental_hazards') {
    return PRIORITY.key_facts;
  }

  // Priority 3: Flavor (prose fields)
  if (PROSE_FIELDS.includes(field)) {
    return PRIORITY.flavor;
  }

  return PRIORITY.key_facts; // Default
}

/**
 * Extract facts from stages array
 * @param {Array} stages - Stages array from scene
 * @param {string} sceneId - Scene identifier
 * @returns {Array} Array of facts
 */
function extractStages(stages, sceneId) {
  const facts = [];

  // Summary fact for all stages
  const altitudes = stages
    .filter(s => s.altitude && s.altitude.includes('-'))
    .map(s => s.altitude);

  if (altitudes.length > 0) {
    // Get min from first altitude range
    const minAlt = altitudes[0].split('-')[0];
    // Get max from last numeric altitude range (skip non-numeric like "Crater lip to floor")
    const numericAltitudes = altitudes.filter(a => /\d+m?$/.test(a.split('-')[1] || ''));
    const lastNumeric = numericAltitudes[numericAltitudes.length - 1];
    const maxAlt = lastNumeric ? lastNumeric.split('-')[1] : 'peak';

    facts.push({
      id: generateFactId(sceneId, 'stages', 0),
      source: `${sceneId}.json:stages`,
      priority: PRIORITY.key_facts,
      content: `Crater climb has ${stages.length} stages from ${minAlt} to ${maxAlt}`,
      keywords: extractKeywords(`${stages.length} stages ${minAlt} ${maxAlt} crater climb`),
      relevant_npcs: ['narrator-high-and-dry']
    });
  }

  // Individual stage facts
  stages.forEach((stage, i) => {
    const content = `${stage.name}: ${stage.altitude || 'variable'} - ${stage.description}`;
    facts.push({
      id: generateFactId(sceneId, 'stage', i + 1),
      source: `${sceneId}.json:stages[${i}]`,
      priority: PRIORITY.key_facts,
      content,
      keywords: extractKeywords(content),
      relevant_npcs: ['narrator-high-and-dry']
    });
  });

  return facts;
}

/**
 * Extract facts from altitude_sickness object
 * @param {Object} sickness - Altitude sickness data
 * @param {string} sceneId - Scene identifier
 * @returns {Array} Array of facts
 */
function extractAltitudeSickness(sickness, sceneId) {
  const facts = [];

  // DM penalties are priority 1 (mechanics)
  const dmEntries = Object.entries(sickness).filter(([k, v]) =>
    v.toString().includes('DM')
  );

  dmEntries.forEach(([severity, effect], i) => {
    facts.push({
      id: generateFactId(sceneId, 'alt_dm', i),
      source: `${sceneId}.json:altitude_sickness.${severity}`,
      priority: PRIORITY.mechanics,
      content: `Altitude sickness (${severity}): ${effect}`,
      keywords: extractKeywords(`altitude sickness ${severity} ${effect}`),
      relevant_npcs: ['narrator-high-and-dry']
    });
  });

  // Recovery methods
  const recoveryEntries = Object.entries(sickness).filter(([k]) =>
    k.includes('recovery') || k.includes('oxygen')
  );

  recoveryEntries.forEach(([method, effect], i) => {
    facts.push({
      id: generateFactId(sceneId, 'alt_rec', i),
      source: `${sceneId}.json:altitude_sickness.${method}`,
      priority: PRIORITY.mechanics,
      content: `Altitude sickness ${method.replace('_', ' ')}: ${effect}`,
      keywords: extractKeywords(`altitude recovery ${effect}`),
      relevant_npcs: ['narrator-high-and-dry']
    });
  });

  return facts;
}

/**
 * Extract facts from ship_condition object
 * @param {Object} condition - Ship condition data
 * @param {string} sceneId - Scene identifier
 * @returns {Array} Array of facts
 */
function extractShipCondition(condition, sceneId) {
  const facts = [];

  Object.entries(condition).forEach(([system, status], i) => {
    const priority = status.toLowerCase().includes('offline') ||
                     status.toLowerCase().includes('depleted')
      ? PRIORITY.mechanics
      : PRIORITY.key_facts;

    facts.push({
      id: generateFactId(sceneId, 'ship', i),
      source: `${sceneId}.json:ship_condition.${system}`,
      priority,
      content: `Ship ${system}: ${status}`,
      keywords: extractKeywords(`ship ${system} ${status}`),
      relevant_npcs: ['narrator-high-and-dry']
    });
  });

  return facts;
}

/**
 * Extract facts from repair_requirements object
 * @param {Object} requirements - Repair requirements data
 * @param {string} sceneId - Scene identifier
 * @returns {Array} Array of facts
 */
function extractRepairRequirements(requirements, sceneId) {
  const facts = [];

  Object.entries(requirements).forEach(([timeframe, requirement], i) => {
    facts.push({
      id: generateFactId(sceneId, 'repair', i),
      source: `${sceneId}.json:repair_requirements.${timeframe}`,
      priority: PRIORITY.mechanics,
      content: `Repair (${timeframe}): ${requirement}`,
      keywords: extractKeywords(`repair ${timeframe} ${requirement}`),
      relevant_npcs: ['narrator-high-and-dry']
    });
  });

  return facts;
}

/**
 * Extract facts from environmental_hazards array
 * @param {Array} hazards - Environmental hazards
 * @param {string} sceneId - Scene identifier
 * @returns {Array} Array of facts
 */
function extractEnvironmentalHazards(hazards, sceneId) {
  return hazards.map((hazard, i) => ({
    id: generateFactId(sceneId, 'hazard', i),
    source: `${sceneId}.json:environmental_hazards[${i}]`,
    priority: PRIORITY.key_facts,
    content: `Environmental hazard: ${hazard}`,
    keywords: extractKeywords(hazard),
    relevant_npcs: ['narrator-high-and-dry']
  }));
}

/**
 * Extract facts from skill_checks array
 * @param {Array} checks - Skill checks
 * @param {string} sceneId - Scene identifier
 * @returns {Array} Array of facts
 */
function extractSkillChecks(checks, sceneId) {
  return checks.map((check, i) => ({
    id: generateFactId(sceneId, 'skill', i),
    source: `${sceneId}.json:skill_checks[${i}]`,
    priority: PRIORITY.mechanics,
    content: `Skill check "${check.ref}": triggers when ${check.trigger}`,
    keywords: extractKeywords(`skill check ${check.ref} ${check.trigger}`),
    relevant_npcs: ['narrator-high-and-dry']
  }));
}

/**
 * Extract key facts from prose via LLM
 * @param {string} prose - Prose text
 * @param {string} field - Field name
 * @param {string} sceneId - Scene identifier
 * @param {Object} client - AI client
 * @returns {Promise<Array>} Array of facts
 */
async function extractProseViaLLM(prose, field, sceneId, client) {
  if (!prose || !client) return [];

  const prompt = `Extract key factual details from this ${field} text for a Traveller RPG adventure.

TEXT:
${prose}

Extract ONLY concrete facts (names, numbers, locations, object names, conditions).
Skip mood/atmosphere descriptions.

Output format (one fact per line):
FACT: [concrete detail]

Example output:
FACT: Ship registry is S00164-2
FACT: Ship is a Type S Scout/Courier
FACT: Ship is located in the crater`;

  try {
    const response = await quickChat(client, prompt);

    // Parse FACT: lines
    const factLines = response.match(/FACT:\s*(.+)/gi) || [];

    return factLines.map((line, i) => {
      const content = line.replace(/FACT:\s*/i, '').trim();
      return {
        id: generateFactId(sceneId, field.slice(0, 4), i),
        source: `${sceneId}.json:${field}`,
        priority: PRIORITY.flavor,
        content,
        keywords: extractKeywords(content),
        relevant_npcs: ['narrator-high-and-dry']
      };
    });
  } catch (error) {
    console.error(`LLM extraction failed for ${sceneId}:${field}:`, error.message);
    return [];
  }
}

/**
 * Extract all facts from a scene file
 * @param {string} scenePath - Path to scene JSON file
 * @param {Object} options - Options { client: AIClient, skipLLM: boolean }
 * @returns {Promise<Object>} { facts: Array, scene: string, errors: Array }
 */
async function extractFacts(scenePath, options = {}) {
  const { client = null, skipLLM = false } = options;
  const facts = [];
  const errors = [];

  // Load scene
  let scene;
  try {
    const content = fs.readFileSync(scenePath, 'utf8');
    scene = JSON.parse(content);
  } catch (e) {
    return { facts: [], scene: null, errors: [`Failed to load scene: ${e.message}`] };
  }

  const sceneId = scene.id || path.basename(scenePath, '.json');

  // Extract structured fields
  if (scene.stages) {
    facts.push(...extractStages(scene.stages, sceneId));
  }

  if (scene.altitude_sickness) {
    facts.push(...extractAltitudeSickness(scene.altitude_sickness, sceneId));
  }

  if (scene.ship_condition) {
    facts.push(...extractShipCondition(scene.ship_condition, sceneId));
  }

  if (scene.repair_requirements) {
    facts.push(...extractRepairRequirements(scene.repair_requirements, sceneId));
  }

  if (scene.environmental_hazards) {
    facts.push(...extractEnvironmentalHazards(scene.environmental_hazards, sceneId));
  }

  if (scene.skill_checks) {
    facts.push(...extractSkillChecks(scene.skill_checks, sceneId));
  }

  // Extract prose fields via LLM (if client provided and not skipped)
  if (!skipLLM && client) {
    for (const field of PROSE_FIELDS) {
      if (scene[field]) {
        const proseFacts = await extractProseViaLLM(scene[field], field, sceneId, client);
        facts.push(...proseFacts);
      }
    }
  }

  return { facts, scene: sceneId, errors };
}

/**
 * Extract facts from all scenes in an adventure
 * @param {string} adventureId - Adventure identifier
 * @param {Object} options - Options { client: AIClient, skipLLM: boolean }
 * @returns {Promise<Object>} { facts: Array, scenes: Array, errors: Array }
 */
async function extractAdventureFacts(adventureId, options = {}) {
  const scenesDir = path.join(SCENES_DIR, adventureId, 'scenes');
  const allFacts = [];
  const scenes = [];
  const errors = [];

  if (!fs.existsSync(scenesDir)) {
    return { facts: [], scenes: [], errors: [`Scenes directory not found: ${scenesDir}`] };
  }

  const sceneFiles = fs.readdirSync(scenesDir).filter(f => f.endsWith('.json'));

  for (const file of sceneFiles) {
    const scenePath = path.join(scenesDir, file);
    const result = await extractFacts(scenePath, options);

    allFacts.push(...result.facts);
    if (result.scene) scenes.push(result.scene);
    errors.push(...result.errors);
  }

  return { facts: allFacts, scenes, errors };
}

/**
 * Save extracted facts to output directory
 * @param {string} adventureId - Adventure identifier
 * @param {Array} facts - Facts to save
 * @returns {string} Output file path
 */
function saveFacts(adventureId, facts) {
  const outDir = path.join(OUTPUT_DIR, adventureId);

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'facts.json');
  fs.writeFileSync(outPath, JSON.stringify(facts, null, 2));

  return outPath;
}

/**
 * Load previously extracted facts
 * @param {string} adventureId - Adventure identifier
 * @returns {Array|null} Facts array or null if not found
 */
function loadFacts(adventureId) {
  const factsPath = path.join(OUTPUT_DIR, adventureId, 'facts.json');

  if (!fs.existsSync(factsPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(factsPath, 'utf8'));
  } catch (e) {
    return null;
  }
}

module.exports = {
  // Main extraction
  extractFacts,
  extractAdventureFacts,

  // Individual extractors (for testing)
  extractStages,
  extractAltitudeSickness,
  extractShipCondition,
  extractRepairRequirements,
  extractEnvironmentalHazards,
  extractSkillChecks,
  extractProseViaLLM,

  // Utilities
  generateFactId,
  extractKeywords,
  determinePriority,

  // Persistence
  saveFacts,
  loadFacts,

  // Constants
  PRIORITY,
  STRUCTURED_FIELDS,
  PROSE_FIELDS,
  SCENES_DIR,
  OUTPUT_DIR
};
