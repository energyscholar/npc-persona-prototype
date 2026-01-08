/**
 * Hybrid Memory System for NPC Personas
 *
 * Stores:
 * - Structured facts (always included in context)
 * - Rolling summary (regenerated when messages exceed threshold)
 * - Recent messages (capped, verbatim)
 */

// Configuration
const RECENT_MESSAGE_LIMIT = 10;
const SUMMARIZE_THRESHOLD = 20;
const KEEP_AFTER_SUMMARY = 5;

/**
 * Create a new memory object or restore from existing data
 * @param {Object} existing - Optional existing memory to restore
 * @returns {Object} Memory object
 */
function createMemory(existing = null) {
  if (existing) {
    return {
      facts: existing.facts || [],
      recentMessages: existing.recentMessages || [],
      historySummary: existing.historySummary || null,
      summaryAsOf: existing.summaryAsOf || null,
      totalInteractions: existing.totalInteractions || 0,
      firstContact: existing.firstContact || null,
      lastContact: existing.lastContact || null
    };
  }

  return {
    facts: [],
    recentMessages: [],
    historySummary: null,
    summaryAsOf: null,
    totalInteractions: 0,
    firstContact: null,
    lastContact: null
  };
}

/**
 * Add a message to recent messages
 * @param {Object} memory - Memory object
 * @param {string} role - 'user' or 'assistant'
 * @param {string} content - Message content
 * @param {string} date - Game date (DDD-YYYY format)
 */
function addMessage(memory, role, content, date) {
  memory.recentMessages.push({ role, content, date });
  memory.totalInteractions++;

  // Set first contact if not set
  if (!memory.firstContact) {
    memory.firstContact = date;
  }

  // Always update last contact
  memory.lastContact = date;

  // Cap at limit (remove oldest)
  while (memory.recentMessages.length > RECENT_MESSAGE_LIMIT) {
    memory.recentMessages.shift();
  }
}

/**
 * Add or update a fact
 * @param {Object} memory - Memory object
 * @param {Object} fact - Fact object with type, value, and optional fields
 */
function addFact(memory, fact) {
  const existingIndex = memory.facts.findIndex(f => f.type === fact.type);

  if (existingIndex >= 0) {
    // Update existing fact
    memory.facts[existingIndex] = { ...memory.facts[existingIndex], ...fact };
  } else {
    // Add new fact
    memory.facts.push({ ...fact });
  }
}

/**
 * Update specific fields of an existing fact
 * @param {Object} memory - Memory object
 * @param {string} type - Fact type to update
 * @param {Object} updates - Fields to update
 */
function updateFact(memory, type, updates) {
  const fact = memory.facts.find(f => f.type === type);
  if (fact) {
    Object.assign(fact, updates);
  }
}

/**
 * Get a fact by type
 * @param {Object} memory - Memory object
 * @param {string} type - Fact type
 * @returns {Object|null} Fact or null
 */
function getFact(memory, type) {
  return memory.facts.find(f => f.type === type) || null;
}

/**
 * Check if memory should be summarized
 * @param {Object} memory - Memory object
 * @returns {boolean} True if summarization needed
 */
function shouldSummarize(memory) {
  return memory.totalInteractions > SUMMARIZE_THRESHOLD;
}

/**
 * Apply a summary, keeping only recent messages
 * @param {Object} memory - Memory object
 * @param {string} summary - Generated summary text
 * @param {string} asOfDate - Date summary was generated
 */
function applySummary(memory, summary, asOfDate) {
  memory.historySummary = summary;
  memory.summaryAsOf = asOfDate;

  // Keep only the most recent messages
  if (memory.recentMessages.length > KEEP_AFTER_SUMMARY) {
    memory.recentMessages = memory.recentMessages.slice(-KEEP_AFTER_SUMMARY);
  }
}

/**
 * Serialize memory to JSON string
 * @param {Object} memory - Memory object
 * @returns {string} JSON string
 */
function serialize(memory) {
  return JSON.stringify(memory, null, 2);
}

/**
 * Deserialize memory from JSON string
 * @param {string} json - JSON string
 * @returns {Object} Memory object
 * @throws {Error} If JSON is invalid
 */
function deserialize(json) {
  try {
    const data = JSON.parse(json);
    return createMemory(data);
  } catch (e) {
    throw new Error(`Invalid memory JSON: ${e.message}`);
  }
}

/**
 * Get context window for API call
 * @param {Object} memory - Memory object
 * @returns {Object} Context with messages, factsText, summaryText
 */
function getContextWindow(memory) {
  // Format facts as text
  let factsText = '';
  if (memory.facts.length > 0) {
    factsText = memory.facts.map(f => {
      let line = `- ${f.type}: ${f.value}`;
      if (f.since) line += ` (since ${f.since})`;
      if (f.resolved !== undefined) line += f.resolved ? ' [resolved]' : ' [active]';
      return line;
    }).join('\n');
  }

  // Format summary
  let summaryText = '';
  if (memory.historySummary) {
    summaryText = memory.historySummary;
    if (memory.summaryAsOf) {
      summaryText += `\n(Summary as of ${memory.summaryAsOf})`;
    }
  }

  // Format messages for API
  const messages = memory.recentMessages.map(m => ({
    role: m.role,
    content: m.content
  }));

  return {
    messages,
    factsText,
    summaryText,
    totalInteractions: memory.totalInteractions,
    firstContact: memory.firstContact,
    lastContact: memory.lastContact
  };
}

module.exports = {
  // Constants
  RECENT_MESSAGE_LIMIT,
  SUMMARIZE_THRESHOLD,
  KEEP_AFTER_SUMMARY,

  // Functions
  createMemory,
  addMessage,
  addFact,
  updateFact,
  getFact,
  shouldSummarize,
  applySummary,
  serialize,
  deserialize,
  getContextWindow
};
