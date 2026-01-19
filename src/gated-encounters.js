/**
 * Gated Encounters System
 * Handles encounter triggers and outcomes based on prerequisites
 */

const { getIllegalItems, storeItem, confiscateItem } = require('./inventory');

// Default law level for encounters that don't specify
const DEFAULT_LAW_LEVEL = 8;

/**
 * Check if an encounter should trigger
 * @param {Object} session - Session object
 * @param {Object} encounter - Encounter definition
 * @param {Object} worldData - World data (law_level, etc.)
 * @returns {boolean} True if encounter should trigger
 */
function shouldTriggerEncounter(session, encounter, worldData) {
  const prereq = encounter.trigger?.prerequisite;

  // No prerequisites means always trigger
  if (!prereq) {
    return true;
  }

  // Check has_illegal_weapons prerequisite
  if (prereq.has_illegal_weapons) {
    const lawLevel = worldData?.law_level || DEFAULT_LAW_LEVEL;
    const illegalItems = getIllegalItems(session, lawLevel);
    if (illegalItems.length === 0) {
      return false;
    }
  }

  // Check has_flag prerequisite
  if (prereq.has_flag) {
    if (!session.storyState.flags?.[prereq.has_flag]) {
      return false;
    }
  }

  // Check lacks_flag prerequisite
  if (prereq.lacks_flag) {
    if (session.storyState.flags?.[prereq.lacks_flag]) {
      return false;
    }
  }

  return true;
}

/**
 * Apply an encounter outcome
 * @param {Object} session - Session object
 * @param {Object} encounter - Encounter definition
 * @param {string} outcomeName - Name of outcome to apply
 * @param {Object} worldData - World data (optional)
 */
function applyEncounterOutcome(session, encounter, outcomeName, worldData = {}) {
  const outcome = encounter.outcomes?.[outcomeName];
  if (!outcome) return;

  const lawLevel = worldData?.law_level || DEFAULT_LAW_LEVEL;

  // Apply flags
  if (outcome.flags) {
    session.storyState.flags = session.storyState.flags || {};
    for (const [flag, value] of Object.entries(outcome.flags)) {
      session.storyState.flags[flag] = value;
    }
  }

  // Store items (e.g., weapons checked at customs)
  if (outcome.store_items) {
    const { location, filter } = outcome.store_items;
    let itemsToStore = [];

    if (filter === 'illegal_weapons') {
      itemsToStore = getIllegalItems(session, lawLevel);
    }

    for (const item of itemsToStore) {
      storeItem(session, item.id, location);
    }
  }

  // Remove/confiscate items
  if (outcome.remove_items) {
    const { filter } = outcome.remove_items;
    let itemsToConfiscate = [];

    if (filter === 'illegal_weapons') {
      itemsToConfiscate = getIllegalItems(session, lawLevel);
    }

    for (const item of itemsToConfiscate) {
      confiscateItem(session, item.id);
    }
  }

  // Apply fine
  if (outcome.fine) {
    session.storyState.pendingFine = outcome.fine;
  }
}

module.exports = {
  shouldTriggerEncounter,
  applyEncounterOutcome
};
