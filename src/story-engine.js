/**
 * Story Engine for Traveller Adventures
 *
 * Manages adventure state, scenes, encounters, and story progression.
 * Follows Shakespearean structure: Campaign → Adventure → Act → Scene → Encounter
 */

const fs = require('fs');
const path = require('path');

// Paths
const ADVENTURES_DIR = path.join(__dirname, '../data/adventures');

/**
 * Load an adventure manifest
 * @param {string} adventureId - Adventure ID (e.g., 'high-and-dry')
 * @returns {Object} Adventure data
 */
function loadAdventure(adventureId) {
  const adventurePath = path.join(ADVENTURES_DIR, adventureId, 'adventure.json');

  if (!fs.existsSync(adventurePath)) {
    throw new Error(`Adventure not found: ${adventureId}`);
  }

  const content = fs.readFileSync(adventurePath, 'utf8');
  return JSON.parse(content);
}

/**
 * Load an act definition
 * @param {string} adventureId - Adventure ID
 * @param {string} actId - Act ID (e.g., 'act-2-walston')
 * @returns {Object} Act data
 */
function loadAct(adventureId, actId) {
  const actPath = path.join(ADVENTURES_DIR, adventureId, 'acts', `${actId}.json`);

  if (!fs.existsSync(actPath)) {
    throw new Error(`Act not found: ${actId}`);
  }

  const content = fs.readFileSync(actPath, 'utf8');
  return JSON.parse(content);
}

/**
 * Load a scene definition
 * @param {string} adventureId - Adventure ID
 * @param {string} sceneId - Scene ID (e.g., 'meeting-greener')
 * @returns {Object} Scene data
 */
function loadScene(adventureId, sceneId) {
  const scenePath = path.join(ADVENTURES_DIR, adventureId, 'scenes', `${sceneId}.json`);

  if (!fs.existsSync(scenePath)) {
    throw new Error(`Scene not found: ${sceneId}`);
  }

  const content = fs.readFileSync(scenePath, 'utf8');
  return JSON.parse(content);
}

/**
 * Load an encounter definition
 * @param {string} adventureId - Adventure ID
 * @param {string} encounterId - Encounter ID (e.g., 'negotiation')
 * @returns {Object} Encounter data
 */
function loadEncounter(adventureId, encounterId) {
  const encounterPath = path.join(ADVENTURES_DIR, adventureId, 'encounters', `${encounterId}.json`);

  if (!fs.existsSync(encounterPath)) {
    throw new Error(`Encounter not found: ${encounterId}`);
  }

  const content = fs.readFileSync(encounterPath, 'utf8');
  return JSON.parse(content);
}

/**
 * List available adventures
 * @returns {string[]} Array of adventure IDs
 */
function listAdventures() {
  if (!fs.existsSync(ADVENTURES_DIR)) {
    return [];
  }

  return fs.readdirSync(ADVENTURES_DIR)
    .filter(f => {
      const adventurePath = path.join(ADVENTURES_DIR, f, 'adventure.json');
      return fs.existsSync(adventurePath);
    });
}

/**
 * List acts for an adventure
 * @param {string} adventureId - Adventure ID
 * @returns {string[]} Array of act IDs
 */
function listActs(adventureId) {
  const actsDir = path.join(ADVENTURES_DIR, adventureId, 'acts');

  if (!fs.existsSync(actsDir)) {
    return [];
  }

  return fs.readdirSync(actsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

/**
 * Load all acts for an adventure, sorted by number
 * @param {string} adventureId - Adventure ID
 * @returns {Object[]} Array of act objects sorted by number
 */
function loadActs(adventureId) {
  const actIds = listActs(adventureId);
  const acts = [];

  for (const actId of actIds) {
    try {
      const act = loadAct(adventureId, actId);
      acts.push(act);
    } catch (e) {
      // Skip invalid act files
    }
  }

  // Sort by act number
  acts.sort((a, b) => (a.number || 0) - (b.number || 0));

  return acts;
}

/**
 * List scenes for an adventure
 * @param {string} adventureId - Adventure ID
 * @returns {string[]} Array of scene IDs
 */
function listScenes(adventureId) {
  const scenesDir = path.join(ADVENTURES_DIR, adventureId, 'scenes');

  if (!fs.existsSync(scenesDir)) {
    return [];
  }

  return fs.readdirSync(scenesDir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

/**
 * List encounters for an adventure
 * @param {string} adventureId - Adventure ID
 * @returns {string[]} Array of encounter IDs
 */
function listEncounters(adventureId) {
  const encountersDir = path.join(ADVENTURES_DIR, adventureId, 'encounters');

  if (!fs.existsSync(encountersDir)) {
    return [];
  }

  return fs.readdirSync(encountersDir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

/**
 * Create a new story state for tracking progress
 * @param {string} adventureId - Adventure ID
 * @returns {Object} New story state
 */
function createStoryState(adventureId) {
  const adventure = loadAdventure(adventureId);

  return {
    adventure: adventureId,
    currentAct: adventure.acts[0] || null,
    currentScene: null,
    currentStage: null,           // NEW - current stage within scene
    completedStages: {},          // NEW - per-scene stage completion { 'scene-id': ['stage-1', 'stage-2'] }
    expandedScenes: [],           // NEW - scenes expanded in menu
    completedBeats: [],
    completedScenes: [],          // Ensure this exists
    flags: {},
    choices: {},
    startDate: new Date().toISOString(),
    gameDate: adventure.timing?.start_date || '001-1105'
  };
}

/**
 * Record a story beat as completed
 * @param {Object} state - Story state
 * @param {string} beatId - Beat ID
 * @param {string} [gameDate] - In-game date
 */
function recordBeat(state, beatId, gameDate = null) {
  if (!state.completedBeats.includes(beatId)) {
    state.completedBeats.push(beatId);
  }

  if (gameDate) {
    state.gameDate = gameDate;
  }
}

/**
 * Check if a story beat has been completed
 * @param {Object} state - Story state
 * @param {string} beatId - Beat ID
 * @returns {boolean} True if beat is completed
 */
function isBeatComplete(state, beatId) {
  return state.completedBeats.includes(beatId);
}

/**
 * Set a story flag
 * @param {Object} state - Story state
 * @param {string} key - Flag key
 * @param {*} value - Flag value
 */
function setFlag(state, key, value) {
  state.flags[key] = value;
}

/**
 * Get a story flag
 * @param {Object} state - Story state
 * @param {string} key - Flag key
 * @returns {*} Flag value or undefined
 */
function getFlag(state, key) {
  return state.flags[key];
}

/**
 * Record a player choice
 * @param {Object} state - Story state
 * @param {string} choiceId - Choice identifier
 * @param {*} value - Choice value
 */
function recordChoice(state, choiceId, value) {
  state.choices[choiceId] = value;
}

/**
 * Advance to next act
 * @param {Object} state - Story state
 * @returns {Object|null} New act data or null if at end
 */
function advanceAct(state) {
  const adventure = loadAdventure(state.adventure);
  const currentIndex = adventure.acts.indexOf(state.currentAct);

  if (currentIndex < adventure.acts.length - 1) {
    state.currentAct = adventure.acts[currentIndex + 1];
    state.currentScene = null;
    return loadAct(state.adventure, state.currentAct);
  }

  return null;
}

/**
 * Set current scene
 * @param {Object} state - Story state
 * @param {string} sceneId - Scene ID
 * @returns {Object} Scene data
 */
function setScene(state, sceneId) {
  state.currentScene = sceneId;
  return loadScene(state.adventure, sceneId);
}

/**
 * Get current adventure summary for display
 * @param {Object} state - Story state
 * @returns {Object} Summary for display
 */
function getProgressSummary(state) {
  const adventure = loadAdventure(state.adventure);
  let currentActData = null;
  let currentSceneData = null;

  try {
    if (state.currentAct) {
      currentActData = loadAct(state.adventure, state.currentAct);
    }
  } catch (e) {
    // Act not found
  }

  try {
    if (state.currentScene) {
      currentSceneData = loadScene(state.adventure, state.currentScene);
    }
  } catch (e) {
    // Scene not found
  }

  const totalBeats = adventure.story_beats?.length || 0;
  const completedCount = state.completedBeats.length;

  return {
    adventure: adventure.title,
    act: currentActData?.title || state.currentAct || 'Not started',
    scene: currentSceneData?.title || state.currentScene || 'None',
    progress: totalBeats > 0 ? `${completedCount}/${totalBeats} beats` : 'No beats defined',
    gameDate: state.gameDate,
    recentBeats: state.completedBeats.slice(-5)
  };
}

/**
 * Get narrator prompt for current scene
 * @param {string} adventureId - Adventure ID
 * @param {string} sceneId - Scene ID
 * @returns {string} Narrator prompt text
 */
function getSceneNarratorPrompt(adventureId, sceneId) {
  try {
    const scene = loadScene(adventureId, sceneId);
    return scene.narrator_prompt || `Scene: ${scene.title}. ${scene.description}`;
  } catch (e) {
    return 'No scene data available.';
  }
}

/**
 * Get encounter details formatted for display
 * @param {string} adventureId - Adventure ID
 * @param {string} encounterId - Encounter ID
 * @returns {Object} Formatted encounter info
 */
function getEncounterDetails(adventureId, encounterId) {
  const encounter = loadEncounter(adventureId, encounterId);

  return {
    title: encounter.title,
    type: encounter.type,
    description: encounter.description,
    skills: encounter.mechanics?.primary_skill
      ? [encounter.mechanics.primary_skill, ...(encounter.mechanics.alternate_skills || [])]
      : encounter.skills || [],
    difficulty: encounter.mechanics?.difficulty || encounter.difficulty || 'N/A',
    dialogueHooks: encounter.dialogue?.hooks || encounter.dialogue_hooks || [],
    roleplayGuidance: encounter.roleplay_guidance || null
  };
}

module.exports = {
  loadAdventure,
  loadAct,
  loadActs,
  loadScene,
  loadEncounter,
  listAdventures,
  listActs,
  listScenes,
  listEncounters,
  createStoryState,
  recordBeat,
  isBeatComplete,
  setFlag,
  getFlag,
  recordChoice,
  advanceAct,
  setScene,
  getProgressSummary,
  getSceneNarratorPrompt,
  getEncounterDetails
};
