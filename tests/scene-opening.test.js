/**
 * Tests for scene opening flow
 *
 * Audit: .claude/plans/scene-opening-flow-audit.md
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Helper to load scene
function loadScene(adventureId, sceneId) {
  const scenePath = path.join(__dirname, '../data/adventures', adventureId, 'scenes', `${sceneId}.json`);
  if (!fs.existsSync(scenePath)) return null;
  return JSON.parse(fs.readFileSync(scenePath, 'utf8'));
}

// Helper to load NPC
function loadNpc(npcId) {
  const npcPath = path.join(__dirname, '../data/npcs', `${npcId}.json`);
  if (!fs.existsSync(npcPath)) return null;
  return JSON.parse(fs.readFileSync(npcPath, 'utf8'));
}

// TEST S.1: Narrator label is "Narrator:" not "AGM:"
test('Narrator label is "Narrator:" not "AGM:"', () => {
  const tuiPath = path.join(__dirname, '../src/chat-tui.js');
  const content = fs.readFileSync(tuiPath, 'utf8');

  // Should have Narrator:
  assert.ok(
    content.includes('Narrator:'),
    'TUI should use "Narrator:" label'
  );

  // Should NOT have AGM: (as a label for narrator output)
  const agmLabelMatches = content.match(/console\.log.*AGM:/g);
  assert.ok(
    !agmLabelMatches || agmLabelMatches.length === 0,
    'TUI should not use "AGM:" label for narrator output'
  );
});

// TEST S.2: scout-office scene has opening_context
test('scout-office scene has opening_context', () => {
  const scene = loadScene('high-and-dry', 'scout-office');
  assert.ok(scene, 'Scout office scene should exist');
  assert.ok(scene.opening_context, 'Scene should have opening_context');
  assert.ok(scene.opening_context.pc_knows, 'opening_context should have pc_knows array');
  assert.ok(Array.isArray(scene.opening_context.pc_knows), 'pc_knows should be an array');
});

// TEST S.3: scout-office narrator_prompt mentions detached duty
test('scout-office narrator_prompt mentions detached duty', () => {
  const scene = loadScene('high-and-dry', 'scout-office');
  assert.ok(scene.narrator_prompt, 'Scene should have narrator_prompt');

  const promptLower = scene.narrator_prompt.toLowerCase();
  assert.ok(
    promptLower.includes('detached duty'),
    'narrator_prompt should mention "detached duty"'
  );
  assert.ok(
    !promptLower.includes('inheritance'),
    'narrator_prompt should not mention "inheritance"'
  );
});

// TEST S.4: mr-casarii has opening_behavior
test('mr-casarii has opening_behavior', () => {
  const npc = loadNpc('mr-casarii');
  assert.ok(npc, 'Mr. Casarii NPC should exist');
  assert.ok(npc.conversation_context, 'NPC should have conversation_context');
  assert.ok(
    npc.conversation_context.opening_behavior,
    'conversation_context should have opening_behavior'
  );
  assert.ok(
    npc.conversation_context.opening_behavior.opening_line,
    'opening_behavior should have opening_line'
  );
});

// TEST S.5: storyState can store acquired_info
test('storyState can store acquired_info', () => {
  const { acquireInfo } = require('../src/adventure-player');

  // Create mock session
  const session = {
    storyState: {
      currentScene: 'scout-office',
      acquired_info: []
    }
  };

  // Acquire some info
  acquireInfo(session, 'Ship is on Walston', 'mr-casarii');

  assert.ok(session.storyState.acquired_info.length > 0, 'Should add info to acquired_info');
  assert.strictEqual(
    session.storyState.acquired_info[0].info,
    'Ship is on Walston',
    'Info should be stored correctly'
  );
  assert.strictEqual(
    session.storyState.acquired_info[0].source,
    'mr-casarii',
    'Source should be stored correctly'
  );
});

// TEST S.6: Opening line is small talk
test('Opening line is small talk', () => {
  const npc = loadNpc('mr-casarii');
  const openingLine = npc.conversation_context?.opening_behavior?.opening_line || '';

  // Opening should be a greeting/inquiry, not a full briefing
  const lineLower = openingLine.toLowerCase();
  assert.ok(
    lineLower.includes('help') || lineLower.includes('good day') || lineLower.includes('hello'),
    'Opening line should be a greeting or inquiry'
  );
  assert.ok(
    !lineLower.includes('highndry') && !lineLower.includes('walston'),
    'Opening line should not immediately mention ship details'
  );
});

// Run tests
async function runTests() {
  console.log('Running scene opening tests...\n');

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

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
