/**
 * Tests for AGM orchestration system
 *
 * Audit: .claude/plans/agm-orchestration-audit.md
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

// TEST O.1: createAgmState returns valid structure
test('createAgmState returns valid structure', () => {
  const { createAgmState } = require('../src/agm-state');
  const session = { adventure: { id: 'high-and-dry' } };
  const state = createAgmState(session);

  assert.ok(state, 'Should return state object');
  assert.ok('adventureId' in state, 'Should have adventureId');
  assert.ok('scene' in state, 'Should have scene');
  assert.ok('npcs' in state, 'Should have npcs');
  assert.ok('sharedKnowledge' in state, 'Should have sharedKnowledge');
  assert.ok('narratorDirectives' in state, 'Should have narratorDirectives');
});

// TEST O.2: updateSceneContext populates scene data
test('updateSceneContext populates scene data', () => {
  const { createAgmState, updateSceneContext } = require('../src/agm-state');
  const session = { adventure: { id: 'high-and-dry' } };
  const state = createAgmState(session);

  const scene = loadScene('high-and-dry', 'starport-arrival');
  const storyState = { currentScene: 'starport-arrival' };

  updateSceneContext(state, scene, storyState);

  assert.strictEqual(state.scene.id, 'starport-arrival', 'Scene ID should match');
  assert.ok(state.scene.objectives, 'Should have objectives');
});

// TEST O.3: updateSceneContext initializes NPC entries
test('updateSceneContext initializes NPC entries', () => {
  const { createAgmState, updateSceneContext } = require('../src/agm-state');
  const session = { adventure: { id: 'high-and-dry' } };
  const state = createAgmState(session);

  const scene = loadScene('high-and-dry', 'starport-arrival');
  const storyState = { currentScene: 'starport-arrival' };

  updateSceneContext(state, scene, storyState);

  // starport-arrival has customs-officer-walston
  assert.ok(state.npcs['customs-officer-walston'], 'Should have customs officer NPC entry');
});

// TEST O.4: buildNpcDirectives returns non-empty for known NPC
test('buildNpcDirectives returns non-empty for known NPC', () => {
  const { createAgmState, updateSceneContext, buildNpcDirectives } = require('../src/agm-state');
  const session = { adventure: { id: 'high-and-dry' } };
  const state = createAgmState(session);

  const scene = loadScene('high-and-dry', 'starport-arrival');
  updateSceneContext(state, scene, {});

  const directives = buildNpcDirectives(state, 'customs-officer-walston');

  assert.ok(directives, 'Should return directives');
  assert.ok(directives.includes('SCENE GUIDANCE'), 'Should include SCENE GUIDANCE header');
});

// TEST O.5: propagateKnowledge updates all NPCs
test('propagateKnowledge updates all NPCs', () => {
  const { createAgmState, updateSceneContext, propagateKnowledge } = require('../src/agm-state');
  const session = { adventure: { id: 'high-and-dry' } };
  const state = createAgmState(session);

  // Set up scene with multiple NPCs
  const scene = {
    id: 'test-scene',
    npcs_present: ['minister-greener', 'customs-officer-walston']
  };
  updateSceneContext(state, scene, {});

  // Propagate a fact from greener
  propagateKnowledge(state, 'minister-greener', 'volcano_survey_needed');

  // Check other NPC has the fact
  assert.ok(
    state.npcs['customs-officer-walston'].knownFacts.includes('volcano_survey_needed'),
    'Customs officer should know the propagated fact'
  );

  // Source NPC should not be in witnesses
  assert.ok(
    !state.sharedKnowledge['volcano_survey_needed'].witnesses.includes('minister-greener'),
    'Source NPC should not be a witness'
  );
});

// TEST O.6: detectAddressedNpc finds NPC by name part
test('detectAddressedNpc finds NPC by name part', () => {
  const { detectAddressedNpc } = require('../src/agm-npc-bridge');

  const npcsPresent = ['minister-greener', 'customs-officer-walston'];

  const result1 = detectAddressedNpc('I ask Greener about the ship', npcsPresent);
  assert.strictEqual(result1, 'minister-greener', 'Should find greener');

  const result2 = detectAddressedNpc('I walk around the room', npcsPresent);
  assert.strictEqual(result2, null, 'Should return null when no NPC addressed');
});

// TEST O.7: determineActiveSpeaker prefers addressed NPC
test('determineActiveSpeaker prefers addressed NPC', () => {
  const { createAgmState, updateSceneContext } = require('../src/agm-state');
  const { determineActiveSpeaker } = require('../src/agm-npc-bridge');

  const session = { adventure: { id: 'high-and-dry' } };
  const state = createAgmState(session);

  const scene = {
    id: 'test-scene',
    npcs_present: ['minister-greener', 'customs-officer-walston']
  };
  updateSceneContext(state, scene, {});

  // Addressed NPC takes priority
  const result1 = determineActiveSpeaker(state, 'I ask Greener about the deal', scene);
  assert.strictEqual(result1.npcId, 'minister-greener', 'Should prefer addressed NPC');

  // Falls back to narrator for non-dialogue
  const result2 = determineActiveSpeaker(state, 'I examine the room', scene);
  assert.strictEqual(result2.speaker, 'narrator', 'Should fall back to narrator');
});

// TEST O.8: isDialogueAction detects speech
test('isDialogueAction detects speech', () => {
  const { isDialogueAction } = require('../src/agm-npc-bridge');

  assert.strictEqual(isDialogueAction('I say hello'), true, '"say" should be dialogue');
  assert.strictEqual(isDialogueAction('I ask about the ship'), true, '"ask" should be dialogue');
  assert.strictEqual(isDialogueAction('I talk to the officer'), true, '"talk" should be dialogue');
  assert.strictEqual(isDialogueAction('I walk north'), false, '"walk" should not be dialogue');
  assert.strictEqual(isDialogueAction('I examine the door'), false, '"examine" should not be dialogue');
});

// Run tests
async function runTests() {
  console.log('Running AGM orchestration tests...\n');

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
