/**
 * TUI Menu - Main menu system with box-drawing
 *
 * Pattern: Menu state machine with box-drawing UI
 * Provides the main entry point for the NPC Persona Prototype
 */

const readline = require('readline');

// Box drawing characters
const BOX = {
  topLeft: '╔',
  topRight: '╗',
  bottomLeft: '╚',
  bottomRight: '╝',
  horizontal: '═',
  vertical: '║',
  leftT: '╠',
  rightT: '╣'
};

// Default menu width
const MENU_WIDTH = 44;

/**
 * Draw a box around content
 * @param {string[]} lines - Lines of content
 * @param {number} [width] - Box width (auto-calculated if not provided)
 * @returns {string} Formatted box string
 */
function drawBox(lines, width = MENU_WIDTH) {
  const innerWidth = width - 2;
  const topBorder = BOX.topLeft + BOX.horizontal.repeat(innerWidth) + BOX.topRight;
  const bottomBorder = BOX.bottomLeft + BOX.horizontal.repeat(innerWidth) + BOX.bottomRight;

  const content = lines.map(line => {
    const padding = innerWidth - stripAnsi(line).length;
    return BOX.vertical + line + ' '.repeat(Math.max(0, padding)) + BOX.vertical;
  });

  return [topBorder, ...content, bottomBorder].join('\n');
}

/**
 * Draw a box with a header separator
 * @param {string} header - Header text
 * @param {string[]} bodyLines - Body content lines
 * @param {number} [width] - Box width
 * @returns {string} Formatted box string
 */
function drawBoxWithHeader(header, bodyLines, width = MENU_WIDTH) {
  const innerWidth = width - 2;
  const topBorder = BOX.topLeft + BOX.horizontal.repeat(innerWidth) + BOX.topRight;
  const separator = BOX.leftT + BOX.horizontal.repeat(innerWidth) + BOX.rightT;
  const bottomBorder = BOX.bottomLeft + BOX.horizontal.repeat(innerWidth) + BOX.bottomRight;

  const headerPadding = innerWidth - stripAnsi(header).length;
  const headerLine = BOX.vertical + header + ' '.repeat(Math.max(0, headerPadding)) + BOX.vertical;

  const content = bodyLines.map(line => {
    const padding = innerWidth - stripAnsi(line).length;
    return BOX.vertical + line + ' '.repeat(Math.max(0, padding)) + BOX.vertical;
  });

  return [topBorder, headerLine, separator, ...content, bottomBorder].join('\n');
}

/**
 * Strip ANSI codes for length calculation
 * @param {string} str - String with potential ANSI codes
 * @returns {string} String without ANSI codes
 */
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Pad a string to a fixed width
 * @param {string} str - String to pad
 * @param {number} width - Target width
 * @returns {string} Padded string
 */
function padTo(str, width) {
  const visibleLength = stripAnsi(str).length;
  return str + ' '.repeat(Math.max(0, width - visibleLength));
}

/**
 * Center text within a width
 * @param {string} str - String to center
 * @param {number} width - Target width
 * @returns {string} Centered string
 */
function centerText(str, width) {
  const visibleLength = stripAnsi(str).length;
  const padding = Math.max(0, width - visibleLength);
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;
  return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
}

/**
 * Main menu options
 */
const MAIN_MENU_OPTIONS = [
  { key: '1', label: 'Play High and Dry Adventure', action: 'adventure' },
  { key: '2', label: 'Communicate with NPC (Test Mode)', action: 'npc-test' },
  { key: '3', label: 'Training Session', action: 'training' },
  { key: '4', label: 'Quick Chat (Legacy Mode)', action: 'quick-chat' },
  { key: '5', label: 'Red Team Validation', action: 'red-team' },
  { key: '6', label: 'Exit', action: 'exit' }
];

/**
 * Display the main menu
 * @returns {string} Formatted menu
 */
function displayMainMenu() {
  const innerWidth = MENU_WIDTH - 2;
  const header = centerText('NPC PERSONA PROTOTYPE', innerWidth);

  const bodyLines = [
    '', // blank line
    ...MAIN_MENU_OPTIONS.map(opt => `  ${opt.key}. ${opt.label}`),
    '' // blank line
  ];

  return drawBoxWithHeader(header, bodyLines);
}

/**
 * Display a picker menu
 * @param {string} title - Menu title
 * @param {Array<{key: string, label: string}>} options - Menu options
 * @param {string} [backLabel] - Label for back option
 * @returns {string} Formatted menu
 */
function displayPickerMenu(title, options, backLabel = 'Back to Main Menu') {
  const innerWidth = MENU_WIDTH - 2;
  const header = centerText(title, innerWidth);

  const bodyLines = [
    '', // blank line
    ...options.map(opt => `  ${opt.key}. ${opt.label}`),
    '',
    `  [B] ${backLabel}`,
    '' // blank line
  ];

  return drawBoxWithHeader(header, bodyLines);
}

/**
 * Display a scene start theatrical frame
 * @param {Object} scene - Scene data
 * @param {Object} pc - Player character
 * @param {Array} npcs - NPCs in scene
 * @returns {string} Formatted frame
 */
function displaySceneFrame(scene, pc, npcs = []) {
  const innerWidth = MENU_WIDTH + 8;
  const header = centerText(`SCENE: ${scene.title?.toUpperCase() || 'UNKNOWN'}`, innerWidth);

  const bodyLines = [
    `  Setting: ${scene.setting || 'Unknown'}`,
    '',
    '  DRAMATIS PERSONAE:',
    `  • ${pc.name} (You)`
  ];

  for (const npc of npcs) {
    bodyLines.push(`  • ${npc.name} - ${npc.title || npc.archetype}`);
  }

  bodyLines.push('');
  bodyLines.push('  [Press Enter to begin, B to go back]');
  bodyLines.push('');

  return drawBoxWithHeader(header, bodyLines, innerWidth + 2);
}

/**
 * Display contact history box
 * @param {string} npcName - NPC name
 * @param {Array} sessions - Previous session summaries
 * @returns {string} Formatted box
 */
function displayContactHistory(npcName, sessions = []) {
  const innerWidth = MENU_WIDTH + 8;
  const header = centerText(`PREVIOUS CONTACTS WITH ${npcName.toUpperCase()}`, innerWidth);

  const bodyLines = [];

  if (sessions.length === 0) {
    bodyLines.push('');
    bodyLines.push('  No previous contacts recorded.');
    bodyLines.push('');
  } else {
    for (const session of sessions) {
      bodyLines.push('');
      bodyLines.push(`  Session ${session.number} - ${session.channel}, ${session.context}`);
      bodyLines.push(`    "${session.summary}"`);
      bodyLines.push(`    Disposition: ${session.disposition}`);
    }
    bodyLines.push('');
  }

  bodyLines.push('  [Enter] Start new conversation');
  bodyLines.push('  [C] Clear history for fresh test');
  bodyLines.push('  [B] Back');
  bodyLines.push('');

  return drawBoxWithHeader(header, bodyLines, innerWidth + 2);
}

/**
 * Display flag toggle menu
 * @param {Object} flags - Current flag states
 * @param {string[]} availableFlags - All available flags
 * @returns {string} Formatted menu
 */
function displayFlagMenu(flags = {}, availableFlags = []) {
  const innerWidth = MENU_WIDTH + 8;
  const header = centerText('SET STORY FLAGS', innerWidth);
  const subHeader = '  (affects NPC knowledge & mood)';

  const bodyLines = [subHeader, ''];

  for (const flag of availableFlags) {
    const checked = flags[flag] ? '[x]' : '[ ]';
    bodyLines.push(`  ${checked} ${flag}`);
  }

  bodyLines.push('');
  bodyLines.push('  [Enter] Continue with these flags');
  bodyLines.push('  [B] Back');
  bodyLines.push('');

  return drawBoxWithHeader(header, bodyLines, innerWidth + 2);
}

/**
 * Display test mode status bar
 * @param {Object} context - Test context
 * @returns {string} Status line
 */
function displayTestModeStatus(context) {
  const parts = [
    `TEST MODE: ${context.npcName}`,
    context.channel,
    context.sceneName
  ];

  const flagList = Object.entries(context.flags || {})
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', ');

  if (flagList) {
    parts.push(`Flags: ${flagList}`);
  }

  const border = '═'.repeat(parts.join(' | ').length + 4);
  return `${border}\n${parts.join(' | ')}\n${border}`;
}

/**
 * Prompt user for input with readline
 * @param {readline.Interface} rl - Readline interface
 * @param {string} prompt - Prompt text
 * @returns {Promise<string>} User input
 */
function promptInput(rl, prompt) {
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt for menu selection
 * @param {readline.Interface} rl - Readline interface
 * @param {string} menuDisplay - Menu to display
 * @param {Array<{key: string, action: string}>} options - Valid options
 * @returns {Promise<string>} Selected action
 */
async function promptMenuSelection(rl, menuDisplay, options) {
  console.log('\n' + menuDisplay + '\n');
  const answer = await promptInput(rl, 'Select: ');

  const selection = answer.toLowerCase();
  const option = options.find(o => o.key.toLowerCase() === selection);

  if (option) {
    return option.action;
  }

  if (selection === 'b') {
    return 'back';
  }

  return null;
}

/**
 * Display a training checklist for evaluation
 * @param {string[]} items - Checklist items to evaluate
 * @param {Object} [results] - Current evaluation results {VOICE: 'pass', ...}
 * @returns {string} Formatted checklist
 */
function displayChecklist(items, results = {}) {
  const innerWidth = MENU_WIDTH + 8;
  const header = centerText('EVALUATION CHECKLIST', innerWidth);

  const descriptions = {
    VOICE: 'Character voice matches persona',
    KNOWLEDGE: 'Demonstrates appropriate knowledge',
    DISPOSITION: 'Tone reflects disposition level',
    AGENDA: 'Pursues goals appropriately',
    BOUNDARIES: 'Refuses inappropriate requests',
    CONSISTENCY: 'Consistent with prior statements'
  };

  const bodyLines = [''];

  for (const item of items) {
    const status = results[item];
    let indicator = '[ ]';
    if (status === 'pass') indicator = '[✓]';
    if (status === 'fail') indicator = '[✗]';

    const desc = descriptions[item] || item;
    bodyLines.push(`  ${indicator} ${item}: ${desc}`);
  }

  bodyLines.push('');
  bodyLines.push('  Commands:');
  bodyLines.push('    /pass [item] - Mark item passed');
  bodyLines.push('    /fail [item] - Mark item failed');
  bodyLines.push('    /next - Finish and go to next scenario');
  bodyLines.push('    /retry - Restart this scenario');
  bodyLines.push('');

  return drawBoxWithHeader(header, bodyLines, innerWidth + 2);
}

/**
 * Display training scenario selection menu
 * @param {Array} scenarios - List of scenarios
 * @param {Object} [history] - Pass/fail history by scenario
 * @returns {string} Formatted menu
 */
function displayScenarioMenu(scenarios, history = {}) {
  const innerWidth = MENU_WIDTH + 8;
  const header = centerText('SELECT TRAINING SCENARIO', innerWidth);

  const bodyLines = [''];

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const stats = history[s.id] || { passed: 0, failed: 0 };
    const indicator = stats.passed > 0 ? '✓' : ' ';
    bodyLines.push(`  ${indicator} ${i + 1}. ${s.name}`);
    bodyLines.push(`       ${s.description || ''}`);
  }

  bodyLines.push('');
  bodyLines.push('  [B] Back');
  bodyLines.push('');

  return drawBoxWithHeader(header, bodyLines, innerWidth + 2);
}

module.exports = {
  // Box drawing
  drawBox,
  drawBoxWithHeader,
  stripAnsi,
  padTo,
  centerText,
  BOX,
  MENU_WIDTH,

  // Menus
  displayMainMenu,
  displayPickerMenu,
  displaySceneFrame,
  displayContactHistory,
  displayFlagMenu,
  displayTestModeStatus,
  displayChecklist,
  displayScenarioMenu,
  MAIN_MENU_OPTIONS,

  // Input
  promptInput,
  promptMenuSelection
};
