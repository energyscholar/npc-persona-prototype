/**
 * Action Executor Module
 * Executes NPC actions and applies effects to story state.
 *
 * Pattern: Strategy (pluggable executors)
 */

// Executor registry
const executors = {};

/**
 * Helper for creating action results
 */
const ActionResult = {
  /**
   * Create a success result
   * @param {string} message - Success message
   * @param {Object} [data] - Optional data
   * @returns {Object}
   */
  success(message, data = null) {
    const result = { success: true, message };
    if (data) result.data = data;
    return result;
  },

  /**
   * Create a failure result
   * @param {string} message - Failure message
   * @param {Object} [data] - Optional data
   * @returns {Object}
   */
  failure(message, data = null) {
    const result = { success: false, message };
    if (data) result.data = data;
    return result;
  }
};

/**
 * Register a custom action executor
 * @param {string} actionId - Action identifier
 * @param {Function} executor - Executor function (action, context) => result
 */
function registerExecutor(actionId, executor) {
  if (!actionId) return;
  executors[actionId] = executor;
}

/**
 * Get executor for an action
 * @param {string} actionId - Action identifier
 * @returns {Function|null}
 */
function getExecutor(actionId) {
  if (!actionId) return null;
  return executors[actionId] || null;
}

/**
 * Execute an action
 * @param {Object} action - Action to execute { id, params }
 * @param {Object} context - Execution context { npc, storyState, gameDate }
 * @returns {Object} Result { success, message, data? }
 */
function executeAction(action, context) {
  if (!action || !action.id) {
    return ActionResult.failure('Invalid action');
  }

  if (!context) {
    return ActionResult.failure('Missing context');
  }

  const executor = getExecutor(action.id);
  if (!executor) {
    return ActionResult.failure(`Unknown action: ${action.id}`);
  }

  try {
    return executor(action, context);
  } catch (e) {
    return ActionResult.failure(`Action failed: ${e.message}`);
  }
}

// === Built-in Executors ===

/**
 * Repair system action - decrements damage_level
 */
registerExecutor('repair-system', (action, context) => {
  const flags = context.storyState?.flags;
  if (!flags) {
    return ActionResult.failure('No story state available');
  }

  const currentDamage = flags.damage_level || 0;
  if (currentDamage <= 0) {
    return ActionResult.success('No damage to repair', { damageLevel: 0 });
  }

  flags.damage_level = Math.max(0, currentDamage - 1);
  const npcName = context.npc?.name || 'Engineer';
  return ActionResult.success(
    `${npcName} completed repairs. Damage reduced to ${flags.damage_level}.`,
    { damageLevel: flags.damage_level }
  );
});

/**
 * Execute jump action - sets in_jump and jump_destination
 */
registerExecutor('execute-jump', (action, context) => {
  const flags = context.storyState?.flags;
  if (!flags) {
    return ActionResult.failure('No story state available');
  }

  const destination = action.params?.destination || 'unknown';
  flags.in_jump = true;
  flags.jump_destination = destination;

  return ActionResult.success(
    `Jump initiated to ${destination}. ETA: 1 week.`,
    { destination }
  );
});

/**
 * Send message action - queues a message for PC
 */
registerExecutor('send-message', (action, context) => {
  const targetPc = action.params?.targetPc;
  const message = action.params?.message || '';
  const npcName = context.npc?.name || 'NPC';

  return ActionResult.success(
    `Message from ${npcName} queued for delivery.`,
    { queued: true, targetPc, message }
  );
});

/**
 * Fire weapons action
 */
registerExecutor('fire-weapons', (action, context) => {
  const npcName = context.npc?.name || 'Gunner';
  return ActionResult.success(`${npcName} engaged weapons.`);
});

/**
 * Alert crew action
 */
registerExecutor('alert-crew', (action, context) => {
  const npcName = context.npc?.name || 'Crew member';
  return ActionResult.success(`${npcName} alerted the crew.`);
});

/**
 * Monitor sensors action
 */
registerExecutor('monitor-sensors', (action, context) => {
  const npcName = context.npc?.name || 'Crew member';
  return ActionResult.success(`${npcName} is monitoring sensors.`);
});

/**
 * Check systems action
 */
registerExecutor('check-systems', (action, context) => {
  const npcName = context.npc?.name || 'Engineer';
  return ActionResult.success(`${npcName} checked ship systems.`);
});

module.exports = {
  executeAction,
  registerExecutor,
  getExecutor,
  ActionResult
};
