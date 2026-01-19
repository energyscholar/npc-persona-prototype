/**
 * Tests for menu cleanup
 *
 * Audit: .claude/plans/menu-cleanup-audit.md
 * Verifies removal of Training, Quick Chat, and Red Team menu options
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// T1: Menu has exactly 3 options
test('Main menu has exactly 3 options', () => {
  const { MAIN_MENU_OPTIONS } = require('../src/tui-menu');
  assert.strictEqual(MAIN_MENU_OPTIONS.length, 3, 'Should have exactly 3 menu options');
});

// T2: Menu options are adventure, npc-test, exit
test('Menu actions are adventure, npc-test, exit', () => {
  const { MAIN_MENU_OPTIONS } = require('../src/tui-menu');
  const actions = MAIN_MENU_OPTIONS.map(o => o.action);
  assert.deepStrictEqual(actions, ['adventure', 'npc-test', 'exit'], 'Actions should be adventure, npc-test, exit');
});

// T3: No training case handler in chat-tui
test('No training handler in chat-tui', () => {
  const chatTuiPath = path.join(__dirname, '../src/chat-tui.js');
  const chatTuiCode = fs.readFileSync(chatTuiPath, 'utf8');
  assert.ok(!chatTuiCode.includes("case 'training':"), 'training case should be removed');
});

// T4: No red-team case handler in chat-tui
test('No red-team handler in chat-tui', () => {
  const chatTuiPath = path.join(__dirname, '../src/chat-tui.js');
  const chatTuiCode = fs.readFileSync(chatTuiPath, 'utf8');
  assert.ok(!chatTuiCode.includes("case 'red-team':"), 'red-team case should be removed');
});

// T5: No quick-chat case handler in chat-tui
test('No quick-chat handler in chat-tui', () => {
  const chatTuiPath = path.join(__dirname, '../src/chat-tui.js');
  const chatTuiCode = fs.readFileSync(chatTuiPath, 'utf8');
  assert.ok(!chatTuiCode.includes("case 'quick-chat':"), 'quick-chat case should be removed');
});

// T6: Keys are sequential 1, 2, 3
test('Menu keys are 1, 2, 3', () => {
  const { MAIN_MENU_OPTIONS } = require('../src/tui-menu');
  const keys = MAIN_MENU_OPTIONS.map(o => o.key);
  assert.deepStrictEqual(keys, ['1', '2', '3'], 'Keys should be 1, 2, 3');
});

// Run tests
async function runTests() {
  console.log('Running menu cleanup tests...\n');

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      passed++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`    ${err.message}`);
      failed++;
    }
  }

  console.log(`\n  ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
