/**
 * Tests for tui-menu.js - Box drawing and menu display
 */

const assert = require('assert');
const {
  drawBox,
  drawBoxWithHeader,
  stripAnsi,
  padTo,
  centerText,
  displayMainMenu,
  displayPickerMenu,
  displaySceneFrame,
  displayFlagMenu,
  displayTestModeStatus,
  BOX,
  MAIN_MENU_OPTIONS
} = require('../src/tui-menu');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Test BOX constants
test('BOX contains required characters', () => {
  assert.strictEqual(BOX.topLeft, '╔');
  assert.strictEqual(BOX.topRight, '╗');
  assert.strictEqual(BOX.bottomLeft, '╚');
  assert.strictEqual(BOX.bottomRight, '╝');
  assert.strictEqual(BOX.horizontal, '═');
  assert.strictEqual(BOX.vertical, '║');
});

// Test stripAnsi
test('stripAnsi removes ANSI codes', () => {
  const colored = '\x1b[31mRed Text\x1b[0m';
  assert.strictEqual(stripAnsi(colored), 'Red Text');
});

test('stripAnsi handles plain text', () => {
  const plain = 'Plain Text';
  assert.strictEqual(stripAnsi(plain), 'Plain Text');
});

// Test padTo
test('padTo pads string to width', () => {
  const result = padTo('Hello', 10);
  assert.strictEqual(result.length, 10);
  assert.strictEqual(result, 'Hello     ');
});

test('padTo handles strings longer than width', () => {
  const result = padTo('Hello World', 5);
  assert.strictEqual(result, 'Hello World');
});

// Test centerText
test('centerText centers string', () => {
  const result = centerText('Hi', 10);
  assert.strictEqual(result.length, 10);
  assert.ok(result.startsWith('    ')); // 4 spaces before
});

// Test drawBox
test('drawBox creates valid box', () => {
  const box = drawBox(['  Line 1', '  Line 2']);
  assert.ok(box.includes(BOX.topLeft));
  assert.ok(box.includes(BOX.bottomRight));
  assert.ok(box.includes('Line 1'));
  assert.ok(box.includes('Line 2'));
});

test('drawBox includes corner characters', () => {
  const box = drawBox(['Test']);
  const lines = box.split('\n');
  assert.ok(lines[0].startsWith(BOX.topLeft));
  assert.ok(lines[0].endsWith(BOX.topRight));
  assert.ok(lines[lines.length - 1].startsWith(BOX.bottomLeft));
  assert.ok(lines[lines.length - 1].endsWith(BOX.bottomRight));
});

// Test drawBoxWithHeader
test('drawBoxWithHeader includes separator', () => {
  const box = drawBoxWithHeader('Header', ['Body line']);
  assert.ok(box.includes(BOX.leftT));
  assert.ok(box.includes(BOX.rightT));
  assert.ok(box.includes('Header'));
  assert.ok(box.includes('Body line'));
});

// Test displayMainMenu
test('displayMainMenu includes all options', () => {
  const menu = displayMainMenu();
  assert.ok(menu.includes('NPC PERSONA PROTOTYPE'));
  assert.ok(menu.includes('Play High and Dry'));
  assert.ok(menu.includes('Test Mode'));
  assert.ok(menu.includes('Exit'));
});

test('displayMainMenu has correct structure', () => {
  const menu = displayMainMenu();
  const lines = menu.split('\n');
  // Should have top border, header, separator, options, bottom border
  assert.ok(lines.length >= 6);
});

// Test MAIN_MENU_OPTIONS
test('MAIN_MENU_OPTIONS has required entries', () => {
  assert.ok(MAIN_MENU_OPTIONS.length >= 3);
  assert.ok(MAIN_MENU_OPTIONS.some(o => o.action === 'adventure'));
  assert.ok(MAIN_MENU_OPTIONS.some(o => o.action === 'npc-test'));
  assert.ok(MAIN_MENU_OPTIONS.some(o => o.action === 'exit'));
});

// Test displayPickerMenu
test('displayPickerMenu includes title and options', () => {
  const options = [
    { key: '1', label: 'Option A' },
    { key: '2', label: 'Option B' }
  ];
  const menu = displayPickerMenu('Test Menu', options);
  assert.ok(menu.includes('Test Menu'));
  assert.ok(menu.includes('Option A'));
  assert.ok(menu.includes('Option B'));
  assert.ok(menu.includes('[B]'));
});

// Test displaySceneFrame
test('displaySceneFrame shows scene and characters', () => {
  const scene = { title: 'Test Scene', setting: 'Test Location' };
  const pc = { name: 'Test PC' };
  const npcs = [{ name: 'NPC One', title: 'Guard' }];

  const frame = displaySceneFrame(scene, pc, npcs);
  assert.ok(frame.includes('TEST SCENE'));
  assert.ok(frame.includes('Test PC'));
  assert.ok(frame.includes('NPC One'));
  assert.ok(frame.includes('DRAMATIS PERSONAE'));
});

// Test displayFlagMenu
test('displayFlagMenu shows flags with checkboxes', () => {
  const flags = { flag_one: true, flag_two: false };
  const available = ['flag_one', 'flag_two', 'flag_three'];

  const menu = displayFlagMenu(flags, available);
  assert.ok(menu.includes('[x] flag_one'));
  assert.ok(menu.includes('[ ] flag_two'));
  assert.ok(menu.includes('[ ] flag_three'));
  assert.ok(menu.includes('STORY FLAGS'));
});

// Test displayTestModeStatus
test('displayTestModeStatus shows context info', () => {
  const context = {
    npcName: 'Test NPC',
    channel: 'In-Person',
    sceneName: 'Test Scene',
    flags: { flag_one: true }
  };

  const status = displayTestModeStatus(context);
  assert.ok(status.includes('TEST MODE'));
  assert.ok(status.includes('Test NPC'));
  assert.ok(status.includes('In-Person'));
  assert.ok(status.includes('flag_one'));
});

// Run tests
async function runTests() {
  console.log('Running tui-menu tests...\n');
  let passed = 0;
  let failed = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e) {
      console.log(`  ✗ ${name}`);
      console.log(`    ${e.message}`);
      failed++;
    }
  }

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

if (require.main === module) {
  runTests().then(success => process.exit(success ? 0 : 1));
}

module.exports = { runTests };
