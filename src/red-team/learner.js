/**
 * Learner - LLM-powered knowledge generation and learning orchestration
 *
 * Closed-loop learning: DETECT → GENERATE → PATCH → VERIFY → ROLLBACK/AUDIT
 * Uses Haiku for fast, cheap knowledge entry generation.
 */

const fs = require('fs');
const path = require('path');
const { createClient, quickChat, chat, HAIKU_MODEL } = require('../ai-client');
const { validateResponse } = require('./validator');
const { getQuery, executeQuery } = require('./query-engine');
const { getFact } = require('./fact-database');
const {
  logLearningCycle,
  savePendingLearning,
  loadPendingLearning,
  removePendingLearning
} = require('./learning-log');

const NPCS_DIR = path.join(__dirname, '../../data/npcs');
const PATCHES_DIR = path.join(__dirname, '../../data/red-team/patches');

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Load NPC data from JSON file
 * @param {string} npcId - NPC identifier
 * @returns {Object|null} NPC data or null if not found
 */
function loadNpc(npcId) {
  const npcFile = path.join(NPCS_DIR, `${npcId}.json`);

  if (!fs.existsSync(npcFile)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(npcFile, 'utf8'));
  } catch (e) {
    console.error(`Error loading NPC ${npcId}:`, e.message);
    return null;
  }
}

/**
 * Build prompt for LLM to generate in-character knowledge entry
 * @param {Object} params - Generation parameters
 * @returns {string} Prompt for LLM
 */
function buildLearnerPrompt({ fact, npc, expectedKeywords, failureKeywords, originalQuery, failedResponse }) {
  const traits = npc.personality?.traits?.join(', ') || 'professional';
  const style = npc.personality?.speech || npc.personality?.communication_style || 'direct';

  let prompt = `You are helping improve an NPC's knowledge base for a Traveller RPG game.

NPC PROFILE:
- Name: ${npc.name}
- Role: ${npc.title || npc.archetype}
- Personality: ${traits}
- Speaking style: ${style}

FACT THE NPC SHOULD KNOW:
${fact.content}

REQUIRED KEYWORDS (must naturally include):
${expectedKeywords.join(', ')}`;

  if (failureKeywords && failureKeywords.length > 0) {
    prompt += `

FORBIDDEN WORDS (NEVER use these - they indicate wrong understanding):
${failureKeywords.join(', ')}`;
  }

  prompt += `

FAILED EXCHANGE:
Player asked: "${originalQuery}"
NPC wrongly said: "${failedResponse}"

TASK:
Write a knowledge_base entry (2-4 sentences) that this NPC would use to answer correctly.
- Use the NPC's voice and personality
- Include ALL required keywords naturally
- NEVER use any of the forbidden words
- Don't be a robot - be conversational
- Include relevant context the NPC would know

OUTPUT FORMAT:
TOPIC: [single_word_topic]
CONTENT: [your in-character knowledge entry]`;

  return prompt;
}

/**
 * Parse LLM response into structured knowledge entry
 * @param {string} llmResponse - Raw LLM response
 * @returns {Object} { topic, content }
 */
function parseKnowledgeEntry(llmResponse) {
  const topicMatch = llmResponse.match(/TOPIC:\s*(\w+)/i);
  const contentMatch = llmResponse.match(/CONTENT:\s*([\s\S]+)/i);

  return {
    topic: topicMatch?.[1]?.toLowerCase() || 'general_knowledge',
    content: contentMatch?.[1]?.trim() || llmResponse
  };
}

/**
 * Generate in-character knowledge entry via LLM (Haiku)
 * @param {Object} params - Generation parameters
 * @param {Object} client - Anthropic client (optional, creates one if not provided)
 * @returns {Promise<{topic: string, content: string}>}
 */
async function generateKnowledgeEntry(params, client = null) {
  const aiClient = client || createClient();
  const prompt = buildLearnerPrompt(params);

  let lastError = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await quickChat(aiClient, prompt);
      return parseKnowledgeEntry(response);
    } catch (error) {
      lastError = error;
      console.error(`[Learner] Generation attempt ${attempt + 1} failed:`, error.message);

      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }

  throw new Error(`Failed to generate knowledge entry after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

/**
 * Create timestamped backup of NPC file
 * @param {string} npcId - NPC identifier
 * @param {Object} npcData - Current NPC data
 * @returns {string} Backup file path
 */
function createBackup(npcId, npcData) {
  if (!fs.existsSync(PATCHES_DIR)) {
    fs.mkdirSync(PATCHES_DIR, { recursive: true });
  }

  const backupPath = path.join(PATCHES_DIR, `${npcId}-backup-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(npcData, null, 2));

  return backupPath;
}

/**
 * Apply a learned knowledge entry with full audit trail
 * @param {string} npcId - NPC identifier
 * @param {Object} entry - { topic, content } from learner
 * @param {Object} context - { fact_id, query_id }
 * @returns {Object} { success, backup_path, before, after }
 */
async function applyLearnerPatch(npcId, entry, context = {}) {
  const npcFile = path.join(NPCS_DIR, `${npcId}.json`);

  if (!fs.existsSync(npcFile)) {
    return {
      success: false,
      message: `NPC file not found: ${npcId}`
    };
  }

  try {
    const npcData = JSON.parse(fs.readFileSync(npcFile, 'utf8'));

    // Capture before state
    const before = {
      knowledge_base: JSON.parse(JSON.stringify(npcData.knowledge_base || {}))
    };

    // Create backup
    const backupPath = createBackup(npcId, npcData);

    // Apply patch
    if (!npcData.knowledge_base) {
      npcData.knowledge_base = {};
    }

    // Merge or replace topic
    if (npcData.knowledge_base[entry.topic]) {
      // Append new content with separator
      npcData.knowledge_base[entry.topic] += '\n\n' + entry.content;
    } else {
      npcData.knowledge_base[entry.topic] = entry.content;
    }

    // Write patched file
    fs.writeFileSync(npcFile, JSON.stringify(npcData, null, 2));

    return {
      success: true,
      backup_path: backupPath,
      before,
      after: { knowledge_base: npcData.knowledge_base }
    };
  } catch (e) {
    return {
      success: false,
      message: `Error applying patch to ${npcId}: ${e.message}`
    };
  }
}

/**
 * Revert NPC to backup state after failed verification
 * @param {string} npcId - NPC identifier
 * @param {string} backupPath - Path to backup file
 * @returns {Object} { success, message }
 */
function rollbackPatch(npcId, backupPath) {
  const npcFile = path.join(NPCS_DIR, `${npcId}.json`);

  if (!fs.existsSync(backupPath)) {
    return {
      success: false,
      message: `Backup not found: ${backupPath}`
    };
  }

  try {
    fs.copyFileSync(backupPath, npcFile);
    return {
      success: true,
      message: `Reverted ${npcId} to backup`
    };
  } catch (e) {
    return {
      success: false,
      message: `Rollback failed: ${e.message}`
    };
  }
}

/**
 * Re-run query against patched NPC to verify learning succeeded
 * @param {string} npcId - NPC identifier
 * @param {Object} query - Original query object
 * @param {Object} client - Anthropic client
 * @returns {Promise<{success: boolean, response: string, verdict: string}>}
 */
async function verifyPatch(npcId, query, client) {
  const npc = loadNpc(npcId);

  if (!npc) {
    return {
      success: false,
      response: null,
      verdict: 'ERROR',
      details: `NPC not found: ${npcId}`
    };
  }

  try {
    // Execute query against patched NPC
    const result = await executeQuery(query, npc, client);

    // Validate response
    const validation = validateResponse(result.response, query);

    return {
      success: validation.verdict === 'PASS',
      response: result.response,
      verdict: validation.verdict,
      details: validation.details
    };
  } catch (error) {
    return {
      success: false,
      response: null,
      verdict: 'ERROR',
      details: error.message
    };
  }
}

/**
 * Run complete learning cycle for a failed validation
 * @param {Object} failedResult - Failed validation result from validator
 * @param {Object} options - { autoApply, humanReview, client }
 * @returns {Promise<Object>} Learning cycle result
 */
async function runLearningCycle(failedResult, options = {}) {
  const { autoApply = true, humanReview = false, client = null } = options;
  const aiClient = client || createClient();

  const cycle = {
    npc_id: failedResult.npc_id,
    fact_id: failedResult.fact_id,
    query_id: failedResult.query_id,
    original_query: failedResult.query_text,
    original_response: failedResult.response,
    status: 'STARTED'
  };

  try {
    // 1. Load context
    const npc = loadNpc(failedResult.npc_id);
    if (!npc) {
      throw new Error(`NPC not found: ${failedResult.npc_id}`);
    }

    const fact = getFact(failedResult.fact_id);
    if (!fact) {
      throw new Error(`Fact not found: ${failedResult.fact_id}`);
    }

    const query = getQuery(failedResult.query_id);
    if (!query) {
      throw new Error(`Query not found: ${failedResult.query_id}`);
    }

    cycle.before_knowledge = npc.knowledge_base || {};

    // 2. Generate knowledge entry via LLM
    console.log(`[Learner] Generating knowledge entry for ${npc.name}...`);
    const entry = await generateKnowledgeEntry({
      fact,
      npc,
      expectedKeywords: query.expected_keywords,
      failureKeywords: query.failure_keywords,
      originalQuery: failedResult.query_text,
      failedResponse: failedResult.response
    }, aiClient);

    cycle.generated_entry = entry;
    console.log(`[Learner] Generated: ${entry.topic} - "${entry.content.slice(0, 60)}..."`);

    // 3. Human review gate (if enabled)
    if (humanReview) {
      savePendingLearning(cycle);
      cycle.status = 'PENDING_REVIEW';
      cycle.final_status = 'PENDING_REVIEW';
      return cycle;
    }

    // 4. Apply patch
    if (autoApply) {
      console.log(`[Learner] Applying patch to ${failedResult.npc_id}...`);
      const patchResult = await applyLearnerPatch(
        failedResult.npc_id,
        entry,
        { fact_id: failedResult.fact_id, query_id: failedResult.query_id }
      );

      if (!patchResult.success) {
        throw new Error(patchResult.message);
      }

      cycle.backup_path = patchResult.backup_path;
      cycle.after_knowledge = patchResult.after.knowledge_base;

      // 5. Verify
      console.log(`[Learner] Verifying patch...`);
      const verification = await verifyPatch(failedResult.npc_id, query, aiClient);
      cycle.verification_verdict = verification.verdict;
      cycle.verification_response = verification.response;

      if (verification.success) {
        cycle.final_status = 'LEARNED';
        console.log(`[Learner] ✓ Verification passed`);
      } else {
        // Keep patch but mark as needs review (don't rollback - knowledge is likely correct)
        cycle.final_status = 'LEARNED_NEEDS_REVIEW';
        cycle.verification_warning = verification.details;
        console.log(`[Learner] ~ Knowledge added, but response phrasing needs review`);
        console.log(`[Learner]   Issue: ${verification.details}`);
      }
    }

    // 7. Log cycle
    logLearningCycle(cycle);

    return cycle;

  } catch (error) {
    console.error(`[Learner] Error in learning cycle:`, error.message);
    cycle.error = error.message;
    cycle.final_status = 'ESCALATED';
    logLearningCycle(cycle);
    return cycle;
  }
}

/**
 * Run learning for all failures in a validation report
 * @param {Object} report - Validation report from validator
 * @param {Object} options - { autoApply, humanReview, client }
 * @returns {Promise<Object>} Batch learning results
 */
async function runLearningForReport(report, options = {}) {
  const results = [];

  // Filter to only FAIL verdicts
  const failures = report.results.filter(r => r.verdict === 'FAIL');

  console.log(`[Learner] Processing ${failures.length} failures for ${report.npc_id}...`);

  for (const result of failures) {
    // Add npc_id to result if not present
    result.npc_id = result.npc_id || report.npc_id;

    const cycle = await runLearningCycle(result, options);
    results.push(cycle);
  }

  return {
    npc_id: report.npc_id,
    cycles: results,
    summary: {
      total: results.length,
      learned: results.filter(r => r.final_status === 'LEARNED').length,
      learnedNeedsReview: results.filter(r => r.final_status === 'LEARNED_NEEDS_REVIEW').length,
      failed: results.filter(r => r.final_status === 'FAILED_VERIFICATION').length,
      escalated: results.filter(r => r.final_status === 'ESCALATED').length,
      pending: results.filter(r => r.final_status === 'PENDING_REVIEW').length
    }
  };
}

/**
 * Apply a pending learning entry (after human approval)
 * @param {number} index - Index in pending queue
 * @param {Object} client - Anthropic client
 * @returns {Promise<Object>} Result of applying the patch
 */
async function applyPendingPatch(index, client = null) {
  const pending = loadPendingLearning();

  if (index < 0 || index >= pending.length) {
    return { success: false, message: 'Invalid pending index' };
  }

  const cycle = pending[index];
  const aiClient = client || createClient();

  // Apply the patch
  const patchResult = await applyLearnerPatch(
    cycle.npc_id,
    cycle.generated_entry,
    { fact_id: cycle.fact_id, query_id: cycle.query_id }
  );

  if (!patchResult.success) {
    return patchResult;
  }

  // Verify
  const query = getQuery(cycle.query_id);
  const verification = await verifyPatch(cycle.npc_id, query, aiClient);

  // Update cycle with results
  cycle.backup_path = patchResult.backup_path;
  cycle.after_knowledge = patchResult.after.knowledge_base;
  cycle.verification_verdict = verification.verdict;
  cycle.verification_response = verification.response;

  if (verification.success) {
    cycle.final_status = 'LEARNED';
  } else {
    rollbackPatch(cycle.npc_id, patchResult.backup_path);
    cycle.final_status = 'FAILED_VERIFICATION';
    cycle.rollback = true;
  }

  // Log and remove from pending
  logLearningCycle(cycle);
  removePendingLearning(index);

  return {
    success: verification.success,
    cycle
  };
}

/**
 * List available backups for an NPC
 * @param {string} npcId - NPC identifier
 * @returns {Array} List of backup files
 */
function listBackups(npcId) {
  if (!fs.existsSync(PATCHES_DIR)) {
    return [];
  }

  const files = fs.readdirSync(PATCHES_DIR);
  return files
    .filter(f => f.startsWith(`${npcId}-backup-`) && f.endsWith('.json'))
    .map(f => ({
      filename: f,
      path: path.join(PATCHES_DIR, f),
      timestamp: parseInt(f.match(/-backup-(\d+)\.json$/)?.[1] || '0')
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Restore NPC from a specific backup
 * @param {string} npcId - NPC identifier
 * @param {string} backupPath - Path to backup file
 * @returns {Object} { success, message }
 */
function restoreFromBackup(npcId, backupPath) {
  return rollbackPatch(npcId, backupPath);
}

module.exports = {
  // Core learning
  generateKnowledgeEntry,
  runLearningCycle,
  runLearningForReport,

  // Patching
  applyLearnerPatch,
  rollbackPatch,
  verifyPatch,

  // Pending review
  applyPendingPatch,

  // Backup management
  listBackups,
  restoreFromBackup,
  createBackup,

  // Utilities
  loadNpc,
  buildLearnerPrompt,
  parseKnowledgeEntry
};
