# Audit Plan: CSC Equipment Extraction v2

**Role:** Auditor
**Status:** READY FOR GENERATOR
**Date:** 2026-01-18

---

## Problem Analysis

### Why v1 Failed (~9% success)

1. **Simple regex assumes single-line entries**
   - Reality: Items like "Advanced Combat Rifle" span multiple lines
   - Reality: TL variants appear on continuation lines

2. **Range pattern too restrictive**
   - Parser expects: `Melee|Pistol|Rifle|...`
   - Reality: Numeric ranges like `250`, `400`, `1000`

3. **No handling of table headers**
   - Parser matches any line with numbers
   - Captures prose fragments as equipment

4. **No multi-column table support**
   - Weapons have: Magazine, Magazine Cost, Traits
   - Survival gear has: Effect column (prose)

### Text Extraction Quality

Text extraction is actually good. Sample from page 146:
```
WEAPON                  TL RANGE DAMAGE KG COST    MAGAZINE MAGAZINE COST TRAITS
Accelerator Rifle       9    250   3D    2  Cr900   15       Cr30         Zero-G
                        11   400   3D    2  Cr1500  20       Cr40         Zero-G
```

Problem is parsing, not extraction.

---

## New Strategy: LLM-Assisted Parsing

Use Claude Haiku to parse each page. LLM can:
- Understand table structure from context
- Handle multi-line entries
- Distinguish prose from data
- Extract all columns including traits

### Cost Estimate

- 186 pages × ~2000 tokens/page = ~372K input tokens
- Output: ~500 tokens/page = ~93K output tokens
- Haiku: ~$0.10 | Sonnet: ~$1.50 | Budget: $5

Start with Haiku. If quality is poor, upgrade to Sonnet.

---

## Implementation Plan

### Phase 1: Table Detection (Regex)

Identify pages that contain equipment tables by detecting header patterns:

```javascript
const TABLE_HEADERS = [
  /^WEAPON\s+TL\s+RANGE/i,
  /^ARMOR\s+TL\s+PROTECTION/i,
  /^Item\s+TL\s+Effect/i,
  /^EQUIPMENT\s+TL\s+/i
];
```

Output: List of pages with tables + table type

### Phase 2: LLM Extraction (Haiku)

For each table page, send to Haiku with structured prompt:

```
Extract all equipment items from this table. Return JSON array.

Each item must have:
- name: string (exact name from table)
- tl: number
- cost: number (in credits, parse "Cr500" as 500)
- mass: number (in kg)
- source_page: number

For weapons, also include:
- damage: string (e.g., "3D", "4D+2")
- range: string or number
- magazine: number (if applicable)
- magazine_cost: number (if applicable)
- traits: string[] (e.g., ["Auto 3", "Scope"])

For armor, also include:
- protection: number
- rad: number (radiation protection)

Skip any prose descriptions. Only extract tabular data.

Page content:
---
{page_text}
---
```

### Phase 3: Validation & Deduplication

1. Validate each item against schema
2. Merge multi-TL variants (same name, different TL)
3. Deduplicate across pages
4. Flag items missing required fields

### Phase 4: Manual Review Queue

Items that fail validation go to review queue:
- Missing required fields
- Suspicious values (TL > 15, cost = 0)
- Duplicate names with different stats

---

## Deliverables

| # | File | Description |
|---|------|-------------|
| E1 | `scripts/csc-detect-tables.js` | Find pages with equipment tables |
| E2 | `scripts/csc-llm-extract.js` | Haiku-based extraction |
| E3 | `scripts/csc-validate-merge.js` | Validation and deduplication |
| E4 | `data/equipment/extracted/` | Category JSON files |
| E5 | `data/equipment/review-queue.json` | Items needing manual review |
| E6 | `tests/csc-extraction.test.js` | Extraction validation tests |

---

## Test Cases

### T1: Table Detection
```javascript
test('detects weapon table on page 146', () => {
  const pages = detectTablePages();
  assert(pages.some(p => p.page === 146 && p.type === 'weapon'));
});
```

### T2: Multi-line Entry Extraction
```javascript
test('extracts Advanced Combat Rifle despite line wrap', () => {
  const items = extractPage(146);
  const acr = items.find(i => i.name === 'Advanced Combat Rifle');
  assert(acr);
  assert.equal(acr.tl, 10);
  assert.equal(acr.damage, '3D');
});
```

### T3: TL Variant Handling
```javascript
test('extracts both TL variants of Accelerator Rifle', () => {
  const items = extractPage(146);
  const variants = items.filter(i => i.name === 'Accelerator Rifle');
  assert.equal(variants.length, 2);
  assert(variants.some(v => v.tl === 9));
  assert(variants.some(v => v.tl === 11));
});
```

### T4: Trait Extraction
```javascript
test('extracts traits array', () => {
  const items = extractPage(146);
  const gauss = items.find(i => i.name === 'Gauss Rifle');
  assert.deepEqual(gauss.traits, ['AP 5', 'Auto 3', 'Scope']);
});
```

### T5: Coverage Target
```javascript
test('extracts at least 500 items total', () => {
  const all = extractAllPages();
  assert(all.length >= 500, `Only extracted ${all.length} items`);
});
```

### T6: No Garbage Names
```javascript
test('no item names contain prose fragments', () => {
  const all = extractAllPages();
  const garbage = all.filter(i =>
    i.name.length > 50 ||
    i.name.includes('TL') ||
    i.name.includes('Cost')
  );
  assert.equal(garbage.length, 0, `Found garbage: ${garbage[0]?.name}`);
});
```

---

## Iteration Protocol

1. **Run extraction on 10 sample pages**
2. **Measure: items extracted, validation pass rate**
3. **Review failures, adjust prompt**
4. **Repeat until >95% on sample**
5. **Scale to full document**
6. **Final validation against known equipment list**

---

## Known Equipment Checklist (Ground Truth)

From Core Rulebook / CSC, must extract:
- [ ] Autopistol (TL6, 3D-3, Cr200)
- [ ] Laser Rifle (TL9, 5D+3, Cr3500)
- [ ] Cutlass (TL2, 3D, Cr200)
- [ ] Cloth Armor (TL7, +5, Cr250)
- [ ] Vacc Suit (TL10, +8, Cr10000)
- [ ] Filter Mask (TL3, Cr10)
- [ ] Hand Computer (TL7, Cr1000)
- [ ] Medkit (TL8, Cr1000)

---

## Generator Handoff

```
You are Generator. Read audit plan at .claude/plans/csc-extraction-v2.md.

Deliverables:
1. Create scripts/csc-detect-tables.js - regex-based table page detection
2. Create scripts/csc-llm-extract.js - Haiku-based extraction with structured prompt
3. Create scripts/csc-validate-merge.js - validation and deduplication
4. Create tests/csc-extraction.test.js with test cases T1-T6
5. Run iteratively on sample pages, report extraction rate
6. Scale to full document when sample rate >95%

Use Haiku model for extraction. Report item count and validation rate after each iteration.
```
