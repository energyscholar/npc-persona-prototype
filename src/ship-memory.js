/**
 * Ship-Wide Memory System
 *
 * Shared memory across all PCs for NPC knowledge.
 * Facts learned by any PC are known to the NPC when talking to other PCs.
 */

const fs = require('fs');
const path = require('path');

const SHIP_MEMORY_FILE = path.join(__dirname, '../data/ship-memory.json');

/**
 * Default ship memory structure
 */
function createDefaultShipMemory() {
  return {
    npcs: {},      // Per-NPC facts and interaction counts
    shipEvents: [], // Ship-wide events all NPCs know about
    lastUpdated: null
  };
}

/**
 * Load ship memory from file
 * @returns {Object} Ship memory object
 */
function loadShipMemory() {
  if (!fs.existsSync(SHIP_MEMORY_FILE)) {
    return createDefaultShipMemory();
  }
  const content = fs.readFileSync(SHIP_MEMORY_FILE, 'utf8');
  return JSON.parse(content);
}

/**
 * Save ship memory to file
 * @param {Object} memory - Ship memory object
 */
function saveShipMemory(memory) {
  memory.lastUpdated = new Date().toISOString();
  const dir = path.dirname(SHIP_MEMORY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SHIP_MEMORY_FILE, JSON.stringify(memory, null, 2));
}

/**
 * Get NPC memory (facts, interactions)
 * @param {string} npcId - NPC identifier
 * @returns {Object} NPC's shared memory
 */
function getNPCMemory(npcId) {
  const memory = loadShipMemory();
  if (!memory.npcs[npcId]) {
    memory.npcs[npcId] = {
      facts: [],
      totalInteractions: 0,
      lastInteraction: null,
      interactionsByPC: {}
    };
  }
  return memory.npcs[npcId];
}

/**
 * Update NPC memory after interaction
 * @param {string} npcId - NPC identifier
 * @param {string} pcId - PC who interacted
 * @param {Object} updates - { facts?: [], increment?: boolean }
 */
function updateNPCMemory(npcId, pcId, updates = {}) {
  const memory = loadShipMemory();

  if (!memory.npcs[npcId]) {
    memory.npcs[npcId] = {
      facts: [],
      totalInteractions: 0,
      lastInteraction: null,
      interactionsByPC: {}
    };
  }

  const npcMem = memory.npcs[npcId];

  // Add new facts (deduplicated by type)
  if (updates.facts && updates.facts.length > 0) {
    for (const newFact of updates.facts) {
      const existingIdx = npcMem.facts.findIndex(f => f.type === newFact.type);
      if (existingIdx >= 0) {
        npcMem.facts[existingIdx] = { ...npcMem.facts[existingIdx], ...newFact };
      } else {
        npcMem.facts.push(newFact);
      }
    }
  }

  // Increment interaction count
  if (updates.increment !== false) {
    npcMem.totalInteractions++;
    npcMem.lastInteraction = new Date().toISOString();

    if (!npcMem.interactionsByPC[pcId]) {
      npcMem.interactionsByPC[pcId] = 0;
    }
    npcMem.interactionsByPC[pcId]++;
  }

  saveShipMemory(memory);
  return npcMem;
}

/**
 * Add a fact about a PC (learned by NPC)
 * @param {string} npcId - NPC who learned the fact
 * @param {string} factType - Fact type (e.g., 'pc_name', 'pc_preference')
 * @param {string} factValue - Fact value
 * @param {string} learnedFrom - PC ID who told them
 */
function addFact(npcId, factType, factValue, learnedFrom) {
  updateNPCMemory(npcId, learnedFrom, {
    facts: [{
      type: factType,
      value: factValue,
      learnedFrom,
      learnedDate: new Date().toISOString()
    }],
    increment: false
  });
}

/**
 * Get a specific fact
 * @param {string} npcId - NPC identifier
 * @param {string} factType - Fact type to find
 * @returns {Object|null} Fact or null
 */
function getFact(npcId, factType) {
  const npcMem = getNPCMemory(npcId);
  return npcMem.facts.find(f => f.type === factType) || null;
}

/**
 * Add a ship-wide event
 * @param {string} event - Event description
 * @param {string} gameDate - Traveller date
 */
function addShipEvent(event, gameDate) {
  const memory = loadShipMemory();
  memory.shipEvents.push({
    event,
    gameDate,
    timestamp: new Date().toISOString()
  });

  // Keep only last 20 events
  if (memory.shipEvents.length > 20) {
    memory.shipEvents = memory.shipEvents.slice(-20);
  }

  saveShipMemory(memory);
}

/**
 * Get recent ship events
 * @param {number} limit - Max events to return
 * @returns {Object[]} Recent events
 */
function getShipEvents(limit = 10) {
  const memory = loadShipMemory();
  return memory.shipEvents.slice(-limit);
}

/**
 * Format NPC memory for prompt injection
 * @param {string} npcId - NPC identifier
 * @returns {string} Formatted memory text
 */
function formatNPCMemoryForPrompt(npcId) {
  const npcMem = getNPCMemory(npcId);
  const events = getShipEvents(5);

  let text = '';

  // Facts about people
  if (npcMem.facts.length > 0) {
    text += 'THINGS YOU KNOW:\n';
    for (const fact of npcMem.facts) {
      text += `- ${fact.type}: ${fact.value}`;
      if (fact.learnedFrom) {
        text += ` (learned from ${fact.learnedFrom})`;
      }
      text += '\n';
    }
    text += '\n';
  }

  // Interaction history
  if (npcMem.totalInteractions > 0) {
    text += `INTERACTION HISTORY:\n`;
    text += `- Total conversations: ${npcMem.totalInteractions}\n`;
    for (const [pcId, count] of Object.entries(npcMem.interactionsByPC)) {
      text += `- Talked with ${pcId}: ${count} times\n`;
    }
    text += '\n';
  }

  // Recent ship events
  if (events.length > 0) {
    text += 'RECENT SHIP EVENTS:\n';
    for (const evt of events) {
      text += `- ${evt.gameDate}: ${evt.event}\n`;
    }
  }

  return text;
}

module.exports = {
  loadShipMemory,
  saveShipMemory,
  getNPCMemory,
  updateNPCMemory,
  addFact,
  getFact,
  addShipEvent,
  getShipEvents,
  formatNPCMemoryForPrompt
};
