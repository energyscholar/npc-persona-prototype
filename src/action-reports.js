/**
 * Action Reports Module
 * Visibility and reporting system for NPC actions.
 *
 * Pattern: Observer - PCs subscribe to action events
 */

/**
 * Visibility levels for action reports
 */
const VISIBILITY_LEVELS = {
  direct: 'direct',       // Only visible to targeted PC
  witnessed: 'witnessed', // Visible to all PCs
  rumor: 'rumor',        // May reach some PCs
  discovery: 'discovery', // Only visible if PC investigates
  hidden: 'hidden'        // Never visible
};

// Report queue (in-memory)
let reportQueue = [];

/**
 * Generate an action report
 * @param {Object} action - Action that was performed
 * @param {Object} npc - NPC that performed action
 * @param {Object} result - Action result
 * @returns {Object|null} Report object or null for hidden actions
 */
function generateActionReport(action, npc, result) {
  if (!action || !npc) return null;

  const visibility = action.visibility || 'witnessed';

  // Hidden actions don't generate reports
  if (visibility === 'hidden') return null;

  return {
    actionId: action.id,
    npcId: npc.id,
    npcName: npc.name,
    visibility: visibility,
    targetPc: action.targetPc || null,
    success: result?.success ?? true,
    message: result?.message || '',
    timestamp: new Date().toISOString()
  };
}

/**
 * Queue a report for delivery
 * @param {Object} report - Report to queue
 */
function queueReport(report) {
  if (!report) return;
  reportQueue.push(report);
}

/**
 * Get all queued reports
 * @returns {Object[]}
 */
function getQueuedReports() {
  return [...reportQueue];
}

/**
 * Clear all reports
 */
function clearReports() {
  reportQueue = [];
}

/**
 * Get reports visible to a specific PC
 * @param {string} pcId - PC identifier
 * @returns {Object[]} Reports visible to this PC
 */
function getReportsForPc(pcId) {
  if (!pcId) return [];

  return reportQueue.filter(report => {
    switch (report.visibility) {
      case VISIBILITY_LEVELS.direct:
        // Direct messages only visible to target
        return report.targetPc === pcId;

      case VISIBILITY_LEVELS.witnessed:
        // Witnessed by all
        return true;

      case VISIBILITY_LEVELS.rumor:
        // Rumors visible to all for now (could add probability)
        return true;

      case VISIBILITY_LEVELS.discovery:
        // Discovery requires explicit discovery flag
        return report.discovered === true;

      case VISIBILITY_LEVELS.hidden:
        // Never visible
        return false;

      default:
        return false;
    }
  });
}

/**
 * Format a report as human-readable message
 * @param {Object} report - Report to format
 * @returns {string}
 */
function formatReportMessage(report) {
  if (!report) return '';

  const npcName = report.npcName || report.npcId || 'Unknown NPC';
  const action = report.actionId || 'unknown action';

  switch (report.visibility) {
    case VISIBILITY_LEVELS.direct:
      if (report.message) {
        return `[Direct] ${npcName}: ${report.message}`;
      }
      return `[Direct] ${npcName} contacted you regarding ${action}.`;

    case VISIBILITY_LEVELS.witnessed:
      if (report.message) {
        return `${npcName}: ${report.message}`;
      }
      if (report.success) {
        return `${npcName} completed ${action.replace(/-/g, ' ')}.`;
      }
      return `${npcName} attempted ${action.replace(/-/g, ' ')} but failed.`;

    case VISIBILITY_LEVELS.rumor:
      return `[Rumor] You hear that ${npcName} may have been involved in ${action.replace(/-/g, ' ')}.`;

    case VISIBILITY_LEVELS.discovery:
      return `[Discovery] Investigation reveals ${npcName} performed ${action.replace(/-/g, ' ')}.`;

    default:
      return report.message || `${npcName} performed ${action}.`;
  }
}

module.exports = {
  VISIBILITY_LEVELS,
  generateActionReport,
  queueReport,
  getQueuedReports,
  clearReports,
  getReportsForPc,
  formatReportMessage
};
