/**
 * NPC Goals Module
 * Goal state tracking, triggers, and activation logic.
 *
 * Pattern: State Machine for goal lifecycle
 */

/**
 * Parse Traveller date (DDD-YYYY) to day-of-year and year
 * @param {string} dateStr - Date string (e.g., "015-1105")
 * @returns {{day: number, year: number}|null}
 */
function parseTravellerDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = dateStr.match(/^(\d{3})-(\d{4})$/);
  if (!match) return null;
  return {
    day: parseInt(match[1], 10),
    year: parseInt(match[2], 10)
  };
}

/**
 * Calculate hours between two Traveller dates
 * @param {string} dateA - Earlier date
 * @param {string} dateB - Later date
 * @returns {number} Hours between dates
 */
function hoursBetweenDates(dateA, dateB) {
  const a = parseTravellerDate(dateA);
  const b = parseTravellerDate(dateB);
  if (!a || !b) return 0;

  // Calculate total days for each
  const daysA = (a.year * 365) + a.day;
  const daysB = (b.year * 365) + b.day;

  return (daysB - daysA) * 24;
}

/**
 * Check if a goal's trigger condition is met
 * @param {Object} goal - Goal with optional trigger
 * @param {Object} state - Story state
 * @returns {boolean}
 */
function isGoalTriggered(goal, state) {
  if (!goal) return false;

  // No trigger means always active
  if (!goal.trigger) return true;

  if (!state) return false;

  const { trigger } = goal;

  // Flag trigger
  if (trigger.flag !== undefined) {
    const actualValue = state.flags?.[trigger.flag];

    // Handle comparison operators
    if (trigger.value && typeof trigger.value === 'object') {
      if (trigger.value.gt !== undefined) {
        return actualValue > trigger.value.gt;
      }
      if (trigger.value.gte !== undefined) {
        return actualValue >= trigger.value.gte;
      }
      if (trigger.value.lt !== undefined) {
        return actualValue < trigger.value.lt;
      }
      if (trigger.value.lte !== undefined) {
        return actualValue <= trigger.value.lte;
      }
      return false;
    }

    return actualValue === trigger.value;
  }

  // Beat trigger
  if (trigger.beat) {
    const completedBeats = state.completedBeats || [];
    return completedBeats.includes(trigger.beat);
  }

  return true;
}

/**
 * Get all currently active goals for an NPC
 * @param {Object} npc - NPC config with goals array
 * @param {Object} storyState - Current story state
 * @returns {Object[]} Array of active goals
 */
function getActiveGoals(npc, storyState) {
  if (!npc || !npc.goals) return [];

  const active = [];

  for (const goal of npc.goals) {
    // Skip completed goals
    if (goal.status === 'completed') continue;

    // Status = 'active' goals are always candidates
    if (goal.status === 'active') {
      active.push(goal);
      continue;
    }

    // Status = 'background' goals activate when triggered
    if (goal.status === 'background' && isGoalTriggered(goal, storyState)) {
      active.push(goal);
    }
  }

  return active;
}

/**
 * Sort goals by priority (lower number = higher priority)
 * @param {Object[]} goals - Array of goals
 * @returns {Object[]} Sorted goals
 */
function getGoalsByPriority(goals) {
  if (!goals || !Array.isArray(goals)) return [];

  return [...goals].sort((a, b) => {
    const priorityA = a.priority ?? 999;
    const priorityB = b.priority ?? 999;
    return priorityA - priorityB;
  });
}

/**
 * Check if NPC should act on a goal now
 * @param {Object} goal - Goal to check
 * @param {Object} state - Story state
 * @param {string} gameDate - Current game date (DDD-YYYY)
 * @returns {boolean}
 */
function shouldActOnGoal(goal, state, gameDate) {
  if (!goal) return false;

  // Completed goals cannot be acted on
  if (goal.status === 'completed') return false;

  // Check trigger
  if (!isGoalTriggered(goal, state || {})) return false;

  // Check cooldown
  if (goal.cooldown && goal.lastActed) {
    const cooldownHours = goal.cooldown.hours || (goal.cooldown.days ? goal.cooldown.days * 24 : 0);
    const elapsedHours = hoursBetweenDates(goal.lastActed, gameDate);
    if (elapsedHours < cooldownHours) {
      return false;
    }
  }

  return true;
}

/**
 * Get actions associated with a goal
 * @param {Object} goal - Goal object
 * @returns {string[]} Array of action IDs
 */
function getGoalActions(goal) {
  if (!goal || !goal.actions) return [];
  return goal.actions;
}

/**
 * Update a goal's status
 * @param {Object} npc - NPC object (modified in place)
 * @param {string} goalId - Goal ID to update
 * @param {string} status - New status
 * @param {string} [gameDate] - Optional game date for lastActed
 */
function updateGoalStatus(npc, goalId, status, gameDate) {
  if (!npc || !npc.goals) return;

  const goal = npc.goals.find(g => g.id === goalId);
  if (!goal) return;

  goal.status = status;
  if (gameDate) {
    goal.lastActed = gameDate;
  }
}

module.exports = {
  getActiveGoals,
  getGoalsByPriority,
  isGoalTriggered,
  shouldActOnGoal,
  getGoalActions,
  updateGoalStatus
};
