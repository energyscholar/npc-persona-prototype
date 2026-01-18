/**
 * Decision Tracker - Record player choices and propagate consequences
 *
 * Pattern: State mutation with persistence
 * Tracks major narrative decisions and their impact on the story
 */

const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '../data/state/adventures');

/**
 * Ensure state directory exists
 */
function ensureStateDir() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

/**
 * Record a player decision with consequences
 * @param {Object} storyState - Current story state
 * @param {Object} decision - Decision details
 * @param {string} decision.id - Unique decision identifier
 * @param {string} decision.choice - The choice made
 * @param {string} decision.details - Description of the choice
 * @param {Object} decision.consequences - Key-value consequences
 */
function recordDecision(storyState, decision) {
  if (!storyState.decisions) {
    storyState.decisions = {};
  }

  storyState.decisions[decision.id] = {
    timestamp: new Date().toISOString(),
    scene: storyState.currentScene || 'unknown',
    choice: decision.choice,
    details: decision.details,
    consequences: decision.consequences || {}
  };

  // Apply immediate consequences (flags)
  for (const [key, value] of Object.entries(decision.consequences || {})) {
    if (key.startsWith('flag_')) {
      const flagName = key.replace('flag_', '');
      setFlag(storyState, flagName, value);
    } else if (key === 'disposition_change' && storyState.disposition) {
      storyState.disposition.level = (storyState.disposition.level || 0) + value;
    }
  }

  return storyState;
}

/**
 * Set a story flag
 * @param {Object} storyState - Story state
 * @param {string} flagName - Flag name
 * @param {*} value - Flag value
 */
function setFlag(storyState, flagName, value) {
  if (!storyState.flags) {
    storyState.flags = {};
  }
  storyState.flags[flagName] = value;
}

/**
 * Get a story flag value
 * @param {Object} storyState - Story state
 * @param {string} flagName - Flag name
 * @returns {*} Flag value or undefined
 */
function getFlag(storyState, flagName) {
  return storyState?.flags?.[flagName];
}

/**
 * Get summary of all decisions for AGM prompt injection
 * @param {Object} storyState - Story state
 * @returns {string} Formatted decision summary
 */
function getDecisionSummary(storyState) {
  if (!storyState.decisions || Object.keys(storyState.decisions).length === 0) {
    return 'No major decisions made yet.';
  }

  const lines = [];
  let index = 1;

  for (const [id, d] of Object.entries(storyState.decisions)) {
    lines.push(`${index}. [${d.scene}] ${d.choice}`);
    lines.push(`   → ${d.details}`);

    // Add consequence summary
    const consq = Object.entries(d.consequences || {})
      .filter(([k]) => !k.startsWith('flag_'))
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    if (consq) {
      lines.push(`   → Effects: ${consq}`);
    }

    index++;
  }

  return lines.join('\n');
}

/**
 * Check if a specific decision has been made
 * @param {Object} storyState - Story state
 * @param {string} decisionId - Decision identifier
 * @returns {boolean} Whether decision exists
 */
function checkDecisionMade(storyState, decisionId) {
  return storyState?.decisions?.hasOwnProperty(decisionId) || false;
}

/**
 * Get a specific consequence from a decision
 * @param {Object} storyState - Story state
 * @param {string} decisionId - Decision identifier
 * @param {string} key - Consequence key
 * @returns {*} Consequence value or undefined
 */
function getDecisionConsequence(storyState, decisionId, key) {
  return storyState?.decisions?.[decisionId]?.consequences?.[key];
}

/**
 * Get all decisions as an array for display
 * @param {Object} storyState - Story state
 * @returns {Object[]} Array of decision objects
 */
function listDecisions(storyState) {
  if (!storyState.decisions) return [];

  return Object.entries(storyState.decisions).map(([id, d]) => ({
    id,
    ...d
  }));
}

/**
 * Build AGM-formatted decision context for prompt injection
 * @param {Object} storyState - Story state
 * @returns {string} Formatted prompt section
 */
function buildDecisionContext(storyState) {
  const decisions = listDecisions(storyState);
  if (decisions.length === 0) return '';

  let context = '\n=== PLAYER DECISIONS (CRITICAL - THESE SHAPE THE STORY) ===\n\n';
  context += 'Key choices made:\n';
  context += getDecisionSummary(storyState);
  context += '\n\nThese decisions MUST influence your narration:\n';
  context += '- Reference past choices naturally\n';
  context += '- Show consequences in NPC reactions\n';
  context += '- Open/close paths based on decisions\n';
  context += '- NPCs remember player reputation\n';

  return context;
}

/**
 * Save story state to file
 * @param {Object} storyState - Story state to save
 */
function saveStoryState(storyState) {
  ensureStateDir();

  const filename = `${storyState.adventure}-${storyState.pcId}.json`;
  const filepath = path.join(STATE_DIR, filename);

  storyState.lastPlayed = new Date().toISOString();
  fs.writeFileSync(filepath, JSON.stringify(storyState, null, 2));
}

/**
 * Load story state from file
 * @param {string} adventureId - Adventure identifier
 * @param {string} pcId - PC identifier
 * @returns {Object|null} Story state or null if not found
 */
function loadStoryState(adventureId, pcId) {
  const filename = `${adventureId}-${pcId}.json`;
  const filepath = path.join(STATE_DIR, filename);

  if (fs.existsSync(filepath)) {
    try {
      return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    } catch (e) {
      return null;
    }
  }
  return null;
}

// === STAGE TRACKING (Hierarchical Scenes) ===

/**
 * Convert stage name to slug ID
 * @param {string} stageName - Stage name (e.g., "Lower Slopes")
 * @returns {string} Slug ID (e.g., "lower-slopes")
 */
function slugifyStage(stageName) {
  if (!stageName) return '';
  return stageName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Select a stage within current scene
 * @param {Object} storyState - Story state
 * @param {string} stageId - Stage ID (slugified)
 */
function selectStage(storyState, stageId) {
  storyState.currentStage = stageId;
}

/**
 * Mark a stage as completed
 * @param {Object} storyState - Story state
 * @param {string} stageId - Stage ID (slugified)
 */
function completeStage(storyState, stageId) {
  const sceneId = storyState.currentScene;
  if (!sceneId) return;

  if (!storyState.completedStages) {
    storyState.completedStages = {};
  }

  if (!storyState.completedStages[sceneId]) {
    storyState.completedStages[sceneId] = [];
  }

  if (!storyState.completedStages[sceneId].includes(stageId)) {
    storyState.completedStages[sceneId].push(stageId);
  }
}

/**
 * Check if a stage is completed
 * @param {Object} storyState - Story state
 * @param {string} sceneId - Scene ID
 * @param {string} stageId - Stage ID
 * @returns {boolean}
 */
function isStageCompleted(storyState, sceneId, stageId) {
  if (!storyState.completedStages) return false;
  const stages = storyState.completedStages[sceneId];
  return stages && stages.includes(stageId);
}

/**
 * Get completed stages for a scene
 * @param {Object} storyState - Story state
 * @param {string} sceneId - Scene ID
 * @returns {string[]} Completed stage IDs
 */
function getCompletedStages(storyState, sceneId) {
  if (!storyState.completedStages) return [];
  return storyState.completedStages[sceneId] || [];
}

/**
 * Toggle scene expansion in menu
 * @param {Object} storyState - Story state
 * @param {string} sceneId - Scene ID
 * @returns {boolean} New expansion state
 */
function toggleSceneExpansion(storyState, sceneId) {
  if (!storyState.expandedScenes) {
    storyState.expandedScenes = [];
  }

  const idx = storyState.expandedScenes.indexOf(sceneId);
  if (idx >= 0) {
    storyState.expandedScenes.splice(idx, 1);
    return false;
  } else {
    storyState.expandedScenes.push(sceneId);
    return true;
  }
}

/**
 * Check if scene is expanded in menu
 * @param {Object} storyState - Story state
 * @param {string} sceneId - Scene ID
 * @returns {boolean}
 */
function isSceneExpanded(storyState, sceneId) {
  return storyState.expandedScenes && storyState.expandedScenes.includes(sceneId);
}

/**
 * Get stage from scene by slug
 * @param {Object} scene - Scene data with stages array
 * @param {string} stageSlug - Stage slug ID
 * @returns {Object|null} Stage object or null
 */
function getStageBySlug(scene, stageSlug) {
  if (!scene || !scene.stages) return null;

  return scene.stages.find(s => slugifyStage(s.name) === stageSlug) || null;
}

module.exports = {
  recordDecision,
  setFlag,
  getFlag,
  getDecisionSummary,
  checkDecisionMade,
  getDecisionConsequence,
  listDecisions,
  buildDecisionContext,
  saveStoryState,
  loadStoryState,
  ensureStateDir,
  // Stage tracking (hierarchical scenes)
  slugifyStage,
  selectStage,
  completeStage,
  isStageCompleted,
  getCompletedStages,
  toggleSceneExpansion,
  isSceneExpanded,
  getStageBySlug
};
