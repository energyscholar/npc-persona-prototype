/**
 * Timed Actions Module
 * Duration-based action progress tracking.
 *
 * Pattern: Time-based State Machine
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '../data/state/timed-actions.json');

// In-memory action tracking
let activeActions = [];

/**
 * Calculate Traveller date after adding hours
 * @param {string} startDate - Start date (DDD-YYYY)
 * @param {number} hours - Hours to add
 * @returns {string} New date
 */
function addHoursToDate(startDate, hours) {
  if (!startDate) return null;

  const match = startDate.match(/^(\d{3})-(\d{4})$/);
  if (!match) return startDate;

  let day = parseInt(match[1], 10);
  let year = parseInt(match[2], 10);

  // Add days (24 hours = 1 day)
  const daysToAdd = Math.floor(hours / 24);
  day += daysToAdd;

  // Handle year rollover
  while (day > 365) {
    day -= 365;
    year++;
  }

  return `${String(day).padStart(3, '0')}-${year}`;
}

/**
 * Start a new timed action
 * @param {Object} actionDef - Action definition
 * @param {string} gameDate - Current game date
 * @returns {Object|null} Started action or null
 */
function startTimedAction(actionDef, gameDate) {
  if (!actionDef || !actionDef.id) return null;

  // Calculate duration in hours
  let durationHours = 0;
  if (actionDef.duration) {
    if (actionDef.duration.hours) {
      durationHours = actionDef.duration.hours;
    }
    if (actionDef.duration.days) {
      durationHours += actionDef.duration.days * 24;
    }
  }

  const action = {
    id: actionDef.id,
    npcId: actionDef.npcId,
    startedAt: gameDate || new Date().toISOString(),
    completesAt: addHoursToDate(gameDate, durationHours),
    hoursRemaining: durationHours,
    hoursElapsed: 0,
    durationHours: durationHours,
    effects: actionDef.effects || [],
    status: 'active'
  };

  activeActions.push(action);
  return action;
}

/**
 * Process all timed actions
 * @param {Object} storyState - Story state to modify on completion
 * @param {number} hoursElapsed - Hours that have passed
 * @returns {Object[]} Results of completed actions
 */
function processTimedActions(storyState, hoursElapsed) {
  const results = [];

  for (const action of activeActions) {
    if (action.status !== 'active') continue;

    action.hoursElapsed = (action.hoursElapsed || 0) + hoursElapsed;
    action.hoursRemaining = Math.max(0, action.durationHours - action.hoursElapsed);

    // Check completion
    if (action.hoursRemaining <= 0) {
      action.status = 'completed';

      // Apply effects
      if (storyState && storyState.flags && Array.isArray(action.effects)) {
        for (const effect of action.effects) {
          applyEffect(effect, storyState);
        }
      }

      results.push({
        id: action.id,
        npcId: action.npcId,
        status: 'completed',
        message: `Action ${action.id} completed`
      });
    }
  }

  // Remove completed actions from active list
  activeActions = activeActions.filter(a => a.status === 'active');

  return results;
}

/**
 * Apply an effect to story state
 * @param {Object} effect - Effect definition
 * @param {Object} storyState - Story state to modify
 */
function applyEffect(effect, storyState) {
  if (!effect || !storyState || !storyState.flags) return;

  const { type, flag, operation, amount, value } = effect;

  if (type === 'modify-flag') {
    switch (operation) {
      case 'set':
        storyState.flags[flag] = value;
        break;
      case 'increment':
        storyState.flags[flag] = (storyState.flags[flag] || 0) + (amount || 1);
        break;
      case 'decrement':
        storyState.flags[flag] = (storyState.flags[flag] || 0) - (amount || 1);
        break;
    }
  }
}

/**
 * Get active timed actions
 * @param {string} [npcId] - Optional NPC filter
 * @returns {Object[]} Active actions
 */
function getActiveTimedActions(npcId) {
  if (!npcId) {
    return activeActions.filter(a => a.status === 'active');
  }
  return activeActions.filter(a => a.status === 'active' && a.npcId === npcId);
}

/**
 * Cancel a timed action
 * @param {string} actionId - Action to cancel
 * @returns {Object|null} Cancelled action or null
 */
function cancelTimedAction(actionId) {
  if (!actionId) return null;

  const index = activeActions.findIndex(a => a.id === actionId);
  if (index === -1) return null;

  const action = activeActions[index];
  action.status = 'cancelled';
  activeActions.splice(index, 1);

  return action;
}

/**
 * Get progress for a specific action
 * @param {string} actionId - Action identifier
 * @returns {Object|null} Progress info or null
 */
function getActionProgress(actionId) {
  if (!actionId) return null;

  const action = activeActions.find(a => a.id === actionId);
  if (!action) return null;

  const percentComplete = action.durationHours > 0
    ? Math.min(100, Math.round((action.hoursElapsed / action.durationHours) * 100))
    : 100;

  return {
    id: action.id,
    npcId: action.npcId,
    hoursElapsed: action.hoursElapsed || 0,
    hoursRemaining: action.hoursRemaining || 0,
    percentComplete: percentComplete,
    status: action.status
  };
}

/**
 * Check if an action is complete
 * @param {string} actionId - Action identifier
 * @returns {boolean}
 */
function isActionComplete(actionId) {
  if (!actionId) return false;

  const action = activeActions.find(a => a.id === actionId);
  if (!action) return false;

  return action.status === 'completed';
}

/**
 * Load timed action state from storage
 * @returns {Object} State object
 */
function loadTimedActionState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      const state = JSON.parse(data);
      activeActions = state.actions || [];
      return state;
    }
  } catch (e) {
    // Graceful degradation
  }
  return { actions: [] };
}

/**
 * Save timed action state to storage
 * @param {Object} state - State to save
 */
function saveTimedActionState(state) {
  try {
    // Ensure directory exists
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const toSave = state || { actions: activeActions };
    fs.writeFileSync(STATE_FILE, JSON.stringify(toSave, null, 2));

    // Also update in-memory state if provided
    if (state && state.actions) {
      activeActions = state.actions;
    }
  } catch (e) {
    // Graceful degradation
  }
}

module.exports = {
  startTimedAction,
  processTimedActions,
  getActiveTimedActions,
  cancelTimedAction,
  getActionProgress,
  isActionComplete,
  loadTimedActionState,
  saveTimedActionState
};
