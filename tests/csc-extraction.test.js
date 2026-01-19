/**
 * CSC Equipment Extraction Tests
 * Audit: .claude/plans/csc-extraction-v2.md
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Paths
const TEXT_DIR = path.join(__dirname, '../data/equipment/text');
const EXTRACTED_DIR = path.join(__dirname, '../data/equipment/extracted');
const EQUIPMENT_DIR = path.join(__dirname, '../data/equipment/equipment');

// ============================================================
// T1: Table Detection
// ============================================================

test('T1.1: detectTablePages finds weapon tables', () => {
  const { detectTablePages } = require('../scripts/csc-detect-tables');
  const pages = detectTablePages();

  assert.ok(pages.length > 0, 'Should find at least one table page');

  const weaponPages = pages.filter(p =>
    ['weapon', 'rifle', 'pistol', 'melee'].includes(p.type)
  );
  assert.ok(weaponPages.length > 0, 'Should find weapon table pages');
});

test('T1.2: detectTablePages finds armor tables', () => {
  const { detectTablePages } = require('../scripts/csc-detect-tables');
  const pages = detectTablePages();

  const armorPages = pages.filter(p => p.type === 'armor');
  assert.ok(armorPages.length > 0, 'Should find armor table pages');
});

test('T1.3: page 146 detected as rifle/weapon type', () => {
  const { detectTablePages } = require('../scripts/csc-detect-tables');
  const pages = detectTablePages();

  const page146 = pages.find(p => p.page === 146);
  assert.ok(page146, 'Page 146 should be detected');
  assert.ok(
    ['weapon', 'rifle'].includes(page146.type),
    `Page 146 should be weapon/rifle type, got ${page146.type}`
  );
});

// ============================================================
// T2: Normalization
// ============================================================

test('T2.1: normalizeItem creates valid weapon schema', () => {
  const { normalizeItem } = require('../scripts/csc-validate-merge');
  const { validateEquipment } = require('../src/equipment-validator');

  const raw = {
    name: 'Test Rifle',
    tl: 8,
    cost: 500,
    mass: 3,
    damage: '3D',
    range: '200',
    magazine: 20,
    magazine_cost: 10,
    traits: ['Auto 2'],
    category: 'weapon',
    source_page: 100
  };

  const normalized = normalizeItem(raw);
  const result = validateEquipment(normalized);

  assert.strictEqual(result.valid, true, `Errors: ${result.errors.join(', ')}`);
  assert.strictEqual(normalized.category, 'weapons');
  assert.ok(normalized.weapon_stats, 'Should have weapon_stats');
});

test('T2.2: normalizeItem creates valid armor schema', () => {
  const { normalizeItem } = require('../scripts/csc-validate-merge');
  const { validateEquipment } = require('../src/equipment-validator');

  const raw = {
    name: 'Test Armor',
    tl: 10,
    cost: 1000,
    mass: 5,
    protection: 8,
    rad: 2,
    category: 'armor',
    source_page: 14
  };

  const normalized = normalizeItem(raw);
  const result = validateEquipment(normalized);

  assert.strictEqual(result.valid, true, `Errors: ${result.errors.join(', ')}`);
  assert.strictEqual(normalized.category, 'armor');
  assert.ok(normalized.armor_stats, 'Should have armor_stats');
});

// ============================================================
// T3: TL Variant Handling
// ============================================================

test('T3.1: mergeTLVariants keeps separate entries for different TLs', () => {
  const { mergeTLVariants } = require('../scripts/csc-validate-merge');

  const items = [
    { id: 'rifle-tl5', name: 'Rifle', tl: 5, category: 'weapons' },
    { id: 'rifle-tl7', name: 'Rifle', tl: 7, category: 'weapons' },
    { id: 'pistol-tl6', name: 'Pistol', tl: 6, category: 'weapons' }
  ];

  const merged = mergeTLVariants(items);

  assert.strictEqual(merged.length, 3, 'Should keep all 3 items');

  const rifles = merged.filter(i => i.name === 'Rifle');
  assert.strictEqual(rifles.length, 2, 'Should have 2 rifle variants');
  assert.ok(rifles.every(r => r.has_variants), 'Rifles should be marked as having variants');
});

test('T3.2: deduplicate removes exact duplicates', () => {
  const { deduplicate } = require('../scripts/csc-validate-merge');

  const items = [
    { id: 'rifle-tl5', name: 'Rifle', tl: 5 },
    { id: 'rifle-tl5', name: 'Rifle', tl: 5 },
    { id: 'pistol-tl6', name: 'Pistol', tl: 6 }
  ];

  const deduped = deduplicate(items);

  assert.strictEqual(deduped.length, 2, 'Should have 2 unique items');
});

// ============================================================
// T4: Sample Extraction (requires API key)
// ============================================================

test('T4.1: getSamplePages returns weapon/armor pages', () => {
  const { getSamplePages } = require('../scripts/csc-llm-extract');

  const sample = getSamplePages(5);

  assert.ok(Array.isArray(sample), 'Should return array');
  assert.ok(sample.length > 0, 'Should return at least one page');
  assert.ok(sample.every(p => typeof p === 'number'), 'Should be page numbers');
});

// ============================================================
// T5: Coverage (post-extraction checks)
// ============================================================

test('T5.1: extracted files exist', () => {
  // This test will pass/fail based on whether extraction has been run
  if (!fs.existsSync(EXTRACTED_DIR)) {
    console.log('    (skipped - run extraction first)');
    return;
  }

  const files = fs.readdirSync(EXTRACTED_DIR).filter(f => f.endsWith('.json'));
  assert.ok(files.length > 0, 'Should have at least one extracted file');
});

test('T5.2: validation rate above 80%', () => {
  if (!fs.existsSync(EXTRACTED_DIR)) {
    console.log('    (skipped - run extraction first)');
    return;
  }

  const { loadExtracted, validateAndCategorize } = require('../scripts/csc-validate-merge');
  const items = loadExtracted();

  if (items.length === 0) {
    console.log('    (skipped - no extracted items)');
    return;
  }

  const { valid, invalid } = validateAndCategorize(items);
  const rate = valid.length / items.length * 100;

  assert.ok(rate >= 80, `Validation rate ${rate.toFixed(1)}% should be >= 80%`);
});

// ============================================================
// T6: No Garbage Names
// ============================================================

test('T6.1: item names are reasonable length', () => {
  if (!fs.existsSync(EXTRACTED_DIR)) {
    console.log('    (skipped - run extraction first)');
    return;
  }

  const { loadExtracted } = require('../scripts/csc-validate-merge');
  const items = loadExtracted();

  if (items.length === 0) {
    console.log('    (skipped - no extracted items)');
    return;
  }

  const garbage = items.filter(i => i.name && i.name.length > 50);
  assert.strictEqual(
    garbage.length, 0,
    `Found ${garbage.length} items with names > 50 chars: ${garbage[0]?.name}`
  );
});

test('T6.2: item names do not look like table headers', () => {
  if (!fs.existsSync(EXTRACTED_DIR)) {
    console.log('    (skipped - run extraction first)');
    return;
  }

  const { loadExtracted } = require('../scripts/csc-validate-merge');
  const items = loadExtracted();

  if (items.length === 0) {
    console.log('    (skipped - no extracted items)');
    return;
  }

  // Only flag items where name is ALL CAPS (like actual headers)
  // or contains column header patterns
  const garbage = items.filter(i => {
    if (!i.name) return false;
    // All caps name >6 chars is suspicious (allow short acronyms like APDS, HEAP, P-HUD)
    if (i.name === i.name.toUpperCase() && i.name.length > 6) return true;
    // Contains column headers together
    if (/TL\s+RANGE|MAGAZINE\s+COST|KG\s+COST/.test(i.name)) return true;
    return false;
  });

  assert.strictEqual(
    garbage.length, 0,
    `Found ${garbage.length} items with header-like names: ${garbage[0]?.name}`
  );
});

// ============================================================
// RUN TESTS
// ============================================================

async function runTests() {
  console.log('\n══════════════════════════════════════════');
  console.log('  CSC EXTRACTION TESTS');
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
