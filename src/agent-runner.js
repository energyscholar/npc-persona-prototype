/**
 * Agent Runner - Session management and action execution for autonomous play
 *
 * Manages adventure sessions and executes agent actions.
 */

const { loadAdventure, loadScene, createStoryState } = require('./story-engine');
const { createPlayerAgent } = require('./player-agent');
const { generateReport } = require('./agent-reporter');

/**
 * Observe current state and return structured observation
 * @param {Object} session - Adventure session
 * @returns {Promise<Object>} Observation structure
 */
async function observeState(session) {
  const storyState = session.storyState || {};
  const sceneId = storyState.currentScene || 'unknown';
  const flags = storyState.flags || {};
  const inventory = session.inventory || { carried: [], stored: {} };

  // Try to load scene data
  let sceneData = { id: sceneId, description: '', availableActions: [] };
  try {
    if (session.adventure && sceneId !== 'unknown') {
      const adventureId = typeof session.adventure === 'string'
        ? session.adventure
        : session.adventure.id;
      const scene = loadScene(adventureId, sceneId);
      sceneData = {
        id: sceneId,
        description: scene.description || scene.narrator_prompt || '',
        availableActions: extractAvailableActions(scene),
        npcsPresent: scene.npcs_present || [],
        objectives: scene.objectives || []
      };
    }
  } catch (e) {
    // Scene load failed, use defaults
  }

  // Convert flags object to array of true flag names
  const activeFlags = Object.entries(flags)
    .filter(([k, v]) => v === true)
    .map(([k]) => k);

  return {
    scene: sceneData,
    flags: activeFlags,
    inventory: {
      carried: inventory.carried || [],
      stored: inventory.stored || {}
    },
    recentHistory: session.recentHistory || [],
    currentGoal: session.currentGoal || 'Complete the adventure',
    npcPresent: sceneData.npcsPresent || []
  };
}

/**
 * Extract available actions from scene data
 * @param {Object} scene - Scene data
 * @returns {string[]} Available action descriptions
 */
function extractAvailableActions(scene) {
  const actions = [];

  // Add talk actions for NPCs present
  if (scene.npcs_present) {
    scene.npcs_present.forEach(npc => {
      actions.push(`talk ${npc}`);
    });
  }

  // Add encounter-based actions
  if (scene.encounters) {
    scene.encounters.forEach(enc => {
      actions.push(`examine ${enc}`);
    });
  }

  // Standard actions
  actions.push('examine surroundings');
  actions.push('inventory');

  // Add navigation if transitions defined
  if (scene.transitions) {
    Object.keys(scene.transitions).forEach(dest => {
      actions.push(`move ${dest}`);
    });
  }

  return actions;
}

/**
 * Execute an agent action on the session
 * @param {Object} session - Adventure session
 * @param {Object|string} action - Action to execute
 * @returns {Promise<Object>} Execution result
 */
async function executeAgentAction(session, action) {
  // Parse action if string
  const actionObj = typeof action === 'string' ? parseAction(action) : action;
  const actionType = actionObj.action || actionObj.type || 'unknown';

  const result = {
    success: true,
    message: '',
    stateChanges: {}
  };

  try {
    switch (actionType) {
      case 'talk':
        result.message = await executeTalkAction(session, actionObj);
        break;

      case 'move':
        result.message = executeMove(session, actionObj.target);
        result.stateChanges.scene = actionObj.target;
        break;

      case 'choice':
        result.message = executeChoice(session, actionObj.target);
        break;

      case 'examine':
        result.message = executeExamine(session, actionObj.target);
        break;

      case 'inventory':
        result.message = executeInventory(session);
        break;

      case 'wait':
        result.message = 'Time passes...';
        break;

      default:
        result.success = false;
        result.message = `Unknown action type: ${actionType}`;
    }
  } catch (error) {
    result.success = false;
    result.message = `Action failed: ${error.message}`;
  }

  return result;
}

/**
 * Parse action string into structured action
 */
function parseAction(actionStr) {
  const parts = actionStr.trim().split(/\s+/);
  const type = parts[0] || 'examine';

  if (type === 'talk' && parts.length >= 2) {
    const target = parts[1];
    const message = parts.slice(2).join(' ').replace(/^["']|["']$/g, '');
    return { action: 'talk', target, message };
  }

  return {
    action: type,
    target: parts.slice(1).join(' ')
  };
}

/**
 * Execute talk action
 */
async function executeTalkAction(session, action) {
  const npcId = action.target;
  const message = action.message || 'Hello';

  // In a real implementation, this would call the NPC chat system
  // For now, return a placeholder response
  return `[${npcId}]: (NPC response would appear here)`;
}

/**
 * Execute move action
 */
function executeMove(session, targetScene) {
  if (!session.storyState) {
    session.storyState = {};
  }
  session.storyState.currentScene = targetScene;
  return `Moved to ${targetScene}`;
}

/**
 * Execute choice action
 */
function executeChoice(session, choiceId) {
  if (!session.storyState) {
    session.storyState = {};
  }
  if (!session.storyState.flags) {
    session.storyState.flags = {};
  }

  // Set flag based on choice
  session.storyState.flags[choiceId] = true;
  return `Selected: ${choiceId}`;
}

/**
 * Execute examine action
 */
function executeExamine(session, target) {
  return target
    ? `You examine ${target}...`
    : 'You look around, taking in your surroundings.';
}

/**
 * Execute inventory action
 */
function executeInventory(session) {
  const inv = session.inventory || { carried: [], stored: {} };
  const items = inv.carried || [];

  if (items.length === 0) {
    return 'Your inventory is empty.';
  }

  return `You are carrying: ${items.join(', ')}`;
}

/**
 * Play through an adventure autonomously
 * @param {string} adventureId - Adventure identifier
 * @param {string} playerId - Player character identifier
 * @param {Object} [options] - Play options
 * @returns {Promise<Object>} Playthrough report
 */
async function playAdventure(adventureId, playerId, options = {}) {
  const { maxTurns = 100, verbose = false, startScene = null } = options;

  // Initialize session
  const adventure = loadAdventure(adventureId);
  const storyState = createStoryState(adventureId);

  if (startScene) {
    storyState.currentScene = startScene;
  } else if (!storyState.currentScene) {
    // Default to first scene
    storyState.currentScene = 'scout-office';
  }

  const session = {
    adventure,
    storyState,
    inventory: { carried: [], stored: {} },
    recentHistory: [],
    currentGoal: 'Complete the mission to find and claim the downed scout ship',
    isComplete: false,
    isStuck: false
  };

  // Create agent
  const agent = createPlayerAgent({ maxTurns, verbose });

  // Main play loop
  while (!session.isComplete && !session.isStuck && !agent.isMaxTurnsExceeded()) {
    // 1. Observe current state
    const observation = await observeState(session);

    // 2. Agent decides action
    const decision = await agent.decide(observation);

    // 3. Execute action
    const result = await executeAgentAction(session, decision.action);

    // 4. Update recent history
    session.recentHistory.push({
      turn: agent.getTurnCount() + 1,
      action: decision.action,
      response: result.message
    });

    // Keep only last 10 entries
    if (session.recentHistory.length > 10) {
      session.recentHistory = session.recentHistory.slice(-10);
    }

    // 5. Log for analysis
    agent.log({
      action: decision,
      observation,
      result
    });

    // 6. Check for stuck/loop detection
    if (agent.detectLoop()) {
      session.isStuck = true;
    }

    // 7. Check for completion (simplified - check for end flags)
    if (session.storyState.flags?.adventure_complete) {
      session.isComplete = true;
    }

    if (verbose) {
      console.log(`Turn ${agent.getTurnCount()}: ${decision.action}`);
    }
  }

  // Generate report
  const status = {
    completed: session.isComplete,
    stuck: session.isStuck,
    maxTurnsReached: agent.isMaxTurnsExceeded()
  };

  return generateReport(agent.getHistory(), status);
}

module.exports = {
  playAdventure,
  observeState,
  executeAgentAction,
  parseAction
};
