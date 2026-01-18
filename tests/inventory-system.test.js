/**
 * Tests for PC inventory system
 *
 * Audit: .claude/plans/inventory-and-porter-audit.md
 *
 * Tracks items that unlock barriers and enable actions
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Helper to create mock session
function createMockSession() {
  return {
    storyState: {
      currentScene: 'test-scene',
      inventory: []
    }
  };
}

// Helper to load NPC
function loadNpc(npcId) {
  const npcPath = path.join(__dirname, '../data/npcs', `${npcId}.json`);
  if (!fs.existsSync(npcPath)) return null;
  return JSON.parse(fs.readFileSync(npcPath, 'utf8'));
}

// Helper to load scene
function loadScene(adventureId, sceneId) {
  const scenePath = path.join(__dirname, `../data/adventures/${adventureId}/scenes`, `${sceneId}.json`);
  if (!fs.existsSync(scenePath)) return null;
  return JSON.parse(fs.readFileSync(scenePath, 'utf8'));
}

// TEST I.1: Inventory initializes empty
test('Inventory initializes empty', () => {
  const { initializeInventory } = require('../src/inventory');
  const storyState = {};

  const inv = initializeInventory(storyState);

  assert.ok(Array.isArray(inv), 'Should return array');
  assert.strictEqual(inv.length, 0, 'Should be empty');
  assert.ok(storyState.inventory, 'Should set inventory on storyState');
});

// TEST I.2: addToInventory adds item
test('addToInventory adds item', () => {
  const { addToInventory, initializeInventory } = require('../src/inventory');
  const session = createMockSession();
  initializeInventory(session.storyState);

  const item = {
    id: 'test-item',
    name: 'Test Item',
    type: 'document'
  };

  const result = addToInventory(session, item);

  assert.strictEqual(result, true, 'Should return true when adding new item');
  assert.strictEqual(session.storyState.inventory.length, 1, 'Inventory should have one item');
  assert.strictEqual(session.storyState.inventory[0].id, 'test-item', 'Item ID should match');
});

// TEST I.3: hasItem returns true for added item
test('hasItem returns true for added item', () => {
  const { addToInventory, hasItem, initializeInventory } = require('../src/inventory');
  const session = createMockSession();
  initializeInventory(session.storyState);

  const item = { id: 'test-doc', name: 'Test Document', type: 'document' };
  addToInventory(session, item);

  assert.strictEqual(hasItem(session, 'test-doc'), true, 'Should find added item');
  assert.strictEqual(hasItem(session, 'nonexistent'), false, 'Should not find missing item');
});

// TEST I.4: checkUnlock returns true when item has unlock key
test('checkUnlock returns true when item has unlock key', () => {
  const { addToInventory, checkUnlock, initializeInventory } = require('../src/inventory');
  const session = createMockSession();
  initializeInventory(session.storyState);

  const item = {
    id: 'iiss-docs',
    name: 'IISS Documents',
    type: 'document',
    unlocks: ['ship-access', 'official-credibility']
  };
  addToInventory(session, item);

  assert.strictEqual(checkUnlock(session, 'ship-access'), true, 'Should unlock ship-access');
  assert.strictEqual(checkUnlock(session, 'official-credibility'), true, 'Should unlock official-credibility');
  assert.strictEqual(checkUnlock(session, 'secret-base'), false, 'Should not unlock unrelated key');
});

// TEST I.5: getCargoItems filters correctly
test('getCargoItems filters correctly', () => {
  const { addToInventory, getCargoItems, initializeInventory } = require('../src/inventory');
  const session = createMockSession();
  initializeInventory(session.storyState);

  addToInventory(session, { id: 'doc1', name: 'Document', type: 'document' });
  addToInventory(session, { id: 'cargo1', name: 'Crate 1', type: 'cargo' });
  addToInventory(session, { id: 'cargo2', name: 'Crate 2', type: 'cargo' });

  const cargo = getCargoItems(session);

  assert.strictEqual(cargo.length, 2, 'Should have 2 cargo items');
  assert.ok(cargo.every(c => c.type === 'cargo'), 'All items should be cargo type');
});

// TEST I.6: Duplicate items not added twice
test('Duplicate items not added twice', () => {
  const { addToInventory, initializeInventory } = require('../src/inventory');
  const session = createMockSession();
  initializeInventory(session.storyState);

  const item = { id: 'unique-item', name: 'Unique Item', type: 'document' };

  const first = addToInventory(session, item);
  const second = addToInventory(session, item);

  assert.strictEqual(first, true, 'First add should succeed');
  assert.strictEqual(second, false, 'Second add should fail (duplicate)');
  assert.strictEqual(session.storyState.inventory.length, 1, 'Should still have only one item');
});

// TEST I.7: Gvoudzon NPC exists and has connections
test('Gvoudzon NPC exists and has connections', () => {
  const npc = loadNpc('vargr-porter-gvoudzon');

  assert.ok(npc, 'Gvoudzon NPC should exist');
  assert.strictEqual(npc.species, 'vargr', 'Should be Vargr');
  assert.strictEqual(npc.archetype, 'fixer', 'Should be fixer archetype');
  assert.ok(npc.connections, 'Should have connections object');
  assert.ok(npc.connections.dhangaz, 'Should know vehicle dealer');
  assert.ok(npc.connections.aethkurz, 'Should know wilderness guide');
  assert.ok(npc.knowledge_base, 'Should have knowledge base');
  assert.ok(npc.goals, 'Should have goals');
});

// TEST I.8: Hotel scene exists with details
test('Hotel scene exists with details', () => {
  const scene = loadScene('high-and-dry', 'startown-hotel');

  assert.ok(scene, 'Hotel scene should exist');
  assert.ok(scene.description, 'Should have description');
  assert.ok(scene.details, 'Should have details object');
  assert.ok(scene.details.rooms, 'Should have rooms info');
  assert.ok(scene.details.rates, 'Should have rates info');
});

// Run tests
async function runTests() {
  console.log('Running inventory system tests...\n');

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
