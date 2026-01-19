/**
 * Debug Overlay - Visual state display for interactive debug mode
 * Renders current scene, flags, inventory, and available commands.
 */

/**
 * Format flags for display
 * @param {Object} flags - Flag object { name: boolean }
 * @param {string[]} expectedFlags - Optional array of expected flags to highlight
 * @returns {string[]} Formatted flag lines
 */
function formatFlags(flags = {}, expectedFlags = []) {
  const lines = [];
  const allFlags = new Set([...Object.keys(flags), ...expectedFlags]);

  if (allFlags.size === 0) {
    return ['  (none)'];
  }

  for (const flag of [...allFlags].sort()) {
    const isSet = flags[flag];
    const isExpected = expectedFlags.includes(flag);
    const marker = isSet ? '✓' : '○';
    const highlight = isExpected && !isSet ? ' [EXPECTED]' : '';
    lines.push(`  ${marker} ${flag}${highlight}`);
  }

  return lines;
}

/**
 * Format inventory for display
 * @param {Object[]} inventory - Array of inventory items
 * @returns {Object} { carried: string[], stored: string[] }
 */
function formatInventory(inventory = []) {
  const carried = [];
  const stored = [];

  for (const item of inventory) {
    const name = item.name || item.id;
    if (item.location) {
      stored.push(`${name} (${item.location})`);
    } else if (item.confiscated) {
      stored.push(`${name} (confiscated)`);
    } else {
      carried.push(name);
    }
  }

  return {
    carried: carried.length > 0 ? carried : ['(empty)'],
    stored: stored.length > 0 ? stored : []
  };
}

/**
 * Format NPC dispositions for display
 * @param {Object} npcs - NPC state object
 * @returns {string[]} Formatted NPC lines
 */
function formatNpcs(npcs = {}) {
  const lines = [];

  for (const [id, npc] of Object.entries(npcs)) {
    const disposition = npc.disposition || 'neutral';
    const role = npc.role ? ` [${npc.role}]` : '';
    lines.push(`  ${id}: ${disposition}${role}`);
  }

  return lines.length > 0 ? lines : ['  (none present)'];
}

/**
 * Format available transitions for display
 * @param {string[]} transitions - Array of scene IDs
 * @returns {string} Comma-separated transition list
 */
function formatTransitions(transitions = []) {
  return transitions.length > 0 ? transitions.join(', ') : '(none)';
}

/**
 * Render the debug overlay box
 * @param {Object} session - Game session
 * @param {Object} options - Display options
 * @returns {string} Formatted debug overlay
 */
function renderDebugOverlay(session, options = {}) {
  const state = session.storyState || {};
  const width = options.width || 55;
  const showNpcs = options.showNpcs !== false;
  const showTransitions = options.showTransitions !== false;

  const hr = '─'.repeat(width - 2);
  const lines = [];

  // Header
  lines.push(`┌${'─'.repeat(Math.floor((width - 9) / 2))} DEBUG ${'─'.repeat(Math.ceil((width - 9) / 2))}┐`);

  // Scene info
  const sceneId = state.currentScene || 'unknown';
  const mode = state.mode || 'narration';
  lines.push(pad(`│ Scene: ${sceneId}`, width) + '│');
  lines.push(pad(`│ Mode: ${mode}`, width) + '│');

  // Flags section
  lines.push(`├${hr}┤`);
  lines.push(pad('│ FLAGS:', width) + '│');
  for (const flagLine of formatFlags(state.flags)) {
    lines.push(pad(`│${flagLine}`, width) + '│');
  }

  // Inventory section
  lines.push(`├${hr}┤`);
  lines.push(pad('│ INVENTORY:', width) + '│');
  const inv = formatInventory(state.inventory);
  lines.push(pad(`│   Carried: ${inv.carried.join(', ')}`, width) + '│');
  if (inv.stored.length > 0) {
    lines.push(pad(`│   Stored: ${inv.stored.join(', ')}`, width) + '│');
  }

  // NPCs section (optional)
  if (showNpcs && state.npcsPresent) {
    lines.push(`├${hr}┤`);
    lines.push(pad('│ NPCs:', width) + '│');
    for (const npcLine of formatNpcs(state.npcsPresent)) {
      lines.push(pad(`│${npcLine}`, width) + '│');
    }
  }

  // Transitions section (optional)
  if (showTransitions && state.availableTransitions) {
    lines.push(`├${hr}┤`);
    lines.push(pad(`│ TRANSITIONS: ${formatTransitions(state.availableTransitions)}`, width) + '│');
  }

  // Commands footer
  lines.push(`├${hr}┤`);
  lines.push(pad('│ COMMANDS: /flags, /inv, /scene, /goto <scene>', width) + '│');
  lines.push(`└${'─'.repeat(width - 2)}┘`);

  return lines.join('\n');
}

/**
 * Pad string to width with spaces
 * @param {string} str - Input string
 * @param {number} width - Target width
 * @returns {string} Padded string
 */
function pad(str, width) {
  if (str.length >= width) {
    return str.slice(0, width - 1);
  }
  return str + ' '.repeat(width - str.length - 1);
}

/**
 * Render compact status line
 * @param {Object} session - Game session
 * @returns {string} Single-line status
 */
function renderStatusLine(session) {
  const state = session.storyState || {};
  const scene = state.currentScene || '?';
  const flagCount = Object.values(state.flags || {}).filter(Boolean).length;
  const itemCount = (state.inventory || []).length;

  return `[Scene: ${scene} | Flags: ${flagCount} | Items: ${itemCount}]`;
}

module.exports = {
  formatFlags,
  formatInventory,
  formatNpcs,
  formatTransitions,
  renderDebugOverlay,
  renderStatusLine
};
