# Audit Plan: Scene Opening Flow Improvements

**Status:** READY FOR GENERATOR
**Date:** 2026-01-17

---

## Problem Statement

Opening scene has several issues:
1. "AGM:" label should read "Narrator:"
2. narrator_prompt mentions "inheritance" - should mention "detached duty approval"
3. Anders should open with small talk ("How can I help you?")
4. After PC identifies themselves, Anders should provide full briefing
5. PC should acquire information permanently (persist to state)

---

## Deliverables

| # | File | Type | Description |
|---|------|------|-------------|
| D1 | `src/chat-tui.js` | MODIFY | Change "AGM:" to "Narrator:" |
| D2 | `data/adventures/high-and-dry/scenes/scout-office.json` | MODIFY | Fix narrator_prompt, add opening_context |
| D3 | `data/npcs/mr-casarii.json` | MODIFY | Add opening_dialogue, id_trigger behavior |
| D4 | `src/adventure-player.js` | MODIFY | Add PC info acquisition to storyState |
| D5 | `tests/scene-opening.test.js` | NEW | Tests for scene opening flow |

---

## D1: Fix "AGM:" → "Narrator:" in TUI

**File:** `src/chat-tui.js`
**Line:** ~1602

```javascript
// BEFORE:
console.log(`\n${sysColor}AGM:${reset} ${opening}\n`);

// AFTER:
console.log(`\n${sysColor}Narrator:${reset} ${opening}\n`);
```

Also search for any other "AGM" references that should be "Narrator".

---

## D2: Fix scout-office.json

**File:** `data/adventures/high-and-dry/scenes/scout-office.json`

Changes:
1. Fix `narrator_prompt` to mention detached duty approval
2. Add `opening_context` for PC priming
3. Add `npc_opening_behavior` for Anders

```json
{
  "narrator_prompt": "You've received word that your application for detached duty has been approved. A Scout Service courier awaits collection - but first, you need to report to the Scout Service Way Station to receive your briefing and documentation. The Way Station is busy with the usual traffic of couriers and administrators.",

  "opening_context": {
    "pc_knows": [
      "You've been approved for a detached duty scout ship",
      "You need to report to Scout Service administration",
      "This is at Flammarion Highport"
    ],
    "pc_goal": "Report to administration and receive your briefing"
  },

  "npc_opening_behavior": {
    "mr-casarii": {
      "waits_for_approach": true,
      "opening_line": "Good day. How can I help you?",
      "trigger_full_briefing": "PC shows ID or mentions detached duty/ship assignment",
      "post_id_behavior": "Provide full briefing on Highndry situation"
    }
  }
}
```

---

## D3: Add opening behavior to mr-casarii.json

**File:** `data/npcs/mr-casarii.json`

Add to `conversation_context`:

```json
{
  "conversation_context": {
    "opening_behavior": {
      "initial_stance": "polite_inquiry",
      "opening_line": "Good day. How can I help you?",
      "waits_for": ["identification", "mention of ship", "mention of detached duty"],
      "after_identification": "switch to full_briefing mode"
    },
    "briefing_sequence": [
      "Acknowledge their detached duty approval",
      "Explain the ship situation (Highndry on Walston)",
      "Provide documentation and repair kit",
      "Explain travel arrangements (Autumn Gold)",
      "Explain expense account"
    ],
    ...existing fields...
  }
}
```

---

## D4: PC Information Acquisition

**File:** `src/adventure-player.js`

Add mechanism for PC to acquire persistent information:

```javascript
// In storyState structure, add:
storyState.acquired_info = storyState.acquired_info || [];

// Function to acquire info:
function acquireInfo(session, info, source) {
  if (!session.storyState.acquired_info) {
    session.storyState.acquired_info = [];
  }
  session.storyState.acquired_info.push({
    info,
    source,
    timestamp: new Date().toISOString(),
    scene: session.storyState.currentScene
  });
  saveStoryState(session.storyState);
}

// Export for use by other modules
```

The narrator/NPC system should call `acquireInfo()` when giving important mission info.

---

## D5: Test Cases

**File:** `tests/scene-opening.test.js`

```javascript
// TEST S.1: Narrator label is "Narrator:" not "AGM:"
// Check chat-tui.js contains 'Narrator:' not 'AGM:'

// TEST S.2: scout-office scene has opening_context
// Check scene has pc_knows array

// TEST S.3: scout-office narrator_prompt mentions detached duty
// Should contain "detached duty" not "inheritance"

// TEST S.4: mr-casarii has opening_behavior
// conversation_context.opening_behavior exists

// TEST S.5: storyState can store acquired_info
// acquireInfo function adds to array

// TEST S.6: Opening line is small talk
// opening_line is greeting, not full briefing
```

---

## Implementation Order

1. D5: Create tests first
2. D1: Fix AGM → Narrator in TUI
3. D2: Update scout-office.json
4. D3: Update mr-casarii.json
5. D4: Add acquireInfo to adventure-player.js
6. Run tests

---

## Verification

```bash
node tests/scene-opening.test.js
grep -r "AGM:" src/  # Should return nothing
```
