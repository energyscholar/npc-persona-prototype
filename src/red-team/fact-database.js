/**
 * Fact Database - Load and index facts from adventure sources
 *
 * Part of red team validation system for NPC fact-checking.
 */

const fs = require('fs');
const path = require('path');

// Lazy-loaded to avoid circular dependency
let learningIntegration = null;
function getLearningIntegration() {
  if (!learningIntegration) {
    learningIntegration = require('../knowledge-extraction/learning-integration');
  }
  return learningIntegration;
}

const FACTS_FILE = path.join(__dirname, '../../data/red-team/facts.json');
const SOURCES = {
  highAndDry: path.join(__dirname, '../../.claude/reference/high-and-dry-detailed.md'),
  wikiCache: path.join(__dirname, '../../data/wiki-cache')
};

/**
 * Fact categories
 */
const CATEGORIES = {
  SHIP_MISSION: 'ship_mission',
  WALSTON_WORLD: 'walston_world',
  CUSTOMS_STARPORT: 'customs_starport',
  SOCIAL_CULTURAL: 'social_cultural',
  PLOT_TIMELINE: 'plot_timeline'
};

/**
 * Load facts from JSON database
 * @returns {Object} Facts database { facts: [], byId: {}, byCategory: {} }
 */
function loadFacts() {
  if (!fs.existsSync(FACTS_FILE)) {
    return { facts: [], byId: {}, byCategory: {}, byNpc: {} };
  }

  try {
    const data = JSON.parse(fs.readFileSync(FACTS_FILE, 'utf8'));
    return indexFacts(data.facts || []);
  } catch (e) {
    console.error('Error loading facts:', e.message);
    return { facts: [], byId: {}, byCategory: {}, byNpc: {} };
  }
}

/**
 * Index facts for fast lookup
 * @param {Array} facts - Array of fact objects
 * @returns {Object} Indexed facts
 */
function indexFacts(facts) {
  const byId = {};
  const byCategory = {};
  const byNpc = {};

  for (const fact of facts) {
    byId[fact.id] = fact;

    // Index by category
    if (!byCategory[fact.category]) {
      byCategory[fact.category] = [];
    }
    byCategory[fact.category].push(fact);

    // Index by relevant NPCs
    for (const npcId of fact.relevant_npcs || []) {
      if (!byNpc[npcId]) {
        byNpc[npcId] = [];
      }
      byNpc[npcId].push(fact);
    }
  }

  return { facts, byId, byCategory, byNpc };
}

/**
 * Save facts to database
 * @param {Array} facts - Array of fact objects
 */
function saveFacts(facts) {
  const dir = path.dirname(FACTS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(FACTS_FILE, JSON.stringify({
    version: '1.0',
    generated: new Date().toISOString(),
    source: 'high-and-dry-detailed.md + wiki-cache',
    facts
  }, null, 2));
}

/**
 * Get facts relevant to a specific NPC
 * @param {string} npcId - NPC identifier
 * @returns {Array} Facts relevant to this NPC
 */
function getFactsForNpc(npcId) {
  const db = loadFacts();
  return db.byNpc[npcId] || [];
}

/**
 * Get facts by category
 * @param {string} category - Category name
 * @returns {Array} Facts in category
 */
function getFactsByCategory(category) {
  const db = loadFacts();
  return db.byCategory[category] || [];
}

/**
 * Get a specific fact by ID (checks both manual and extracted facts)
 * @param {string} factId - Fact identifier
 * @returns {Object|null} Fact or null
 */
function getFact(factId) {
  // Check manual facts first
  const db = loadFacts();
  const manualFact = db.byId[factId];
  if (manualFact) return manualFact;

  // Check extracted facts if ID starts with EXT_
  if (factId && factId.startsWith('EXT_')) {
    const integration = getLearningIntegration();
    return integration.getExtractedFact(factId);
  }

  return null;
}

/**
 * Get a manual fact only (bypasses extracted fact lookup)
 * @param {string} factId - Fact identifier
 * @returns {Object|null} Fact or null
 */
function getManualFact(factId) {
  const db = loadFacts();
  return db.byId[factId] || null;
}

/**
 * Extract facts from high-and-dry-detailed.md
 * @returns {Array} Extracted facts
 */
function extractFactsFromSource() {
  const facts = [];

  // Ship & Mission Facts
  facts.push(
    { id: 'FACT_001', category: CATEGORIES.SHIP_MISSION, content: 'Highndry ownership belongs to IISS (Scout Service), not PC', relevant_npcs: ['narrator-high-and-dry', 'mr-casarii', 'alex-ryder'], keywords: ['IISS', 'Scout Service', 'lease', 'detached duty'], failure_keywords: ['inherit', 'inherited', 'owns', 'your ship'] },
    { id: 'FACT_002', category: CATEGORIES.SHIP_MISSION, content: 'PC receives one-year LEASE under detached duty terms', relevant_npcs: ['mr-casarii', 'narrator-high-and-dry'], keywords: ['lease', 'one-year', 'detached duty', 'renewable'], failure_keywords: ['permanent', 'forever', 'ownership'] },
    { id: 'FACT_003', category: CATEGORIES.SHIP_MISSION, content: 'Previous crew\'s agreement voided due to fraud', relevant_npcs: ['mr-casarii'], keywords: ['voided', 'fraud', 'previous crew'], failure_keywords: [] },
    { id: 'FACT_004', category: CATEGORIES.SHIP_MISSION, content: 'Detached duty = lease with obligations, renewable, ship returned when agreement ends', relevant_npcs: ['mr-casarii', 'narrator-high-and-dry'], keywords: ['lease', 'obligations', 'renewable', 'returned'], failure_keywords: ['keep forever'] },
    { id: 'FACT_005', category: CATEGORIES.SHIP_MISSION, content: 'Scout Service provides Cr1000/traveller upfront for expenses', relevant_npcs: ['mr-casarii'], keywords: ['Cr1000', '1000', 'expenses', 'upfront'], failure_keywords: [] },
    { id: 'FACT_006', category: CATEGORIES.SHIP_MISSION, content: 'Completion reward = one-year lease + Cr1000 during checkout week', relevant_npcs: ['mr-casarii'], keywords: ['one-year lease', 'Cr1000', 'checkout'], failure_keywords: [] }
  );

  // Walston World Facts
  facts.push(
    { id: 'FACT_010', category: CATEGORIES.WALSTON_WORLD, content: 'Walston UWP = C544338-8', relevant_npcs: ['narrator-high-and-dry'], keywords: ['C544338-8', 'UWP'], failure_keywords: [] },
    { id: 'FACT_011', category: CATEGORIES.WALSTON_WORLD, content: 'Law Level 8 = High Law (controlled blades, weapons prohibited outside home)', relevant_npcs: ['narrator-high-and-dry', 'customs-officer-walston'], keywords: ['Law 8', 'Law Level 8', 'weapons prohibited', 'controlled'], failure_keywords: ['relaxed', 'permissive', 'allowed'] },
    { id: 'FACT_012', category: CATEGORIES.WALSTON_WORLD, content: 'Tech Level 8 = Pre-Stellar (NOT high-tech detection)', relevant_npcs: ['narrator-high-and-dry'], keywords: ['Tech 8', 'TL8', 'Pre-Stellar'], failure_keywords: ['high-tech', 'advanced scanning'] },
    { id: 'FACT_013', category: CATEGORIES.WALSTON_WORLD, content: 'Population ~3000, 70% Vargr', relevant_npcs: ['narrator-high-and-dry', 'startown-bartender'], keywords: ['3000', '70%', 'Vargr', 'majority'], failure_keywords: [] },
    { id: 'FACT_014', category: CATEGORIES.WALSTON_WORLD, content: 'Government = Self-Perpetuating Oligarchy (Dictator Masterton)', relevant_npcs: ['narrator-high-and-dry', 'minister-greener'], keywords: ['Masterton', 'Dictator', 'oligarchy'], failure_keywords: ['democracy', 'elected'] },
    { id: 'FACT_015', category: CATEGORIES.WALSTON_WORLD, content: 'Thin tainted atmosphere', relevant_npcs: ['narrator-high-and-dry'], keywords: ['thin', 'tainted', 'atmosphere'], failure_keywords: ['breathable', 'normal'] },
    { id: 'FACT_016', category: CATEGORIES.WALSTON_WORLD, content: 'Scout base present', relevant_npcs: ['narrator-high-and-dry'], keywords: ['scout base'], failure_keywords: [] }
  );

  // Customs & Starport Facts
  facts.push(
    { id: 'FACT_020', category: CATEGORIES.CUSTOMS_STARPORT, content: 'All weapons must be declared at customs', relevant_npcs: ['narrator-high-and-dry', 'customs-officer-walston'], keywords: ['declare', 'weapons', 'customs'], failure_keywords: ['sneak', 'hide'] },
    { id: 'FACT_021', category: CATEGORIES.CUSTOMS_STARPORT, content: 'Weapons stored at starport safebox', relevant_npcs: ['customs-officer-walston', 'narrator-high-and-dry'], keywords: ['safebox', 'stored', 'starport'], failure_keywords: ['confiscate', 'illegal'] },
    { id: 'FACT_022', category: CATEGORIES.CUSTOMS_STARPORT, content: 'Storage fee = Cr10 per week', relevant_npcs: ['customs-officer-walston'], keywords: ['Cr10', '10 credits', 'per week'], failure_keywords: [] },
    { id: 'FACT_023', category: CATEGORIES.CUSTOMS_STARPORT, content: 'Receipt provided, collect weapons on departure', relevant_npcs: ['customs-officer-walston'], keywords: ['receipt', 'collect', 'departure'], failure_keywords: [] },
    { id: 'FACT_024', category: CATEGORIES.CUSTOMS_STARPORT, content: 'Cargo inspection is cursory unless suspicious', relevant_npcs: ['customs-officer-walston'], keywords: ['cursory', 'inspection'], failure_keywords: ['thorough', 'detailed scan'] }
  );

  // Social/Cultural Facts
  facts.push(
    { id: 'FACT_030', category: CATEGORIES.SOCIAL_CULTURAL, content: 'Vargr face "glass ceiling" - accepted but limited advancement', relevant_npcs: ['startown-bartender', 'narrator-high-and-dry'], keywords: ['glass ceiling', 'accepted', 'limited'], failure_keywords: ['oppressed', 'enslaved', 'equal'] },
    { id: 'FACT_031', category: CATEGORIES.SOCIAL_CULTURAL, content: 'Traditional dress includes kilts', relevant_npcs: ['startown-bartender', 'narrator-high-and-dry'], keywords: ['kilts', 'traditional'], failure_keywords: [] },
    { id: 'FACT_032', category: CATEGORIES.SOCIAL_CULTURAL, content: 'Previous crew mocked local customs (kilts, food)', relevant_npcs: ['minister-greener', 'startown-bartender'], keywords: ['mocked', 'disrespected', 'rude'], failure_keywords: ['polite', 'respectful'] },
    { id: 'FACT_033', category: CATEGORIES.SOCIAL_CULTURAL, content: 'Locals remember offworlders who disrespect customs', relevant_npcs: ['startown-bartender'], keywords: ['remember', 'disrespect'], failure_keywords: [] }
  );

  // Plot Timeline Facts
  facts.push(
    { id: 'FACT_040', category: CATEGORIES.PLOT_TIMELINE, content: 'Geologist visit ~1 year ago (said 99% safe)', relevant_npcs: ['minister-greener'], keywords: ['year ago', 'geologist', '99%'], failure_keywords: [] },
    { id: 'FACT_041', category: CATEGORIES.PLOT_TIMELINE, content: 'Ship stranded ~3-4 months ago', relevant_npcs: ['minister-greener', 'narrator-high-and-dry'], keywords: ['3-4 months', 'stranded', 'months ago'], failure_keywords: [] },
    { id: 'FACT_042', category: CATEGORIES.PLOT_TIMELINE, content: 'Previous crew departed ~2-3 months ago via Maverick Spacer', relevant_npcs: ['minister-greener'], keywords: ['Maverick Spacer', 'departed', 'months ago'], failure_keywords: [] },
    { id: 'FACT_043', category: CATEGORIES.PLOT_TIMELINE, content: 'Travel time Flammarion→Walston = ~2 weeks (two jumps)', relevant_npcs: ['captain-corelli', 'narrator-high-and-dry'], keywords: ['two weeks', '2 weeks', 'two jumps'], failure_keywords: [] }
  );

  // Greener payment facts
  facts.push(
    { id: 'FACT_050', category: CATEGORIES.SHIP_MISSION, content: 'Greener offers Cr3000 flat fee for survey', relevant_npcs: ['minister-greener'], keywords: ['Cr3000', '3000'], failure_keywords: [] },
    { id: 'FACT_051', category: CATEGORIES.SHIP_MISSION, content: 'Survey takes 2-3 days with proper equipment', relevant_npcs: ['minister-greener'], keywords: ['2-3 days', 'survey'], failure_keywords: [] },
    { id: 'FACT_052', category: CATEGORIES.SHIP_MISSION, content: 'Mount Salbarii is the volcano to survey', relevant_npcs: ['minister-greener', 'narrator-high-and-dry'], keywords: ['Mount Salbarii', 'Salbarii', 'volcano'], failure_keywords: [] },
    { id: 'FACT_053', category: CATEGORIES.SHIP_MISSION, content: 'Ship is ~120km from capital in mountains', relevant_npcs: ['minister-greener'], keywords: ['120', 'kilometers', 'mountains'], failure_keywords: [] }
  );

  return facts;
}

/**
 * Initialize the fact database from source materials
 */
function initializeFactDatabase() {
  const facts = extractFactsFromSource();
  saveFacts(facts);
  console.log(`Initialized fact database with ${facts.length} facts`);
  return facts;
}

module.exports = {
  CATEGORIES,
  loadFacts,
  saveFacts,
  getFactsForNpc,
  getFactsByCategory,
  getFact,
  getManualFact,
  extractFactsFromSource,
  initializeFactDatabase,
  FACTS_FILE
};
