#!/usr/bin/env node
/**
 * Parse extracted CSC text into structured equipment JSON
 * Reads from data/equipment/text/ - NEVER reads PDF directly
 */

const fs = require('fs');
const path = require('path');
const { validateEquipment } = require('../src/equipment-validator');

const TEXT_DIR = path.join(__dirname, '../data/equipment/text');
const OUTPUT_DIR = path.join(__dirname, '../data/equipment/equipment');
const LOG_PATH = path.join(__dirname, '../data/equipment/extraction-log.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function toKebabCase(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Parse a weapon entry from text
 */
function parseWeaponLine(line, subcategory, page) {
  // Common patterns: Name TL Range Damage Kg Cost Magazine
  const patterns = [
    // Pattern: Name TL Range Damage Kg Cost Mag MagCost Traits
    /^(.+?)\s+(\d+)\s+(Melee|Pistol|Shotgun|Rifle|Assault Weapon|Rocket|Distant)\s+(\d+D[+-]?\d*)\s+([\d.]+)\s+Cr(\d+)/i
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      const name = match[1].trim();
      return {
        id: toKebabCase(name) + '-tl' + match[2],
        name,
        category: 'weapons',
        subcategory,
        tl: parseInt(match[2], 10),
        cost: parseInt(match[6], 10),
        mass: parseFloat(match[5]),
        source: { book: 'CSC', page },
        weapon_stats: {
          damage: match[4],
          range: match[3],
          traits: []
        }
      };
    }
  }
  return null;
}

/**
 * Parse an armor entry from text
 */
function parseArmorLine(line, page) {
  // Pattern: Name TL Protection Rad Kg Cost
  const pattern = /^(.+?)\s+(\d+)\s+\+(\d+)\s+(\d+)\s+([\d.]+)\s+Cr(\d+)/i;
  const match = line.match(pattern);

  if (match) {
    const name = match[1].trim();
    return {
      id: toKebabCase(name),
      name,
      category: 'armor',
      subcategory: 'body-armor',
      tl: parseInt(match[2], 10),
      cost: parseInt(match[6], 10),
      mass: parseFloat(match[5]),
      source: { book: 'CSC', page },
      armor_stats: {
        protection: parseInt(match[3], 10),
        rad: parseInt(match[4], 10),
        traits: []
      }
    };
  }
  return null;
}

/**
 * Parse survival/electronics/medical equipment
 */
function parseGeneralEquipment(line, category, page) {
  // Pattern: Name TL Kg Cost
  const pattern = /^(.+?)\s+(\d+)\s+([\d.]+)\s+Cr(\d+)/i;
  const match = line.match(pattern);

  if (match) {
    const name = match[1].trim();
    return {
      id: toKebabCase(name),
      name,
      category,
      tl: parseInt(match[2], 10),
      cost: parseInt(match[4], 10),
      mass: parseFloat(match[3]),
      source: { book: 'CSC', page }
    };
  }
  return null;
}

/**
 * Detect section from page content
 */
function detectSection(content) {
  const lower = content.toLowerCase();

  if (lower.includes('slug pistol') || lower.includes('slug rifle')) return 'weapons-slug';
  if (lower.includes('energy pistol') || lower.includes('laser')) return 'weapons-energy';
  if (lower.includes('blade') || lower.includes('melee')) return 'weapons-melee';
  if (lower.includes('armor') || lower.includes('vacc suit')) return 'armor';
  if (lower.includes('survival') || lower.includes('respirator')) return 'survival';
  if (lower.includes('electronics') || lower.includes('comms')) return 'electronics';
  if (lower.includes('medical') || lower.includes('medikit')) return 'medical';
  if (lower.includes('tool')) return 'tools';

  return null;
}

/**
 * Parse a single page file
 */
function parsePage(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const pageNum = parseInt(path.basename(filePath).match(/page-(\d+)/)?.[1] || '0', 10);
  const section = detectSection(content);
  const items = [];

  if (!section) return { section: null, items: [] };

  const lines = content.split('\n').filter(l => l.trim());

  for (const line of lines) {
    let item = null;

    if (section.startsWith('weapons')) {
      item = parseWeaponLine(line, section.replace('weapons-', ''), pageNum);
    } else if (section === 'armor') {
      item = parseArmorLine(line, pageNum);
    } else {
      const category = section === 'survival' ? 'survival' :
                       section === 'electronics' ? 'electronics' :
                       section === 'medical' ? 'medical' : 'tools';
      item = parseGeneralEquipment(line, category, pageNum);
    }

    if (item) {
      const validation = validateEquipment(item);
      if (validation.valid) {
        items.push(item);
      }
    }
  }

  return { section, items };
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  CSC EQUIPMENT PARSER                    ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Check text directory exists
  if (!fs.existsSync(TEXT_DIR)) {
    console.error(`Text directory not found: ${TEXT_DIR}`);
    console.error('Run extract-csc-text.js first');
    process.exit(1);
  }

  ensureDir(OUTPUT_DIR);

  // Load existing log
  let log = {};
  if (fs.existsSync(LOG_PATH)) {
    log = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  }

  log.parsing = {
    started: new Date().toISOString()
  };

  // Get all page files
  const pageFiles = fs.readdirSync(TEXT_DIR)
    .filter(f => f.startsWith('page-') && f.endsWith('.txt'))
    .sort();

  console.log(`Found ${pageFiles.length} page files\n`);

  // Collect items by category
  const categories = {
    'weapons-slug': [],
    'weapons-energy': [],
    'weapons-melee': [],
    'armor': [],
    'survival': [],
    'electronics': [],
    'medical': [],
    'tools': []
  };

  let totalItems = 0;

  // Process pages in batches
  for (let i = 0; i < pageFiles.length; i += 10) {
    const batch = pageFiles.slice(i, i + 10);
    console.log(`Processing pages ${i + 1}-${Math.min(i + 10, pageFiles.length)}...`);

    for (const file of batch) {
      const filePath = path.join(TEXT_DIR, file);
      const { section, items } = parsePage(filePath);

      if (section && categories[section]) {
        categories[section].push(...items);
        totalItems += items.length;
      }
    }
  }

  // Write category files
  console.log('\nWriting category files...');
  const outputFiles = [];

  for (const [category, items] of Object.entries(categories)) {
    if (items.length > 0) {
      // Deduplicate by id
      const unique = [...new Map(items.map(i => [i.id, i])).values()];
      const outputPath = path.join(OUTPUT_DIR, `${category}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(unique, null, 2));
      outputFiles.push({ category, count: unique.length, file: `${category}.json` });
      console.log(`  ${category}: ${unique.length} items`);
    }
  }

  // Update log
  log.parsing.completed = new Date().toISOString();
  log.parsing.totalItems = totalItems;
  log.parsing.outputFiles = outputFiles;
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));

  console.log(`\n✓ Parsing complete`);
  console.log(`  Total items: ${totalItems}`);
  console.log(`  Output: ${OUTPUT_DIR}`);
}

main().catch(err => {
  console.error('Parsing failed:', err);
  process.exit(1);
});
