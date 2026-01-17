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

const fs = require('fs');
const path = require('path');

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
  console.log('\n┌────────────────────────────────────────────────────────────────┐');
  console.log(`│  ${persona.name.padEnd(62)}│`);
  console.log(`│  ${(persona.title + ' - ' + persona.world).slice(0, 62).padEnd(62)}│`);
  console.log('└────────────────────────────────────────────────────────────────┘\n');
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
  console.log('    /stats         - Show API usage statistics');
  console.log('    /memory        - Show memory summary');
  console.log('');
  console.log('  Story Commands:');
  console.log('    /adventure     - Show/load adventure');
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
    console.log('\n  ┌────────────────────────────────────────────────────────┐');
    console.log(`  │  ${scene.title.padEnd(54)}│`);
    console.log('  └────────────────────────────────────────────────────────┘');
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
    console.log('\n  ┌────────────────────────────────────────────────────────┐');
    console.log(`  │  ${details.title.padEnd(54)}│`);
    console.log('  └────────────────────────────────────────────────────────┘');
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
 * Main chat loop
 */
async function main() {
  // Create readline early for interactive selection
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let selectedWorld = worldArg;
  let selectedPC = pcArg;

  // Interactive world selection if not provided
  if (!selectedWorld) {
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
  if (!selectedPC) {
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

  // Load PC
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

  // Check world has NPCs
  const worldNpcs = listPersonas(selectedWorld);
  if (worldNpcs.length === 0) {
    console.log(`\nNo NPCs found for world: ${selectedWorld}`);
    console.log('Check your NPC files have the correct "world" field.');
    rl.close();
    return;
  }

  // Initialize API client
  try {
    client = createClient();
  } catch (e) {
    console.error(`Error: ${e.message}`);
    rl.close();
    process.exit(1);
  }

  // Print welcome
  const pcSpecies = currentPC.species ? ` (${currentPC.species})` : '';
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log(`║  NPC Chat - ${selectedWorld.padEnd(51)}║`);
  console.log(`║  Playing as: ${(currentPC.name + pcSpecies).padEnd(49)}║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');

  printNpcList(selectedWorld);
  console.log('  Type /help for commands, or select an NPC with /switch <n>\n');

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
    const promptText = currentPersona
      ? `\x1b[36m${currentPC.name}:\x1b[0m `
      : '\x1b[36m>\x1b[0m ';

    rl.question(promptText, async (input) => {
      const trimmed = input.trim();

      // Handle commands
      if (trimmed === '/quit' || trimmed === '/exit') {
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

      // Empty input
      if (!trimmed) {
        prompt();
        return;
      }

      // No NPC selected
      if (!currentPersona) {
        console.log('\n  No NPC selected. Use /switch <n> to select one.\n');
        printNpcList(selectedWorld);
        prompt();
        return;
      }

      // Chat with current NPC
      const gameDate = getTravellerDate();

      // Build prompt (include PC data so NPC knows who they're talking to)
      const assembled = assembleFullPrompt(currentPersona, currentMemory, trimmed, currentPC);

      try {
        console.log(`\n\x1b[33m${currentPersona.name}:\x1b[0m `, '(thinking...)');

        const response = await chat(client, assembled.system, assembled.messages);

        // Clear "thinking" and print response
        process.stdout.write('\x1b[1A\x1b[2K');
        console.log(`\x1b[33m${currentPersona.name}:\x1b[0m ${response.content}\n`);

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

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
