# Audit Plan: AGM Orchestration Architecture

**Auditor Instance:** 2026-01-17
**Status:** READY FOR GENERATOR

---

## Objective

AGM operates as invisible orchestrator - NPCs receive scene context, goal urgency, and behavior hints in their prompts during dialogue. The narrator receives orchestration directives.

**Gap Being Closed:** Individual NPCs receive no orchestration context when player enters NPC dialogue mode. This causes NPCs to act in isolation rather than as part of a coordinated scene.

---

## Deliverables

| # | File | Type | Description |
|---|------|------|-------------|
| D1 | `src/agm-state.js` | NEW | AGM state manager |
| D2 | `src/agm-npc-bridge.js` | NEW | NPC context injection |
| D3 | `src/prompts.js` | MODIFY | Add options parameter |
| D4 | `src/adventure-player.js` | MODIFY | Integrate AGM state |
| D5 | `tests/agm-orchestration.test.js` | NEW | Orchestration tests |
| D6 | `tests/personality-consistency.test.js` | NEW | Voice stability tests |
| D7 | `tests/goal-satisfaction.test.js` | NEW | Goal behavior tests |

---

## D1: agm-state.js

### Required Exports

```javascript
module.exports = {
  createAgmState,      // (session) => agmState
  updateSceneContext,  // (agmState, scene, storyState) => void
  computeGoalUrgency,  // (agmState, npcId, npcGoals, storyState) => number
  buildNarratorDirectives,  // (agmState) => string
  buildNpcDirectives,  // (agmState, npcId) => string
  propagateKnowledge   // (agmState, sourceNpcId, fact) => void
};
```

### State Shape

```javascript
{
  adventureId: string,
  scene: { id, objectives: [], tensions: [] },
  npcs: { [npcId]: { sceneRole, urgency, knownFacts: [], behaviorHints: [] } },
  sharedKnowledge: { [fact]: { source, witnesses: [] } },
  narratorDirectives: { pacing, npcToFeature }
}
```

---

## D2: agm-npc-bridge.js

### Required Exports

```javascript
module.exports = {
  buildAgmContext,       // (agmState, npcId, storyState) => string
  getNpcPriorities,      // (agmState, npc, storyState) => string[]
  shouldNpcSpeak,        // (agmState, npcId, playerAction, scene) => boolean
  determineActiveSpeaker,// (agmState, playerAction, scene) => { speaker, npcId? }
  detectAddressedNpc,    // (playerAction, npcsPresent) => npcId|null
  isDialogueAction       // (playerAction) => boolean
};
```

---

## D3: prompts.js Modifications

### Change Required

Modify `buildSystemPrompt` and `assembleFullPrompt` to accept an `options` object:

```javascript
function buildSystemPrompt(persona, options = {}) {
  // ... existing code ...

  // NEW: Inject AGM context if provided
  if (options.agmContext) {
    prompt += `\n${options.agmContext}\n`;
  }

  // NEW: Inject goal priorities
  if (options.goalPriorities?.length > 0) {
    prompt += `\n=== YOUR PRIORITIES NOW ===\n`;
    for (const p of options.goalPriorities) {
      prompt += `- ${p}\n`;
    }
  }

  return prompt;
}

function assembleFullPrompt(persona, memory, userMessage, pc, storyState, options = {}) {
  const systemPrompt = buildSystemPrompt(persona, options);
  // ... rest unchanged ...
}
```

**Constraint:** Must be backward compatible - existing calls without options must work unchanged.

---

## D4: adventure-player.js Modifications

### Changes Required

1. **Import new modules** at top:
   ```javascript
   const { createAgmState, updateSceneContext } = require('./agm-state');
   const { buildAgmContext, getNpcPriorities } = require('./agm-npc-bridge');
   ```

2. **Initialize AGM state** in `startAdventure()`:
   ```javascript
   session.agmState = createAgmState(session);
   ```

3. **Inject context** in `handleNpcChat()` (around line 231):
   ```javascript
   const agmContext = buildAgmContext(session.agmState, session.activeNpc.id, session.storyState);
   const priorities = getNpcPriorities(session.agmState, session.activeNpc, session.storyState);

   const assembled = assembleFullPrompt(
     session.activeNpc,
     session.npcMemory || createMemory(),
     playerInput,
     session.pc,
     session.storyState,
     { agmContext, goalPriorities: priorities }
   );
   ```

4. **Update scene context** when scene changes (if scene transition exists).

---

## Test Specifications

### D5: tests/agm-orchestration.test.js

```javascript
// TEST O.1: createAgmState returns valid structure
// - Must have adventureId, scene, npcs, sharedKnowledge, narratorDirectives

// TEST O.2: updateSceneContext populates scene data
// - scene.id matches input
// - objectives and tensions copied

// TEST O.3: updateSceneContext initializes NPC entries
// - Each NPC in npcs_present gets entry in agmState.npcs

// TEST O.4: buildNpcDirectives returns non-empty for known NPC
// - Must include "SCENE GUIDANCE" header

// TEST O.5: propagateKnowledge updates all NPCs
// - Fact added to all other NPCs' knownFacts
// - Source NPC excluded from witnesses

// TEST O.6: detectAddressedNpc finds NPC by name part
// - "I ask Greener about..." -> "minister-greener"
// - Returns null if no match

// TEST O.7: determineActiveSpeaker prefers addressed NPC
// - Addressed NPC takes priority
// - Falls back to high-urgency NPC
// - Falls back to narrator

// TEST O.8: isDialogueAction detects speech
// - "say hello" -> true
// - "walk north" -> false
```

### D6: tests/personality-consistency.test.js

```javascript
// TEST P.1: Ready-tier NPCs have voice_profile
// NPCs: Corelli, Masterton, Greener, Kira, Anemone, Gamma

// TEST P.2: voice_profile has required fields
// Fields: manner, tempo, vocabulary, emotional_range

// TEST P.3: speech_patterns defined
// Must have at least 2 patterns

// TEST P.4: Different NPCs have different voices
// Compare manner/vocabulary between Greener and Bartender

// TEST P.5: NPCs have verbal_tics or signature phrases
// At least one distinguishing verbal element

// TEST P.6: Sample dialogue exists for ready NPCs
// sample_dialogue array with at least 2 examples
```

### D7: tests/goal-satisfaction.test.js

```javascript
// TEST G.1: Ready-tier NPCs have goals array
// goals.length > 0

// TEST G.2: Goals have conditions
// Each goal has trigger or satisfaction condition

// TEST G.3: computeGoalUrgency returns valid range
// 0.0 <= urgency <= 1.0

// TEST G.4: Story pressure increases urgency
// volcano_active flag adds >= 0.2

// TEST G.5: NPCs have knowledge_gates
// Critical info gated behind conditions

// TEST G.6: State machine exists for ready NPCs
// state_machine with at least 2 states
```

---

## Acceptance Criteria

1. All 20 tests pass
2. Existing `adventure-player.js` behavior unchanged for NPC dialogue
3. `prompts.js` changes are backward compatible
4. AGM context string < 200 tokens when injected

---

## Verification Command

```bash
node tests/agm-orchestration.test.js && \
node tests/personality-consistency.test.js && \
node tests/goal-satisfaction.test.js
```

---

## Files to Read Before Implementation

- `src/prompts.js` (lines 24-40, 164-190)
- `src/adventure-player.js` (lines 45-70, 223-245)
- `data/npcs/minister-greener.json` (example ready-tier NPC)
- Existing patterns in `src/agm-controller.js`
