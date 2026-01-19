/**
 * Campaign Contexts - Location-aware context presets
 *
 * Provides context options based on NPC location:
 * - Shipboard (amishi) NPCs get shipboard contexts
 * - External NPCs get planet-side contexts
 * - NPCs without location use default contexts
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data/npcs');

/**
 * Shipboard contexts for NPCs on the Amishi
 */
const SHIPBOARD_CONTEXTS = {
  'on-duty': {
    key: '1',
    label: 'On Duty (at station)',
    description: 'NPC is at their duty station during normal operations',
    promptModifier: 'You are currently on duty at your station. Professional demeanor, focused on your responsibilities.'
  },
  'off-duty': {
    key: '2',
    label: 'Off Duty (mess hall/rec)',
    description: 'NPC is relaxing in common areas',
    promptModifier: 'You are off duty, relaxing. More casual, willing to chat, might share personal thoughts.'
  },
  'combat-stations': {
    key: '3',
    label: 'Combat Stations (Red Alert)',
    description: 'Ship is at battle stations',
    promptModifier: 'COMBAT STATIONS. Terse, focused, adrenaline. No time for small talk. Report status, await orders.'
  },
  'private-quarters': {
    key: '4',
    label: 'Private (in quarters)',
    description: 'Private conversation in personal space',
    promptModifier: 'You are in your private quarters. Guard is down, can discuss personal matters, more vulnerable.'
  },
  'intercom': {
    key: '5',
    label: 'Intercom/Comms',
    description: 'Speaking over ship intercom',
    promptModifier: 'Speaking over intercom. Brief, functional, others may overhear. Use proper comm protocol.'
  }
};

/**
 * External contexts for planet-side NPCs
 */
const EXTERNAL_CONTEXTS = {
  'their-office': {
    key: '1',
    label: 'At Their Office',
    description: 'Meeting at their place of work',
    promptModifier: 'You are at your office/workplace. Professional setting, you have home advantage.'
  },
  'public-meeting': {
    key: '2',
    label: 'Public Meeting (bar/cafe)',
    description: 'Meeting in a public place',
    promptModifier: 'Meeting in a public place. Be aware of who might overhear. Neutral ground.'
  },
  'comms-from-ship': {
    key: '3',
    label: 'Comms Call from Amishi',
    description: 'Video/audio call from the ship',
    promptModifier: 'This is a comms call. Slight delay, formal, aware transmission could be intercepted.'
  },
  'dockside': {
    key: '4',
    label: 'Dockside Encounter',
    description: 'Meeting at the starport',
    promptModifier: 'Meeting at the starport docks. Busy, noisy, time pressure, ships coming and going.'
  }
};

/**
 * Default contexts (for NPCs without location field)
 */
const DEFAULT_CONTEXTS = {
  'neutral': {
    key: '1',
    label: 'Neutral',
    description: 'Standard interaction',
    promptModifier: 'Standard interaction, no special context.'
  },
  'formal': {
    key: '2',
    label: 'Formal Setting',
    description: 'Formal/official interaction',
    promptModifier: 'This is a formal setting. Professional demeanor expected.'
  },
  'casual': {
    key: '3',
    label: 'Casual Setting',
    description: 'Relaxed, informal interaction',
    promptModifier: 'Casual setting. Relaxed, friendly atmosphere.'
  }
};

/**
 * Campaign-specific context definitions
 * Structure: CAMPAIGN_CONTEXTS[campaignId][location] = contexts
 */
const CAMPAIGN_CONTEXTS = {
  'tuesday-spinward-marches': {
    'amishi': SHIPBOARD_CONTEXTS,
    'external': EXTERNAL_CONTEXTS
  }
};

/**
 * Get appropriate contexts for an NPC based on their location and campaign
 * @param {string} npcId - NPC identifier
 * @param {string} [campaignId] - Campaign identifier (optional)
 * @returns {Object} Context definitions for the NPC
 */
function getContextsForNpc(npcId, campaignId = null) {
  if (!npcId) return DEFAULT_CONTEXTS;

  try {
    const filePath = path.join(DATA_DIR, `${npcId}.json`);
    if (!fs.existsSync(filePath)) return DEFAULT_CONTEXTS;

    const content = fs.readFileSync(filePath, 'utf8');
    const persona = JSON.parse(content);

    // Use persona's campaign if not specified
    const campaign = campaignId || persona.campaign;

    // Check if campaign has specific contexts
    if (campaign && CAMPAIGN_CONTEXTS[campaign]) {
      const campaignContexts = CAMPAIGN_CONTEXTS[campaign];

      if (persona.location && campaignContexts[persona.location]) {
        return campaignContexts[persona.location];
      }
    }

    // Fallback: direct location check for backwards compatibility
    if (persona.location === 'amishi') {
      return SHIPBOARD_CONTEXTS;
    } else if (persona.location === 'external') {
      return EXTERNAL_CONTEXTS;
    }

    return DEFAULT_CONTEXTS;
  } catch {
    return DEFAULT_CONTEXTS;
  }
}

/**
 * Convert contexts object to menu options array
 * @param {Object} contexts - Context definitions
 * @returns {Object[]} Array of menu options with key, label, id
 */
function contextsToMenuOptions(contexts) {
  return Object.entries(contexts).map(([id, ctx]) => ({
    key: ctx.key,
    label: ctx.label,
    id,
    description: ctx.description,
    promptModifier: ctx.promptModifier
  }));
}

module.exports = {
  SHIPBOARD_CONTEXTS,
  EXTERNAL_CONTEXTS,
  DEFAULT_CONTEXTS,
  CAMPAIGN_CONTEXTS,
  getContextsForNpc,
  contextsToMenuOptions
};
