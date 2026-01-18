/**
 * Narrative Tracker - Track stage-level narrative progress
 *
 * Manages obstacle resolutions, discoveries, and stage completion
 * for rich narrative context injection.
 */

/**
 * Initialize stage progress structure if not present
 * @param {Object} storyState - Story state object
 * @param {string} sceneId - Scene identifier
 * @param {string} stageId - Stage identifier
 */
function initStageProgress(storyState, sceneId, stageId) {
  if (!storyState.stageProgress) {
    storyState.stageProgress = {};
  }
  if (!storyState.stageProgress[sceneId]) {
    storyState.stageProgress[sceneId] = {};
  }
  if (!storyState.stageProgress[sceneId][stageId]) {
    storyState.stageProgress[sceneId][stageId] = {
      completed: false,
      obstacleResolved: null,
      discoveries: []
    };
  }
}

/**
 * Record how an obstacle was resolved
 * @param {Object} storyState - Story state object
 * @param {string} sceneId - Scene identifier
 * @param {string} stageId - Stage identifier
 * @param {string} resolution - Resolution method used
 */
function recordObstacleResolution(storyState, sceneId, stageId, resolution) {
  initStageProgress(storyState, sceneId, stageId);
  storyState.stageProgress[sceneId][stageId].obstacleResolved = resolution;
}

/**
 * Record a discovery found by the player
 * @param {Object} storyState - Story state object
 * @param {string} sceneId - Scene identifier
 * @param {string} stageId - Stage identifier
 * @param {string} discoveryId - Discovery identifier
 */
function recordDiscovery(storyState, sceneId, stageId, discoveryId) {
  initStageProgress(storyState, sceneId, stageId);
  const progress = storyState.stageProgress[sceneId][stageId];
  if (!progress.discoveries.includes(discoveryId)) {
    progress.discoveries.push(discoveryId);
  }
}

/**
 * Mark a stage as completed
 * @param {Object} storyState - Story state object
 * @param {string} sceneId - Scene identifier
 * @param {string} stageId - Stage identifier
 */
function markStageCompleted(storyState, sceneId, stageId) {
  initStageProgress(storyState, sceneId, stageId);
  storyState.stageProgress[sceneId][stageId].completed = true;
}

/**
 * Get progress for a specific stage
 * @param {Object} storyState - Story state object
 * @param {string} sceneId - Scene identifier
 * @param {string} stageId - Stage identifier
 * @returns {Object} Stage progress object
 */
function getStageProgress(storyState, sceneId, stageId) {
  initStageProgress(storyState, sceneId, stageId);
  return storyState.stageProgress[sceneId][stageId];
}

/**
 * Get all completed stages for a scene
 * @param {Object} storyState - Story state object
 * @param {string} sceneId - Scene identifier
 * @returns {Array} Array of {stageId, progress} objects for completed stages
 */
function getCompletedStagesProgress(storyState, sceneId) {
  if (!storyState.stageProgress || !storyState.stageProgress[sceneId]) {
    return [];
  }

  const sceneProgress = storyState.stageProgress[sceneId];
  return Object.entries(sceneProgress)
    .filter(([_, progress]) => progress.completed)
    .map(([stageId, progress]) => ({ stageId, ...progress }));
}

module.exports = {
  initStageProgress,
  recordObstacleResolution,
  recordDiscovery,
  markStageCompleted,
  getStageProgress,
  getCompletedStagesProgress
};
