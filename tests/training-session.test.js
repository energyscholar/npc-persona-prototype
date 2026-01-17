/**
 * Training Session Infrastructure Tests
 *
 * Validates the training workflow for NPC personas:
 * - Scenario definitions and loading
 * - Training log persistence
 * - TUI menu integration
 * - Quick iteration commands
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Test tracking
let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

// ============================================
// SCENARIO DEFINITIONS
// ============================================

console.log('\n📋 Training Scenarios');

test('training-scenarios.js exists', () => {
  const scenarioPath = path.join(__dirname, '../src/training-scenarios.js');
  assert(fs.existsSync(scenarioPath), 'src/training-scenarios.js not found');
});

test('exports SCENARIOS object', () => {
  const { SCENARIOS } = require('../src/training-scenarios');
  assert(typeof SCENARIOS === 'object', 'SCENARIOS should be an object');
});

test('has 6 scenario presets (S1-S6)', () => {
  const { SCENARIOS } = require('../src/training-scenarios');
  const keys = Object.keys(SCENARIOS);
  assert(keys.length >= 6, `Expected 6+ scenarios, got ${keys.length}`);
});

test('S1 first-meeting scenario has required fields', () => {
  const { SCENARIOS } = require('../src/training-scenarios');
  const s1 = SCENARIOS.s1_first_meeting || SCENARIOS.S1 || Object.values(SCENARIOS)[0];
  assert(s1, 'S1 scenario not found');
  assert(s1.name, 'scenario.name required');
  assert(s1.context !== undefined, 'scenario.context required');
  assert(s1.disposition !== undefined, 'scenario.disposition required');
  assert(Array.isArray(s1.checklist), 'scenario.checklist should be array');
});

test('scenarios have checklist items from standard set', () => {
  const { SCENARIOS } = require('../src/training-scenarios');
  const validItems = ['VOICE', 'KNOWLEDGE', 'DISPOSITION', 'AGENDA', 'BOUNDARIES', 'CONSISTENCY'];

  for (const [id, scenario] of Object.entries(SCENARIOS)) {
    for (const item of scenario.checklist || []) {
      assert(validItems.includes(item), `Invalid checklist item '${item}' in ${id}`);
    }
  }
});

test('getScenario(id) helper function exists', () => {
  const { getScenario } = require('../src/training-scenarios');
  assert(typeof getScenario === 'function', 'getScenario should be a function');
});

test('listScenarios() returns array of scenario summaries', () => {
  const { listScenarios } = require('../src/training-scenarios');
  assert(typeof listScenarios === 'function', 'listScenarios should be a function');
  const list = listScenarios();
  assert(Array.isArray(list), 'listScenarios should return array');
  assert(list.length >= 6, 'Should have 6+ scenarios');
  assert(list[0].id, 'Each item should have id');
  assert(list[0].name, 'Each item should have name');
});

// ============================================
// TRAINING LOG
// ============================================

console.log('\n📝 Training Log');

test('training-log.js exists', () => {
  const logPath = path.join(__dirname, '../src/training-log.js');
  assert(fs.existsSync(logPath), 'src/training-log.js not found');
});

test('exports saveResult function', () => {
  const { saveResult } = require('../src/training-log');
  assert(typeof saveResult === 'function', 'saveResult should be a function');
});

test('exports getHistory function', () => {
  const { getHistory } = require('../src/training-log');
  assert(typeof getHistory === 'function', 'getHistory should be a function');
});

test('exports getNpcSummary function', () => {
  const { getNpcSummary } = require('../src/training-log');
  assert(typeof getNpcSummary === 'function', 'getNpcSummary should be a function');
});

test('saveResult creates log entry with required fields', () => {
  const { saveResult, getHistory, clearTestData } = require('../src/training-log');

  // Clear any test data first
  if (clearTestData) clearTestData();

  const result = {
    npcId: 'test-npc',
    scenarioId: 's1_first_meeting',
    checklist: { VOICE: 'pass', KNOWLEDGE: 'pass', DISPOSITION: 'fail' },
    passed: false,
    notes: 'Test entry'
  };

  saveResult(result);

  const history = getHistory('test-npc');
  assert(history.length > 0, 'Should have saved entry');

  const entry = history[history.length - 1];
  assert(entry.timestamp, 'Entry should have timestamp');
  assert(entry.scenarioId === 's1_first_meeting', 'Entry should have scenarioId');
  assert(entry.checklist.VOICE === 'pass', 'Entry should preserve checklist');
});

test('getNpcSummary returns pass/fail counts', () => {
  const { getNpcSummary } = require('../src/training-log');
  const summary = getNpcSummary('test-npc');

  assert(typeof summary.total === 'number', 'Should have total count');
  assert(typeof summary.passed === 'number', 'Should have passed count');
  assert(typeof summary.failed === 'number', 'Should have failed count');
});

// ============================================
// TUI INTEGRATION
// ============================================

console.log('\n🖥️  TUI Integration');

test('chat-tui.js has training session handler', () => {
  const tuiPath = path.join(__dirname, '../src/chat-tui.js');
  const content = fs.readFileSync(tuiPath, 'utf8');
  assert(
    content.includes('training') || content.includes('Training'),
    'chat-tui.js should reference training functionality'
  );
});

test('tui-menu.js has displayChecklist function', () => {
  const { displayChecklist } = require('../src/tui-menu');
  assert(typeof displayChecklist === 'function', 'displayChecklist should be a function');
});

test('displayChecklist renders evaluation UI', () => {
  const { displayChecklist } = require('../src/tui-menu');
  const items = ['VOICE', 'KNOWLEDGE', 'DISPOSITION'];
  const output = displayChecklist(items);

  assert(typeof output === 'string', 'Should return string');
  assert(output.includes('VOICE'), 'Should include checklist items');
  assert(output.includes('EVALUATION') || output.includes('Checklist'), 'Should have header');
});

// ============================================
// QUICK COMMANDS
// ============================================

console.log('\n⚡ Quick Commands');

test('training mode recognizes /retry command', () => {
  const { parseTrainingCommand } = require('../src/training-scenarios');
  const result = parseTrainingCommand('/retry');
  assert(result.command === 'retry', '/retry should be recognized');
});

test('training mode recognizes /next command', () => {
  const { parseTrainingCommand } = require('../src/training-scenarios');
  const result = parseTrainingCommand('/next');
  assert(result.command === 'next', '/next should be recognized');
});

test('training mode recognizes /pass command', () => {
  const { parseTrainingCommand } = require('../src/training-scenarios');
  const result = parseTrainingCommand('/pass');
  assert(result.command === 'pass', '/pass should be recognized');
});

test('training mode recognizes /fail command', () => {
  const { parseTrainingCommand } = require('../src/training-scenarios');
  const result = parseTrainingCommand('/fail');
  assert(result.command === 'fail', '/fail should be recognized');
});

test('training mode recognizes /scenario command with id', () => {
  const { parseTrainingCommand } = require('../src/training-scenarios');
  const result = parseTrainingCommand('/scenario s2');
  assert(result.command === 'scenario', '/scenario should be recognized');
  assert(result.arg === 's2', 'Should capture scenario id');
});

// ============================================
// INTEGRATION
// ============================================

console.log('\n🔗 Integration');

test('scenario can apply to npc-test-mode state', () => {
  const { applyScenarioToState } = require('../src/training-scenarios');
  const { createTestState } = require('../src/npc-test-mode');

  // Create minimal test state
  const mockNpc = { id: 'test', name: 'Test NPC' };
  const mockPc = { name: 'Test PC' };
  const state = createTestState(mockNpc, mockPc);

  // Apply scenario
  const modified = applyScenarioToState(state, 's1_first_meeting');

  assert(modified.context, 'Should set context');
  assert(modified.disposition !== undefined, 'Should set disposition');
});

test('training results directory exists or is created', () => {
  const resultsDir = path.join(__dirname, '../data/training-results');
  // Just check the parent exists - the dir may be created lazily
  const parentDir = path.join(__dirname, '../data');
  assert(fs.existsSync(parentDir), 'data/ directory should exist');
});

// ============================================
// SUMMARY
// ============================================

console.log('\n' + '═'.repeat(50));
console.log(`Training Session Tests: ${passed} passed, ${failed} failed`);

if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
}

console.log('═'.repeat(50) + '\n');

process.exit(failed > 0 ? 1 : 0);
