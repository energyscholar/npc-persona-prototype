# Audit: Hierarchical Scene/Stage System

**Auditor:** Claude
**Date:** 2026-01-17
**Scope:** Add stage-level navigation within scenes for High and Dry walkthrough

---

## Objective

Scenes like `mountain-climb` have internal `stages` (Lower Slopes → Final Ascent). Expose these in the menu system hierarchically so users can navigate to specific stages without a flat list of 6+ extra items.

---

## Current State

```
ACT 3: THE MOUNTAIN
  1. [ ] Climbing Mount Salbarii    ← Flat, no stage visibility
  2. [ ] Finding the Highndry
```

## Target State

```
ACT 3: THE MOUNTAIN
  1. [>] Climbing Mount Salbarii    ← Expandable indicator
      1a. Lower Slopes (500-900m)   ← Nested stages when expanded
      1b. Middle Ascent (900-1100m)
      1c. Upper Slopes (1100-1200m)
      1d. Scramble Zone (1200-1350m)
      1e. Final Ascent (1350-1400m)
      1f. Crater Descent
  2. [ ] Finding the Highndry
```

---

## Design: Clever Hierarchy

**Menu Behavior:**
1. Scenes without stages: normal selection
2. Scenes with stages: show `[>]` indicator
3. Selecting a staged scene: expand inline OR enter submenu
4. Track `currentStage` in storyState alongside `currentScene`

**Recommendation:** Inline expansion (keeps context, fewer keystrokes)

---

## Data Model Changes

```javascript
// storyState additions
{
  currentScene: 'mountain-climb',
  currentStage: 'middle-ascent',  // NEW - null if at scene level
  completedStages: {              // NEW - per-scene stage completion
    'mountain-climb': ['lower-slopes', 'middle-ascent']
  }
}
```

**Stage ID derivation:** Slugify stage name → `"Lower Slopes"` → `"lower-slopes"`

---

## Integration Points

| File | Function | Change |
|------|----------|--------|
| `src/story-engine.js` | `loadScene()` | Return stages array |
| `src/adventure-player.js` | `formatScenePicker()` | Render hierarchy |
| `src/adventure-player.js` | `getScenesByAct()` | Include stage data |
| `src/scene-manager.js` | `parseSceneDirective()` | Support `[STAGE: stage-id]` |
| `src/decision-tracker.js` | `createStoryState()` | Add currentStage, completedStages |
| `src/knowledge-extraction/context-injector.js` | `buildSceneContext()` | Filter facts by stage |

---

## Deliverables

1. **Modify `src/adventure-player.js`** - Hierarchical menu rendering
2. **Modify `src/scene-manager.js`** - Stage directive parsing
3. **Modify `src/decision-tracker.js`** - Stage state tracking
4. **Modify `src/knowledge-extraction/context-injector.js`** - Stage-aware injection
5. **Create `tests/hierarchical-scenes.test.js`**

---

## Test Cases

```javascript
// TEST H.1: Scene with stages shows expandable indicator
const scene = loadScene('high-and-dry', 'mountain-climb');
assert(scene.stages && scene.stages.length > 0);
const menuLine = formatSceneMenuItem(scene);
assert(menuLine.includes('[>]') || menuLine.includes('►'));

// TEST H.2: Scene without stages shows normal indicator
const simpleScene = loadScene('high-and-dry', 'finding-the-ship');
assert(!simpleScene.stages || simpleScene.stages.length === 0);
const simpleLine = formatSceneMenuItem(simpleScene);
assert(!simpleLine.includes('[>]'));

// TEST H.3: Expanded scene shows stages indented
const expanded = formatExpandedScene(scene);
assert(expanded.includes('Lower Slopes'));
assert(expanded.includes('1a') || expanded.includes('  '));

// TEST H.4: Stage selection updates storyState.currentStage
const state = { currentScene: 'mountain-climb', currentStage: null };
selectStage(state, 'middle-ascent');
assert(state.currentStage === 'middle-ascent');

// TEST H.5: Stage completion tracking
completeStage(state, 'lower-slopes');
assert(state.completedStages['mountain-climb'].includes('lower-slopes'));

// TEST H.6: Stage directive parsing
const directive = parseSceneDirective('[STAGE: scramble-zone]');
assert(directive.type === 'STAGE');
assert(directive.stageId === 'scramble-zone');

// TEST H.7: Context injection filters by current stage
const stateWithStage = {
  currentScene: 'mountain-climb',
  currentStage: 'middle-ascent',
  adventure: 'high-and-dry'
};
const ctx = buildSceneContext(narratorPersona, stateWithStage);
assert(ctx.includes('900') || ctx.includes('1100')); // Middle Ascent altitude
assert(!ctx.includes('1350')); // Not Scramble Zone

// TEST H.8: Full scene context when no stage selected
const sceneOnlyState = {
  currentScene: 'mountain-climb',
  currentStage: null,
  adventure: 'high-and-dry'
};
const fullCtx = buildSceneContext(narratorPersona, sceneOnlyState);
// Should include all stage info or summary
assert(fullCtx.includes('500') && fullCtx.includes('1400'));

// TEST H.9: slugifyStage generates correct IDs
assert(slugifyStage('Lower Slopes') === 'lower-slopes');
assert(slugifyStage('Scramble Zone') === 'scramble-zone');

// TEST H.10: getStageBySlug finds stage in scene
const stage = getStageBySlug(scene, 'middle-ascent');
assert(stage.name === 'Middle Ascent');
assert(stage.altitude === '900-1100m');
```

---

## Menu UX Details

**Key bindings:**
- Number selects scene (or toggles expansion)
- Letter selects stage within expanded scene (1a, 1b, etc.)
- Or: Number to expand, sub-number to select stage

**Visual indicators:**
```
[>] = Has stages, collapsed
[v] = Has stages, expanded
[ ] = No stages / simple scene
[✓] = Completed scene
```

---

## Acceptance Criteria

1. Scenes with stages show expansion indicator
2. Stages visible when scene expanded (inline, indented)
3. `storyState.currentStage` tracks active stage
4. Stage completion tracked separately from scene completion
5. `[STAGE: id]` directive supported
6. Context injector filters facts by active stage
7. Menu stays compact (no flat list of all stages)
8. All tests pass

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Menu complexity | Keep expand/collapse simple, test UX |
| Breaking existing scene nav | TEST H.2 ensures simple scenes unchanged |
| Stage ID collisions | Prefix with scene ID internally if needed |
| Context injection too narrow | TEST H.8 ensures full context without stage |

---

## Do NOT Implement

- New stage JSON files (stages stay embedded in scene JSON)
- Stage-level NPCs (future enhancement)
- Stage skill check automation (narrator handles)
