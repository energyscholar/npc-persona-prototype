/**
 * NPC Capabilities Module
 * Role-based capability system for NPC actions.
 *
 * Pattern: Registry + Role-Based Access Control
 */

/**
 * Role to capability mapping
 * Each role has a set of base capabilities that NPCs with that role can perform.
 */
const ROLE_CAPABILITIES = {
  captain: ['can_command', 'can_navigate'],
  pilot: ['can_navigate', 'can_dock'],
  astrogator: ['can_navigate', 'can_plot_jump'],
  engineer: ['can_repair', 'can_refuel'],
  gunner: ['can_fire', 'can_target'],
  medic: ['can_heal'],
  patron: ['can_message', 'can_hire'],
  narrator: ['can_narrate', 'can_advance_time']
};

// Action definition registry
const actionRegistry = {};

/**
 * Get all capabilities for an NPC
 * @param {Object} npcConfig - NPC configuration
 * @returns {string[]} Array of capabilities
 */
function getCapabilities(npcConfig) {
  if (!npcConfig) return [];

  const capabilities = new Set();

  // Add role capabilities
  const role = npcConfig.role;
  if (role && ROLE_CAPABILITIES[role]) {
    for (const cap of ROLE_CAPABILITIES[role]) {
      capabilities.add(cap);
    }
  }

  // Add custom capabilities
  if (Array.isArray(npcConfig.capabilities)) {
    for (const cap of npcConfig.capabilities) {
      capabilities.add(cap);
    }
  }

  return Array.from(capabilities);
}

/**
 * Check if NPC has a specific capability
 * @param {Object} npcConfig - NPC configuration
 * @param {string} capability - Capability to check
 * @returns {boolean}
 */
function hasCapability(npcConfig, capability) {
  if (!npcConfig || !capability) return false;
  const caps = getCapabilities(npcConfig);
  return caps.includes(capability);
}

/**
 * Register an action definition
 * @param {string} actionId - Action identifier
 * @param {Object} definition - Action definition
 */
function registerActionDefinition(actionId, definition) {
  if (!actionId) return;
  actionRegistry[actionId] = definition;
}

/**
 * Get an action definition
 * @param {string} actionId - Action identifier
 * @returns {Object|null} Action definition or null
 */
function getActionDefinition(actionId) {
  if (!actionId) return null;
  return actionRegistry[actionId] || null;
}

/**
 * Check if NPC can perform a specific action
 * @param {Object} npcConfig - NPC configuration
 * @param {string} actionId - Action identifier
 * @returns {boolean}
 */
function canPerformAction(npcConfig, actionId) {
  if (!npcConfig || !actionId) return false;

  const action = getActionDefinition(actionId);
  if (!action) return false;

  const requiredCaps = action.requiredCapabilities || [];
  if (requiredCaps.length === 0) return true;

  const npcCaps = getCapabilities(npcConfig);
  return requiredCaps.every(cap => npcCaps.includes(cap));
}

module.exports = {
  ROLE_CAPABILITIES,
  getCapabilities,
  hasCapability,
  registerActionDefinition,
  getActionDefinition,
  canPerformAction
};
