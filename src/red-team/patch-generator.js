/**
 * Patch Generator - Generate and apply knowledge_base patches for NPCs
 *
 * Part of red team validation system for NPC fact-checking.
 */

const fs = require('fs');
const path = require('path');
const { getFact, loadFacts } = require('./fact-database');

const NPCS_DIR = path.join(__dirname, '../../data/npcs');
const PATCHES_DIR = path.join(__dirname, '../../data/red-team/patches');

/**
 * Generate patches from validation report
 * @param {Object} report - Validation report from validator
 * @returns {Array} Array of patch objects
 */
function generatePatchesFromReport(report) {
  const patches = [];

  for (const result of report.results) {
    if (result.suggested_patch) {
      patches.push({
        npc_id: report.npc_id,
        query_id: result.query_id,
        fact_id: result.fact_id,
        field: result.suggested_patch.field,
        value: result.suggested_patch.value,
        keywords: result.suggested_patch.keywords_to_include,
        reason: result.suggested_patch.reason,
        timestamp: new Date().toISOString()
      });
    }
  }

  return patches;
}

/**
 * Generate a knowledge_base entry from a fact
 * @param {Object} fact - Fact from database
 * @param {string} [topic] - Topic key for knowledge_base
 * @returns {Object} { topic, content }
 */
function generateKnowledgeEntry(fact, topic = null) {
  // Determine topic from fact category if not provided
  if (!topic) {
    const categoryTopics = {
      ship_mission: 'mission_context',
      walston_world: 'walston_info',
      customs_starport: 'customs_procedure',
      social_cultural: 'local_customs',
      plot_timeline: 'timeline'
    };
    topic = categoryTopics[fact.category] || 'general_knowledge';
  }

  return {
    topic,
    content: fact.content
  };
}

/**
 * Apply a patch to an NPC JSON file
 * @param {string} npcId - NPC identifier
 * @param {string} field - Field to patch (e.g., 'knowledge_base.ship_ownership')
 * @param {string} value - Value to set
 * @param {Object} options - { dryRun: boolean, backup: boolean }
 * @returns {Object} { success, message, backup_path }
 */
function applyPatch(npcId, field, value, options = {}) {
  const { dryRun = false, backup = true } = options;
  const npcFile = path.join(NPCS_DIR, `${npcId}.json`);

  if (!fs.existsSync(npcFile)) {
    return { success: false, message: `NPC file not found: ${npcId}` };
  }

  try {
    const npcData = JSON.parse(fs.readFileSync(npcFile, 'utf8'));

    // Parse field path (e.g., 'knowledge_base.ship_ownership')
    const parts = field.split('.');
    let target = npcData;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!target[parts[i]]) {
        target[parts[i]] = {};
      }
      target = target[parts[i]];
    }

    const finalKey = parts[parts.length - 1];
    const existingValue = target[finalKey];

    if (existingValue && existingValue !== value) {
      // Merge existing with new info
      target[finalKey] = existingValue + ' ' + value;
    } else {
      target[finalKey] = value;
    }

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        message: `[DRY RUN] Would set ${field} = ${value.slice(0, 50)}...`
      };
    }

    // Create backup
    let backupPath = null;
    if (backup) {
      if (!fs.existsSync(PATCHES_DIR)) {
        fs.mkdirSync(PATCHES_DIR, { recursive: true });
      }
      backupPath = path.join(PATCHES_DIR, `${npcId}-backup-${Date.now()}.json`);
      fs.writeFileSync(backupPath, fs.readFileSync(npcFile));
    }

    // Write patched file
    fs.writeFileSync(npcFile, JSON.stringify(npcData, null, 2));

    return {
      success: true,
      message: `Patched ${field} in ${npcId}`,
      backup_path: backupPath
    };
  } catch (e) {
    return { success: false, message: `Error patching ${npcId}: ${e.message}` };
  }
}

/**
 * Apply all patches from a list
 * @param {Array} patches - Array of patch objects
 * @param {Object} options - { dryRun, backup, stopOnError }
 * @returns {Object} { applied, failed, results }
 */
function applyPatches(patches, options = {}) {
  const { stopOnError = false } = options;
  const results = {
    applied: 0,
    failed: 0,
    results: []
  };

  for (const patch of patches) {
    const result = applyPatch(patch.npc_id, patch.field, patch.value, options);
    results.results.push({
      patch,
      ...result
    });

    if (result.success) {
      results.applied++;
    } else {
      results.failed++;
      if (stopOnError) {
        break;
      }
    }
  }

  return results;
}

/**
 * Generate suggested patches for an NPC based on missing facts
 * @param {string} npcId - NPC identifier
 * @returns {Array} Suggested patches
 */
function suggestPatchesForNpc(npcId) {
  const npcFile = path.join(NPCS_DIR, `${npcId}.json`);

  if (!fs.existsSync(npcFile)) {
    return [];
  }

  const npcData = JSON.parse(fs.readFileSync(npcFile, 'utf8'));
  const db = loadFacts();
  const relevantFacts = db.byNpc[npcId] || [];
  const suggestions = [];

  const knowledgeBase = npcData.knowledge_base || {};
  const existingContent = Object.values(knowledgeBase).join(' ').toLowerCase();

  for (const fact of relevantFacts) {
    // Check if any expected keyword is missing from existing knowledge
    const missingKeywords = fact.keywords.filter(kw =>
      !existingContent.includes(kw.toLowerCase())
    );

    if (missingKeywords.length > 0) {
      const entry = generateKnowledgeEntry(fact);
      suggestions.push({
        npc_id: npcId,
        fact_id: fact.id,
        field: `knowledge_base.${entry.topic}`,
        value: fact.content,
        missing_keywords: missingKeywords,
        reason: `Missing keywords: ${missingKeywords.join(', ')}`
      });
    }
  }

  return suggestions;
}

/**
 * Save patches to a file for review
 * @param {Array} patches - Patches to save
 * @param {string} filename - Output filename
 */
function savePatchesForReview(patches, filename = 'pending-patches.json') {
  if (!fs.existsSync(PATCHES_DIR)) {
    fs.mkdirSync(PATCHES_DIR, { recursive: true });
  }

  const filepath = path.join(PATCHES_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify({
    generated: new Date().toISOString(),
    count: patches.length,
    patches
  }, null, 2));

  return filepath;
}

/**
 * Load pending patches for review
 * @param {string} filename - Patches file
 * @returns {Array} Patches
 */
function loadPendingPatches(filename = 'pending-patches.json') {
  const filepath = path.join(PATCHES_DIR, filename);

  if (!fs.existsSync(filepath)) {
    return [];
  }

  try {
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    return data.patches || [];
  } catch (e) {
    return [];
  }
}

/**
 * Format patches for display
 * @param {Array} patches - Patches to format
 * @returns {string} Formatted output
 */
function formatPatches(patches) {
  if (patches.length === 0) {
    return '  No patches to apply.\n';
  }

  const lines = [
    `\n  ${patches.length} patch(es) suggested:\n`
  ];

  for (const patch of patches) {
    lines.push(`  • ${patch.npc_id}: ${patch.field}`);
    lines.push(`    Value: ${patch.value.slice(0, 60)}...`);
    if (patch.reason) {
      lines.push(`    Reason: ${patch.reason}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = {
  generatePatchesFromReport,
  generateKnowledgeEntry,
  applyPatch,
  applyPatches,
  suggestPatchesForNpc,
  savePatchesForReview,
  loadPendingPatches,
  formatPatches,
  PATCHES_DIR
};
