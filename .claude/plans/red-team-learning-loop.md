# Red Team Learning Loop - Implementation Plan

**Created:** 2026-01-17
**Status:** READY FOR IMPLEMENTATION
**Estimated files:** 3 new, 4 modified

---

## Overview

Implement closed-loop learning where failed red team validations automatically generate proper in-character knowledge entries, apply them, verify the fix, and log the entire cycle.

---

## Phase 1: DETECT (Already Exists)

**Location:** `src/red-team/validator.js`
**Status:** Complete

Existing flow:
1. `validateResponse()` checks NPC response against expected/failure keywords
2. Returns PASS/FAIL/WARN verdict
3. `generatePatchSuggestion()` creates placeholder patch

---

## Phase 2: GENERATE (New)

**New File:** `src/red-team/learner.js`

### Purpose
Call LLM to generate in-character knowledge_base entries that would make the NPC answer correctly.

### Functions

```javascript
/**
 * Generate in-character knowledge entry via LLM
 * @param {Object} params
 * @param {Object} params.fact - Fact from database
 * @param {Object} params.npc - NPC JSON data
 * @param {string[]} params.expectedKeywords - Keywords that must appear
 * @param {string} params.originalQuery - What was asked
 * @param {string} params.failedResponse - What NPC said (wrong)
 * @returns {Promise<{topic: string, content: string}>}
 */
async function generateKnowledgeEntry(params) {
  const prompt = buildLearnerPrompt(params);
  const response = await callLLM(prompt);
  return parseKnowledgeEntry(response);
}

function buildLearnerPrompt({ fact, npc, expectedKeywords, originalQuery, failedResponse }) {
  return `
You are helping improve an NPC's knowledge base for a Traveller RPG game.

NPC PROFILE:
- Name: ${npc.name}
- Role: ${npc.role}
- Personality: ${npc.personality?.traits?.join(', ')}
- Speaking style: ${npc.personality?.communication_style}

FACT THE NPC SHOULD KNOW:
${fact.content}

REQUIRED KEYWORDS (must naturally include):
${expectedKeywords.join(', ')}

FAILED EXCHANGE:
Player asked: "${originalQuery}"
NPC wrongly said: "${failedResponse}"

TASK:
Write a knowledge_base entry (2-4 sentences) that this NPC would use to answer correctly.
- Use the NPC's voice and personality
- Include ALL required keywords naturally
- Don't be a robot - be conversational
- Include relevant context the NPC would know

OUTPUT FORMAT:
TOPIC: [single_word_topic]
CONTENT: [your in-character knowledge entry]
`;
}

function parseKnowledgeEntry(llmResponse) {
  const topicMatch = llmResponse.match(/TOPIC:\s*(\w+)/);
  const contentMatch = llmResponse.match(/CONTENT:\s*([\s\S]+)/);

  return {
    topic: topicMatch?.[1] || 'general_knowledge',
    content: contentMatch?.[1]?.trim() || llmResponse
  };
}
```

### LLM Integration Options

```javascript
// Option A: Use existing llm-client.js
const { sendMessage } = require('../llm-client');

async function callLLM(prompt) {
  // Wrap as system-only message for knowledge generation
  return await sendMessage([
    { role: 'system', content: prompt }
  ], { temperature: 0.7, max_tokens: 500 });
}

// Option B: Direct Anthropic API for lower latency
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic();

async function callLLM(prompt) {
  const response = await client.messages.create({
    model: 'claude-3-haiku-20240307',  // Fast, cheap for this task
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  });
  return response.content[0].text;
}
```

---

## Phase 3: PATCH (Modify Existing)

**File:** `src/red-team/patch-generator.js`
**Changes:** Add `applyLearnerPatch()` function

```javascript
/**
 * Apply a learned knowledge entry with full audit trail
 * @param {string} npcId - NPC identifier
 * @param {Object} entry - { topic, content } from learner
 * @param {Object} context - { fact_id, query_id, original_response }
 * @returns {Object} { success, backup_path, before, after }
 */
async function applyLearnerPatch(npcId, entry, context) {
  const npcFile = path.join(NPCS_DIR, `${npcId}.json`);
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
}
```

---

## Phase 4: VERIFY (New)

**File:** `src/red-team/learner.js` (continued)

```javascript
/**
 * Re-run query against patched NPC to verify learning succeeded
 * @param {string} npcId
 * @param {Object} query - Original query
 * @returns {Promise<{success: boolean, response: string, verdict: string}>}
 */
async function verifyPatch(npcId, query) {
  const { executeQueryForNpc } = require('./query-engine');
  const { validateQueryResult } = require('./validator');

  // Execute query against patched NPC
  const result = await executeQueryForNpc(npcId, query);

  // Validate response
  const validation = validateQueryResult(result);

  return {
    success: validation.verdict === 'PASS',
    response: result.response,
    verdict: validation.verdict,
    details: validation.details
  };
}
```

---

## Phase 5: ROLLBACK (New)

**File:** `src/red-team/learner.js` (continued)

```javascript
/**
 * Revert NPC to backup state after failed verification
 * @param {string} npcId
 * @param {string} backupPath
 * @returns {Object} { success, message }
 */
function rollbackPatch(npcId, backupPath) {
  const npcFile = path.join(NPCS_DIR, `${npcId}.json`);

  if (!fs.existsSync(backupPath)) {
    return { success: false, message: 'Backup not found' };
  }

  fs.copyFileSync(backupPath, npcFile);

  return { success: true, message: `Reverted ${npcId} to backup` };
}
```

---

## Phase 6: AUDIT (New)

**New File:** `src/red-team/learning-log.js`

```javascript
const LEARNING_LOG = 'data/red-team/learning-log.json';

/**
 * Log entry structure
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
 */

function logLearningCycle(entry) {
  const log = loadLog();
  log.entries.push({
    ...entry,
    timestamp: new Date().toISOString()
  });
  log.stats.total++;
  log.stats[entry.final_status.toLowerCase()]++;
  saveLog(log);
}

function loadLog() {
  if (!fs.existsSync(LEARNING_LOG)) {
    return {
      version: '1.0',
      stats: { total: 0, learned: 0, failed_verification: 0, escalated: 0 },
      entries: []
    };
  }
  return JSON.parse(fs.readFileSync(LEARNING_LOG, 'utf8'));
}

function getRecentLearning(limit = 10) {
  const log = loadLog();
  return log.entries.slice(-limit);
}

function getLearningStats() {
  const log = loadLog();
  return log.stats;
}
```

---

## Phase 7: FULL LOOP ORCHESTRATION

**File:** `src/red-team/learner.js` (main export)

```javascript
/**
 * Run complete learning cycle for a failed validation
 * @param {Object} failedResult - From validator
 * @param {Object} options - { autoApply: boolean, humanReview: boolean }
 * @returns {Promise<Object>} Learning cycle result
 */
async function runLearningCycle(failedResult, options = {}) {
  const { autoApply = true, humanReview = false } = options;

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
    const fact = getFact(failedResult.fact_id);
    const query = getQuery(failedResult.query_id);

    cycle.before_knowledge = npc.knowledge_base || {};

    // 2. Generate knowledge entry
    const entry = await generateKnowledgeEntry({
      fact,
      npc,
      expectedKeywords: query.expected_keywords,
      originalQuery: failedResult.query_text,
      failedResponse: failedResult.response
    });
    cycle.generated_entry = entry;

    // 3. Human review gate (if enabled)
    if (humanReview) {
      await savePendingLearning(cycle);
      cycle.status = 'PENDING_REVIEW';
      return cycle;
    }

    // 4. Apply patch
    if (autoApply) {
      const patchResult = await applyLearnerPatch(
        failedResult.npc_id,
        entry,
        { fact_id: failedResult.fact_id, query_id: failedResult.query_id }
      );
      cycle.backup_path = patchResult.backup_path;
      cycle.after_knowledge = patchResult.after.knowledge_base;

      // 5. Verify
      const verification = await verifyPatch(failedResult.npc_id, query);
      cycle.verification_verdict = verification.verdict;
      cycle.verification_response = verification.response;

      if (verification.success) {
        cycle.final_status = 'LEARNED';
      } else {
        // 6. Rollback on failure
        rollbackPatch(failedResult.npc_id, patchResult.backup_path);
        cycle.final_status = 'FAILED_VERIFICATION';
        cycle.rollback = true;
      }
    }

    // 7. Log cycle
    logLearningCycle(cycle);

    return cycle;

  } catch (error) {
    cycle.error = error.message;
    cycle.final_status = 'ESCALATED';
    logLearningCycle(cycle);
    return cycle;
  }
}

/**
 * Run learning for all failures in a validation report
 */
async function runLearningForReport(report, options = {}) {
  const results = [];

  for (const result of report.results) {
    if (result.verdict === 'FAIL') {
      const cycle = await runLearningCycle(result, options);
      results.push(cycle);
    }
  }

  return {
    npc_id: report.npc_id,
    cycles: results,
    summary: {
      total: results.length,
      learned: results.filter(r => r.final_status === 'LEARNED').length,
      failed: results.filter(r => r.final_status === 'FAILED_VERIFICATION').length,
      escalated: results.filter(r => r.final_status === 'ESCALATED').length
    }
  };
}
```

---

## Phase 8: TUI INTEGRATION

**File:** `src/tui-menu.js` (modify)

Add to red team submenu:

```javascript
const redTeamMenu = {
  // Existing options...

  runWithAutoLearn: {
    label: 'Run validation + auto-learn',
    handler: async () => {
      const { runLearningForReport } = require('./red-team/learner');
      const report = await runValidation(selectedNpc);

      if (report.summary.fail > 0) {
        console.log(`\nFound ${report.summary.fail} failures. Running auto-learn...`);
        const learning = await runLearningForReport(report, { autoApply: true });
        displayLearningResults(learning);
      }
    }
  },

  reviewPendingPatches: {
    label: 'Review pending patches',
    handler: async () => {
      const pending = await loadPendingLearning();
      if (pending.length === 0) {
        console.log('No pending patches.');
        return;
      }

      for (const cycle of pending) {
        displayPendingPatch(cycle);
        const action = await prompt('Apply? (y/n/s=skip all): ');

        if (action === 'y') {
          await applyPendingPatch(cycle);
        } else if (action === 's') {
          break;
        }
      }
    }
  },

  viewLearningLog: {
    label: 'View learning log',
    handler: async () => {
      const { getRecentLearning, getLearningStats } = require('./red-team/learning-log');
      const stats = getLearningStats();
      const recent = getRecentLearning(10);

      console.log('\n=== Learning Statistics ===');
      console.log(`Total cycles: ${stats.total}`);
      console.log(`Learned: ${stats.learned}`);
      console.log(`Failed verification: ${stats.failed_verification}`);
      console.log(`Escalated: ${stats.escalated}`);

      console.log('\n=== Recent Learning ===');
      for (const entry of recent) {
        console.log(`${entry.timestamp} | ${entry.npc_id} | ${entry.final_status}`);
      }
    }
  }
};
```

---

## Error Handling Strategy

### Recoverable Errors
1. **LLM generation fails** → Retry up to 3x with backoff, then escalate
2. **Patch apply fails** → Log and skip, don't break cycle
3. **Verification timeout** → Mark as ESCALATED for human review

### Unrecoverable Errors
1. **NPC file corrupted** → Restore from backup immediately
2. **Fact not found** → Skip cycle, log warning

### Rollback Strategy
```javascript
// All patches create timestamped backups
// data/red-team/patches/narrator-high-and-dry-backup-1737101234567.json

// Rollback on verification failure is automatic
// Manual rollback available via TUI

async function manualRollback(npcId) {
  const backups = listBackups(npcId);
  // Show list, let user pick which to restore
}
```

---

## Test Cases

### Test 1: Simple Learning Cycle
```javascript
// Setup: NPC missing "Cr3000" keyword
// Input: Failed validation for payment query
// Expected: Generated entry includes "Cr3000" naturally
// Verification: Re-query passes
```

### Test 2: Verification Failure → Rollback
```javascript
// Setup: Generate bad entry (mock LLM to return garbage)
// Expected: Verification fails, rollback triggered
// Check: NPC JSON matches pre-patch state
```

### Test 3: Human Review Gate
```javascript
// Setup: options.humanReview = true
// Expected: Cycle stops at PENDING_REVIEW
// Check: Pending file created, NPC unchanged
```

### Test 4: End-to-End with Real LLM
```javascript
// Setup: Run against narrator-high-and-dry
// Query: "How much does Greener pay?"
// Expected: After learning, response includes "Cr3000"
```

---

## New Files Summary

| File | Purpose |
|------|---------|
| `src/red-team/learner.js` | Main learning orchestration + LLM generation |
| `src/red-team/learning-log.js` | Audit logging functions |
| `data/red-team/learning-log.json` | Audit trail (auto-created) |
| `data/red-team/pending-learning.json` | Human review queue (auto-created) |

## Modified Files Summary

| File | Changes |
|------|---------|
| `src/red-team/patch-generator.js` | Add `applyLearnerPatch()` |
| `src/red-team/index.js` | Export learner module |
| `src/tui-menu.js` | Add learning menu options |
| `src/red-team/query-engine.js` | Add `executeQueryForNpc()` if missing |

---

## Implementation Order

1. `src/red-team/learning-log.js` (standalone, no deps)
2. `src/red-team/learner.js` (core logic)
3. Modify `src/red-team/patch-generator.js`
4. Modify `src/red-team/index.js`
5. Modify `src/tui-menu.js`
6. Test with mock LLM
7. Test with real LLM
8. Integration test full cycle
