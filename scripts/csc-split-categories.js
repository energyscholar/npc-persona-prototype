#!/usr/bin/env node
/**
 * Split extracted CSC equipment into proper categories
 * Reads from extracted/full-*.json, writes to data/equipment/*.json
 */

const fs = require('fs');
const path = require('path');

const EQUIPMENT_DIR = path.join(__dirname, '../data/equipment');
const EXTRACTED_DIR = path.join(EQUIPMENT_DIR, 'extracted');

// Category detection patterns
const CATEGORY_RULES = {
  medical: {
    patterns: [/medi/i, /drug/i, /heal/i, /first.?aid/i, /antidote/i, /pharma/i, /surgical/i, /doctor/i, /treatment/i, /diagnosis/i, /resuscitation/i, /life.?support/i, /autodoc/i, /stasis/i, /cryoberth/i],
    keywords: ['medikit', 'autodoc', 'surgical', 'medical', 'antidote', 'drug', 'pharmaceutical']
  },
  electronics: {
    patterns: [/computer/i, /comm\b/i, /radio/i, /sensor/i, /scanner/i, /detector/i, /camera/i, /drone/i, /robot/i, /electronic/i, /holo/i, /display/i, /recorder/i, /transmitter/i, /receiver/i, /jammer/i, /bug/i, /tracker/i, /comms/i, /terminal/i, /neural/i, /interface/i],
    keywords: ['computer', 'comm', 'sensor', 'scanner', 'detector', 'drone', 'robot', 'terminal']
  },
  survival: {
    patterns: [/tent/i, /rope/i, /filter/i, /mask/i, /respirator/i, /breath/i, /oxygen/i, /ration/i, /water/i, /camp/i, /climb/i, /grapple/i, /survival/i, /environment/i, /cold.?weather/i, /heat/i, /arctic/i, /desert/i, /underwater/i, /diving/i, /rebreather/i, /gill/i, /vacc/i, /space.?suit/i, /pressure/i, /rescue/i, /beacon/i, /flare/i, /shelter/i],
    keywords: ['tent', 'rope', 'filter', 'mask', 'survival', 'ration', 'oxygen', 'vacc suit', 'environment']
  }
};

function categorizeItem(item) {
  const name = item.name || '';
  const description = item.description || '';
  const text = `${name} ${description}`.toLowerCase();

  // Check each category
  for (const [category, rules] of Object.entries(CATEGORY_RULES)) {
    // Check patterns
    for (const pattern of rules.patterns) {
      if (pattern.test(name) || pattern.test(description)) {
        return category;
      }
    }
  }

  // Default to tools
  return 'tools';
}

function splitCategories(inputFile) {
  console.log(`Reading ${inputFile}...`);
  const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  console.log(`Loaded ${data.length} items`);

  // Initialize category buckets
  const categories = {
    armor: [],
    weapons: [],
    ammunition: [],
    augments: [],
    software: [],
    medical: [],
    electronics: [],
    survival: [],
    tools: []
  };

  // Sort items into categories
  for (const item of data) {
    const cat = item.category?.toLowerCase() || 'equipment';

    if (cat === 'armor') {
      categories.armor.push(item);
    } else if (cat === 'weapon') {
      categories.weapons.push(item);
    } else if (cat === 'ammunition') {
      categories.ammunition.push(item);
    } else if (cat === 'augment') {
      categories.augments.push(item);
    } else if (cat === 'software') {
      categories.software.push(item);
    } else if (cat === 'equipment') {
      // Split equipment into subcategories
      const subcat = categorizeItem(item);
      item.category = subcat; // Update the item's category
      categories[subcat].push(item);
    } else {
      // Unknown category goes to tools
      item.category = 'tools';
      categories.tools.push(item);
    }
  }

  // Write category files
  console.log('\nWriting category files:');
  let total = 0;
  for (const [category, items] of Object.entries(categories)) {
    if (items.length > 0) {
      const outPath = path.join(EQUIPMENT_DIR, `${category}.json`);
      fs.writeFileSync(outPath, JSON.stringify(items, null, 2));
      console.log(`  ${category}.json: ${items.length} items`);
      total += items.length;
    }
  }

  console.log(`\nTotal: ${total} items written`);
  return categories;
}

// Find most recent extraction file
function findLatestExtraction() {
  const files = fs.readdirSync(EXTRACTED_DIR)
    .filter(f => f.startsWith('full-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error('No extraction files found in ' + EXTRACTED_DIR);
  }

  return path.join(EXTRACTED_DIR, files[0]);
}

// Main (when run directly)
if (require.main === module) {
  const inputFile = process.argv[2] || findLatestExtraction();
  console.log('CSC Category Splitter\n');
  splitCategories(inputFile);
}

module.exports = { splitCategories, categorizeItem, CATEGORY_RULES };
