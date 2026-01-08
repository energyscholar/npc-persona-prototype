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

// Configuration
const MAX_CONTEXT_TOKENS = 4000;
const MAX_INPUT_LENGTH = 2000;

/**
 * Build system prompt from persona
 * @param {Object} persona - Loaded persona with archetype defaults
 * @returns {string} System prompt
 */
function buildSystemPrompt(persona) {
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

  // Add response guidelines
  prompt += `
IMPORTANT GUIDELINES:
- Stay in character at all times
- Respond as ${persona.name} would, not as an AI
- Keep responses conversational and natural
- Reference past interactions when relevant
- Your knowledge is limited to what ${persona.name} would know
`;

  return prompt;
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
 * @returns {Object} { system: string, messages: Array }
 */
function assembleFullPrompt(persona, memory, userMessage) {
  // Build system prompt with context injected
  let system = buildSystemPrompt(persona);
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
  buildContextSection,
  assembleFullPrompt,
  estimateTokens,
  sanitizeInput,
  checkTokenLimits
};
