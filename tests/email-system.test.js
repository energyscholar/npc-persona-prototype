/**
 * Tests for PC email system
 *
 * Audit: .claude/plans/email-system-audit.md
 *
 * NPCs can send emails to PC, PC can read them from TUI
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Use scratchpad for test email storage
const TEST_DIR = '/tmp/claude-email-test';

// Helper to create mock session
function createMockSession() {
  return {
    adventureId: 'test-adventure',
    pc: { id: 'test-pc', name: 'Test PC' },
    storyState: { currentScene: 'test-scene' }
  };
}

// Setup: Clear test directory before tests
function setup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

// TEST E.1: sendEmail creates email in inbox
test('sendEmail creates email in inbox', () => {
  const emailSystem = require('../src/email-system');

  // Override emails dir for testing
  const session = createMockSession();
  session._testEmailDir = TEST_DIR;

  const npc = {
    id: 'mr-casarii',
    name: 'Anders Casarii',
    title: 'Scout Service Administrator'
  };

  const email = emailSystem.sendEmail(session, {
    from: npc,
    subject: 'Test Subject',
    body: 'Test body content'
  });

  assert.ok(email, 'Should return email object');
  assert.ok(email.id, 'Email should have ID');
  assert.strictEqual(email.subject, 'Test Subject', 'Subject should match');
  assert.strictEqual(email.from.npcId, 'mr-casarii', 'From NPC should match');
  assert.strictEqual(email.read, false, 'Email should be unread');

  const inbox = emailSystem.getInbox(session);
  assert.strictEqual(inbox.length, 1, 'Inbox should have one email');
});

// TEST E.2: getUnreadCount returns correct count
test('getUnreadCount returns correct count', () => {
  const emailSystem = require('../src/email-system');
  const session = createMockSession();
  session._testEmailDir = TEST_DIR;
  session.adventureId = 'test-adventure-2'; // New adventure to isolate

  const npc = { id: 'test-npc', name: 'Test NPC' };

  emailSystem.sendEmail(session, { from: npc, subject: 'Email 1', body: 'Body 1' });
  emailSystem.sendEmail(session, { from: npc, subject: 'Email 2', body: 'Body 2' });
  emailSystem.sendEmail(session, { from: npc, subject: 'Email 3', body: 'Body 3' });

  const count = emailSystem.getUnreadCount(session);
  assert.strictEqual(count, 3, 'Should have 3 unread emails');
});

// TEST E.3: markAsRead updates read status
test('markAsRead updates read status', () => {
  const emailSystem = require('../src/email-system');
  const session = createMockSession();
  session._testEmailDir = TEST_DIR;
  session.adventureId = 'test-adventure-3';

  const npc = { id: 'test-npc', name: 'Test NPC' };

  const email = emailSystem.sendEmail(session, {
    from: npc,
    subject: 'Unread Email',
    body: 'Content'
  });

  assert.strictEqual(emailSystem.getUnreadCount(session), 1, 'Should have 1 unread');

  emailSystem.markAsRead(session, email.id);

  assert.strictEqual(emailSystem.getUnreadCount(session), 0, 'Should have 0 unread after marking read');

  const updatedEmail = emailSystem.getEmail(session, email.id);
  assert.strictEqual(updatedEmail.read, true, 'Email should be marked as read');
});

// TEST E.4: formatEmailList shows unread indicator
test('formatEmailList shows unread indicator', () => {
  const emailSystem = require('../src/email-system');

  const emails = [
    {
      id: 'e1',
      from: { name: 'Anders' },
      subject: 'Unread email',
      timestamp: '2026-01-17T10:00:00Z',
      read: false
    },
    {
      id: 'e2',
      from: { name: 'Greener' },
      subject: 'Read email',
      timestamp: '2026-01-16T10:00:00Z',
      read: true
    }
  ];

  const formatted = emailSystem.formatEmailList(emails);

  assert.ok(formatted.includes('*'), 'Should include unread indicator (*)');
  assert.ok(formatted.includes('Anders'), 'Should include sender name');
  assert.ok(formatted.includes('Unread email'), 'Should include subject');
});

// TEST E.5: Email templates exist
test('Email templates exist', () => {
  const templatesDir = path.join(__dirname, '../data/emails/templates');

  const casariiTemplate = path.join(templatesDir, 'casarii-briefing.json');
  const greenerTemplate = path.join(templatesDir, 'greener-job-offer.json');

  assert.ok(fs.existsSync(casariiTemplate), 'Casarii briefing template should exist');
  assert.ok(fs.existsSync(greenerTemplate), 'Greener job offer template should exist');

  const casarii = JSON.parse(fs.readFileSync(casariiTemplate, 'utf8'));
  assert.ok(casarii.subject, 'Template should have subject');
  assert.ok(casarii.body, 'Template should have body');
  assert.strictEqual(casarii.from, 'mr-casarii', 'Template should reference NPC ID');
});

// TEST E.6: Email persists to file
test('Email persists to file', () => {
  const emailSystem = require('../src/email-system');
  const session = createMockSession();
  session._testEmailDir = TEST_DIR;
  session.adventureId = 'test-adventure-persist';

  const npc = { id: 'test-npc', name: 'Test NPC' };

  emailSystem.sendEmail(session, {
    from: npc,
    subject: 'Persistent Email',
    body: 'This should persist'
  });

  // Check file exists
  const emailsPath = path.join(TEST_DIR, 'test-adventure-persist-test-pc', 'emails.json');
  assert.ok(fs.existsSync(emailsPath), 'Emails file should exist');

  // Verify content
  const data = JSON.parse(fs.readFileSync(emailsPath, 'utf8'));
  assert.strictEqual(data.inbox.length, 1, 'Should have one email in file');
  assert.strictEqual(data.inbox[0].subject, 'Persistent Email', 'Subject should match');
});

// Run tests
async function runTests() {
  console.log('Running email system tests...\n');

  setup();

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✓ ${t.name}`);
      passed++;
    } catch (err) {
      console.log(`✗ ${t.name}`);
      console.log(`  ${err.message}`);
      failed++;
    }
  }

  // Cleanup
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
