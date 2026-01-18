# Audit Plan: Emergent NPC Generator (Completion)

**Status:** READY FOR GENERATOR
**Date:** 2026-01-17
**Auditor:** Claude (Auditor role)
**Parent:** narrator-improvisation-audit.md (D5, D6 not completed)

---

## Objective

Complete the Emergent NPC Generator - allows narrator to generate plausible NPCs on demand when PCs ask unexpected questions.

**Use case:** PCs ask for aircraft for aerial photography. Narrator invents farmer Erik Hendricks with hobby ultralight, family, farm location. NPC persists for session continuity.

---

## Deliverables

| # | File | Description |
|---|------|-------------|
| D1 | `data/adventures/high-and-dry/npc-templates/emergent-npcs.json` | NPC generation templates |
| D2 | `src/emergent-npc.js` | Generator with persistence |

---

## D1: NPC Templates

**File:** `data/adventures/high-and-dry/npc-templates/emergent-npcs.json`

```json
{
  "id": "emergent-npc-templates",
  "world": "walston",

  "templates": {
    "farmer": {
      "species_distribution": {"human": 70, "vargr": 30},
      "locations": ["Lakeside", "Central basin", "Salbarii region"],
      "skills": ["Animals-1", "Mechanic-0", "Survival-1"],
      "family_chance": 0.8,
      "family_types": ["spouse", "children", "elderly parent"],
      "equipment_chance": {
        "ATV": 0.6,
        "hunting_rifle": 0.4,
        "radio": 0.3
      },
      "hobbies": ["hunting", "fishing", "tinkering", "ultralight flying"],
      "service_costs": {
        "guide": "Cr30/day",
        "transport": "Cr50/day",
        "lodging": "Cr20/night"
      },
      "personality_traits": ["practical", "hospitable", "weather-wise", "curious about offworlders"]
    },

    "trader": {
      "species_distribution": {"human": 60, "vargr": 40},
      "locations": ["Startown", "Central market", "Salbarii"],
      "skills": ["Broker-1", "Streetwise-1", "Persuade-0"],
      "inventory_types": ["general goods", "equipment", "local crafts", "imported tech"],
      "service_costs": {
        "sourcing_fee": "10% markup",
        "information": "Cr20-50"
      },
      "personality_traits": ["shrewd", "well-connected", "chatty", "knows everyone"]
    },

    "laborer": {
      "species_distribution": {"human": 20, "vargr": 80},
      "locations": ["Starport", "Rail depot", "Mining areas"],
      "skills": ["Athletics-1", "Mechanic-0", "Drive-0"],
      "service_costs": {
        "manual_labor": "Cr20/day",
        "porter": "Cr15/day"
      },
      "personality_traits": ["hardworking", "practical", "community-minded"],
      "social_notes": "May have insights into Vargr community, glass ceiling experiences"
    },

    "official": {
      "species_distribution": {"human": 95, "vargr": 5},
      "locations": ["Central", "Starport customs"],
      "skills": ["Admin-1", "Advocate-0", "Persuade-1"],
      "authority_level": ["clerk", "supervisor", "department head"],
      "service_costs": {
        "expedited_processing": "Cr50 (unofficial)",
        "official_request": "Free but slow"
      },
      "personality_traits": ["bureaucratic", "by-the-book", "overworked", "local pride"]
    },

    "specialist": {
      "species_distribution": {"human": 50, "vargr": 50},
      "specialties": {
        "mechanic": {"skills": ["Mechanic-2", "Electronics-1"], "cost": "Cr100/day"},
        "medic": {"skills": ["Medic-1", "Science-0"], "cost": "Cr50 consultation"},
        "pilot": {"skills": ["Flyer-1", "Navigation-0"], "cost": "Cr200/day + fuel"},
        "guide": {"skills": ["Survival-2", "Navigation-1"], "cost": "Cr50/day"}
      },
      "personality_traits": ["competent", "professional", "takes pride in work"]
    }
  },

  "name_pools": {
    "human_male": ["Erik", "Jonas", "Mikael", "Anders", "Henrik", "Lars", "Piotr", "Gregor", "Sven", "Karl"],
    "human_female": ["Mira", "Astrid", "Ingrid", "Elsa", "Karin", "Sonja", "Vera", "Hanna", "Britta", "Lena"],
    "human_surnames": ["Hendricks", "Larsson", "Bergman", "Nilsen", "Vance", "Thorpe", "Marsh", "Erikson", "Holst", "Strand"],
    "vargr": ["Kira", "Gvurz", "Rrakhs", "Dzengh", "Aekfoz", "Llaza", "Uthka", "Faega", "Knueng", "Odzso"]
  },

  "quirks": [
    "Has a collection of offworld coins",
    "Old injury causes a limp",
    "Keeps a small pet (local creature)",
    "Tells the same three jokes to everyone",
    "Dreams of traveling offworld",
    "Has a relative who left Walston years ago",
    "Collects news from passing ships",
    "Superstitious about the volcano",
    "Former military/scout service",
    "Hobby photographer"
  ]
}
```

---

## D2: Generator Module

**File:** `src/emergent-npc.js`

```javascript
/**
 * Emergent NPC Generator
 * Generates plausible NPCs on demand for narrator improvisation
 */

const fs = require('fs');
const path = require('path');

let templates = null;

function loadTemplates(adventureId) {
  if (templates) return templates;
  const templatePath = path.join(
    __dirname,
    '../data/adventures',
    adventureId,
    'npc-templates/emergent-npcs.json'
  );
  templates = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  return templates;
}

function rollSpecies(distribution) {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const [species, chance] of Object.entries(distribution)) {
    cumulative += chance;
    if (roll < cumulative) return species;
  }
  return 'human'; // fallback
}

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function pickMultiple(array, count) {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateName(templates, species, gender = null) {
  const pools = templates.name_pools;
  if (species === 'vargr') {
    return pickRandom(pools.vargr);
  }
  // Human
  if (!gender) gender = Math.random() > 0.5 ? 'male' : 'female';
  const firstName = pickRandom(pools[`human_${gender}`]);
  const surname = pickRandom(pools.human_surnames);
  return `${firstName} ${surname}`;
}

function generateNPC(adventureId, role, location, options = {}) {
  const tmpl = loadTemplates(adventureId);
  const template = tmpl.templates[role];

  if (!template) {
    throw new Error(`Unknown NPC role: ${role}`);
  }

  const species = options.species || rollSpecies(template.species_distribution);
  const name = options.name || generateName(tmpl, species);

  // Build skills
  let skills = [...(template.skills || [])];
  if (template.specialties && options.specialty) {
    const spec = template.specialties[options.specialty];
    if (spec) skills = spec.skills;
  }

  // Build personality
  const personality = pickMultiple(template.personality_traits || [], 2);

  // Add quirk
  const quirk = pickRandom(tmpl.quirks);

  // Generate family if applicable
  let family = null;
  if (template.family_chance && Math.random() < template.family_chance) {
    family = generateFamily(tmpl, species);
  }

  // Determine location
  const npcLocation = location || pickRandom(template.locations || ['Unknown']);

  const npc = {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    species,
    role,
    location: npcLocation,
    skills,
    personality,
    quirk,
    family,
    service_costs: template.service_costs || {},
    generated: true,
    generated_at: new Date().toISOString()
  };

  // Add specialty info if applicable
  if (options.specialty && template.specialties) {
    npc.specialty = options.specialty;
    npc.service_costs = { cost: template.specialties[options.specialty].cost };
  }

  // Add social notes for certain roles
  if (template.social_notes) {
    npc.social_notes = template.social_notes;
  }

  return npc;
}

function generateFamily(tmpl, primarySpecies) {
  const members = [];
  const types = ['spouse', 'child', 'elderly parent'];
  const count = Math.floor(Math.random() * 3) + 1;

  for (let i = 0; i < count; i++) {
    const type = pickRandom(types);
    const gender = Math.random() > 0.5 ? 'male' : 'female';
    const name = generateName(tmpl, primarySpecies, gender);
    members.push({ relation: type, name });
  }

  return members;
}

function persistEmergentNPC(adventureId, playerId, npc) {
  const statePath = path.join(
    __dirname,
    '../data/state/adventures',
    `${adventureId}-${playerId}`,
    'emergent-npcs.json'
  );

  let data = { npcs: [] };
  if (fs.existsSync(statePath)) {
    data = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  }

  // Check if NPC already exists
  const existing = data.npcs.findIndex(n => n.id === npc.id);
  if (existing >= 0) {
    data.npcs[existing] = npc;
  } else {
    data.npcs.push(npc);
  }

  // Ensure directory exists
  const dir = path.dirname(statePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(statePath, JSON.stringify(data, null, 2));
  return npc;
}

function recallEmergentNPC(adventureId, playerId, npcId) {
  const statePath = path.join(
    __dirname,
    '../data/state/adventures',
    `${adventureId}-${playerId}`,
    'emergent-npcs.json'
  );

  if (!fs.existsSync(statePath)) return null;

  const data = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  return data.npcs.find(n => n.id === npcId) || null;
}

function listEmergentNPCs(adventureId, playerId) {
  const statePath = path.join(
    __dirname,
    '../data/state/adventures',
    `${adventureId}-${playerId}`,
    'emergent-npcs.json'
  );

  if (!fs.existsSync(statePath)) return [];

  const data = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  return data.npcs;
}

module.exports = {
  generateNPC,
  generateFamily,
  persistEmergentNPC,
  recallEmergentNPC,
  listEmergentNPCs,
  loadTemplates
};
```

---

## Test Cases (already in tests/narrator-improvisation.test.js)

```javascript
// TEST I.7: NPC templates exist
const templates = loadJson('data/adventures/high-and-dry/npc-templates/emergent-npcs.json');
assert.ok(templates);
assert.ok(templates.templates.farmer);
assert.ok(templates.templates.farmer.species_distribution);

// TEST I.8: NPC generation works
const { generateNPC } = require('../src/emergent-npc');
const npc = generateNPC('high-and-dry', 'farmer', 'Lakeside');
assert.ok(npc.name);
assert.ok(npc.species);
assert.ok(npc.skills);
```

---

## Verification

```bash
node tests/narrator-improvisation.test.js
# Should show 8/8 passed
```
