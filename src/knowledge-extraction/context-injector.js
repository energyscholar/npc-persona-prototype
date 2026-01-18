/**
 * Context Injector - Inject scene-specific facts into narrator prompts
 *
 * Phase 3 of knowledge extraction pipeline.
 * Provides canonical scene data to prevent NPC hallucinations.
 */

const { loadFacts, PRIORITY } = require('./scene-extractor');
const { loadScene } = require('../story-engine');
const { slugifyStage } = require('../decision-tracker');

/**
 * Estimate token count (~4 chars per token)
 * @param {string} text - Text to estimate
 * @returns {number} Estimated tokens
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Cap facts to approximate token limit
 * @param {Array} facts - Facts to cap
 * @param {number} maxTokens - Maximum tokens (default 500)
 * @returns {Array} Capped facts array
 */
function capTokens(facts, maxTokens = 500) {
  const capped = [];
  let tokenCount = 0;

  for (const fact of facts) {
    const factTokens = estimateTokens(fact.content);
    if (tokenCount + factTokens > maxTokens) break;
    capped.push(fact);
    tokenCount += factTokens;
  }

  return capped;
}

/**
 * Format scene title from scene ID
 * @param {string} sceneId - Scene identifier
 * @returns {string} Formatted title
 */
function formatSceneTitle(sceneId) {
  return sceneId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format facts as bullet points
 * @param {Array} facts - Facts to format
 * @returns {string} Bullet-formatted string
 */
function formatFactBullets(facts) {
  return facts
    .map(f => `- ${f.content}`)
    .join('\n');
}

/**
 * Format complete scene context injection
 * @param {string} sceneId - Scene identifier
 * @param {Array} facts - Facts for this scene
 * @returns {string} Formatted injection string
 */
function formatSceneContext(sceneId, facts) {
  if (!facts || facts.length === 0) return '';

  const title = formatSceneTitle(sceneId);
  const bullets = formatFactBullets(facts);

  return `
=== CURRENT SCENE: ${title} ===
You have detailed knowledge of this location:
${bullets}

Use these SPECIFIC facts rather than inventing details.`;
}

/**
 * Filter facts to current scene
 * @param {Array} facts - All facts for adventure
 * @param {string} sceneId - Current scene ID
 * @returns {Array} Facts for this scene only
 */
function filterByScene(facts, sceneId) {
  if (!facts || !sceneId) return [];

  // Scene ID appears in source field as "scene-id.json:field"
  const scenePrefix = `${sceneId}.json`;

  return facts.filter(f => f.source && f.source.startsWith(scenePrefix));
}

/**
 * Filter facts to a specific stage within a scene
 * @param {Array} facts - Facts for a scene
 * @param {string} stageId - Stage slug ID (e.g., 'middle-ascent')
 * @returns {Array} Facts relevant to this stage
 */
function filterByStage(facts, stageId) {
  if (!facts || !stageId) return facts;

  // Stage facts have source like "scene.json:stages[N]"
  // Stage-specific facts also match altitude range or stage name in content

  // Map common stage slugs to their altitude keywords
  const stageAltitudes = {
    'lower-slopes': ['500', '900'],
    'middle-ascent': ['900', '1100'],
    'upper-slopes': ['1100', '1200'],
    'scramble-zone': ['1200', '1350'],
    'final-ascent': ['1350', '1400'],
    'crater-descent': ['crater', 'descent']
  };

  const altitudes = stageAltitudes[stageId] || [];
  const stageName = stageId.replace(/-/g, ' ');

  return facts.filter(f => {
    // Include non-stage facts (altitude sickness, ship condition, hazards, etc.)
    if (!f.source.includes('stages')) return true;

    // For stage facts, check if they match the current stage
    const content = (f.content || '').toLowerCase();
    const source = (f.source || '').toLowerCase();

    // Check if content mentions this stage's altitudes or name
    if (altitudes.some(alt => content.includes(alt))) return true;
    if (content.includes(stageName)) return true;

    // Check source index vs expected stage index
    const stageOrder = ['lower-slopes', 'middle-ascent', 'upper-slopes', 'scramble-zone', 'final-ascent', 'crater-descent'];
    const expectedIdx = stageOrder.indexOf(stageId);
    const sourceMatch = source.match(/stages\[(\d+)\]/);
    if (sourceMatch && parseInt(sourceMatch[1], 10) === expectedIdx) return true;

    return false;
  });
}

/**
 * Format stage narrative elements (objective, obstacle)
 * @param {Object} stage - Stage object from scene JSON
 * @returns {string} Formatted narrative elements
 */
function formatStageNarrative(stage) {
  if (!stage) return '';

  const parts = [];

  if (stage.objective) {
    parts.push(`OBJECTIVE: ${stage.objective}`);
  }

  if (stage.obstacle) {
    parts.push(`\nOBSTACLE: ${stage.obstacle.description}`);
    if (stage.obstacle.type) {
      parts.push(`- Type: ${stage.obstacle.type.charAt(0).toUpperCase() + stage.obstacle.type.slice(1)}`);
    }
    if (stage.obstacle.resolution) {
      parts.push(`- Resolution: ${stage.obstacle.resolution}`);
    }
  }

  if (stage.discoveries && stage.discoveries.length > 0) {
    parts.push('\nDISCOVERIES AVAILABLE:');
    for (const disc of stage.discoveries) {
      parts.push(`- [${disc.type}] ${disc.content}`);
    }
  }

  return parts.join('\n');
}

/**
 * Format prior progress for completed stages
 * @param {Object} storyState - Story state with stageProgress
 * @param {string} sceneId - Current scene ID
 * @param {Object} scene - Scene data with stages array
 * @returns {string} Formatted prior progress
 */
function formatPriorProgress(storyState, sceneId, scene) {
  if (!storyState.stageProgress || !storyState.stageProgress[sceneId]) {
    return '';
  }

  const sceneProgress = storyState.stageProgress[sceneId];
  const completedParts = [];

  for (const [stageId, progress] of Object.entries(sceneProgress)) {
    if (progress.completed) {
      // Find stage name from scene data
      let stageName = stageId;
      if (scene && scene.stages) {
        const stageData = scene.stages.find(s => slugifyStage(s.name) === stageId);
        if (stageData) stageName = stageData.name;
      }

      let line = `- Completed: ${stageName}`;
      if (progress.obstacleResolved) {
        line += ` (used ${progress.obstacleResolved} route)`;
      }
      completedParts.push(line);

      if (progress.discoveries && progress.discoveries.length > 0) {
        for (const discId of progress.discoveries) {
          completedParts.push(`- Found: ${discId}`);
        }
      }
    }
  }

  if (completedParts.length === 0) return '';

  return '\nPRIOR PROGRESS:\n' + completedParts.join('\n');
}

/**
 * Build scene context for injection into prompt
 * @param {Object} persona - NPC persona
 * @param {Object} storyState - Story state with currentScene, currentStage, and adventure
 * @returns {string} Scene context string (empty if not applicable)
 */
function buildSceneContext(persona, storyState) {
  // Only inject for narrators
  if (!persona || persona.archetype !== 'narrator') return '';

  // Only when scene is set
  if (!storyState || !storyState.currentScene) return '';

  // Need adventure ID to load facts
  if (!storyState.adventure) return '';

  // Load scene data for narrative elements
  let scene = null;
  let currentStageData = null;
  try {
    scene = loadScene(storyState.adventure, storyState.currentScene);
    if (scene && scene.stages && storyState.currentStage) {
      currentStageData = scene.stages.find(s => slugifyStage(s.name) === storyState.currentStage);
    }
  } catch (e) {
    // Scene loading failed, continue with facts only
  }

  // Load facts for adventure
  const allFacts = loadFacts(storyState.adventure);

  // Filter to current scene
  let sceneFacts = allFacts ? filterByScene(allFacts, storyState.currentScene) : [];

  // Filter by stage if one is selected
  if (storyState.currentStage && sceneFacts.length > 0) {
    sceneFacts = filterByStage(sceneFacts, storyState.currentStage);
  }

  // Filter to priority 1-2 only (skip flavor at priority 3)
  const relevantFacts = sceneFacts.filter(f => f.priority <= 2);

  // Sort by priority (mechanics first, then key facts)
  relevantFacts.sort((a, b) => a.priority - b.priority);

  // Cap at ~500 tokens
  const cappedFacts = capTokens(relevantFacts, 500);

  // Build context parts
  const parts = [];

  // Header with stage if set
  if (storyState.currentStage && currentStageData) {
    const altitudeInfo = currentStageData.altitude ? ` (${currentStageData.altitude})` : '';
    parts.push(`=== CURRENT STAGE: ${currentStageData.name}${altitudeInfo} ===`);

    // Add stage narrative elements
    const narrative = formatStageNarrative(currentStageData);
    if (narrative) parts.push(narrative);
  } else {
    const title = formatSceneTitle(storyState.currentScene);
    parts.push(`=== CURRENT SCENE: ${title} ===`);
  }

  // Add facts
  if (cappedFacts.length > 0) {
    parts.push('\nYou have detailed knowledge of this location:');
    parts.push(formatFactBullets(cappedFacts));
    parts.push('\nUse these SPECIFIC facts rather than inventing details.');
  }

  // Add prior progress
  const priorProgress = formatPriorProgress(storyState, storyState.currentScene, scene);
  if (priorProgress) {
    parts.push(priorProgress);
  }

  return parts.join('\n');
}

module.exports = {
  // Main entry point
  buildSceneContext,

  // Utilities (for testing)
  filterByScene,
  filterByStage,
  capTokens,
  formatSceneContext,
  formatSceneTitle,
  formatFactBullets,
  estimateTokens
};
