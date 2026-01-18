# Audit Plan: World Knowledge Integration for Narrator

**Status:** READY FOR GENERATOR
**Date:** 2026-01-17
**Auditor:** Claude (Auditor role)

---

## Objective

**The narrator must be all-knowing.** It needs comprehensive access to canonical Traveller universe data to avoid hallucination. This audit is the first step toward that goal - integrating pre-indexed Spinward Marches world data.

Future expansions:
- Ship specifications (Type-S Scout, etc.)
- NPC canonical backgrounds
- Equipment/item stats
- Timeline events
- Trade routes and jump maps

---

## Problem Statement

Narrator hallucinated incorrect UWP for 567-908:
- **Said:** X200000-0 (no starport, size 2, no atmosphere)
- **Actual:** E532000-0 (frontier starport, size 5, very thin atmo, 20% water)

Root cause: `world-knowledge.js` and `wiki-cache.js` exist but are NOT integrated into narrator prompts.

---

## Available Resources

### Pre-indexed World Data (already cached)

| Source | Location | Content |
|--------|----------|---------|
| Subsector JSON | `/home/bruce/software/traveller-starship-operations-vtt/data/subsectors/*.json` | Pre-parsed UWP, bases, trade codes, allegiance |
| Wiki Cache Index | `data/wiki-cache/index.json` (symlink) | 432 systems indexed |
| Wiki Text Cache | `data/wiki-cache/systems/*.json` | Full wiki content per world |

### Existing Modules (this repo)

| Module | Purpose | Status |
|--------|---------|--------|
| `src/world-knowledge.js` | Parse UWP, describe worlds | Exists, not integrated |
| `src/wiki-cache.js` | O(1) lookups by hex/name | Exists, not integrated |

---

## Data Example

**567-908 from subsector JSON:**
```json
{
  "hex": "1031",
  "name": "567-908",
  "uwp": "E532000-0",
  "starport": "E",
  "techLevel": 0,
  "bases": [],
  "zone": "",
  "remarks": "Ba Po (Shriekers) Lt",
  "allegiance": ""
}
```

**Walston from subsector JSON:**
```json
{
  "hex": "0402",
  "name": "Walston",
  "uwp": "C544338-8",
  "starport": "C",
  "techLevel": 8,
  "bases": ["S"],
  "zone": "",
  "remarks": "Lo",
  "allegiance": "Cs"
}
```

---

## Proposed Solution

### 1. Import subsector data into this repo

Create symlink or copy Spinward Marches subsector data:
```bash
ln -s /home/bruce/software/traveller-starship-operations-vtt/data/subsectors data/subsectors
```

### 2. Create world lookup module

New `src/subsector-data.js`:
- Load all subsector JSONs on init
- Build hash maps: byHex, byName
- O(1) lookup for any world in Spinward Marches

### 3. Integrate into narrator prompt

In `src/agm-controller.js` or `src/prompts.js`:
- When scene mentions a world, lookup canonical data
- Inject world profile into narrator context:

```
=== WORLD DATA: 567-908 ===
UWP: E532000-0
Starport E (frontier - no facilities)
Size 5 (~8,000km), Very thin atmosphere, 20% water
Population 0 (barren), No government, No law
Tech Level 0
Trade: Ba Po (Shriekers) Lt
CRITICAL: Use these EXACT stats when discussing this world.
```

### 4. Context-aware injection

Inject world data when:
- Scene `setting` mentions a world name
- Player asks about a world (detect in input)
- `storyState.currentWorld` is set

### 5. Document the resource

Add to `.claude/KNOWLEDGE-RESOURCES.md`:
```markdown
## Spinward Marches World Data

**Location:** `data/subsectors/*.json` (symlinked from traveller-starship-operations-vtt)
**Coverage:** All 432 systems in Spinward Marches sector
**Fields:** hex, name, uwp, starport, techLevel, bases, zone, remarks, allegiance
**Usage:** `require('./subsector-data').getWorld('567-908')` or `getWorldByHex('1031')`
```

---

## Deliverables

| # | File | Description |
|---|------|-------------|
| D1 | `data/subsectors` | Symlink to VTT repo subsector data |
| D2 | `src/subsector-data.js` | NEW: World lookup with O(1) hash maps |
| D3 | `src/agm-controller.js` | Inject world context into narrator prompt |
| D4 | `.claude/KNOWLEDGE-RESOURCES.md` | Document available resources |
| D5 | `tests/world-data-integration.test.js` | Test cases |

---

## Test Cases

```javascript
// TEST W.1: Subsector data loads
const { initialize, getWorld } = require('../src/subsector-data');
initialize();
const world = getWorld('567-908');
assert.ok(world);

// TEST W.2: Correct UWP returned
assert.strictEqual(world.uwp, 'E532000-0');

// TEST W.3: Lookup by hex works
const { getWorldByHex } = require('../src/subsector-data');
const world2 = getWorldByHex('1031');
assert.strictEqual(world2.name, '567-908');

// TEST W.4: Walston data correct
const walston = getWorld('Walston');
assert.strictEqual(walston.uwp, 'C544338-8');
assert.strictEqual(walston.techLevel, 8);

// TEST W.5: World context builds correctly
const { buildWorldContext } = require('../src/subsector-data');
const ctx = buildWorldContext('567-908');
assert.ok(ctx.includes('E532000-0'));
assert.ok(ctx.includes('Starport E'));

// TEST W.6: AGM prompt includes world context when scene has world
// (Integration test with agm-controller)
```

---

## Verification

```bash
node tests/world-data-integration.test.js
```

Then test manually:
```bash
npm run tui
# Go to scene 3 (567-908)
# Ask "what's the UWP?"
# Should get E532000-0, not X200000-0
```

---

## Implementation Order

1. D1: Create symlink to subsector data
2. D5: Create test file (tests fail initially)
3. D2: Create subsector-data.js module
4. D3: Integrate world context into agm-controller
5. D4: Document in KNOWLEDGE-RESOURCES.md
6. Verify all tests pass
