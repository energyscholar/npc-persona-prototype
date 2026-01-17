/**
 * Training Log - Persistence for NPC training session results
 *
 * Stores training run results including:
 * - Which scenario was run
 * - Checklist item evaluations
 * - Pass/fail status
 * - Notes and observations
 */

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, '../data/training-results');

// In-memory cache for test isolation
let testMode = false;
let testData = {};

/**
 * Ensure results directory exists
 */
function ensureResultsDir() {
  if (!testMode && !fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

/**
 * Get path to NPC's training log file
 * @param {string} npcId - NPC identifier
 * @returns {string} File path
 */
function getLogPath(npcId) {
  return path.join(RESULTS_DIR, `${npcId}.json`);
}

/**
 * Load training log for an NPC
 * @param {string} npcId - NPC identifier
 * @returns {Array} Array of training results
 */
function loadLog(npcId) {
  if (testMode) {
    return testData[npcId] || [];
  }

  ensureResultsDir();
  const logPath = getLogPath(npcId);

  if (!fs.existsSync(logPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(logPath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`Error loading training log for ${npcId}:`, e.message);
    return [];
  }
}

/**
 * Save training log for an NPC
 * @param {string} npcId - NPC identifier
 * @param {Array} log - Array of training results
 */
function saveLog(npcId, log) {
  if (testMode) {
    testData[npcId] = log;
    return;
  }

  ensureResultsDir();
  const logPath = getLogPath(npcId);

  try {
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  } catch (e) {
    console.error(`Error saving training log for ${npcId}:`, e.message);
  }
}

/**
 * Save a training result
 * @param {Object} result - Training result
 * @param {string} result.npcId - NPC identifier
 * @param {string} result.scenarioId - Scenario that was run
 * @param {Object} result.checklist - Checklist item evaluations {VOICE: 'pass', ...}
 * @param {boolean} result.passed - Overall pass/fail
 * @param {string} [result.notes] - Optional notes
 */
function saveResult(result) {
  const { npcId, scenarioId, checklist, passed, notes } = result;

  if (!npcId) {
    throw new Error('npcId is required');
  }

  const entry = {
    timestamp: new Date().toISOString(),
    scenarioId: scenarioId || 'unknown',
    checklist: checklist || {},
    passed: !!passed,
    notes: notes || ''
  };

  const log = loadLog(npcId);
  log.push(entry);

  // Keep last 100 entries per NPC
  if (log.length > 100) {
    log.splice(0, log.length - 100);
  }

  saveLog(npcId, log);

  return entry;
}

/**
 * Get training history for an NPC
 * @param {string} npcId - NPC identifier
 * @param {Object} [options] - Options
 * @param {number} [options.limit] - Max entries to return
 * @param {string} [options.scenarioId] - Filter by scenario
 * @returns {Array} Training results
 */
function getHistory(npcId, options = {}) {
  let log = loadLog(npcId);

  if (options.scenarioId) {
    log = log.filter(e => e.scenarioId === options.scenarioId);
  }

  if (options.limit && options.limit > 0) {
    log = log.slice(-options.limit);
  }

  return log;
}

/**
 * Get summary statistics for an NPC
 * @param {string} npcId - NPC identifier
 * @returns {Object} Summary with total, passed, failed counts
 */
function getNpcSummary(npcId) {
  const log = loadLog(npcId);

  const total = log.length;
  const passed = log.filter(e => e.passed).length;
  const failed = total - passed;

  // Get per-scenario stats
  const byScenario = {};
  for (const entry of log) {
    if (!byScenario[entry.scenarioId]) {
      byScenario[entry.scenarioId] = { total: 0, passed: 0, failed: 0 };
    }
    byScenario[entry.scenarioId].total++;
    if (entry.passed) {
      byScenario[entry.scenarioId].passed++;
    } else {
      byScenario[entry.scenarioId].failed++;
    }
  }

  // Get per-checklist-item stats
  const byItem = {};
  for (const entry of log) {
    for (const [item, result] of Object.entries(entry.checklist || {})) {
      if (!byItem[item]) {
        byItem[item] = { total: 0, passed: 0, failed: 0 };
      }
      byItem[item].total++;
      if (result === 'pass') {
        byItem[item].passed++;
      } else if (result === 'fail') {
        byItem[item].failed++;
      }
    }
  }

  return {
    total,
    passed,
    failed,
    passRate: total > 0 ? (passed / total * 100).toFixed(1) + '%' : 'N/A',
    byScenario,
    byItem,
    lastRun: log.length > 0 ? log[log.length - 1].timestamp : null
  };
}

/**
 * Get summary for all NPCs
 * @returns {Object} Map of npcId -> summary
 */
function getAllSummaries() {
  if (testMode) {
    const summaries = {};
    for (const npcId of Object.keys(testData)) {
      summaries[npcId] = getNpcSummary(npcId);
    }
    return summaries;
  }

  ensureResultsDir();
  const summaries = {};

  try {
    const files = fs.readdirSync(RESULTS_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const npcId = file.slice(0, -5);
        summaries[npcId] = getNpcSummary(npcId);
      }
    }
  } catch (e) {
    console.error('Error reading training results:', e.message);
  }

  return summaries;
}

/**
 * Clear training data (for testing)
 */
function clearTestData() {
  testMode = true;
  testData = {};
}

/**
 * Enable test mode (in-memory storage)
 */
function enableTestMode() {
  testMode = true;
  testData = {};
}

/**
 * Disable test mode (use filesystem)
 */
function disableTestMode() {
  testMode = false;
}

module.exports = {
  saveResult,
  getHistory,
  getNpcSummary,
  getAllSummaries,
  clearTestData,
  enableTestMode,
  disableTestMode,
  ensureResultsDir
};
