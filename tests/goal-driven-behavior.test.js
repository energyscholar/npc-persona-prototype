/**
 * Tests for goal-driven NPC behavior
 *
 * Audit: .claude/plans/goal-driven-npcs-audit.md
 *
 * NPCs should have structured goals that drive their behavior
 * and appear in their prompts.
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

// Required goal fields
const REQUIRED_GOAL_FIELDS = ['id', 'description', 'priority', 'status'];

// TEST G.1: mr-casarii has goals array
test('mr-casarii has goals array', () => {
  const npc = loadNpc('mr-casarii');
  assert.ok(npc, 'Mr. Casarii should exist');
  assert.ok(Array.isArray(npc.goals), 'Should have goals array');
  assert.ok(npc.goals.length > 0, 'Should have at least one goal');
});

// TEST G.2: Goals have required fields (id, description, priority, status)
test('Goals have required fields', () => {
  const npcs = ['mr-casarii', 'minister-greener', 'customs-officer-walston', 'startown-bartender'];

  for (const npcId of npcs) {
    const npc = loadNpc(npcId);
    if (!npc) continue;

    assert.ok(Array.isArray(npc.goals), `${npcId} should have goals array`);

    for (const goal of npc.goals) {
      for (const field of REQUIRED_GOAL_FIELDS) {
        assert.ok(
          goal[field] !== undefined,
          `${npcId} goal "${goal.id || 'unknown'}" missing required field: ${field}`
        );
      }

      // Priority should be 1-10
      assert.ok(
        goal.priority >= 1 && goal.priority <= 10,
        `${npcId} goal "${goal.id}" priority should be 1-10, got ${goal.priority}`
      );

      // Status should be valid
      assert.ok(
        ['active', 'dormant', 'satisfied'].includes(goal.status),
        `${npcId} goal "${goal.id}" has invalid status: ${goal.status}`
      );
    }
  }
});

// TEST G.3: minister-greener has hire_recovery_crew goal
test('minister-greener has hire_recovery_crew goal', () => {
  const npc = loadNpc('minister-greener');
  assert.ok(npc, 'Minister Greener should exist');
  assert.ok(Array.isArray(npc.goals), 'Should have goals array');

  const hireGoal = npc.goals.find(g => g.id === 'hire_recovery_crew');
  assert.ok(hireGoal, 'Should have hire_recovery_crew goal');
  assert.strictEqual(hireGoal.priority, 10, 'hire_recovery_crew should be priority 10');
  assert.strictEqual(hireGoal.status, 'active', 'hire_recovery_crew should be active');
});

// TEST G.4: Goals include behavior_when_active
test('Goals include behavior_when_active', () => {
  const npc = loadNpc('mr-casarii');
  assert.ok(npc.goals, 'Should have goals');

  const goalsWithBehavior = npc.goals.filter(g =>
    g.behavior_when_active && g.behavior_when_active.length > 0
  );

  assert.ok(
    goalsWithBehavior.length > 0,
    'At least one goal should have behavior_when_active'
  );
});

// TEST G.5: getNpcPriorities returns goal behaviors
test('getNpcPriorities returns goal behaviors', () => {
  const { getNpcPriorities } = require('../src/agm-npc-bridge');

  const npc = loadNpc('mr-casarii');
  const agmState = { npcs: {} };
  const storyState = {};

  const priorities = getNpcPriorities(agmState, npc, storyState);

  assert.ok(Array.isArray(priorities), 'Should return array');
  assert.ok(priorities.length > 0, 'Should have priorities');

  // Check that goal behaviors appear
  const hasBriefingBehavior = priorities.some(p =>
    p.toLowerCase().includes('briefing') || p.toLowerCase().includes('answer')
  );
  assert.ok(hasBriefingBehavior, 'Should include goal behavior about briefing');
});

// TEST G.6: buildSystemPrompt includes goals section
test('buildSystemPrompt includes goals section when goals present', () => {
  const { buildSystemPrompt } = require('../src/prompts');

  const persona = {
    name: 'Test NPC',
    world: 'Test World',
    goals: [
      {
        id: 'test_goal',
        description: 'Test goal description',
        priority: 8,
        status: 'active',
        behavior_when_active: ['Do the thing']
      }
    ]
  };

  const prompt = buildSystemPrompt(persona, {});

  assert.ok(
    prompt.includes('GOALS') || prompt.includes('goals'),
    'Prompt should include goals section'
  );
  assert.ok(
    prompt.includes('Test goal description'),
    'Prompt should include goal description'
  );
});

// TEST G.7: High priority goals appear before low priority
test('High priority goals appear before low priority in priorities', () => {
  const { getNpcPriorities } = require('../src/agm-npc-bridge');

  // Create NPC with multiple goals at different priorities
  const npc = {
    id: 'test-npc',
    goals: [
      {
        id: 'low_priority',
        priority: 3,
        status: 'active',
        behavior_when_active: ['LOW_PRIORITY_BEHAVIOR']
      },
      {
        id: 'high_priority',
        priority: 9,
        status: 'active',
        behavior_when_active: ['HIGH_PRIORITY_BEHAVIOR']
      }
    ]
  };

  const priorities = getNpcPriorities({}, npc, {});

  const highIndex = priorities.findIndex(p => p.includes('HIGH_PRIORITY'));
  const lowIndex = priorities.findIndex(p => p.includes('LOW_PRIORITY'));

  assert.ok(highIndex >= 0, 'Should include high priority behavior');
  assert.ok(lowIndex >= 0, 'Should include low priority behavior');
  assert.ok(highIndex < lowIndex, 'High priority should come before low priority');
});

// TEST G.8: Blocks are included in priorities
test('Blocks are included in priorities', () => {
  const { getNpcPriorities } = require('../src/agm-npc-bridge');

  const npc = {
    id: 'test-npc',
    goals: [
      {
        id: 'goal_with_blocks',
        priority: 8,
        status: 'active',
        behavior_when_active: ['Do something'],
        blocks: ['Reveal secrets', 'Skip procedure']
      }
    ]
  };

  const priorities = getNpcPriorities({}, npc, {});

  const hasAvoid = priorities.some(p =>
    p.includes('AVOID') || p.toLowerCase().includes('avoid')
  );
  assert.ok(hasAvoid, 'Should include AVOID statement for blocks');

  const hasSecrets = priorities.some(p => p.includes('secrets'));
  assert.ok(hasSecrets, 'Should include blocked behavior');
});

// Run tests
async function runTests() {
  console.log('Running goal-driven behavior tests...\n');

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
