/**
 * Information Gating Module
 * Gates NPC knowledge behind skill checks with persistence.
 *
 * Pattern: Repository (load/save) for unlock state
 */

const fs = require('fs');
const path = require('path');
const { performCheck } = require('./skill-check');

const UNLOCKS_FILE = path.join(__dirname, '../data/state/pc-unlocks.json');

/**
 * Load unlock state from file
 * @returns {Object} { unlocks: { [pcId]: { [npcId]: [infoKey, ...] } } }
 */
function loadUnlocks() {
  try {
    if (fs.existsSync(UNLOCKS_FILE)) {
      const data = fs.readFileSync(UNLOCKS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (!parsed.unlocks) parsed.unlocks = {};
      return parsed;
    }
  } catch (e) {
    // Return empty state on error
  }
  return { unlocks: {} };
}

/**
 * Save unlock state to file
 * @param {Object} state - Unlock state
 */
function saveUnlocks(state) {
  const dir = path.dirname(UNLOCKS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(UNLOCKS_FILE, JSON.stringify(state, null, 2));
}

/**
 * Check if info is already unlocked for PC-NPC pair
 * @param {string} pcId
 * @param {string} npcId
 * @param {string} infoKey
 * @returns {boolean}
 */
function isUnlocked(pcId, npcId, infoKey) {
  const state = loadUnlocks();
  if (!state.unlocks[pcId]) return false;
  if (!state.unlocks[pcId][npcId]) return false;
  return state.unlocks[pcId][npcId].includes(infoKey);
}

/**
 * Record an unlock for PC-NPC pair
 * @param {string} pcId
 * @param {string} npcId
 * @param {string} infoKey
 */
function recordUnlock(pcId, npcId, infoKey) {
  const state = loadUnlocks();

  if (!state.unlocks[pcId]) {
    state.unlocks[pcId] = {};
  }
  if (!state.unlocks[pcId][npcId]) {
    state.unlocks[pcId][npcId] = [];
  }

  // Don't duplicate
  if (!state.unlocks[pcId][npcId].includes(infoKey)) {
    state.unlocks[pcId][npcId].push(infoKey);
    saveUnlocks(state);
  }
}

/**
 * Attempt to access gated information
 * @param {Object} gatedInfo - { content, requires: { skill, threshold }, alternates?, unlockOnSuccess? }
 * @param {Object} pc - PC data
 * @param {string} pcId
 * @param {string} npcId
 * @param {string} infoKey
 * @returns {Object} { accessible, content?, reason }
 */
function attemptAccess(gatedInfo, pc, pcId, npcId, infoKey) {
  // Already unlocked?
  if (isUnlocked(pcId, npcId, infoKey)) {
    return {
      accessible: true,
      content: gatedInfo.content,
      reason: 'Previously unlocked'
    };
  }

  // Try primary skill check
  const primary = gatedInfo.requires;
  if (primary) {
    const result = performCheck(primary.skill, primary.threshold);
    if (result.success) {
      if (gatedInfo.unlockOnSuccess) {
        recordUnlock(pcId, npcId, infoKey);
      }
      return {
        accessible: true,
        content: gatedInfo.content,
        reason: `Passed ${primary.skill} check (rolled ${result.total} vs ${result.threshold})`
      };
    }
  }

  // Try alternate skill checks
  if (gatedInfo.alternates && Array.isArray(gatedInfo.alternates)) {
    for (const alt of gatedInfo.alternates) {
      const result = performCheck(alt.skill, alt.threshold);
      if (result.success) {
        if (gatedInfo.unlockOnSuccess) {
          recordUnlock(pcId, npcId, infoKey);
        }
        return {
          accessible: true,
          content: gatedInfo.content,
          reason: `Passed ${alt.skill} check (alternate)`
        };
      }
    }
  }

  // All checks failed
  return {
    accessible: false,
    reason: `Failed ${primary?.skill || 'required'} check`
  };
}

/**
 * Get all accessible knowledge for a PC-NPC interaction
 * @param {Object} npcConfig - NPC persona config
 * @param {Object} pc - PC data
 * @param {string} pcId
 * @param {string} npcId
 * @returns {Object} { public, accessible, gated }
 */
function getAccessibleKnowledge(npcConfig, pc, pcId, npcId) {
  const result = {
    public: {},
    accessible: {},
    gated: []
  };

  // Add public knowledge
  if (npcConfig.knowledge_base) {
    result.public = { ...npcConfig.knowledge_base };
  }

  // Check gated knowledge
  if (npcConfig.gated_knowledge) {
    for (const [key, info] of Object.entries(npcConfig.gated_knowledge)) {
      if (isUnlocked(pcId, npcId, key)) {
        result.accessible[key] = info.content;
      } else {
        result.gated.push(key);
      }
    }
  }

  return result;
}

/**
 * Check if PC can access specific info (public or unlocked)
 * @param {Object} npcConfig - NPC persona config
 * @param {string} pcId
 * @param {string} npcId
 * @param {string} infoKey
 * @returns {boolean}
 */
function canAccessInfo(npcConfig, pcId, npcId, infoKey) {
  // Check if it's public knowledge
  if (npcConfig.knowledge_base && npcConfig.knowledge_base[infoKey] !== undefined) {
    return true;
  }

  // Check if it's unlocked gated knowledge
  if (npcConfig.gated_knowledge && npcConfig.gated_knowledge[infoKey]) {
    return isUnlocked(pcId, npcId, infoKey);
  }

  // Unknown key - treat as not accessible
  return false;
}

module.exports = {
  UNLOCKS_FILE,
  loadUnlocks,
  saveUnlocks,
  isUnlocked,
  recordUnlock,
  attemptAccess,
  getAccessibleKnowledge,
  canAccessInfo
};
