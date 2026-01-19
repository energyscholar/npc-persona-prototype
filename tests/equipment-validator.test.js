/**
 * Equipment Validator Tests
 * Audit: .claude/plans/central-supply-extraction.md
 *
 * Tests the strict JSON validation for equipment data
 */

const assert = require('assert');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// ============================================================
// TEST HELPERS
// ============================================================

function createValidWeapon() {
  return {
    id: 'autopistol-tl6',
    name: 'Autopistol',
    category: 'weapons',
    subcategory: 'slug-pistols',
    tl: 6,
    cost: 200,
    mass: 0.75,
    description: 'Standard automatic pistol',
    source: { book: 'CSC', page: 42 },
    weapon_stats: {
      damage: '3D-3',
      range: 'Pistol',
      magazine: 15,
      magazine_cost: 10,
      traits: ['Auto 2'],
      skill: 'Gun Combat (slug)'
    },
    legality: {
      legal_at_law_level: 5,
      restricted: false,
      military: false
    }
  };
}

function createValidArmor() {
  return {
    id: 'flak-jacket',
    name: 'Flak Jacket',
    category: 'armor',
    subcategory: 'body-armor',
    tl: 7,
    cost: 300,
    mass: 2,
    description: 'Ballistic vest',
    source: { book: 'CSC', page: 60 },
    armor_stats: {
      protection: 4,
      rad: 0,
      slots: 0,
      traits: []
    }
  };
}

function createValidSurvival() {
  return {
    id: 'filter-respirator',
    name: 'Filter/Respirator',
    category: 'survival',
    subcategory: 'breathing',
    tl: 6,
    cost: 100,
    mass: 0.25,
    description: 'Filters tainted atmospheres',
    source: { book: 'CSC', page: 95 },
    survival_stats: {
      duration: '6 hours',
      environment: ['tainted'],
      consumable: true
    }
  };
}

// ============================================================
// EV.1: Required Fields Validation
// ============================================================

test('EV.1.1: Valid equipment passes validation', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const weapon = createValidWeapon();

  const result = validateEquipment(weapon);

  assert.strictEqual(result.valid, true, 'Should be valid');
  assert.strictEqual(result.errors.length, 0, 'Should have no errors');
});

test('EV.1.2: Missing id fails', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const weapon = createValidWeapon();
  delete weapon.id;

  const result = validateEquipment(weapon);

  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('id')), 'Should report missing id');
});

test('EV.1.3: Missing name fails', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const weapon = createValidWeapon();
  delete weapon.name;

  const result = validateEquipment(weapon);

  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('name')), 'Should report missing name');
});

test('EV.1.4: Missing category fails', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const weapon = createValidWeapon();
  delete weapon.category;

  const result = validateEquipment(weapon);

  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('category')), 'Should report missing category');
});

test('EV.1.5: Missing TL fails', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const weapon = createValidWeapon();
  delete weapon.tl;

  const result = validateEquipment(weapon);

  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('tl')), 'Should report missing tl');
});

test('EV.1.6: Missing cost fails', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const weapon = createValidWeapon();
  delete weapon.cost;

  const result = validateEquipment(weapon);

  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('cost')), 'Should report missing cost');
});

// ============================================================
// EV.2: Category Validation
// ============================================================

test('EV.2.1: Valid category passes', () => {
  const { validateEquipment } = require('../src/equipment-validator');

  const categories = ['weapons', 'armor', 'survival', 'electronics',
                      'medical', 'tools', 'vehicles', 'robots', 'software'];

  for (const cat of categories) {
    const item = createValidWeapon();
    item.category = cat;
    if (cat !== 'weapons') delete item.weapon_stats;
    if (cat === 'armor') item.armor_stats = { protection: 4 };

    const result = validateEquipment(item);
    assert.ok(!result.errors.some(e => e.includes('category')),
              `Category ${cat} should be valid`);
  }
});

test('EV.2.2: Invalid category fails', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const weapon = createValidWeapon();
  weapon.category = 'invalid-category';

  const result = validateEquipment(weapon);

  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('category')));
});

// ============================================================
// EV.3: TL Range Validation
// ============================================================

test('EV.3.1: TL 0 is valid (primitive)', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const item = createValidWeapon();
  item.tl = 0;

  const result = validateEquipment(item);

  assert.ok(!result.errors.some(e => e.includes('TL')), 'TL 0 should be valid');
});

test('EV.3.2: TL 15 is valid (high tech)', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const item = createValidWeapon();
  item.tl = 15;

  const result = validateEquipment(item);

  assert.ok(!result.errors.some(e => e.includes('TL')), 'TL 15 should be valid');
});

test('EV.3.3: TL -1 fails', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const item = createValidWeapon();
  item.tl = -1;

  const result = validateEquipment(item);

  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('TL')));
});

test('EV.3.4: TL 16 fails', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const item = createValidWeapon();
  item.tl = 16;

  const result = validateEquipment(item);

  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('TL')));
});

// ============================================================
// EV.4: Weapon-Specific Validation
// ============================================================

test('EV.4.1: Weapons require weapon_stats', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const weapon = createValidWeapon();
  delete weapon.weapon_stats;

  const result = validateEquipment(weapon);

  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('weapon_stats')));
});

test('EV.4.2: Valid weapon ranges pass', () => {
  const { validateEquipment } = require('../src/equipment-validator');

  const ranges = ['Melee', 'Thrown', 'Pistol', 'Shotgun',
                  'Assault Weapon', 'Rifle', 'Rocket', 'Distant'];

  for (const range of ranges) {
    const weapon = createValidWeapon();
    weapon.weapon_stats.range = range;

    const result = validateEquipment(weapon);
    assert.ok(!result.errors.some(e => e.includes('range')),
              `Range ${range} should be valid`);
  }
});

test('EV.4.3: Invalid weapon range fails', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const weapon = createValidWeapon();
  weapon.weapon_stats.range = 'Invalid Range';

  const result = validateEquipment(weapon);

  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('range')));
});

test('EV.4.4: Weapon damage format validated', () => {
  const { validateEquipment } = require('../src/equipment-validator');

  // Valid damage formats
  const validDamage = ['1D', '2D', '3D', '4D+2', '3D-3', '2D+3'];
  for (const dmg of validDamage) {
    const weapon = createValidWeapon();
    weapon.weapon_stats.damage = dmg;

    const result = validateEquipment(weapon);
    assert.ok(!result.errors.some(e => e.includes('damage')),
              `Damage ${dmg} should be valid`);
  }
});

// ============================================================
// EV.5: Armor-Specific Validation
// ============================================================

test('EV.5.1: Armor requires armor_stats', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const armor = createValidArmor();
  delete armor.armor_stats;

  const result = validateEquipment(armor);

  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('armor_stats')));
});

test('EV.5.2: Armor protection must be numeric', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const armor = createValidArmor();
  armor.armor_stats.protection = 'high';

  const result = validateEquipment(armor);

  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('protection')));
});

test('EV.5.3: Valid armor passes', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const armor = createValidArmor();

  const result = validateEquipment(armor);

  assert.strictEqual(result.valid, true);
});

// ============================================================
// EV.6: Legality Validation
// ============================================================

test('EV.6.1: legal_at_law_level must be 0-15', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const weapon = createValidWeapon();
  weapon.legality.legal_at_law_level = -1;

  const result = validateEquipment(weapon);

  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('legal_at_law_level')));
});

test('EV.6.2: Legality fields are optional', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const weapon = createValidWeapon();
  delete weapon.legality;

  const result = validateEquipment(weapon);

  assert.strictEqual(result.valid, true, 'Legality is optional');
});

// ============================================================
// EV.7: Source Validation
// ============================================================

test('EV.7.1: Source book and page are optional', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const weapon = createValidWeapon();
  delete weapon.source;

  const result = validateEquipment(weapon);

  assert.strictEqual(result.valid, true, 'Source is optional');
});

// ============================================================
// EV.8: ID Format Validation
// ============================================================

test('EV.8.1: ID must be kebab-case', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const weapon = createValidWeapon();
  weapon.id = 'Invalid ID With Spaces';

  const result = validateEquipment(weapon);

  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('id')));
});

test('EV.8.2: Valid kebab-case ID passes', () => {
  const { validateEquipment } = require('../src/equipment-validator');
  const weapon = createValidWeapon();
  weapon.id = 'valid-kebab-case-id';

  const result = validateEquipment(weapon);

  assert.ok(!result.errors.some(e => e.includes('id') && e.includes('format')));
});

// ============================================================
// EV.9: Batch Validation
// ============================================================

test('EV.9.1: validateAll returns summary', () => {
  const { validateAll } = require('../src/equipment-validator');

  const items = [
    createValidWeapon(),
    createValidArmor(),
    createValidSurvival()
  ];

  const result = validateAll(items);

  assert.ok(typeof result.total === 'number');
  assert.ok(typeof result.valid === 'number');
  assert.ok(typeof result.invalid === 'number');
  assert.strictEqual(result.total, 3);
  assert.strictEqual(result.valid, 3);
  assert.strictEqual(result.invalid, 0);
});

test('EV.9.2: validateAll reports invalid items', () => {
  const { validateAll } = require('../src/equipment-validator');

  const invalidWeapon = createValidWeapon();
  delete invalidWeapon.id;

  const items = [
    createValidWeapon(),
    invalidWeapon,
    createValidArmor()
  ];

  const result = validateAll(items);

  assert.strictEqual(result.total, 3);
  assert.strictEqual(result.valid, 2);
  assert.strictEqual(result.invalid, 1);
  assert.ok(result.errors.length > 0);
});

// ============================================================
// RUN TESTS
// ============================================================

async function runTests() {
  console.log('\n══════════════════════════════════════════');
  console.log('  EQUIPMENT VALIDATOR TESTS');
  console.log('══════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`\x1b[32m✓\x1b[0m ${t.name}`);
      passed++;
    } catch (e) {
      console.log(`\x1b[31m✗\x1b[0m ${t.name}`);
      console.log(`    ${e.message}`);
      failed++;
    }
  }

  console.log(`\n${passed}/${passed + failed} tests passed`);
  if (failed > 0) process.exitCode = 1;
}

runTests();
