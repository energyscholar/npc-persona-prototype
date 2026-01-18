/**
 * Tests for narrator improvisation system
 *
 * Audit: .claude/plans/narrator-improvisation-audit.md
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Helper to load JSON
function loadJson(relativePath) {
  const fullPath = path.join(__dirname, '..', relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

// TEST I.1: Resources data loads
test('Resources data loads', () => {
  const resources = loadJson('data/adventures/high-and-dry/resources/walston-resources.json');
  assert.ok(resources, 'Resources file should exist');
  assert.ok(resources.transportation, 'Should have transportation section');
});

// TEST I.2: Air vehicle scarcity documented
test('Air vehicle scarcity documented', () => {
  const resources = loadJson('data/adventures/high-and-dry/resources/walston-resources.json');
  assert.strictEqual(
    resources.transportation.air_vehicles.availability,
    'rare',
    'Air vehicles should be marked as rare'
  );
  assert.ok(
    resources.transportation.air_vehicles.sources.length > 0,
    'Should list available air vehicle sources'
  );
});

// TEST I.3: Improv principles exist
test('Improv principles exist', () => {
  const improv = loadJson('data/adventures/high-and-dry/narrator-rules/improvisation.json');
  assert.ok(improv, 'Improvisation rules should exist');
  assert.ok(improv.core_principles, 'Should have core_principles');
  assert.ok(
    improv.core_principles.length >= 4,
    'Should have at least 4 core principles'
  );
});

// TEST I.4: Examples have required fields
test('Examples have required fields', () => {
  const examples = loadJson('data/adventures/high-and-dry/narrator-rules/improv-examples.json');
  assert.ok(examples, 'Examples file should exist');
  assert.ok(examples.examples, 'Should have examples array');
  assert.ok(examples.examples.length >= 5, 'Should have at least 5 examples');

  for (const ex of examples.examples) {
    assert.ok(ex.id, `Example should have id`);
    assert.ok(ex.pc_action, `Example ${ex.id} should have pc_action`);
    assert.ok(ex.good_response, `Example ${ex.id} should have good_response`);
    assert.ok(ex.why_good, `Example ${ex.id} should have why_good`);
  }
});

// TEST I.5: Resource lookup works
test('Resource lookup works', () => {
  const { getAvailableResources } = require('../src/resource-lookup');
  const transport = getAvailableResources('high-and-dry', 'transportation', 'startown');
  assert.ok(transport, 'Should return transport options');
  assert.ok(transport.length > 0, 'Should have at least one transport option');
});

// TEST I.6: Alternative suggestions work
test('Alternative suggestions work', () => {
  const { suggestAlternatives } = require('../src/resource-lookup');
  const alts = suggestAlternatives('high-and-dry', 'helicopter');
  assert.ok(alts, 'Should return alternatives');
  assert.ok(
    alts.some(a => a.includes('air') || a.includes('grav') || a.includes('raft')),
    'Alternatives for helicopter should include air/grav options'
  );
});

// TEST I.7: NPC templates exist
test('NPC templates exist', () => {
  const templates = loadJson('data/adventures/high-and-dry/npc-templates/emergent-npcs.json');
  assert.ok(templates, 'NPC templates file should exist');
  assert.ok(templates.templates, 'Should have templates object');
  assert.ok(templates.templates.farmer, 'Should have farmer template');
  assert.ok(templates.templates.farmer.species_distribution, 'Farmer should have species_distribution');
  assert.ok(templates.name_pools, 'Should have name_pools');
});

// TEST I.8: NPC generation works
test('NPC generation works', () => {
  const { generateNPC } = require('../src/emergent-npc');
  const npc = generateNPC('high-and-dry', 'farmer', 'Lakeside');
  assert.ok(npc, 'Should generate NPC');
  assert.ok(npc.name, 'NPC should have name');
  assert.ok(npc.species, 'NPC should have species');
  assert.ok(['human', 'vargr'].includes(npc.species), 'Species should be human or vargr');
  assert.ok(npc.skills, 'NPC should have skills');
});

// Run tests
async function runTests() {
  console.log('Running narrator improvisation tests...\n');

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
