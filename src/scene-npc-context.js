/**
 * Scene NPC context module
 * Builds NPC voice context based on scene data
 */

const path = require('path');
const fs = require('fs');
const { getVoiceProfile } = require('./voice-profiles');

// Cache for loaded scene data
const sceneCache = new Map();

/**
 * Load scene data
 */
function loadScene(adventureId, sceneId) {
  const cacheKey = `${adventureId}:${sceneId}`;
  if (sceneCache.has(cacheKey)) {
    return sceneCache.get(cacheKey);
  }

  const scenePath = path.join(
    __dirname,
    '../data/adventures',
    adventureId,
    'scenes',
    `${sceneId}.json`
  );

  if (!fs.existsSync(scenePath)) {
    return null;
  }

  const data = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
  sceneCache.set(cacheKey, data);
  return data;
}

/**
 * Load NPC data
 */
function loadNpc(npcId) {
  const npcPath = path.join(__dirname, '../data/npcs', `${npcId}.json`);
  if (!fs.existsSync(npcPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(npcPath, 'utf8'));
}

/**
 * Get list of NPCs present in a scene
 * @param {string} adventureId - Adventure ID
 * @param {string} sceneId - Scene ID
 * @returns {string[]} Array of NPC IDs
 */
function getNpcsForScene(adventureId, sceneId) {
  const scene = loadScene(adventureId, sceneId);
  if (!scene || !scene.npcs_present) {
    return [];
  }
  return scene.npcs_present;
}

/**
 * Build NPC voice context for narrator prompt
 * @param {string[]} npcIds - Array of NPC IDs
 * @returns {string} Formatted context string
 */
function buildNpcVoiceContext(npcIds) {
  if (!npcIds || npcIds.length === 0) {
    return '';
  }

  const profiles = [];
  for (const npcId of npcIds) {
    const npc = loadNpc(npcId);
    if (npc && npc.voice) {
      profiles.push({
        id: npcId,
        name: npc.name,
        voice: npc.voice
      });
    }
  }

  if (profiles.length === 0) {
    return '';
  }

  let context = '=== VOICE MIXING ===\n';
  context += 'You narrate scenes AND voice NPCs present. Use this format:\n\n';
  context += 'For scene description: Write as narrator (no label needed)\n';
  context += 'For NPC dialogue: Use **NPC Name:** "Dialogue here."\n\n';
  context += `NPCs present in this scene: [${npcIds.join(', ')}]\n\n`;

  for (const profile of profiles) {
    context += `${profile.name} (${profile.id}):\n`;
    context += `- Voice: ${profile.voice.style}, ${profile.voice.tone}\n`;
    if (profile.voice.sample_lines && profile.voice.sample_lines.length > 0) {
      context += `- Samples: "${profile.voice.sample_lines.join('", "')}"\n`;
    }
    if (profile.voice.body_language_cues && profile.voice.body_language_cues.length > 0) {
      context += `- Body language: ${profile.voice.body_language_cues.join(', ')}\n`;
    }
    context += '\n';
  }

  context += 'When an NPC speaks, stay in their voice until returning to narration.\n';

  return context;
}

/**
 * Get initial NPC lines for scene entry
 * @param {string} adventureId - Adventure ID
 * @param {string} sceneId - Scene ID
 * @returns {Object} Map of npcId to initial line
 */
function getInitialNpcLines(adventureId, sceneId) {
  const scene = loadScene(adventureId, sceneId);
  if (!scene || !scene.npc_injection_rules) {
    return {};
  }

  const lines = {};
  for (const [npcId, rules] of Object.entries(scene.npc_injection_rules)) {
    if (rules.initial_line) {
      lines[npcId] = rules.initial_line;
    }
  }
  return lines;
}

/**
 * Clear cache (for testing)
 */
function clearCache() {
  sceneCache.clear();
}

module.exports = {
  getNpcsForScene,
  buildNpcVoiceContext,
  getInitialNpcLines,
  clearCache
};
