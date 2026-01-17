/**
 * Contact History - Track test sessions with NPCs
 *
 * Pattern: Persistent state with session tracking
 * Records test conversations for debugging and verification
 */

const fs = require('fs');
const path = require('path');

const HISTORY_DIR = path.join(__dirname, '../data/state/test-history');

/**
 * Ensure history directory exists
 */
function ensureHistoryDir() {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
}

/**
 * Get history file path for NPC
 * @param {string} npcId - NPC identifier
 * @returns {string} File path
 */
function getHistoryPath(npcId) {
  ensureHistoryDir();
  return path.join(HISTORY_DIR, `${npcId}.json`);
}

/**
 * Load contact history for NPC
 * @param {string} npcId - NPC identifier
 * @returns {Object} History data
 */
function loadContactHistory(npcId) {
  const filePath = getHistoryPath(npcId);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      return createEmptyHistory(npcId);
    }
  }
  return createEmptyHistory(npcId);
}

/**
 * Create empty history structure
 * @param {string} npcId - NPC identifier
 * @returns {Object} Empty history
 */
function createEmptyHistory(npcId) {
  return {
    npcId,
    sessions: [],
    totalSessions: 0,
    lastContact: null
  };
}

/**
 * Save contact history for NPC
 * @param {string} npcId - NPC identifier
 * @param {Object} history - History data
 */
function saveContactHistory(npcId, history) {
  const filePath = getHistoryPath(npcId);
  fs.writeFileSync(filePath, JSON.stringify(history, null, 2));
}

/**
 * Add a session to contact history
 * @param {string} npcId - NPC identifier
 * @param {Object} session - Session data
 */
function addSession(npcId, session) {
  const history = loadContactHistory(npcId);

  history.totalSessions++;
  history.lastContact = new Date().toISOString();

  history.sessions.push({
    number: history.totalSessions,
    timestamp: new Date().toISOString(),
    channel: session.channel,
    context: session.context,
    flags: session.flags,
    disposition: session.disposition,
    turnCount: session.turnCount,
    summary: session.summary || 'Conversation recorded',
    dispositionChange: session.dispositionChange || 0
  });

  // Keep only last 10 sessions
  if (history.sessions.length > 10) {
    history.sessions = history.sessions.slice(-10);
  }

  saveContactHistory(npcId, history);
  return history;
}

/**
 * Clear history for NPC
 * @param {string} npcId - NPC identifier
 */
function clearHistory(npcId) {
  const history = createEmptyHistory(npcId);
  saveContactHistory(npcId, history);
  return history;
}

/**
 * Get session summaries for display
 * @param {string} npcId - NPC identifier
 * @returns {Array} Session summaries
 */
function getSessionSummaries(npcId) {
  const history = loadContactHistory(npcId);
  return history.sessions.map(s => ({
    number: s.number,
    channel: s.channel,
    context: s.context,
    summary: s.summary,
    disposition: formatDisposition(s.disposition, s.dispositionChange)
  }));
}

/**
 * Format disposition for display
 * @param {number} level - Disposition level
 * @param {number} change - Disposition change
 * @returns {string} Formatted disposition
 */
function formatDisposition(level, change = 0) {
  const labels = {
    '-3': 'hostile',
    '-2': 'unfriendly',
    '-1': 'wary',
    '0': 'neutral',
    '1': 'cooperative',
    '2': 'friendly',
    '3': 'loyal'
  };
  const label = labels[String(level)] || 'neutral';

  if (change > 0) {
    return `+${level} (${label}) ↑`;
  } else if (change < 0) {
    return `${level} (${label}) ↓`;
  }
  return `${level} (${label})`;
}

/**
 * Check if NPC has any contact history
 * @param {string} npcId - NPC identifier
 * @returns {boolean} Whether history exists
 */
function hasHistory(npcId) {
  const history = loadContactHistory(npcId);
  return history.sessions.length > 0;
}

/**
 * Get total session count for NPC
 * @param {string} npcId - NPC identifier
 * @returns {number} Session count
 */
function getSessionCount(npcId) {
  const history = loadContactHistory(npcId);
  return history.totalSessions;
}

/**
 * Get last session for NPC
 * @param {string} npcId - NPC identifier
 * @returns {Object|null} Last session or null
 */
function getLastSession(npcId) {
  const history = loadContactHistory(npcId);
  if (history.sessions.length === 0) return null;
  return history.sessions[history.sessions.length - 1];
}

/**
 * Create session summary from test state
 * @param {Object} state - Test mode state
 * @param {string} summaryText - Summary of conversation
 * @returns {Object} Session data for storage
 */
function createSessionFromState(state, summaryText = '') {
  return {
    channel: state.channel,
    context: state.context,
    flags: { ...state.flags },
    disposition: state.disposition,
    turnCount: state.turnCount,
    summary: summaryText || `${state.turnCount} turns of conversation`
  };
}

/**
 * List all NPCs with contact history
 * @returns {Array} NPC IDs with history
 */
function listNpcsWithHistory() {
  ensureHistoryDir();
  try {
    return fs.readdirSync(HISTORY_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  } catch (e) {
    return [];
  }
}

/**
 * Clear all contact history
 */
function clearAllHistory() {
  const npcs = listNpcsWithHistory();
  for (const npcId of npcs) {
    clearHistory(npcId);
  }
}

module.exports = {
  // Core operations
  loadContactHistory,
  saveContactHistory,
  addSession,
  clearHistory,

  // Queries
  getSessionSummaries,
  hasHistory,
  getSessionCount,
  getLastSession,
  listNpcsWithHistory,

  // Helpers
  createSessionFromState,
  formatDisposition,
  clearAllHistory,
  ensureHistoryDir
};
