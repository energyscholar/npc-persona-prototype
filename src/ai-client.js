/**
 * Claude AI Client Wrapper
 *
 * Handles:
 * - API initialization with key validation
 * - Rate limiting
 * - Budget tracking
 * - Error handling
 *
 * Key Management:
 * - DEV: .env file (ANTHROPIC_API_KEY)
 * - PROD: Fly.io secrets (fly secrets set ANTHROPIC_API_KEY=xxx)
 */

const Anthropic = require('@anthropic-ai/sdk');

// Configuration
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const HAIKU_MODEL = 'claude-haiku-3-5-20241022';
const MAX_OUTPUT_TOKENS = 1000;

// Environment detection
const ENV = {
  isDev: process.env.NODE_ENV !== 'production',
  isProd: process.env.NODE_ENV === 'production',
  isFly: !!process.env.FLY_APP_NAME,
  name: process.env.NODE_ENV || 'development'
};

// Budget tracking (in-memory, resets on restart)
let dailySpend = 0;
let requestCount = 0;
let lastResetDate = new Date().toDateString();

// Rate limiting
const requestTimes = [];
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 30;

/**
 * Validate API key format
 * @param {string} key - API key to validate
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateApiKey(key) {
  if (!key) {
    return {
      valid: false,
      error: 'ANTHROPIC_API_KEY not set.\n' +
        (ENV.isDev
          ? '  → Copy .env.example to .env and add your key'
          : '  → Set via: fly secrets set ANTHROPIC_API_KEY=sk-ant-...')
    };
  }

  if (typeof key !== 'string') {
    return { valid: false, error: 'API key must be a string' };
  }

  // Check format: should start with sk-ant-
  if (!key.startsWith('sk-ant-')) {
    return {
      valid: false,
      error: 'Invalid API key format. Anthropic keys start with "sk-ant-"\n' +
        '  → Get your key from: https://console.anthropic.com/settings/keys'
    };
  }

  // Check minimum length (real keys are ~100+ chars)
  if (key.length < 40) {
    return {
      valid: false,
      error: 'API key appears truncated. Check for copy/paste errors.'
    };
  }

  // Check for placeholder values
  if (key.includes('your-key') || key.includes('xxx') || key.includes('...')) {
    return {
      valid: false,
      error: 'API key contains placeholder text. Replace with your real key.'
    };
  }

  return { valid: true };
}

/**
 * Create Anthropic client
 * @param {string} apiKey - Optional API key (uses env if not provided)
 * @returns {Object} Anthropic client instance
 * @throws {Error} If key missing or invalid
 */
function createClient(apiKey = null) {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;

  // Validate key format
  const validation = validateApiKey(key);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Log environment (not the key!)
  if (ENV.isDev) {
    console.log(`[AI Client] Environment: ${ENV.name}${ENV.isFly ? ' (Fly.io)' : ''}`);
    console.log(`[AI Client] Key: sk-ant-****${key.slice(-4)}`);
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
  // Configuration
  DEFAULT_MODEL,
  HAIKU_MODEL,
  MAX_OUTPUT_TOKENS,
  ENV,

  // Client creation
  validateApiKey,
  createClient,

  // Rate limiting & budget
  checkRateLimit,
  checkBudget,
  trackUsage,

  // API calls
  chat,
  quickChat,
  getUsageStats
};
