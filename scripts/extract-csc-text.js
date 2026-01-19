#!/usr/bin/env node
/**
 * Extract text from Central Supply Catalogue PDF
 * Uses pdftotext CLI - NEVER reads PDF directly
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PDF_PATH = path.join(
  process.env.HOME,
  'software/traveller-VTT-private/reference/BruceCampaignA/discord-exports/channels',
  'Arzosah Naming - Text Channels - spinward-marches [1311122064064778240].json_Files',
  'central_supply_catalogue_update_2023-42400.pdf'
);

const OUTPUT_DIR = path.join(__dirname, '../data/equipment/text');
const FULL_TEXT_PATH = path.join(__dirname, '../data/equipment/full-text.txt');
const LOG_PATH = path.join(__dirname, '../data/equipment/extraction-log.json');

const BATCH_SIZE = 10;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getPageCount(pdfPath) {
  try {
    const result = execSync(`pdfinfo "${pdfPath}" | grep Pages`, { encoding: 'utf8' });
    const match = result.match(/Pages:\s+(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  } catch (err) {
    console.error('Failed to get page count:', err.message);
    return 0;
  }
}

function extractPage(pdfPath, pageNum, outputPath) {
  try {
    execSync(`pdftotext -f ${pageNum} -l ${pageNum} -layout "${pdfPath}" "${outputPath}"`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    });
    return true;
  } catch (err) {
    console.error(`Failed to extract page ${pageNum}:`, err.message);
    return false;
  }
}

function extractFullText(pdfPath, outputPath) {
  try {
    execSync(`pdftotext -layout "${pdfPath}" "${outputPath}"`, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024
    });
    return true;
  } catch (err) {
    console.error('Failed to extract full text:', err.message);
    return false;
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  CSC TEXT EXTRACTION                     ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Check PDF exists
  if (!fs.existsSync(PDF_PATH)) {
    console.error(`PDF not found: ${PDF_PATH}`);
    process.exit(1);
  }

  // Ensure output directories
  ensureDir(OUTPUT_DIR);
  ensureDir(path.dirname(LOG_PATH));

  const log = {
    started: new Date().toISOString(),
    source: PDF_PATH,
    pages: [],
    errors: []
  };

  // Get page count
  const pageCount = getPageCount(PDF_PATH);
  if (pageCount === 0) {
    console.error('Could not determine page count');
    process.exit(1);
  }
  console.log(`PDF has ${pageCount} pages\n`);
  log.totalPages = pageCount;

  // Extract pages in batches
  let extracted = 0;
  for (let batch = 0; batch < Math.ceil(pageCount / BATCH_SIZE); batch++) {
    const start = batch * BATCH_SIZE + 1;
    const end = Math.min((batch + 1) * BATCH_SIZE, pageCount);

    console.log(`Extracting pages ${start}-${end}...`);

    for (let page = start; page <= end; page++) {
      const paddedPage = String(page).padStart(3, '0');
      const outputPath = path.join(OUTPUT_DIR, `page-${paddedPage}.txt`);

      const success = extractPage(PDF_PATH, page, outputPath);
      if (success) {
        extracted++;
        log.pages.push({ page, file: `page-${paddedPage}.txt` });
      } else {
        log.errors.push({ page, error: 'extraction failed' });
      }
    }

    // Write log after each batch
    fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
  }

  console.log(`\nExtracted ${extracted}/${pageCount} pages`);

  // Extract full text
  console.log('\nExtracting full text...');
  if (extractFullText(PDF_PATH, FULL_TEXT_PATH)) {
    log.fullText = FULL_TEXT_PATH;
    console.log('Full text extracted');
  }

  // Finalize log
  log.completed = new Date().toISOString();
  log.pagesExtracted = extracted;
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));

  console.log(`\n✓ Extraction complete`);
  console.log(`  Pages: ${OUTPUT_DIR}`);
  console.log(`  Full text: ${FULL_TEXT_PATH}`);
  console.log(`  Log: ${LOG_PATH}`);
}

main().catch(err => {
  console.error('Extraction failed:', err);
  process.exit(1);
});
