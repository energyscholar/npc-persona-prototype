/**
 * NPC Test Mode - Test NPC communication in various contexts
 *
 * Pattern: State machine with context configuration
 * Allows testing NPC behavior across channels, contexts, and flag states
 */

const { listPersonas, listPersonasByCampaign, loadPersona, getPersonaSummary } = require('./persona');
const { getContextsForNpc, contextsToMenuOptions, DEFAULT_CONTEXTS } = require('./campaign-contexts');
const { loadPC, listPCs } = require('./pc-roster');
const { createMemory, addMessage, serialize, deserialize } = require('./memory');
const { assembleFullPrompt } = require('./prompts');
const { getDisposition, updateDisposition } = require('./disposition');
const {
  displayPickerMenu,
  displayFlagMenu,
  displayTestModeStatus,
  displayContactHistory,
  promptInput
} = require('./tui-menu');
const {
  loadContactHistory,
  saveContactHistory,
  addSession,
  clearHistory
} = require('./contact-history');

/**
 * Communication channels with behavior modifiers
 */
const CHANNELS = {
  'in-person': {
    key: '1',
    label: 'In-Person',
    behavior: 'Full dialogue, body language cues, can negotiate',
    promptModifier: 'You are speaking in person. You can observe body language and use full natural dialogue.'
  },
  'radio': {
    key: '2',
    label: 'Radio/Comm Link',
    behavior: 'Brief, urgent, protocol phrases, background noise',
    promptModifier: 'You are speaking over radio. Be brief and use protocol phrases. Background static or noise may be present.'
  },
  'email': {
    key: '3',
    label: 'Email/Text Message',
    behavior: 'Formal, delayed feel, references attachments',
    promptModifier: 'This is written communication (email/text). Be more formal. You cannot observe reactions in real-time.'
  },
  'telephone': {
    key: '4',
    label: 'Telephone/Voice Call',
    behavior: 'Conversational but no visuals, can be interrupted',
    promptModifier: 'You are on a voice call. You cannot see the other person. The call could be interrupted.'
  },
  'intercom': {
    key: '5',
    label: 'Intercom',
    behavior: 'Terse, task-focused, ship/building context',
    promptModifier: 'You are speaking over an intercom system. Be terse and task-focused. Background activity may be audible.'
  }
};

/**
 * Context presets for different scenes/situations
 */
const CONTEXT_PRESETS = {
  'first-meeting': {
    key: '1',
    label: 'First Meeting (no prior contact)',
    description: 'Initial introduction, no shared history',
    flags: {},
    disposition: 0
  },
  'after-survey-accepted': {
    key: '2',
    label: 'After Survey Accepted',
    description: 'Player has agreed to do the survey job',
    flags: { survey_accepted: true },
    disposition: 1
  },
  'during-crisis': {
    key: '3',
    label: 'During Crisis (eruption active)',
    description: 'Volcano is erupting, emergency situation',
    flags: { survey_accepted: true, eruption_started: true },
    disposition: 0
  },
  'after-rescue-grateful': {
    key: '4',
    label: 'After Rescue (grateful)',
    description: 'Player successfully completed rescue',
    flags: { survey_accepted: true, eruption_started: true, rescue_complete: true },
    disposition: 2
  },
  'after-rescue-disappointed': {
    key: '5',
    label: 'After Rescue (disappointed)',
    description: 'Rescue had poor outcome',
    flags: { survey_accepted: true, eruption_started: true, rescue_failed: true },
    disposition: -1
  },
  'custom': {
    key: '6',
    label: 'Custom Context...',
    description: 'Set your own flags and disposition',
    flags: {},
    disposition: 0
  }
};

/**
 * Available story flags for testing
 */
const AVAILABLE_FLAGS = [
  'survey_accepted',
  'survey_complete',
  'eruption_started',
  'ship_found',
  'tensher_befriended',
  'rescue_complete',
  'rescue_failed',
  'barvinn_saved',
  'vargr_saved'
];

/**
 * Create test mode state
 * @param {Object} npc - NPC persona
 * @param {Object} pc - Player character
 * @returns {Object} Test mode state
 */
function createTestState(npc, pc) {
  return {
    npc,
    pc,
    channel: 'in-person',
    context: 'first-meeting',
    flags: {},
    disposition: 0,
    memory: createMemory(),
    turnCount: 0
  };
}

/**
 * Build test mode system prompt with context modifiers
 * @param {Object} state - Test mode state
 * @returns {string} Modified system prompt
 */
function buildTestModePrompt(state) {
  const channelInfo = CHANNELS[state.channel];
  const contextInfo = CONTEXT_PRESETS[state.context];

  let contextSection = `
=== TEST MODE CONTEXT ===
Communication Channel: ${channelInfo.label}
${channelInfo.promptModifier}

Scene Context: ${contextInfo?.description || 'Custom'}
Disposition toward PC: ${state.disposition} (${getDispositionLabel(state.disposition)})

Story Flags Active:
${Object.entries(state.flags).filter(([, v]) => v).map(([k]) => `- ${k}`).join('\n') || '- None'}

Adjust your behavior based on these factors:
- Channel affects communication style (${channelInfo.behavior})
- Flags affect what you know and can discuss
- Disposition affects your tone and helpfulness
`;

  return contextSection;
}

/**
 * Get disposition label from level
 * @param {number} level - Disposition level (-3 to +3)
 * @returns {string} Label
 */
function getDispositionLabel(level) {
  const labels = {
    '-3': 'hostile',
    '-2': 'unfriendly',
    '-1': 'wary',
    '0': 'neutral',
    '1': 'cooperative',
    '2': 'friendly',
    '3': 'loyal'
  };
  return labels[String(level)] || 'neutral';
}

/**
 * Parse test mode commands
 * @param {string} input - User input
 * @param {Object} state - Test mode state
 * @returns {Object} Command result { handled: boolean, response?: string, newState?: Object }
 */
function parseTestCommand(input, state) {
  const trimmed = input.trim().toLowerCase();

  // /context - Show current context
  if (trimmed === '/context') {
    const flagList = Object.entries(state.flags)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(', ') || 'none';

    return {
      handled: true,
      response: `
Current Test Context:
- NPC: ${state.npc.name}
- Channel: ${CHANNELS[state.channel].label}
- Context: ${CONTEXT_PRESETS[state.context]?.label || 'Custom'}
- Flags: ${flagList}
- Disposition: ${state.disposition} (${getDispositionLabel(state.disposition)})
- Turns: ${state.turnCount}
`
    };
  }

  // /flags - List all flags
  if (trimmed === '/flags') {
    const lines = ['Story Flags:'];
    for (const flag of AVAILABLE_FLAGS) {
      const checked = state.flags[flag] ? '[x]' : '[ ]';
      lines.push(`  ${checked} ${flag}`);
    }
    return { handled: true, response: lines.join('\n') };
  }

  // /flags +name - Set flag
  const setFlagMatch = trimmed.match(/^\/flags\s+\+(\w+)$/);
  if (setFlagMatch) {
    const flagName = setFlagMatch[1];
    const newFlags = { ...state.flags, [flagName]: true };
    return {
      handled: true,
      response: `Flag set: ${flagName} = true`,
      newState: { ...state, flags: newFlags }
    };
  }

  // /flags -name - Clear flag
  const clearFlagMatch = trimmed.match(/^\/flags\s+-(\w+)$/);
  if (clearFlagMatch) {
    const flagName = clearFlagMatch[1];
    const newFlags = { ...state.flags, [flagName]: false };
    return {
      handled: true,
      response: `Flag cleared: ${flagName} = false`,
      newState: { ...state, flags: newFlags }
    };
  }

  // /channel <type> - Switch channel
  const channelMatch = trimmed.match(/^\/channel\s+(\w+(?:-\w+)?)$/);
  if (channelMatch) {
    const channelKey = channelMatch[1].toLowerCase();
    if (CHANNELS[channelKey]) {
      return {
        handled: true,
        response: `Switching to ${CHANNELS[channelKey].label} channel...`,
        newState: { ...state, channel: channelKey }
      };
    }
    const validChannels = Object.keys(CHANNELS).join(', ');
    return {
      handled: true,
      response: `Unknown channel. Valid channels: ${validChannels}`
    };
  }

  // /disposition <n> - Set disposition
  const dispMatch = trimmed.match(/^\/disposition\s+(-?\d+)$/);
  if (dispMatch) {
    const level = Math.max(-3, Math.min(3, parseInt(dispMatch[1], 10)));
    return {
      handled: true,
      response: `Disposition set to ${level} (${getDispositionLabel(level)})`,
      newState: { ...state, disposition: level }
    };
  }

  // /clear - Clear conversation, keep context
  if (trimmed === '/clear') {
    return {
      handled: true,
      response: 'Conversation cleared. Context preserved.',
      newState: { ...state, memory: createMemory(), turnCount: 0 }
    };
  }

  // /reset - Full reset
  if (trimmed === '/reset') {
    return {
      handled: true,
      response: 'reset',
      action: 'reset'
    };
  }

  // /back or /b - Return to menu (also /quit, /q)
  if (trimmed === '/back' || trimmed === '/b' || trimmed === '/quit' || trimmed === '/q') {
    return {
      handled: true,
      response: 'back',
      action: 'back'
    };
  }

  // /help - Show commands
  if (trimmed === '/help') {
    return {
      handled: true,
      response: `
Test Mode Commands:
  /context        - Show current test context
  /flags          - List all story flags
  /flags +name    - Set flag to true
  /flags -name    - Set flag to false
  /channel <type> - Switch communication channel
  /disposition <n> - Set NPC disposition (-3 to +3)
  /clear          - Clear conversation, keep context
  /reset          - Return to context menu
  /back           - Return to NPC selection
  /help           - Show this help

Channels: in-person, radio, email, telephone, intercom
`
    };
  }

  return { handled: false };
}

/**
 * Get NPC options for picker menu
 * @param {string} world - World to filter by
 * @returns {Array} Menu options
 */
function getNpcOptions(world = 'Walston', campaignId = null) {
  // Use campaign filter if provided, otherwise filter by world
  const npcs = campaignId
    ? listPersonasByCampaign(campaignId)
    : listPersonas(world);

  return npcs
    .filter(id => !id.includes('narrator')) // Exclude narrator personas
    .map((id, idx) => {
      const summary = getPersonaSummary(id);
      return {
        key: String(idx + 1),
        label: `${summary?.name || id} - ${summary?.title || summary?.archetype || 'NPC'}`,
        id
      };
    });
}

/**
 * Get channel options for picker menu
 * @returns {Array} Menu options
 */
function getChannelOptions() {
  return Object.entries(CHANNELS).map(([id, channel]) => ({
    key: channel.key,
    label: channel.label,
    id
  }));
}

/**
 * Get context options for picker menu
 * @param {string} [npcId] - Optional NPC ID for location-aware contexts
 * @param {string} [campaignId] - Optional campaign ID
 * @returns {Array} Menu options
 */
function getContextOptions(npcId = null, campaignId = null) {
  // If NPC specified, try to get location-aware contexts
  if (npcId) {
    const contexts = getContextsForNpc(npcId, campaignId);
    // Only use location contexts if not default (i.e., NPC has a location)
    if (contexts !== DEFAULT_CONTEXTS) {
      return contextsToMenuOptions(contexts);
    }
  }

  // Fall back to story-beat presets for solo campaign or NPCs without location
  return Object.entries(CONTEXT_PRESETS).map(([id, preset]) => ({
    key: preset.key,
    label: preset.label,
    id
  }));
}

/**
 * Format NPC response for test mode display
 * @param {Object} state - Test mode state
 * @param {string} response - NPC response text
 * @returns {string} Formatted response
 */
function formatTestModeResponse(state, response) {
  const channelInfo = CHANNELS[state.channel];
  const mood = getDispositionLabel(state.disposition);

  return `[${state.npc.name.toUpperCase()} - ${mood}, ${channelInfo.label}]\n"${response}"`;
}

module.exports = {
  // Channel and context data
  CHANNELS,
  CONTEXT_PRESETS,
  AVAILABLE_FLAGS,

  // State management
  createTestState,
  buildTestModePrompt,
  getDispositionLabel,

  // Command parsing
  parseTestCommand,

  // Menu helpers
  getNpcOptions,
  getChannelOptions,
  getContextOptions,

  // Display
  formatTestModeResponse
};
