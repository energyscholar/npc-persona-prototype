# Auditor Handoff: Equipment Extraction System

**Role:** Auditor document for Generator
**Status:** READY FOR GENERATOR
**Date:** 2026-01-17

---

## Summary

Extract Mongoose Traveller Central Supply Catalogue PDF into structured JSON equipment catalog with strict validation.

**Source PDF:**
```
~/software/traveller-VTT-private/reference/BruceCampaignA/discord-exports/channels/
  Arzosah Naming - Text Channels - spinward-marches [1311122064064778240].json_Files/
  central_supply_catalogue_update_2023-42400.pdf
```

**DANGER:** Large PDF (200+ pages). NEVER read directly with Read tool. Use `pdftotext` CLI.

---

## Prior Work Completed

| Item | Status |
|------|--------|
| Validation tests written | ✅ `tests/equipment-validator.test.js` |
| Schema defined | ✅ See `.claude/plans/central-supply-extraction.md` |
| Weapons check-in tests | ✅ 42/42 passing |
| PC weapons initialization | ✅ Added to adventure-player.js |

---

## Generator Deliverables

### E1: Equipment Validator (`src/equipment-validator.js`)

Tests exist at `tests/equipment-validator.test.js`. Implement to pass all tests.

**Required exports:**
```javascript
module.exports = {
  validateEquipment,  // (item) => { valid: boolean, errors: string[] }
  validateAll         // (items[]) => { total, valid, invalid, errors }
};
```

**Schema (from tests):**
- Required fields: `id`, `name`, `category`, `tl`, `cost`
- Valid categories: `weapons`, `armor`, `survival`, `electronics`, `medical`, `tools`, `vehicles`, `robots`, `software`
- TL range: 0-15
- ID format: kebab-case only
- Weapons require `weapon_stats` with valid range
- Armor requires `armor_stats` with numeric `protection`
- `legality.legal_at_law_level` must be 0-15 if present

### E2: Text Extraction Script (`scripts/extract-csc-text.js`)

```javascript
// Use child_process to run pdftotext
const { execSync } = require('child_process');

// Extract each page to separate file
execSync(`pdftotext -f ${page} -l ${page} -layout "${pdfPath}" "${outputPath}"`);

// Also create combined full-text.txt
```

Output:
- `data/equipment/text/page-001.txt` through `page-NNN.txt`
- `data/equipment/full-text.txt`

### E3: Image Extraction Script (`scripts/extract-csc-images.js`)

```javascript
// Use pdfimages CLI
execSync(`pdfimages -all "${pdfPath}" "${imageDir}/csc"`);
```

Output:
- `data/equipment/images/csc-*.png`
- `data/equipment/images/index.json` with metadata

### E4: Equipment Parser (`scripts/parse-csc-equipment.js`)

Read extracted text files, NOT the PDF. Parse equipment entries.

Output to category files:
- `data/equipment/equipment/weapons-slug.json`
- `data/equipment/equipment/weapons-energy.json`
- `data/equipment/equipment/weapons-melee.json`
- `data/equipment/equipment/armor.json`
- `data/equipment/equipment/survival.json`
- `data/equipment/equipment/electronics.json`
- `data/equipment/equipment/medical.json`
- `data/equipment/equipment/tools.json`

Each file is an array of equipment objects matching the schema.

### E5: Directory Structure

Create:
```
data/equipment/
├── text/           # Extracted text by page
├── images/         # Extracted images
│   └── index.json
├── equipment/      # Parsed JSON by category
├── full-text.txt
└── extraction-log.json
```

---

## Verification

```bash
# 1. Run validator tests (already written)
node tests/equipment-validator.test.js

# 2. Run extraction (creates text files)
node scripts/extract-csc-text.js

# 3. Run image extraction
node scripts/extract-csc-images.js

# 4. Parse to JSON
node scripts/parse-csc-equipment.js

# 5. Validate all parsed equipment
node -e "const v = require('./src/equipment-validator'); const fs = require('fs'); const items = fs.readdirSync('data/equipment/equipment').flatMap(f => JSON.parse(fs.readFileSync('data/equipment/equipment/' + f))); console.log(v.validateAll(items));"
```

All validator tests must pass. Parsed equipment should have <5% validation errors (manual review acceptable for edge cases).

---

## Safety Measures

1. **NEVER** read PDF directly - use pdftotext CLI only
2. Process in batches (10 pages at a time) to avoid memory issues
3. Write frequently - don't buffer entire PDF in memory
4. Log progress to `extraction-log.json`
5. Validate as you go - don't wait until end

---

## Generator Handoff Prompt

```
You are the Generator. Read .claude/plans/equipment-extraction-audit.md.

Deliverables in order:
1. Create src/equipment-validator.js to pass tests/equipment-validator.test.js
2. Create scripts/extract-csc-text.js
3. Create scripts/extract-csc-images.js
4. Create scripts/parse-csc-equipment.js
5. Create data/equipment/ directory structure
6. Run extraction and validate output

Safety: NEVER read PDF directly. Use pdftotext/pdfimages CLI via child_process.

Run: node tests/equipment-validator.test.js after step 1.
Report pass/fail counts after each step.
```
