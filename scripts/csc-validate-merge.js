#!/usr/bin/env node
/**
 * CSC Validate & Merge - Validate extracted items and deduplicate
 */

const fs = require('fs');
const path = require('path');
const { validateEquipment, VALID_CATEGORIES } = require('../src/equipment-validator');

const EXTRACTED_DIR = path.join(__dirname, '../data/equipment/extracted');
const OUTPUT_DIR = path.join(__dirname, '../data/equipment/equipment');
const REVIEW_PATH = path.join(__dirname, '../data/equipment/review-queue.json');

/**
 * Convert numeric range to string range category
 * @param {string|number} range - Raw range value
 * @returns {string} Range category
 */
function normalizeRange(range) {
  // If already a valid string range, return as-is
  const validRanges = ['Melee', 'Thrown', 'Pistol', 'Shotgun', 'Assault Weapon', 'Rifle', 'Rocket', 'Distant'];
  if (typeof range === 'string' && validRanges.includes(range)) {
    return range;
  }

  // Convert numeric range to category
  const num = parseInt(range, 10);
  if (isNaN(num) || num <= 0) return 'Melee';
  if (num <= 20) return 'Melee';
  if (num <= 50) return 'Shotgun';
  if (num <= 100) return 'Pistol';
  if (num <= 250) return 'Assault Weapon';
  if (num <= 600) return 'Rifle';
  return 'Distant';
}

/**
 * Convert LLM extracted item to validator schema
 * @param {Object} item - Raw extracted item
 * @returns {Object} Normalized item
 */
function normalizeItem(item) {
  const normalized = {
    id: toKebabCase(item.name) + (item.tl ? `-tl${item.tl}` : ''),
    name: item.name,
    tl: parseInt(item.tl, 10) || 0,
    cost: parseInt(item.cost, 10) || 0,
    mass: parseFloat(item.mass) || 0,
    source: { book: 'CSC', page: item.source_page }
  };

  // Determine category - check name patterns first for better classification
  const nameLower = (item.name || '').toLowerCase();

  // Armor patterns: vacc suit, battle dress, flak, cloth armor, etc.
  const isArmor = item.category === 'armor' ||
    item.protection !== undefined ||
    /vacc\s*suit|battle\s*dress|flak|armou?r|carapace|combat\s*environment|mesh|jack\b|cloth\b.*armou?r/i.test(nameLower);

  // Survival patterns: filter, respirator, mask, tent, rations, etc.
  const isSurvival = /filter|respirator|mask|tent|ration|survival|oxygen|environment|canteen|water\s*purif/i.test(nameLower);

  // Medical patterns
  const isMedical = /medkit|medikit|drug|medical|autodoc|stim|antidote|first\s*aid/i.test(nameLower);

  // Electronics patterns
  const isElectronics = /computer|comm|scanner|sensor|detector|transceiver|radio|densitometer/i.test(nameLower);

  if (item.category === 'weapon' || item.damage) {
    normalized.category = 'weapons';
    normalized.weapon_stats = {
      damage: item.damage || '1D',
      range: normalizeRange(item.range),
      magazine: parseInt(item.magazine, 10) || 0,
      magazine_cost: parseInt(item.magazine_cost, 10) || 0,
      traits: Array.isArray(item.traits) ? item.traits : []
    };

    // Determine subcategory from traits/range
    if (item.range === 'Melee' || normalized.weapon_stats.range === 'Melee') {
      normalized.subcategory = 'melee';
    } else if (parseInt(item.range, 10) <= 50) {
      normalized.subcategory = 'pistol';
    } else {
      normalized.subcategory = 'rifle';
    }
  } else if (isArmor) {
    normalized.category = 'armor';
    normalized.armor_stats = {
      protection: parseInt(item.protection, 10) || 0,
      rad: parseInt(item.rad, 10) || 0,
      traits: []
    };
  } else if (isSurvival) {
    normalized.category = 'survival';
  } else if (isMedical) {
    normalized.category = 'medical';
  } else if (isElectronics) {
    normalized.category = 'electronics';
  } else {
    // Default to equipment
    normalized.category = item.category || 'tools';
    if (!VALID_CATEGORIES.includes(normalized.category)) {
      normalized.category = 'tools';
    }
  }

  return normalized;
}

/**
 * Convert name to kebab-case
 */
function toKebabCase(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Validate and categorize items
 * @param {Object[]} items - Raw extracted items
 * @returns {Object} { valid: Object[], invalid: Object[], byCategory: Object }
 */
function validateAndCategorize(items) {
  const valid = [];
  const invalid = [];
  const byCategory = {};

  for (const raw of items) {
    const normalized = normalizeItem(raw);
    const result = validateEquipment(normalized);

    if (result.valid) {
      valid.push(normalized);

      const cat = normalized.category;
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(normalized);
    } else {
      invalid.push({
        original: raw,
        normalized,
        errors: result.errors
      });
    }
  }

  return { valid, invalid, byCategory };
}

/**
 * Deduplicate items by id
 * @param {Object[]} items - Items to deduplicate
 * @returns {Object[]} Unique items (keeps first occurrence)
 */
function deduplicate(items) {
  const seen = new Map();

  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.set(item.id, item);
    }
  }

  return [...seen.values()];
}

/**
 * Merge TL variants into single item with variants array
 * @param {Object[]} items - Items that may have TL variants
 * @returns {Object[]} Items with variants merged
 */
function mergeTLVariants(items) {
  const byBaseName = new Map();

  for (const item of items) {
    // Extract base name (without TL suffix in id)
    const baseName = item.name;
    const existing = byBaseName.get(baseName);

    if (!existing) {
      byBaseName.set(baseName, [item]);
    } else {
      existing.push(item);
    }
  }

  // For items with multiple TL versions, keep them separate but note the relationship
  const result = [];
  for (const [name, variants] of byBaseName) {
    if (variants.length === 1) {
      result.push(variants[0]);
    } else {
      // Sort by TL, add all as separate items
      variants.sort((a, b) => a.tl - b.tl);
      for (const v of variants) {
        v.has_variants = true;
        v.variant_count = variants.length;
        result.push(v);
      }
    }
  }

  return result;
}

/**
 * Load all extracted JSON files
 * @returns {Object[]} All extracted items
 */
function loadExtracted() {
  if (!fs.existsSync(EXTRACTED_DIR)) {
    return [];
  }

  const items = [];
  const files = fs.readdirSync(EXTRACTED_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(EXTRACTED_DIR, file), 'utf8'));
    if (Array.isArray(data)) {
      items.push(...data);
    }
  }

  return items;
}

/**
 * Save validated items by category
 * @param {Object} byCategory - Items grouped by category
 */
function saveByCategory(byCategory) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const [category, items] of Object.entries(byCategory)) {
    const filename = `${category}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(items, null, 2));
    console.log(`  ${category}: ${items.length} items -> ${filename}`);
  }
}

/**
 * Save invalid items to review queue
 * @param {Object[]} invalid - Invalid items with errors
 */
function saveReviewQueue(invalid) {
  fs.writeFileSync(REVIEW_PATH, JSON.stringify(invalid, null, 2));
  console.log(`  Review queue: ${invalid.length} items -> review-queue.json`);
}

// CLI execution
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  CSC VALIDATE & MERGE                    ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Load extracted items
  const raw = loadExtracted();
  console.log(`Loaded ${raw.length} extracted items\n`);

  if (raw.length === 0) {
    console.log('No extracted items found. Run csc-llm-extract.js first.');
    return;
  }

  // Validate and categorize
  const { valid, invalid, byCategory } = validateAndCategorize(raw);

  console.log('Validation results:');
  console.log(`  Valid: ${valid.length}`);
  console.log(`  Invalid: ${invalid.length}`);
  console.log(`  Rate: ${(valid.length / raw.length * 100).toFixed(1)}%\n`);

  // Deduplicate
  const deduped = deduplicate(valid);
  console.log(`After deduplication: ${deduped.length} unique items`);

  // Merge TL variants
  const merged = mergeTLVariants(deduped);
  const withVariants = merged.filter(i => i.has_variants).length;
  console.log(`Items with TL variants: ${withVariants}\n`);

  // Re-categorize after merge
  const finalByCategory = {};
  for (const item of merged) {
    const cat = item.category;
    if (!finalByCategory[cat]) finalByCategory[cat] = [];
    finalByCategory[cat].push(item);
  }

  // Save
  console.log('Saving:');
  saveByCategory(finalByCategory);
  if (invalid.length > 0) {
    saveReviewQueue(invalid);
  }

  console.log('\n✓ Validation complete');

  return {
    total: raw.length,
    valid: valid.length,
    invalid: invalid.length,
    unique: merged.length,
    rate: (valid.length / raw.length * 100).toFixed(1)
  };
}

if (require.main === module) {
  main().catch(err => {
    console.error('Validation failed:', err);
    process.exit(1);
  });
}

module.exports = {
  normalizeItem,
  validateAndCategorize,
  deduplicate,
  mergeTLVariants,
  loadExtracted
};
