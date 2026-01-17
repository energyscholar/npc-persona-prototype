#!/usr/bin/env node
/**
 * TUI Live-System Tests
 *
 * Comprehensive tests for all TUI menu paths and flows.
 * Uses mocked AI client - no real API calls.
 * Tests each menu option happy path and catches obvious bugs/failures.
 */

const { strict: assert } = require('assert');
const path = require('path');

// Core modules under test
const { loadPersona, listPersonas, getPersonaSummary } = require('../src/persona');
const { loadPC, listPCs } = require('../src/pc-roster');
const { createMemory, addMessage } = require('../src/memory');
const { assembleFullPrompt } = require('../src/prompts');
const { createTestState, CONTEXT_PRESETS } = require('../src/npc-test-mode');
const { SCENARIOS, CHECKLIST_ITEMS, getScenario, listScenarios } = require('../src/training-scenarios');

// TUI modules
const {
  drawBox,
  drawBoxWithHeader,
  stripAnsi,
  padTo,
  centerText,
  displayMainMenu,
  displayPickerMenu,
  displayChecklist,
  displayScenarioMenu,
  displayTestModeStatus,
  MAIN_MENU_OPTIONS,
  MENU_WIDTH
} = require('../src/tui-menu');

// Adventure modules
const { loadAdventure, listAdventures } = require('../src/story-engine');

// Chat TUI exports
let TUI_CONFIG, dispositionStars, buildProgressBar, _testExports;
try {
  const chatTui = require('../src/chat-tui');
  TUI_CONFIG = chatTui.TUI_CONFIG;
  dispositionStars = chatTui.dispositionStars;
  buildProgressBar = chatTui.buildProgressBar;
  _testExports = chatTui._testExports;
} catch (e) {
  console.error('Warning: Could not load chat-tui exports:', e.message);
}

// Test utilities
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    passed++;
  } catch (e) {
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    passed++;
  } catch (e) {
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

// Mock AI client
function mockChat(client, system, messages) {
  return Promise.resolve({
    content: 'Mock response for testing.',
    usage: { input_tokens: 100, output_tokens: 20 }
  });
}

// ============================================================
// MENU SYSTEM TESTS
// ============================================================

console.log('\n▸ Main Menu Display');

test('displayMainMenu returns valid box structure', () => {
  const menu = displayMainMenu();
  assert(menu.includes('╔'), 'Should have top-left corner');
  assert(menu.includes('╗'), 'Should have top-right corner');
  assert(menu.includes('╚'), 'Should have bottom-left corner');
  assert(menu.includes('╝'), 'Should have bottom-right corner');
  assert(menu.includes('NPC PERSONA PROTOTYPE'), 'Should have title');
});

test('displayMainMenu shows all menu options', () => {
  const menu = displayMainMenu();
  assert(menu.includes('1. Play High and Dry Adventure'), 'Should show adventure option');
  assert(menu.includes('2. Communicate with NPC'), 'Should show test mode option');
  assert(menu.includes('3. Training Session'), 'Should show training option');
  assert(menu.includes('4. Quick Chat'), 'Should show legacy option');
  assert(menu.includes('5. Exit'), 'Should show exit option');
});

test('MAIN_MENU_OPTIONS has correct structure', () => {
  assert.equal(MAIN_MENU_OPTIONS.length, 5, 'Should have 5 options');

  const actions = MAIN_MENU_OPTIONS.map(o => o.action);
  assert(actions.includes('adventure'), 'Should have adventure action');
  assert(actions.includes('npc-test'), 'Should have npc-test action');
  assert(actions.includes('training'), 'Should have training action');
  assert(actions.includes('quick-chat'), 'Should have quick-chat action');
  assert(actions.includes('exit'), 'Should have exit action');
});

test('menu option keys are unique', () => {
  const keys = MAIN_MENU_OPTIONS.map(o => o.key);
  const uniqueKeys = new Set(keys);
  assert.equal(keys.length, uniqueKeys.size, 'All keys should be unique');
});

// ============================================================
// OPTION 1: ADVENTURE MODE TESTS
// ============================================================

console.log('\n▸ Option 1: Adventure Mode Prerequisites');

test('alex-ryder PC loads correctly (hotfix verification)', () => {
  const pc = loadPC('alex-ryder');
  assert.equal(pc.id, 'alex-ryder', 'PC ID should be alex-ryder');
  assert(pc.name, 'PC should have a name');
});

test('high-and-dry adventure loads', () => {
  const adventure = loadAdventure('high-and-dry');
  assert(adventure, 'Adventure should load');
  assert(adventure.id === 'high-and-dry', 'Should have correct ID');
  assert(adventure.acts, 'Adventure should have acts');
  assert(adventure.acts.length > 0, 'Should have at least one act');
});

test('adventure has required structure', () => {
  const adventure = loadAdventure('high-and-dry');
  assert(adventure.title, 'Adventure should have title');
  assert(adventure.world, 'Adventure should have world');
  assert(adventure.npcs, 'Adventure should have NPCs list');
  assert(adventure.npcs.length > 0, 'Should have at least one NPC');
});

test('narrator NPC loads for adventure', () => {
  const narrator = loadPersona('narrator-high-and-dry');
  assert(narrator, 'Narrator should load');
  assert.equal(narrator.archetype, 'narrator', 'Should be narrator archetype');
});

test('listAdventures returns available adventures', () => {
  const adventures = listAdventures();
  assert(Array.isArray(adventures), 'Should return array');
  assert(adventures.includes('high-and-dry'), 'Should include high-and-dry');
});

// ============================================================
// OPTION 2: NPC TEST MODE TESTS
// ============================================================

console.log('\n▸ Option 2: NPC Test Mode Prerequisites');

test('listPersonas returns NPCs for world selection', () => {
  const walston = listPersonas('Walston');
  assert(walston.length > 0, 'Should have Walston NPCs');
  assert(walston.includes('minister-greener'), 'Should include Greener');
});

test('CONTEXT_PRESETS are defined', () => {
  assert(CONTEXT_PRESETS, 'CONTEXT_PRESETS should exist');
  assert(CONTEXT_PRESETS['first-meeting'], 'Should have first-meeting preset');
  assert(CONTEXT_PRESETS['during-crisis'], 'Should have during-crisis preset');
});

test('createTestState creates valid state', () => {
  const npc = loadPersona('minister-greener');
  const pc = loadPC('traveller-one');
  const state = createTestState(npc, pc);

  assert(state, 'Should create state');
  assert(state.memory, 'Should have memory');
  assert.equal(state.disposition, 0, 'Initial disposition should be 0');
  assert(typeof state.flags === 'object', 'Flags should be object');
});

test('test mode state can set disposition', () => {
  const npc = loadPersona('minister-greener');
  const pc = loadPC('traveller-one');
  const state = createTestState(npc, pc);

  state.disposition = 2;
  assert.equal(state.disposition, 2, 'Should allow disposition change');
});

test('test mode state can set channel', () => {
  const npc = loadPersona('minister-greener');
  const pc = loadPC('traveller-one');
  const state = createTestState(npc, pc);

  state.channel = 'radio';
  assert.equal(state.channel, 'radio', 'Should allow channel change');
});

test('assembleFullPrompt works with test mode state', () => {
  const npc = loadPersona('minister-greener');
  const pc = loadPC('traveller-one');
  const state = createTestState(npc, pc);

  const assembled = assembleFullPrompt(npc, state.memory, 'Hello', pc, null);

  assert(assembled.system, 'Should have system prompt');
  assert(assembled.messages, 'Should have messages');
  assert(assembled.system.includes('Alan Greener'), 'Should include NPC name');
});

// ============================================================
// OPTION 3: TRAINING SESSION TESTS
// ============================================================

console.log('\n▸ Option 3: Training Session Prerequisites');

test('SCENARIOS are defined', () => {
  assert(SCENARIOS, 'SCENARIOS should exist');
  assert(SCENARIOS.s1_first_meeting, 'Should have s1_first_meeting');
  assert(SCENARIOS.s2_hostile_approach, 'Should have s2_hostile_approach');
  assert(SCENARIOS.s3_friendly_rapport, 'Should have s3_friendly_rapport');
});

test('getScenario returns valid scenario', () => {
  const scenario = getScenario('s1_first_meeting');
  assert(scenario, 'Should return scenario');
  assert.equal(scenario.id, 's1_first_meeting', 'Should have correct ID');
  assert(scenario.checklist, 'Should have checklist');
  assert(scenario.prompts, 'Should have prompts');
});

test('listScenarios returns all scenarios', () => {
  const scenarios = listScenarios();
  assert(Array.isArray(scenarios), 'Should return array');
  assert(scenarios.length >= 4, 'Should have at least 4 scenarios');
});

test('CHECKLIST_ITEMS are defined', () => {
  assert(CHECKLIST_ITEMS, 'CHECKLIST_ITEMS should exist');
  assert(CHECKLIST_ITEMS.VOICE, 'Should have VOICE item');
  assert(CHECKLIST_ITEMS.KNOWLEDGE, 'Should have KNOWLEDGE item');
  assert(CHECKLIST_ITEMS.DISPOSITION, 'Should have DISPOSITION item');
});

test('displayScenarioMenu renders correctly', () => {
  const scenarios = listScenarios();
  const menu = displayScenarioMenu(scenarios);
  assert(menu.includes('SCENARIO'), 'Should have title');
  assert(menu.includes('First Meeting'), 'Should show S1');
});

test('displayChecklist renders correctly', () => {
  const checklist = ['VOICE', 'KNOWLEDGE'];
  const results = { VOICE: true, KNOWLEDGE: null };
  const display = displayChecklist(checklist, results);

  assert(display.includes('VOICE'), 'Should show VOICE');
  assert(display.includes('KNOWLEDGE'), 'Should show KNOWLEDGE');
});

test('scenario can configure test state', () => {
  const scenario = getScenario('s2_hostile_approach');
  const npc = loadPersona('minister-greener');
  const pc = loadPC('traveller-one');
  const state = createTestState(npc, pc);

  // Apply scenario config
  state.context = scenario.context;
  state.disposition = scenario.disposition;

  assert.equal(state.disposition, -2, 'Should apply hostile disposition');
  assert.equal(state.context, 'confrontation', 'Should apply confrontation context');
});

// ============================================================
// OPTION 4: QUICK CHAT (LEGACY) TESTS
// ============================================================

console.log('\n▸ Option 4: Quick Chat Prerequisites');

test('loadPersona works without world filter', () => {
  const persona = loadPersona('minister-greener');
  assert(persona, 'Should load persona');
  assert(persona.name, 'Should have name');
});

test('createMemory initializes for legacy mode', () => {
  const memory = createMemory();
  assert.equal(memory.totalInteractions, 0, 'Should start at 0');
  assert.deepEqual(memory.recentMessages, [], 'Should have empty messages');
});

test('assembleFullPrompt works for legacy mode', () => {
  const persona = loadPersona('minister-greener');
  const memory = createMemory();

  const assembled = assembleFullPrompt(persona, memory, 'Test message');

  assert(assembled.system, 'Should have system');
  assert(assembled.messages, 'Should have messages');
  assert(assembled.messages.length > 0, 'Should have at least one message');
});

// ============================================================
// BOX DRAWING TESTS
// ============================================================

console.log('\n▸ Box Drawing Functions');

test('drawBox creates valid box', () => {
  const box = drawBox(['Line 1', 'Line 2']);
  assert(box.includes('╔'), 'Should have corners');
  assert(box.includes('Line 1'), 'Should contain content');
});

test('drawBoxWithHeader creates valid box with separator', () => {
  const box = drawBoxWithHeader('Header', ['Body line']);
  assert(box.includes('╠'), 'Should have left T-junction');
  assert(box.includes('╣'), 'Should have right T-junction');
  assert(box.includes('Header'), 'Should show header');
});

test('stripAnsi removes ANSI codes', () => {
  const colored = '\x1b[32mGreen\x1b[0m';
  const stripped = stripAnsi(colored);
  assert.equal(stripped, 'Green', 'Should strip color codes');
});

test('padTo pads string correctly', () => {
  const padded = padTo('Hi', 10);
  assert.equal(padded.length, 10, 'Should be 10 chars');
  assert(padded.startsWith('Hi'), 'Should start with original');
});

test('centerText centers correctly', () => {
  const centered = centerText('Hi', 10);
  assert.equal(centered.length, 10, 'Should be 10 chars');
  assert(centered.includes('Hi'), 'Should contain text');
  assert(centered.startsWith('    '), 'Should have leading spaces');
});

// ============================================================
// TUI CONFIG TESTS
// ============================================================

console.log('\n▸ TUI Configuration');

if (TUI_CONFIG) {
  test('TUI_CONFIG has required structure', () => {
    assert(typeof TUI_CONFIG.boxWidth === 'number', 'boxWidth should be number');
    assert(TUI_CONFIG.boxWidth > 0, 'boxWidth should be positive');
    assert(TUI_CONFIG.colors, 'Should have colors');
    assert(TUI_CONFIG.progressBar, 'Should have progressBar config');
  });

  test('TUI_CONFIG colors are complete', () => {
    const requiredColors = ['prompt', 'npc', 'system', 'action', 'error', 'reset'];
    for (const color of requiredColors) {
      assert(TUI_CONFIG.colors[color] !== undefined, `Should have ${color} color`);
    }
  });
}

if (dispositionStars) {
  test('dispositionStars handles full range', () => {
    for (let d = -3; d <= 3; d++) {
      const stars = dispositionStars(d);
      assert.equal(stars.length, 6, `Should have 6 chars for disposition ${d}`);
    }
  });
}

if (buildProgressBar) {
  test('buildProgressBar handles 0-100 range', () => {
    for (let p = 0; p <= 100; p += 25) {
      const bar = buildProgressBar(p);
      assert(bar.length > 0, `Should create bar for ${p}%`);
    }
  });
}

// ============================================================
// PICKER MENU TESTS
// ============================================================

console.log('\n▸ Picker Menus');

test('displayPickerMenu renders NPC list', () => {
  const options = [
    { key: '1', label: 'Minister Greener' },
    { key: '2', label: 'Captain Corelli' }
  ];
  const menu = displayPickerMenu('Select NPC', options);

  assert(menu.includes('Select NPC'), 'Should show title');
  assert(menu.includes('Minister Greener'), 'Should show NPC 1');
  assert(menu.includes('Captain Corelli'), 'Should show NPC 2');
});

test('displayTestModeStatus renders correctly', () => {
  const status = displayTestModeStatus({
    npcName: 'Minister Greener',
    sceneName: 'first-meeting',
    channel: 'in-person',
    flags: {}
  });

  assert(status.includes('Minister Greener'), 'Should show NPC name');
  assert(status.includes('in-person'), 'Should show channel');
});

// ============================================================
// INPUT VALIDATION TESTS
// ============================================================

console.log('\n▸ Input Validation');

test('menu option lookup finds valid options', () => {
  for (const opt of MAIN_MENU_OPTIONS) {
    const found = MAIN_MENU_OPTIONS.find(o => o.key === opt.key);
    assert(found, `Should find option with key ${opt.key}`);
    assert.equal(found.action, opt.action, 'Should match action');
  }
});

test('invalid menu key returns undefined', () => {
  const invalid = MAIN_MENU_OPTIONS.find(o => o.key === '99');
  assert.equal(invalid, undefined, 'Should not find invalid key');
});

// ============================================================
// NPC DATA INTEGRITY TESTS
// ============================================================

console.log('\n▸ NPC Data Integrity (All Walston NPCs)');

const walstonNpcs = listPersonas('Walston');
for (const npcId of walstonNpcs) {
  test(`${npcId} has required fields for TUI`, () => {
    const npc = loadPersona(npcId);
    assert(npc.id, 'Should have id');
    assert(npc.name, 'Should have name');
    assert(npc.archetype, 'Should have archetype');
  });
}

// ============================================================
// PC DATA INTEGRITY TESTS
// ============================================================

console.log('\n▸ PC Data Integrity');

test('all PCs load correctly', () => {
  const pcs = listPCs();
  assert(pcs.length > 0, 'Should have at least one PC');

  for (const pcId of pcs) {
    const pc = loadPC(pcId);
    assert(pc.id, `PC ${pcId} should have id`);
    assert(pc.name, `PC ${pcId} should have name`);
  }
});

// ============================================================
// PROMPT ASSEMBLY INTEGRATION TESTS
// ============================================================

console.log('\n▸ Prompt Assembly Integration');

asyncTest('full prompt assembly for test mode chat', async () => {
  const npc = loadPersona('minister-greener');
  const pc = loadPC('alex-ryder');
  const state = createTestState(npc, pc);

  // Simulate a test mode conversation
  const assembled = assembleFullPrompt(npc, state.memory, 'Hello, Minister', pc, null);

  // Verify prompt structure
  assert(assembled.system.length > 100, 'System prompt should be substantial');
  assert(assembled.messages.length > 0, 'Should have messages');

  // Mock the chat call
  const response = await mockChat(null, assembled.system, assembled.messages);
  assert(response.content, 'Should get response');
});

asyncTest('full prompt assembly for adventure mode', async () => {
  const narrator = loadPersona('narrator-high-and-dry');
  const pc = loadPC('alex-ryder');
  const memory = createMemory();

  // Assemble with correct parameter order
  const assembled = assembleFullPrompt(narrator, memory, 'What happens next?', pc, null);

  assert(assembled.system, 'Should have system prompt');
  assert(assembled.messages, 'Should have messages array');

  const response = await mockChat(null, assembled.system, assembled.messages);
  assert(response.content, 'Should get response');
});

// ============================================================
// IMPORT INTEGRITY TESTS
// ============================================================

console.log('\n▸ Import Integrity');

test('adventure-player imports chat from ai-client (not prompts)', () => {
  // This test catches the bug where chat was imported from wrong module
  const adventurePlayer = require('../src/adventure-player');
  const aiClient = require('../src/ai-client');

  // If chat was imported from wrong module, processPlayerInput would fail
  // We verify the module loads without throwing
  assert(adventurePlayer.processPlayerInput, 'processPlayerInput should be exported');
  assert(typeof aiClient.chat === 'function', 'ai-client should export chat function');
});

test('prompts module does not export chat', () => {
  const prompts = require('../src/prompts');
  assert(prompts.chat === undefined, 'prompts should NOT export chat');
});

test('ai-client exports chat function', () => {
  const { chat } = require('../src/ai-client');
  assert(typeof chat === 'function', 'chat should be a function');
});

test('assembleFullPrompt receives proper memory object (not empty array)', () => {
  // Regression test: passing [] instead of createMemory() caused
  // "Cannot read properties of undefined (reading 'length')" error
  const { createMemory } = require('../src/memory');
  const { assembleFullPrompt } = require('../src/prompts');
  const persona = loadPersona('narrator-high-and-dry');
  const pc = loadPC('alex-ryder');

  // This should NOT throw - using proper memory object
  const memory = createMemory();
  const assembled = assembleFullPrompt(persona, memory, 'test', pc, null);

  assert(assembled.system, 'Should have system prompt');
  assert(assembled.messages, 'Should have messages array');
});

test('assembleFullPrompt throws with empty array as memory', () => {
  // Verify the bug scenario - empty array causes error
  const { assembleFullPrompt } = require('../src/prompts');
  const persona = loadPersona('narrator-high-and-dry');

  assert.throws(() => {
    assembleFullPrompt(persona, [], 'test', null, null);
  }, /Cannot read properties of undefined/, 'Empty array should cause error');
});

// ============================================================
// ERROR HANDLING TESTS
// ============================================================

console.log('\n▸ Error Handling');

test('loadPersona throws for nonexistent NPC', () => {
  assert.throws(() => loadPersona('nonexistent-npc-xyz'), /not found|does not exist/i);
});

test('loadPC throws for nonexistent PC', () => {
  assert.throws(() => loadPC('nonexistent-pc-xyz'), /not found/i);
});

test('getScenario returns null/undefined for invalid scenario', () => {
  const scenario = getScenario('invalid-scenario-xyz');
  assert(scenario == null, 'Should return null/undefined for invalid');
});

// ============================================================
// RESULTS
// ============================================================

setTimeout(() => {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`  TUI Live-System Tests: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════════════════════\n');
  process.exit(failed > 0 ? 1 : 0);
}, 100);
