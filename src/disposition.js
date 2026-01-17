/**
 * Disposition Tracking Module
 * Tracks NPC-to-PC relationship levels with persistence.
 *
 * Pattern: Repository (load/save) + Null Object (always return valid data)
 */

const fs = require('fs');
const path = require('path');

const DISPOSITION_FILE = path.join(__dirname, '../data/state/dispositions.json');

const DISPOSITION_LABELS = {
  '-3': 'hostile',
  '-2': 'unfriendly',
  '-1': 'wary',
  '0': 'neutral',
  '1': 'favorable',
  '2': 'friendly',
  '3': 'allied'
};

const DISPOSITION_PROMPTS = {
  '-3': 'You are HOSTILE toward this person. Be cold, obstructive, may refuse to help at all.',
  '-2': 'You are UNFRIENDLY. Be curt, unhelpful, charge maximum prices, give minimal information.',
  '-1': 'You are WARY. Be cautious, reserved. Don\'t volunteer information.',
  '0': 'You are NEUTRAL. Professional but not warm.',
  '1': 'You are FAVORABLE. Be helpful, maybe offer a small discount or extra info.',
  '2': 'You are FRIENDLY. Be warm, genuinely helpful, go out of your way to assist.',
  '3': 'You are ALLIED. Treat as trusted friend. Share secrets, take risks to help.'
};

/**
 * Load dispositions from file
 * @returns {Object} Dispositions state
 */
function loadDispositions() {
  try {
    if (fs.existsSync(DISPOSITION_FILE)) {
      const data = fs.readFileSync(DISPOSITION_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    // Return empty state on error
  }
  return { relationships: {} };
}

/**
 * Save dispositions to file
 * @param {Object} state - Dispositions state
 */
function saveDispositions(state) {
  const dir = path.dirname(DISPOSITION_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DISPOSITION_FILE, JSON.stringify(state, null, 2));
}

/**
 * Get disposition for NPC-PC pair (Null Object pattern - never returns null)
 * @param {string} npcId
 * @param {string} pcId
 * @returns {Object} { level, label, history, impressions }
 */
function getDisposition(npcId, pcId) {
  if (!npcId || !pcId) {
    return { level: 0, label: 'neutral', history: [], impressions: [] };
  }

  const state = loadDispositions();

  // Support both nested and flat key formats
  let rel = null;
  if (state.relationships) {
    // Try nested format first: relationships[npcId][pcId]
    if (state.relationships[npcId] && state.relationships[npcId][pcId]) {
      rel = state.relationships[npcId][pcId];
    }
    // Try flat key format: relationships['npcId:pcId']
    else if (state.relationships[`${npcId}:${pcId}`]) {
      rel = state.relationships[`${npcId}:${pcId}`];
    }
  }

  if (rel) {
    return {
      level: rel.level || 0,
      label: DISPOSITION_LABELS[String(rel.level || 0)] || 'neutral',
      history: rel.history || [],
      impressions: rel.impressions || []
    };
  }

  // Null Object: return default
  return {
    level: 0,
    label: 'neutral',
    history: [],
    impressions: []
  };
}

/**
 * Modify disposition level
 * @param {string} npcId
 * @param {string} pcId
 * @param {number} change - Amount to change (-3 to +3 typically)
 * @param {string} reason - Why the change occurred
 * @param {string} gameDate - In-game date
 * @returns {number} New level
 */
function modifyDisposition(npcId, pcId, change, reason, gameDate) {
  const state = loadDispositions();

  if (!state.relationships) {
    state.relationships = {};
  }

  // Use flat key format for consistency
  const key = `${npcId}:${pcId}`;

  if (!state.relationships[key]) {
    state.relationships[key] = {
      level: 0,
      history: [],
      impressions: []
    };
  }

  const rel = state.relationships[key];
  const oldLevel = rel.level || 0;
  const newLevel = Math.max(-3, Math.min(3, oldLevel + change));

  rel.level = newLevel;
  rel.label = DISPOSITION_LABELS[String(newLevel)];
  rel.history.push({
    date: gameDate,
    change,
    reason,
    from: oldLevel,
    to: newLevel
  });

  saveDispositions(state);
  return newLevel;
}

/**
 * Get prompt modifier text for disposition level
 * @param {number} level
 * @returns {string} Prompt text
 */
function getDispositionPromptModifier(level) {
  const clampedLevel = Math.max(-3, Math.min(3, level));
  return DISPOSITION_PROMPTS[String(clampedLevel)] || DISPOSITION_PROMPTS['0'];
}

/**
 * Get initial disposition for NPC-PC pair from NPC config
 * @param {Object} npcConfig - NPC persona config
 * @param {string} pcId
 * @returns {number} Initial disposition level
 */
function getInitialDisposition(npcConfig, pcId) {
  let initial = 0;

  if (npcConfig.disposition?.initial !== undefined) {
    initial = npcConfig.disposition.initial;
  }

  // Apply species penalty if defined
  if (npcConfig.disposition?.caps?.species_penalty) {
    // This would need PC species info - simplified for now
    // Actual implementation would check PC species against penalty map
  }

  return Math.max(-3, Math.min(3, initial));
}

/**
 * Apply beat modifier if NPC config has one for this beat
 * @param {string} npcId
 * @param {string} pcId
 * @param {string} beatId
 * @param {Object} npcConfig
 * @returns {number|null} New level if modifier applied, null otherwise
 */
function applyBeatModifier(npcId, pcId, beatId, npcConfig) {
  const modifiers = npcConfig.disposition?.modifiers;
  if (!modifiers) {
    return null;
  }

  let change = null;

  // Support array format: [{ trigger: 'beatId', change: N }, ...]
  if (Array.isArray(modifiers)) {
    const match = modifiers.find(m => m.trigger === beatId);
    if (match) {
      change = match.change;
    }
  }
  // Support object format: { beatId: N, ... }
  else if (modifiers[beatId] !== undefined) {
    change = modifiers[beatId];
  }

  if (change === null) {
    return null;
  }

  const gameDate = new Date().toISOString();
  return modifyDisposition(npcId, pcId, change, `Beat: ${beatId}`, gameDate);
}

/**
 * Check and apply disposition cap from NPC config
 * @param {Object} npcConfig
 * @param {number} currentLevel
 * @returns {number} Capped level
 */
function checkDispositionCap(npcConfig, currentLevel) {
  const maxWithoutDeed = npcConfig.disposition?.caps?.max_without_deed;

  if (maxWithoutDeed !== undefined && currentLevel > maxWithoutDeed) {
    return maxWithoutDeed;
  }

  return currentLevel;
}

module.exports = {
  DISPOSITION_LABELS,
  DISPOSITION_FILE,
  loadDispositions,
  saveDispositions,
  getDisposition,
  modifyDisposition,
  getDispositionPromptModifier,
  getInitialDisposition,
  applyBeatModifier,
  checkDispositionCap
};
