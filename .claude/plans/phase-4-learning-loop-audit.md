# Phase 4 Audit: Learning Loop Integration

**Auditor:** Claude
**Date:** 2026-01-17
**Depends on:** Phase 1-3 - COMPLETE

---

## Objective

Connect extracted/generated queries to the existing learning loop so validation failures automatically trigger knowledge generation and permanent NPC updates.

---

## Integration Points

| File | Function | Integration |
|------|----------|-------------|
| `src/red-team/validator.js` | `validateNpc()` | Input: runs queries including generated |
| `src/red-team/learner.js` | `runLearningCycle()` | Already exists - needs fact_id from extracted queries |
| `src/red-team/fact-database.js` | `getFact()` | May need extension for extracted facts |

---

## Deliverables

1. **`src/knowledge-extraction/learning-integration.js`** - Bridge between extracted facts and learner
2. **Modify `src/red-team/fact-database.js`** - Support lookup of extracted facts by ID
3. **Update `tests/knowledge-extraction.test.js`** with Phase 4 tests

---

## The Gap to Bridge

Current learner expects:
```javascript
getFact(failedResult.fact_id)  // Returns fact from fact-database.js
```

But extracted facts live in:
```
data/red-team/extracted-facts/high-and-dry/*.json
```

Need: Unified fact lookup that checks both sources.

---

## Implementation Approach

```javascript
// In fact-database.js or new module
function getFact(factId) {
  // Check manual facts first
  const manualFact = getManualFact(factId);
  if (manualFact) return manualFact;

  // Check extracted facts
  if (factId.startsWith('EXT_')) {
    return getExtractedFact(factId);
  }

  return null;
}
```

---

## Test Cases

```javascript
// TEST 4.1: Extracted fact lookup by ID
const fact = getFact('EXT_MC_STA_000');
assert(fact !== null);
assert(fact.content.includes('climb') || fact.content.includes('stage'));

// TEST 4.2: Manual fact lookup still works
const manualFact = getFact('FACT_001');
assert(manualFact !== null);

// TEST 4.3: Unknown fact returns null
const unknown = getFact('NONEXISTENT_999');
assert(unknown === null);

// TEST 4.4: Learning cycle accepts extracted query failure
const failedResult = {
  npc_id: 'narrator-high-and-dry',
  query_id: 'GEN_Q001',
  fact_id: 'EXT_MC_STA_000',
  verdict: 'FAIL',
  query_text: 'Describe climbing Mount Salbarii',
  response: 'The mountain is easy to climb.'  // Wrong
};
// Should not throw - fact lookup should work
const fact = getFact(failedResult.fact_id);
assert(fact !== null);

// TEST 4.5: runLearningCycle works with extracted facts
// (Integration test - may need mock client)
// Verify learner can process extracted fact failures

// TEST 4.6: Metrics tracking
const metrics = getLearningMetrics();
assert('extraction_coverage' in metrics || 'extracted_facts_count' in metrics);
```

---

## Acceptance Criteria

1. `getFact()` returns extracted facts when ID starts with `EXT_`
2. Manual fact lookup unchanged
3. Learner can process failures from generated queries
4. No breaking changes to existing learning flow
5. All Phase 4 tests pass

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing fact lookup | TEST 4.2 validates backward compat |
| Learner expects different fact shape | Match extracted fact format to expected shape |
| Circular dependency | learning-integration.js as bridge module |

---

## Do NOT Implement

- New validation modes
- Changes to validator.js query execution
- UI or CLI changes
