# Phase 3 Audit: Context Injector

**Auditor:** Claude
**Date:** 2026-01-17
**Depends on:** Phase 1 (scene-extractor) + Phase 2 (query-generator) - COMPLETE

---

## Objective

Inject scene-specific facts into narrator prompts at runtime so NPCs describe scenes using canonical data, not hallucinations.

---

## Integration Points

| File | Function | Integration |
|------|----------|-------------|
| `src/knowledge-extraction/scene-extractor.js` | `loadFacts()` | Load extracted facts |
| `src/prompt-extensions.js` | `buildExtendedContext()` | Pattern to follow |
| `src/prompts.js` | `assembleFullPrompt()` | Call context injector |

---

## Deliverables

1. **`src/knowledge-extraction/context-injector.js`**
2. **Modify `src/prompts.js`** - integrate injection into `assembleFullPrompt()`
3. **Update `tests/knowledge-extraction.test.js`** with Phase 3 tests

---

## Injection Logic

```javascript
// Only inject for narrators
if (persona.archetype !== 'narrator') return '';

// Only when scene is set
if (!storyState?.currentScene) return '';

// Load facts for current scene
const facts = loadFacts(storyState.adventure, storyState.currentScene);

// Filter to priority 1-2 only (skip flavor)
const relevantFacts = facts.filter(f => f.priority <= 2);

// Cap at ~500 tokens
const cappedFacts = capTokens(relevantFacts, 500);

// Format injection
return formatSceneContext(storyState.currentScene, cappedFacts);
```

---

## Injection Template

```
=== CURRENT SCENE: {scene_title} ===
You have detailed knowledge of this location:
{fact_bullets}

Use these SPECIFIC facts rather than inventing details.
```

Example output:
```
=== CURRENT SCENE: Finding the Highndry ===
You have detailed knowledge of this location:
- Power plant is offline, fuel cells depleted
- Maneuver drive functional once power restored
- Thin atmosphere - filter masks required
- Volcanic gases - periodic venting

Use these SPECIFIC facts rather than inventing details.
```

---

## Test Cases

```javascript
// TEST 3.1: Injection only for narrators
const narratorPersona = { archetype: 'narrator', id: 'narrator-high-and-dry' };
const merchantPersona = { archetype: 'merchant', id: 'mr-casarii' };
const storyState = { currentScene: 'finding-the-ship', adventure: 'high-and-dry' };

const narratorCtx = buildSceneContext(narratorPersona, storyState);
const merchantCtx = buildSceneContext(merchantPersona, storyState);
assert(narratorCtx.length > 0);
assert(merchantCtx.length === 0);

// TEST 3.2: No injection when scene not set
const noSceneState = { adventure: 'high-and-dry' };
const noCtx = buildSceneContext(narratorPersona, noSceneState);
assert(noCtx.length === 0);

// TEST 3.3: Priority filtering (only tier 1-2)
const ctx = buildSceneContext(narratorPersona, storyState);
// Should not contain flavor-only facts
assert(!ctx.includes('atmosphere') || ctx.includes('thin atmosphere')); // hazard OK, mood not

// TEST 3.4: Token cap respected (~500 tokens = ~2000 chars)
assert(ctx.length <= 2500); // Some buffer for formatting

// TEST 3.5: Contains scene title
assert(ctx.includes('CURRENT SCENE'));
assert(ctx.includes('Finding') || ctx.includes('finding'));

// TEST 3.6: Contains fact bullets
assert(ctx.includes('-')); // Bullet points present

// TEST 3.7: Integration with assembleFullPrompt
const { system } = assembleFullPrompt(narratorPersona, {}, 'test', null, storyState);
assert(system.includes('CURRENT SCENE'));

// TEST 3.8: No injection breaks existing prompts
// Narrator without storyState still works
const { system: basicSystem } = assembleFullPrompt(narratorPersona, {}, 'test', null, null);
assert(basicSystem.includes(narratorPersona.name));
assert(!basicSystem.includes('CURRENT SCENE'));
```

---

## Acceptance Criteria

1. Only injects for `archetype: narrator`
2. Only injects when `storyState.currentScene` is set
3. Filters to priority 1-2 facts (no flavor)
4. Caps injection at ~500 tokens
5. Formats with scene title header
6. Integrates with `assembleFullPrompt()` without breaking existing behavior
7. All Phase 3 tests pass

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaks existing prompts | TEST 3.8 validates backward compat |
| Facts not loading | Graceful fallback (empty string) |
| Token overflow | Hard cap at 500 tokens |

---

## Do NOT Implement

- Learning loop integration (Phase 4)
- Modifications to learner.js
