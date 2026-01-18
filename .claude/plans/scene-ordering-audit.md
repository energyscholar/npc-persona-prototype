# Audit Plan: Scene Ordering and TUI Menu System

**Status:** READY FOR GENERATOR
**Date:** 2026-01-17
**Auditor:** Claude (Auditor role)

---

## Problem Statement

TUI scene picker displays scenes in wrong order. Root causes:
1. `listScenes()` returns filesystem order (alphabetical)
2. No `order` field in scene JSONs to specify sequence
3. Act files define scene order, but TUI ignores them
4. Scene files don't always match act file listings

---

## Gap Analysis

### Act 1: The Journey
| Act File Lists | Scene File Exists | Status |
|---------------|-------------------|--------|
| scout-office | scout-office.json | ✓ Match |
| aboard-autumn-gold | aboard-autumn-gold.json | ✓ Match |
| layover-567-908 | layover-567-908.json | ✓ Match |

### Act 2: Walston
| Act File Lists | Scene File Exists | Status |
|---------------|-------------------|--------|
| starport-arrival | starport-arrival.json | ✓ Match |
| meeting-greener | meeting-greener.json | ✓ Match |
| startown-investigation | startown-investigation.json | ✓ Match |

### Act 3: The Mountain
| Act File Lists | Scene File Exists | Status |
|---------------|-------------------|--------|
| overland-journey | - | ✗ Missing file |
| tensher-territory | - | ✗ Missing file |
| crater-approach | - | ✗ Missing file |
| finding-the-ship | finding-the-ship.json | ✓ Match |
| - | mountain-climb.json | ✗ Not in act file |
| - | ship-repairs.json | ✗ Not in act file |

### Act 4: Crisis
| Act File Lists | Scene File Exists | Status |
|---------------|-------------------|--------|
| survey-work | - | ✗ Missing file |
| eruption-warning | - | ✗ Missing file |
| eruption-begins | eruption-begins.json | ✓ Match |
| fighting-volcano-1 | - | ✗ Missing file |
| fighting-volcano-2 | - | ✗ Missing file |
| chauffeur-rescue | chauffeur-rescue.json | ✓ Match |
| - | save-the-ship.json | ✗ Not in act file |

### Act 5: Aftermath
| Act File Lists | Scene File Exists | Status |
|---------------|-------------------|--------|
| aftermath-walston | - | ✗ Wrong ID |
| recognition-ceremony | - | ✗ Missing file |
| departure | - | ✗ Missing file |
| - | aftermath.json | ✗ Not in act file |

---

## Canonical Outline

Based on source material and logical flow:

```
ACT 1: THE JOURNEY
  1. Scout Office (Flammarion Highport)
     - Briefing from Anders Casarii
     - Receive mission, credits, vouchers

  2. Aboard Autumn Gold
     - Week of jump travel
     - Meet Captain Corelli

  3. Layover 567-908
     - Brief waypoint stop
     - Refuel, second jump to Walston

ACT 2: WALSTON
  4. Starport Arrival
     - Customs check
     - Weapon restrictions

  5. Meeting Greener
     - Government building
     - Negotiate survey deal
     - Learn previous crew absconded

  6. Startown Investigation (Optional)
     - Dusty Airlock bar
     - Gather intel on ship, crew

ACT 3: THE MOUNTAIN
  7. Journey to Mountain
     - Overland travel from starport
     - ATV or hired transport
     - Approach Mount Salbarii

  8. Mountain Climb [6 stages]
     a. Lower Slopes (500-900m)
     b. Middle Ascent (900-1100m)
     c. Upper Slopes (1100-1200m)
     d. Scramble Zone (1200-1350m)
     e. Final Ascent (1350-1400m)
     f. Crater Descent

  9. Finding the Ship
     - Encounter Tensher Wolf (Kimbley)
     - Discover Highndry condition

  10. Ship Repairs
      - 4 main systems to fix
      - Scavenge parts
      - Make ship flyable

ACT 4: CRISIS
  11. Survey Work
      - Conduct seismic readings
      - Discover volcanic activity

  12. Eruption Begins
      - Tremors, gas venting
      - Urgent evacuation needed

  13. Save the Ship
      - Emergency procedures
      - Get Highndry airborne

  14. Chauffeur Rescue
      - Moral choice: 11 refugees vs 3 Vargr
      - Risk ship for chauffeur's parents

ACT 5: AFTERMATH
  15. Aftermath
      - Consequences of choices
      - Masterton's response
      - Community reaction

  16. Departure
      - Final payment
      - Ship is officially theirs
      - Hooks for future
```

---

## Proposed Solution

### 1. Add `order` field to scene JSONs

```json
{
  "id": "scout-office",
  "act": "act-1-journey",
  "order": 1,
  ...
}
```

### 2. Update act files to match reality

Sync act file scene lists with actual scene files that exist.

### 3. Modify TUI scene picker

Option A: **Read order from act files** (source of truth)
```javascript
function getScenesByAct(adventure, storyState) {
  const acts = loadActs(adventure.id);
  // Use act.scenes array as ordering
}
```

Option B: **Read order from scene.order field**
```javascript
// Sort scenes within each act by order field
scenesByAct[act].sort((a, b) => a.order - b.order);
```

**Recommendation:** Option A - act files are already the canonical source.

### 4. Consolidate/rename scenes to match canonical outline

| Current | Should Be | Action |
|---------|-----------|--------|
| - | overland-journey | Merge into journey-to-mountain |
| mountain-climb | mountain-climb | Keep (has stages) |
| - | tensher-territory | Merge into finding-the-ship |
| - | crater-approach | Merge into finding-the-ship |
| finding-the-ship | finding-the-ship | Keep, expand with wolf encounter |
| ship-repairs | ship-repairs | Keep |
| - | survey-work | Merge into eruption-begins |
| - | eruption-warning | Merge into eruption-begins |
| eruption-begins | eruption-begins | Expand |
| save-the-ship | save-the-ship | Keep |
| chauffeur-rescue | chauffeur-rescue | Keep |
| aftermath | aftermath | Expand to include departure |

---

## Deliverables

| # | File | Description |
|---|------|-------------|
| D1 | `acts/*.json` | Update scene lists to match existing files + order |
| D2 | `scenes/*.json` | Add `order` field to all scenes |
| D3 | `src/story-engine.js` | Add `loadActs()` helper |
| D4 | `src/adventure-player.js` | Use act files for scene ordering |
| D5 | `scenes/journey-to-mountain.json` | NEW: Overland travel scene |
| D6 | `tests/scene-ordering.test.js` | Test cases |

---

## Test Cases

```javascript
// TEST S.1: Scenes have order field
const scene = loadScene('high-and-dry', 'scout-office');
assert.strictEqual(typeof scene.order, 'number');

// TEST S.2: Act files list existing scenes only
const act = loadAct('high-and-dry', 'act-1-journey');
for (const sceneId of act.scenes) {
  const scene = loadScene('high-and-dry', sceneId);
  assert.ok(scene, `Scene ${sceneId} should exist`);
}

// TEST S.3: Scene picker respects act file order
const sceneList = getSceneList(adventure);
// First scene should be scout-office (act 1, scene 1)
assert.strictEqual(sceneList[0], 'scout-office');

// TEST S.4: Scenes within act are ordered correctly
const act1Scenes = getScenesByAct(adventure, {})['act-1-journey'];
assert.strictEqual(act1Scenes[0].id, 'scout-office');
assert.strictEqual(act1Scenes[1].id, 'aboard-autumn-gold');
assert.strictEqual(act1Scenes[2].id, 'layover-567-908');

// TEST S.5: Mountain climb stages visible when expanded
const act3Scenes = getScenesByAct(adventure, { expandedScenes: ['mountain-climb'] });
const mtScene = act3Scenes['act-3-mountain'].find(s => s.id === 'mountain-climb');
assert.ok(mtScene.stages.length >= 6);

// TEST S.6: Scene picker format shows correct order
const menu = formatScenePicker(adventure, {});
const lines = menu.split('\n');
const scoutIdx = lines.findIndex(l => l.includes('Scout Office'));
const aboardIdx = lines.findIndex(l => l.includes('Aboard Autumn Gold'));
assert.ok(scoutIdx < aboardIdx, 'Scout Office should appear before Aboard Autumn Gold');
```

---

## TUI Menu Design

```
┌────────────────────────────────────────────┐
│     HIGH AND DRY - SELECT SCENE           │
├────────────────────────────────────────────┤
│                                            │
│  ACT 1: THE JOURNEY                        │
│    1. [✓] Scout Office                     │
│    2. [✓] Aboard Autumn Gold               │
│    3. [✓] Layover 567-908                  │
│                                            │
│  ACT 2: WALSTON                            │
│    4. [✓] Starport Arrival                 │
│    5. [✓] Meeting Greener                  │
│    6. [ ] Startown Investigation           │
│                                            │
│  ACT 3: THE MOUNTAIN                       │
│    7. [ ] Journey to Mountain              │
│    8. [v] Mountain Climb *                 │
│       a. [✓] Lower Slopes (500-900m)       │
│       b. [ ] Middle Ascent (900-1100m) *   │
│       c. [ ] Upper Slopes (1100-1200m)     │
│       d. [ ] Scramble Zone (1200-1350m)    │
│       e. [ ] Final Ascent (1350-1400m)     │
│       f. [ ] Crater Descent                │
│    9. [ ] Finding the Ship                 │
│   10. [ ] Ship Repairs                     │
│                                            │
│  [B] Back                                  │
└────────────────────────────────────────────┘

Legend:
  [✓] = Completed
  [ ] = Available
  [v] = Expanded (has stages)
  [>] = Collapsed (has stages)
  *   = Current location
```

---

## Implementation Order

1. D6: Create test file (tests will fail initially)
2. D3: Add `loadActs()` helper to story-engine.js
3. D2: Add `order` field to all existing scene files
4. D1: Update act files to list only existing scenes
5. D4: Modify adventure-player.js to use act ordering
6. D5: Create journey-to-mountain.json scene
7. Verify all tests pass

---

## Verification

```bash
node tests/scene-ordering.test.js
```

Then manually test TUI:
```bash
npm run start
# Select adventure, verify scene order matches outline
```
