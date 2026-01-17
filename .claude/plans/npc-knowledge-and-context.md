# NPC Knowledge & Context System

**AUDITOR INSTANCE:** `5f069a8e-52eb-42c4-a874-17ce01f2100b`
**Created:** 2026-01-16
**Status:** READY FOR GENERATOR

---

## 10-Line Summary

1. **Bug fix:** Pass `storyState` to `assembleFullPrompt()` in chat-tui.js:734 (1-line change)
2. **PC identity:** Inject name, background, motivations into plot context
3. **Game date:** Inject `storyState.gameDate` into prompt
4. **Beat summaries:** Create `beat-summaries.js` with human-readable descriptions of completed story beats
5. **World knowledge:** Create `world-knowledge.js` for UWP parsing and world descriptions
6. **Wiki cache:** Copy/adapt `wiki-cache.js` for O(1) world lookup by hex/name
7. **Narrator special:** Narrator archetype gets full omniscient context with "don't re-narrate" instruction
8. **All modules standalone:** No core file changes until final 1-line integration
9. **Tests first:** 4 new test files written (world-knowledge, wiki-cache, beat-summaries, plot-context updates)
10. **Risk: LOW** — All new code is additive; single 1-line change to existing code at end

---

## Risk Mitigation

| Phase | Files Changed | Risk | Rationale |
|-------|---------------|------|-----------|
| 1 | `src/beat-summaries.js` (NEW) | LOW | New file only, no dependencies |
| 2 | `src/world-knowledge.js` (NEW) | LOW | New file only, pure functions |
| 3 | `src/wiki-cache.js` (NEW) | LOW | New file, graceful degradation if cache missing |
| 4 | `src/plot-context.js` (ENHANCE) | LOW | Adds optional parameters, backward compatible |
| 5 | `src/chat-tui.js` (1 LINE) | LOW | Adds 5th parameter to existing call |

**Rollback strategy:** Delete new files, revert 1-line change.

---

## Problem Statement

NPCs (including the narrator) are not properly informed. They should know:

| Knowledge Type | Example | Current State |
|----------------|---------|---------------|
| **World facts** | Walston's UWP, atmosphere, population | ❌ Not injected |
| **Current date** | "015-1105" | ❌ Not injected |
| **PC identity** | "Alex Ryder, inheritor of the Highndry" | ❌ Not injected |
| **Story progress** | Which beats are complete | ❌ storyState not passed to prompt |
| **Adventure context** | "Alex accepted the survey job" | ❌ No beat summaries |

### Observed Failures

1. **Narrator makes up random story** instead of continuing High and Dry
2. **NPCs don't know basic world facts** that any informed person would know
3. **No sense of time** - NPCs don't know the current in-game date
4. **No PC awareness** - Narrator doesn't know who Alex is or why she's here

---

## Root Causes

### Bug: storyState not passed to prompt
```javascript
// chat-tui.js line 734 - MISSING storyState parameter
const assembled = assembleFullPrompt(currentPersona, currentMemory, trimmed, currentPC);

// Should be:
const assembled = assembleFullPrompt(currentPersona, currentMemory, trimmed, currentPC, storyState);
```

### Gap: No world knowledge injection
Wiki cache exists with 432 systems but isn't connected to NPC prompts.

### Gap: Plot context too minimal
`buildPlotContext()` exists but doesn't include:
- PC identity and backstory
- Completed beats as narrative summary
- "Don't re-narrate" instructions for narrator

---

## Data Sources Available

| Source | Location | Content |
|--------|----------|---------|
| Wiki Cache | `traveller-starship-operations-vtt/data/wiki-cache/` | 432 systems, full encyclopedia |
| Story State | `storyState` object in TUI | Adventure, act, scene, beats, flags, gameDate |
| PC Data | `data/pcs/*.json` | PC identity, backstory, motivations |
| Adventure Data | `data/adventures/*/` | Beat definitions, act structure |

---

## Design Decisions

| Question | Decision |
|----------|----------|
| Wiki cache location | Copy into this repo (self-contained) |
| Knowledge depth | First paragraph only (~200 tokens) |
| Default knowledge tier | Educated |
| Current date source | `storyState.gameDate` |

---

## Architecture

### Current Flow (Broken)
```
persona + memory + userMessage + pc  →  assembleFullPrompt()  →  Claude
                                              ↓
                              buildExtendedContext(persona, pc, null)  ← storyState missing!
```

### Target Flow
```
persona + memory + userMessage + pc + storyState  →  assembleFullPrompt()  →  Claude
                                                            ↓
                                          buildExtendedContext(persona, pc, storyState)
                                                            ↓
                            ┌───────────────────────────────┼───────────────────────────────┐
                            ↓                               ↓                               ↓
                    getDispositionPromptModifier()   buildPlotContext()          buildWorldKnowledge()
                            ↓                               ↓                               ↓
                    "You are NEUTRAL..."            "Adventure: High and Dry      "WALSTON (C544338-7)
                                                     PC: Alex Ryder...             Population: ~6000..."
                                                     Completed: arrival..."
```

---

## Implementation Phases

### Phase 1: Wire Up storyState (5 min fix)

**File:** `src/chat-tui.js`

Change line 734:
```javascript
// OLD
const assembled = assembleFullPrompt(currentPersona, currentMemory, trimmed, currentPC);

// NEW
const assembled = assembleFullPrompt(currentPersona, currentMemory, trimmed, currentPC, storyState);
```

**Risk:** LOW - one-line change, storyState already exists

---

### Phase 2: Enhance Plot Context

**File:** `src/plot-context.js`

Add to `buildPlotContext()`:

```javascript
function buildPlotContext(storyState, npcConfig, pc = null) {
  if (!storyState || !npcConfig) return '';

  let context = '\n=== ADVENTURE STATE ===\n';

  // 1. PC Identity (NEW)
  if (pc) {
    context += `\nPLAYER CHARACTER: ${pc.name}\n`;
    if (pc.background) context += `Background: ${pc.background}\n`;
    if (pc.motivations) context += `Motivations: ${pc.motivations.join(', ')}\n`;
  }

  // 2. Adventure position
  context += `\nAdventure: ${storyState.adventure}\n`;
  context += `Current Act: ${storyState.currentAct}\n`;
  if (storyState.currentScene) {
    context += `Current Scene: ${storyState.currentScene}\n`;
  }

  // 3. Current date (NEW)
  if (storyState.gameDate) {
    context += `Current Date: ${storyState.gameDate}\n`;
  }

  // 4. Completed beats as narrative (NEW)
  if (storyState.completedBeats?.length > 0) {
    context += `\nWHAT HAS ALREADY HAPPENED:\n`;
    for (const beatId of storyState.completedBeats) {
      const summary = getBeatSummary(beatId, storyState.adventure);
      if (summary) context += `- ${summary}\n`;
    }
    context += `\nDo not re-narrate these events. Continue from current scene.\n`;
  }

  // 5. Beat reactions (existing)
  // ... existing code ...

  return context;
}
```

**New helper:** `getBeatSummary(beatId, adventureId)` — Returns human-readable summary of what happened.

**Risk:** LOW - enhances existing function

---

### Phase 3: World Knowledge Module

**New file:** `src/world-knowledge.js`

```javascript
module.exports = {
  getWorldSummary,      // (worldName) → { uwp, description, firstParagraph }
  parseUWP,             // (uwpString) → { starport, size, atmosphere, ... }
  describeUWP,          // (uwpString) → human-readable string
};
```

**New file:** `src/wiki-cache.js` (copied/adapted from VTT repo)

**Risk:** LOW - new files only

---

### Phase 4: Integrate World Knowledge

**File:** `src/prompt-extensions.js`

Add world knowledge injection:

```javascript
function buildExtendedContext(persona, pc, storyState) {
  let extensions = '';

  // 1. Disposition (existing)
  // 2. Plot context (existing, now enhanced)

  // 3. World knowledge (NEW)
  if (persona.world) {
    const worldInfo = getWorldSummary(persona.world);
    if (worldInfo) {
      extensions += `\n=== CURRENT LOCATION ===\n`;
      extensions += `World: ${persona.world}\n`;
      extensions += `UWP: ${worldInfo.uwp}\n`;
      extensions += `${worldInfo.description}\n`;
      extensions += `\nYou know these facts from living/visiting here.\n`;
    }
  }

  // 4. World state (existing)

  return extensions;
}
```

**Risk:** LOW - extends existing function

---

## Beat Summary Data

Need to add human-readable summaries for beats. Two options:

### Option A: In adventure JSON
```json
{
  "story_beats": [
    {
      "id": "arrival_walston",
      "summary": "Arrived on Walston after two weeks in jump space"
    }
  ]
}
```

### Option B: In separate mapping file
```javascript
// src/beat-summaries.js
const BEAT_SUMMARIES = {
  "high-and-dry": {
    "departure_flammarion": "Left Flammarion aboard the far trader Autumn Gold",
    "arrival_walston": "Arrived on Walston after two weeks in jump space",
    "meeting_greener": "Met Minister Greener and learned about the Highndry situation",
    "survey_accepted": "Agreed to complete the volcano survey for Cr3000 plus the ship"
  }
};
```

**Recommendation:** Option B — keeps adventure JSON clean, easier to update

---

## Example: Narrator Prompt After Fix

```
You are The Narrator, Voice of High and Dry...

=== ADVENTURE STATE ===

PLAYER CHARACTER: Alex Ryder
Background: Former scout service, mustered out after one term. Inherited documentation for a Type S Scout/Courier - the Highndry - from a distant relative.
Motivations: Claim the Highndry and start a new life, Prove they can make it on their own

Adventure: high-and-dry
Current Act: act-2-walston
Current Scene: journey_to_ship
Current Date: 015-1105

WHAT HAS ALREADY HAPPENED:
- Left Flammarion aboard the far trader Autumn Gold
- Arrived on Walston after two weeks in jump space
- Cleared customs at Walston Starport
- Met Minister Greener and learned about the Highndry situation
- Agreed to complete the volcano survey for Cr3000 plus the ship

Do not re-narrate these events. Continue from current scene.

=== CURRENT LOCATION ===
World: Walston
UWP: C544338-7
Walston has a routine-quality starport with unrefined fuel. Medium-sized world with thin, tainted atmosphere requiring filter masks. Population around 6,000 under a hereditary dictatorship with strict laws. Tech level is pre-stellar.

You know these facts from living/visiting here.

=== YOUR SPECIALIZED KNOWLEDGE ===
[existing knowledge_base content]
```

---

## Files to Create/Modify

### New Files
- `src/world-knowledge.js` — UWP parsing, world summaries
- `src/wiki-cache.js` — Adapted from VTT repo
- `src/beat-summaries.js` — Human-readable beat descriptions
- `data/wiki-cache/` — Symlink or copy from VTT repo

### Modified Files
- `src/chat-tui.js` — Pass storyState to assembleFullPrompt (1 line)
- `src/plot-context.js` — Add PC identity, date, beat summaries
- `src/prompt-extensions.js` — Add world knowledge injection

---

## Test Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Narrator + Alex on Walston mid-adventure | Knows Alex, knows completed beats, doesn't re-narrate arrival |
| Alex asks NPC about Walston | NPC knows UWP, atmosphere, population |
| Any NPC conversation | Shows current date in context |
| Narrator with no storyState | Graceful fallback, no crash |

---

## Open Questions (for future iterations)

1. **Knowledge tiers** — Should bartenders know less than diplomats? (Deferred)
2. **Encyclopedia depth** — First paragraph enough? (Start there, expand if needed)
3. **Beat auto-detection** — Can we infer completed beats from conversation? (Future)
4. **Cross-NPC consistency** — If bartender mentions Greener, should Greener know? (Future - world-state.js)

---

## Next Steps

1. AUDITOR writes tests for:
   - Enhanced `buildPlotContext()` with PC identity, date, beat summaries
   - `world-knowledge.js` (UWP parsing, summaries)
   - `wiki-cache.js` (adapted copy)
   - `beat-summaries.js`

2. GENERATOR implements phases 1-4

3. Integration test: Alex Ryder + Narrator on Walston mid-adventure

---

## Verification

After implementation, this TUI session should work correctly:

```
> /adventure high-and-dry
> /scene journey_to_ship
> /beat arrival_walston
> /beat meeting_greener
> /beat survey_accepted
> /npc narrator-high-and-dry
> /pc alex-ryder

You: What's happening?

Narrator: [Should describe Alex heading to the Highndry, NOT re-narrate arrival]
```
