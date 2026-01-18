# Audit Plan: Vargr/Human Species System

**Status:** READY FOR GENERATOR
**Date:** 2026-01-17
**Auditor:** Claude (Auditor role)

---

## Objective

Implement explicit species designation for all NPCs with species-appropriate behavioral traits. Narrator and NPCs must understand and roleplay species differences authentically.

---

## Species in Traveller (Canon Reference)

### Vargr
- **Origin:** Uplifted from Terran canines by Ancients ~300,000 years ago
- **Psychology:** Pack-oriented, charisma-based hierarchy
- **Social traits:**
  - Respect flows to charismatic leaders, not titles
  - Loyalty is personal, not institutional
  - Quick to change allegiance if leader fails
  - More emotionally expressive than humans
  - Body language includes ear position, tail carriage
- **Communication:** Direct, less formal hierarchy respect
- **Physical:** Wolf-like bipeds, keen senses, shorter lifespan (~60 years)

### Human
- **Social traits:**
  - Institutional loyalty (to organizations, nations)
  - Hierarchy based on position/title
  - More reserved emotional expression
  - Complex status signaling
- **On Walston:** Traditional, conservative, subtle racism toward Vargr

---

## Current State

| NPC | Species Field | Species Mentioned | Behavioral Traits |
|-----|---------------|-------------------|-------------------|
| vargr-chauffeur | ✗ Missing | ✓ In background | ✓ Has Vargr-specific dialogue |
| minister-greener | ✗ Missing | Implicit human | Generic |
| dictator-masterton | ✗ Missing | Implicit human | Generic |
| startown-bartender | ✗ Missing | Not stated | Generic |
| customs-officer | ✗ Missing | Not stated | Generic |
| mr-casarii | ✗ Missing | Not stated | Generic |

---

## New Data Structure

### NPC Species Field

```json
{
  "id": "vargr-chauffeur",
  "species": "vargr",
  "species_traits": {
    "communication_style": "direct, emotionally expressive",
    "loyalty_type": "personal",
    "body_language": ["ears flatten when distressed", "tail low when submissive"],
    "cultural_notes": "Third-generation Walston Vargr, assimilated but aware of glass ceiling"
  }
}
```

```json
{
  "id": "minister-greener",
  "species": "human",
  "species_traits": {
    "communication_style": "formal, institutional",
    "loyalty_type": "positional",
    "cultural_notes": "Traditional Walston human, accepts status quo on Vargr relations"
  }
}
```

### Species Reference Data

**File:** `data/species/vargr.json`
```json
{
  "id": "vargr",
  "name": "Vargr",
  "classification": "Major Race (uplifted)",
  "origin": "Terra (via Ancients genetic manipulation)",

  "physical": {
    "appearance": "Wolf-like bipeds, ~1.6m average height",
    "senses": "Keen smell and hearing, average vision",
    "lifespan": "~60 years standard"
  },

  "psychology": {
    "core_traits": [
      "Pack-oriented social structure",
      "Charisma-based hierarchy (not positional)",
      "Personal loyalty over institutional",
      "Emotionally expressive",
      "Quick to reassess allegiances"
    ],
    "body_language": {
      "ears_forward": "Alert, interested",
      "ears_back": "Submissive or fearful",
      "ears_flat": "Aggressive or distressed",
      "tail_high": "Confident, dominant",
      "tail_low": "Submissive, uncertain",
      "showing_teeth": "Can be friendly (grin) or threatening (snarl) - context dependent"
    }
  },

  "social": {
    "hierarchy": "Based on charisma and demonstrated competence, not titles",
    "loyalty": "To individuals, not institutions - will follow a proven leader anywhere",
    "pack_dynamics": "Form tight bonds with trusted companions",
    "outsider_relations": "May seem fickle to humans due to different loyalty model"
  },

  "roleplay_notes": [
    "More emotionally transparent than humans",
    "May challenge authority that hasn't proven itself",
    "Deeply loyal once trust is established",
    "Body language is important - describe ear/tail positions",
    "Names often have sharp consonants (Kira, Gvurrdon, Kforuzeng)"
  ],

  "walston_specific": {
    "population_percentage": 70,
    "social_status": "Accepted but face glass ceiling",
    "occupations": "Service roles, labor, some skilled trades",
    "government_representation": "One Minister for Vargr Affairs (token)",
    "community_centers": ["Old Vargr Quarter in Salbarii", "Worker housing near starport"]
  }
}
```

**File:** `data/species/human.json`
```json
{
  "id": "human",
  "name": "Human",
  "classification": "Major Race",
  "origin": "Terra",

  "physical": {
    "appearance": "Standard Solomani stock on Walston",
    "lifespan": "~80 years with medical care"
  },

  "psychology": {
    "core_traits": [
      "Institutional loyalty",
      "Position-based hierarchy",
      "Complex social signaling",
      "Variable emotional expression by culture"
    ]
  },

  "walston_specific": {
    "population_percentage": 30,
    "social_status": "Dominant minority",
    "occupations": "Government, management, ownership",
    "cultural_markers": ["Traditional kilts", "Conservative values", "Quiet prejudice"],
    "attitude_toward_vargr": "Paternalistic acceptance, 'they know their place'"
  }
}
```

---

## Narrator Species Awareness

Add to narrator context:

```
=== SPECIES AWARENESS ===
When roleplaying Vargr NPCs:
- Use body language cues (ears, tail) in descriptions
- Show emotional transparency
- Loyalty is personal, not to institutions
- May challenge unproven authority

When roleplaying Human NPCs on Walston:
- More formal, institutional communication
- Traditional values, conservative
- Subtle prejudice toward Vargr (not hostile, paternalistic)

Current NPC species:
- Kira (chauffeur): Vargr - distressed about family, ears flat, pleading
- Minister Greener: Human - formal, institutional, fair but traditional
- Bartender: Human - friendly but holds traditional Walston views
```

---

## Deliverables

| # | File | Description |
|---|------|-------------|
| D1 | `data/species/vargr.json` | Vargr species reference |
| D2 | `data/species/human.json` | Human species reference |
| D3 | `data/npcs/*.json` | Add `species` and `species_traits` to all NPCs |
| D4 | `src/species-data.js` | Load species data, provide lookup |
| D5 | `src/agm-controller.js` | Inject species awareness into narrator |
| D6 | `tests/species-system.test.js` | Test cases |

---

## NPC Species Assignments

| NPC | Species | Rationale |
|-----|---------|-----------|
| vargr-chauffeur (Kira) | vargr | Explicit in name/background |
| minister-greener | human | Government official, traditional Walston |
| dictator-masterton | human | Hereditary ruler |
| customs-officer-walston | human | Authority position |
| startown-bartender | human | Business owner (per Walston norms) |
| mr-casarii | human | Scout Service official |
| captain-corelli | human | Ship captain |
| startown-bartender-assistant | vargr | Service role (NEW - adds Vargr presence) |

---

## Test Cases

```javascript
// TEST SP.1: Species data loads
const vargr = require('../data/species/vargr.json');
assert.ok(vargr);
assert.strictEqual(vargr.id, 'vargr');

// TEST SP.2: Vargr has body language defined
assert.ok(vargr.psychology.body_language);
assert.ok(vargr.psychology.body_language.ears_forward);

// TEST SP.3: All NPCs have species field
const npcs = loadAllNpcs('high-and-dry');
for (const npc of npcs) {
  assert.ok(npc.species, `NPC ${npc.id} should have species field`);
  assert.ok(['human', 'vargr'].includes(npc.species));
}

// TEST SP.4: Vargr chauffeur has species traits
const kira = loadNpc('vargr-chauffeur');
assert.strictEqual(kira.species, 'vargr');
assert.ok(kira.species_traits);

// TEST SP.5: Species lookup works
const { getSpecies } = require('../src/species-data');
const vData = getSpecies('vargr');
assert.ok(vData.roleplay_notes);

// TEST SP.6: Narrator context includes species awareness
const { buildNarratorContext } = require('../src/agm-controller');
const ctx = buildNarratorContext(stateWithVargrNpc);
assert.ok(ctx.includes('Vargr') || ctx.includes('species'));
```

---

## Implementation Order

1. D6: Create test file (tests fail initially)
2. D1, D2: Create species reference files
3. D4: Create species-data.js module
4. D3: Add species field to all NPCs
5. D5: Integrate species awareness into narrator
6. Verify all tests pass

---

## Example Enhanced NPC Dialogue

**Before (generic):**
```
Kira: "Please, you have to help me. My parents are trapped."
```

**After (species-aware):**
```
Kira's ears flatten against her skull, tail tucked low. "Please," she says,
her voice cracking with undisguised desperation - Vargr don't hide their
emotions the way humans do. "My parents are trapped in the old quarter.
I know where they are. I can guide you."
```
