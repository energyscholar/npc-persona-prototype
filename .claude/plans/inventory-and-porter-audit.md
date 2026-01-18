# Audit Plan: PC Inventory System & Vargr Porter NPC

**Status:** READY FOR GENERATOR
**Date:** 2026-01-17

---

## Overview

Two interconnected features:
1. **PC Inventory Tracking** - Track important items that unlock barriers
2. **Vargr Porter NPC** - Major helpful NPC who knows everyone on Walston

---

## Part 1: PC Inventory System

### Inventory Structure

```json
{
  "inventory": [
    {
      "id": "iiss-detached-duty-documents",
      "name": "IISS Detached Duty Documents",
      "description": "Official Scout Service documentation proving your authority over Highndry",
      "acquired_from": "mr-casarii",
      "acquired_scene": "scout-office",
      "type": "document",
      "unlocks": ["ship-access", "official-credibility", "scout-service-contacts"]
    },
    {
      "id": "repair-kit-crates",
      "name": "Repair Kit (3 Flight Cases)",
      "description": "Circuit panels, tools, diagnostic unit with temporary control software, general spares",
      "acquired_from": "mr-casarii",
      "acquired_scene": "scout-office",
      "type": "cargo",
      "weight": "heavy",
      "requires_transport": true,
      "unlocks": ["ship-repair"]
    }
  ]
}
```

### Inventory Functions

```javascript
// In storyState:
storyState.inventory = storyState.inventory || [];

// Functions:
function addToInventory(session, item) { ... }
function hasItem(session, itemId) { ... }
function getItemsOfType(session, type) { ... }
function checkUnlock(session, unlockKey) { ... }
```

---

## Part 2: Spare Parts Journey

### Scene Flow (Arrival at Walston)

1. **Disembark from Autumn Gold** - Narrator describes arrival
2. **Cargo Collection** - PC reminded of repair kit crates
3. **Customs** - Weapons stored, business stated, crates noted
4. **Porter Appears** - Vargr porter offers to help with heavy crates
5. **Ground Transport** - To hotel
6. **Hotel Check-in** - Vargr doorman, room details

### Scene Updates Needed

- `walston-arrival.json` - Add cargo collection beat
- `customs-checkpoint.json` - Reference the crates going through
- Add `startown-hotel.json` scene

---

## Part 3: Vargr Porter NPC

### NPC: Gvoudzon (Vargr Porter)

```json
{
  "id": "vargr-porter-gvoudzon",
  "name": "Gvoudzon",
  "archetype": "fixer",
  "species": "vargr",
  "world": "Walston",
  "title": "Porter and Local Fixer",

  "personality": {
    "traits": ["helpful", "well-connected", "practical", "chatty", "loyal-once-trusted"],
    "speech": "friendly and direct, drops names casually, uses 'friend' often, slightly broken Imperial but fluent",
    "quirks": [
      "knows everyone's business",
      "always has a cousin or friend who can help",
      "takes pride in being useful",
      "remembers everyone he's helped"
    ]
  },

  "background": "Gvoudzon has worked the starport for twelve years. In a town of 3000, he's carried luggage for half of them at some point. He knows who needs what, who sells what, and who can fix what. The Vargr community trusts him, and the humans respect his reliability. He's not just a porter - he's the guy who knows a guy.",

  "knowledge_base": {
    "ground_transport": "Friend, you need wheels? Talk to Dhangaz at the vehicle yard - he has air/rafts, ground cars, ATVs. Tell him Gvoudzon sent you, he gives fair price. For something cheaper, old Karlssen sometimes sells his spare crawler.",
    "local_guide": "You need someone who knows the backlands? My cousin Aethkurz - best tracker on Settlement Island. Knows every trail, every cave, every danger. Very reliable, very discreet.",
    "driver": "If you just need driver, not guide - Taeksu runs a taxi service. Human, but good. Or my nephew can drive if you need Vargr who understands... certain situations.",
    "ultralight": "Ha! You want to fly? Crazy Eriksen - everyone calls her that, she doesn't mind - she builds ultralights in her barn. Flies them over the volcano for fun. She might rent one, or take you up. Very skilled, very... enthusiastic.",
    "repairs": "What needs fixing? Electronics, Saerz at the tech shop. Mechanical, the port has a maintenance bay - ask for Hendricks. Anything weird or illegal, you didn't hear it from me, but find Rrukhka at the Downport Bar after dark."
  },

  "connections": {
    "dhangaz": "Vehicle dealer, fair prices",
    "aethkurz": "Cousin, wilderness guide",
    "taeksu": "Human taxi driver",
    "eriksen": "Ultralight hobbyist/pilot",
    "saerz": "Electronics repair",
    "hendricks": "Port mechanic",
    "rrukhka": "Fixer for questionable needs"
  },

  "goals": [
    {
      "id": "be_helpful",
      "description": "Help these offworlders - they look like they need it",
      "priority": 8,
      "status": "active",
      "trigger": "Offworlders with heavy cargo",
      "satisfied_when": "They're settled and have what they need",
      "behavior_when_active": [
        "Offer to carry luggage",
        "Ask where they're staying",
        "Volunteer useful information",
        "Connect them with right people"
      ]
    },
    {
      "id": "earn_tips",
      "description": "Make a living",
      "priority": 6,
      "status": "active",
      "behavior_when_active": [
        "Provide good service",
        "Be memorable so they come back"
      ]
    }
  ],

  "knowledge_limits": {
    "does_not_know": [
      "Location of Highndry",
      "Mount Salbarii specifics",
      "Geology or volcano details",
      "Off-world politics"
    ],
    "if_asked": "Hmm, that I don't know, friend. But I know who might..."
  }
}
```

---

## Part 4: Hotel Scene

### NPC: Hotel Doorman (Minor)

```json
{
  "id": "hotel-doorman-walston",
  "name": "Kfoukh",
  "archetype": "service",
  "species": "vargr",
  "title": "Hotel Doorman",
  "personality": {
    "traits": ["formal", "helpful", "observant"],
    "speech": "polite, professional, notes everything"
  },
  "background": "Works the door at the Startown Hotel. Sees everyone who comes and goes."
}
```

### Scene: startown-hotel.json

```json
{
  "id": "startown-hotel",
  "title": "The Startown Hotel",
  "setting": "Walston's only proper hotel, near the starport",

  "description": "A modest but clean establishment. Three stories, local stone construction, modern amenities by frontier standards. The lobby has a small bar, a news terminal, and a bored-looking clerk.",

  "atmosphere": "Quiet, functional, surprisingly comfortable. Clearly accustomed to offworld visitors.",

  "details": {
    "rooms": "Simple but clean. Fresher unit, terminal with local net access, climate control.",
    "rates": "Cr50/night standard, Cr80/night suite",
    "amenities": "Lobby bar, breakfast included, secure luggage storage",
    "staff": "Human clerk, Vargr doorman (Kfoukh), cleaning staff"
  }
}
```

---

## Deliverables

| # | File | Type | Description |
|---|------|------|-------------|
| D1 | `src/inventory.js` | NEW | Inventory tracking functions |
| D2 | `src/adventure-player.js` | MODIFY | Initialize inventory, wire functions |
| D3 | `data/npcs/vargr-porter-gvoudzon.json` | NEW | Major Vargr fixer NPC |
| D4 | `data/npcs/hotel-doorman-walston.json` | NEW | Minor hotel NPC |
| D5 | `data/adventures/high-and-dry/scenes/startown-hotel.json` | NEW | Hotel scene |
| D6 | `data/adventures/high-and-dry/scenes/walston-arrival.json` | MODIFY | Add cargo collection, porter intro |
| D7 | `data/items/mission-equipment.json` | NEW | Item definitions |
| D8 | `tests/inventory-system.test.js` | NEW | Inventory tests |

---

## D1: Inventory Module

**File:** `src/inventory.js`

```javascript
/**
 * PC Inventory System
 * Tracks items that unlock barriers and enable actions
 */

function initializeInventory(storyState) {
  storyState.inventory = storyState.inventory || [];
  return storyState.inventory;
}

function addToInventory(session, item) {
  const inv = session.storyState.inventory;
  if (!inv.find(i => i.id === item.id)) {
    inv.push({
      ...item,
      acquired_at: new Date().toISOString(),
      acquired_scene: session.storyState.currentScene
    });
    return true;
  }
  return false; // Already have it
}

function hasItem(session, itemId) {
  return session.storyState.inventory.some(i => i.id === itemId);
}

function getItemsOfType(session, type) {
  return session.storyState.inventory.filter(i => i.type === type);
}

function checkUnlock(session, unlockKey) {
  return session.storyState.inventory.some(i =>
    i.unlocks && i.unlocks.includes(unlockKey)
  );
}

function getCargoItems(session) {
  return session.storyState.inventory.filter(i => i.type === 'cargo');
}

function describeInventory(session) {
  const inv = session.storyState.inventory;
  if (inv.length === 0) return "You're not carrying anything notable.";

  const docs = inv.filter(i => i.type === 'document');
  const cargo = inv.filter(i => i.type === 'cargo');
  const other = inv.filter(i => !['document', 'cargo'].includes(i.type));

  let desc = '';
  if (docs.length) desc += `Documents: ${docs.map(d => d.name).join(', ')}\n`;
  if (cargo.length) desc += `Cargo: ${cargo.map(c => c.name).join(', ')}\n`;
  if (other.length) desc += `Other: ${other.map(o => o.name).join(', ')}\n`;

  return desc.trim();
}

module.exports = {
  initializeInventory,
  addToInventory,
  hasItem,
  getItemsOfType,
  checkUnlock,
  getCargoItems,
  describeInventory
};
```

---

## D7: Item Definitions

**File:** `data/items/mission-equipment.json`

```json
{
  "items": [
    {
      "id": "iiss-detached-duty-documents",
      "name": "IISS Detached Duty Documents",
      "description": "Official Scout Service documentation proving your authority over Highndry. Includes lease terms, ship registration, and your identification as the assigned operator.",
      "type": "document",
      "unlocks": ["ship-access", "official-credibility", "scout-service-contacts"],
      "show_to": "Present these when you need to prove your authority over the ship"
    },
    {
      "id": "repair-kit-crates",
      "name": "Repair Kit (3 Flight Cases)",
      "description": "Three heavy flight cases containing circuit panels, tools, a portable diagnostic unit with temporary control software, and a container of general spares. The diagnostic unit can upload a software patch that'll keep Highndry flying for three months.",
      "type": "cargo",
      "weight": "heavy",
      "requires_transport": true,
      "unlocks": ["ship-repair"],
      "contents": [
        "Circuit panels",
        "Portable diagnostic unit",
        "Temporary control software",
        "General spares",
        "Tool kit"
      ]
    }
  ]
}
```

---

## Test Cases (D8)

```javascript
// TEST I.1: Inventory initializes empty
// TEST I.2: addToInventory adds item
// TEST I.3: hasItem returns true for added item
// TEST I.4: checkUnlock returns true when item has unlock key
// TEST I.5: getCargoItems filters correctly
// TEST I.6: Duplicate items not added twice
// TEST I.7: Gvoudzon NPC exists and has connections
// TEST I.8: Hotel scene exists with details
```

---

## Implementation Order

1. D8: Create tests
2. D7: Create item definitions
3. D1: Create inventory module
4. D2: Wire into adventure-player
5. D3: Create Gvoudzon NPC
6. D4: Create hotel doorman NPC
7. D5: Create hotel scene
8. D6: Update walston-arrival scene
9. Run tests

---

## Verification

```bash
node tests/inventory-system.test.js
npm run redteam vargr-porter-gvoudzon  # If queries exist
```
