/**
 * Claude AI Client Wrapper
 *
 * Handles:
 * - API initialization
 * - Rate limiting
 * - Budget tracking
 * - Error handling
 */

const Anthropic = require('@anthropic-ai/sdk');

// Configuration
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const HAIKU_MODEL = 'claude-haiku-3-5-20241022';
const MAX_OUTPUT_TOKENS = 1000;

// Budget tracking (in-memory, resets on restart)
let dailySpend = 0;
let requestCount = 0;
let lastResetDate = new Date().toDateString();

// Rate limiting
const requestTimes = [];
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 30;

/**
 * Create Anthropic client
 * @param {string} apiKey - Optional API key (uses env if not provided)
 * @returns {Object} Anthropic client instance
 */
function createClient(apiKey = null) {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;

  if (!key) {
    throw new Error('ANTHROPIC_API_KEY not set. Copy .env.example to .env and add your key.');
  }

  return new Anthropic({ apiKey: key });
}

/**
 * Check rate limits
 * @returns {Object} { allowed: boolean, waitMs?: number }
 */
function checkRateLimit() {
  const now = Date.now();

  // Remove old requests outside window
  while (requestTimes.length > 0 && requestTimes[0] < now - RATE_LIMIT_WINDOW) {
    requestTimes.shift();
  }

  if (requestTimes.length >= MAX_REQUESTS_PER_MINUTE) {
    const waitMs = requestTimes[0] + RATE_LIMIT_WINDOW - now;
    return { allowed: false, waitMs };
  }

  return { allowed: true };
}

/**
 * Check daily budget
 * @param {number} dailyBudget - Max daily spend in USD
 * @returns {Object} { allowed: boolean, spent: number, remaining: number }
 */
function checkBudget(dailyBudget = 1.0) {
  // Reset daily tracking if new day
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dailySpend = 0;
    requestCount = 0;
    lastResetDate = today;
  }

  return {
    allowed: dailySpend < dailyBudget,
    spent: dailySpend,
    remaining: Math.max(0, dailyBudget - dailySpend)
  };
}

/**
 * Track usage after request
 * @param {Object} usage - Usage from API response
 */
function trackUsage(usage) {
  if (!usage) return;

  // Rough cost estimation (Sonnet pricing as of Jan 2025)
  // Input: $3/M tokens, Output: $15/M tokens
  const inputCost = (usage.input_tokens / 1_000_000) * 3;
  const outputCost = (usage.output_tokens / 1_000_000) * 15;

  dailySpend += inputCost + outputCost;
  requestCount++;
  requestTimes.push(Date.now());
}

/**
 * Send chat message to Claude
 * @param {Object} client - Anthropic client
 * @param {string} system - System prompt
 * @param {Array} messages - Message history
 * @param {Object} options - Optional settings
 * @returns {Object} { content: string, usage: Object }
 */
async function chat(client, system, messages, options = {}) {
  const {
    model = DEFAULT_MODEL,
    maxTokens = MAX_OUTPUT_TOKENS,
    dailyBudget = parseFloat(process.env.DAILY_BUDGET_USD) || 1.0
  } = options;

  // Check rate limit
  const rateCheck = checkRateLimit();
  if (!rateCheck.allowed) {
    throw new Error(`Rate limit exceeded. Wait ${Math.ceil(rateCheck.waitMs / 1000)}s`);
  }

  // Check budget
  const budgetCheck = checkBudget(dailyBudget);
  if (!budgetCheck.allowed) {
    throw new Error(`Daily budget exhausted. Spent $${budgetCheck.spent.toFixed(4)}`);
  }

  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages
    });

    // Track usage
    trackUsage(response.usage);

    // Extract text content
    const content = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    return {
      content,
      usage: response.usage,
      model: response.model,
      stopReason: response.stop_reason
    };
  } catch (error) {
    // Handle specific API errors
    if (error.status === 401) {
      throw new Error('Invalid API key. Check your ANTHROPIC_API_KEY.');
    }
    if (error.status === 429) {
      throw new Error('API rate limited. Try again later.');
    }
    if (error.status === 500 || error.status === 503) {
      throw new Error('Claude API temporarily unavailable. Try again.');
    }

    throw error;
  }
}

/**
 * Quick chat using Haiku (for extraction, summarization)
 * @param {Object} client - Anthropic client
 * @param {string} prompt - Simple prompt
 * @returns {string} Response text
 */
async function quickChat(client, prompt) {
  const response = await chat(client, '', [{ role: 'user', content: prompt }], {
    model: HAIKU_MODEL,
    maxTokens: 500
  });
  return response.content;
}

/**
 * Get usage stats
 * @returns {Object} Current usage statistics
 */
function getUsageStats() {
  return {
    dailySpend: dailySpend.toFixed(4),
    requestCount,
    requestsInWindow: requestTimes.length,
    date: lastResetDate
  };
}

module.exports = {
  DEFAULT_MODEL,
  HAIKU_MODEL,
  MAX_OUTPUT_TOKENS,
  createClient,
  checkRateLimit,
  checkBudget,
  trackUsage,
  chat,
  quickChat,
  getUsageStats
};
