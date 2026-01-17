/**
 * Tests for npc-test-mode.js - NPC communication testing
 */

const assert = require('assert');
const {
  CHANNELS,
  CONTEXT_PRESETS,
  AVAILABLE_FLAGS,
  createTestState,
  buildTestModePrompt,
  getDispositionLabel,
  parseTestCommand,
  getNpcOptions,
  getChannelOptions,
  getContextOptions,
  formatTestModeResponse
} = require('../src/npc-test-mode');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Test CHANNELS
test('CHANNELS has required communication modes', () => {
  assert.ok(CHANNELS['in-person']);
  assert.ok(CHANNELS['radio']);
  assert.ok(CHANNELS['email']);
  assert.ok(CHANNELS['telephone']);
  assert.ok(CHANNELS['intercom']);
});

test('CHANNELS entries have required fields', () => {
  for (const [id, channel] of Object.entries(CHANNELS)) {
    assert.ok(channel.key, `${id} should have key`);
    assert.ok(channel.label, `${id} should have label`);
    assert.ok(channel.behavior, `${id} should have behavior`);
    assert.ok(channel.promptModifier, `${id} should have promptModifier`);
  }
});

// Test CONTEXT_PRESETS
test('CONTEXT_PRESETS has required presets', () => {
  assert.ok(CONTEXT_PRESETS['first-meeting']);
  assert.ok(CONTEXT_PRESETS['during-crisis']);
  assert.ok(CONTEXT_PRESETS['custom']);
});

test('CONTEXT_PRESETS entries have required fields', () => {
  for (const [id, preset] of Object.entries(CONTEXT_PRESETS)) {
    assert.ok(preset.key, `${id} should have key`);
    assert.ok(preset.label, `${id} should have label`);
    assert.ok('flags' in preset, `${id} should have flags`);
    assert.ok('disposition' in preset, `${id} should have disposition`);
  }
});

// Test AVAILABLE_FLAGS
test('AVAILABLE_FLAGS contains expected flags', () => {
  assert.ok(AVAILABLE_FLAGS.includes('survey_accepted'));
  assert.ok(AVAILABLE_FLAGS.includes('eruption_started'));
  assert.ok(AVAILABLE_FLAGS.includes('rescue_complete'));
});

// Test createTestState
test('createTestState returns valid state', () => {
  const npc = { id: 'test-npc', name: 'Test NPC' };
  const pc = { id: 'test-pc', name: 'Test PC' };
  const state = createTestState(npc, pc);

  assert.strictEqual(state.npc, npc);
  assert.strictEqual(state.pc, pc);
  assert.strictEqual(state.channel, 'in-person');
  assert.strictEqual(state.context, 'first-meeting');
  assert.strictEqual(state.disposition, 0);
  assert.strictEqual(state.turnCount, 0);
  assert.ok(state.memory);
});

// Test getDispositionLabel
test('getDispositionLabel returns correct labels', () => {
  assert.strictEqual(getDispositionLabel(-3), 'hostile');
  assert.strictEqual(getDispositionLabel(-1), 'wary');
  assert.strictEqual(getDispositionLabel(0), 'neutral');
  assert.strictEqual(getDispositionLabel(1), 'cooperative');
  assert.strictEqual(getDispositionLabel(3), 'loyal');
});

// Test buildTestModePrompt
test('buildTestModePrompt includes channel info', () => {
  const state = {
    channel: 'radio',
    context: 'during-crisis',
    disposition: 1,
    flags: { eruption_started: true }
  };
  const prompt = buildTestModePrompt(state);

  assert.ok(prompt.includes('Radio'));
  assert.ok(prompt.includes('eruption_started'));
  assert.ok(prompt.includes('cooperative'));
});

// Test parseTestCommand - /context
test('parseTestCommand handles /context', () => {
  const state = {
    npc: { name: 'Test NPC' },
    channel: 'in-person',
    context: 'first-meeting',
    flags: { test_flag: true },
    disposition: 1,
    turnCount: 5
  };
  const result = parseTestCommand('/context', state);

  assert.ok(result.handled);
  assert.ok(result.response.includes('Test NPC'));
  assert.ok(result.response.includes('In-Person'));
  assert.ok(result.response.includes('test_flag'));
});

// Test parseTestCommand - /flags
test('parseTestCommand handles /flags', () => {
  const state = { flags: { survey_accepted: true } };
  const result = parseTestCommand('/flags', state);

  assert.ok(result.handled);
  assert.ok(result.response.includes('[x] survey_accepted'));
});

// Test parseTestCommand - /flags +name
test('parseTestCommand handles /flags +name', () => {
  const state = { flags: {} };
  const result = parseTestCommand('/flags +test_flag', state);

  assert.ok(result.handled);
  assert.ok(result.newState.flags.test_flag);
});

// Test parseTestCommand - /flags -name
test('parseTestCommand handles /flags -name', () => {
  const state = { flags: { test_flag: true } };
  const result = parseTestCommand('/flags -test_flag', state);

  assert.ok(result.handled);
  assert.strictEqual(result.newState.flags.test_flag, false);
});

// Test parseTestCommand - /channel
test('parseTestCommand handles /channel radio', () => {
  const state = { channel: 'in-person' };
  const result = parseTestCommand('/channel radio', state);

  assert.ok(result.handled);
  assert.strictEqual(result.newState.channel, 'radio');
});

test('parseTestCommand rejects invalid channel', () => {
  const state = { channel: 'in-person' };
  const result = parseTestCommand('/channel invalid', state);

  assert.ok(result.handled);
  assert.ok(result.response.includes('Unknown channel'));
});

// Test parseTestCommand - /disposition
test('parseTestCommand handles /disposition', () => {
  const state = { disposition: 0 };
  const result = parseTestCommand('/disposition 2', state);

  assert.ok(result.handled);
  assert.strictEqual(result.newState.disposition, 2);
});

test('parseTestCommand clamps disposition to valid range', () => {
  const state = { disposition: 0 };
  const result = parseTestCommand('/disposition 10', state);

  assert.ok(result.handled);
  assert.strictEqual(result.newState.disposition, 3); // Clamped to max
});

// Test parseTestCommand - /clear
test('parseTestCommand handles /clear', () => {
  const state = { memory: { data: 'old' }, turnCount: 5 };
  const result = parseTestCommand('/clear', state);

  assert.ok(result.handled);
  assert.strictEqual(result.newState.turnCount, 0);
});

// Test parseTestCommand - /back
test('parseTestCommand handles /back', () => {
  const result = parseTestCommand('/back', {});

  assert.ok(result.handled);
  assert.strictEqual(result.action, 'back');
});

// Test parseTestCommand - /help
test('parseTestCommand handles /help', () => {
  const result = parseTestCommand('/help', {});

  assert.ok(result.handled);
  assert.ok(result.response.includes('/context'));
  assert.ok(result.response.includes('/flags'));
  assert.ok(result.response.includes('/channel'));
});

// Test parseTestCommand - unhandled
test('parseTestCommand returns unhandled for regular input', () => {
  const result = parseTestCommand('Hello there', {});
  assert.strictEqual(result.handled, false);
});

// Test getChannelOptions
test('getChannelOptions returns menu options', () => {
  const options = getChannelOptions();
  assert.ok(options.length >= 5);
  assert.ok(options.some(o => o.id === 'in-person'));
  assert.ok(options.some(o => o.id === 'radio'));
});

// Test getContextOptions
test('getContextOptions returns menu options', () => {
  const options = getContextOptions();
  assert.ok(options.length >= 5);
  assert.ok(options.some(o => o.id === 'first-meeting'));
  assert.ok(options.some(o => o.id === 'during-crisis'));
});

// Test formatTestModeResponse
test('formatTestModeResponse formats NPC response', () => {
  const state = {
    npc: { name: 'Greener' },
    channel: 'radio',
    disposition: 1
  };
  const response = formatTestModeResponse(state, 'This is a test response.');

  assert.ok(response.includes('GREENER'));
  assert.ok(response.includes('cooperative'));
  assert.ok(response.includes('Radio'));
  assert.ok(response.includes('This is a test response'));
});

// Run tests
async function runTests() {
  console.log('Running npc-test-mode tests...\n');
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
