/**
 * AGM State Manager
 * Manages orchestration state for adventure scenes
 */

const path = require('path');
const fs = require('fs');

/**
 * Create initial AGM state for a session
 * @param {Object} session - Adventure session
 * @returns {Object} AGM state object
 */
function createAgmState(session) {
  return {
    adventureId: session.adventure?.id || 'unknown',
    scene: {
      id: null,
      objectives: [],
      tensions: []
    },
    npcs: {},
    sharedKnowledge: {},
    narratorDirectives: {
      pacing: 'normal',
      npcToFeature: null
    }
  };
}

/**
 * Update AGM state with scene context
 * @param {Object} agmState - AGM state to update
 * @param {Object} scene - Scene data
 * @param {Object} storyState - Current story state
 */
function updateSceneContext(agmState, scene, storyState) {
  if (!scene) return;

  // Update scene info
  agmState.scene = {
    id: scene.id,
    objectives: scene.objectives || [],
    tensions: scene.tensions || []
  };

  // Initialize NPC entries for NPCs present
  if (scene.npcs_present) {
    for (const npcId of scene.npcs_present) {
      if (!agmState.npcs[npcId]) {
        agmState.npcs[npcId] = {
          sceneRole: getSceneRole(scene, npcId),
          urgency: 0.5,
          knownFacts: [],
          behaviorHints: []
        };
      }
    }
  }

  // Update pacing based on story state
  if (storyState?.flags?.volcano_active) {
    agmState.narratorDirectives.pacing = 'urgent';
  }
}

/**
 * Get NPC's role in the scene from injection rules
 */
function getSceneRole(scene, npcId) {
  if (scene.npc_injection_rules && scene.npc_injection_rules[npcId]) {
    return scene.npc_injection_rules[npcId].demeanor || 'present';
  }
  return 'present';
}

/**
 * Compute goal urgency for an NPC
 * @param {Object} agmState - AGM state
 * @param {string} npcId - NPC ID
 * @param {string[]} npcGoals - NPC's goals
 * @param {Object} storyState - Story state
 * @returns {number} Urgency value 0.0-1.0
 */
function computeGoalUrgency(agmState, npcId, npcGoals, storyState) {
  let baseUrgency = 0.5;

  // Increase urgency for crisis situations
  if (storyState?.flags?.volcano_active) {
    baseUrgency += 0.3;
  }

  // NPC-specific urgency modifiers
  if (npcId === 'vargr-chauffeur' && storyState?.flags?.volcano_active) {
    baseUrgency += 0.15; // Kira is especially urgent during crisis
  }

  // Cap at 1.0
  return Math.min(1.0, Math.max(0.0, baseUrgency));
}

/**
 * Build narrator directives string
 * @param {Object} agmState - AGM state
 * @returns {string} Directives for narrator prompt
 */
function buildNarratorDirectives(agmState) {
  let directives = '=== NARRATOR DIRECTIVES ===\n';

  directives += `Scene: ${agmState.scene.id || 'unknown'}\n`;
  directives += `Pacing: ${agmState.narratorDirectives.pacing}\n`;

  if (agmState.scene.objectives.length > 0) {
    directives += `\nScene Objectives:\n`;
    for (const obj of agmState.scene.objectives) {
      directives += `- ${obj}\n`;
    }
  }

  if (agmState.narratorDirectives.npcToFeature) {
    directives += `\nFeature NPC: ${agmState.narratorDirectives.npcToFeature}\n`;
  }

  return directives;
}

/**
 * Build NPC-specific directives
 * @param {Object} agmState - AGM state
 * @param {string} npcId - NPC ID
 * @returns {string} Directives for NPC prompt
 */
function buildNpcDirectives(agmState, npcId) {
  const npcState = agmState.npcs[npcId];
  if (!npcState) {
    return '=== SCENE GUIDANCE ===\nNo specific scene context.\n';
  }

  let directives = '=== SCENE GUIDANCE ===\n';

  directives += `Scene: ${agmState.scene.id || 'unknown'}\n`;
  directives += `Your role: ${npcState.sceneRole}\n`;
  directives += `Urgency: ${npcState.urgency.toFixed(1)}\n`;

  if (agmState.scene.objectives.length > 0) {
    directives += `\nScene is about:\n`;
    for (const obj of agmState.scene.objectives) {
      directives += `- ${obj}\n`;
    }
  }

  if (npcState.knownFacts.length > 0) {
    directives += `\nYou know:\n`;
    for (const fact of npcState.knownFacts) {
      directives += `- ${fact}\n`;
    }
  }

  if (npcState.behaviorHints.length > 0) {
    directives += `\nBehavior hints:\n`;
    for (const hint of npcState.behaviorHints) {
      directives += `- ${hint}\n`;
    }
  }

  return directives;
}

/**
 * Propagate knowledge from one NPC to others in scene
 * @param {Object} agmState - AGM state
 * @param {string} sourceNpcId - NPC who revealed the fact
 * @param {string} fact - The fact to propagate
 */
function propagateKnowledge(agmState, sourceNpcId, fact) {
  // Record in shared knowledge
  agmState.sharedKnowledge[fact] = {
    source: sourceNpcId,
    witnesses: []
  };

  // Add to all other NPCs' known facts
  for (const [npcId, npcState] of Object.entries(agmState.npcs)) {
    if (npcId !== sourceNpcId) {
      if (!npcState.knownFacts.includes(fact)) {
        npcState.knownFacts.push(fact);
      }
      agmState.sharedKnowledge[fact].witnesses.push(npcId);
    }
  }
}

module.exports = {
  createAgmState,
  updateSceneContext,
  computeGoalUrgency,
  buildNarratorDirectives,
  buildNpcDirectives,
  propagateKnowledge
};
