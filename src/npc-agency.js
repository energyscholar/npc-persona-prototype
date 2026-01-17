/**
 * NPC Agency Module
 * Decision engine for NPC autonomous actions.
 *
 * Pattern: Coordinator - orchestrates goals, capabilities, and execution
 */

const { getCapabilities, canPerformAction, registerActionDefinition } = require('./npc-capabilities');
const { getActiveGoals, getGoalsByPriority, getGoalActions, shouldActOnGoal, updateGoalStatus, isGoalTriggered } = require('./npc-goals');
const { executeAction } = require('./action-executor');

// Register built-in action definitions
registerActionDefinition('repair-system', {
  id: 'repair-system',
  requiredCapabilities: ['can_repair']
});

registerActionDefinition('check-systems', {
  id: 'check-systems',
  requiredCapabilities: ['can_repair']
});

registerActionDefinition('fire-weapons', {
  id: 'fire-weapons',
  requiredCapabilities: ['can_fire', 'can_target']
});

registerActionDefinition('alert-crew', {
  id: 'alert-crew',
  requiredCapabilities: [] // Anyone can alert
});

registerActionDefinition('recommend-evasion', {
  id: 'recommend-evasion',
  requiredCapabilities: []
});

registerActionDefinition('monitor-sensors', {
  id: 'monitor-sensors',
  requiredCapabilities: [] // Anyone can monitor
});

registerActionDefinition('send-message', {
  id: 'send-message',
  requiredCapabilities: ['can_message']
});

registerActionDefinition('calibrate-targeting', {
  id: 'calibrate-targeting',
  requiredCapabilities: ['can_target']
});

registerActionDefinition('repair-weapons', {
  id: 'repair-weapons',
  requiredCapabilities: ['can_repair']
});

/**
 * Evaluate NPC goals and return actionable goals sorted by priority
 * Filters by trigger conditions to get goals NPC should act on now.
 * @param {Object} npc - NPC config
 * @param {Object} storyState - Current story state
 * @returns {Object[]} Sorted actionable goals
 */
function evaluateNpcGoals(npc, storyState) {
  if (!npc) return [];
  const activeGoals = getActiveGoals(npc, storyState || {});
  // Filter to goals whose triggers are currently met
  const triggeredGoals = activeGoals.filter(g => isGoalTriggered(g, storyState || {}));
  return getGoalsByPriority(triggeredGoals);
}

/**
 * Select the best action from a goal that the NPC can perform
 * @param {Object} goal - Goal with actions
 * @param {Object} npc - NPC config
 * @param {Object} storyState - Story state
 * @returns {Object|null} Action object { id, params } or null
 */
function selectBestAction(goal, npc, storyState) {
  if (!goal || !npc) return null;

  const actions = getGoalActions(goal);
  if (actions.length === 0) return null;

  // Find first action NPC can perform
  for (const actionId of actions) {
    if (canPerformAction(npc, actionId)) {
      return { id: actionId, params: {} };
    }
  }

  return null;
}

/**
 * Process a single NPC's turn
 * @param {Object} npc - NPC config
 * @param {Object} storyState - Story state
 * @param {string} gameDate - Current game date
 * @returns {Object} Result { npcId, action, success, status, message }
 */
function processNpcTurn(npc, storyState, gameDate) {
  if (!npc) {
    return { npcId: null, action: null, success: false, status: 'invalid', skipped: true };
  }

  const goals = evaluateNpcGoals(npc, storyState);

  // Find first goal we should act on
  for (const goal of goals) {
    if (!shouldActOnGoal(goal, storyState || {}, gameDate)) {
      continue;
    }

    const action = selectBestAction(goal, npc, storyState);
    if (!action) {
      // No valid action for this goal, check capability
      const goalActions = getGoalActions(goal);
      if (goalActions.length > 0) {
        return {
          npcId: npc.id,
          action: null,
          success: false,
          status: 'unauthorized',
          message: `NPC lacks capability for ${goalActions[0]}`
        };
      }
      continue;
    }

    // Execute the action
    const context = { npc, storyState: storyState || { flags: {} }, gameDate };
    const result = executeAction(action, context);

    // Update goal lastActed
    updateGoalStatus(npc, goal.id, goal.status, gameDate);

    return {
      npcId: npc.id,
      action: action.id,
      success: result.success,
      status: result.success ? 'completed' : 'failed',
      message: result.message
    };
  }

  // No goals to act on
  return {
    npcId: npc.id,
    action: null,
    success: false,
    status: 'no-action',
    skipped: true
  };
}

/**
 * Process agency for all NPCs
 * @param {Object[]} npcs - Array of NPC configs
 * @param {Object} storyState - Story state
 * @param {string} gameDate - Current game date
 * @returns {Object[]} Array of results for NPCs that took action
 */
function processNpcAgency(npcs, storyState, gameDate) {
  if (!npcs || !Array.isArray(npcs)) return [];

  const results = [];

  for (const npc of npcs) {
    if (!npc || !npc.goals || npc.goals.length === 0) {
      continue;
    }

    const result = processNpcTurn(npc, storyState, gameDate);

    // Only include results where action was taken
    if (result.action || result.status === 'unauthorized') {
      results.push(result);
    }
  }

  return results;
}

module.exports = {
  processNpcAgency,
  selectBestAction,
  evaluateNpcGoals,
  processNpcTurn
};
