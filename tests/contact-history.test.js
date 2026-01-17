/**
 * Tests for contact-history.js - Test session tracking
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  loadContactHistory,
  saveContactHistory,
  addSession,
  clearHistory,
  getSessionSummaries,
  hasHistory,
  getSessionCount,
  getLastSession,
  createSessionFromState,
  formatDisposition,
  listNpcsWithHistory,
  ensureHistoryDir
} = require('../src/contact-history');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Test NPC ID for isolation
const TEST_NPC = 'test-npc-history-' + Date.now();

// Test loadContactHistory
test('loadContactHistory returns empty history for new NPC', () => {
  const history = loadContactHistory(TEST_NPC);
  assert.strictEqual(history.npcId, TEST_NPC);
  assert.deepStrictEqual(history.sessions, []);
  assert.strictEqual(history.totalSessions, 0);
});

// Test addSession
test('addSession adds session to history', () => {
  clearHistory(TEST_NPC);

  const session = {
    channel: 'in-person',
    context: 'first-meeting',
    flags: { test_flag: true },
    disposition: 1,
    turnCount: 5,
    summary: 'Test conversation'
  };

  const history = addSession(TEST_NPC, session);

  assert.strictEqual(history.totalSessions, 1);
  assert.strictEqual(history.sessions.length, 1);
  assert.strictEqual(history.sessions[0].channel, 'in-person');
  assert.strictEqual(history.sessions[0].summary, 'Test conversation');
});

test('addSession increments session count', () => {
  clearHistory(TEST_NPC);

  addSession(TEST_NPC, { channel: 'in-person', context: 'test' });
  addSession(TEST_NPC, { channel: 'radio', context: 'test' });

  const history = loadContactHistory(TEST_NPC);
  assert.strictEqual(history.totalSessions, 2);
});

// Test clearHistory
test('clearHistory removes all sessions', () => {
  addSession(TEST_NPC, { channel: 'test' });
  addSession(TEST_NPC, { channel: 'test' });

  clearHistory(TEST_NPC);

  const history = loadContactHistory(TEST_NPC);
  assert.strictEqual(history.sessions.length, 0);
  assert.strictEqual(history.totalSessions, 0);
});

// Test getSessionSummaries
test('getSessionSummaries returns formatted summaries', () => {
  clearHistory(TEST_NPC);

  addSession(TEST_NPC, {
    channel: 'radio',
    context: 'during-crisis',
    disposition: 2,
    summary: 'Emergency coordination'
  });

  const summaries = getSessionSummaries(TEST_NPC);

  assert.strictEqual(summaries.length, 1);
  assert.strictEqual(summaries[0].channel, 'radio');
  assert.strictEqual(summaries[0].context, 'during-crisis');
  assert.strictEqual(summaries[0].summary, 'Emergency coordination');
});

// Test hasHistory
test('hasHistory returns false for new NPC', () => {
  const newNpc = 'brand-new-npc-' + Date.now();
  assert.strictEqual(hasHistory(newNpc), false);
});

test('hasHistory returns true after session added', () => {
  clearHistory(TEST_NPC);
  addSession(TEST_NPC, { channel: 'test' });
  assert.strictEqual(hasHistory(TEST_NPC), true);
});

// Test getSessionCount
test('getSessionCount returns correct count', () => {
  clearHistory(TEST_NPC);

  assert.strictEqual(getSessionCount(TEST_NPC), 0);

  addSession(TEST_NPC, { channel: 'test' });
  addSession(TEST_NPC, { channel: 'test' });

  assert.strictEqual(getSessionCount(TEST_NPC), 2);
});

// Test getLastSession
test('getLastSession returns null for empty history', () => {
  clearHistory(TEST_NPC);
  assert.strictEqual(getLastSession(TEST_NPC), null);
});

test('getLastSession returns most recent session', () => {
  clearHistory(TEST_NPC);

  addSession(TEST_NPC, { channel: 'first', summary: 'First session' });
  addSession(TEST_NPC, { channel: 'second', summary: 'Second session' });

  const last = getLastSession(TEST_NPC);
  assert.strictEqual(last.channel, 'second');
  assert.strictEqual(last.summary, 'Second session');
});

// Test createSessionFromState
test('createSessionFromState converts state to session', () => {
  const state = {
    channel: 'in-person',
    context: 'first-meeting',
    flags: { flag1: true, flag2: false },
    disposition: 1,
    turnCount: 3
  };

  const session = createSessionFromState(state, 'Test summary');

  assert.strictEqual(session.channel, 'in-person');
  assert.strictEqual(session.context, 'first-meeting');
  assert.strictEqual(session.disposition, 1);
  assert.strictEqual(session.turnCount, 3);
  assert.strictEqual(session.summary, 'Test summary');
});

test('createSessionFromState generates default summary', () => {
  const state = { turnCount: 5 };
  const session = createSessionFromState(state);

  assert.ok(session.summary.includes('5 turns'));
});

// Test formatDisposition
test('formatDisposition shows level and label', () => {
  assert.ok(formatDisposition(0).includes('neutral'));
  assert.ok(formatDisposition(2).includes('friendly'));
  assert.ok(formatDisposition(-2).includes('unfriendly'));
});

test('formatDisposition shows change indicator', () => {
  assert.ok(formatDisposition(1, 1).includes('↑'));
  assert.ok(formatDisposition(0, -1).includes('↓'));
});

// Test session limit
test('addSession keeps only last 10 sessions', () => {
  clearHistory(TEST_NPC);

  // Add 15 sessions
  for (let i = 0; i < 15; i++) {
    addSession(TEST_NPC, { channel: `session-${i}` });
  }

  const history = loadContactHistory(TEST_NPC);
  assert.strictEqual(history.sessions.length, 10);
  assert.strictEqual(history.totalSessions, 15);
});

// Cleanup
test('cleanup test data', () => {
  clearHistory(TEST_NPC);
  // Remove test file
  const testPath = path.join(__dirname, '../data/state/test-history', `${TEST_NPC}.json`);
  if (fs.existsSync(testPath)) {
    fs.unlinkSync(testPath);
  }
  assert.ok(true);
});

// Run tests
async function runTests() {
  console.log('Running contact-history tests...\n');
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
