# Audit Plan: Scene Narrative Elements System

**Status:** READY FOR GENERATOR
**Date:** 2026-01-17
**Auditor:** Claude (Auditor role)

---

## Objective

Enrich scene JSON with structured narrative elements (obstacles, discoveries, objectives) at stage level. Enable narrator to track progression, surface relevant challenges, and acknowledge player accomplishments.

---

## Deliverables

| # | File | Description |
|---|------|-------------|
| D1 | `data/adventures/high-and-dry/scenes/mountain-climb.json` | Add stage-level objectives, obstacles, discoveries, enhanced skill_checks |
| D2 | `src/decision-tracker.js` | Add `stageProgress` state structure and accessor functions |
| D3 | `src/narrative-tracker.js` | NEW: `recordObstacleResolution()`, `recordDiscovery()` functions |
| D4 | `src/knowledge-extraction/context-injector.js` | Enhance `buildSceneContext()` to include stage narrative elements |
| D5 | `tests/narrative-elements.test.js` | 8 test cases encoding invariants |

---

## Data Schema

### Stage-Level Fields (D1)

```javascript
stage: {
  id: string,           // Slug ID (e.g., "lower-slopes")
  name: string,         // Display name
  objective: string,    // What player should accomplish

  obstacle: {           // Optional
    type: 'terrain' | 'environmental' | 'social' | 'mechanical' | 'combat',
    description: string,
    resolution: string
  },

  discoveries: [{       // Array
    id: string,
    type: 'lore' | 'tactical' | 'social' | 'item' | 'secret',
    trigger: 'automatic' | 'investigate' | 'skill_check' | 'npc_interaction',
    content: string
  }],

  skill_checks: [{      // Enhanced with outcomes
    ref: string,
    trigger: string,
    on_success: string,
    on_failure: string
  }]
}
```

### State Tracking (D2)

```javascript
storyState.stageProgress = {
  'scene-id': {
    'stage-id': {
      completed: boolean,
      obstacleResolved: string | null,  // Resolution method chosen
      discoveries: string[]             // Discovery IDs found
    }
  }
}
```

### Recording Functions (D3)

```javascript
// narrative-tracker.js exports:
recordObstacleResolution(storyState, sceneId, stageId, resolution)
recordDiscovery(storyState, sceneId, stageId, discoveryId)
getStageProgress(storyState, sceneId, stageId)
initStageProgress(storyState, sceneId, stageId)
```

### Context Injection Format (D4)

When at a stage, inject:
```
=== CURRENT STAGE: Middle Ascent (900-1100m) ===
OBJECTIVE: Maintain pace while managing altitude effects

OBSTACLE: Altitude effects begin at this elevation
- Type: Environmental
- Resolution: Slow pace to avoid sickness, or push through with risk

DISCOVERIES AVAILABLE:
- [tactical] Watching the party's pace reveals who handles altitude well

PRIOR PROGRESS:
- Completed: Lower Slopes (used shortcut route)
- Found: shortcut-visible
```

---

## Test Cases (D5)

All tests must pass. Tests are acceptance criteria.

```javascript
// TEST N.1: Stage has objective field
// Input: Load mountain-climb.json
// Assert: stages[0].objective exists and is non-empty string

// TEST N.2: Stage has obstacle structure
// Input: Load mountain-climb.json
// Assert: stages[0].obstacle exists with type, description, resolution fields

// TEST N.3: Discoveries have required fields
// Input: Load mountain-climb.json, get stages[0].discoveries[0]
// Assert: has id, type, trigger, content fields

// TEST N.4: Skill checks have outcomes
// Input: Load mountain-climb.json, get stages with skill_checks
// Assert: skill_checks have on_success and on_failure fields

// TEST N.5: recordObstacleResolution tracks resolution
// Input: Call recordObstacleResolution(state, 'mountain-climb', 'lower-slopes', 'shortcut')
// Assert: state.stageProgress['mountain-climb']['lower-slopes'].obstacleResolved === 'shortcut'

// TEST N.6: recordDiscovery tracks discoveries
// Input: Call recordDiscovery(state, 'mountain-climb', 'lower-slopes', 'shortcut-visible')
// Assert: state.stageProgress['mountain-climb']['lower-slopes'].discoveries.includes('shortcut-visible')

// TEST N.7: buildSceneContext includes stage narrative
// Input: Build context with currentStage set, scene has stage objectives
// Assert: Context includes 'OBJECTIVE' and 'OBSTACLE' (or appropriate fallback)

// TEST N.8: buildSceneContext includes prior progress
// Input: Build context with completed stage in stageProgress
// Assert: Context includes 'Completed' or 'PRIOR PROGRESS'
```

---

## Implementation Order

1. D5: Create test file (tests run, all fail initially)
2. D1: Update mountain-climb.json with narrative structure
3. D3: Create narrative-tracker.js with recording functions
4. D2: Integrate stageProgress into decision-tracker.js (or just use narrative-tracker)
5. D4: Enhance buildSceneContext for narrative elements
6. Verify all 8 tests pass

---

## Constraints

- New fields are additive (don't break existing stage fields)
- Stage ID uses existing `slugifyStage()` from decision-tracker.js
- Context injection should be token-aware (summarize completed stages)
- Only mountain-climb.json needs full narrative structure for this audit

---

## Verification Command

```bash
node tests/narrative-elements.test.js
```

All 8 tests must pass.
