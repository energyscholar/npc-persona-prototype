/**
 * World State Module
 * Tracks shared facts and cross-NPC awareness.
 *
 * Pattern: Repository (load/save) for world state
 */

const fs = require('fs');
const path = require('path');

const WORLD_FACTS_FILE = path.join(__dirname, '../data/state/world-facts.json');

/**
 * Load world facts from file
 * @returns {Object} { sharedFacts: [], npcMentions: {}, factionKnowledge: {} }
 */
function loadWorldFacts() {
  try {
    if (fs.existsSync(WORLD_FACTS_FILE)) {
      const data = fs.readFileSync(WORLD_FACTS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (!parsed.sharedFacts) parsed.sharedFacts = [];
      if (!parsed.npcMentions) parsed.npcMentions = {};
      if (!parsed.factionKnowledge) parsed.factionKnowledge = {};
      return parsed;
    }
  } catch (e) {
    // Return empty state on error
  }
  return { sharedFacts: [], npcMentions: {}, factionKnowledge: {} };
}

/**
 * Save world facts to file
 * @param {Object} state - World facts state
 */
function saveWorldFacts(state) {
  const dir = path.dirname(WORLD_FACTS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(WORLD_FACTS_FILE, JSON.stringify(state, null, 2));
}

/**
 * Add or update a shared fact
 * @param {string} factId - Unique fact identifier
 * @param {string} content - Fact content
 * @param {string[]} [knownBy=['all']] - Array of NPC IDs or 'all'
 */
function addSharedFact(factId, content, knownBy = ['all']) {
  const state = loadWorldFacts();

  // Find existing fact with same ID
  const existingIndex = state.sharedFacts.findIndex(f => f.id === factId);

  const fact = {
    id: factId,
    content,
    knownBy,
    timestamp: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    state.sharedFacts[existingIndex] = fact;
  } else {
    state.sharedFacts.push(fact);
  }

  saveWorldFacts(state);
}

/**
 * Get shared facts accessible to an NPC
 * @param {string} npcId - NPC ID
 * @param {string} adventureId - Adventure ID (for future filtering)
 * @returns {Object[]} Array of accessible facts
 */
function getSharedFacts(npcId, adventureId) {
  const state = loadWorldFacts();

  return state.sharedFacts.filter(fact => {
    // 'all' means everyone can see it
    if (fact.knownBy.includes('all')) return true;
    // Check if this NPC is specifically included
    if (fact.knownBy.includes(npcId)) return true;
    return false;
  });
}

/**
 * Record an NPC mentioning another NPC to a PC
 * @param {string} fromNpcId - NPC who mentioned
 * @param {string} aboutNpcId - NPC being mentioned
 * @param {string} pcId - PC who heard
 * @param {string} content - What was said
 */
function recordNpcMention(fromNpcId, aboutNpcId, pcId, content) {
  const state = loadWorldFacts();

  if (!state.npcMentions[aboutNpcId]) {
    state.npcMentions[aboutNpcId] = {};
  }
  if (!state.npcMentions[aboutNpcId][pcId]) {
    state.npcMentions[aboutNpcId][pcId] = [];
  }

  state.npcMentions[aboutNpcId][pcId].push({
    from: fromNpcId,
    content,
    timestamp: new Date().toISOString()
  });

  saveWorldFacts(state);
}

/**
 * Get mentions about an NPC told to a PC
 * @param {string} npcId - NPC being asked about
 * @param {string} pcId - PC who might have heard
 * @returns {Object[]} Array of mentions
 */
function getMentionsAbout(npcId, pcId) {
  const state = loadWorldFacts();

  if (!state.npcMentions[npcId]) return [];
  if (!state.npcMentions[npcId][pcId]) return [];

  return state.npcMentions[npcId][pcId];
}

/**
 * Check if a new fact contradicts existing facts
 * @param {Object} newFact - { id, content }
 * @param {Object[]} existingFacts - Array of existing facts
 * @returns {Object} { hasConflict, conflicts }
 */
function checkContradiction(newFact, existingFacts) {
  const conflicts = [];

  for (const existing of existingFacts) {
    if (existing.id === newFact.id && existing.content !== newFact.content) {
      conflicts.push(existing);
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts
  };
}

/**
 * Get factions for an NPC from config
 * @param {Object} npcConfig - NPC persona config
 * @returns {string[]} Array of faction names
 */
function getFactionsForNpc(npcConfig) {
  return npcConfig.factions || [];
}

/**
 * Filter facts by faction access
 * @param {Object[]} facts - Array of facts
 * @param {string[]} factions - NPC's factions
 * @returns {Object[]} Filtered facts
 */
function filterByFaction(facts, factions) {
  return facts.filter(fact => {
    // 'all' is always accessible
    if (fact.knownBy.includes('all')) return true;

    // Check faction matches
    for (const known of fact.knownBy) {
      if (known.startsWith('faction:')) {
        const faction = known.slice(8);
        if (factions.includes(faction)) return true;
      }
    }

    return false;
  });
}

module.exports = {
  WORLD_FACTS_FILE,
  loadWorldFacts,
  saveWorldFacts,
  addSharedFact,
  getSharedFacts,
  recordNpcMention,
  getMentionsAbout,
  checkContradiction,
  getFactionsForNpc,
  filterByFaction
};
