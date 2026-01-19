# Plan: Central Supply Catalogue Extraction

**Status:** READY FOR REVIEW
**Date:** 2026-01-17
**Risk:** Large PDF - process in chunks, save frequently

---

## Summary

Extract the Mongoose Traveller Central Supply Catalogue PDF into:
1. Complete text (indexed by page)
2. All images (renamed, in subdirectory, with index)
3. Structured JSON equipment catalog
4. Strict validator for equipment JSON

---

## Source File

```
~/software/traveller-VTT-private/reference/BruceCampaignA/discord-exports/channels/
  Arzosah Naming - Text Channels - spinward-marches [1311122064064778240].json_Files/
  central_supply_catalogue_update_2023-42400.pdf
```

---

## Output Structure

```
data/equipment/
├── text/
│   ├── page-001.txt
│   ├── page-002.txt
│   └── ... (one file per page)
├── images/
│   ├── index.json           # Image metadata index
│   ├── csc-001-cover.png
│   ├── csc-002-autopistol.png
│   └── ...
├── equipment/
│   ├── weapons-slug.json
│   ├── weapons-energy.json
│   ├── weapons-melee.json
│   ├── armor.json
│   ├── survival.json
│   ├── electronics.json
│   ├── medical.json
│   ├── tools.json
│   ├── vehicles.json
│   └── ...
├── full-text.txt            # Complete searchable text
└── extraction-log.json      # Processing metadata
```

---

## Equipment JSON Schema

Based on Traveller rules, equipment has these core fields:

```json
{
  "id": "autopistol-tl6",
  "name": "Autopistol",
  "category": "weapons",
  "subcategory": "slug-pistols",

  "tl": 6,
  "cost": 200,
  "mass": 0.75,

  "description": "Standard automatic pistol...",
  "source": { "book": "CSC", "page": 42 },

  "weapon_stats": {
    "damage": "3D-3",
    "range": "Pistol",
    "magazine": 15,
    "magazine_cost": 10,
    "traits": ["Auto 2"]
  },

  "legality": {
    "legal_at_law_level": 5,
    "restricted": false,
    "military": false
  }
}
```

### Category-Specific Extensions

**Weapons:**
```json
{
  "weapon_stats": {
    "damage": "3D",
    "range": "Rifle",
    "magazine": 20,
    "magazine_cost": 15,
    "traits": ["Auto 3", "Bulky"],
    "skill": "Gun Combat (slug)"
  }
}
```

**Armor:**
```json
{
  "armor_stats": {
    "protection": 8,
    "rad": 50,
    "slots": 4,
    "traits": ["Vacc Suit"]
  }
}
```

**Survival Gear:**
```json
{
  "survival_stats": {
    "duration": "8 hours",
    "environment": ["thin", "tainted"],
    "consumable": false
  }
}
```

**Electronics:**
```json
{
  "electronics_stats": {
    "range": "50km",
    "power": "battery",
    "battery_life": "24 hours"
  }
}
```

---

## Extraction Process (Chunked)

### Phase 1: Text Extraction (page by page)

```javascript
// Process 10 pages at a time to avoid memory issues
for (let batch = 0; batch < totalPages; batch += 10) {
  const pages = extractPages(pdf, batch, batch + 10);
  for (const page of pages) {
    fs.writeFileSync(`text/page-${pad(page.num)}.txt`, page.text);
  }
  // Force garbage collection between batches
}
```

### Phase 2: Image Extraction

```javascript
// Extract images with metadata
const images = [];
for (const page of pdf.pages) {
  for (const img of page.images) {
    const filename = `csc-${pad(page.num)}-${slugify(context)}.png`;
    saveImage(img, `images/${filename}`);
    images.push({ filename, page: page.num, context });
  }
}
fs.writeFileSync('images/index.json', JSON.stringify(images, null, 2));
```

### Phase 3: Equipment Parsing

Parse text files to extract equipment entries:

```javascript
// Patterns for equipment entries
const EQUIPMENT_PATTERN = /^([A-Z][A-Za-z\s]+)\s+TL(\d+)\s+Cr(\d+)/;
const WEAPON_PATTERN = /Damage:\s*(\d+D[-+]?\d*)/;
const ARMOR_PATTERN = /Protection:\s*\+?(\d+)/;
```

### Phase 4: Validation

Run all equipment through strict validator before saving.

---

## Validator Rules

```javascript
const REQUIRED_FIELDS = ['id', 'name', 'category', 'tl', 'cost'];
const VALID_CATEGORIES = [
  'weapons', 'armor', 'survival', 'electronics',
  'medical', 'tools', 'vehicles', 'robots', 'software'
];
const VALID_WEAPON_RANGES = [
  'Melee', 'Thrown', 'Pistol', 'Shotgun', 'Assault Weapon',
  'Rifle', 'Rocket', 'Distant'
];

function validateEquipment(item) {
  const errors = [];

  // Required fields
  for (const field of REQUIRED_FIELDS) {
    if (!item[field]) errors.push(`Missing required field: ${field}`);
  }

  // Category validation
  if (!VALID_CATEGORIES.includes(item.category)) {
    errors.push(`Invalid category: ${item.category}`);
  }

  // TL must be 0-15
  if (item.tl < 0 || item.tl > 15) {
    errors.push(`TL out of range: ${item.tl}`);
  }

  // Weapon-specific
  if (item.category === 'weapons') {
    if (!item.weapon_stats) errors.push('Weapons require weapon_stats');
    if (!VALID_WEAPON_RANGES.includes(item.weapon_stats?.range)) {
      errors.push(`Invalid weapon range: ${item.weapon_stats?.range}`);
    }
  }

  // Armor-specific
  if (item.category === 'armor') {
    if (!item.armor_stats) errors.push('Armor requires armor_stats');
    if (typeof item.armor_stats?.protection !== 'number') {
      errors.push('Armor requires numeric protection value');
    }
  }

  return { valid: errors.length === 0, errors };
}
```

---

## Deliverables

| # | File | Description |
|---|------|-------------|
| E1 | `scripts/extract-csc-text.js` | Page-by-page text extraction |
| E2 | `scripts/extract-csc-images.js` | Image extraction with indexing |
| E3 | `scripts/parse-csc-equipment.js` | Text to JSON parser |
| E4 | `src/equipment-validator.js` | Strict JSON validation |
| E5 | `data/equipment/` | Output directory structure |
| E6 | `tests/equipment-validator.test.js` | Validator test cases |

---

## Alex Ryder Equipment (Immediate)

While full extraction runs, add Scout loadout to alex-ryder.json:

```json
{
  "personal_equipment": [
    {
      "id": "autopistol-standard",
      "name": "Autopistol",
      "category": "weapons",
      "tl": 7,
      "legal_at_law_level": 5
    },
    {
      "id": "blade-combat",
      "name": "Combat Blade",
      "category": "weapons",
      "tl": 3,
      "legal_at_law_level": 8
    },
    {
      "id": "filter-respirator",
      "name": "Filter/Respirator (Deluxe)",
      "category": "survival",
      "tl": 8,
      "quantity": 2
    },
    {
      "id": "cold-weather-clothing",
      "name": "Cold Weather Clothing",
      "category": "survival",
      "tl": 7
    },
    {
      "id": "hand-radio",
      "name": "Hand Radio",
      "category": "electronics",
      "tl": 6,
      "quantity": 3
    },
    {
      "id": "personal-comm",
      "name": "Personal Comm",
      "category": "electronics",
      "tl": 8
    },
    {
      "id": "medkit-personal",
      "name": "Personal Medkit",
      "category": "medical",
      "tl": 8
    },
    {
      "id": "handlight",
      "name": "Handlight",
      "category": "tools",
      "tl": 7
    },
    {
      "id": "headlamp",
      "name": "Headlamp",
      "category": "tools",
      "tl": 7
    },
    {
      "id": "multi-tool",
      "name": "Multi-tool",
      "category": "tools",
      "tl": 7
    },
    {
      "id": "survival-kit",
      "name": "Survival Kit",
      "category": "survival",
      "tl": 5
    }
  ]
}
```

---

## Safety Measures

1. **Chunk Processing** - Never load full PDF into memory
2. **Frequent Saves** - Write after each page/batch
3. **Progress Logging** - Track extraction state for resume
4. **Validation First** - Parse sample pages before full run
5. **Timeout Protection** - 30 second max per page

---

## Verification

```bash
# Run extraction
node scripts/extract-csc-text.js
node scripts/extract-csc-images.js
node scripts/parse-csc-equipment.js

# Validate all equipment
node -e "require('./src/equipment-validator').validateAll()"

# Run tests
node tests/equipment-validator.test.js
```

---

## User Decisions

- **Priority:** All categories in parallel - extract everything, validate as we go
- **Location:** `data/equipment/` - dedicated equipment directory
- **Images:** Keep original format, convert only if needed
