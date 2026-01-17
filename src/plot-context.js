/**
 * Plot Context Builder
 * Builds plot/story context strings for NPC prompts.
 *
 * Pattern: Builder - constructs complex context strings step-by-step
 */

const { getBeatSummary } = require('./beat-summaries');

/**
 * Build plot context for NPC based on story state and NPC config
 * @param {Object} storyState - Current story state
 * @param {Object} npcConfig - NPC persona config
 * @param {Object} [pc] - Optional PC data for identity injection
 * @returns {string} Plot context string
 */
function buildPlotContext(storyState, npcConfig, pc = null) {
  if (!storyState || !npcConfig) return '';

  const scope = npcConfig.plotAwareness?.scope || 'scene';
  const knowsAbout = npcConfig.plotAwareness?.knowsAbout || [];
  const beatReactions = npcConfig.plotAwareness?.beatReactions || {};
  const isNarrator = npcConfig.archetype === 'narrator';

  let context = '\n=== ADVENTURE STATE ===\n';

  // 1. PC Identity (for narrator or if scope allows)
  if (pc && (isNarrator || ['adventure', 'act'].includes(scope))) {
    context += `\nPLAYER CHARACTER: ${pc.name}\n`;
    if (pc.background) {
      context += `Background: ${pc.background}\n`;
    }
    if (pc.motivations && Array.isArray(pc.motivations)) {
      context += `Motivations: ${pc.motivations.join(', ')}\n`;
    }
  }

  // 2. Adventure position
  if (['adventure', 'act'].includes(scope) || isNarrator) {
    if (storyState.adventure) {
      context += `\nAdventure: ${storyState.adventure}\n`;
    }
    if (storyState.currentAct) {
      context += `Current Act: ${storyState.currentAct}\n`;
    }
  }

  // Add scene context
  if (storyState.currentScene) {
    context += `Current Scene: ${storyState.currentScene}\n`;
  }

  // 3. Current game date
  if (storyState.gameDate) {
    context += `Current Date: ${storyState.gameDate}\n`;
  }

  // 4. Completed beats as narrative (especially for narrator)
  const completedBeats = storyState.completedBeats || [];
  if (completedBeats.length > 0 && (isNarrator || ['adventure', 'act'].includes(scope))) {
    context += `\nWHAT HAS ALREADY HAPPENED:\n`;
    let hasSummaries = false;
    for (const beatId of completedBeats) {
      const summary = getBeatSummary(beatId, storyState.adventure);
      if (summary) {
        context += `- ${summary}\n`;
        hasSummaries = true;
      }
    }
    if (hasSummaries) {
      context += `\nDo not re-narrate these events. Continue from the current scene.\n`;
    }
  }

  // 5. Beat reactions (NPC-specific responses to story events)
  for (const beatId of completedBeats) {
    if (beatReactions[beatId]) {
      context += `[React to: ${beatReactions[beatId]}]\n`;
    }
  }

  // 6. Relevant flags the NPC would know about
  if (knowsAbout.length > 0 && storyState.flags) {
    context += '\nFacts you know:\n';
    for (const topic of knowsAbout) {
      if (storyState.flags[topic] !== undefined) {
        context += `- ${topic}: ${storyState.flags[topic]}\n`;
      }
    }
  }

  return context;
}

module.exports = {
  buildPlotContext
};
