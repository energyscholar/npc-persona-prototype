/**
 * AGM Controller - AI Game Master prompt building and response parsing
 *
 * Pattern: Controller - mediates between player input and AGM responses
 * Builds context-rich prompts and parses embedded directives
 */

const { getCurrentScene, buildSceneControlContext } = require('./scene-manager');
const { buildDecisionContext, getDecisionSummary } = require('./decision-tracker');
const { buildExtendedContext } = require('./prompt-extensions');
const { getWorld, buildWorldContext } = require('./subsector-data');

/**
 * Directive patterns in AGM responses
 */
const DIRECTIVE_PATTERNS = {
  SKILL_CHECK: /\[SKILL_CHECK:\s*(\w+)\s+(\d+)\+\s*(.+?)\]/,
  NPC_DIALOGUE: /\[NPC_DIALOGUE:\s*([a-z0-9-]+)\]/i,
  BEAT_COMPLETE: /\[BEAT_COMPLETE:\s*([a-z0-9-_]+)\]/i,
  NEXT_SCENE: /\[NEXT_SCENE:\s*([a-z0-9-]+)\]/i,
  SCENE: /\[SCENE:\s*([a-z0-9-]+)(?:\s*,\s*TIME:\s*\+?(\d+)([dhw]))?\]/i,
  FLASHBACK: /\[FLASHBACK:\s*([a-z0-9-]+)\]/i,
  DECISION: /\[DECISION:\s*([a-z0-9-_]+)\s*=\s*(.+?)\]/i
};

/**
 * Known world names in the adventure to detect in scene settings
 * These are the key worlds for the High and Dry adventure
 */
const KNOWN_WORLDS = ['567-908', 'Walston', 'Flammarion'];

/**
 * Extract world names from scene setting or title
 * @param {Object} scene - Scene data
 * @returns {string[]} Array of detected world names
 */
function extractWorldsFromScene(scene) {
  if (!scene) return [];

  const worlds = [];
  const textToSearch = [
    scene.setting || '',
    scene.title || '',
    scene.description || ''
  ].join(' ');

  for (const world of KNOWN_WORLDS) {
    if (textToSearch.includes(world)) {
      worlds.push(world);
    }
  }

  return worlds;
}

/**
 * Build world context injection for narrator
 * @param {Object} scene - Current scene
 * @returns {string} World context or empty string
 */
function buildWorldContextInjection(scene) {
  const worlds = extractWorldsFromScene(scene);
  if (worlds.length === 0) return '';

  const contexts = [];
  for (const worldName of worlds) {
    const ctx = buildWorldContext(worldName);
    if (ctx) contexts.push(ctx);
  }

  return contexts.join('\n\n');
}

/**
 * Build PC context for AGM prompt
 * @param {Object} pc - PC data
 * @returns {string} Formatted PC context
 */
function buildPCContext(pc) {
  if (!pc) return 'No PC loaded.';

  let context = `Name: ${pc.name}\n`;
  context += `Background: ${pc.background || 'Unknown'}\n`;

  if (pc.characteristics) {
    const chars = Object.entries(pc.characteristics)
      .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
      .join(', ');
    context += `Characteristics: ${chars}\n`;
  }

  if (pc.skills && pc.skills.length > 0) {
    const skills = pc.skills
      .map(s => `${s.name}-${s.level}`)
      .join(', ');
    context += `Skills: ${skills}\n`;
  }

  return context;
}

/**
 * Build full AGM prompt for a player action
 * @param {Object} session - Adventure session
 * @param {string} playerAction - What the player said/did
 * @returns {string} Complete AGM prompt
 */
function buildAgmPrompt(session, playerAction) {
  const scene = getCurrentScene(session);
  const sceneTitle = scene?.title || session.storyState.currentScene;
  const scenePrompt = scene?.narrator_prompt || '';
  const objectives = scene?.objectives?.join(', ') || 'Continue the story';
  const npcsPresent = scene?.npcs_present?.join(', ') || 'none';

  // Build the complete prompt
  let prompt = `
=== CURRENT STATE ===
Adventure: ${session.adventure.title}
Act: ${session.storyState.currentAct || 'act-1'}
Scene: ${sceneTitle}
Game Date: ${session.storyState.gameDate || '001-1105'}
Completed Beats: ${(session.storyState.completedBeats || []).join(', ') || 'none'}

=== SCENE CONTEXT ===
${scenePrompt}

Objectives: ${objectives}
NPCs Present: ${npcsPresent}

${buildWorldContextInjection(scene)}

=== PLAYER CHARACTER ===
${buildPCContext(session.pc)}

${buildDecisionContext(session.storyState)}

${buildSceneControlContext(session)}

=== STORY FLAGS ===
${formatFlags(session.storyState.flags)}

=== PLAYER ACTION ===
${playerAction}

=== YOUR TASK ===
Narrate what happens in response to the player's action. You may:
- Describe the outcome narratively (most common)
- Call for [SKILL_CHECK: skill difficulty+ reason] if outcome genuinely uncertain
- Switch to [NPC_DIALOGUE: npc-id] for extended NPC conversation
- Mark [BEAT_COMPLETE: beat-id] when an objective is achieved
- Advance to [SCENE: scene-id] or [SCENE: scene-id, TIME: +Xd] when scene is complete
- Record [DECISION: decision-id = choice-made] for major player choices

Respond in character as the narrator. Be vivid but concise.
Do NOT use dice for routine actions - only when outcome is genuinely in doubt.
`;

  return prompt;
}

/**
 * Format story flags for display
 * @param {Object} flags - Story flags
 * @returns {string} Formatted flags
 */
function formatFlags(flags) {
  if (!flags || Object.keys(flags).length === 0) {
    return 'None set.';
  }
  return Object.entries(flags)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
}

/**
 * Parse AGM response for embedded directives
 * @param {string} response - AGM response text
 * @returns {Object} Parsed result with narrative and directives
 */
function parseAgmResponse(response) {
  const result = {
    narrativeText: response,
    skillCheck: null,
    enterNpcDialogue: false,
    npcId: null,
    beatComplete: null,
    advanceScene: false,
    nextSceneId: null,
    timeSkip: null,
    isFlashback: false,
    decision: null
  };

  // Extract [SKILL_CHECK: Athletics 8+ climbing]
  const skillMatch = response.match(DIRECTIVE_PATTERNS.SKILL_CHECK);
  if (skillMatch) {
    result.skillCheck = {
      skill: skillMatch[1],
      difficulty: parseInt(skillMatch[2], 10),
      reason: skillMatch[3].trim()
    };
    result.narrativeText = result.narrativeText.replace(skillMatch[0], '').trim();
  }

  // Extract [NPC_DIALOGUE: npc-id]
  const npcMatch = response.match(DIRECTIVE_PATTERNS.NPC_DIALOGUE);
  if (npcMatch) {
    result.enterNpcDialogue = true;
    result.npcId = npcMatch[1];
    result.narrativeText = result.narrativeText.replace(npcMatch[0], '').trim();
  }

  // Extract [BEAT_COMPLETE: beat-id]
  const beatMatch = response.match(DIRECTIVE_PATTERNS.BEAT_COMPLETE);
  if (beatMatch) {
    result.beatComplete = beatMatch[1];
    result.narrativeText = result.narrativeText.replace(beatMatch[0], '').trim();
  }

  // Extract [SCENE: scene-id, TIME: +3d] or [NEXT_SCENE: scene-id]
  const sceneMatch = response.match(DIRECTIVE_PATTERNS.SCENE);
  if (sceneMatch) {
    result.advanceScene = true;
    result.nextSceneId = sceneMatch[1];
    if (sceneMatch[2] && sceneMatch[3]) {
      result.timeSkip = {
        amount: parseInt(sceneMatch[2], 10),
        unit: sceneMatch[3]
      };
    }
    result.narrativeText = result.narrativeText.replace(sceneMatch[0], '').trim();
  } else {
    const nextMatch = response.match(DIRECTIVE_PATTERNS.NEXT_SCENE);
    if (nextMatch) {
      result.advanceScene = true;
      result.nextSceneId = nextMatch[1];
      result.narrativeText = result.narrativeText.replace(nextMatch[0], '').trim();
    }
  }

  // Extract [FLASHBACK: scene-id]
  const flashbackMatch = response.match(DIRECTIVE_PATTERNS.FLASHBACK);
  if (flashbackMatch) {
    result.advanceScene = true;
    result.nextSceneId = flashbackMatch[1];
    result.isFlashback = true;
    result.narrativeText = result.narrativeText.replace(flashbackMatch[0], '').trim();
  }

  // Extract [DECISION: decision-id = choice-made]
  const decisionMatch = response.match(DIRECTIVE_PATTERNS.DECISION);
  if (decisionMatch) {
    result.decision = {
      id: decisionMatch[1],
      choice: decisionMatch[2].trim()
    };
    result.narrativeText = result.narrativeText.replace(decisionMatch[0], '').trim();
  }

  // Clean up narrative text
  result.narrativeText = result.narrativeText
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return result;
}

/**
 * Build NPC transition prompt
 * @param {Object} session - Adventure session
 * @param {Object} npc - NPC persona
 * @returns {string} Transition prompt
 */
function buildNpcTransitionPrompt(session, npc) {
  return `
You are now speaking with ${npc.name}.
Context: ${getCurrentScene(session)?.title || 'Unknown scene'}

The player has initiated conversation. Respond as ${npc.name} would,
based on your personality and knowledge. Stay in character.
`;
}

/**
 * Build AGM resume prompt after NPC dialogue
 * @param {Object} session - Adventure session
 * @param {string} npcName - NPC that was speaking
 * @returns {string} Resume prompt
 */
function buildResumePrompt(session, npcName) {
  return `
The player has concluded their conversation with ${npcName}.
Continue narrating the scene. What happens next?
Consider any commitments or information exchanged during the dialogue.
`;
}

module.exports = {
  buildAgmPrompt,
  buildPCContext,
  parseAgmResponse,
  buildNpcTransitionPrompt,
  buildResumePrompt,
  formatFlags,
  DIRECTIVE_PATTERNS
};
