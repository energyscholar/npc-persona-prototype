# Plan: End-to-End Adventure Testing

**Status:** READY FOR REVIEW
**Date:** 2026-01-17
**Scope:** Automated walkthrough + interactive debug mode

---

## Summary

Two complementary testing approaches:
1. **Automated Walkthrough** - Script runs through all scenes with pre-defined inputs, verifying state at checkpoints
2. **Interactive Debug Mode** - Play as Alex with overlays showing flags, inventory, scene state, NPC dispositions

---

## Part 1: Automated Walkthrough

### Concept

A "golden path" script that simulates a successful playthrough:
1. Load adventure with Alex Ryder
2. Progress through each scene in order
3. Make scripted decisions at choice points
4. Verify expected flags/state after each scene
5. Report any failures or unexpected state

### Golden Path Definition

```javascript
const GOLDEN_PATH = [
  {
    scene: 'scout-office',
    actions: ['accept_mission'],
    expected_flags: ['mission_accepted'],
    expected_inventory: ['circuit-panels', 'diagnostic-unit', 'spares-container']
  },
  {
    scene: 'aboard-autumn-gold',
    actions: ['talk_to_corelli', 'wait_for_arrival'],
    expected_flags: ['met_corelli']
  },
  {
    scene: 'layover-567-908',
    actions: ['explore_waypoint', 'continue_journey'],
    expected_flags: ['visited_567908']
  },
  {
    scene: 'starport-arrival',
    actions: ['check_weapons', 'clear_customs'],
    expected_flags: ['weapons_checked_at_starport', 'cleared_customs'],
    stored_items: ['autopistol-standard']
  },
  {
    scene: 'meeting-greener',
    actions: ['negotiate_survey', 'accept_terms'],
    expected_flags: ['survey_accepted', 'transport_arranged']
  },
  // ... continue through all scenes
  {
    scene: 'aftermath',
    expected_flags: ['adventure_complete', 'highndry_claimed'],
    verify: 'success_ending'
  }
];
```

### Test Runner

```javascript
async function runGoldenPath() {
  const session = await startAdventure('high-and-dry', 'alex-ryder', mockClient);
  const results = [];

  for (const step of GOLDEN_PATH) {
    // Advance to scene
    advanceToScene(session.storyState, step.scene);

    // Execute actions
    for (const action of step.actions || []) {
      await executeAction(session, action);
    }

    // Verify state
    const check = verifyState(session, step);
    results.push({ scene: step.scene, ...check });

    if (!check.passed) {
      console.error(`Failed at ${step.scene}: ${check.error}`);
    }
  }

  return results;
}
```

### Deliverables

| # | File | Description |
|---|------|-------------|
| W1 | `tests/e2e/golden-path.js` | Golden path definition |
| W2 | `tests/e2e/walkthrough-runner.js` | Automated test runner |
| W3 | `tests/e2e/state-verifier.js` | State verification helpers |
| W4 | `tests/e2e/mock-client.js` | Mock AI client for deterministic responses |

---

## Part 2: Interactive Debug Mode

### Concept

A `--debug` flag for adventure-player that shows:
- Current scene info
- Active flags
- Inventory (carried vs stored)
- NPC dispositions
- Available actions/transitions
- Recent decisions

### Debug Overlay

```
┌─────────────────────── DEBUG ───────────────────────┐
│ Scene: starport-arrival (act-2-walston, order: 4)   │
│ Mode: narration                                     │
├─────────────────────────────────────────────────────┤
│ FLAGS:                                              │
│   ✓ mission_accepted                                │
│   ✓ met_corelli                                     │
│   ✓ arrived_walston                                 │
│   ○ weapons_checked_at_starport                     │
│   ○ cleared_customs                                 │
├─────────────────────────────────────────────────────┤
│ INVENTORY:                                          │
│   Carried: Combat Blade, Medkit, Filter Respirator  │
│   Stored: Autopistol (starport-customs)             │
├─────────────────────────────────────────────────────┤
│ TRANSITIONS: meeting-greener, startown-hotel        │
│ COMMANDS: /flags, /inv, /scene, /goto <scene>       │
└─────────────────────────────────────────────────────┘
```

### Debug Commands

| Command | Action |
|---------|--------|
| `/debug` | Toggle debug overlay |
| `/flags` | List all flags |
| `/inv` | Show full inventory |
| `/scene` | Show current scene details |
| `/goto <scene>` | Jump to scene (dev only) |
| `/setflag <flag>` | Set a flag (dev only) |
| `/npc <id>` | Show NPC state/disposition |
| `/state` | Dump full session state to file |

### Deliverables

| # | File | Description |
|---|------|-------------|
| D1 | `src/debug-overlay.js` | Debug display rendering |
| D2 | `src/debug-commands.js` | Debug command handlers |
| D3 | `src/adventure-player.js` | Add --debug mode support |

---

## Test Cases

### Walkthrough Tests (W.x)

```javascript
// W.1: Golden path completes without errors
// W.2: Each scene transition is valid
// W.3: Expected flags set at each checkpoint
// W.4: Inventory state correct at each checkpoint
// W.5: NPC dispositions progress correctly
// W.6: No orphan flags (set but never used)
// W.7: All story beats triggered
```

### Debug Mode Tests (D.x)

```javascript
// D.1: Debug overlay renders correctly
// D.2: /flags lists all current flags
// D.3: /inv shows carried and stored items
// D.4: /goto jumps to specified scene
// D.5: /setflag sets flag value
// D.6: /state dumps state to file
// D.7: Debug mode doesn't affect normal gameplay
```

---

## Implementation Order

1. **Mock Client** - Deterministic AI responses for testing
2. **State Verifier** - Check flags, inventory, transitions
3. **Golden Path Definition** - Map out the successful playthrough
4. **Walkthrough Runner** - Execute and verify
5. **Debug Overlay** - Visual state display
6. **Debug Commands** - Interactive state inspection

---

## Verification

```bash
# Run automated walkthrough
node tests/e2e/walkthrough-runner.js

# Start adventure in debug mode
node src/main.js play high-and-dry alex-ryder --debug
```

---

## Risks

| Risk | Mitigation |
|------|------------|
| AI responses non-deterministic | Mock client with canned responses |
| Scene graph incomplete | Golden path reveals missing transitions |
| State verification too strict | Allow optional flags, focus on critical path |
| Debug mode impacts performance | Only render overlay when visible |
