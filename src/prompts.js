/**
 * Prompt Templates for NPC Personas
 *
 * Builds prompts for Claude API:
 * - System prompt from persona + archetype
 * - Context injection (facts, summary)
 * - Token estimation and limits
 * - Input sanitization
 */

const { getContextWindow } = require('./memory');
const { buildExtendedContext } = require('./prompt-extensions');
const { buildSceneContext } = require('./knowledge-extraction/context-injector');

// Configuration
const MAX_CONTEXT_TOKENS = 4000;
const MAX_INPUT_LENGTH = 2000;

/**
 * Build system prompt from persona
 * @param {Object} persona - Loaded persona with archetype defaults
 * @returns {string} System prompt
 */
function buildSystemPrompt(persona, options = {}) {
  const archetype = persona._archetypeDefaults || {};
  const personality = persona.personality || {};

  let prompt = `You are ${persona.name}`;

  if (persona.title) {
    prompt += `, ${persona.title}`;
  }

  prompt += ` based on ${persona.world}.\n\n`;

  // Add archetype base behavior
  if (archetype.systemPrompt) {
    prompt += archetype.systemPrompt + '\n\n';
  }

  // Add personality traits
  if (personality.traits && personality.traits.length > 0) {
    prompt += `Your personality: ${personality.traits.join(', ')}.\n`;
  }

  // Add speech style
  if (personality.speech) {
    prompt += `Your speaking style: ${personality.speech}.\n`;
  }

  // Add quirks
  if (personality.quirks && personality.quirks.length > 0) {
    prompt += `Your quirks: ${personality.quirks.join('; ')}.\n`;
  }

  // Add background
  if (persona.background) {
    prompt += `\nBackground: ${persona.background}\n`;
  }

  // Add knowledge base (specialized expertise)
  if (persona.knowledge_base && Object.keys(persona.knowledge_base).length > 0) {
    prompt += `\nYOUR SPECIALIZED KNOWLEDGE:\n`;
    for (const [topic, content] of Object.entries(persona.knowledge_base)) {
      prompt += `\n[${topic.replace(/_/g, ' ').toUpperCase()}]\n${content}\n`;
    }
  }

  // Add response guidelines
  prompt += `
IMPORTANT GUIDELINES:
- Stay in character at all times
- Respond as ${persona.name} would, not as an AI
- Keep responses conversational and natural
- Reference past interactions when relevant
- Your knowledge is limited to what ${persona.name} would know
`;

  // NEW: Inject AGM context if provided
  if (options.agmContext) {
    prompt += `\n${options.agmContext}\n`;
  }

  // Inject active goals from persona
  if (persona.goals && persona.goals.length > 0) {
    const activeGoals = persona.goals.filter(g => g.status === 'active');
    if (activeGoals.length > 0) {
      // Sort by priority (highest first)
      activeGoals.sort((a, b) => b.priority - a.priority);
      prompt += `\n=== YOUR CURRENT GOALS ===\n`;
      for (const goal of activeGoals.slice(0, 3)) {
        prompt += `- ${goal.description} (priority: ${goal.priority}/10)\n`;
        if (goal.behavior_when_active) {
          prompt += `  Approach: ${goal.behavior_when_active.join('; ')}\n`;
        }
      }
    }
  }

  // NEW: Inject goal priorities (legacy/runtime priorities)
  if (options.goalPriorities?.length > 0) {
    prompt += `\n=== YOUR PRIORITIES NOW ===\n`;
    for (const p of options.goalPriorities) {
      prompt += `- ${p}\n`;
    }
  }

  return prompt;
}

/**
 * Build PC context for NPC awareness
 * @param {Object} pc - PC data object
 * @returns {string} PC context text
 */
function buildPCContext(pc) {
  if (!pc) return '';

  let context = `\nYOU ARE SPEAKING WITH:\n`;
  context += `Name: ${pc.name}\n`;

  if (pc.species) {
    context += `Species: ${pc.species}\n`;
  }

  if (pc.appearance) {
    context += `Appearance: ${pc.appearance}\n`;
  }

  if (pc.background) {
    context += `Background (what you might observe/know): ${pc.background}\n`;
  }

  if (pc.traits && pc.traits.length > 0) {
    context += `Demeanor: ${pc.traits.join(', ')}\n`;
  }

  if (pc.social_standing) {
    const socDesc = pc.social_standing >= 10 ? 'noble bearing' :
                    pc.social_standing >= 8 ? 'professional, respectable' :
                    pc.social_standing >= 6 ? 'ordinary citizen' :
                    pc.social_standing >= 4 ? 'working class' : 'rough around the edges';
    context += `Social impression: ${socDesc}\n`;
  }

  // Special handling for Vargr on Walston
  if (pc.species === 'Vargr') {
    context += `\nNOTE: On Walston, Vargr face social limitations. Adjust your responses accordingly based on local attitudes.\n`;
  }

  return context;
}

/**
 * Build context section from memory
 * @param {Object} memory - Memory object
 * @returns {string} Context text to inject into system prompt
 */
function buildContextSection(memory) {
  const context = getContextWindow(memory);
  let sections = [];

  // Add relationship metadata
  if (memory.totalInteractions > 0) {
    sections.push(`[You have interacted with this person ${memory.totalInteractions} times]`);
    if (memory.firstContact) {
      sections.push(`[First contact: ${memory.firstContact}]`);
    }
  }

  // Add facts
  if (context.factsText) {
    sections.push(`\nWHAT YOU KNOW ABOUT THIS PERSON:\n${context.factsText}`);
  }

  // Add history summary
  if (context.summaryText) {
    sections.push(`\nPREVIOUS HISTORY:\n${context.summaryText}`);
  }

  return sections.join('\n');
}

/**
 * Assemble full prompt for Claude API
 * @param {Object} persona - Loaded persona
 * @param {Object} memory - Memory object
 * @param {string} userMessage - New user message
 * @param {Object} [pc] - Optional PC data for NPC awareness
 * @param {Object} [storyState] - Optional story state for extended context
 * @returns {Object} { system: string, messages: Array }
 */
function assembleFullPrompt(persona, memory, userMessage, pc = null, storyState = null, options = {}) {
  // Build system prompt with context injected
  let system = buildSystemPrompt(persona, options);

  // Add PC context if provided
  if (pc) {
    system += buildPCContext(pc);
  }

  // Add extended context (disposition, plot, world state)
  const extendedContext = buildExtendedContext(persona, pc, storyState);
  system += extendedContext;

  // Add scene-specific facts for narrators (Phase 3)
  const sceneContext = buildSceneContext(persona, storyState);
  system += sceneContext;

  const contextSection = buildContextSection(memory);

  if (contextSection.trim()) {
    system += '\n' + contextSection;
  }

  // Get conversation history
  const context = getContextWindow(memory);
  const messages = [...context.messages];

  // Add sanitized new message
  messages.push({
    role: 'user',
    content: sanitizeInput(userMessage)
  });

  return { system, messages };
}

/**
 * Estimate token count (rough approximation)
 * @param {string} text - Text to estimate
 * @returns {number} Estimated tokens
 */
function estimateTokens(text) {
  if (!text) return 0;
  // Rough approximation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Sanitize user input to prevent prompt injection
 * @param {string} text - Raw user input
 * @returns {string} Sanitized input
 */
function sanitizeInput(text) {
  if (!text) return '';

  return text
    // Remove potential prompt injection patterns
    .replace(/\[SYSTEM\]/gi, '[system]')
    .replace(/\[INST\]/gi, '[inst]')
    .replace(/\[\/INST\]/gi, '[/inst]')
    .replace(/<\|.*?\|>/g, '')           // Remove special tokens like <|endoftext|>
    .replace(/<<SYS>>.*?<<\/SYS>>/gs, '') // Remove Llama-style system injections
    // Trim and limit length
    .trim()
    .slice(0, MAX_INPUT_LENGTH);
}

/**
 * Check if prompt is within token limits
 * @param {Object} assembled - Result from assembleFullPrompt
 * @returns {Object} { ok: boolean, tokens: number, overBy?: number }
 */
function checkTokenLimits(assembled) {
  const systemTokens = estimateTokens(assembled.system);
  const messageTokens = assembled.messages.reduce(
    (sum, m) => sum + estimateTokens(m.content), 0
  );
  const total = systemTokens + messageTokens;

  return {
    ok: total <= MAX_CONTEXT_TOKENS,
    tokens: total,
    systemTokens,
    messageTokens,
    overBy: total > MAX_CONTEXT_TOKENS ? total - MAX_CONTEXT_TOKENS : 0
  };
}

module.exports = {
  MAX_CONTEXT_TOKENS,
  MAX_INPUT_LENGTH,
  buildSystemPrompt,
  buildPCContext,
  buildContextSection,
  assembleFullPrompt,
  estimateTokens,
  sanitizeInput,
  checkTokenLimits
};
