/**
 * Debug Commands - Interactive debug command handlers
 * Handles /flags, /inv, /scene, /goto, /setflag, /npc, /state commands.
 */

const fs = require('fs');
const path = require('path');
const { formatFlags, formatInventory, renderDebugOverlay } = require('./debug-overlay');

/**
 * List of recognized debug commands
 */
const DEBUG_COMMANDS = [
  '/debug',
  '/flags',
  '/inv',
  '/inventory',
  '/scene',
  '/goto',
  '/setflag',
  '/clearflag',
  '/npc',
  '/state',
  '/help'
];

/**
 * Check if input is a debug command
 * @param {string} input - User input
 * @returns {boolean} True if input starts with a debug command
 */
function isDebugCommand(input) {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim().toLowerCase();
  return DEBUG_COMMANDS.some(cmd => trimmed.startsWith(cmd));
}

/**
 * Parse command and arguments
 * @param {string} input - Full command string
 * @returns {Object} { command: string, args: string[] }
 */
function parseCommand(input) {
  const parts = input.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  return { command, args };
}

/**
 * Handle /flags command
 * @param {Object} session - Game session
 * @param {string[]} args - Command arguments
 * @returns {string} Output
 */
function handleFlags(session, args) {
  const flags = session.storyState?.flags || {};
  const lines = ['=== FLAGS ===', ''];

  if (args.length > 0 && args[0] === 'set') {
    // List only set flags
    const setFlags = Object.entries(flags)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .sort();
    if (setFlags.length === 0) {
      lines.push('No flags set.');
    } else {
      lines.push(...setFlags.map(f => `  ✓ ${f}`));
    }
  } else {
    // List all flags
    lines.push(...formatFlags(flags));
  }

  return lines.join('\n');
}

/**
 * Handle /inv command
 * @param {Object} session - Game session
 * @returns {string} Output
 */
function handleInventory(session) {
  const inventory = session.storyState?.inventory || [];
  const lines = ['=== INVENTORY ===', ''];

  if (inventory.length === 0) {
    lines.push('Inventory is empty.');
    return lines.join('\n');
  }

  const inv = formatInventory(inventory);

  lines.push('Carried:');
  for (const item of inv.carried) {
    lines.push(`  - ${item}`);
  }

  if (inv.stored.length > 0) {
    lines.push('');
    lines.push('Stored:');
    for (const item of inv.stored) {
      lines.push(`  - ${item}`);
    }
  }

  return lines.join('\n');
}

/**
 * Handle /scene command
 * @param {Object} session - Game session
 * @returns {string} Output
 */
function handleScene(session) {
  const state = session.storyState || {};
  const lines = ['=== SCENE ===', ''];

  lines.push(`Scene ID: ${state.currentScene || 'unknown'}`);
  lines.push(`Mode: ${state.mode || 'narration'}`);
  lines.push(`Act: ${state.currentAct || 'unknown'}`);

  if (state.availableTransitions?.length > 0) {
    lines.push('');
    lines.push('Available transitions:');
    for (const t of state.availableTransitions) {
      lines.push(`  → ${t}`);
    }
  }

  if (state.npcsPresent) {
    lines.push('');
    lines.push('NPCs present:');
    for (const [id, npc] of Object.entries(state.npcsPresent)) {
      lines.push(`  - ${id} (${npc.disposition || 'neutral'})`);
    }
  }

  return lines.join('\n');
}

/**
 * Handle /goto command
 * @param {Object} session - Game session
 * @param {string[]} args - Command arguments [sceneId]
 * @returns {string} Output
 */
function handleGoto(session, args) {
  if (args.length === 0) {
    return 'Usage: /goto <scene-id>';
  }

  const sceneId = args[0];
  const previousScene = session.storyState?.currentScene;

  if (!session.storyState) {
    session.storyState = {};
  }

  session.storyState.currentScene = sceneId;

  return `Jumped to scene: ${sceneId} (from ${previousScene || 'none'})`;
}

/**
 * Handle /setflag command
 * @param {Object} session - Game session
 * @param {string[]} args - Command arguments [flagName, value?]
 * @returns {string} Output
 */
function handleSetFlag(session, args) {
  if (args.length === 0) {
    return 'Usage: /setflag <flag-name> [true|false]';
  }

  const flagName = args[0];
  const value = args[1] !== 'false';

  if (!session.storyState) {
    session.storyState = {};
  }
  if (!session.storyState.flags) {
    session.storyState.flags = {};
  }

  session.storyState.flags[flagName] = value;

  return `Flag '${flagName}' set to ${value}`;
}

/**
 * Handle /clearflag command
 * @param {Object} session - Game session
 * @param {string[]} args - Command arguments [flagName]
 * @returns {string} Output
 */
function handleClearFlag(session, args) {
  if (args.length === 0) {
    return 'Usage: /clearflag <flag-name>';
  }

  const flagName = args[0];

  if (session.storyState?.flags) {
    delete session.storyState.flags[flagName];
  }

  return `Flag '${flagName}' cleared`;
}

/**
 * Handle /npc command
 * @param {Object} session - Game session
 * @param {string[]} args - Command arguments [npcId?]
 * @returns {string} Output
 */
function handleNpc(session, args) {
  const npcs = session.storyState?.npcsPresent || {};

  if (args.length === 0) {
    // List all NPCs
    const lines = ['=== NPCs ===', ''];
    const npcList = Object.keys(npcs);
    if (npcList.length === 0) {
      lines.push('No NPCs present in current scene.');
    } else {
      for (const id of npcList) {
        const npc = npcs[id];
        lines.push(`${id}:`);
        lines.push(`  Disposition: ${npc.disposition || 'neutral'}`);
        if (npc.role) lines.push(`  Role: ${npc.role}`);
        if (npc.goals) lines.push(`  Goals: ${npc.goals.join(', ')}`);
      }
    }
    return lines.join('\n');
  }

  // Show specific NPC
  const npcId = args[0];
  const npc = npcs[npcId];

  if (!npc) {
    return `NPC '${npcId}' not found in current scene.`;
  }

  const lines = [`=== NPC: ${npcId} ===`, ''];
  lines.push(`Disposition: ${npc.disposition || 'neutral'}`);
  if (npc.role) lines.push(`Role: ${npc.role}`);
  if (npc.goals) lines.push(`Goals: ${npc.goals.join(', ')}`);
  if (npc.memory) lines.push(`Memory: ${JSON.stringify(npc.memory)}`);

  return lines.join('\n');
}

/**
 * Handle /state command - dump full state to file
 * @param {Object} session - Game session
 * @param {string[]} args - Command arguments [filename?]
 * @returns {string} Output
 */
function handleState(session, args) {
  const filename = args[0] || `state-${Date.now()}.json`;
  const outputPath = path.resolve(process.cwd(), filename);

  const state = {
    timestamp: new Date().toISOString(),
    adventureId: session.adventureId,
    pcId: session.pcId,
    storyState: session.storyState
  };

  try {
    fs.writeFileSync(outputPath, JSON.stringify(state, null, 2));
    return `State dumped to: ${outputPath}`;
  } catch (err) {
    return `Failed to write state: ${err.message}`;
  }
}

/**
 * Handle /debug command - toggle or show overlay
 * @param {Object} session - Game session
 * @returns {string} Output
 */
function handleDebug(session) {
  return renderDebugOverlay(session);
}

/**
 * Handle /help command
 * @returns {string} Output
 */
function handleHelp() {
  return `=== DEBUG COMMANDS ===

/debug        Show debug overlay
/flags        List all flags (/flags set for only set flags)
/inv          Show inventory
/scene        Show current scene details
/goto <id>    Jump to scene
/setflag <f>  Set flag to true
/clearflag <f> Clear a flag
/npc [id]     Show NPC info
/state [file] Dump state to JSON file
/help         Show this help`;
}

/**
 * Handle a debug command
 * @param {string} input - User input
 * @param {Object} session - Game session
 * @returns {Object} { handled: boolean, output: string }
 */
function handleDebugCommand(input, session) {
  if (!isDebugCommand(input)) {
    return { handled: false, output: '' };
  }

  const { command, args } = parseCommand(input);
  let output = '';

  switch (command) {
    case '/debug':
      output = handleDebug(session);
      break;
    case '/flags':
      output = handleFlags(session, args);
      break;
    case '/inv':
    case '/inventory':
      output = handleInventory(session);
      break;
    case '/scene':
      output = handleScene(session);
      break;
    case '/goto':
      output = handleGoto(session, args);
      break;
    case '/setflag':
      output = handleSetFlag(session, args);
      break;
    case '/clearflag':
      output = handleClearFlag(session, args);
      break;
    case '/npc':
      output = handleNpc(session, args);
      break;
    case '/state':
      output = handleState(session, args);
      break;
    case '/help':
      output = handleHelp();
      break;
    default:
      output = `Unknown debug command: ${command}. Type /help for available commands.`;
  }

  return { handled: true, output };
}

module.exports = {
  isDebugCommand,
  handleDebugCommand,
  parseCommand,
  DEBUG_COMMANDS
};
