# Phase 2 Audit: Query Generator

**Auditor:** Claude
**Date:** 2026-01-17
**Depends on:** Phase 1 (scene-extractor.js) - COMPLETE

---

## Objective

Auto-generate validation queries from extracted facts so the red-team system can test whether NPCs know scene-specific information.

---

## Integration Points

| File | Function | Integration |
|------|----------|-------------|
| `src/knowledge-extraction/scene-extractor.js` | `extractFacts()`, `loadFacts()` | Input: extracted facts |
| `src/red-team/query-engine.js` | `loadQueries()` | Modify to merge generated queries |
| `data/red-team/queries.json` | Manual queries | Merge, don't replace |

---

## Deliverables

1. **`src/knowledge-extraction/query-generator.js`**
2. **Update `tests/knowledge-extraction.test.js`** with Phase 2 tests
3. **Output:** `data/red-team/generated-queries/high-and-dry.json`

---

## Query Output Format

```json
{
  "id": "GEN_Q001",
  "source": "extracted",
  "fact_id": "EXT_MC_STA_000",
  "tier": 2,
  "target_npcs": ["narrator-high-and-dry"],
  "query": "What are the stages of climbing Mount Salbarii?",
  "expected_keywords": ["500m", "1400m", "stages", "crater"],
  "failure_keywords": []
}
```

---

## Template System

```javascript
const TEMPLATES = {
  mechanics: [
    "What are the effects of {topic}?",
    "How does {topic} work?",
    "What penalties apply for {topic}?"
  ],
  geography: [
    "Describe {location}",
    "What's the terrain like at {location}?",
    "Tell me about {location}"
  ],
  ship: [
    "What's wrong with the ship?",
    "What repairs are needed?",
    "What's the status of {system}?"
  ],
  hazards: [
    "What dangers should I watch for?",
    "What are the environmental hazards?",
    "What conditions affect the area?"
  ]
};
```

Map fact sources to templates:
- `altitude_sickness` → mechanics
- `stages` → geography
- `ship_condition`, `repair_requirements` → ship
- `environmental_hazards` → hazards

---

## Test Cases

```javascript
// TEST 2.1: Query generation from mechanics facts
// Input: Altitude sickness facts (DM-2, DM-4)
// Expected: Generates query about altitude effects
const mechanicsFacts = facts.filter(f => f.priority === 1);
const queries = generateQueries(mechanicsFacts);
assert(queries.some(q => q.query.toLowerCase().includes('altitude')));

// TEST 2.2: Query has expected/failure keywords
// Expected: Keywords from fact propagate to query
const q = queries[0];
assert(q.expected_keywords.length > 0);
assert(q.expected_keywords.some(k => q.fact_id && facts.find(f => f.id === q.fact_id)?.keywords.includes(k)));

// TEST 2.3: Query tagged as extracted
assert(queries.every(q => q.source === 'extracted'));

// TEST 2.4: Query targets correct NPC
// Narrator facts → narrator NPC
const narratorQueries = queries.filter(q => q.target_npcs.includes('narrator-high-and-dry'));
assert(narratorQueries.length > 0);

// TEST 2.5: Tier assignment matches fact priority
// Priority 1 facts → Tier 1 queries
const tier1Queries = queries.filter(q => q.tier === 1);
assert(tier1Queries.every(q => {
  const fact = facts.find(f => f.id === q.fact_id);
  return fact?.priority === 1;
}));

// TEST 2.6: No duplicate queries for same fact
const factIds = queries.map(q => q.fact_id);
const uniqueFactIds = [...new Set(factIds)];
assert(factIds.length === uniqueFactIds.length);

// TEST 2.7: Query ID format
assert(queries.every(q => q.id.startsWith('GEN_Q')));

// TEST 2.8: Integration - loadQueries returns merged set
// After generation, query-engine should return both manual + generated
const allQueries = loadQueries();
const manualQueries = allQueries.filter(q => q.source !== 'extracted');
const generatedQueries = allQueries.filter(q => q.source === 'extracted');
assert(manualQueries.length > 0);  // Original manual queries preserved
assert(generatedQueries.length > 0);  // New generated queries added
```

---

## Acceptance Criteria

1. Generates queries from extracted facts
2. Uses template system for natural question phrasing
3. Propagates keywords from facts to queries
4. Tags queries with `source: "extracted"`
5. Assigns tiers matching fact priorities
6. Merges with existing manual queries (no replacement)
7. All Phase 2 tests pass

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Template produces awkward questions | Review templates, allow manual override |
| Too many queries generated | Dedupe by fact, cap per scene |
| Keywords too specific/generic | Balance: 3-5 keywords, mix specific + general |

---

## Do NOT Implement

- Context injector (Phase 3)
- Learning loop integration (Phase 4)
- Modification to prompts.js
