/**
 * Scene Manager - Non-linear scene transitions and time control
 *
 * Pattern: State machine with narrative control
 * Supports time skips, flashbacks, parallel scenes, and montages
 */

const { loadScene, listScenes, recordBeat } = require('./story-engine');
const { setFlag, saveStoryState, selectStage, slugifyStage } = require('./decision-tracker');
const { sendEmailFromTemplate } = require('./email-system');
const { loadPersona } = require('./persona');

/**
 * Scene directive types
 */
const DIRECTIVE_TYPES = {
  SCENE: 'SCENE',
  FLASHBACK: 'FLASHBACK',
  MONTAGE: 'MONTAGE',
  TIME_SKIP: 'TIME_SKIP',
  STAGE: 'STAGE'  // NEW - stage within current scene
};

/**
 * Parse a scene directive from AGM response
 * Formats:
 *   [SCENE: scene-id]
 *   [SCENE: scene-id, TIME: +3d]
 *   [FLASHBACK: scene-id]
 *   [MONTAGE: scene1, scene2, scene3]
 *
 * @param {string} text - Text containing directive
 * @returns {Object|null} Parsed directive or null
 */
function parseSceneDirective(text) {
  // [SCENE: scene-id] or [SCENE: scene-id, TIME: +3d]
  const sceneMatch = text.match(/\[SCENE:\s*([a-z0-9-]+)(?:\s*,\s*TIME:\s*\+?(\d+)([dhw]))?\]/i);
  if (sceneMatch) {
    const result = {
      type: DIRECTIVE_TYPES.SCENE,
      sceneId: sceneMatch[1],
      timeSkip: null
    };
    if (sceneMatch[2] && sceneMatch[3]) {
      result.timeSkip = {
        amount: parseInt(sceneMatch[2], 10),
        unit: sceneMatch[3] // d=days, h=hours, w=weeks
      };
    }
    return result;
  }

  // [FLASHBACK: scene-id]
  const flashbackMatch = text.match(/\[FLASHBACK:\s*([a-z0-9-]+)\]/i);
  if (flashbackMatch) {
    return {
      type: DIRECTIVE_TYPES.FLASHBACK,
      sceneId: flashbackMatch[1]
    };
  }

  // [MONTAGE: scene1, scene2, scene3]
  const montageMatch = text.match(/\[MONTAGE:\s*([a-z0-9-,\s]+)\]/i);
  if (montageMatch) {
    const scenes = montageMatch[1].split(',').map(s => s.trim());
    return {
      type: DIRECTIVE_TYPES.MONTAGE,
      scenes
    };
  }

  // [NEXT_SCENE: scene-id] (legacy format)
  const nextMatch = text.match(/\[NEXT_SCENE:\s*([a-z0-9-]+)\]/i);
  if (nextMatch) {
    return {
      type: DIRECTIVE_TYPES.SCENE,
      sceneId: nextMatch[1]
    };
  }

  // [STAGE: stage-id] - Navigate to stage within current scene
  const stageMatch = text.match(/\[STAGE:\s*([a-z0-9-]+)\]/i);
  if (stageMatch) {
    return {
      type: DIRECTIVE_TYPES.STAGE,
      stageId: stageMatch[1]
    };
  }

  return null;
}

/**
 * Get current scene from story state
 * @param {Object} session - Adventure session
 * @returns {Object|null} Current scene data
 */
function getCurrentScene(session) {
  if (!session.storyState.currentScene) return null;
  try {
    return loadScene(session.adventure.id, session.storyState.currentScene);
  } catch (e) {
    return null;
  }
}

/**
 * List all available scenes for AGM
 * @param {Object} session - Adventure session
 * @returns {string[]} Array of scene IDs
 */
function listAllScenes(session) {
  try {
    return listScenes(session.adventure.id);
  } catch (e) {
    return [];
  }
}

/**
 * Get completed scenes
 * @param {Object} session - Adventure session
 * @returns {string[]} Array of completed scene IDs
 */
function getCompletedScenes(session) {
  return session.storyState.completedScenes || [];
}

/**
 * Trigger emails defined in scene's on_complete block
 * @param {Object} session - Adventure session
 * @param {Object} scene - Scene object with on_complete.emails
 * @returns {Array} Array of triggered email info
 */
function triggerSceneEmails(session, scene) {
  const emailsTriggered = [];

  // Skip if no on_complete emails defined
  if (!scene?.on_complete?.emails) {
    return emailsTriggered;
  }

  // Skip if scene already completed (idempotent)
  const completedScenes = session.storyState.completedScenes || [];
  if (completedScenes.includes(scene.id)) {
    return emailsTriggered;
  }

  for (const emailTrigger of scene.on_complete.emails) {
    try {
      const npc = loadPersona(emailTrigger.from_npc);
      if (!npc) {
        console.warn(`Email trigger: NPC not found: ${emailTrigger.from_npc}`);
        continue;
      }

      const email = sendEmailFromTemplate(session, emailTrigger.template, npc);
      if (email) {
        emailsTriggered.push({
          from: npc.name,
          subject: email.subject,
          npcId: npc.id
        });
      }
    } catch (e) {
      console.warn(`Failed to send email: ${emailTrigger.template}`, e.message);
    }
  }

  return emailsTriggered;
}

/**
 * Advance to a new scene
 * @param {Object} session - Adventure session
 * @param {string} sceneId - Target scene ID
 * @param {Object} [options] - Transition options
 * @returns {Object} Scene transition result
 */
function advanceToScene(session, sceneId, options = {}) {
  const currentScene = getCurrentScene(session);
  const result = {
    previousScene: session.storyState.currentScene,
    newScene: sceneId,
    triggersApplied: [],
    narrativePrompt: ''
  };

  // Track scene history for /back navigation
  if (!options.isFlashback && !options.isBack && session.storyState.currentScene) {
    if (!session.storyState.sceneHistory) {
      session.storyState.sceneHistory = [];
    }
    // Add current scene to history (limit to 10)
    session.storyState.sceneHistory.push(session.storyState.currentScene);
    if (session.storyState.sceneHistory.length > 10) {
      session.storyState.sceneHistory.shift();
    }
  }

  // Apply exit triggers from current scene
  if (currentScene?.plot_triggers?.on_exit) {
    for (const trigger of currentScene.plot_triggers.on_exit) {
      if (trigger.set_flag) {
        setFlag(session.storyState, trigger.set_flag, trigger.value);
        result.triggersApplied.push(`set ${trigger.set_flag}=${trigger.value}`);
      }
    }
  }

  // Mark current scene as completed
  if (currentScene && !options.isFlashback) {
    if (!session.storyState.completedScenes) {
      session.storyState.completedScenes = [];
    }
    if (!session.storyState.completedScenes.includes(currentScene.id)) {
      session.storyState.completedScenes.push(currentScene.id);

      // Trigger emails on scene completion (before adding to completed list check)
      const emailsTriggered = triggerSceneEmails(session, currentScene);
      if (emailsTriggered.length > 0) {
        result.emailsTriggered = emailsTriggered;
      }
    }
  }

  // Load new scene
  let newScene;
  try {
    newScene = loadScene(session.adventure.id, sceneId);
  } catch (e) {
    result.error = `Scene not found: ${sceneId}`;
    return result;
  }

  // Apply entry triggers
  if (newScene.plot_triggers?.on_enter && !options.isFlashback) {
    for (const trigger of newScene.plot_triggers.on_enter) {
      if (trigger.set_flag) {
        setFlag(session.storyState, trigger.set_flag, trigger.value);
        result.triggersApplied.push(`set ${trigger.set_flag}=${trigger.value}`);
      }
    }
  }

  // Update story state
  if (!options.isFlashback) {
    session.storyState.currentScene = sceneId;
  }

  // Apply time skip if specified
  if (options.timeSkip) {
    applyTimeSkip(session.storyState, options.timeSkip);
    result.timeAdvanced = options.timeSkip;
  }

  // Save state
  if (!options.isFlashback) {
    saveStoryState(session.storyState);
  }

  // Build narrative prompt
  result.narrativePrompt = newScene.narrator_prompt || '';
  result.scene = newScene;

  return result;
}

/**
 * Go back to previous scene in history
 * @param {Object} session - Adventure session
 * @returns {Object} Scene transition result or error
 */
function goBackToScene(session) {
  const history = session.storyState.sceneHistory || [];

  if (history.length === 0) {
    return { error: 'No scene history available' };
  }

  // Pop the previous scene
  const previousSceneId = history.pop();
  session.storyState.sceneHistory = history;

  // Advance to that scene with isBack flag to avoid re-adding to history
  return advanceToScene(session, previousSceneId, { isBack: true });
}

/**
 * Get scene history
 * @param {Object} session - Adventure session
 * @returns {string[]} Scene history
 */
function getSceneHistory(session) {
  return session.storyState.sceneHistory || [];
}

/**
 * Check if back navigation is available
 * @param {Object} session - Adventure session
 * @returns {boolean} Whether back is available
 */
function canGoBack(session) {
  const history = session.storyState.sceneHistory || [];
  return history.length > 0;
}

/**
 * Apply a time skip to the story state
 * @param {Object} storyState - Story state
 * @param {Object} timeSkip - { amount, unit }
 */
function applyTimeSkip(storyState, timeSkip) {
  // Parse current game date (format: DDD-YYYY)
  const dateMatch = storyState.gameDate?.match(/(\d{3})-(\d{4})/);
  if (!dateMatch) return;

  let day = parseInt(dateMatch[1], 10);
  let year = parseInt(dateMatch[2], 10);

  // Apply skip
  switch (timeSkip.unit) {
    case 'h': // hours - less than a day, minimal impact
      break;
    case 'd': // days
      day += timeSkip.amount;
      break;
    case 'w': // weeks
      day += timeSkip.amount * 7;
      break;
  }

  // Handle year rollover (365 days per year in Traveller)
  while (day > 365) {
    day -= 365;
    year += 1;
  }

  storyState.gameDate = `${String(day).padStart(3, '0')}-${year}`;
}

/**
 * Mark a story beat as complete
 * @param {Object} session - Adventure session
 * @param {string} beatId - Beat identifier
 */
function markBeatComplete(session, beatId) {
  if (!session.storyState.completedBeats) {
    session.storyState.completedBeats = [];
  }
  if (!session.storyState.completedBeats.includes(beatId)) {
    session.storyState.completedBeats.push(beatId);
    recordBeat(session.storyState, beatId);
  }
  saveStoryState(session.storyState);
}

/**
 * Execute a flashback (doesn't change current scene)
 * @param {Object} session - Adventure session
 * @param {string} sceneId - Flashback scene ID
 * @returns {Object} Flashback result
 */
function executeFlashback(session, sceneId) {
  const result = advanceToScene(session, sceneId, { isFlashback: true });
  result.isFlashback = true;
  return result;
}

/**
 * Execute a montage (summarize multiple scenes)
 * @param {Object} session - Adventure session
 * @param {string[]} sceneIds - Array of scene IDs
 * @returns {Object} Montage result
 */
function executeMontage(session, sceneIds) {
  const scenes = [];
  for (const sceneId of sceneIds) {
    try {
      const scene = loadScene(session.adventure.id, sceneId);
      scenes.push({
        id: sceneId,
        title: scene.title,
        brief: scene.description
      });

      // Mark as completed
      if (!session.storyState.completedScenes) {
        session.storyState.completedScenes = [];
      }
      if (!session.storyState.completedScenes.includes(sceneId)) {
        session.storyState.completedScenes.push(sceneId);
      }
    } catch (e) {
      // Skip missing scenes
    }
  }

  // Set current scene to last in montage
  if (sceneIds.length > 0) {
    session.storyState.currentScene = sceneIds[sceneIds.length - 1];
  }

  saveStoryState(session.storyState);

  return {
    type: 'montage',
    scenes
  };
}

/**
 * Build scene control context for AGM prompt
 * @param {Object} session - Adventure session
 * @returns {string} Scene control prompt section
 */
function buildSceneControlContext(session) {
  const allScenes = listAllScenes(session);
  const completed = getCompletedScenes(session);
  const current = session.storyState.currentScene;

  let context = '\n=== SCENE CONTROL ===\n';
  context += 'You may advance the story to ANY scene when dramatically appropriate.\n';
  context += `Available scenes: ${allScenes.join(', ')}\n`;
  context += `Current scene: ${current}\n`;
  context += `Completed scenes: ${completed.join(', ') || 'none'}\n\n`;
  context += 'Use [SCENE: id] to transition. [FLASHBACK: id] for memories.\n';
  context += 'Time skips: [SCENE: id, TIME: +3d] advances time.\n';
  context += 'You are not required to follow linear order.\n';

  return context;
}

module.exports = {
  parseSceneDirective,
  getCurrentScene,
  listAllScenes,
  getCompletedScenes,
  advanceToScene,
  markBeatComplete,
  executeFlashback,
  executeMontage,
  buildSceneControlContext,
  applyTimeSkip,
  DIRECTIVE_TYPES,
  // Back navigation
  goBackToScene,
  getSceneHistory,
  canGoBack,
  // Email triggers
  triggerSceneEmails
};
