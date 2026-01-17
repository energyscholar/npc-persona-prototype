#!/usr/bin/env node
/**
 * Multi-NPC Chat TUI
 *
 * Chat with multiple NPCs in a world, switching between them.
 *
 * Usage:
 *   node src/chat-tui.js --world Walston --pc traveller-one
 *   node src/chat-tui.js --world "ISS Amishi" --pc marina
 */

require('dotenv').config();

const readline = require('readline');
const { loadPersona, listPersonas, getPersonaSummary } = require('./persona');
const { createMemory, addMessage, serialize, deserialize } = require('./memory');
const { assembleFullPrompt } = require('./prompts');
const { createClient, chat, getUsageStats } = require('./ai-client');
const { loadPC, pcExists, listPCs } = require('./pc-roster');
const {
  createThread,
  addMessage: addThreadMessage,
  findThread,
  getThreadHistory,
  markThreadRead,
  getTravellerDate
} = require('./message-board');
const {
  loadAdventure,
  loadScene,
  loadEncounter,
  listAdventures,
  listScenes,
  listEncounters,
  createStoryState,
  recordBeat,
  getProgressSummary,
  getSceneNarratorPrompt,
  getEncounterDetails
} = require('./story-engine');
const { getDisposition } = require('./disposition');
const { getActiveTimedActions, getActionProgress } = require('./timed-actions');
const { getReportsForPc, formatReportMessage, clearReports } = require('./action-reports');
const {
  startAdventure,
  getOpeningNarration,
  processPlayerInput,
  resumeAgmNarration,
  PLAY_MODES,
  formatScenePicker,
  displayTheatricalFrame,
  jumpToSceneByNumber
} = require('./adventure-player');
const {
  displayMainMenu,
  displayPickerMenu,
  displayFlagMenu,
  displayContactHistory,
  displayTestModeStatus,
  displayChecklist,
  displayScenarioMenu,
  promptInput,
  MAIN_MENU_OPTIONS
} = require('./tui-menu');
const {
  CHANNELS,
  CONTEXT_PRESETS,
  AVAILABLE_FLAGS,
  createTestState,
  buildTestModePrompt,
  parseTestCommand,
  getNpcOptions,
  getChannelOptions,
  getContextOptions,
  formatTestModeResponse,
  getDispositionLabel
} = require('./npc-test-mode');
const {
  loadContactHistory,
  addSession,
  clearHistory,
  getSessionSummaries,
  createSessionFromState
} = require('./contact-history');

// Training session infrastructure for NPC persona validation
const {
  SCENARIOS,
  listScenarios,
  getScenario,
  parseTrainingCommand,
  applyScenarioToState
} = require('./training-scenarios');
const {
  saveResult: saveTrainingResult,
  getHistory: getTrainingHistory,
  getNpcSummary: getTrainingSummary
} = require('./training-log');

// Red team validation for NPC fact-checking
const {
  runRedTeamValidation: executeRedTeamValidation,
  initializeRedTeam,
  getCoverageSummary,
  validator: { formatValidationReport },
  learner: { runLearningForReport, applyPendingPatch, listBackups, restoreFromBackup },
  learningLog: { loadPendingLearning, getRecentLearning, getLearningStats, formatLearningLog, formatStats }
} = require('./red-team');

const fs = require('fs');
const path = require('path');

// TUI Configuration
const TUI_CONFIG = {
  boxWidth: 66,
  indent: '  ',
  colors: {
    prompt: '\x1b[36m',    // cyan
    npc: '\x1b[33m',       // yellow
    system: '\x1b[90m',    // gray
    action: '\x1b[35m',    // magenta
    error: '\x1b[31m',     // red
    reset: '\x1b[0m'
  },
  progressBar: {
    filled: '█',
    empty: '░',
    width: 10
  }
};

// Paths
const CONVERSATIONS_DIR = path.join(__dirname, '../data/conversations');

// Parse arguments
const args = process.argv.slice(2);
const worldArg = args.includes('--world') ? args[args.indexOf('--world') + 1] : null;
const pcArg = args.includes('--pc') ? args[args.indexOf('--pc') + 1] : null;

// Session state
let currentNpcId = null;
let currentPersona = null;
let currentMemory = null;
let currentThread = null;
let currentPC = null;
let currentPCId = null;
let client = null;
let storyState = null;
let adventureSession = null; // Adventure play mode session

/**
 * Get conversation file path (for backward compat with single-NPC mode)
 */
function getConversationPath(npcId, pcId) {
  const dir = path.join(CONVERSATIONS_DIR, npcId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, `${pcId}.json`);
}

/**
 * Load existing conversation memory
 */
function loadConversation(npcId, pcId) {
  const filePath = getConversationPath(npcId, pcId);
  if (fs.existsSync(filePath)) {
    const json = fs.readFileSync(filePath, 'utf8');
    return deserialize(json);
  }
  return createMemory();
}

/**
 * Save conversation memory
 */
function saveConversation(npcId, pcId, memory) {
  const filePath = getConversationPath(npcId, pcId);
  fs.writeFileSync(filePath, serialize(memory));
}

/**
 * Print available NPCs for the world
 */
function printNpcList(world) {
  const npcs = listPersonas(world);
  console.log(`\n  Available NPCs in ${world}:`);
  if (npcs.length === 0) {
    console.log('    (none found)');
  } else {
    npcs.forEach((id, idx) => {
      const summary = getPersonaSummary(id);
      if (summary) {
        const marker = id === currentNpcId ? ' *' : '  ';
        console.log(`  ${marker}${idx + 1}. ${summary.name} - ${summary.title || summary.archetype}`);
      }
    });
  }
  console.log('');
}

/**
 * Print header for current NPC
 */
function printNpcHeader(persona) {
  const innerWidth = TUI_CONFIG.boxWidth - 4; // account for borders and padding
  const border = '─'.repeat(TUI_CONFIG.boxWidth - 2);
  console.log(`\n┌${border}┐`);
  console.log(`│  ${persona.name.padEnd(innerWidth)}│`);
  console.log(`│  ${(persona.title + ' - ' + persona.world).slice(0, innerWidth).padEnd(innerWidth)}│`);
  console.log(`└${border}┘\n`);
}

/**
 * Print available PCs
 */
function printPCList() {
  const pcs = listPCs();
  console.log('\n  Available PCs:');
  if (pcs.length === 0) {
    console.log('    (none found)');
  } else {
    pcs.forEach((id, idx) => {
      try {
        const pc = loadPC(id);
        const marker = id === currentPCId ? ' *' : '  ';
        const species = pc.species ? ` (${pc.species})` : '';
        console.log(`  ${marker}${idx + 1}. ${pc.name}${species}`);
      } catch {
        console.log(`    ${idx + 1}. ${id} (invalid)`);
      }
    });
  }
  console.log('');
}

/**
 * Switch to a different PC
 */
function switchPC(pcIdOrNum) {
  const pcs = listPCs();

  let targetId;
  const num = parseInt(pcIdOrNum);
  if (!isNaN(num) && num >= 1 && num <= pcs.length) {
    targetId = pcs[num - 1];
  } else {
    targetId = pcIdOrNum;
  }

  try {
    currentPC = loadPC(targetId);
    currentPCId = targetId;
    console.log(`\n  Now playing as: ${currentPC.name}`);
    if (currentPC.species) console.log(`  Species: ${currentPC.species}`);
    if (currentPC.background) console.log(`  ${currentPC.background.slice(0, 80)}...`);
    console.log('');
    return true;
  } catch (e) {
    console.log(`\n  PC not found: ${targetId}`);
    printPCList();
    return false;
  }
}

/**
 * Print help
 */
function printHelp() {
  console.log('\n  Commands:');
  console.log('    /list          - Show available NPCs');
  console.log('    /switch <n>    - Switch to NPC by number or ID');
  console.log('    /pc            - Show available PCs');
  console.log('    /pc <n>        - Switch to PC by number or ID');
  console.log('    /status        - Show current session status');
  console.log('    /actions       - Show active timed actions');
  console.log('    /stats         - Show API usage statistics');
  console.log('    /memory        - Show memory summary');
  console.log('');
  console.log('  Story Commands:');
  console.log('    /adventure     - Show/load adventure');
  console.log('    /play <adv>    - Start adventure play mode');
  console.log('    /scene [id]    - Show current or specific scene');
  console.log('    /encounter <id>- Show encounter details');
  console.log('    /progress      - Show story progress');
  console.log('    /beat <id>     - Mark story beat complete');
  console.log('');
  console.log('    /quit          - Exit and save');
  console.log('');
}

/**
 * Print adventure info
 */
function printAdventureInfo() {
  const adventures = listAdventures();
  console.log('\n  Available Adventures:');
  if (adventures.length === 0) {
    console.log('    (none found)');
  } else {
    adventures.forEach((id, idx) => {
      try {
        const adv = loadAdventure(id);
        const marker = storyState?.adventure === id ? ' *' : '  ';
        console.log(`  ${marker}${idx + 1}. ${adv.title} (${adv.world})`);
      } catch {
        console.log(`    ${idx + 1}. ${id} (invalid)`);
      }
    });
  }
  console.log('');
}

/**
 * Load an adventure
 */
function loadAdventureById(adventureId) {
  try {
    const adv = loadAdventure(adventureId);
    storyState = createStoryState(adventureId);
    console.log(`\n  Loaded: ${adv.title}`);
    console.log(`  Theme: ${adv.theme}`);
    console.log(`  Hook: ${adv.hook}`);
    console.log(`  Acts: ${adv.acts.length}`);
    console.log('');
    return true;
  } catch (e) {
    console.log(`\n  Adventure not found: ${adventureId}`);
    printAdventureInfo();
    return false;
  }
}

/**
 * Print scene info
 */
function printSceneInfo(sceneId = null) {
  if (!storyState) {
    console.log('\n  No adventure loaded. Use /adventure first.\n');
    return;
  }

  const targetScene = sceneId || storyState.currentScene;

  if (!targetScene) {
    // List available scenes
    const scenes = listScenes(storyState.adventure);
    console.log('\n  Available Scenes:');
    scenes.forEach((id, idx) => {
      try {
        const scene = loadScene(storyState.adventure, id);
        const marker = storyState.currentScene === id ? ' *' : '  ';
        console.log(`  ${marker}${idx + 1}. ${scene.title} (${scene.act})`);
      } catch {
        console.log(`    ${idx + 1}. ${id}`);
      }
    });
    console.log('\n  Use /scene <id> to view scene details.\n');
    return;
  }

  try {
    const scene = loadScene(storyState.adventure, targetScene);
    const innerWidth = TUI_CONFIG.boxWidth - 8;
    const border = '─'.repeat(TUI_CONFIG.boxWidth - 6);
    console.log(`\n${TUI_CONFIG.indent}┌${border}┐`);
    console.log(`${TUI_CONFIG.indent}│  ${scene.title.padEnd(innerWidth)}│`);
    console.log(`${TUI_CONFIG.indent}└${border}┘`);
    console.log(`  Setting: ${scene.setting}`);
    console.log(`  Atmosphere: ${scene.atmosphere}`);
    console.log('');
    console.log('  Objectives:');
    scene.objectives?.forEach(obj => console.log(`    - ${obj}`));
    console.log('');
    console.log('  Encounters:');
    scene.encounters?.forEach(enc => console.log(`    - ${enc}`));
    console.log('');
    if (scene.narrator_prompt) {
      console.log('  Narrator:');
      console.log(`    "${scene.narrator_prompt.slice(0, 200)}${scene.narrator_prompt.length > 200 ? '...' : ''}"`);
      console.log('');
    }
    storyState.currentScene = targetScene;
  } catch (e) {
    console.log(`\n  Scene not found: ${targetScene}\n`);
  }
}

/**
 * Print encounter info
 */
function printEncounterInfo(encounterId) {
  if (!storyState) {
    console.log('\n  No adventure loaded. Use /adventure first.\n');
    return;
  }

  if (!encounterId) {
    const encounters = listEncounters(storyState.adventure);
    console.log('\n  Available Encounters:');
    encounters.forEach((id, idx) => {
      try {
        const enc = loadEncounter(storyState.adventure, id);
        console.log(`    ${idx + 1}. ${enc.title} (${enc.type})`);
      } catch {
        console.log(`    ${idx + 1}. ${id}`);
      }
    });
    console.log('\n  Use /encounter <id> to view details.\n');
    return;
  }

  try {
    const details = getEncounterDetails(storyState.adventure, encounterId);
    const innerWidth = TUI_CONFIG.boxWidth - 8;
    const border = '─'.repeat(TUI_CONFIG.boxWidth - 6);
    console.log(`\n${TUI_CONFIG.indent}┌${border}┐`);
    console.log(`${TUI_CONFIG.indent}│  ${details.title.padEnd(innerWidth)}│`);
    console.log(`${TUI_CONFIG.indent}└${border}┘`);
    console.log(`  Type: ${details.type}`);
    console.log(`  ${details.description}`);
    console.log('');
    if (details.skills.length > 0) {
      console.log(`  Skills: ${details.skills.join(', ')}`);
      console.log(`  Difficulty: ${details.difficulty}`);
      console.log('');
    }
    if (details.dialogueHooks.length > 0) {
      console.log('  Dialogue Hooks:');
      details.dialogueHooks.forEach(hook => console.log(`    - "${hook}"`));
      console.log('');
    }
    if (details.roleplayGuidance) {
      console.log('  Roleplay Guidance:');
      Object.entries(details.roleplayGuidance).forEach(([key, val]) => {
        console.log(`    ${key}: ${val}`);
      });
      console.log('');
    }
  } catch (e) {
    console.log(`\n  Encounter not found: ${encounterId}\n`);
  }
}

/**
 * Print story progress
 */
function printProgress() {
  if (!storyState) {
    console.log('\n  No adventure loaded. Use /adventure first.\n');
    return;
  }

  const summary = getProgressSummary(storyState);
  console.log('\n  --- Story Progress ---');
  console.log(`  Adventure: ${summary.adventure}`);
  console.log(`  Current Act: ${summary.act}`);
  console.log(`  Current Scene: ${summary.scene}`);
  console.log(`  Progress: ${summary.progress}`);
  console.log(`  Game Date: ${summary.gameDate}`);
  if (summary.recentBeats.length > 0) {
    console.log('  Recent Beats:');
    summary.recentBeats.forEach(beat => console.log(`    - ${beat}`));
  }
  console.log('');
}

/**
 * Record a story beat
 */
function markBeat(beatId) {
  if (!storyState) {
    console.log('\n  No adventure loaded. Use /adventure first.\n');
    return;
  }

  recordBeat(storyState, beatId, getTravellerDate());
  console.log(`\n  Beat recorded: ${beatId}\n`);
}

/**
 * Switch to a different NPC
 */
function switchNpc(npcIdOrNum, world, pcId) {
  const npcs = listPersonas(world);

  let targetId;
  const num = parseInt(npcIdOrNum);
  if (!isNaN(num) && num >= 1 && num <= npcs.length) {
    targetId = npcs[num - 1];
  } else {
    targetId = npcIdOrNum;
  }

  if (!npcs.includes(targetId)) {
    console.log(`\n  NPC not found: ${targetId}`);
    printNpcList(world);
    return false;
  }

  try {
    currentPersona = loadPersona(targetId);
    currentNpcId = targetId;
    currentMemory = loadConversation(targetId, pcId);

    // Find or prepare thread
    const pcKey = `pc:${pcId}`;
    const npcKey = `npc:${targetId}`;
    currentThread = findThread(pcKey, npcKey);

    printNpcHeader(currentPersona);

    if (currentMemory.totalInteractions > 0) {
      console.log(`  [Resuming - ${currentMemory.totalInteractions} previous exchanges]\n`);
    }

    return true;
  } catch (e) {
    console.log(`\n  Error loading NPC: ${e.message}`);
    return false;
  }
}

/**
 * Print memory summary
 */
function printMemorySummary(memory) {
  console.log('\n  --- Memory Summary ---');
  console.log(`  Total interactions: ${memory.totalInteractions}`);
  console.log(`  First contact: ${memory.firstContact || 'none'}`);
  console.log(`  Last contact: ${memory.lastContact || 'none'}`);
  console.log(`  Facts stored: ${memory.facts.length}`);
  if (memory.facts.length > 0) {
    memory.facts.forEach(f => console.log(`    - ${f.type}: ${f.value}`));
  }
  console.log('');
}

/**
 * Convert disposition level (-3 to +3) to star rating
 */
function dispositionStars(level) {
  // Map -3..+3 to 0..6 stars (★ for filled, ☆ for empty)
  const stars = Math.max(0, level + 3); // -3→0, 0→3, +3→6
  const filled = '★'.repeat(stars);
  const empty = '☆'.repeat(6 - stars);
  return filled + empty;
}

/**
 * Print status summary (/status command)
 */
function printStatus(world, pcId, pc, npcId, persona, memory, storyState) {
  const { system: sysColor, reset } = TUI_CONFIG.colors;
  const border = '─'.repeat(TUI_CONFIG.boxWidth - 2);

  console.log(`\n┌${border}┐`);
  console.log(`│  ${sysColor}STATUS${reset}${' '.repeat(TUI_CONFIG.boxWidth - 10)}│`);
  console.log(`├${border}┤`);

  // World
  console.log(`│  World:     ${(world || 'none').padEnd(TUI_CONFIG.boxWidth - 16)}│`);

  // PC
  const pcName = pc ? pc.name : 'none';
  console.log(`│  PC:        ${pcName.padEnd(TUI_CONFIG.boxWidth - 16)}│`);

  // NPC
  const npcName = persona ? persona.name : 'none selected';
  console.log(`│  NPC:       ${npcName.padEnd(TUI_CONFIG.boxWidth - 16)}│`);

  // Date
  const gameDate = storyState?.gameDate || getTravellerDate();
  console.log(`│  Date:      ${gameDate.padEnd(TUI_CONFIG.boxWidth - 16)}│`);

  // Scene
  const scene = storyState?.currentScene || 'none';
  console.log(`│  Scene:     ${scene.padEnd(TUI_CONFIG.boxWidth - 16)}│`);

  // Messages
  const msgCount = memory ? memory.totalInteractions : 0;
  console.log(`│  Messages:  ${String(msgCount).padEnd(TUI_CONFIG.boxWidth - 16)}│`);

  // Disposition (if NPC selected)
  if (npcId && pcId) {
    const disp = getDisposition(npcId, pcId);
    const stars = dispositionStars(disp.level);
    const dispLine = `${stars} (${disp.label})`;
    console.log(`│  Disposition: ${dispLine.padEnd(TUI_CONFIG.boxWidth - 18)}│`);
  }

  console.log(`└${border}┘\n`);
}

/**
 * Build a progress bar string
 */
function buildProgressBar(percent) {
  const { filled, empty, width } = TUI_CONFIG.progressBar;
  const filledCount = Math.round((percent / 100) * width);
  const emptyCount = width - filledCount;
  return filled.repeat(filledCount) + empty.repeat(emptyCount);
}

/**
 * Print active timed actions (/actions command)
 */
function printActiveActions() {
  const actions = getActiveTimedActions();
  const { action: actColor, system: sysColor, reset } = TUI_CONFIG.colors;
  const border = '─'.repeat(TUI_CONFIG.boxWidth - 2);

  console.log(`\n┌${border}┐`);
  console.log(`│  ${actColor}ACTIVE ACTIONS${reset}${' '.repeat(TUI_CONFIG.boxWidth - 18)}│`);
  console.log(`├${border}┤`);

  if (actions.length === 0) {
    console.log(`│  ${sysColor}No active actions${reset}${' '.repeat(TUI_CONFIG.boxWidth - 21)}│`);
  } else {
    for (const action of actions) {
      const progress = getActionProgress(action.id);
      const bar = buildProgressBar(progress?.percentComplete || 0);
      const pct = `${progress?.percentComplete || 0}%`.padStart(4);
      const hrs = `${progress?.hoursRemaining || 0}h left`.padStart(8);

      // Format: action-id [████░░░░░░] 45% 12h left
      const actionLine = `${action.id.slice(0, 20).padEnd(20)} ${bar} ${pct} ${hrs}`;
      console.log(`│  ${actionLine.padEnd(TUI_CONFIG.boxWidth - 4)}│`);
    }
  }

  console.log(`└${border}┘\n`);
}

/**
 * Display action notifications (T2 - polling after each turn)
 * Returns true if any notifications were displayed
 */
function displayActionNotifications(pcId) {
  if (!pcId) return false;

  const reports = getReportsForPc(pcId);
  if (reports.length === 0) return false;

  const { action: actColor, npc: npcColor, system: sysColor, reset } = TUI_CONFIG.colors;

  for (const report of reports) {
    let prefix = '';
    let color = sysColor;

    // Determine prefix based on visibility/type
    if (report.visibility === 'direct') {
      prefix = '[NPC MESSAGE]';
      color = npcColor;
    } else if (report.actionId?.includes('timed')) {
      prefix = '[TIMED]';
      color = actColor;
    } else {
      prefix = '[CREW ACTION]';
      color = actColor;
    }

    const message = formatReportMessage(report);
    console.log(`${TUI_CONFIG.indent}${color}${prefix}${reset} ${message}`);
  }

  // Clear reports after displaying
  clearReports();
  console.log('');
  return true;
}

/**
 * Get available worlds from NPCs
 */
function getAvailableWorlds() {
  const allNpcs = listPersonas();
  return [...new Set(allNpcs.map(id => {
    const s = getPersonaSummary(id);
    return s ? s.world : null;
  }).filter(Boolean))].sort();
}

/**
 * Prompt user to select from numbered list
 */
function promptSelection(rl, prompt, options) {
  return new Promise((resolve) => {
    console.log('');
    options.forEach((opt, idx) => {
      console.log(`  ${idx + 1}. ${opt.label}`);
    });
    console.log('');
    rl.question(prompt, (answer) => {
      const num = parseInt(answer.trim());
      if (!isNaN(num) && num >= 1 && num <= options.length) {
        resolve(options[num - 1].value);
      } else {
        // Try matching by value
        const match = options.find(o =>
          o.value.toLowerCase() === answer.trim().toLowerCase()
        );
        resolve(match ? match.value : null);
      }
    });
  });
}

/**
 * Run NPC Test Mode
 * @param {readline.Interface} rl - Readline interface
 * @param {Object} client - API client
 */
async function runNpcTestMode(rl, client) {
  const selectedWorld = 'Walston'; // Default to High and Dry world

  // Step 1: Select NPC
  const npcOptions = getNpcOptions(selectedWorld);
  console.log('\n' + displayPickerMenu('SELECT NPC TO TEST', npcOptions, 'Back to Main Menu'));
  const npcAnswer = await promptInput(rl, '\nSelect NPC: ');

  if (npcAnswer.toLowerCase() === 'b') return 'back';

  const npcNum = parseInt(npcAnswer);
  if (isNaN(npcNum) || npcNum < 1 || npcNum > npcOptions.length) {
    console.log('  Invalid selection.');
    return 'back';
  }
  const selectedNpc = npcOptions[npcNum - 1];
  const npc = loadPersona(selectedNpc.id);

  // Step 2: Select Channel
  const channelOptions = getChannelOptions();
  console.log('\n' + displayPickerMenu(`COMMUNICATION CHANNEL\n  NPC: ${npc.name}`, channelOptions, 'Back to NPC Selection'));
  const channelAnswer = await promptInput(rl, '\nSelect channel: ');

  if (channelAnswer.toLowerCase() === 'b') return runNpcTestMode(rl, client);

  const channelNum = parseInt(channelAnswer);
  if (isNaN(channelNum) || channelNum < 1 || channelNum > channelOptions.length) {
    console.log('  Invalid selection.');
    return runNpcTestMode(rl, client);
  }
  const selectedChannel = channelOptions[channelNum - 1].id;

  // Step 3: Select Context
  const contextOptions = getContextOptions();
  console.log('\n' + displayPickerMenu(`SCENE CONTEXT\n  NPC: ${npc.name}\n  Channel: ${CHANNELS[selectedChannel].label}`, contextOptions, 'Back to Channel Selection'));
  const contextAnswer = await promptInput(rl, '\nSelect context: ');

  if (contextAnswer.toLowerCase() === 'b') return runNpcTestMode(rl, client);

  const contextNum = parseInt(contextAnswer);
  if (isNaN(contextNum) || contextNum < 1 || contextNum > contextOptions.length) {
    console.log('  Invalid selection.');
    return runNpcTestMode(rl, client);
  }
  const selectedContext = contextOptions[contextNum - 1].id;
  const contextPreset = CONTEXT_PRESETS[selectedContext];

  // Step 4: Show flag menu for custom context
  let flags = { ...contextPreset.flags };
  let disposition = contextPreset.disposition;

  if (selectedContext === 'custom') {
    console.log('\n' + displayFlagMenu(flags, AVAILABLE_FLAGS));
    console.log('  Toggle flags with numbers, Enter to continue:');
    // For simplicity, skip interactive flag toggle - use /flags command in test mode
  }

  // Step 5: Show contact history
  const sessions = getSessionSummaries(selectedNpc.id);
  if (sessions.length > 0) {
    console.log('\n' + displayContactHistory(npc.name, sessions));
    const histAnswer = await promptInput(rl, '\n[Enter] Continue, [C] Clear history, [B] Back: ');

    if (histAnswer.toLowerCase() === 'b') return runNpcTestMode(rl, client);
    if (histAnswer.toLowerCase() === 'c') {
      clearHistory(selectedNpc.id);
      console.log('  History cleared.');
    }
  }

  // Create test state
  const pc = loadPC('alex-ryder');
  const testState = createTestState(npc, pc);
  testState.channel = selectedChannel;
  testState.context = selectedContext;
  testState.flags = flags;
  testState.disposition = disposition;

  // Start test conversation
  const statusLine = displayTestModeStatus({
    npcName: npc.name,
    channel: CHANNELS[selectedChannel].label,
    sceneName: contextPreset.label,
    flags
  });

  console.log('\n' + statusLine + '\n');

  // Test conversation loop
  const testPrompt = () => {
    const { prompt: promptColor, reset } = TUI_CONFIG.colors;
    rl.question(`${promptColor}>${reset} `, async (input) => {
      const trimmed = input.trim();

      // Parse commands
      const cmdResult = parseTestCommand(trimmed, testState);
      if (cmdResult.handled) {
        if (cmdResult.action === 'back' || cmdResult.action === 'reset') {
          // Save session before leaving
          addSession(selectedNpc.id, createSessionFromState(testState, `${testState.turnCount} turns`));
          return runNpcTestMode(rl, client);
        }

        console.log(cmdResult.response);

        if (cmdResult.newState) {
          Object.assign(testState, cmdResult.newState);
        }

        testPrompt();
        return;
      }

      // Regular conversation
      testState.turnCount++;
      addMessage(testState.memory, 'user', trimmed);

      // Build prompt with test context
      const contextSection = buildTestModePrompt(testState);
      const assembled = assembleFullPrompt(npc, testState.memory, trimmed, pc, null);
      assembled.system = assembled.system + '\n' + contextSection;

      try {
        const { npc: npcColor, system: sysColor, reset } = TUI_CONFIG.colors;
        console.log(`\n${npcColor}${npc.name}:${reset} ${sysColor}(thinking...)${reset}`);

        const response = await chat(client, assembled.system, assembled.messages);

        process.stdout.write('\x1b[1A\x1b[2K');
        console.log(formatTestModeResponse(testState, response.content) + '\n');

        addMessage(testState.memory, 'assistant', response.content);
      } catch (e) {
        console.log(`\n  Error: ${e.message}\n`);
      }

      testPrompt();
    });
  };

  // Initial NPC greeting (skip if greets_first is false)
  if (npc.greets_first !== false) {
    const greetingContext = buildTestModePrompt(testState);
    const greetingAssembled = assembleFullPrompt(npc, testState.memory, 'Greet the player appropriately for this context.', pc, null);
    greetingAssembled.system = greetingAssembled.system + '\n' + greetingContext;

    try {
      const greetingResponse = await chat(client, greetingAssembled.system, [{ role: 'user', content: 'Greet me.' }]);
      console.log(formatTestModeResponse(testState, greetingResponse.content) + '\n');
      addMessage(testState.memory, 'assistant', greetingResponse.content);
    } catch (e) {
      console.log(`  Error getting greeting: ${e.message}\n`);
    }
  } else {
    console.log(`  [NPC waits for you to speak first]\n`);
  }

  testPrompt();
}

/**
 * Run Training Session mode
 * - Shows scenario picker (S1-S6)
 * - Shows NPC picker
 * - Auto-configures state from selected scenario
 * - Shows checklist after 5 exchanges
 * - Handles /retry /edit /next /pass /fail commands
 */
async function runTrainingSession(rl, client) {
  const { npc: npcColor, system: sysColor, prompt: promptColor, reset } = TUI_CONFIG.colors;

  // Step 1: Show scenario picker
  const scenarios = listScenarios();
  const scenarioOptions = scenarios.map((s, i) => ({
    key: String(i + 1),
    label: `${s.name} - ${s.description}`,
    action: s.id
  }));

  console.log('\n' + displayScenarioMenu(scenarios, {}));
  const scenarioAnswer = await promptInput(rl, '\nSelect scenario (or B to go back): ');

  if (scenarioAnswer.toLowerCase() === 'b') {
    return main();
  }

  const scenarioNum = parseInt(scenarioAnswer);
  if (isNaN(scenarioNum) || scenarioNum < 1 || scenarioNum > scenarios.length) {
    console.log('\n  Invalid selection.\n');
    return runTrainingSession(rl, client);
  }

  const selectedScenario = scenarios[scenarioNum - 1];
  const scenario = getScenario(selectedScenario.id);

  // Step 2: Show NPC picker
  const npcs = listPersonas('Walston').filter(id => {
    const npc = loadPersona(id);
    return npc && npc.archetype !== 'narrator' && !id.startsWith('alex-');
  });

  const npcOptions = npcs.map((id, i) => {
    const npc = loadPersona(id);
    return {
      key: String(i + 1),
      label: npc ? `${npc.name} (${npc.title || npc.archetype})` : id
    };
  });

  console.log('\n' + displayPickerMenu('SELECT NPC TO TRAIN', npcOptions, 'Back'));
  const npcAnswer = await promptInput(rl, '\nSelect NPC: ');

  if (npcAnswer.toLowerCase() === 'b') {
    return runTrainingSession(rl, client);
  }

  const npcNum = parseInt(npcAnswer);
  if (isNaN(npcNum) || npcNum < 1 || npcNum > npcs.length) {
    console.log('\n  Invalid selection.\n');
    return runTrainingSession(rl, client);
  }

  const selectedNpcId = npcs[npcNum - 1];
  const npc = loadPersona(selectedNpcId);
  const pc = loadPC('alex-ryder');

  // Step 3: Auto-configure state from scenario
  let testState = createTestState(npc, pc);
  testState = applyScenarioToState(testState, scenario.id);
  testState.turnCount = 0;
  testState.checklistShown = false;

  // Show scenario info
  console.log(`\n${sysColor}═══════════════════════════════════════════════════════${reset}`);
  console.log(`${sysColor}TRAINING: ${scenario.name}${reset}`);
  console.log(`${sysColor}NPC: ${npc.name}${reset}`);
  console.log(`${sysColor}Context: ${scenario.context} | Disposition: ${scenario.disposition}${reset}`);
  console.log(`${sysColor}Checklist: ${scenario.checklist.join(', ')}${reset}`);
  console.log(`${sysColor}═══════════════════════════════════════════════════════${reset}`);
  console.log(`\n${sysColor}Suggested prompts:${reset}`);
  for (const prompt of scenario.prompts || []) {
    console.log(`  • ${prompt}`);
  }
  console.log(`\n${sysColor}Commands: /retry, /next, /pass, /fail, /checklist, /back${reset}\n`);

  // Training conversation loop
  const trainingPrompt = () => {
    // Show checklist after 5 exchanges
    if (testState.turnCount >= 5 && !testState.checklistShown) {
      testState.checklistShown = true;
      console.log('\n' + displayChecklist(scenario.checklist, testState.checklist || {}));
    }

    rl.question(`${promptColor}>${reset} `, async (input) => {
      const trimmed = input.trim();

      // Parse training commands
      const cmdResult = parseTrainingCommand(trimmed);
      if (cmdResult.handled) {
        switch (cmdResult.command) {
          case 'retry':
            // Restart same scenario with same NPC
            console.log('\n  Restarting scenario...\n');
            testState = createTestState(npc, pc);
            testState = applyScenarioToState(testState, scenario.id);
            testState.turnCount = 0;
            testState.checklistShown = false;
            trainingPrompt();
            return;

          case 'next':
            // Save result and go to next scenario
            saveTrainingResult({
              npcId: selectedNpcId,
              scenarioId: scenario.id,
              checklist: testState.checklist || {},
              passed: Object.values(testState.checklist || {}).every(v => v === 'pass' || v === null),
              notes: `Completed ${testState.turnCount} exchanges`
            });
            console.log('\n  Session saved. Returning to scenario picker...\n');
            return runTrainingSession(rl, client);

          case 'pass':
            // Mark all checklist items as pass
            testState.checklist = testState.checklist || {};
            for (const item of scenario.checklist) {
              testState.checklist[item] = 'pass';
            }
            console.log('\n  All items marked PASS.');
            console.log('\n' + displayChecklist(scenario.checklist, testState.checklist));
            trainingPrompt();
            return;

          case 'fail':
            // Mark all checklist items as fail
            testState.checklist = testState.checklist || {};
            for (const item of scenario.checklist) {
              testState.checklist[item] = 'fail';
            }
            console.log('\n  All items marked FAIL.');
            console.log('\n' + displayChecklist(scenario.checklist, testState.checklist));
            trainingPrompt();
            return;

          case 'checklist':
            console.log('\n' + displayChecklist(scenario.checklist, testState.checklist || {}));
            trainingPrompt();
            return;

          case 'back':
            // Save and return to main menu
            if (testState.turnCount > 0) {
              saveTrainingResult({
                npcId: selectedNpcId,
                scenarioId: scenario.id,
                checklist: testState.checklist || {},
                passed: false,
                notes: `Exited after ${testState.turnCount} exchanges`
              });
            }
            return main();

          case 'help':
            console.log('\n  Training Commands:');
            console.log('    /retry     - Restart this scenario');
            console.log('    /next      - Save and go to next scenario');
            console.log('    /pass      - Mark all checklist items passed');
            console.log('    /fail      - Mark all checklist items failed');
            console.log('    /checklist - Show evaluation checklist');
            console.log('    /back      - Return to main menu\n');
            trainingPrompt();
            return;

          default:
            trainingPrompt();
            return;
        }
      }

      // Regular conversation
      testState.turnCount++;
      addMessage(testState.memory, 'user', trimmed);

      // Build prompt with test context
      const contextSection = buildTestModePrompt(testState);
      const assembled = assembleFullPrompt(npc, testState.memory, trimmed, pc, null);
      assembled.system = assembled.system + '\n' + contextSection;

      try {
        console.log(`\n${npcColor}${npc.name}:${reset} ${sysColor}(thinking...)${reset}`);
        const response = await chat(client, assembled.system, assembled.messages);

        process.stdout.write('\x1b[1A\x1b[2K');
        console.log(`${npcColor}${npc.name}:${reset} ${response.content}\n`);

        addMessage(testState.memory, 'assistant', response.content);
      } catch (e) {
        console.log(`\n  Error: ${e.message}\n`);
      }

      trainingPrompt();
    });
  };

  // Initial NPC greeting (skip if greets_first is false)
  if (npc.greets_first !== false) {
    const greetingContext = buildTestModePrompt(testState);
    const greetingAssembled = assembleFullPrompt(npc, testState.memory, 'Greet the player appropriately for this context.', pc, null);
    greetingAssembled.system = greetingAssembled.system + '\n' + greetingContext;

    try {
      console.log(`${npcColor}${npc.name}:${reset} ${sysColor}(thinking...)${reset}`);
      const greetingResponse = await chat(client, greetingAssembled.system, [{ role: 'user', content: 'Greet me.' }]);
      process.stdout.write('\x1b[1A\x1b[2K');
      console.log(`${npcColor}${npc.name}:${reset} ${greetingResponse.content}\n`);
      addMessage(testState.memory, 'assistant', greetingResponse.content);
    } catch (e) {
      console.log(`  Error getting greeting: ${e.message}\n`);
    }
  } else {
    console.log(`  [NPC waits for you to speak first]\n`);
  }

  trainingPrompt();
}

/**
 * Run Red Team Validation mode
 * - Shows NPC picker or "All NPCs" option
 * - Runs fact validation queries
 * - Shows results with pass/fail/warn
 * - Optionally applies patches
 */
async function runRedTeamMode(rl, client) {
  const { system: sysColor, npc: npcColor, reset } = TUI_CONFIG.colors;

  console.log(`\n${sysColor}═══════════════════════════════════════════════════════${reset}`);
  console.log(`${sysColor}  RED TEAM NPC VALIDATION${reset}`);
  console.log(`${sysColor}═══════════════════════════════════════════════════════${reset}`);

  // Initialize red team system if needed
  try {
    initializeRedTeam();
  } catch (e) {
    // Already initialized
  }

  // Show coverage summary
  const coverage = getCoverageSummary();
  console.log(`\n  Facts: ${coverage.totalFacts} | Queries: ${coverage.totalQueries}`);
  console.log(`  NPCs covered: ${Object.keys(coverage.npcCoverage).length}\n`);

  // Build NPC options
  const npcsWithQueries = Object.keys(coverage.npcCoverage).filter(id =>
    coverage.npcCoverage[id].queries > 0
  );

  const npcOptions = npcsWithQueries.map((id, i) => {
    const cov = coverage.npcCoverage[id];
    return {
      key: String(i + 1),
      label: `${id} (${cov.queries} queries)`
    };
  });

  console.log('  Select NPC to validate:\n');
  for (const opt of npcOptions) {
    console.log(`    ${opt.key}. ${opt.label}`);
  }
  console.log(`\n    A. All NPCs`);
  console.log(`    B. Back to main menu\n`);

  const answer = await promptInput(rl, '  Select: ');

  if (answer.toLowerCase() === 'b') {
    return main();
  }

  let targetNpcs = [];

  if (answer.toLowerCase() === 'a') {
    targetNpcs = npcsWithQueries;
  } else {
    const num = parseInt(answer);
    if (!isNaN(num) && num >= 1 && num <= npcOptions.length) {
      targetNpcs = [npcsWithQueries[num - 1]];
    } else {
      console.log('\n  Invalid selection.\n');
      return runRedTeamMode(rl, client);
    }
  }

  console.log(`\n${sysColor}Running validation for: ${targetNpcs.join(', ')}${reset}\n`);

  // Run validation for each NPC
  for (const npcId of targetNpcs) {
    const npc = loadPersona(npcId);
    if (!npc) {
      console.log(`  Skipping ${npcId} - NPC not found`);
      continue;
    }

    console.log(`\n${npcColor}Validating: ${npc.name}${reset}`);

    try {
      const report = await executeRedTeamValidation(npcId, npc, {
        client,
        autoPatch: false,
        dryRun: true
      });

      console.log(formatValidationReport(report));

      // If there are failures, offer to show suggested patches
      if (report.summary.fail > 0 && report.patches && report.patches.length > 0) {
        console.log(`  ${report.patches.length} patch(es) suggested.`);
        console.log(`  Review at: ${report.reportPath}\n`);
      }
    } catch (e) {
      console.log(`  Error validating ${npcId}: ${e.message}\n`);
    }
  }

  console.log(`${sysColor}═══════════════════════════════════════════════════════${reset}`);

  // Show learning menu after validation
  return runRedTeamLearningMenu(rl, client, targetNpcs);
}

/**
 * Red Team Learning Menu - Options after validation
 */
async function runRedTeamLearningMenu(rl, client, recentNpcs = []) {
  const { system: sysColor, npc: npcColor, reset } = TUI_CONFIG.colors;

  console.log(`\n${sysColor}  LEARNING OPTIONS${reset}`);
  console.log('');
  console.log('    1. Run auto-learn on failures');
  console.log('    2. Review pending patches');
  console.log('    3. View learning log');
  console.log('    4. View learning stats');
  console.log('    5. Manage backups');
  console.log('');
  console.log('    R. Re-run validation');
  console.log('    B. Back to main menu');
  console.log('');

  const answer = await promptInput(rl, '  Select: ');

  switch (answer.toLowerCase()) {
    case '1':
      // Auto-learn on failures
      await runAutoLearn(rl, client, recentNpcs);
      return runRedTeamLearningMenu(rl, client, recentNpcs);

    case '2':
      // Review pending patches
      await reviewPendingPatches(rl, client);
      return runRedTeamLearningMenu(rl, client, recentNpcs);

    case '3':
      // View learning log
      await viewLearningLog(rl);
      return runRedTeamLearningMenu(rl, client, recentNpcs);

    case '4':
      // View stats
      console.log(`\n${sysColor}${formatStats()}${reset}\n`);
      return runRedTeamLearningMenu(rl, client, recentNpcs);

    case '5':
      // Manage backups
      await manageBackups(rl, recentNpcs);
      return runRedTeamLearningMenu(rl, client, recentNpcs);

    case 'r':
      // Re-run validation
      return runRedTeamMode(rl, client);

    case 'b':
      return main();

    default:
      console.log('\n  Invalid selection.\n');
      return runRedTeamLearningMenu(rl, client, recentNpcs);
  }
}

/**
 * Run auto-learn for failed validations
 */
async function runAutoLearn(rl, client, npcIds) {
  const { system: sysColor, npc: npcColor, reset } = TUI_CONFIG.colors;

  if (npcIds.length === 0) {
    console.log('\n  No NPCs selected. Run validation first.\n');
    return;
  }

  console.log(`\n${sysColor}Running auto-learn for ${npcIds.length} NPC(s)...${reset}\n`);

  for (const npcId of npcIds) {
    const npc = loadPersona(npcId);
    if (!npc) continue;

    console.log(`${npcColor}Processing: ${npc.name}${reset}`);

    // First run validation to get report
    const report = await executeRedTeamValidation(npcId, npc, {
      client,
      autoPatch: false,
      dryRun: true
    });

    if (report.summary.fail === 0) {
      console.log('  No failures to learn from.\n');
      continue;
    }

    console.log(`  Found ${report.summary.fail} failure(s). Generating knowledge...`);

    try {
      const learning = await runLearningForReport(report, {
        autoApply: true,
        humanReview: false,
        client
      });

      console.log(`  Results: ${learning.summary.learned} learned, ${learning.summary.failed} failed verification, ${learning.summary.escalated} escalated\n`);
    } catch (e) {
      console.log(`  Error: ${e.message}\n`);
    }
  }

  console.log(`${sysColor}Auto-learn complete.${reset}\n`);
}

/**
 * Review and apply pending patches
 */
async function reviewPendingPatches(rl, client) {
  const { system: sysColor, npc: npcColor, reset } = TUI_CONFIG.colors;

  const pending = loadPendingLearning();

  if (pending.length === 0) {
    console.log('\n  No pending patches.\n');
    return;
  }

  console.log(`\n${sysColor}${pending.length} pending patch(es) for review:${reset}\n`);

  for (let i = 0; i < pending.length; i++) {
    const cycle = pending[i];
    console.log(`  ${i + 1}. ${cycle.npc_id}`);
    console.log(`     Query: "${cycle.original_query?.slice(0, 50)}..."`);
    console.log(`     Generated: ${cycle.generated_entry?.topic} - "${cycle.generated_entry?.content?.slice(0, 40)}..."`);
    console.log('');

    const answer = await promptInput(rl, `     Apply? (y/n/s=skip all): `);

    if (answer.toLowerCase() === 'y') {
      try {
        const result = await applyPendingPatch(i, client);
        if (result.success) {
          console.log(`     ${npcColor}✓ Applied and verified${reset}\n`);
        } else {
          console.log(`     ✗ Verification failed, rolled back\n`);
        }
        // Note: index shifts after removal, but we continue with updated list
        return reviewPendingPatches(rl, client);
      } catch (e) {
        console.log(`     Error: ${e.message}\n`);
      }
    } else if (answer.toLowerCase() === 's') {
      break;
    }
  }
}

/**
 * View learning log
 */
async function viewLearningLog(rl) {
  const { system: sysColor, reset } = TUI_CONFIG.colors;

  const recent = getRecentLearning(10);

  console.log(`\n${sysColor}=== Recent Learning (last 10) ===${reset}\n`);
  console.log(formatLearningLog(recent));

  await promptInput(rl, '  Press Enter to continue...');
}

/**
 * Manage backups for NPCs
 */
async function manageBackups(rl, recentNpcs) {
  const { system: sysColor, npc: npcColor, reset } = TUI_CONFIG.colors;

  if (recentNpcs.length === 0) {
    console.log('\n  No NPCs to manage. Run validation first.\n');
    return;
  }

  console.log(`\n${sysColor}Select NPC to manage backups:${reset}\n`);

  for (let i = 0; i < recentNpcs.length; i++) {
    console.log(`    ${i + 1}. ${recentNpcs[i]}`);
  }
  console.log('    B. Back');
  console.log('');

  const answer = await promptInput(rl, '  Select: ');

  if (answer.toLowerCase() === 'b') {
    return;
  }

  const num = parseInt(answer);
  if (isNaN(num) || num < 1 || num > recentNpcs.length) {
    console.log('\n  Invalid selection.\n');
    return;
  }

  const npcId = recentNpcs[num - 1];
  const backups = listBackups(npcId);

  if (backups.length === 0) {
    console.log(`\n  No backups found for ${npcId}.\n`);
    return;
  }

  console.log(`\n${sysColor}Backups for ${npcId}:${reset}\n`);

  for (let i = 0; i < Math.min(5, backups.length); i++) {
    const b = backups[i];
    const date = new Date(b.timestamp).toLocaleString();
    console.log(`    ${i + 1}. ${date}`);
  }
  console.log('    B. Back');
  console.log('');

  const restoreAnswer = await promptInput(rl, '  Select backup to restore (or B): ');

  if (restoreAnswer.toLowerCase() === 'b') {
    return;
  }

  const restoreNum = parseInt(restoreAnswer);
  if (!isNaN(restoreNum) && restoreNum >= 1 && restoreNum <= Math.min(5, backups.length)) {
    const backup = backups[restoreNum - 1];
    const result = restoreFromBackup(npcId, backup.path);

    if (result.success) {
      console.log(`\n  ${npcColor}✓ Restored ${npcId} from backup${reset}\n`);
    } else {
      console.log(`\n  Error: ${result.message}\n`);
    }
  }
}

/**
 * Main chat loop
 */
async function main() {
  // Create readline early for interactive selection
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Initialize API client early
  try {
    client = createClient();
  } catch (e) {
    console.error(`Error: ${e.message}`);
    rl.close();
    process.exit(1);
  }

  // Check for --quick-chat flag to skip main menu
  const quickChatMode = args.includes('--quick-chat') || (worldArg && pcArg);

  if (!quickChatMode) {
    // Show main menu
    console.log('\n' + displayMainMenu());
    const menuAnswer = await promptInput(rl, '\nSelect mode: ');

    const selectedOption = MAIN_MENU_OPTIONS.find(o => o.key === menuAnswer);
    if (!selectedOption) {
      console.log('  Invalid selection.');
      rl.close();
      return;
    }

    switch (selectedOption.action) {
      case 'adventure':
        // Adventure mode - load PC and start adventure
        currentPC = loadPC('alex-ryder');
        currentPCId = 'alex-ryder';
        try {
          adventureSession = await startAdventure('high-and-dry', currentPCId, client);
          storyState = adventureSession.storyState;

          // Show scene picker
          console.log('\n' + formatScenePicker(adventureSession.adventure, storyState));
          const sceneAnswer = await promptInput(rl, '\nSelect scene (or B to go back): ');

          if (sceneAnswer.toLowerCase() === 'b') {
            return main();
          }

          const sceneNum = parseInt(sceneAnswer);
          if (!isNaN(sceneNum)) {
            const result = jumpToSceneByNumber(adventureSession, sceneNum);
            if (result.error) {
              console.log(`  ${result.error}`);
              return main();
            }
          }

          // Show theatrical frame
          console.log('\n' + displayTheatricalFrame(adventureSession));
          const frameAnswer = await promptInput(rl, '');

          if (frameAnswer.toLowerCase() === 'b') {
            return main();
          }

          // Get opening narration
          const { system: sysColor, reset } = TUI_CONFIG.colors;
          const opening = await getOpeningNarration(adventureSession);
          console.log(`\n${sysColor}AGM:${reset} ${opening}\n`);

          // Continue to adventure chat loop (handled below)
        } catch (e) {
          console.log(`\n  Error starting adventure: ${e.message}\n`);
          return main();
        }
        break;

      case 'npc-test':
        // NPC test mode
        await runNpcTestMode(rl, client);
        return;

      case 'training':
        // Training session mode
        await runTrainingSession(rl, client);
        return;

      case 'red-team':
        // Red team validation mode
        await runRedTeamMode(rl, client);
        return;

      case 'quick-chat':
        // Fall through to legacy mode
        break;

      case 'exit':
        console.log('\n  Goodbye!\n');
        rl.close();
        return;

      default:
        return main();
    }
  }

  // Legacy quick-chat mode (also used after adventure mode selection)
  let selectedWorld = worldArg || 'Walston';
  let selectedPC = pcArg;

  // Interactive world selection if not provided (for quick-chat)
  if (!selectedWorld && !adventureSession) {
    const worlds = getAvailableWorlds();
    if (worlds.length === 0) {
      console.log('\nNo NPCs found. Create NPC files in data/npcs/ first.');
      rl.close();
      return;
    }
    console.log('\n  Select a world:');
    selectedWorld = await promptSelection(
      rl,
      '  Enter number: ',
      worlds.map(w => ({ label: w, value: w }))
    );
    if (!selectedWorld) {
      console.log('  Invalid selection.');
      rl.close();
      return;
    }
  }

  // Interactive PC selection if not provided
  if (!selectedPC && !adventureSession) {
    const pcs = listPCs();
    if (pcs.length === 0) {
      console.log('\nNo PCs found. Create PC files in data/pcs/ first.');
      rl.close();
      return;
    }
    console.log('\n  Select your character:');
    const pcOptions = pcs.map(id => {
      try {
        const pc = loadPC(id);
        const species = pc.species ? ` (${pc.species})` : '';
        return { label: `${pc.name}${species}`, value: id };
      } catch {
        return { label: id, value: id };
      }
    });
    selectedPC = await promptSelection(rl, '  Enter number: ', pcOptions);
    if (!selectedPC) {
      console.log('  Invalid selection.');
      rl.close();
      return;
    }
  }

  // Load PC (if not already loaded for adventure mode)
  if (!currentPC) {
    try {
      currentPC = loadPC(selectedPC);
      currentPCId = selectedPC;
    } catch (e) {
      console.log(`\nError: PC not found: ${selectedPC}`);
      console.log('Create a PC file in data/pcs/ first.');
      printPCList();
      rl.close();
      return;
    }
  }

  // Check world has NPCs (for quick-chat mode)
  if (!adventureSession) {
    const worldNpcs = listPersonas(selectedWorld);
    if (worldNpcs.length === 0) {
      console.log(`\nNo NPCs found for world: ${selectedWorld}`);
      console.log('Check your NPC files have the correct "world" field.');
      rl.close();
      return;
    }
  }

  // Print welcome (for quick-chat mode)
  if (!adventureSession) {
    const pcSpecies = currentPC.species ? ` (${currentPC.species})` : '';
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log(`║  NPC Chat - ${selectedWorld.padEnd(51)}║`);
    console.log(`║  Playing as: ${(currentPC.name + pcSpecies).padEnd(49)}║`);
    console.log('╚════════════════════════════════════════════════════════════════╝');

    printNpcList(selectedWorld);
    console.log('  Type /help for commands, or select an NPC with /switch <n>\n');
  }

  // Handle graceful shutdown
  const shutdown = () => {
    if (currentNpcId && currentMemory) {
      console.log('\n\n  Saving conversation...');
      saveConversation(currentNpcId, selectedPC, currentMemory);
    }
    console.log('  Goodbye!\n');
    rl.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Chat loop
  const prompt = () => {
    const { prompt: promptColor, reset } = TUI_CONFIG.colors;
    const promptText = currentPersona
      ? `${promptColor}${currentPC.name}:${reset} `
      : `${promptColor}>${reset} `;

    rl.question(promptText, async (input) => {
      const trimmed = input.trim();

      // Handle commands
      if (trimmed === '/quit' || trimmed === '/exit' || trimmed === '/q') {
        shutdown();
        return;
      }

      if (trimmed === '/help') {
        printHelp();
        prompt();
        return;
      }

      if (trimmed === '/list') {
        printNpcList(selectedWorld);
        prompt();
        return;
      }

      if (trimmed === '/pc') {
        printPCList();
        prompt();
        return;
      }

      if (trimmed.startsWith('/pc ')) {
        const target = trimmed.slice(4).trim();
        switchPC(target);
        prompt();
        return;
      }

      if (trimmed.startsWith('/switch ')) {
        const target = trimmed.slice(8).trim();
        if (currentNpcId && currentMemory) {
          saveConversation(currentNpcId, selectedPC, currentMemory);
        }
        switchNpc(target, selectedWorld, selectedPC);
        prompt();
        return;
      }

      if (trimmed === '/stats') {
        const stats = getUsageStats();
        console.log('\n  --- Usage Stats ---');
        console.log(`  Requests today: ${stats.requestCount}`);
        console.log(`  Spend today: $${stats.dailySpend}`);
        console.log(`  Requests in window: ${stats.requestsInWindow}/30`);
        console.log('');
        prompt();
        return;
      }

      if (trimmed === '/memory') {
        if (currentMemory) {
          printMemorySummary(currentMemory);
        } else {
          console.log('\n  No NPC selected. Use /switch <n> first.\n');
        }
        prompt();
        return;
      }

      if (trimmed === '/status') {
        printStatus(selectedWorld, selectedPC, currentPC, currentNpcId, currentPersona, currentMemory, storyState);
        prompt();
        return;
      }

      if (trimmed === '/actions') {
        printActiveActions();
        prompt();
        return;
      }

      // Story commands
      if (trimmed === '/adventure') {
        printAdventureInfo();
        prompt();
        return;
      }

      if (trimmed.startsWith('/adventure ')) {
        const target = trimmed.slice(11).trim();
        loadAdventureById(target);
        prompt();
        return;
      }

      if (trimmed === '/scene') {
        printSceneInfo();
        prompt();
        return;
      }

      if (trimmed.startsWith('/scene ')) {
        const target = trimmed.slice(7).trim();
        printSceneInfo(target);
        prompt();
        return;
      }

      if (trimmed === '/encounter') {
        printEncounterInfo();
        prompt();
        return;
      }

      if (trimmed.startsWith('/encounter ')) {
        const target = trimmed.slice(11).trim();
        printEncounterInfo(target);
        prompt();
        return;
      }

      if (trimmed === '/progress') {
        printProgress();
        prompt();
        return;
      }

      if (trimmed.startsWith('/beat ')) {
        const target = trimmed.slice(6).trim();
        markBeat(target);
        prompt();
        return;
      }

      // /play command - start adventure play mode
      if (trimmed.startsWith('/play')) {
        const parts = trimmed.split(/\s+/);
        const advId = parts[1];

        if (!advId) {
          printAdventureInfo();
          console.log('  Use /play <adventure-id> to start adventure mode.\n');
          prompt();
          return;
        }

        if (!currentPCId) {
          console.log('\n  No PC selected. Use /pc first.\n');
          prompt();
          return;
        }

        try {
          adventureSession = await startAdventure(advId, currentPCId, client);
          storyState = adventureSession.storyState;

          const { npc: npcColor, system: sysColor, reset } = TUI_CONFIG.colors;
          const border = '─'.repeat(TUI_CONFIG.boxWidth - 2);

          console.log(`\n┌${border}┐`);
          console.log(`│  ${npcColor}ADVENTURE MODE${reset}${' '.repeat(TUI_CONFIG.boxWidth - 18)}│`);
          console.log(`│  ${adventureSession.adventure.title.padEnd(TUI_CONFIG.boxWidth - 4)}│`);
          console.log(`└${border}┘`);

          // Get and display opening narration
          const opening = await getOpeningNarration(adventureSession);
          console.log(`\n${sysColor}${adventureSession.agm.name}:${reset} ${opening}\n`);

        } catch (e) {
          console.log(`\n  Error starting adventure: ${e.message}\n`);
        }
        prompt();
        return;
      }

      // /resume command - exit NPC dialogue back to narration
      if (trimmed === '/resume' && adventureSession) {
        if (adventureSession.mode !== PLAY_MODES.NPC_DIALOGUE) {
          console.log('\n  Already in narration mode.\n');
        } else {
          try {
            const result = await resumeAgmNarration(adventureSession);
            const { system: sysColor, reset } = TUI_CONFIG.colors;
            console.log(`\n${sysColor}${adventureSession.agm.name}:${reset} ${result.text}\n`);
          } catch (e) {
            console.log(`\n  Error resuming narration: ${e.message}\n`);
          }
        }
        prompt();
        return;
      }

      // Empty input
      if (!trimmed) {
        prompt();
        return;
      }

      // Adventure mode routing - if in adventure session, route to adventure player
      if (adventureSession) {
        // Quick escape commands - handle immediately without "thinking" indicator
        if (trimmed === '/b' || trimmed === '/back') {
          console.log('\n  Returning to main menu...\n');
          adventureSession = null;
          return main();
        }
        if (trimmed === '/q' || trimmed === '/quit') {
          shutdown();
          return;
        }

        try {
          const { npc: npcColor, system: sysColor, reset } = TUI_CONFIG.colors;

          // Show thinking indicator
          const speaker = adventureSession.mode === PLAY_MODES.NPC_DIALOGUE
            ? adventureSession.activeNpc?.name || 'NPC'
            : adventureSession.agm.name;
          console.log(`\n${npcColor}${speaker}:${reset} ${sysColor}(thinking...)${reset}`);

          const result = await processPlayerInput(adventureSession, trimmed);

          // Clear thinking and show result
          process.stdout.write('\x1b[1A\x1b[2K');

          // Handle /back action - return to main menu (fallback)
          if (result.action === 'back') {
            console.log('\n  Returning to main menu...\n');
            adventureSession = null;
            return main();
          }

          // Handle different result types
          if (result.isStatus) {
            console.log(result.text);
          } else if (result.speaker) {
            // NPC dialogue response
            console.log(`${npcColor}${result.speaker}:${reset} ${result.text}`);
          } else {
            // AGM narration
            console.log(`${sysColor}${adventureSession.agm.name}:${reset} ${result.text}`);
          }

          // Show mode change notification
          if (result.modeChange === 'npc-dialogue' && result.npcGreeting) {
            console.log(`\n${npcColor}${adventureSession.activeNpc?.name}:${reset} ${result.npcGreeting}`);
          }

          // Show skill check result
          if (result.skillCheck) {
            console.log(`\n${sysColor}[${result.skillCheck.narrative}]${reset}`);
          }

          // Show state changes
          if (result.stateChanges?.length > 0) {
            result.stateChanges.forEach(change => {
              console.log(`${sysColor}  → ${change}${reset}`);
            });
          }

          console.log('');

        } catch (e) {
          console.log(`\n  Error: ${e.message}\n`);
        }
        prompt();
        return;
      }

      // No NPC selected (and not in adventure mode)
      if (!currentPersona) {
        console.log('\n  No NPC selected. Use /switch <n> to select one, or /play <adventure> for adventure mode.\n');
        printNpcList(selectedWorld);
        prompt();
        return;
      }

      // Chat with current NPC
      const gameDate = getTravellerDate();

      // Poll and display any action notifications (T2)
      displayActionNotifications(selectedPC);

      // Build prompt (include PC data and story state so NPC knows context)
      const assembled = assembleFullPrompt(currentPersona, currentMemory, trimmed, currentPC, storyState);

      try {
        const { npc: npcColor, system: sysColor, reset: rst } = TUI_CONFIG.colors;
        console.log(`\n${npcColor}${currentPersona.name}:${rst} `, `${sysColor}(thinking...)${rst}`);

        const response = await chat(client, assembled.system, assembled.messages);

        // Clear "thinking" and print response
        process.stdout.write('\x1b[1A\x1b[2K');
        console.log(`${npcColor}${currentPersona.name}:${rst} ${response.content}\n`);

        // Update memory
        addMessage(currentMemory, 'user', trimmed, gameDate);
        addMessage(currentMemory, 'assistant', response.content, gameDate);

        // Auto-save
        saveConversation(currentNpcId, selectedPC, currentMemory);

      } catch (e) {
        console.error(`\n  Error: ${e.message}\n`);
      }

      prompt();
    });
  };

  prompt();
}

// Only run main when executed directly
if (require.main === module) {
  main().catch(e => {
    console.error('Fatal error:', e.message);
    process.exit(1);
  });
}

// Export for testing
module.exports = {
  TUI_CONFIG,
  dispositionStars,
  buildProgressBar,
  // Export functions that capture output for testing
  _testExports: {
    printStatus,
    printActiveActions,
    displayActionNotifications
  }
};
