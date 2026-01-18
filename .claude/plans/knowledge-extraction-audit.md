# Audit: Adventure-Sourced NPC Knowledge System

**Auditor:** Claude (Plan Mode)
**Date:** 2026-01-17
**Status:** REVIEW BEFORE IMPLEMENTATION

---

## Objectives

### Primary Objective
Narrator NPCs must describe scenes using canonical facts from scene JSONs, not hallucinated details.

### Specific Goals
1. **Extract** structured facts from adventure scene JSONs automatically
2. **Generate** validation queries from those facts
3. **Inject** scene-specific context into narrator prompts at runtime
4. **Learn** from validation failures → permanent knowledge_base entries

---

## Test Cases

### Phase 1: Scene Extractor Tests

```javascript
// TEST 1.1: Structured field extraction
// Input: mountain-climb.json
// Expected: Extract all 6 stages with altitude ranges
const result = await extractFacts('mountain-climb.json');
assert(result.facts.some(f => f.content.includes('500m') && f.content.includes('1400m')));
assert(result.facts.some(f => f.source === 'mountain-climb.json:stages'));

// TEST 1.2: Altitude sickness mechanics extraction
// Expected: DM penalties extracted as priority 1 (mechanics)
const mechanicsFacts = result.facts.filter(f => f.priority === 1);
assert(mechanicsFacts.some(f => f.content.includes('DM-2') || f.content.includes('DM-4')));

// TEST 1.3: Ship condition extraction
// Input: finding-the-ship.json
// Expected: Power plant offline, fuel depleted extracted
const shipResult = await extractFacts('finding-the-ship.json');
assert(shipResult.facts.some(f => f.content.includes('power') && f.content.includes('offline')));

// TEST 1.4: Environmental hazards extraction
// Expected: Thin atmosphere, volcanic gases extracted
assert(shipResult.facts.some(f => f.content.includes('thin atmosphere')));

// TEST 1.5: Prose extraction via LLM
// Input: narrator_prompt field
// Expected: Key facts extracted (ship registry, crater location)
const proseFacts = shipResult.facts.filter(f => f.source.includes('narrator_prompt'));
assert(proseFacts.length > 0);
```

### Phase 2: Query Generator Tests

```javascript
// TEST 2.1: Query generation from mechanics facts
// Expected: Generates "What are the effects of altitude sickness?" type queries
const queries = await generateQueries(mechanicsFacts);
assert(queries.some(q => q.query.toLowerCase().includes('altitude')));

// TEST 2.2: Query has expected/failure keywords
// Expected: Each query has validation keywords
assert(queries.every(q => q.expected_keywords.length > 0));

// TEST 2.3: Query tagged as extracted
// Expected: source field = "extracted"
assert(queries.every(q => q.source === 'extracted'));

// TEST 2.4: Query targets correct NPC
// Expected: narrator queries target narrator-high-and-dry
const narratorQueries = queries.filter(q => q.target_npcs.includes('narrator-high-and-dry'));
assert(narratorQueries.length > 0);
```

### Phase 3: Context Injector Tests

```javascript
// TEST 3.1: Injection only for narrators
const narratorPersona = { archetype: 'narrator', id: 'narrator-high-and-dry' };
const npcPersona = { archetype: 'merchant', id: 'mr-casarii' };
const storyState = { currentScene: 'finding-the-ship', adventure: 'high-and-dry' };

const narratorContext = buildSceneContext(narratorPersona, storyState);
const npcContext = buildSceneContext(npcPersona, storyState);

assert(narratorContext.length > 0);  // Narrator gets scene context
assert(npcContext.length === 0);     // NPC does not

// TEST 3.2: Context only when scene is set
const noSceneState = { adventure: 'high-and-dry' };
const noContext = buildSceneContext(narratorPersona, noSceneState);
assert(noContext.length === 0);

// TEST 3.3: Priority filtering (only tier 1-2)
// Expected: Flavor facts (tier 3) not injected
const injectedFacts = parseInjectedFacts(narratorContext);
assert(injectedFacts.every(f => f.priority <= 2));

// TEST 3.4: Token cap respected
// Expected: Injected context <= 500 tokens (~2000 chars)
assert(narratorContext.length <= 2000);

// TEST 3.5: Integration with buildSystemPrompt
// Expected: Scene context appears in final system prompt
const fullPrompt = buildSystemPrompt(narratorPersona);
// After integration, should include scene context when storyState provided
```

### Phase 4: Learning Loop Tests

```javascript
// TEST 4.1: Extracted query failures feed learner
// Setup: Run validation with a query that will fail
const failedResult = {
  npc_id: 'narrator-high-and-dry',
  query_id: 'EXT_Q001',  // Extracted query
  fact_id: 'EXT_MC_001',
  verdict: 'FAIL',
  query_text: 'Describe the crater',
  response: 'The dry lakebed...'  // Wrong!
};

const cycle = await runLearningCycle(failedResult);
assert(cycle.final_status === 'LEARNED' || cycle.final_status === 'FAILED_VERIFICATION');

// TEST 4.2: Successful learning adds to knowledge_base
// Expected: After learning, NPC has new knowledge entry
const npc = loadNpc('narrator-high-and-dry');
assert(npc.knowledge_base.crater_geography !== undefined);

// TEST 4.3: Metrics tracking
// Expected: Track extraction coverage, pass rates
const metrics = getLearningMetrics();
assert(metrics.extraction_coverage !== undefined);
assert(metrics.validation_pass_rate !== undefined);
```

### Integration Test: The Crater Problem

```javascript
// THE CANONICAL TEST: Narrator describes crater correctly
// This is the original problem that motivated this system

// 1. Extract facts from finding-the-ship.json
const facts = await extractFacts('finding-the-ship.json');

// 2. Generate query about crater
const queries = await generateQueries(facts);
const craterQuery = queries.find(q => q.query.toLowerCase().includes('crater'));

// 3. Inject scene context
const storyState = { currentScene: 'finding-the-ship', adventure: 'high-and-dry' };
const prompt = assembleFullPrompt(narratorPersona, memory, 'Describe the crater', null, storyState);

// 4. Query narrator
const response = await chat(client, prompt.system, prompt.messages);

// 5. Validate response
const validation = validateResponse(response.content, craterQuery);
assert(validation.verdict === 'PASS');

// 6. Specifically check for hallucination keywords
assert(!response.content.toLowerCase().includes('dry lakebed'));
assert(!response.content.toLowerCase().includes('desert'));
```

---

## Plan Validation

### Confirmed Integration Points
| File | Line | Purpose | Status |
|------|------|---------|--------|
| `src/prompts.js` | 23-79 | buildSystemPrompt - add scene context | CONFIRMED |
| `src/prompt-extensions.js` | 232-304 | buildExtendedContext - pattern to follow | CONFIRMED |
| `src/red-team/query-engine.js` | 38-67 | loadQueries - merge extracted queries | CONFIRMED |
| `src/red-team/learner.js` | 284-383 | runLearningCycle - entry point | CONFIRMED |

### Data Quality Issue Identified

**WARNING:** The plan mentions "warm volcanic lake" and "island" geography, but these details are NOT in the current scene JSONs:

- `finding-the-ship.json`: No mention of lake or island
- `mountain-climb.json`: No lake/island details

**Resolution Options:**
1. Add missing geography to scene JSONs (data fix)
2. Extract from `data/worlds/` if it exists there
3. Accept current data and extract what's actually there

**Recommendation:** Proceed with extraction of actual data. Missing canonical facts are a data quality issue to address separately.

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Over-extraction bloats prompts | Medium | Medium | Token cap (500), priority filter |
| LLM prose extraction errors | Medium | Low | Keyword validation before storage |
| Circular learning (bad fact reinforced) | Low | High | Verify against source, not just keywords |
| Missing source data | **HIGH** | Medium | Log missing facts, alert for data gaps |

---

## Handoff Checklist

Before passing to generator:

- [x] Objectives defined
- [x] Test cases written
- [x] Integration points confirmed
- [x] Risks identified
- [ ] **User approval on plan**

---

## User Decisions (2026-01-17)

1. **Data gap:** Extract what exists. Missing geography is a separate data quality issue.
2. **Test format:** Separate test file (`tests/knowledge-extraction.test.js`)
3. **Scope:** Phase by phase with review between each

---

## Phase 1 Handoff to Generator

**Scope:** Scene Extractor only

**Deliverables:**
1. `src/knowledge-extraction/scene-extractor.js`
2. `tests/knowledge-extraction.test.js` (Phase 1 tests only)
3. Output directory: `data/red-team/extracted-facts/high-and-dry/`

**Acceptance Criteria:**
- Extracts structured fields (stages, altitude_sickness, ship_condition, etc.)
- Extracts prose fields via Haiku LLM
- Outputs facts in specified JSON format
- All Phase 1 tests pass

**Do NOT implement:** Query generator, context injector, or learning loop integration yet.
