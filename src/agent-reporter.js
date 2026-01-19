/**
 * Agent Reporter - Generate playthrough reports from agent history
 *
 * Analyzes agent play history and generates actionable reports.
 */

/**
 * Generate a playthrough report from agent history
 * @param {Object[]} history - Array of logged entries { action, observation, result }
 * @param {Object} status - Completion status { completed, stuck, maxTurnsReached }
 * @returns {Object} Structured report
 */
function generateReport(history, status = {}) {
  const turns = history.length;

  // Determine result
  let result = 'abandoned';
  if (status.completed) {
    result = 'completed';
  } else if (status.stuck) {
    result = 'stuck';
  } else if (status.maxTurnsReached) {
    result = 'failed';
  }

  // Extract unique scenes visited
  const scenesVisited = extractScenesVisited(history);

  // Extract flags acquired
  const flagsAcquired = extractFlagsAcquired(history);

  // Extract concerns (filter out "none")
  const concerns = extractConcerns(history);

  // Analyze NPC interactions
  const npcInteractions = analyzeNpcInteractions(history);

  // Build timeline summary
  const timeline = buildTimeline(history);

  return {
    result,
    turns,
    scenesVisited,
    flagsAcquired,
    concerns,
    npcInteractions,
    timeline
  };
}

/**
 * Extract unique scenes visited from history
 * @param {Object[]} history
 * @returns {string[]}
 */
function extractScenesVisited(history) {
  const scenes = new Set();

  for (const entry of history) {
    const observation = entry.observation || {};
    const scene = observation.scene || {};
    if (scene.id) {
      scenes.add(scene.id);
    }
  }

  return [...scenes];
}

/**
 * Extract flags acquired during play
 * @param {Object[]} history
 * @returns {string[]}
 */
function extractFlagsAcquired(history) {
  const flags = new Set();

  for (const entry of history) {
    const observation = entry.observation || {};
    const activeFlags = observation.flags || [];

    for (const flag of activeFlags) {
      flags.add(flag);
    }
  }

  return [...flags];
}

/**
 * Extract concerns raised by the agent (filter out "none")
 * @param {Object[]} history
 * @returns {Object[]}
 */
function extractConcerns(history) {
  const concerns = [];

  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    const action = entry.action || {};
    const concernText = action.concerns || '';

    // Filter out "none" and empty concerns
    if (concernText &&
        concernText.toLowerCase() !== 'none' &&
        concernText.trim() !== '') {
      const observation = entry.observation || {};
      const scene = observation.scene || {};

      concerns.push({
        turn: entry.turn || i + 1,
        scene: scene.id || 'unknown',
        issue: concernText
      });
    }
  }

  return concerns;
}

/**
 * Analyze NPC interactions from history
 * @param {Object[]} history
 * @returns {Object}
 */
function analyzeNpcInteractions(history) {
  const interactions = {};

  for (const entry of history) {
    const action = entry.action || {};
    const actionStr = typeof action === 'string' ? action : (action.action || '');

    // Check for talk actions
    if (actionStr.startsWith && actionStr.startsWith('talk ')) {
      const parts = actionStr.split(' ');
      const npcId = parts[1];

      if (npcId) {
        if (!interactions[npcId]) {
          interactions[npcId] = { turns: 0, messages: [] };
        }
        interactions[npcId].turns++;
      }
    }
  }

  return interactions;
}

/**
 * Build timeline summary from history
 * @param {Object[]} history
 * @returns {Object[]}
 */
function buildTimeline(history) {
  return history.map((entry, i) => {
    const observation = entry.observation || {};
    const scene = observation.scene || {};
    const action = entry.action || {};
    const result = entry.result || {};

    // Summarize the action
    let actionStr = '';
    if (typeof action === 'string') {
      actionStr = action;
    } else if (action.action) {
      actionStr = action.action;
    }

    return {
      turn: entry.turn || i + 1,
      scene: scene.id || 'unknown',
      action: actionStr,
      summary: result.message || ''
    };
  });
}

/**
 * Format report as human-readable text
 * @param {Object} report - Generated report
 * @returns {string}
 */
function formatReportText(report) {
  let text = `
═══════════════════════════════════════════════
  AUTONOMOUS PLAYTHROUGH REPORT
═══════════════════════════════════════════════

Result: ${report.result.toUpperCase()}
Turns: ${report.turns}

SCENES VISITED (${report.scenesVisited.length}):
${report.scenesVisited.map(s => `  • ${s}`).join('\n') || '  (none)'}

FLAGS ACQUIRED (${report.flagsAcquired.length}):
${report.flagsAcquired.map(f => `  • ${f}`).join('\n') || '  (none)'}
`;

  if (report.concerns.length > 0) {
    text += `
CONCERNS RAISED (${report.concerns.length}):
${report.concerns.map(c => `  Turn ${c.turn} [${c.scene}]: ${c.issue}`).join('\n')}
`;
  }

  const npcIds = Object.keys(report.npcInteractions);
  if (npcIds.length > 0) {
    text += `
NPC INTERACTIONS:
${npcIds.map(npc => `  • ${npc}: ${report.npcInteractions[npc].turns} turns`).join('\n')}
`;
  }

  text += `
═══════════════════════════════════════════════
`;

  return text;
}

/**
 * Format report as JSON
 * @param {Object} report - Generated report
 * @param {boolean} [pretty=true] - Pretty print
 * @returns {string}
 */
function formatReportJson(report, pretty = true) {
  return pretty
    ? JSON.stringify(report, null, 2)
    : JSON.stringify(report);
}

module.exports = {
  generateReport,
  extractScenesVisited,
  extractFlagsAcquired,
  extractConcerns,
  analyzeNpcInteractions,
  buildTimeline,
  formatReportText,
  formatReportJson
};
