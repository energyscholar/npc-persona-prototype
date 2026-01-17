/**
 * NPC-Initiated Triggers Module
 * Evaluates and fires triggers based on story state.
 *
 * Pattern: Observer (future) - react to story state changes
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TRIGGER_STATE_FILE = path.join(__dirname, '../data/state/trigger-state.json');

/**
 * Load trigger state from file
 * @returns {Object} { fired: {}, scheduled: [] }
 */
function loadTriggerState() {
  try {
    if (fs.existsSync(TRIGGER_STATE_FILE)) {
      const data = fs.readFileSync(TRIGGER_STATE_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (!parsed.fired) parsed.fired = {};
      if (!parsed.scheduled) parsed.scheduled = [];
      return parsed;
    }
  } catch (e) {
    // Return empty state on error
  }
  return { fired: {}, scheduled: [] };
}

/**
 * Save trigger state to file
 * @param {Object} state - Trigger state
 */
function saveTriggerState(state) {
  const dir = path.dirname(TRIGGER_STATE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(TRIGGER_STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Check if trigger has already fired
 * @param {string} triggerId
 * @param {Object} triggerState
 * @returns {boolean}
 */
function hasTriggerFired(triggerId, triggerState) {
  return triggerState.fired && triggerState.fired[triggerId] === true;
}

/**
 * Mark trigger as fired
 * @param {string} triggerId
 * @param {Object} triggerState - Modified in place
 */
function markTriggerFired(triggerId, triggerState) {
  if (!triggerState.fired) triggerState.fired = {};
  triggerState.fired[triggerId] = true;
}

/**
 * Parse Traveller date string to day number
 * Format: "DDD-YYYY" where DDD is day of year (001-365)
 * @param {string} dateStr
 * @returns {number} Total days since year 0
 */
function parseTravellerDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const match = dateStr.match(/(\d{3})-(\d{4})/);
  if (!match) return 0;
  const day = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);
  return year * 365 + day;
}

/**
 * Check if required conditions are met
 * @param {string[]} requires - Array of beat requirements (prefix ! for negation)
 * @param {string[]} completedBeats
 * @returns {{ met: boolean, reason: string }}
 */
function checkRequires(requires, completedBeats) {
  if (!requires || requires.length === 0) {
    return { met: true, reason: '' };
  }

  for (const req of requires) {
    if (req.startsWith('!')) {
      // Negated requirement - beat must NOT be complete
      const beatId = req.slice(1);
      if (completedBeats.includes(beatId)) {
        return { met: false, reason: `Required beat '${beatId}' already complete` };
      }
    } else {
      // Positive requirement - beat must be complete
      if (!completedBeats.includes(req)) {
        return { met: false, reason: `Required beat '${req}' not complete` };
      }
    }
  }

  return { met: true, reason: '' };
}

/**
 * Evaluate a single trigger
 * @param {Object} trigger - Trigger definition
 * @param {Object} storyState - Current story state
 * @param {Object} triggerState - Fired trigger state
 * @returns {Object} { shouldFire, reason }
 */
function evaluateTrigger(trigger, storyState, triggerState) {
  // Check once flag
  if (trigger.once && hasTriggerFired(trigger.id, triggerState)) {
    return { shouldFire: false, reason: 'Already fired (once)' };
  }

  // Check requires conditions
  const completedBeats = storyState.completedBeats || [];
  const reqCheck = checkRequires(trigger.requires, completedBeats);
  if (!reqCheck.met) {
    return { shouldFire: false, reason: reqCheck.reason };
  }

  // Evaluate by type
  switch (trigger.type) {
    case 'beat': {
      const beatId = trigger.condition?.beat;
      if (!beatId) {
        return { shouldFire: false, reason: 'No beat specified' };
      }
      if (completedBeats.includes(beatId)) {
        return { shouldFire: true, reason: `Beat '${beatId}' complete` };
      }
      return { shouldFire: false, reason: `Beat '${beatId}' not complete` };
    }

    case 'time': {
      const daysAfterBeat = trigger.condition?.daysAfterBeat;
      const days = trigger.condition?.days || 0;

      if (!daysAfterBeat) {
        return { shouldFire: false, reason: 'No reference beat specified' };
      }

      if (!completedBeats.includes(daysAfterBeat)) {
        return { shouldFire: false, reason: `Reference beat '${daysAfterBeat}' not complete` };
      }

      // Check time elapsed
      const beatTimestamp = storyState.beatTimestamps?.[daysAfterBeat];
      const currentDate = storyState.gameDate;

      if (!beatTimestamp || !currentDate) {
        return { shouldFire: false, reason: 'Missing date information' };
      }

      const beatDay = parseTravellerDate(beatTimestamp);
      const currentDay = parseTravellerDate(currentDate);
      const elapsed = currentDay - beatDay;

      if (elapsed >= days) {
        return { shouldFire: true, reason: `${elapsed} days elapsed (required: ${days})` };
      }
      return { shouldFire: false, reason: `Only ${elapsed} days elapsed (required: ${days})` };
    }

    case 'flag': {
      const flagName = trigger.condition?.flag;
      const flagValue = trigger.condition?.value;

      if (!flagName) {
        return { shouldFire: false, reason: 'No flag specified' };
      }

      const currentValue = storyState.flags?.[flagName];
      if (currentValue === flagValue) {
        return { shouldFire: true, reason: `Flag '${flagName}' matches '${flagValue}'` };
      }
      return { shouldFire: false, reason: `Flag '${flagName}' is '${currentValue}', expected '${flagValue}'` };
    }

    default:
      return { shouldFire: false, reason: `Unknown trigger type: ${trigger.type}` };
  }
}

/**
 * Create NPC-initiated message from trigger
 * @param {string} npcId
 * @param {string} pcId
 * @param {Object} trigger
 * @returns {Object} Message object
 */
function createNpcInitiatedMessage(npcId, pcId, trigger) {
  return {
    id: crypto.randomUUID(),
    from: npcId,
    to: pcId,
    subject: trigger.message?.subject || 'Message',
    body: trigger.message?.body || trigger.message?.template || '',
    type: 'npc-initiated',
    triggerId: trigger.id,
    timestamp: new Date().toISOString()
  };
}

/**
 * Process all triggers for all NPCs
 * @param {Object} storyState - Current story state
 * @param {string} gameDate - Current game date
 * @param {Object[]} allNpcs - Array of NPC configs
 * @returns {Object[]} Array of messages to send
 */
function processAllTriggers(storyState, gameDate, allNpcs) {
  const messages = [];
  const triggerState = loadTriggerState();

  // Ensure storyState has gameDate
  const state = { ...storyState, gameDate };

  for (const npc of allNpcs) {
    if (!npc.triggers || !Array.isArray(npc.triggers)) {
      continue;
    }

    for (const trigger of npc.triggers) {
      const result = evaluateTrigger(trigger, state, triggerState);

      if (result.shouldFire) {
        // Create message for each target PC (or broadcast)
        const targetPcs = trigger.targetPcs || ['broadcast'];
        for (const pcId of targetPcs) {
          const message = createNpcInitiatedMessage(npc.id, pcId, trigger);
          messages.push(message);
        }

        // Mark as fired if once
        if (trigger.once) {
          markTriggerFired(trigger.id, triggerState);
        }
      }
    }
  }

  // Save updated trigger state
  saveTriggerState(triggerState);

  return messages;
}

module.exports = {
  TRIGGER_STATE_FILE,
  loadTriggerState,
  saveTriggerState,
  evaluateTrigger,
  processAllTriggers,
  markTriggerFired,
  hasTriggerFired,
  createNpcInitiatedMessage
};
