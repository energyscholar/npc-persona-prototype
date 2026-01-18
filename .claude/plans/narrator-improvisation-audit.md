# Audit Plan: Narrator Improvisation System

**Status:** READY FOR GENERATOR
**Date:** 2026-01-17
**Auditor:** Claude (Auditor role)

---

## Objective

Train narrator to handle unexpected PC actions through:
1. Expanded world resource knowledge
2. Dynamic resource lookup system
3. Curated improvisation examples

**Motivating Use Case:** PCs asked about flying vehicles for aerial volcano photography, bypassing the mountain climb. Creative solution that should be rewarded while maintaining story goals.

---

## Component 1: World Resources Data

### File: `data/adventures/high-and-dry/resources/walston-resources.json`

```json
{
  "id": "walston-resources",
  "world": "walston",
  "tech_level": 8,

  "transportation": {
    "air_vehicles": {
      "availability": "rare",
      "description": "Thin atmosphere limits aviation. Grav vehicles possible but expensive.",
      "sources": [
        {
          "id": "government-grav",
          "type": "grav vehicle",
          "owner": "Walston Government",
          "availability": "Emergency only, requires Masterton's approval",
          "cost": "Not for hire"
        },
        {
          "id": "highndry-airraft",
          "type": "air/raft",
          "owner": "Stranded with Highndry",
          "availability": "Must retrieve from crash site",
          "cost": "Free if you can get it",
          "note": "Previous crew took it when they fled - it's at the starport or gone"
        }
      ],
      "narrator_redirect": "If PCs ask for aircraft, mention the Highndry's air/raft as a possibility"
    },

    "ground_vehicles": {
      "availability": "common",
      "sources": [
        {
          "id": "atv-rental",
          "type": "ATV",
          "owner": "Various",
          "availability": "Startown, Salbarii",
          "cost": "Cr50/day",
          "capacity": "4 passengers + cargo"
        },
        {
          "id": "government-transport",
          "type": "Ground car",
          "owner": "Government motor pool",
          "availability": "Official business",
          "cost": "Requires arrangement with Minister"
        }
      ]
    },

    "rail": {
      "availability": "limited",
      "operator": "Walston Rail (Masterton)",
      "frequency": "Once daily",
      "routes": ["Startown-Central", "Central-Salbarii"],
      "cost": "Cr10 per segment",
      "note": "Cannot reach volcano, ends at Salbarii"
    },

    "water": {
      "availability": "limited",
      "description": "Small boats on lakes, fishing vessels at Barvinn",
      "sources": [
        {
          "id": "lake-boat",
          "type": "Small boat",
          "availability": "Lakeside, Central",
          "cost": "Cr20/day"
        }
      ]
    }
  },

  "equipment": {
    "weapons": {
      "availability": "restricted",
      "note": "Customs confiscates most weapons. Daggers and shorter legal.",
      "sources": [
        {
          "id": "walston-general",
          "location": "Startown",
          "inventory": ["Knives", "Basic tools"],
          "restricted": ["Firearms", "Energy weapons"]
        }
      ]
    },

    "survival_gear": {
      "availability": "common",
      "sources": [
        {
          "id": "walston-general",
          "location": "Startown",
          "inventory": ["Filter masks", "Climbing gear", "Rations", "Tents"]
        }
      ]
    },

    "communications": {
      "availability": "common",
      "note": "TL8 - radio comms, no real-time satellite",
      "sources": [
        {
          "id": "portable-radio",
          "cost": "Cr100",
          "range": "50km"
        }
      ]
    },

    "medical": {
      "availability": "limited",
      "sources": [
        {
          "id": "startown-medic",
          "location": "Startown",
          "services": ["First aid", "Basic treatment"],
          "cost": "Cr50 consultation"
        },
        {
          "id": "capital-hospital",
          "location": "Central",
          "services": ["Full medical", "Surgery"],
          "cost": "Cr200+ depending on treatment"
        }
      ]
    }
  },

  "services": {
    "guides": {
      "availability": "available",
      "sources": [
        {
          "id": "local-guide",
          "skill": "Survival 1, Navigation 1",
          "cost": "Cr30/day",
          "note": "Knows mountain trails, won't enter crater"
        }
      ]
    },

    "transport_hire": {
      "availability": "available",
      "sources": [
        {
          "id": "atv-driver",
          "service": "ATV with driver",
          "cost": "Cr100/day",
          "range": "Anywhere on Settlement Island"
        }
      ]
    },

    "information": {
      "availability": "varies",
      "sources": [
        {
          "id": "bartender-intel",
          "location": "Dusty Airlock",
          "cost": "Buy drinks, make friends",
          "quality": "Rumors, local gossip"
        },
        {
          "id": "customs-records",
          "location": "Starport",
          "cost": "Persuade or official request",
          "quality": "Ship movements, crew records"
        }
      ]
    }
  }
}
```

---

## Component 2: Improvisation Rules

### File: `data/adventures/high-and-dry/narrator-rules/improvisation.json`

```json
{
  "id": "narrator-improvisation",

  "core_principles": [
    {
      "name": "Yes, And",
      "description": "Accept creative solutions, add complications or redirects",
      "example": "PC wants to fly? Yes, aircraft are rare here, AND the only accessible one is with the stranded ship."
    },
    {
      "name": "Multiple Paths",
      "description": "Story goals can be reached different ways",
      "example": "Finding Highndry: climb mountain, hire local guide, ask about vehicles, investigate previous crew trail"
    },
    {
      "name": "World Consistency",
      "description": "Solutions must fit TL, culture, and established facts",
      "example": "TL8 Walston has grav tech but it's rare and expensive on a frontier world"
    },
    {
      "name": "Consequence Balance",
      "description": "Shortcuts save time but may cost resources or skip useful information",
      "example": "Flying to crater skips mountain encounters but costs money or favors"
    }
  ],

  "redirect_patterns": {
    "resource_unavailable": {
      "pattern": "PC asks for something that doesn't exist locally",
      "response": "Acknowledge the gap, suggest alternative or redirect to story goal",
      "example": "No helicopters on Walston, but there's an air/raft with that crashed ship..."
    },

    "shortcut_attempt": {
      "pattern": "PC tries to bypass planned challenge",
      "response": "Allow if plausible, but ensure they still engage with story goals",
      "example": "Flying to volcano crater still requires finding/repairing ship, dealing with wolf"
    },

    "unexpected_expertise": {
      "pattern": "PC has skill that trivializes challenge",
      "response": "Let skill work, add complications that use other skills",
      "example": "Expert climber reaches crater easily, but now must handle Tensher's Wolf alone"
    },

    "social_solution": {
      "pattern": "PC tries to talk/buy way past obstacle",
      "response": "Allow with appropriate difficulty, note who owes whom",
      "example": "Convincing Masterton to lend grav vehicle creates obligation"
    }
  },

  "forbidden_blocks": [
    "Never say 'you can't do that' without offering alternative",
    "Never invalidate creative thinking that fits the world",
    "Never add obstacles purely to force the 'correct' path"
  ]
}
```

---

## Component 3: Example Library

### File: `data/adventures/high-and-dry/narrator-rules/improv-examples.json`

```json
{
  "id": "improv-examples",

  "examples": [
    {
      "id": "aerial-survey",
      "scene": "act-2-walston",
      "pc_action": "Ask about flying vehicles for aerial volcano photography",
      "world_context": "TL8, thin atmosphere, rare grav vehicles",
      "good_response": "The bartender considers your question. 'Flying? We don't have commercial aircraft - air's too thin, not worth the investment.' He pauses, polishing a glass. 'Though if you're set on something that flies... word is there's an air/raft with that crashed Scout ship up in the volcano. Previous crew supposedly took it when they left, but who knows? Maybe it's still there.'",
      "why_good": "Accepts premise, explains world constraint, redirects to story goal, adds useful intel",
      "bad_response": "There are no aircraft available on Walston.",
      "why_bad": "Blocks creativity, no alternatives offered, misses redirect opportunity"
    },

    {
      "id": "bribe-customs",
      "scene": "starport-arrival",
      "pc_action": "Try to bribe customs officer to keep weapons",
      "world_context": "Small world, customs officer knows everyone, TL8 scanner",
      "good_response": "The customs officer glances at your credits, then back at you with a mixture of offense and amusement. 'Friend, I've worked this post for fifteen years. Everyone knows everyone here. You think I'm going to risk my pension for...' he counts, 'two hundred credits?' He softens slightly. 'Look, store your hardware at the office. Ten credits a week. Pick it up when you leave. That's how it works here.'",
      "why_good": "Realistic rejection, explains world, offers legitimate alternative",
      "bad_response": "The officer accepts your bribe and waves you through.",
      "why_bad": "Undermines established world (complacent but not corrupt), removes planned tension"
    },

    {
      "id": "hire-climbers",
      "scene": "startown-investigation",
      "pc_action": "Hire local mountaineers to retrieve the ship",
      "world_context": "Small population, few experts, ship is complex",
      "good_response": "You ask around about hiring climbers. There are a few locals who know the mountain - mostly hunters and the occasional surveyor. One older man, Jareth, says he could guide you up. 'But I won't go in that crater. Bad air, and there's... something up there. Seen it from the rim. Like a big dog, but wrong.' He'll take you as far as the crater rim for Cr100. After that, you're on your own.",
      "why_good": "Provides useful service, adds wolf foreshadowing, maintains PC agency for key encounters",
      "bad_response": "Nobody on Walston knows how to climb mountains.",
      "why_bad": "Unrealistic for mountain community, blocks reasonable request"
    },

    {
      "id": "contact-previous-crew",
      "scene": "startown-investigation",
      "pc_action": "Try to contact previous crew for information",
      "world_context": "Crew fled to Caladbolg via Datrillian on Maverick Spacer",
      "good_response": "You try to raise the previous crew on comms. After some checking, you find they left aboard a free trader called Maverick Spacer, bound for Datrillian and then Caladbolg. That's weeks away by message, months if you want a reply. The bartender snorts when you mention them. 'Good riddance. They were trouble. Ran up tabs, started fights, treated the Vargr staff like dirt.' He leans in. 'If you want to know about that ship, talk to Minister Greener. He's the one who dealt with them.'",
      "why_good": "Realistic communication delay, adds character info, redirects to useful NPC",
      "bad_response": "You manage to reach the previous crew, who explain everything about the ship.",
      "why_bad": "Undermines mystery, unrealistic communication, skips key NPC interaction"
    },

    {
      "id": "steal-ship",
      "scene": "meeting-greener",
      "pc_action": "Plan to just take the ship without doing the survey",
      "world_context": "Ship is Scout Service property, Greener controls starport, small world",
      "good_response": "Greener regards you steadily. 'I should mention - the Highndry's transponder is still registered with the Scout Service. Take off without authorization and you'll be flagged as stolen the moment you hit any civilized port.' He spreads his hands. 'I'm not threatening. I'm explaining. Do the survey, file the paperwork, and you leave here clean. Try to steal Imperial property?' He shrugs. 'Your choice. But it's a small universe for a wanted ship.'",
      "why_good": "Explains consequences without blocking, maintains player agency, adds tension",
      "bad_response": "You can't steal the ship, it's not allowed.",
      "why_bad": "Meta-gaming, removes player agency, breaks immersion"
    },

    {
      "id": "volcano-warning-early",
      "scene": "mountain-climb",
      "pc_action": "PC geologist notices warning signs of eruption before survey",
      "world_context": "Volcano showing activity, survey is to confirm danger level",
      "good_response": "Your geological training sets alarm bells ringing. The sulfur vents are more active than the briefing suggested. Micro-tremors in the rock. This volcano isn't dormant - it's building toward something. You estimate days to weeks, not years. The survey will confirm your suspicions, but you already know: this mountain is waking up. The question is whether anyone will believe you without the official data.",
      "why_good": "Rewards expertise, maintains story tension, adds urgency",
      "bad_response": "You don't notice anything unusual about the volcano.",
      "why_bad": "Invalidates character skill, feels like railroading"
    },

    {
      "id": "ultralight-farmer",
      "scene": "startown-investigation",
      "pc_action": "Ask around for anyone with aircraft for aerial volcano photography",
      "world_context": "TL8, thin atmosphere, agricultural community",
      "good_response": "You ask around at the Dusty Airlock about aircraft. The bartender thinks for a moment. 'Aircraft? Well... there's old Hendricks out at the Lakeside farms. Bit of an eccentric - builds and flies ultralight craft as a hobby. Risky in this thin air, but he manages. Doubt he's ever been asked to photograph a volcano before.' He gives you directions to the Hendricks farm, about an hour by ATV from Central.",
      "follow_up": "The Hendricks farm is modest but well-kept. Erik Hendricks, weathered and curious, listens to your proposal over dinner with his wife Mira and their teenage son. He's intrigued - never flown over the volcano before. He quotes Cr200 for the day, plus fuel costs. His ultralight can carry one passenger with camera equipment. 'Weather permitting,' he adds. 'Thin air up there. Gets tricky.'",
      "emergent_npc": {
        "name": "Erik Hendricks",
        "role": "Farmer/Hobby Pilot",
        "location": "Lakeside farms",
        "family": ["Mira (wife)", "son (teenage)"],
        "skill": "Flyer-1, Mechanic-1",
        "equipment": "Homebuilt ultralight (2-seater)",
        "personality": "Curious, methodical, loves flying",
        "cost": "Cr200/day + fuel"
      },
      "why_good": "Invents plausible NPC and location, adds roleplay depth (family dinner), achieves PC goal, creates memorable emergent content that fits TL8 agricultural world",
      "bad_response": "There's no one on Walston with aircraft.",
      "why_bad": "Blocks creativity, misses opportunity for world-building and emergent play"
    }
  ]
}
```

---

## Component 4: Dynamic Resource Lookup

### File: `src/resource-lookup.js`

```javascript
// Functions:
// - getAvailableResources(adventureId, category, location)
// - canPCObtain(adventureId, resourceId, pcSkills, pcCredits)
// - suggestAlternatives(adventureId, requestedResource)
// - getNarratorRedirect(adventureId, resourceId)
```

---

## Component 5: Emergent NPC Generator

When PCs ask unexpected questions, narrator can generate plausible NPCs on demand.

### File: `data/adventures/high-and-dry/npc-templates/emergent-npcs.json`

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
    "human_male": ["Erik", "Jonas", "Mikael", "Anders", "Henrik", "Lars", "Piotr"],
    "human_female": ["Mira", "Astrid", "Ingrid", "Elsa", "Karin", "Sonja", "Vera"],
    "human_surnames": ["Hendricks", "Larsson", "Bergman", "Nilsen", "Vance", "Thorpe", "Marsh"],
    "vargr": ["Kira", "Gvurz", "Rrakhs", "Dzengh", "Aekfoz", "Llaza", "Uthka"]
  },

  "generation_rules": {
    "species": "Roll against species_distribution for template",
    "family": "If family_chance passes, generate 1-3 family members",
    "personality": "Pick 2-3 traits from template",
    "quirk": "Add one unique detail (collection, old injury, unusual pet, etc.)",
    "connection": "50% chance knows another NPC or has useful information"
  }
}
```

### File: `src/emergent-npc.js`

```javascript
// Functions:
// - generateNPC(adventureId, role, location, options)
// - generateFamily(adventureId, primaryNpc)
// - getNameBySpecies(species, gender)
// - persistEmergentNPC(adventureId, npc) // Save for continuity
// - recallEmergentNPC(adventureId, npcId) // Retrieve previously generated

// Example usage:
// generateNPC('high-and-dry', 'farmer', 'Lakeside', { hasAircraft: true })
// Returns: { name: "Erik Hendricks", species: "human", skills: [...], family: [...], ... }
```

### Emergent NPC Persistence

Generated NPCs should be saved for session continuity:

**File:** `data/state/adventures/{adventure}-{player}/emergent-npcs.json`

```json
{
  "npcs": [
    {
      "id": "erik-hendricks",
      "generated_at": "2026-01-17T12:00:00Z",
      "generated_for": "aerial-photography-request",
      "template": "farmer",
      "data": {
        "name": "Erik Hendricks",
        "species": "human",
        "role": "Farmer/Hobby Pilot",
        "location": "Lakeside farms",
        "family": ["Mira (wife)", "son (teenage)"],
        "skills": ["Flyer-1", "Mechanic-1", "Animals-1"],
        "equipment": ["Homebuilt ultralight (2-seater)", "ATV", "Radio"],
        "personality": ["curious", "methodical", "hospitable"],
        "quirk": "Keeps detailed flight logs, dreams of flying offworld someday"
      },
      "interactions": [
        {"scene": "startown-investigation", "action": "hired for aerial photography"}
      ]
    }
  ]
}
```

---

## Deliverables

| # | File | Description |
|---|------|-------------|
| D1 | `data/adventures/high-and-dry/resources/walston-resources.json` | World resources data |
| D2 | `data/adventures/high-and-dry/narrator-rules/improvisation.json` | Core improv principles |
| D3 | `data/adventures/high-and-dry/narrator-rules/improv-examples.json` | Example library (7+ examples) |
| D4 | `src/resource-lookup.js` | Dynamic resource query functions |
| D5 | `data/adventures/high-and-dry/npc-templates/emergent-npcs.json` | NPC generation templates |
| D6 | `src/emergent-npc.js` | NPC generator with persistence |
| D7 | Update `src/agm-controller.js` | Inject resource context, enable NPC generation |
| D8 | `tests/narrator-improvisation.test.js` | Test cases (8 tests)

---

## Test Cases

```javascript
// TEST I.1: Resources data loads
const resources = loadResources('high-and-dry', 'walston-resources');
assert.ok(resources.transportation);

// TEST I.2: Air vehicle scarcity documented
assert.strictEqual(resources.transportation.air_vehicles.availability, 'rare');

// TEST I.3: Improv principles exist
const improv = loadImprovRules('high-and-dry');
assert.ok(improv.core_principles.length >= 4);

// TEST I.4: Examples have required fields
const examples = loadImprovExamples('high-and-dry');
for (const ex of examples.examples) {
  assert.ok(ex.pc_action);
  assert.ok(ex.good_response);
  assert.ok(ex.why_good);
}

// TEST I.5: Resource lookup works
const { getAvailableResources } = require('../src/resource-lookup');
const transport = getAvailableResources('high-and-dry', 'transportation', 'startown');
assert.ok(transport.length > 0);

// TEST I.6: Alternative suggestions work
const { suggestAlternatives } = require('../src/resource-lookup');
const alts = suggestAlternatives('high-and-dry', 'helicopter');
assert.ok(alts.includes('highndry-airraft') || alts.some(a => a.includes('air')));

// TEST I.7: NPC templates exist
const templates = loadNpcTemplates('high-and-dry');
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

## Narrator Prompt Enhancement

Add to narrator context when PC asks about resources:

```
=== RESOURCE QUERY DETECTED ===
PC asked about: flying vehicles / aircraft

WORLD FACTS:
- Walston TL8: Grav vehicles possible but rare
- Thin atmosphere limits aviation economics
- Government has 1-2 grav vehicles (emergency only)

AVAILABLE OPTIONS:
- Highndry's air/raft (must retrieve from crash site)
- Ground ATV (Cr50/day, common)
- Hire guide with ATV (Cr100/day)

NARRATOR REDIRECT:
Accept the creative thinking. Mention the air/raft with the stranded ship
as a possibility - this redirects to story goal while rewarding the idea.
```

---

## Implementation Order

1. D6: Create test file
2. D1: Create walston-resources.json
3. D2: Create improvisation.json
4. D3: Create improv-examples.json
5. D4: Create resource-lookup.js
6. D5: Integrate into agm-controller
7. Verify tests pass
