# Audit Plan: Anders Knowledge Boundaries Fix

**Status:** READY FOR GENERATOR
**Date:** 2026-01-17
**Priority:** CRITICAL - Plot-breaking errors

---

## Problem Statement

Anders Casarii has knowledge that breaks the adventure plot:

### Error 1: Ship Location History
**WRONG:** "limped into Flammarion three weeks ago"
**CORRECT:** Ship was abandoned ON WALSTON. Crew traveled separately to Flammarion where they were arrested. The ship never came to Flammarion.

### Error 2: Specific Location
**WRONG:** Anders knows "mountains near Mount Salbarii"
**CORRECT:** Anders only knows "somewhere on Walston" - the specific location is a MYSTERY the PCs must discover. This is a core plot point.

---

## Root Cause

Anders' `knowledge_base` contains information he shouldn't have:
- `the_ship` mentions "mountains near Mount Salbarii"
- `the_previous_crew` implies ship came to Flammarion

These entries were likely copied from narrator knowledge without considering NPC knowledge boundaries.

---

## Deliverables

| # | File | Type | Description |
|---|------|------|-------------|
| D1 | `data/npcs/mr-casarii.json` | MODIFY | Fix knowledge_base entries |
| D2 | `data/red-team/queries.json` | MODIFY | Add knowledge boundary tests |
| D3 | `data/red-team/facts.json` | MODIFY | Add knowledge boundary facts |
| D4 | `tests/knowledge-boundaries.test.js` | NEW | Tests for NPC knowledge limits |

---

## D1: Fix mr-casarii.json knowledge_base

### Remove/Fix These Entries:

**the_ship** - REMOVE location details:
```json
// BEFORE (WRONG):
"the_ship": "Highndry is a Type S Scout/Courier... She's currently parked on Walston - specifically, somewhere in the mountains near a place called Mount Salbarii..."

// AFTER (CORRECT):
"the_ship": "Highndry is a Type S Scout/Courier, standard configuration. She's currently somewhere on Walston - we don't have precise coordinates. The previous crew disabled her control electronics before abandoning her, and our ground contacts haven't been able to locate her yet. You'll need to do some legwork when you arrive."
```

**the_previous_crew** - Fix timeline:
```json
// BEFORE (WRONG - implies ship came to Flammarion):
"The previous operators? They were arrested when they reached Flammarion..."

// AFTER (CORRECT):
"the_previous_crew": "The previous operators abandoned Highndry on Walston, then caught commercial transport to Flammarion where they were arrested on fraud charges. Ship records recovered from their personal effects showed the refit scam - breaker-yard parts sold as originals. The ship itself is still on Walston; we just don't know exactly where."
```

### Add Explicit Knowledge Boundary:
```json
"knowledge_limits": {
  "does_not_know": [
    "Exact location of Highndry on Walston",
    "Mount Salbarii connection",
    "Volcano situation",
    "Local Walston politics"
  ],
  "if_asked_about_location": "I don't have precise coordinates. Our Walston contacts are still trying to locate her. You'll need to ask around when you arrive - try the port authority or local officials."
}
```

---

## D2: Add Knowledge Boundary Queries

**File:** `data/red-team/queries.json`

Add new queries to test Anders doesn't leak plot info:

```json
{
  "id": "Q_BOUNDARY_001",
  "tier": 1,
  "fact_id": "FACT_BOUNDARY_001",
  "target_npcs": ["mr-casarii"],
  "query": "Where exactly is the Highndry on Walston?",
  "expected_keywords": ["don't know", "unknown", "ask around", "locate", "contacts"],
  "failure_keywords": ["Mount Salbarii", "mountains", "volcano", "120 kilometers", "crater"]
},
{
  "id": "Q_BOUNDARY_002",
  "tier": 1,
  "fact_id": "FACT_BOUNDARY_002",
  "target_npcs": ["mr-casarii"],
  "query": "How did the ship get to Flammarion?",
  "expected_keywords": ["Walston", "abandoned", "crew traveled", "commercial transport"],
  "failure_keywords": ["limped", "flew here", "docked here", "arrived here"]
},
{
  "id": "Q_BOUNDARY_003",
  "tier": 1,
  "fact_id": "FACT_BOUNDARY_003",
  "target_npcs": ["mr-casarii"],
  "query": "Tell me about Mount Salbarii",
  "expected_keywords": ["don't know", "unfamiliar", "Walston", "ask locals"],
  "failure_keywords": ["volcano", "crater", "120 kilometers", "ship is there"]
}
```

---

## D3: Add Knowledge Boundary Facts

**File:** `data/red-team/facts.json` (or extracted-facts)

```json
{
  "id": "FACT_BOUNDARY_001",
  "category": "knowledge_boundaries",
  "content": "Anders Casarii does NOT know the specific location of Highndry on Walston. He only knows it's 'somewhere on Walston'. The mountain/volcano location is a mystery for PCs to discover.",
  "relevant_npcs": ["mr-casarii"],
  "keywords": ["unknown", "don't know", "ask around"],
  "failure_keywords": ["Mount Salbarii", "mountains", "volcano", "crater"]
},
{
  "id": "FACT_BOUNDARY_002",
  "category": "knowledge_boundaries",
  "content": "The Highndry never came to Flammarion. It was abandoned on Walston. The crew traveled separately to Flammarion via commercial transport.",
  "relevant_npcs": ["mr-casarii", "narrator-high-and-dry"],
  "keywords": ["abandoned on Walston", "crew traveled separately"],
  "failure_keywords": ["limped into Flammarion", "ship arrived", "docked at Flammarion"]
},
{
  "id": "FACT_BOUNDARY_003",
  "category": "knowledge_boundaries",
  "content": "Anders knows nothing about Mount Salbarii, the volcano, or Walston geography. He's an administrator on Flammarion, not a Walston local.",
  "relevant_npcs": ["mr-casarii"],
  "keywords": ["unfamiliar", "don't know Walston geography"],
  "failure_keywords": ["volcano", "crater", "mountain location"]
}
```

---

## D4: Knowledge Boundary Tests

**File:** `tests/knowledge-boundaries.test.js`

```javascript
// TEST KB.1: mr-casarii the_ship entry does NOT contain "Mount Salbarii"
// TEST KB.2: mr-casarii the_ship entry does NOT contain "mountains"
// TEST KB.3: mr-casarii the_previous_crew does NOT say ship came to Flammarion
// TEST KB.4: mr-casarii has knowledge_limits field
// TEST KB.5: knowledge_limits.does_not_know includes location details
// TEST KB.6: Red team queries include boundary tests (Q_BOUNDARY_*)
```

---

## Implementation Order

1. D4: Create tests first (TDD)
2. D1: Fix mr-casarii.json
3. D2: Add boundary queries
4. D3: Add boundary facts
5. Run `npm run redteam mr-casarii` to verify

---

## Verification

```bash
node tests/knowledge-boundaries.test.js
npm run redteam mr-casarii  # Should pass boundary queries
```

---

## Design Principle

**NPCs should have `knowledge_limits` documenting what they DON'T know.**

This prevents:
- Plot spoilers
- Accidental knowledge leaks
- Breaking mystery/discovery gameplay

Red team queries should test BOTH:
- Does NPC know what they should? (positive tests)
- Does NPC avoid knowing what they shouldn't? (boundary tests)
