#!/usr/bin/env node
/**
 * Extract images from Central Supply Catalogue PDF
 * Uses pdfimages CLI - NEVER reads PDF directly
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

const OUTPUT_DIR = path.join(__dirname, '../data/equipment/images');
const INDEX_PATH = path.join(OUTPUT_DIR, 'index.json');
const LOG_PATH = path.join(__dirname, '../data/equipment/extraction-log.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function extractImages(pdfPath, outputDir) {
  try {
    const prefix = path.join(outputDir, 'csc');
    execSync(`pdfimages -all "${pdfPath}" "${prefix}"`, {
      encoding: 'utf8',
      maxBuffer: 100 * 1024 * 1024
    });
    return true;
  } catch (err) {
    console.error('Failed to extract images:', err.message);
    return false;
  }
}

function buildImageIndex(outputDir) {
  const images = [];
  const files = fs.readdirSync(outputDir).filter(f =>
    f.startsWith('csc-') && (f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.ppm'))
  );

  for (const file of files) {
    const filePath = path.join(outputDir, file);
    const stats = fs.statSync(filePath);

    // Extract image number from filename (csc-000.png -> 0)
    const match = file.match(/csc-(\d+)/);
    const imageNum = match ? parseInt(match[1], 10) : null;

    images.push({
      file,
      size: stats.size,
      imageNum,
      format: path.extname(file).slice(1)
    });
  }

  // Sort by image number
  images.sort((a, b) => (a.imageNum || 0) - (b.imageNum || 0));

  return images;
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  CSC IMAGE EXTRACTION                    ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Check PDF exists
  if (!fs.existsSync(PDF_PATH)) {
    console.error(`PDF not found: ${PDF_PATH}`);
    process.exit(1);
  }

  // Ensure output directory
  ensureDir(OUTPUT_DIR);

  // Load existing log if present
  let log = {};
  if (fs.existsSync(LOG_PATH)) {
    log = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  }

  log.imageExtraction = {
    started: new Date().toISOString(),
    source: PDF_PATH
  };

  console.log('Extracting images (this may take a while)...\n');

  // Extract images
  const success = extractImages(PDF_PATH, OUTPUT_DIR);

  if (!success) {
    log.imageExtraction.error = 'extraction failed';
    fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
    process.exit(1);
  }

  // Build index
  console.log('Building image index...');
  const images = buildImageIndex(OUTPUT_DIR);

  const index = {
    generated: new Date().toISOString(),
    source: 'central_supply_catalogue_update_2023.pdf',
    count: images.length,
    images
  };

  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));

  // Update log
  log.imageExtraction.completed = new Date().toISOString();
  log.imageExtraction.imagesExtracted = images.length;
  log.imageExtraction.indexPath = INDEX_PATH;
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));

  console.log(`\n✓ Extraction complete`);
  console.log(`  Images: ${images.length}`);
  console.log(`  Index: ${INDEX_PATH}`);
}

main().catch(err => {
  console.error('Extraction failed:', err);
  process.exit(1);
});
