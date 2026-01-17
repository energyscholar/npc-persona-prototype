/**
 * Prompt Extensions - Integration layer for gap features
 * Combines disposition, plot context, and world state into prompt extensions.
 *
 * ISOLATION: This module has NO side effects on prompts.js.
 * It returns strings that CAN be appended to system prompts.
 *
 * Pattern: Facade - single entry point hiding subsystem complexity
 */

const { getDisposition, getDispositionPromptModifier } = require('./disposition');
const { buildPlotContext } = require('./plot-context');
const { getSharedFacts, getMentionsAbout } = require('./world-state');
const { getWorldSummary } = require('./world-knowledge');
const { getItemsByRole, getRelevantChecks, getNpcTimingKnowledge } = require('./adventure-data');

/**
 * Build items awareness context for NPC
 * @param {Object} persona - NPC persona
 * @param {string} adventureId - Adventure identifier
 * @returns {string} Items context string
 */
function buildItemsContext(persona, adventureId) {
  if (!persona || !persona.id || !adventureId) return '';

  const items = getItemsByRole(persona.id, adventureId);
  if (!items || items.length === 0) return '';

  let context = '\n=== EQUIPMENT YOU KNOW ABOUT ===\n';
  for (const item of items) {
    if (item.data) {
      if (item.data.description) {
        context += `- ${item.path}: ${item.data.description}\n`;
      } else if (typeof item.data === 'object') {
        // Handle nested structures
        for (const [key, val] of Object.entries(item.data)) {
          if (typeof val === 'string') {
            context += `- ${key}: ${val}\n`;
          }
        }
      }
    }
  }
  return context;
}

/**
 * Build skill check awareness context for NPC
 * @param {Object} persona - NPC persona
 * @param {Object} storyState - Story state
 * @returns {string} Skill check context string
 */
function buildSkillCheckContext(persona, storyState) {
  if (!persona || !storyState || !storyState.currentScene || !storyState.adventure) return '';

  const checks = getRelevantChecks(storyState.currentScene, storyState.adventure);
  if (!checks || checks.length === 0) return '';

  // Only narrators and GMs should know difficulties
  if (persona.archetype !== 'narrator' && persona.id !== 'assistant-gm') return '';

  let context = '\n=== SKILL CHECKS THIS SCENE ===\n';
  for (const check of checks) {
    context += `- ${check.description || check.id}: ${check.skill} ${check.difficulty}\n`;
  }
  return context;
}

/**
 * Build timeline awareness context for NPC
 * @param {Object} persona - NPC persona
 * @param {Object} storyState - Story state
 * @returns {string} Timeline context string
 */
function buildTimelineContext(persona, storyState) {
  if (!persona || !persona.id || !storyState || !storyState.adventure) return '';

  const timing = getNpcTimingKnowledge(persona.id, storyState.adventure);
  if (!timing || !timing.knows || timing.knows.length === 0) return '';

  let context = '\n=== WHAT YOU KNOW ABOUT TIMING ===\n';
  for (const fact of timing.knows) {
    context += `- ${fact}\n`;
  }
  return context;
}

/**
 * Check if a condition is met
 * @param {string|string[]} requires - Condition(s) to check
 * @param {Object} storyState - Story state with flags
 * @param {Object} pc - PC data
 * @returns {boolean} Whether condition is met
 */
function checkCondition(requires, storyState, pc) {
  if (!requires) return true;

  const flags = storyState?.flags || {};
  const pcId = pc?.id;

  // Handle array of requirements (all must be met)
  if (Array.isArray(requires)) {
    return requires.every(req => checkSingleCondition(req, flags, pcId, storyState));
  }

  return checkSingleCondition(requires, flags, pcId, storyState);
}

/**
 * Check a single condition
 */
function checkSingleCondition(req, flags, pcId, storyState) {
  // Handle disposition checks like "disposition >= 0"
  if (req.includes('disposition')) {
    const match = req.match(/disposition\s*(>=|<=|>|<|==)\s*(-?\d+)/);
    if (match) {
      const op = match[1];
      const val = parseInt(match[2], 10);
      const disp = storyState?.disposition?.level || 0;
      switch (op) {
        case '>=': return disp >= val;
        case '<=': return disp <= val;
        case '>': return disp > val;
        case '<': return disp < val;
        case '==': return disp === val;
      }
    }
    return false;
  }

  // Simple flag check
  return flags[req] === true;
}

/**
 * Build conversation context from NPC config
 * @param {Object} persona - NPC persona with conversation_context
 * @param {Object} pc - PC data
 * @param {Object} storyState - Story state
 * @returns {string} Conversation context string
 */
function buildConversationContext(persona, pc, storyState) {
  const ctx = persona?.conversation_context;
  if (!ctx) return '';

  let context = '\n=== YOUR AGENDA ===\n';
  if (ctx.primary_agenda) {
    context += `Primary goal: ${ctx.primary_agenda}\n`;
  }
  if (ctx.secondary_agenda) {
    context += `Secondary goal: ${ctx.secondary_agenda}\n`;
  }

  // Check conditions
  if (ctx.conditions && Object.keys(ctx.conditions).length > 0) {
    context += '\n=== CONDITIONS ===\n';
    for (const [key, cond] of Object.entries(ctx.conditions)) {
      const met = checkCondition(cond.requires, storyState, pc);
      if (met) {
        context += `- ${key}: UNLOCKED\n`;
      } else {
        context += `- ${key}: REQUIRES: ${Array.isArray(cond.requires) ? cond.requires.join(' AND ') : cond.requires}\n`;
        if (cond.dialogue) {
          context += `  (Say: "${cond.dialogue}")\n`;
        }
      }
    }
  }

  // Leverage awareness
  if (ctx.leverage && Object.keys(ctx.leverage).length > 0) {
    context += '\n=== YOUR LEVERAGE ===\n';
    for (const [key, desc] of Object.entries(ctx.leverage)) {
      context += `- ${key}: ${desc}\n`;
    }
  }

  // Current state
  if (ctx.state_machine) {
    const currentState = getCurrentContextState(persona.id, pc?.id, storyState, ctx.state_machine);
    context += `\nCurrent relationship state: ${currentState}\n`;
  }

  return context;
}

/**
 * Get current conversation state based on story state
 */
function getCurrentContextState(npcId, pcId, storyState, stateMachine) {
  if (!stateMachine) return 'initial';

  const flags = storyState?.flags || {};

  // Check state transitions in order of priority
  if (flags.betrayed || flags[`${npcId}_betrayed`]) {
    return stateMachine.if_betrayed || 'hostile';
  }
  if (flags.eruption_started || flags.crisis_phase_active) {
    return stateMachine.during_crisis || stateMachine.initial;
  }
  if (flags.survey_accepted || flags[`${npcId}_agreement`]) {
    return stateMachine.after_agreement || 'cooperative';
  }

  return stateMachine.initial || 'neutral';
}

/**
 * Build communication mode context
 * @param {string} mode - Communication mode
 * @returns {string} Mode context string
 */
function buildCommunicationModeContext(mode) {
  const modes = {
    in_person: 'You are speaking face-to-face. Full conversation is possible.',
    radio: 'You are speaking via radio. Keep responses brief and clear. Use proper comm protocol.',
    email: 'This is written correspondence. Be formal. Reference attachments if relevant.',
    intercom: 'Ship intercom. Be brief and task-focused.'
  };
  if (!mode) return '';
  return '\n' + (modes[mode] || modes.in_person) + '\n';
}

/**
 * Build all extended context for NPC prompts
 * @param {Object} persona - NPC persona (must have .id)
 * @param {Object} pc - PC data (must have .id), or null
 * @param {Object} storyState - Story state, or null
 * @returns {string} Additional context to append to system prompt
 */
function buildExtendedContext(persona, pc, storyState) {
  // Handle null/undefined inputs gracefully
  if (!persona) {
    persona = {};
  }

  let extensions = '';

  // 1. Disposition context
  if (pc && persona.id && pc.id) {
    const disp = getDisposition(persona.id, pc.id);
    extensions += '\n' + getDispositionPromptModifier(disp.level);
  }

  // 2. Plot context (now with PC identity)
  if (storyState) {
    extensions += buildPlotContext(storyState, persona, pc);
  }

  // 3. World knowledge (UWP, description)
  if (persona.world) {
    const worldInfo = getWorldSummary(persona.world);
    if (worldInfo) {
      extensions += '\n=== CURRENT LOCATION ===\n';
      extensions += `World: ${worldInfo.name}\n`;
      if (worldInfo.uwp) {
        extensions += `UWP: ${worldInfo.uwp}\n`;
      }
      if (worldInfo.description) {
        extensions += `${worldInfo.description}\n`;
      }
      extensions += `\nYou know these facts from living/visiting here.\n`;
    }
  }

  // 4. World state context
  if (storyState && persona.id) {
    const facts = getSharedFacts(persona.id, storyState.adventure);
    if (facts.length > 0) {
      extensions += '\nWORLD FACTS YOU KNOW:\n';
      for (const fact of facts) {
        extensions += `- ${fact.content}\n`;
      }
    }

    if (pc && pc.id) {
      const mentions = getMentionsAbout(persona.id, pc.id);
      if (mentions.length > 0) {
        extensions += `\nThis person has been told about you by: ${mentions.map(m => m.from).join(', ')}\n`;
      }
    }
  }

  // 5. Timeline awareness (NEW)
  if (storyState) {
    extensions += buildTimelineContext(persona, storyState);
  }

  // 6. Items awareness (NEW)
  if (storyState && storyState.adventure) {
    extensions += buildItemsContext(persona, storyState.adventure);
  }

  // 7. Skill check context for narrators (NEW)
  if (storyState) {
    extensions += buildSkillCheckContext(persona, storyState);
  }

  // 8. Conversation context - agenda, conditions, leverage (NEW)
  extensions += buildConversationContext(persona, pc, storyState);

  return extensions;
}

module.exports = {
  buildExtendedContext,
  buildItemsContext,
  buildSkillCheckContext,
  buildTimelineContext,
  buildConversationContext,
  buildCommunicationModeContext,
  checkCondition
};
