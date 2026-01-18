/**
 * Adventure Player - Main orchestrator for adventure play mode
 *
 * Pattern: Orchestrator - coordinates all adventure subsystems
 * Manages session state, routes inputs, and handles mode switching
 */

const { loadAdventure, createStoryState, loadScene, listScenes, loadActs } = require('./story-engine');
const { loadPersona, getPersonaSummary } = require('./persona');
const { loadPC, listPCs } = require('./pc-roster');
const { drawBoxWithHeader, centerText, displaySceneFrame } = require('./tui-menu');
const { createMemory, addMessage } = require('./memory');

// Stub functions for memory persistence (not yet implemented)
function loadMemory(npcId, pcId) { return null; }
function saveMemory(npcId, pcId, memory) { /* TODO: implement persistence */ }
const { assembleFullPrompt } = require('./prompts');
const { chat } = require('./ai-client');
const { buildAgmPrompt, parseAgmResponse, buildNpcTransitionPrompt, buildResumePrompt } = require('./agm-controller');
const { resolveCheck, formatDetailedResult } = require('./skill-resolver');
const { advanceToScene, markBeatComplete, executeFlashback, getCurrentScene } = require('./scene-manager');
const { recordDecision, saveStoryState, loadStoryState, setFlag } = require('./decision-tracker');
const { createAgmState, updateSceneContext } = require('./agm-state');
const { buildAgmContext, getNpcPriorities } = require('./agm-npc-bridge');
const { initializeInventory, addToInventory, hasItem, checkUnlock, getCargoItems, describeInventory } = require('./inventory');

/**
 * Adventure play modes
 */
const PLAY_MODES = {
  NARRATION: 'narration',     // AGM is narrating
  NPC_DIALOGUE: 'npc-dialogue' // In conversation with NPC
};

/**
 * Create a new adventure session
 * @param {string} adventureId - Adventure to load
 * @param {string} pcId - PC to use
 * @param {Object} client - API client
 * @returns {Object} Adventure session
 */
async function startAdventure(adventureId, pcId, client) {
  const adventure = loadAdventure(adventureId);
  const pc = loadPC(pcId);
  const agm = loadPersona(`narrator-${adventureId}`);

  // Load or create story state
  let storyState = loadStoryState(adventureId, pcId);
  if (!storyState) {
    storyState = createStoryState(adventureId);
    storyState.pcId = pcId;
    storyState.adventure = adventureId;

    // Set initial scene based on adventure
    if (!storyState.currentScene) {
      storyState.currentScene = adventure.startingScene || 'scout-office';
    }

    // Initialize inventory
    initializeInventory(storyState);
  }

  const session = {
    adventure,
    adventureId,
    pc,
    agm,
    storyState,
    client,
    mode: PLAY_MODES.NARRATION,
    activeNpc: null,
    npcMemory: null,
    conversationHistory: []
  };

  // Initialize AGM orchestration state
  session.agmState = createAgmState(session);

  return session;
}

/**
 * Get the opening narration for an adventure
 * @param {Object} session - Adventure session
 * @returns {string} Opening narrative
 */
async function getOpeningNarration(session) {
  const scene = getCurrentScene(session);
  if (scene?.narrator_prompt) {
    return scene.narrator_prompt + '\n\nWhat do you do?';
  }
  return `You are ${session.pc.name}. Your adventure begins.\n\nWhat do you do?`;
}

/**
 * Process player input in adventure mode
 * @param {Object} session - Adventure session
 * @param {string} input - Player input
 * @returns {Object} Response with text and any state changes
 */
async function processPlayerInput(session, input) {
  // Handle adventure-specific commands
  if (input.startsWith('/')) {
    return handleAdventureCommand(session, input);
  }

  // Route based on current mode
  if (session.mode === PLAY_MODES.NPC_DIALOGUE) {
    return handleNpcDialogue(session, input);
  }

  return handleAgmNarration(session, input);
}

/**
 * Handle AGM narration mode
 * @param {Object} session - Adventure session
 * @param {string} playerAction - Player's action
 * @returns {Object} Response
 */
async function handleAgmNarration(session, playerAction) {
  // Build AGM prompt
  const prompt = buildAgmPrompt(session, playerAction);

  // Get AGM response - use createMemory() for fresh memory object
  const assembled = assembleFullPrompt(session.agm, createMemory(), playerAction, session.pc, session.storyState);
  assembled.system = prompt;
  assembled.messages = [{ role: 'user', content: playerAction }];

  const response = await chat(session.client, assembled.system, assembled.messages);
  const agmText = response.content;

  // Parse response for directives
  const parsed = parseAgmResponse(agmText);
  const result = {
    text: parsed.narrativeText,
    modeChange: null,
    stateChanges: []
  };

  // Handle skill check directive
  if (parsed.skillCheck) {
    const checkResult = resolveCheck(parsed.skillCheck, session.pc);
    result.skillCheck = checkResult;
    result.text += '\n\n' + formatDetailedResult(checkResult);

    // Record check result for AGM follow-up
    session.lastSkillCheck = checkResult;
  }

  // Handle NPC dialogue switch
  if (parsed.enterNpcDialogue) {
    const npcResult = await enterNpcDialogue(session, parsed.npcId);
    result.modeChange = 'npc-dialogue';
    result.npcGreeting = npcResult;
    result.stateChanges.push(`Entering dialogue with ${session.activeNpc?.name}`);
  }

  // Handle beat completion
  if (parsed.beatComplete) {
    markBeatComplete(session, parsed.beatComplete);
    result.stateChanges.push(`Beat complete: ${parsed.beatComplete}`);
  }

  // Handle scene advancement
  if (parsed.advanceScene) {
    const options = {};
    if (parsed.timeSkip) options.timeSkip = parsed.timeSkip;
    if (parsed.isFlashback) options.isFlashback = true;

    const sceneResult = advanceToScene(session, parsed.nextSceneId, options);

    if (sceneResult.error) {
      result.text += `\n\n[Error: ${sceneResult.error}]`;
    } else {
      result.sceneTransition = sceneResult;
      result.stateChanges.push(`Scene: ${parsed.nextSceneId}`);

      if (sceneResult.narrativePrompt && !parsed.isFlashback) {
        result.text += `\n\n---\n\n${sceneResult.narrativePrompt}`;
      }
    }
  }

  // Handle decision recording
  if (parsed.decision) {
    recordDecision(session.storyState, {
      id: parsed.decision.id,
      choice: parsed.decision.choice,
      details: playerAction,
      consequences: {}
    });
    result.stateChanges.push(`Decision recorded: ${parsed.decision.id}`);
  }

  // Save state
  saveStoryState(session.storyState);

  return result;
}

/**
 * Enter NPC dialogue mode
 * @param {Object} session - Adventure session
 * @param {string} npcId - NPC identifier
 * @returns {string} NPC greeting
 */
async function enterNpcDialogue(session, npcId) {
  session.mode = PLAY_MODES.NPC_DIALOGUE;
  session.activeNpc = loadPersona(npcId);
  session.npcMemory = loadMemory(npcId, session.pc.id) || createMemory();

  // Generate NPC greeting
  const npcPrompt = buildNpcTransitionPrompt(session, session.activeNpc);
  const assembled = assembleFullPrompt(session.activeNpc, createMemory(), '', session.pc, session.storyState);

  const response = await chat(session.client, assembled.system + npcPrompt, [
    { role: 'user', content: 'The player approaches you.' }
  ]);

  addMessage(session.npcMemory, 'assistant', response.content);

  return response.content;
}

/**
 * Handle NPC dialogue mode
 * @param {Object} session - Adventure session
 * @param {string} playerInput - Player's dialogue
 * @returns {Object} Response
 */
async function handleNpcDialogue(session, playerInput) {
  if (!session.activeNpc) {
    return { text: 'No active NPC. Use /resume to return to narration.', error: true };
  }

  // Add player message to memory
  addMessage(session.npcMemory, 'user', playerInput);

  // Build AGM orchestration context
  const agmContext = session.agmState
    ? buildAgmContext(session.agmState, session.activeNpc.id, session.storyState)
    : null;
  const priorities = session.agmState
    ? getNpcPriorities(session.agmState, session.activeNpc, session.storyState)
    : [];

  // Build conversation context with AGM injection
  const assembled = assembleFullPrompt(
    session.activeNpc,
    session.npcMemory || createMemory(),
    playerInput,
    session.pc,
    session.storyState,
    { agmContext, goalPriorities: priorities }
  );

  // Build messages from memory
  const messages = session.npcMemory.recentMessages.slice(-10).map(m => ({
    role: m.role,
    content: m.content
  }));

  const response = await chat(session.client, assembled.system, messages);

  // Add NPC response to memory
  addMessage(session.npcMemory, 'assistant', response.content);

  return {
    text: response.content,
    speaker: session.activeNpc.name
  };
}

/**
 * Resume AGM narration from NPC dialogue
 * @param {Object} session - Adventure session
 * @returns {Object} Response
 */
async function resumeAgmNarration(session) {
  if (session.mode !== PLAY_MODES.NPC_DIALOGUE) {
    return { text: 'Already in narration mode.' };
  }

  // Save NPC conversation
  if (session.activeNpc && session.npcMemory) {
    saveMemory(session.activeNpc.id, session.pc.id, session.npcMemory);
  }

  const npcName = session.activeNpc?.name || 'the NPC';

  session.mode = PLAY_MODES.NARRATION;
  session.activeNpc = null;
  session.npcMemory = null;

  // Get AGM summary
  const resumePrompt = buildResumePrompt(session, npcName);
  const assembled = assembleFullPrompt(session.agm, createMemory(), '', session.pc, session.storyState);

  const response = await chat(session.client, assembled.system + resumePrompt, [
    { role: 'user', content: 'Resume narration after conversation.' }
  ]);

  return {
    text: response.content,
    modeChange: 'narration'
  };
}

/**
 * Handle adventure-specific commands
 * @param {Object} session - Adventure session
 * @param {string} input - Command input
 * @returns {Object} Response
 */
async function handleAdventureCommand(session, input) {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();

  switch (cmd) {
    case '/resume':
    case '/r':
      return resumeAgmNarration(session);

    case '/status':
      return {
        text: formatAdventureStatus(session),
        isStatus: true
      };

    case '/inventory':
      return {
        text: formatInventory(session.pc),
        isStatus: true
      };

    case '/save':
    case '/s':
      saveStoryState(session.storyState);
      return { text: 'Adventure state saved.' };

    case '/decisions':
      return {
        text: formatDecisions(session.storyState),
        isStatus: true
      };

    case '/help':
      return {
        text: formatAdventureHelp(),
        isStatus: true
      };

    case '/cast':
      return {
        text: formatDramatisPersonae(session),
        isStatus: true
      };

    case '/back':
    case '/b':
      return {
        text: 'back',
        action: 'back'
      };

    default:
      return { text: `Unknown adventure command: ${cmd}. Type /help for commands.` };
  }
}

/**
 * Format adventure status for display
 * @param {Object} session - Adventure session
 * @returns {string} Formatted status
 */
function formatAdventureStatus(session) {
  const scene = getCurrentScene(session);
  const lines = [
    '=== ADVENTURE STATUS ===',
    `Adventure: ${session.adventure.title}`,
    `PC: ${session.pc.name}`,
    `Scene: ${scene?.title || session.storyState.currentScene}`,
    `Game Date: ${session.storyState.gameDate || 'Unknown'}`,
    `Mode: ${session.mode}`,
    ''
  ];

  if (scene?.objectives) {
    lines.push('Objectives:');
    scene.objectives.forEach(obj => lines.push(`  - ${obj}`));
    lines.push('');
  }

  const beats = session.storyState.completedBeats || [];
  if (beats.length > 0) {
    lines.push(`Completed beats: ${beats.length}`);
  }

  const decisions = Object.keys(session.storyState.decisions || {});
  if (decisions.length > 0) {
    lines.push(`Decisions made: ${decisions.length}`);
  }

  return lines.join('\n');
}

/**
 * Format PC inventory for display
 * @param {Object} pc - PC data
 * @returns {string} Formatted inventory
 */
function formatInventory(pc) {
  const lines = ['=== INVENTORY ==='];

  if (pc.equipment && pc.equipment.length > 0) {
    pc.equipment.forEach(item => {
      lines.push(`  - ${item}`);
    });
  } else {
    lines.push('  No equipment listed.');
  }

  if (pc.credits !== undefined) {
    lines.push('', `Credits: Cr${pc.credits}`);
  }

  return lines.join('\n');
}

/**
 * Format decisions for display
 * @param {Object} storyState - Story state
 * @returns {string} Formatted decisions
 */
function formatDecisions(storyState) {
  const decisions = storyState.decisions || {};
  const lines = ['=== DECISIONS MADE ==='];

  if (Object.keys(decisions).length === 0) {
    lines.push('No major decisions recorded yet.');
  } else {
    for (const [id, d] of Object.entries(decisions)) {
      lines.push(`\n${id}:`);
      lines.push(`  Scene: ${d.scene}`);
      lines.push(`  Choice: ${d.choice}`);
      lines.push(`  ${d.details}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format adventure help
 * @returns {string} Help text
 */
function formatAdventureHelp() {
  return `
=== ADVENTURE MODE COMMANDS ===

/status     - Show current scene, objectives, progress
/inventory  - Show PC equipment and credits
/decisions  - Show decisions made so far
/cast       - Show dramatis personae for current scene
/resume, /r - Return from NPC dialogue to AGM narration
/back, /b   - Return to scene picker
/save, /s   - Force save current state
/help       - Show this help
/quit, /q   - Exit adventure mode (auto-saves)

During play, type your actions naturally.
The AI Game Master will narrate results.
`;
}

/**
 * Get scenes organized by act for scene picker
 * @param {Object} adventure - Adventure data
 * @param {Object} storyState - Story state with completed scenes
 * @returns {Object} Scenes by act
 */
function getScenesByAct(adventure, storyState) {
  const byAct = {};
  const completedScenes = storyState.completedScenes || [];
  const expandedScenes = storyState.expandedScenes || [];
  const completedStages = storyState.completedStages || {};

  // Load acts to get canonical scene ordering
  const acts = loadActs(adventure.id);

  for (const act of acts) {
    const actId = act.id;
    byAct[actId] = [];

    // Use act.scenes array for ordering (canonical source of truth)
    const sceneIds = act.scenes || [];

    for (const sceneId of sceneIds) {
      try {
        const scene = loadScene(adventure.id, sceneId);

        const sceneEntry = {
          id: sceneId,
          title: scene.title || sceneId,
          completed: completedScenes.includes(sceneId),
          current: storyState.currentScene === sceneId,
          hasStages: scene.stages && scene.stages.length > 0,
          expanded: expandedScenes.includes(sceneId),
          stages: null
        };

        // Include stage data if scene has stages
        if (scene.stages && scene.stages.length > 0) {
          const { slugifyStage } = require('./decision-tracker');
          sceneEntry.stages = scene.stages.map(s => ({
            id: slugifyStage(s.name),
            name: s.name,
            altitude: s.altitude,
            completed: (completedStages[sceneId] || []).includes(slugifyStage(s.name)),
            current: storyState.currentStage === slugifyStage(s.name)
          }));
        }

        byAct[actId].push(sceneEntry);
      } catch (e) {
        // Skip scenes that don't exist
      }
    }
  }

  return byAct;
}

/**
 * Format a single scene menu item
 * @param {Object} scene - Scene entry from getScenesByAct
 * @returns {string} Formatted line
 */
function formatSceneMenuItem(scene) {
  let indicator;
  if (scene.completed) {
    indicator = '[✓]';
  } else if (scene.hasStages) {
    indicator = scene.expanded ? '[v]' : '[>]';
  } else {
    indicator = '[ ]';
  }

  const current = scene.current ? ' *' : '';
  return `${indicator} ${scene.title}${current}`;
}

/**
 * Format expanded scene with stages
 * @param {Object} scene - Scene entry with stages
 * @returns {string[]} Array of formatted lines
 */
function formatExpandedScene(scene) {
  if (!scene.stages || !scene.expanded) return [];

  const lines = [];
  const letters = 'abcdefghijklmnopqrstuvwxyz';

  scene.stages.forEach((stage, i) => {
    const letter = letters[i] || String(i + 1);
    const completed = stage.completed ? '✓' : ' ';
    const current = stage.current ? '*' : ' ';
    const altitude = stage.altitude ? ` (${stage.altitude})` : '';
    lines.push(`      ${letter}. [${completed}] ${stage.name}${altitude}${current}`);
  });

  return lines;
}

/**
 * Format scene picker menu
 * @param {Object} adventure - Adventure data
 * @param {Object} storyState - Story state
 * @returns {string} Formatted menu
 */
function formatScenePicker(adventure, storyState) {
  const scenesByAct = getScenesByAct(adventure, storyState);
  const lines = [];
  let sceneNum = 1;

  // Map of act IDs to display names
  const actNames = {
    'act-1': 'ACT 1: THE JOURNEY',
    'act-1-journey': 'ACT 1: THE JOURNEY',
    'act-2': 'ACT 2: WALSTON',
    'act-2-walston': 'ACT 2: WALSTON',
    'act-3': 'ACT 3: THE MOUNTAIN',
    'act-3-mountain': 'ACT 3: THE MOUNTAIN',
    'act-4': 'ACT 4: THE CRISIS',
    'act-4-crisis': 'ACT 4: THE CRISIS',
    'act-5': 'ACT 5: AFTERMATH',
    'act-5-aftermath': 'ACT 5: AFTERMATH',
    'act-5-resolution': 'ACT 5: RESOLUTION'
  };

  const actOrder = ['act-1', 'act-1-journey', 'act-2', 'act-2-walston', 'act-3', 'act-3-mountain', 'act-4', 'act-4-crisis', 'act-5', 'act-5-aftermath', 'act-5-resolution'];

  for (const actId of actOrder) {
    if (!scenesByAct[actId]) continue;

    lines.push('');
    lines.push(`  ${actNames[actId] || actId.toUpperCase()}`);

    for (const scene of scenesByAct[actId]) {
      const menuItem = formatSceneMenuItem(scene);
      lines.push(`    ${sceneNum}. ${menuItem}`);

      // Show stages if expanded
      if (scene.expanded && scene.stages) {
        const stageLines = formatExpandedScene(scene);
        lines.push(...stageLines);
      }

      sceneNum++;
    }
  }

  lines.push('');
  lines.push('  [B] Back to Main Menu');
  lines.push('');

  const header = centerText(`${adventure.title.toUpperCase()} - SELECT SCENE`, 50);
  return drawBoxWithHeader(header, lines, 52);
}

/**
 * Get dramatis personae for current scene
 * @param {Object} session - Adventure session
 * @returns {Array} NPCs in scene with details
 */
function getDramatisPersonae(session) {
  const scene = getCurrentScene(session);
  if (!scene || !scene.npcs_present) {
    return [];
  }

  return scene.npcs_present.map(npcId => {
    try {
      const summary = getPersonaSummary(npcId);
      if (summary) {
        return {
          id: npcId,
          name: summary.name,
          title: summary.title || summary.archetype
        };
      }
      return { id: npcId, name: npcId, title: 'NPC' };
    } catch (e) {
      return { id: npcId, name: npcId, title: 'NPC' };
    }
  });
}

/**
 * Format dramatis personae for display
 * @param {Object} session - Adventure session
 * @returns {string} Formatted cast list
 */
function formatDramatisPersonae(session) {
  const scene = getCurrentScene(session);
  const npcs = getDramatisPersonae(session);

  const lines = [
    `=== DRAMATIS PERSONAE ===`,
    `Scene: ${scene?.title || 'Unknown'}`,
    '',
    `• ${session.pc.name} (You)`
  ];

  if (npcs.length === 0) {
    lines.push('');
    lines.push('No other characters present.');
  } else {
    for (const npc of npcs) {
      lines.push(`• ${npc.name} - ${npc.title}`);
    }
  }

  return lines.join('\n');
}

/**
 * Display theatrical scene frame
 * @param {Object} session - Adventure session
 * @returns {string} Scene frame display
 */
function displayTheatricalFrame(session) {
  const scene = getCurrentScene(session);
  if (!scene) {
    return 'No current scene.';
  }

  const npcs = getDramatisPersonae(session);
  return displaySceneFrame(scene, session.pc, npcs);
}

/**
 * Get flat list of scenes for picker selection
 * @param {Object} adventure - Adventure data
 * @returns {Array} Ordered list of scene IDs
 */
function getSceneList(adventure) {
  const scenesByAct = getScenesByAct(adventure, { completedScenes: [] });
  const actOrder = ['act-1', 'act-1-journey', 'act-2', 'act-2-walston', 'act-3', 'act-3-mountain', 'act-4', 'act-4-crisis', 'act-5', 'act-5-aftermath', 'act-5-resolution'];
  const sceneList = [];

  for (const actId of actOrder) {
    if (scenesByAct[actId]) {
      for (const scene of scenesByAct[actId]) {
        sceneList.push(scene.id);
      }
    }
  }

  return sceneList;
}

/**
 * Jump to scene by number from picker
 * @param {Object} session - Adventure session
 * @param {number} sceneNum - 1-based scene number
 * @returns {Object} Result
 */
function jumpToSceneByNumber(session, sceneNum) {
  const sceneList = getSceneList(session.adventure);
  const idx = sceneNum - 1;

  if (idx < 0 || idx >= sceneList.length) {
    return { error: `Invalid scene number: ${sceneNum}` };
  }

  const sceneId = sceneList[idx];
  return advanceToScene(session, sceneId);
}

/**
 * Acquire information for PC (persists to storyState)
 * @param {Object} session - Adventure session
 * @param {string} info - Information acquired
 * @param {string} source - Source of information (NPC ID or 'narrator')
 */
function acquireInfo(session, info, source) {
  if (!session.storyState.acquired_info) {
    session.storyState.acquired_info = [];
  }

  session.storyState.acquired_info.push({
    info,
    source,
    timestamp: new Date().toISOString(),
    scene: session.storyState.currentScene
  });

  // Note: saveStoryState would be called here in production
  // For now, the info persists in session memory
}

module.exports = {
  startAdventure,
  getOpeningNarration,
  processPlayerInput,
  handleAgmNarration,
  handleNpcDialogue,
  enterNpcDialogue,
  resumeAgmNarration,
  handleAdventureCommand,
  formatAdventureStatus,
  PLAY_MODES,
  // Scene picker functions
  getScenesByAct,
  formatScenePicker,
  formatSceneMenuItem,
  formatExpandedScene,
  getDramatisPersonae,
  formatDramatisPersonae,
  displayTheatricalFrame,
  getSceneList,
  jumpToSceneByNumber,
  acquireInfo,
  // Inventory functions
  addToInventory,
  hasItem,
  checkUnlock,
  getCargoItems,
  describeInventory
};
