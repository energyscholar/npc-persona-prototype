#!/usr/bin/env node
/**
 * Inventory Storage System Tests
 * Items stored at locations remain in inventory (object permanence)
 * but are unavailable until retrieved.
 */

const { strict: assert } = require('assert');

const {
  storeItem,
  retrieveItem,
  isItemAvailable,
  getStoredItems,
  getAvailableItems,
  getItemsAtLocation,
  getIllegalItems,
  hasItem,
  confiscateItem
} = require('../src/inventory');

// Test runner
function runTests(tests) {
  let passed = 0, failed = 0;
  for (const [name, fn] of Object.entries(tests)) {
    try {
      fn();
      console.log(`\x1b[32m✓\x1b[0m ${name}`);
      passed++;
    } catch (e) {
      console.log(`\x1b[31m✗\x1b[0m ${name}`);
      console.log(`    ${e.message}`);
      failed++;
    }
  }
  console.log(`\n${passed}/${passed + failed} tests passed`);
  return failed === 0;
}

// Test helpers
function createTestSession(inventory = []) {
  return {
    storyState: {
      inventory: inventory,
      flags: {},
      currentScene: 'test-scene'
    }
  };
}

function createTestInventory() {
  return [
    {
      id: 'autopistol-standard',
      name: 'Autopistol',
      type: 'weapon',
      subtype: 'firearm',
      legal_at_law_level: 5
    },
    {
      id: 'blade-combat',
      name: 'Combat Blade',
      type: 'weapon',
      subtype: 'blade',
      legal_at_law_level: 8
    },
    {
      id: 'medkit-personal',
      name: 'Personal Medkit',
      type: 'medical'
    },
    {
      id: 'filter-respirator-1',
      name: 'Filter Respirator',
      type: 'survival'
    }
  ];
}

// === STORE ITEM TESTS ===

const storeItemTests = {
  'storeItem sets location field on item': () => {
    const session = createTestSession(createTestInventory());
    storeItem(session, 'autopistol-standard', 'starport-customs');
    const item = session.storyState.inventory.find(i => i.id === 'autopistol-standard');
    assert.strictEqual(item.location, 'starport-customs');
  },

  'storeItem sets stored_at timestamp': () => {
    const session = createTestSession(createTestInventory());
    storeItem(session, 'autopistol-standard', 'starport-customs');
    const item = session.storyState.inventory.find(i => i.id === 'autopistol-standard');
    assert.ok(item.stored_at, 'Should have stored_at timestamp');
    assert.ok(!isNaN(Date.parse(item.stored_at)), 'stored_at should be valid date');
  },

  'storeItem handles non-existent item gracefully': () => {
    const session = createTestSession([]);
    // Should not throw
    storeItem(session, 'nonexistent', 'location');
    assert.ok(true);
  }
};

// === RETRIEVE ITEM TESTS ===

const retrieveItemTests = {
  'retrieveItem clears location field': () => {
    const session = createTestSession(createTestInventory());
    storeItem(session, 'autopistol-standard', 'starport-customs');
    retrieveItem(session, 'autopistol-standard');
    const item = session.storyState.inventory.find(i => i.id === 'autopistol-standard');
    assert.strictEqual(item.location, undefined);
  },

  'retrieveItem clears stored_at timestamp': () => {
    const session = createTestSession(createTestInventory());
    storeItem(session, 'autopistol-standard', 'starport-customs');
    retrieveItem(session, 'autopistol-standard');
    const item = session.storyState.inventory.find(i => i.id === 'autopistol-standard');
    assert.strictEqual(item.stored_at, undefined);
  },

  'item remains in inventory after retrieval (object permanence)': () => {
    const session = createTestSession(createTestInventory());
    storeItem(session, 'autopistol-standard', 'starport-customs');
    retrieveItem(session, 'autopistol-standard');
    const item = session.storyState.inventory.find(i => i.id === 'autopistol-standard');
    assert.ok(item, 'Item should still exist');
    assert.strictEqual(item.name, 'Autopistol');
  },

  'retrieveItem handles non-existent item gracefully': () => {
    const session = createTestSession([]);
    retrieveItem(session, 'nonexistent');
    assert.ok(true);
  }
};

// === IS ITEM AVAILABLE TESTS ===

const isItemAvailableTests = {
  'isItemAvailable returns false for stored items': () => {
    const session = createTestSession(createTestInventory());
    storeItem(session, 'autopistol-standard', 'starport-customs');
    assert.strictEqual(isItemAvailable(session, 'autopistol-standard'), false);
  },

  'isItemAvailable returns true for carried items': () => {
    const session = createTestSession(createTestInventory());
    assert.strictEqual(isItemAvailable(session, 'autopistol-standard'), true);
  },

  'isItemAvailable returns true after item is retrieved': () => {
    const session = createTestSession(createTestInventory());
    storeItem(session, 'autopistol-standard', 'starport-customs');
    retrieveItem(session, 'autopistol-standard');
    assert.strictEqual(isItemAvailable(session, 'autopistol-standard'), true);
  },

  'isItemAvailable returns false for non-existent item': () => {
    const session = createTestSession(createTestInventory());
    assert.strictEqual(isItemAvailable(session, 'nonexistent-item'), false);
  },

  'isItemAvailable returns false for confiscated items': () => {
    const session = createTestSession(createTestInventory());
    confiscateItem(session, 'autopistol-standard');
    assert.strictEqual(isItemAvailable(session, 'autopistol-standard'), false);
  }
};

// === GET STORED ITEMS TESTS ===

const getStoredItemsTests = {
  'getStoredItems returns empty array when nothing stored': () => {
    const session = createTestSession(createTestInventory());
    assert.deepStrictEqual(getStoredItems(session), []);
  },

  'getStoredItems returns only stored items': () => {
    const session = createTestSession(createTestInventory());
    storeItem(session, 'autopistol-standard', 'starport-customs');
    const stored = getStoredItems(session);
    assert.strictEqual(stored.length, 1);
    assert.strictEqual(stored[0].id, 'autopistol-standard');
  },

  'getStoredItems returns multiple stored items': () => {
    const session = createTestSession(createTestInventory());
    storeItem(session, 'autopistol-standard', 'starport-customs');
    storeItem(session, 'blade-combat', 'starport-customs');
    const stored = getStoredItems(session);
    assert.strictEqual(stored.length, 2);
  },

  'getStoredItems does not include confiscated items': () => {
    const session = createTestSession(createTestInventory());
    storeItem(session, 'autopistol-standard', 'starport-customs');
    confiscateItem(session, 'autopistol-standard');
    const stored = getStoredItems(session);
    assert.strictEqual(stored.length, 0);
  }
};

// === GET AVAILABLE ITEMS TESTS ===

const getAvailableItemsTests = {
  'getAvailableItems returns all items when nothing stored': () => {
    const session = createTestSession(createTestInventory());
    assert.strictEqual(getAvailableItems(session).length, 4);
  },

  'getAvailableItems excludes stored items': () => {
    const session = createTestSession(createTestInventory());
    storeItem(session, 'autopistol-standard', 'starport-customs');
    const available = getAvailableItems(session);
    assert.strictEqual(available.length, 3);
    assert.ok(!available.find(i => i.id === 'autopistol-standard'));
  },

  'getAvailableItems excludes confiscated items': () => {
    const session = createTestSession(createTestInventory());
    confiscateItem(session, 'autopistol-standard');
    const available = getAvailableItems(session);
    assert.strictEqual(available.length, 3);
    assert.ok(!available.find(i => i.id === 'autopistol-standard'));
  }
};

// === GET ITEMS AT LOCATION TESTS ===

const getItemsAtLocationTests = {
  'getItemsAtLocation returns items at specified location': () => {
    const session = createTestSession(createTestInventory());
    storeItem(session, 'autopistol-standard', 'starport-customs');
    storeItem(session, 'blade-combat', 'ship-locker');
    const atCustoms = getItemsAtLocation(session, 'starport-customs');
    assert.strictEqual(atCustoms.length, 1);
    assert.strictEqual(atCustoms[0].id, 'autopistol-standard');
  },

  'getItemsAtLocation returns empty array when no items at location': () => {
    const session = createTestSession(createTestInventory());
    assert.strictEqual(getItemsAtLocation(session, 'starport-customs').length, 0);
  },

  'getItemsAtLocation returns multiple items at same location': () => {
    const session = createTestSession(createTestInventory());
    storeItem(session, 'autopistol-standard', 'starport-customs');
    storeItem(session, 'blade-combat', 'starport-customs');
    assert.strictEqual(getItemsAtLocation(session, 'starport-customs').length, 2);
  }
};

// === ILLEGAL ITEMS WITH STORAGE TESTS ===

const illegalItemsWithStorageTests = {
  'getIllegalItems returns carried illegal weapons': () => {
    const session = createTestSession(createTestInventory());
    const illegal = getIllegalItems(session, 8);
    assert.strictEqual(illegal.length, 1);
    assert.strictEqual(illegal[0].id, 'autopistol-standard');
  },

  'getIllegalItems excludes stored illegal weapons': () => {
    const session = createTestSession(createTestInventory());
    storeItem(session, 'autopistol-standard', 'starport-customs');
    const illegal = getIllegalItems(session, 8);
    assert.strictEqual(illegal.length, 0);
  },

  'getIllegalItems excludes confiscated illegal weapons': () => {
    const session = createTestSession(createTestInventory());
    confiscateItem(session, 'autopistol-standard');
    const illegal = getIllegalItems(session, 8);
    assert.strictEqual(illegal.length, 0);
  }
};

// === OBJECT PERMANENCE TESTS ===

const objectPermanenceTests = {
  'hasItem returns true for stored item': () => {
    const session = createTestSession(createTestInventory());
    storeItem(session, 'autopistol-standard', 'starport-customs');
    assert.strictEqual(hasItem(session, 'autopistol-standard'), true);
  },

  'hasItem returns true for carried item': () => {
    const session = createTestSession(createTestInventory());
    assert.strictEqual(hasItem(session, 'autopistol-standard'), true);
  },

  'hasItem returns false for non-existent item': () => {
    const session = createTestSession(createTestInventory());
    assert.strictEqual(hasItem(session, 'nonexistent'), false);
  },

  'hasItem returns true for confiscated item (still exists)': () => {
    const session = createTestSession(createTestInventory());
    confiscateItem(session, 'autopistol-standard');
    assert.strictEqual(hasItem(session, 'autopistol-standard'), true);
  }
};

// Run all test groups
console.log('═══════════════════════════════════════════════════');
console.log('  INVENTORY STORAGE SYSTEM TESTS');
console.log('═══════════════════════════════════════════════════\n');

console.log('--- storeItem Tests ---');
const storeOk = runTests(storeItemTests);

console.log('\n--- retrieveItem Tests ---');
const retrieveOk = runTests(retrieveItemTests);

console.log('\n--- isItemAvailable Tests ---');
const availableOk = runTests(isItemAvailableTests);

console.log('\n--- getStoredItems Tests ---');
const storedOk = runTests(getStoredItemsTests);

console.log('\n--- getAvailableItems Tests ---');
const availOk = runTests(getAvailableItemsTests);

console.log('\n--- getItemsAtLocation Tests ---');
const locationOk = runTests(getItemsAtLocationTests);

console.log('\n--- getIllegalItems with Storage Tests ---');
const illegalOk = runTests(illegalItemsWithStorageTests);

console.log('\n--- Object Permanence Tests ---');
const permOk = runTests(objectPermanenceTests);

const allPassed = storeOk && retrieveOk && availableOk && storedOk && availOk && locationOk && illegalOk && permOk;

console.log('\n═══════════════════════════════════════════════════');
console.log(allPassed ? '  ALL TESTS PASSED ✓' : '  SOME TESTS FAILED ✗');
console.log('═══════════════════════════════════════════════════\n');

process.exit(allPassed ? 0 : 1);
