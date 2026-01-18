/**
 * Tests for Vargr/Human species system
 *
 * Audit: .claude/plans/species-system-audit.md
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Helper to load species JSON
function loadSpecies(speciesId) {
  const speciesPath = path.join(
    __dirname,
    '../data/species',
    `${speciesId}.json`
  );
  if (!fs.existsSync(speciesPath)) return null;
  return JSON.parse(fs.readFileSync(speciesPath, 'utf8'));
}

// Helper to load NPC JSON
function loadNpc(npcId) {
  const npcPath = path.join(
    __dirname,
    '../data/npcs',
    `${npcId}.json`
  );
  if (!fs.existsSync(npcPath)) return null;
  return JSON.parse(fs.readFileSync(npcPath, 'utf8'));
}

// Helper to load all NPCs
function loadAllNpcs() {
  const npcsDir = path.join(__dirname, '../data/npcs');
  const files = fs.readdirSync(npcsDir).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(npcsDir, f), 'utf8')));
}

// TEST SP.1: Species data loads
test('Species data loads', () => {
  const vargr = loadSpecies('vargr');
  assert.ok(vargr, 'Vargr species data should exist');
  assert.strictEqual(vargr.id, 'vargr');

  const human = loadSpecies('human');
  assert.ok(human, 'Human species data should exist');
  assert.strictEqual(human.id, 'human');
});

// TEST SP.2: Vargr has body language defined
test('Vargr has body language defined', () => {
  const vargr = loadSpecies('vargr');
  assert.ok(vargr.psychology, 'Should have psychology section');
  assert.ok(vargr.psychology.body_language, 'Should have body_language');
  assert.ok(vargr.psychology.body_language.ears_forward, 'Should define ears_forward');
  assert.ok(vargr.psychology.body_language.tail_high, 'Should define tail_high');
});

// TEST SP.3: Key NPCs have species field
test('Key NPCs have species field', () => {
  const keyNpcs = [
    'minister-greener',
    'vargr-chauffeur',
    'customs-officer-walston',
    'startown-bartender'
  ];

  for (const npcId of keyNpcs) {
    const npc = loadNpc(npcId);
    if (npc) {
      assert.ok(npc.species, `NPC ${npcId} should have species field`);
      assert.ok(
        ['human', 'vargr'].includes(npc.species),
        `NPC ${npcId} species should be human or vargr`
      );
    }
  }
});

// TEST SP.4: Vargr chauffeur has species traits
test('Vargr chauffeur has species traits', () => {
  const kira = loadNpc('vargr-chauffeur');
  assert.ok(kira, 'Vargr chauffeur should exist');
  assert.strictEqual(kira.species, 'vargr');
  assert.ok(kira.species_traits, 'Should have species_traits');
});

// TEST SP.5: Species lookup works
test('Species lookup works', () => {
  const { getSpecies } = require('../src/species-data');
  const vData = getSpecies('vargr');
  assert.ok(vData, 'Should return vargr data');
  assert.ok(vData.roleplay_notes, 'Should have roleplay_notes');
});

// TEST SP.6: Walston-specific species data exists
test('Walston-specific species data exists', () => {
  const vargr = loadSpecies('vargr');
  assert.ok(vargr.walston_specific, 'Should have walston_specific section');
  assert.strictEqual(vargr.walston_specific.population_percentage, 70);

  const human = loadSpecies('human');
  assert.ok(human.walston_specific, 'Human should have walston_specific');
  assert.strictEqual(human.walston_specific.population_percentage, 30);
});

// Run tests
async function runTests() {
  console.log('Running species system tests...\n');

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
