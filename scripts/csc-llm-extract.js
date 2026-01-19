#!/usr/bin/env node
/**
 * CSC LLM Extraction - Use Haiku to parse equipment tables
 * Reads extracted text, NOT the PDF directly
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { createClient, chat, HAIKU_MODEL } = require('../src/ai-client');
const { detectTablePages } = require('./csc-detect-tables');

const TEXT_DIR = path.join(__dirname, '../data/equipment/text');
const OUTPUT_DIR = path.join(__dirname, '../data/equipment/extracted');

const EXTRACTION_PROMPT = `Extract all equipment items from this page. Return ONLY a JSON array.

Each item must have these fields:
- name: string (exact name from table, no TL suffix)
- tl: number (tech level)
- cost: number (in credits, parse "Cr500" as 500)
- mass: number (in kg, parse "—" as 0)
- source_page: number

For WEAPONS also include:
- category: "weapon"
- damage: string (e.g., "3D", "4D+2", "3D-3")
- range: string or number (e.g., "250", "Melee", "Pistol")
- magazine: number (if applicable, 0 if none)
- magazine_cost: number (if applicable, 0 if none)
- traits: string[] (e.g., ["Auto 3", "Scope", "AP 5"])

For ARMOR also include:
- category: "armor"
- protection: number (the +N value)
- rad: number (radiation protection, 0 if —)

For OTHER equipment:
- category: "equipment"
- effect: string (brief description if available)

RULES:
- Extract EVERY item from the table, including TL variants on continuation lines
- If an item has multiple TL versions, create separate entries for each
- Skip prose descriptions and headers
- Traits may wrap to next line - include all of them
- Return valid JSON array only, no markdown

Page content:
---
`;

/**
 * Extract equipment from a single page using LLM
 * @param {Object} client - Anthropic client
 * @param {number} pageNum - Page number
 * @returns {Object[]} Extracted items
 */
async function extractPage(client, pageNum) {
  const paddedPage = String(pageNum).padStart(3, '0');
  const filePath = path.join(TEXT_DIR, `page-${paddedPage}.txt`);

  if (!fs.existsSync(filePath)) {
    console.error(`Page file not found: ${filePath}`);
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const prompt = EXTRACTION_PROMPT + content + '\n---';

  try {
    const response = await chat(client, prompt, [
      { role: 'user', content: 'Extract all equipment items as JSON array.' }
    ], {
      model: HAIKU_MODEL,
      maxTokens: 4000
    });

    // Parse JSON from response
    const text = response.content.trim();

    // Try to extract JSON array from response
    let jsonStart = text.indexOf('[');
    let jsonEnd = text.lastIndexOf(']');

    if (jsonStart === -1 || jsonEnd === -1) {
      console.warn(`  No JSON array found in response for page ${pageNum}`);
      return [];
    }

    const jsonStr = text.slice(jsonStart, jsonEnd + 1);
    const items = JSON.parse(jsonStr);

    // Add source_page to all items
    return items.map(item => ({
      ...item,
      source_page: pageNum
    }));

  } catch (err) {
    console.error(`  Error extracting page ${pageNum}: ${err.message}`);
    return [];
  }
}

/**
 * Extract equipment from multiple pages
 * @param {Object} client - Anthropic client
 * @param {number[]} pages - Page numbers to process
 * @param {Object} options - Options
 * @returns {Object[]} All extracted items
 */
async function extractPages(client, pages, options = {}) {
  const { verbose = true, delay = 500 } = options;
  const allItems = [];

  for (let i = 0; i < pages.length; i++) {
    const pageNum = pages[i];
    if (verbose) {
      process.stdout.write(`  Extracting page ${pageNum}... `);
    }

    const items = await extractPage(client, pageNum);
    allItems.push(...items);

    if (verbose) {
      console.log(`${items.length} items`);
    }

    // Rate limiting delay
    if (i < pages.length - 1 && delay > 0) {
      await new Promise(r => setTimeout(r, delay));
    }
  }

  return allItems;
}

/**
 * Get sample pages for testing
 * @param {number} count - Number of pages to sample
 * @returns {number[]} Page numbers
 */
function getSamplePages(count = 10) {
  const detected = detectTablePages();
  // Get pages with actual data, prioritize weapons/armor
  const priority = detected.filter(p =>
    ['weapon', 'armor', 'rifle', 'pistol', 'melee'].includes(p.type)
  );

  const sample = priority.slice(0, count);
  return sample.map(p => p.page);
}

/**
 * Save extracted items to file
 * @param {Object[]} items - Extracted items
 * @param {string} filename - Output filename
 */
function saveItems(items, filename) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outputPath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(outputPath, JSON.stringify(items, null, 2));
  return outputPath;
}

// CLI execution
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  CSC LLM EXTRACTION                      ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Parse CLI args
  const args = process.argv.slice(2);
  const sampleMode = args.includes('--sample');
  const fullMode = args.includes('--full');
  const pagesArg = args.find(a => a.startsWith('--pages='));

  let pagesToProcess = [];

  if (pagesArg) {
    // Process specific pages
    pagesToProcess = pagesArg.split('=')[1].split(',').map(Number);
  } else if (sampleMode) {
    // Sample mode: 10 pages
    pagesToProcess = getSamplePages(10);
  } else if (fullMode) {
    // Full mode: all detected table pages
    pagesToProcess = detectTablePages().map(p => p.page);
  } else {
    // Default: sample mode
    console.log('Usage:');
    console.log('  --sample         Extract from 10 sample pages');
    console.log('  --full           Extract from all table pages');
    console.log('  --pages=1,2,3    Extract from specific pages');
    console.log('\nRunning sample extraction...\n');
    pagesToProcess = getSamplePages(10);
  }

  console.log(`Processing ${pagesToProcess.length} pages: [${pagesToProcess.slice(0, 5).join(', ')}${pagesToProcess.length > 5 ? '...' : ''}]\n`);

  // Create client
  let client;
  try {
    client = createClient();
  } catch (err) {
    console.error('Failed to create API client:', err.message);
    process.exit(1);
  }

  // Extract
  const items = await extractPages(client, pagesToProcess);

  console.log(`\n✓ Extracted ${items.length} items from ${pagesToProcess.length} pages`);

  // Categorize
  const byCategory = {};
  for (const item of items) {
    const cat = item.category || 'unknown';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }

  console.log('\nBy category:');
  for (const [cat, count] of Object.entries(byCategory)) {
    console.log(`  ${cat}: ${count}`);
  }

  // Save
  const timestamp = new Date().toISOString().slice(0, 10);
  const outputFile = sampleMode || !fullMode
    ? `sample-${timestamp}.json`
    : `full-${timestamp}.json`;

  const outputPath = saveItems(items, outputFile);
  console.log(`\n✓ Saved to ${outputPath}`);

  // Split into category files for full extractions
  if (fullMode && items.length > 0) {
    console.log('\nSplitting into category files...');
    try {
      const { splitCategories } = require('./csc-split-categories');
      if (typeof splitCategories === 'function') {
        splitCategories(outputPath);
      } else {
        // Run as subprocess if not exported as function
        const { execSync } = require('child_process');
        execSync(`node ${path.join(__dirname, 'csc-split-categories.js')} "${outputPath}"`, { stdio: 'inherit' });
      }
    } catch (err) {
      console.log('  (Split script not available, run manually: node scripts/csc-split-categories.js)');
    }
  }

  // Return for module use
  return { items, byCategory };
}

if (require.main === module) {
  main().catch(err => {
    console.error('Extraction failed:', err);
    process.exit(1);
  });
}

module.exports = {
  extractPage,
  extractPages,
  getSamplePages,
  saveItems,
  EXTRACTION_PROMPT
};
