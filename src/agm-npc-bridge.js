/**
 * AGM-NPC Bridge
 * Provides context injection and speaker determination for NPCs
 */

const path = require('path');
const fs = require('fs');
const { buildNpcDirectives, computeGoalUrgency } = require('./agm-state');

// Cache for NPC data
const npcCache = new Map();

/**
 * Load NPC data
 */
function loadNpc(npcId) {
  if (npcCache.has(npcId)) {
    return npcCache.get(npcId);
  }

  const npcPath = path.join(__dirname, '../data/npcs', `${npcId}.json`);
  if (!fs.existsSync(npcPath)) return null;

  const data = JSON.parse(fs.readFileSync(npcPath, 'utf8'));
  npcCache.set(npcId, data);
  return data;
}

/**
 * Build AGM context for NPC prompt injection
 * @param {Object} agmState - AGM state
 * @param {string} npcId - NPC ID
 * @param {Object} storyState - Story state
 * @returns {string} Context string for prompt
 */
function buildAgmContext(agmState, npcId, storyState) {
  return buildNpcDirectives(agmState, npcId);
}

/**
 * Get NPC's current priorities based on goals and story state
 * @param {Object} agmState - AGM state
 * @param {Object} npc - NPC data
 * @param {Object} storyState - Story state
 * @returns {string[]} Priority strings
 */
function getNpcPriorities(agmState, npc, storyState) {
  const priorities = [];

  // Add primary agenda if exists
  if (npc.conversation_context?.primary_agenda) {
    priorities.push(npc.conversation_context.primary_agenda);
  }

  // Add secondary agenda if exists
  if (npc.conversation_context?.secondary_agenda) {
    priorities.push(npc.conversation_context.secondary_agenda);
  }

  // Add crisis-specific priorities
  if (storyState?.flags?.volcano_active) {
    if (npc.id === 'vargr-chauffeur') {
      priorities.unshift('URGENT: Get help rescuing your parents');
    }
  }

  return priorities;
}

/**
 * Determine if an NPC should speak in response to player action
 * @param {Object} agmState - AGM state
 * @param {string} npcId - NPC ID
 * @param {string} playerAction - Player's action text
 * @param {Object} scene - Scene data
 * @returns {boolean} Whether NPC should speak
 */
function shouldNpcSpeak(agmState, npcId, playerAction, scene) {
  // Check if NPC is present
  if (!scene.npcs_present?.includes(npcId)) {
    return false;
  }

  // Check if action is dialogue-oriented
  if (!isDialogueAction(playerAction)) {
    return false;
  }

  // Check if NPC is addressed
  const addressed = detectAddressedNpc(playerAction, scene.npcs_present);
  if (addressed === npcId) {
    return true;
  }

  // High-urgency NPCs may interject
  const npcState = agmState.npcs[npcId];
  if (npcState && npcState.urgency > 0.7 && !addressed) {
    return true;
  }

  return false;
}

/**
 * Determine who should respond to player action
 * @param {Object} agmState - AGM state
 * @param {string} playerAction - Player's action
 * @param {Object} scene - Scene data
 * @returns {Object} { speaker: 'narrator'|'npc', npcId?: string }
 */
function determineActiveSpeaker(agmState, playerAction, scene) {
  const npcsPresent = scene.npcs_present || [];

  // Check for explicitly addressed NPC
  const addressed = detectAddressedNpc(playerAction, npcsPresent);
  if (addressed) {
    return { speaker: 'npc', npcId: addressed };
  }

  // If dialogue action but no specific NPC, check for high-urgency NPC
  if (isDialogueAction(playerAction)) {
    let highestUrgency = 0;
    let urgentNpc = null;

    for (const npcId of npcsPresent) {
      const npcState = agmState.npcs[npcId];
      if (npcState && npcState.urgency > highestUrgency && npcState.urgency > 0.6) {
        highestUrgency = npcState.urgency;
        urgentNpc = npcId;
      }
    }

    if (urgentNpc) {
      return { speaker: 'npc', npcId: urgentNpc };
    }
  }

  // Default to narrator
  return { speaker: 'narrator' };
}

/**
 * Detect which NPC (if any) is being addressed
 * @param {string} playerAction - Player's action text
 * @param {string[]} npcsPresent - NPCs in scene
 * @returns {string|null} NPC ID or null
 */
function detectAddressedNpc(playerAction, npcsPresent) {
  const actionLower = playerAction.toLowerCase();

  for (const npcId of npcsPresent) {
    const npc = loadNpc(npcId);
    if (!npc) continue;

    // Check for name match
    const nameLower = npc.name.toLowerCase();
    if (actionLower.includes(nameLower)) {
      return npcId;
    }

    // Check for partial name match (last name, first name)
    const nameParts = nameLower.split(' ');
    for (const part of nameParts) {
      if (part.length > 2 && actionLower.includes(part)) {
        return npcId;
      }
    }

    // Check for title match
    if (npc.title) {
      const titleLower = npc.title.toLowerCase();
      // Check main role words
      const roleWords = ['officer', 'minister', 'bartender', 'chauffeur', 'driver'];
      for (const word of roleWords) {
        if (titleLower.includes(word) && actionLower.includes(word)) {
          return npcId;
        }
      }
    }
  }

  return null;
}

/**
 * Check if player action is dialogue-oriented
 * @param {string} playerAction - Player's action
 * @returns {boolean} Whether action involves speech
 */
function isDialogueAction(playerAction) {
  const actionLower = playerAction.toLowerCase();

  const dialogueVerbs = [
    'say', 'says', 'said',
    'ask', 'asks', 'asked',
    'tell', 'tells', 'told',
    'talk', 'talks', 'talked',
    'speak', 'speaks', 'spoke',
    'reply', 'replies', 'replied',
    'respond', 'responds', 'responded',
    'question', 'questions', 'questioned',
    'greet', 'greets', 'greeted',
    'whisper', 'whispers', 'whispered',
    'shout', 'shouts', 'shouted',
    'yell', 'yells', 'yelled',
    'inquire', 'inquires', 'inquired'
  ];

  // Check if starts with "I [verb]" pattern
  for (const verb of dialogueVerbs) {
    if (actionLower.includes(verb)) {
      return true;
    }
  }

  // Check for quoted speech
  if (actionLower.includes('"') || actionLower.includes("'")) {
    return true;
  }

  return false;
}

/**
 * Clear cache (for testing)
 */
function clearCache() {
  npcCache.clear();
}

module.exports = {
  buildAgmContext,
  getNpcPriorities,
  shouldNpcSpeak,
  determineActiveSpeaker,
  detectAddressedNpc,
  isDialogueAction,
  clearCache
};
