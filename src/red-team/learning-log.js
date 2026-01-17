/**
 * Learning Log - Audit trail for red team learning cycles
 *
 * Tracks all learning attempts: what was detected, generated, applied, and verified.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data/red-team');
const LEARNING_LOG = path.join(DATA_DIR, 'learning-log.json');
const PENDING_LEARNING = path.join(DATA_DIR, 'pending-learning.json');

/**
 * @typedef {Object} LearningLogEntry
 * @property {string} timestamp
 * @property {string} npc_id
 * @property {string} fact_id
 * @property {string} query_id
 * @property {string} original_query
 * @property {string} original_response
 * @property {Object} before_knowledge
 * @property {Object} generated_entry
 * @property {Object} after_knowledge
 * @property {string} verification_verdict
 * @property {string} verification_response
 * @property {string} final_status - 'LEARNED' | 'FAILED_VERIFICATION' | 'ESCALATED'
 * @property {string} [error]
 * @property {boolean} [rollback]
 */

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Load learning log from disk
 * @returns {Object} Log with stats and entries
 */
function loadLog() {
  ensureDataDir();

  if (!fs.existsSync(LEARNING_LOG)) {
    return {
      version: '1.0',
      stats: {
        total: 0,
        learned: 0,
        failed_verification: 0,
        escalated: 0,
        pending_review: 0
      },
      entries: []
    };
  }

  try {
    return JSON.parse(fs.readFileSync(LEARNING_LOG, 'utf8'));
  } catch (e) {
    console.error('Error loading learning log:', e.message);
    return {
      version: '1.0',
      stats: { total: 0, learned: 0, failed_verification: 0, escalated: 0, pending_review: 0 },
      entries: []
    };
  }
}

/**
 * Save learning log to disk
 * @param {Object} log - Log to save
 */
function saveLog(log) {
  ensureDataDir();
  fs.writeFileSync(LEARNING_LOG, JSON.stringify(log, null, 2));
}

/**
 * Log a completed learning cycle
 * @param {LearningLogEntry} entry - Learning cycle entry
 */
function logLearningCycle(entry) {
  const log = loadLog();

  log.entries.push({
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString()
  });

  log.stats.total++;

  // Update status-specific counter
  const status = (entry.final_status || 'escalated').toLowerCase();
  if (log.stats[status] !== undefined) {
    log.stats[status]++;
  }

  saveLog(log);
  return entry;
}

/**
 * Get recent learning entries
 * @param {number} limit - Max entries to return
 * @returns {Array} Recent entries
 */
function getRecentLearning(limit = 10) {
  const log = loadLog();
  return log.entries.slice(-limit);
}

/**
 * Get learning statistics
 * @returns {Object} Stats object
 */
function getLearningStats() {
  const log = loadLog();
  return log.stats;
}

/**
 * Get learning entries filtered by NPC
 * @param {string} npcId - NPC identifier
 * @returns {Array} Entries for that NPC
 */
function getLearningByNpc(npcId) {
  const log = loadLog();
  return log.entries.filter(e => e.npc_id === npcId);
}

/**
 * Get learning entries filtered by status
 * @param {string} status - Status to filter by
 * @returns {Array} Matching entries
 */
function getLearningByStatus(status) {
  const log = loadLog();
  return log.entries.filter(e => e.final_status === status);
}

// === Pending Learning (Human Review Queue) ===

/**
 * Load pending learning entries awaiting human review
 * @returns {Array} Pending entries
 */
function loadPendingLearning() {
  ensureDataDir();

  if (!fs.existsSync(PENDING_LEARNING)) {
    return [];
  }

  try {
    const data = JSON.parse(fs.readFileSync(PENDING_LEARNING, 'utf8'));
    return data.pending || [];
  } catch (e) {
    return [];
  }
}

/**
 * Save entry to pending review queue
 * @param {Object} cycle - Learning cycle awaiting review
 */
function savePendingLearning(cycle) {
  ensureDataDir();

  const pending = loadPendingLearning();
  pending.push({
    ...cycle,
    queued_at: new Date().toISOString()
  });

  fs.writeFileSync(PENDING_LEARNING, JSON.stringify({
    updated: new Date().toISOString(),
    count: pending.length,
    pending
  }, null, 2));

  // Update stats
  const log = loadLog();
  log.stats.pending_review = pending.length;
  saveLog(log);
}

/**
 * Remove entry from pending queue (after approval/rejection)
 * @param {number} index - Index of entry to remove
 * @returns {Object|null} Removed entry
 */
function removePendingLearning(index) {
  const pending = loadPendingLearning();

  if (index < 0 || index >= pending.length) {
    return null;
  }

  const removed = pending.splice(index, 1)[0];

  fs.writeFileSync(PENDING_LEARNING, JSON.stringify({
    updated: new Date().toISOString(),
    count: pending.length,
    pending
  }, null, 2));

  // Update stats
  const log = loadLog();
  log.stats.pending_review = pending.length;
  saveLog(log);

  return removed;
}

/**
 * Clear all pending learning entries
 */
function clearPendingLearning() {
  fs.writeFileSync(PENDING_LEARNING, JSON.stringify({
    updated: new Date().toISOString(),
    count: 0,
    pending: []
  }, null, 2));

  const log = loadLog();
  log.stats.pending_review = 0;
  saveLog(log);
}

/**
 * Format learning log for display
 * @param {Array} entries - Entries to format
 * @returns {string} Formatted output
 */
function formatLearningLog(entries) {
  if (entries.length === 0) {
    return '  No learning entries.\n';
  }

  const lines = [];

  for (const entry of entries) {
    const status = entry.final_status || 'UNKNOWN';
    const icon = status === 'LEARNED' ? '✓' : status === 'FAILED_VERIFICATION' ? '✗' : '?';

    lines.push(`  ${icon} [${entry.timestamp?.slice(0, 16) || 'N/A'}] ${entry.npc_id}`);
    lines.push(`    Query: "${entry.original_query?.slice(0, 50)}..."`);
    lines.push(`    Status: ${status}`);

    if (entry.generated_entry) {
      lines.push(`    Generated: ${entry.generated_entry.topic} - "${entry.generated_entry.content?.slice(0, 40)}..."`);
    }

    if (entry.error) {
      lines.push(`    Error: ${entry.error}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format statistics for display
 * @returns {string} Formatted stats
 */
function formatStats() {
  const stats = getLearningStats();

  const successRate = stats.total > 0
    ? Math.round((stats.learned / stats.total) * 100)
    : 0;

  return [
    '=== Learning Statistics ===',
    `Total cycles: ${stats.total}`,
    `Learned: ${stats.learned} (${successRate}% success)`,
    `Failed verification: ${stats.failed_verification}`,
    `Escalated: ${stats.escalated}`,
    `Pending review: ${stats.pending_review || 0}`
  ].join('\n');
}

module.exports = {
  // Core logging
  logLearningCycle,
  loadLog,
  saveLog,

  // Queries
  getRecentLearning,
  getLearningStats,
  getLearningByNpc,
  getLearningByStatus,

  // Pending review
  loadPendingLearning,
  savePendingLearning,
  removePendingLearning,
  clearPendingLearning,

  // Display
  formatLearningLog,
  formatStats,

  // Paths
  LEARNING_LOG,
  PENDING_LEARNING
};
