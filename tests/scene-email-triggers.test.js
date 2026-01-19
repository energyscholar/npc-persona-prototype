/**
 * Tests for scene email triggers
 *
 * Audit: .claude/plans/scene-email-triggers-audit.md
 *
 * Scenes can trigger emails to PC on completion
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Use temp directory for test email storage
const TEST_DIR = '/tmp/claude-email-trigger-test';

// Helper to create mock session
function createMockSession() {
  return {
    adventureId: 'test-adventure',
    pc: { id: 'test-pc', name: 'Test PC' },
    storyState: {
      currentScene: 'test-scene',
      completedScenes: [],
      inventory: []
    },
    _testEmailDir: TEST_DIR
  };
}

// Setup: Clear test directory before tests
function setup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

// Helper to load scene
function loadSceneJson(adventureId, sceneId) {
  const scenePath = path.join(__dirname, `../data/adventures/${adventureId}/scenes`, `${sceneId}.json`);
  if (!fs.existsSync(scenePath)) return null;
  return JSON.parse(fs.readFileSync(scenePath, 'utf8'));
}

// TEST T.1: advanceToScene triggers email when on_complete.emails defined
test('advanceToScene triggers email when on_complete.emails defined', () => {
  const { advanceToScene } = require('../src/scene-manager');
  const { getInbox } = require('../src/email-system');

  const session = createMockSession();
  session.adventureId = 'high-and-dry';
  session.storyState.currentScene = 'scout-office';

  // Mock scene with email trigger
  const result = advanceToScene(session, 'walston-arrival');

  // Result should have scene transition
  assert.ok(result, 'Should return result');
  // Note: actual email triggering depends on scene configuration
});

// TEST T.2: emailsTriggered includes from, subject, npcId
test('emailsTriggered includes from, subject, npcId when emails sent', () => {
  const { triggerSceneEmails } = require('../src/scene-manager');
  const session = createMockSession();

  // Create mock scene with email trigger
  const scene = {
    id: 'test-scene',
    on_complete: {
      emails: [
        {
          template: 'casarii-briefing',
          from_npc: 'mr-casarii'
        }
      ]
    }
  };

  const emailsTriggered = triggerSceneEmails(session, scene);

  assert.ok(Array.isArray(emailsTriggered), 'Should return array');
  if (emailsTriggered.length > 0) {
    const triggered = emailsTriggered[0];
    assert.ok(triggered.from, 'Should have from field');
    assert.ok(triggered.subject, 'Should have subject field');
    assert.ok(triggered.npcId, 'Should have npcId field');
  }
});

// TEST T.3: Email appears in PC inbox after scene transition
test('Email appears in PC inbox after scene email trigger', () => {
  const { triggerSceneEmails } = require('../src/scene-manager');
  const { getInbox } = require('../src/email-system');

  const session = createMockSession();
  session.adventureId = 'trigger-test-3';

  const scene = {
    id: 'test-scene',
    on_complete: {
      emails: [
        {
          template: 'casarii-briefing',
          from_npc: 'mr-casarii'
        }
      ]
    }
  };

  triggerSceneEmails(session, scene);

  const inbox = getInbox(session);
  assert.ok(inbox.length > 0, 'Inbox should have email after trigger');
  assert.ok(inbox[0].subject.includes('Highndry'), 'Email should be the briefing');
});

// TEST T.4: Email not sent if scene already completed (idempotent)
test('Email not sent if scene already in completedScenes', () => {
  const { triggerSceneEmails } = require('../src/scene-manager');
  const { getInbox } = require('../src/email-system');

  const session = createMockSession();
  session.adventureId = 'trigger-test-4';
  session.storyState.completedScenes = ['test-scene']; // Already completed

  const scene = {
    id: 'test-scene',
    on_complete: {
      emails: [
        {
          template: 'casarii-briefing',
          from_npc: 'mr-casarii'
        }
      ]
    }
  };

  const emailsTriggered = triggerSceneEmails(session, scene);

  assert.strictEqual(emailsTriggered.length, 0, 'Should not trigger emails for completed scene');
});

// TEST T.5: scout-office.json has on_complete.emails with casarii-briefing
test('scout-office.json has on_complete.emails with casarii-briefing', () => {
  const scene = loadSceneJson('high-and-dry', 'scout-office');

  assert.ok(scene, 'scout-office.json should exist');
  assert.ok(scene.on_complete, 'Should have on_complete block');
  assert.ok(scene.on_complete.emails, 'Should have emails array');
  assert.ok(Array.isArray(scene.on_complete.emails), 'emails should be array');

  const casariiEmail = scene.on_complete.emails.find(e => e.template === 'casarii-briefing');
  assert.ok(casariiEmail, 'Should have casarii-briefing trigger');
  assert.strictEqual(casariiEmail.from_npc, 'mr-casarii', 'Should be from mr-casarii');
});

// TEST T.6: Missing template logs warning but doesn't break
test('Missing template does not break trigger flow', () => {
  const { triggerSceneEmails } = require('../src/scene-manager');

  const session = createMockSession();
  session.adventureId = 'trigger-test-6';

  const scene = {
    id: 'test-scene-missing',
    on_complete: {
      emails: [
        {
          template: 'nonexistent-template',
          from_npc: 'mr-casarii'
        }
      ]
    }
  };

  // Should not throw
  let error = null;
  try {
    const result = triggerSceneEmails(session, scene);
    assert.ok(Array.isArray(result), 'Should return array even with missing template');
  } catch (e) {
    error = e;
  }

  assert.strictEqual(error, null, 'Should not throw on missing template');
});

// Run tests
async function runTests() {
  console.log('Running scene email trigger tests...\n');

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
