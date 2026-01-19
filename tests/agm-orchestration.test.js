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

// TEST O.9: computeGoalUrgency uses npcGoals priority/10 as base
test('computeGoalUrgency uses npcGoals priority as base', () => {
  const { createAgmState, computeGoalUrgency } = require('../src/agm-state');
  const session = { adventureId: 'high-and-dry' };
  const state = createAgmState(session);

  // Goal with priority 8 should give base urgency of 0.8
  const goals = [{ status: 'active', priority: 8 }];
  const urgency = computeGoalUrgency(state, 'test-npc', goals, {});

  assert.ok(urgency >= 0.8, 'Urgency should be at least 0.8 for priority 8 goal');
  assert.ok(urgency <= 1.0, 'Urgency should not exceed 1.0');
});

// TEST O.10: determineActiveSpeaker returns single NPC for dialogue action
test('determineActiveSpeaker returns single NPC when only one present', () => {
  const { createAgmState, updateSceneContext } = require('../src/agm-state');
  const { determineActiveSpeaker } = require('../src/agm-npc-bridge');

  const session = { adventureId: 'high-and-dry' };
  const state = createAgmState(session);

  const scene = {
    id: 'test-scene',
    npcs_present: ['minister-greener']  // Only one NPC
  };
  updateSceneContext(state, scene, {});

  // Dialogue action with single NPC should return that NPC
  const result = determineActiveSpeaker(state, 'I say hello', scene);
  assert.strictEqual(result.speaker, 'npc', 'Should return NPC speaker');
  assert.strictEqual(result.npcId, 'minister-greener', 'Should return the single NPC');
});

// TEST O.11: getSceneRole reads scene_role property
test('getSceneRole reads scene_role property', () => {
  const { createAgmState, updateSceneContext } = require('../src/agm-state');
  const session = { adventureId: 'high-and-dry' };
  const state = createAgmState(session);

  const scene = {
    id: 'test-scene',
    npcs_present: ['test-npc'],
    npc_injection_rules: {
      'test-npc': { scene_role: 'informant' }
    }
  };
  updateSceneContext(state, scene, {});

  assert.strictEqual(state.npcs['test-npc'].sceneRole, 'informant', 'Should read scene_role property');
});

// TEST O.12: getNpcPriorities handles informant role
test('getNpcPriorities handles informant role', () => {
  const { createAgmState, updateSceneContext } = require('../src/agm-state');
  const { getNpcPriorities } = require('../src/agm-npc-bridge');

  const session = { adventureId: 'high-and-dry' };
  const state = createAgmState(session);

  const scene = {
    id: 'test-scene',
    npcs_present: ['test-npc'],
    npc_injection_rules: {
      'test-npc': { scene_role: 'informant' }
    }
  };
  updateSceneContext(state, scene, {});

  const npc = { id: 'test-npc', goals: [] };
  const priorities = getNpcPriorities(state, npc, {});

  assert.ok(priorities.some(p => p.includes('Share relevant information')), 'Should include informant directive');
});

// TEST O.13: createAgmState prefers session.adventureId
test('createAgmState prefers session.adventureId over adventure.id', () => {
  const { createAgmState } = require('../src/agm-state');

  // Session with both adventureId and adventure.id
  const session = {
    adventureId: 'direct-id',
    adventure: { id: 'nested-id' }
  };
  const state = createAgmState(session);

  assert.strictEqual(state.adventureId, 'direct-id', 'Should prefer session.adventureId');

  // Session with only adventure.id (fallback)
  const session2 = { adventure: { id: 'nested-id' } };
  const state2 = createAgmState(session2);

  assert.strictEqual(state2.adventureId, 'nested-id', 'Should fall back to adventure.id');
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
