/**
 * Tests for NPC goal satisfaction system
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

// Helper to load NPC
function loadNpc(npcId) {
  const npcPath = path.join(__dirname, '../data/npcs', `${npcId}.json`);
  if (!fs.existsSync(npcPath)) return null;
  return JSON.parse(fs.readFileSync(npcPath, 'utf8'));
}

// Ready-tier NPCs with goals
const GOAL_NPCS = [
  'minister-greener',
  'vargr-chauffeur'
];

// TEST G.1: Ready-tier NPCs have goals or conversation_context
test('Ready-tier NPCs have goals or conversation_context', () => {
  for (const npcId of GOAL_NPCS) {
    const npc = loadNpc(npcId);
    assert.ok(npc, `NPC ${npcId} should exist`);
    // Goals can be in goals array or conversation_context.primary_agenda
    const hasGoals =
      (npc.goals && npc.goals.length > 0) ||
      (npc.conversation_context && npc.conversation_context.primary_agenda);

    assert.ok(hasGoals, `NPC ${npcId} should have goals or primary_agenda`);
  }
});

// TEST G.2: Goals have conditions
test('Goals have conditions or leverage', () => {
  for (const npcId of GOAL_NPCS) {
    const npc = loadNpc(npcId);
    // Check for conditions in conversation_context
    if (npc.conversation_context) {
      const hasConditions =
        npc.conversation_context.conditions ||
        npc.conversation_context.leverage;
      assert.ok(hasConditions, `NPC ${npcId} should have conditions or leverage`);
    }
  }
});

// TEST G.3: computeGoalUrgency returns valid range
test('computeGoalUrgency returns valid range', () => {
  const { createAgmState, computeGoalUrgency } = require('../src/agm-state');

  const session = { adventure: { id: 'high-and-dry' } };
  const state = createAgmState(session);

  const npc = loadNpc('minister-greener');
  const goals = npc.conversation_context?.primary_agenda
    ? [npc.conversation_context.primary_agenda]
    : [];

  const urgency = computeGoalUrgency(state, 'minister-greener', goals, {});

  assert.ok(urgency >= 0.0, 'Urgency should be >= 0.0');
  assert.ok(urgency <= 1.0, 'Urgency should be <= 1.0');
});

// TEST G.4: Story pressure increases urgency
test('Story pressure increases urgency', () => {
  const { createAgmState, computeGoalUrgency } = require('../src/agm-state');

  const session = { adventure: { id: 'high-and-dry' } };
  const state = createAgmState(session);

  const npc = loadNpc('vargr-chauffeur');
  const goals = ['rescue parents'];

  // Without volcano_active
  const normalUrgency = computeGoalUrgency(state, 'vargr-chauffeur', goals, {});

  // With volcano_active
  const crisisUrgency = computeGoalUrgency(state, 'vargr-chauffeur', goals, {
    flags: { volcano_active: true }
  });

  assert.ok(
    crisisUrgency >= normalUrgency + 0.2,
    'Volcano active should increase urgency by at least 0.2'
  );
});

// TEST G.5: NPCs have knowledge_gates (conditions for revealing info)
test('NPCs have knowledge_gates or conditional info', () => {
  for (const npcId of GOAL_NPCS) {
    const npc = loadNpc(npcId);
    // Check for conditions that gate information
    const hasGates =
      npc.knowledge_gates ||
      (npc.conversation_context && npc.conversation_context.conditions);

    assert.ok(hasGates, `NPC ${npcId} should have knowledge gates or conditions`);
  }
});

// TEST G.6: State machine exists for ready NPCs
test('State machine exists for ready NPCs', () => {
  for (const npcId of GOAL_NPCS) {
    const npc = loadNpc(npcId);
    // State machine can be in state_machine or conversation_context.state_machine
    const hasStateMachine =
      npc.state_machine ||
      (npc.conversation_context && npc.conversation_context.state_machine);

    assert.ok(hasStateMachine, `NPC ${npcId} should have state machine`);

    // Check for at least 2 states
    const stateMachine = npc.state_machine || npc.conversation_context?.state_machine;
    const stateCount = Object.keys(stateMachine).length;
    assert.ok(stateCount >= 2, `NPC ${npcId} state machine should have at least 2 states`);
  }
});

// Run tests
async function runTests() {
  console.log('Running goal satisfaction tests...\n');

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
