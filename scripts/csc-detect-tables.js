#!/usr/bin/env node
/**
 * CSC Table Detection - Find pages containing equipment tables
 * Uses regex patterns to detect table headers
 */

const fs = require('fs');
const path = require('path');

const TEXT_DIR = path.join(__dirname, '../data/equipment/text');

const TABLE_PATTERNS = {
  weapon: [
    /^WEAPON\s+TL\s+RANGE/im,
    /^WEAPON\s+TL\s+DAMAGE/im,
    /TL\s+RANGE\s+DAMAGE\s+KG\s+COST/im
  ],
  armor: [
    /^ARMOU?R\s+TYPE\s+PROTECTION/im,
    /^ARMOU?R\s+TL\s+PROTECTION/im,
    /PROTECTION\s+TL\s+RAD\s+KG/im
  ],
  survival: [
    /^SURVIVAL\s+EQUIPMENT/im,
    /^Item\s+TL\s+Effect/im,
    /^EQUIPMENT\s+TL\s+KG\s+COST/im
  ],
  electronics: [
    /^ELECTRONICS/im,
    /^COMPUTERS?\s+TL/im,
    /^COMMS?\s+TL/im
  ],
  medical: [
    /^MEDICAL\s+/im,
    /^DRUGS?\s+TL/im
  ],
  melee: [
    /^MELEE\s+WEAPONS?/im,
    /^BLADE\s+TL/im
  ],
  pistol: [
    /^SLUG\s+PISTOLS?/im,
    /^ENERGY\s+PISTOLS?/im
  ],
  rifle: [
    /^SLUG\s+RIFLES?/im,
    /^ENERGY\s+RIFLES?/im,
    /^LASER\s+WEAPONS?/im
  ]
};

/**
 * Detect table type from page content
 * @param {string} content - Page text content
 * @returns {string|null} Table type or null
 */
function detectTableType(content) {
  for (const [type, patterns] of Object.entries(TABLE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        return type;
      }
    }
  }
  return null;
}

/**
 * Check if page has tabular data (numeric columns)
 * @param {string} content - Page text content
 * @returns {boolean}
 */
function hasTabularData(content) {
  // Look for lines with multiple space-separated numbers (TL, cost, etc.)
  const lines = content.split('\n');
  let numericLines = 0;

  for (const line of lines) {
    // Pattern: word followed by number, then more numbers
    if (/\w+\s+\d+\s+\d+/.test(line) || /Cr\d+/.test(line)) {
      numericLines++;
    }
  }

  return numericLines >= 3;
}

/**
 * Scan all pages and detect table types
 * @returns {Object[]} Array of { page, file, type, hasData }
 */
function detectTablePages() {
  const results = [];

  if (!fs.existsSync(TEXT_DIR)) {
    console.error(`Text directory not found: ${TEXT_DIR}`);
    return results;
  }

  const files = fs.readdirSync(TEXT_DIR)
    .filter(f => f.startsWith('page-') && f.endsWith('.txt'))
    .sort();

  for (const file of files) {
    const pageNum = parseInt(file.match(/page-(\d+)/)?.[1] || '0', 10);
    const content = fs.readFileSync(path.join(TEXT_DIR, file), 'utf8');

    const type = detectTableType(content);
    const hasData = hasTabularData(content);

    if (type || hasData) {
      results.push({
        page: pageNum,
        file,
        type: type || 'unknown',
        hasData
      });
    }
  }

  return results;
}

/**
 * Get pages by type
 * @param {string} type - Table type to filter
 * @returns {Object[]}
 */
function getPagesByType(type) {
  return detectTablePages().filter(p => p.type === type);
}

/**
 * Get summary of detected tables
 * @returns {Object}
 */
function getSummary() {
  const pages = detectTablePages();
  const byType = {};

  for (const p of pages) {
    byType[p.type] = (byType[p.type] || 0) + 1;
  }

  return {
    totalPages: pages.length,
    byType,
    pages
  };
}

// CLI execution
if (require.main === module) {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  CSC TABLE DETECTION                     ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const summary = getSummary();

  console.log(`Found ${summary.totalPages} pages with tables:\n`);

  for (const [type, count] of Object.entries(summary.byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count} pages`);
  }

  console.log('\nPages by type:');
  for (const [type, count] of Object.entries(summary.byType)) {
    const pages = summary.pages.filter(p => p.type === type).map(p => p.page);
    console.log(`  ${type}: [${pages.slice(0, 10).join(', ')}${pages.length > 10 ? '...' : ''}]`);
  }

  // Write results to file
  const outputPath = path.join(__dirname, '../data/equipment/table-pages.json');
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
  console.log(`\n✓ Results saved to ${outputPath}`);
}

module.exports = {
  detectTableType,
  detectTablePages,
  getPagesByType,
  getSummary,
  TABLE_PATTERNS
};
