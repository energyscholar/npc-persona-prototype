/**
 * Tests for NPC knowledge boundaries
 *
 * Audit: .claude/plans/anders-knowledge-fix-audit.md
 *
 * These tests verify that NPCs don't have knowledge that would break
 * the adventure plot or spoil mysteries for players.
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

// Helper to load queries
function loadQueries() {
  const queriesPath = path.join(__dirname, '../data/red-team/queries.json');
  if (!fs.existsSync(queriesPath)) return null;
  return JSON.parse(fs.readFileSync(queriesPath, 'utf8'));
}

// TEST KB.1: mr-casarii the_ship entry does NOT contain "Mount Salbarii"
test('mr-casarii the_ship does NOT mention Mount Salbarii', () => {
  const npc = loadNpc('mr-casarii');
  assert.ok(npc, 'Mr. Casarii should exist');
  assert.ok(npc.knowledge_base?.the_ship, 'Should have the_ship knowledge');

  const shipKnowledge = npc.knowledge_base.the_ship.toLowerCase();
  assert.ok(
    !shipKnowledge.includes('mount salbarii') && !shipKnowledge.includes('salbarii'),
    'the_ship should NOT mention Mount Salbarii - this is plot info Anders doesn\'t know'
  );
});

// TEST KB.2: mr-casarii the_ship entry does NOT contain specific mountain location
test('mr-casarii the_ship does NOT mention mountains', () => {
  const npc = loadNpc('mr-casarii');
  const shipKnowledge = npc.knowledge_base.the_ship.toLowerCase();

  assert.ok(
    !shipKnowledge.includes('mountains') && !shipKnowledge.includes('mountain'),
    'the_ship should NOT mention mountains - Anders doesn\'t know the specific location'
  );
});

// TEST KB.3: mr-casarii the_previous_crew does NOT say ship came to Flammarion
test('mr-casarii the_previous_crew correctly states ship stayed on Walston', () => {
  const npc = loadNpc('mr-casarii');
  assert.ok(npc.knowledge_base?.the_previous_crew, 'Should have the_previous_crew knowledge');

  const crewKnowledge = npc.knowledge_base.the_previous_crew.toLowerCase();

  // Should NOT imply ship flew/limped to Flammarion
  assert.ok(
    !crewKnowledge.includes('limped into flammarion') &&
    !crewKnowledge.includes('limped to flammarion') &&
    !crewKnowledge.includes('flew to flammarion') &&
    !crewKnowledge.includes('arrived at flammarion'),
    'Should NOT say ship came to Flammarion - ship was abandoned on Walston'
  );

  // SHOULD mention crew traveled separately
  assert.ok(
    crewKnowledge.includes('walston') || crewKnowledge.includes('abandoned'),
    'Should mention ship was abandoned on Walston'
  );
});

// TEST KB.4: mr-casarii has knowledge_limits field
test('mr-casarii has knowledge_limits field', () => {
  const npc = loadNpc('mr-casarii');
  assert.ok(
    npc.knowledge_limits,
    'Mr. Casarii should have knowledge_limits field documenting what he doesn\'t know'
  );
});

// TEST KB.5: knowledge_limits.does_not_know includes location details
test('knowledge_limits.does_not_know includes location details', () => {
  const npc = loadNpc('mr-casarii');
  assert.ok(npc.knowledge_limits?.does_not_know, 'Should have does_not_know array');
  assert.ok(Array.isArray(npc.knowledge_limits.does_not_know), 'does_not_know should be array');

  const doesNotKnow = npc.knowledge_limits.does_not_know.map(s => s.toLowerCase()).join(' ');

  assert.ok(
    doesNotKnow.includes('location') || doesNotKnow.includes('salbarii') || doesNotKnow.includes('volcano'),
    'does_not_know should include location/geographic details'
  );
});

// TEST KB.6: Red team queries include boundary tests (Q_BOUNDARY_*)
test('Red team queries include boundary tests', () => {
  const queries = loadQueries();
  assert.ok(queries, 'Queries file should exist');
  assert.ok(queries.queries, 'Should have queries array');

  const boundaryQueries = queries.queries.filter(q => q.id.startsWith('Q_BOUNDARY'));

  assert.ok(
    boundaryQueries.length >= 2,
    'Should have at least 2 boundary test queries (Q_BOUNDARY_*)'
  );

  // Check that boundary queries have failure_keywords
  for (const q of boundaryQueries) {
    assert.ok(
      q.failure_keywords && q.failure_keywords.length > 0,
      `Boundary query ${q.id} should have failure_keywords`
    );
  }
});

// Run tests
async function runTests() {
  console.log('Running knowledge boundary tests...\n');

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
