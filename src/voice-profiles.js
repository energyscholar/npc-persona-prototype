/**
 * Voice profiles module
 * Loads and formats NPC voice data for narrator voice mixing
 */

const path = require('path');
const fs = require('fs');

// Cache for loaded NPC data
const npcCache = new Map();

/**
 * Load NPC data by ID
 */
function loadNpc(npcId) {
  if (npcCache.has(npcId)) {
    return npcCache.get(npcId);
  }

  const npcPath = path.join(__dirname, '../data/npcs', `${npcId}.json`);
  if (!fs.existsSync(npcPath)) {
    return null;
  }

  const data = JSON.parse(fs.readFileSync(npcPath, 'utf8'));
  npcCache.set(npcId, data);
  return data;
}

/**
 * Get voice profile for an NPC
 * @param {string} npcId - NPC ID
 * @returns {Object|null} Voice profile object
 */
function getVoiceProfile(npcId) {
  const npc = loadNpc(npcId);
  if (!npc || !npc.voice) {
    return null;
  }

  return {
    npcId,
    name: npc.name,
    style: npc.voice.style,
    tone: npc.voice.tone,
    speech_patterns: npc.voice.speech_patterns || [],
    verbal_tics: npc.voice.verbal_tics || [],
    sample_lines: npc.voice.sample_lines || [],
    body_language_cues: npc.voice.body_language_cues || []
  };
}

/**
 * Format NPC dialogue with markdown bold name
 * @param {string} npcId - NPC ID
 * @param {string} dialogue - The dialogue text
 * @returns {string} Formatted dialogue
 */
function formatNpcDialogue(npcId, dialogue) {
  const npc = loadNpc(npcId);
  if (!npc) {
    return `**Unknown:** "${dialogue}"`;
  }

  // Use display name or derive from name field
  const displayName = npc.title
    ? npc.title.split(',')[0]  // Take first part of title
    : npc.name;

  return `**${displayName}:** "${dialogue}"`;
}

/**
 * Build voice context prompt section for narrator
 * @param {string[]} npcIds - Array of NPC IDs
 * @returns {string} Formatted context for narrator prompt
 */
function buildVoiceContext(npcIds) {
  if (!npcIds || npcIds.length === 0) {
    return '';
  }

  const profiles = npcIds
    .map(id => getVoiceProfile(id))
    .filter(Boolean);

  if (profiles.length === 0) {
    return '';
  }

  let context = '=== NPC VOICE PROFILES ===\n';
  context += 'Format NPC dialogue as: **NPC Name:** "Dialogue here."\n\n';

  for (const profile of profiles) {
    context += `${profile.name}:\n`;
    context += `- Style: ${profile.style}\n`;
    context += `- Tone: ${profile.tone}\n`;
    if (profile.speech_patterns.length > 0) {
      context += `- Speech: ${profile.speech_patterns.join(', ')}\n`;
    }
    if (profile.sample_lines.length > 0) {
      context += `- Samples: "${profile.sample_lines.join('", "')}"\n`;
    }
    context += '\n';
  }

  return context;
}

/**
 * Clear cache (for testing)
 */
function clearCache() {
  npcCache.clear();
}

module.exports = {
  getVoiceProfile,
  formatNpcDialogue,
  buildVoiceContext,
  clearCache
};
