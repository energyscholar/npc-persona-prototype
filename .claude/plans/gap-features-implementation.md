# NPC Gap Features Implementation Plan (Risk-Mitigated)

**AUDITOR INSTANCE:** `5f069a8e-52eb-42c4-a874-17ce01f2100b`
**Created:** 2026-01-16
**Revised:** 2026-01-16 (Risk mitigation applied)
**Status:** READY FOR GENERATOR

---

## Risk Profile

| Phase | Risk Level | Rationale |
|-------|------------|-----------|
| 1. Disposition | LOW | New file only |
| 2. Plot Context | LOW | New file only (moved from prompts.js) |
| 3. Skill Check | LOW | New file only |
| 4. Info Gating | LOW | New file only |
| 5. Triggers | LOW | New file only (deferred story-engine mod) |
| 6. World State | LOW | New file only |
| 7. Integration Layer | LOW | New file only |
| 8. Core Integration | LOW+ | Single 3-line addition to prompts.js |

**STOP POINT:** After Phase 7, AUDITOR reviews before Phase 8.

---

## GENERATOR Instructions

1. Read this entire file
2. Implement phases 1-7 (all LOW risk)
3. Run tests after each phase: `npm test`
4. Do NOT modify `prompts.js` or `story-engine.js` until Phase 8
5. **STOP after Phase 7** and report for AUDIT review
6. Only proceed to Phase 8 after AUDITOR approval

---

## Design Patterns Applied

| Pattern | Module | Purpose |
|---------|--------|---------|
| **Repository** | All state modules | Encapsulate data access (load/save JSON files) |
| **Null Object** | `disposition.js` | Return default values instead of null/undefined |
| **Builder** | `plot-context.js` | Construct complex context strings step-by-step |
| **Strategy** | `skill-check.js` | Swap mock implementation for VTT integration later |
| **Facade** | `prompt-extensions.js` | Single entry point hiding subsystem complexity |
| **Observer** (future) | `triggers.js` | React to story state changes |

### Pattern Implementation Notes

**Repository Pattern (All State Modules)**
- Each module has `load*()` and `save*()` functions
- Isolates file I/O from business logic
- Makes testing easier (can mock file operations)
- Example: `loadDispositions()`, `saveDispositions(state)`

**Null Object Pattern (Disposition)**
- `getDisposition()` never returns null
- Returns default `{ level: 0, label: 'neutral', history: [], impressions: [] }`
- Eliminates null checks in calling code

**Builder Pattern (Plot Context)**
- `buildPlotContext()` constructs string incrementally
- Conditionally adds scope, reactions, flags
- Each section independent, order matters

**Strategy Pattern (Skill Check)**
- `performCheck()` is the strategy interface
- Current implementation: mock 2d6 rolls
- Future: VTT API integration (same interface, different implementation)
- Enables testing without VTT dependency

**Facade Pattern (Prompt Extensions)**
- `buildExtendedContext()` is the facade
- Hides: disposition lookup, plot building, world state queries
- Caller needs only: persona, pc, storyState
- Returns: complete extension string

---

## Phase 1: Disposition Tracking (`src/disposition.js`) — LOW RISK

### Purpose
Track NPC-to-PC relationship levels. Standalone module, no dependencies on existing code.

### Required Exports

```javascript
module.exports = {
  // Constants
  DISPOSITION_LABELS,      // Map: level → label string
  DISPOSITION_FILE,        // Path to dispositions.json

  // Core functions
  loadDispositions,        // () → Object
  saveDispositions,        // (state) → void
  getDisposition,          // (npcId, pcId) → { level, label, history, impressions }
  modifyDisposition,       // (npcId, pcId, change, reason, gameDate) → newLevel

  // Prompt integration (standalone - returns string)
  getDispositionPromptModifier, // (level) → string

  // NPC config helpers
  getInitialDisposition,   // (npcConfig, pcId) → number
  applyBeatModifier,       // (npcId, pcId, beatId, npcConfig) → newLevel | null
  checkDispositionCap      // (npcConfig, currentLevel) → cappedLevel
};
```

### Function Specifications

**`DISPOSITION_LABELS`**
```javascript
const DISPOSITION_LABELS = {
  '-3': 'hostile',
  '-2': 'unfriendly',
  '-1': 'wary',
  '0': 'neutral',
  '1': 'favorable',
  '2': 'friendly',
  '3': 'allied'
};
```

**`getDisposition(npcId, pcId)`**
- Load dispositions file
- Return relationship data or default `{ level: 0, label: 'neutral', history: [], impressions: [] }`
- Never throws - returns default on missing data

**`modifyDisposition(npcId, pcId, change, reason, gameDate)`**
- Load current disposition
- Apply change, clamp to [-3, +3]
- Add history entry: `{ date: gameDate, change, reason }`
- Update label from DISPOSITION_LABELS
- Save and return new level

**`getDispositionPromptModifier(level)`**
Return prompt text based on level:
- `-3`: "You are HOSTILE toward this person. Be cold, obstructive, may refuse to help at all."
- `-2`: "You are UNFRIENDLY. Be curt, unhelpful, charge maximum prices, give minimal information."
- `-1`: "You are WARY. Be cautious, reserved. Don't volunteer information."
- `0`: "You are NEUTRAL. Professional but not warm."
- `1`: "You are FAVORABLE. Be helpful, maybe offer a small discount or extra info."
- `2`: "You are FRIENDLY. Be warm, genuinely helpful, go out of your way to assist."
- `3`: "You are ALLIED. Treat as trusted friend. Share secrets, take risks to help."

**`getInitialDisposition(npcConfig, pcId)`**
- Start with `npcConfig.disposition?.initial || 0`
- Apply any species modifiers from `npcConfig.disposition?.caps?.species_penalty`
- Return result

**`applyBeatModifier(npcId, pcId, beatId, npcConfig)`**
- Check `npcConfig.disposition?.modifiers` for matching trigger
- If found: call `modifyDisposition()` with the change
- Return new level or null if no modifier matched

**`checkDispositionCap(npcConfig, currentLevel)`**
- Check `npcConfig.disposition?.caps?.max_without_deed`
- If currentLevel exceeds cap, return cap
- Otherwise return currentLevel

---

## Phase 2: Plot Context Builder (`src/plot-context.js`) — LOW RISK

### Purpose
Build plot/story context strings. **Standalone module** - does NOT modify prompts.js.

### Required Exports

```javascript
module.exports = {
  buildPlotContext  // (storyState, npcConfig) → string
};
```

### Function Specification

```javascript
function buildPlotContext(storyState, npcConfig) {
  if (!storyState || !npcConfig) return '';

  const scope = npcConfig.plotAwareness?.scope || 'scene';
  const knowsAbout = npcConfig.plotAwareness?.knowsAbout || [];
  const beatReactions = npcConfig.plotAwareness?.beatReactions || {};

  let context = '\nCURRENT SITUATION:\n';

  // Add adventure context if scope allows
  if (['adventure', 'act'].includes(scope)) {
    context += `Adventure: ${storyState.adventure}\n`;
    context += `Current Act: ${storyState.currentAct}\n`;
  }

  // Add scene context
  if (storyState.currentScene) {
    context += `Current Scene: ${storyState.currentScene}\n`;
  }

  // Add relevant beat reactions
  for (const beatId of storyState.completedBeats || []) {
    if (beatReactions[beatId]) {
      context += `[React to: ${beatReactions[beatId]}]\n`;
    }
  }

  // Add relevant flags the NPC would know about
  if (knowsAbout.length > 0 && storyState.flags) {
    context += '\nFacts you know:\n';
    for (const topic of knowsAbout) {
      if (storyState.flags[topic] !== undefined) {
        context += `- ${topic}: ${storyState.flags[topic]}\n`;
      }
    }
  }

  return context;
}
```

---

## Phase 3: Skill Check (`src/skill-check.js`) — LOW RISK

### Purpose
Abstraction for skill checks. Standalone mock for prototype.

### Required Exports

```javascript
module.exports = {
  roll2d6,
  performCheck,
  hasSkillLevel
};
```

### Function Specifications

```javascript
function roll2d6() {
  return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
}

function performCheck(skill, threshold, options = {}) {
  const modifier = options.modifier || 0;
  const roll = roll2d6();
  const total = roll + modifier;

  return {
    success: total >= threshold,
    roll,
    total,
    threshold,
    margin: total - threshold
  };
}

function hasSkillLevel(pc, skill, minLevel) {
  if (!pc.skills_notable) return false;

  const skillEntry = pc.skills_notable.find(s => s.startsWith(skill));
  if (!skillEntry) return false;

  const match = skillEntry.match(/-(\d+)/);
  if (!match) return false;

  return parseInt(match[1], 10) >= minLevel;
}
```

---

## Phase 4: Info Gating (`src/info-gating.js`) — LOW RISK

### Purpose
Gate NPC knowledge behind skill checks. Standalone module.

### Required Exports

```javascript
module.exports = {
  UNLOCKS_FILE,
  loadUnlocks,
  saveUnlocks,
  isUnlocked,
  recordUnlock,
  attemptAccess,
  getAccessibleKnowledge,
  canAccessInfo
};
```

### Implementation
(Same as original plan - see full specification in tests)

---

## Phase 5: Triggers (`src/triggers.js`) — LOW RISK

### Purpose
NPC-initiated message triggers. **Standalone module** - does NOT modify story-engine.js.

### Required Exports

```javascript
module.exports = {
  TRIGGER_STATE_FILE,
  loadTriggerState,
  saveTriggerState,
  evaluateTrigger,
  processAllTriggers,
  markTriggerFired,
  hasTriggerFired,
  createNpcInitiatedMessage
};
```

### Implementation
(Same as original plan - see full specification in tests)

**NOTE:** `processAllTriggers()` is called by external code, not integrated into story-engine.js automatically.

---

## Phase 6: World State (`src/world-state.js`) — LOW RISK

### Purpose
Track shared facts and cross-NPC mentions. Standalone module.

### Required Exports

```javascript
module.exports = {
  WORLD_FACTS_FILE,
  loadWorldFacts,
  saveWorldFacts,
  addSharedFact,
  getSharedFacts,
  recordNpcMention,
  getMentionsAbout,
  checkContradiction,
  getFactionsForNpc,
  filterByFaction
};
```

### Implementation
(Same as original plan - see full specification in tests)

---

## Phase 7: Integration Layer (`src/prompt-extensions.js`) — LOW RISK

### Purpose
**NEW FILE** that combines all gap features into a single integration point. This isolates complexity away from prompts.js.

### Required Exports

```javascript
module.exports = {
  buildExtendedContext  // (persona, pc, storyState) → string
};
```

### Implementation

```javascript
/**
 * Prompt Extensions - Integration layer for gap features
 * Combines disposition, plot context, and world state into prompt extensions.
 *
 * ISOLATION: This module has NO side effects on prompts.js.
 * It returns strings that CAN be appended to system prompts.
 */

const { getDisposition, getDispositionPromptModifier } = require('./disposition');
const { buildPlotContext } = require('./plot-context');
const { getSharedFacts, getMentionsAbout } = require('./world-state');

/**
 * Build all extended context for NPC prompts
 * @param {Object} persona - NPC persona (must have .id)
 * @param {Object} pc - PC data (must have .id), or null
 * @param {Object} storyState - Story state, or null
 * @returns {string} Additional context to append to system prompt
 */
function buildExtendedContext(persona, pc, storyState) {
  let extensions = '';

  // 1. Disposition context
  if (pc && persona.id && pc.id) {
    const disp = getDisposition(persona.id, pc.id);
    extensions += '\n' + getDispositionPromptModifier(disp.level);
  }

  // 2. Plot context
  if (storyState) {
    extensions += buildPlotContext(storyState, persona);
  }

  // 3. World state context
  if (storyState && persona.id) {
    const facts = getSharedFacts(persona.id, storyState.adventure);
    if (facts.length > 0) {
      extensions += '\nWORLD FACTS YOU KNOW:\n';
      for (const fact of facts) {
        extensions += `- ${fact.content}\n`;
      }
    }

    if (pc && pc.id) {
      const mentions = getMentionsAbout(persona.id, pc.id);
      if (mentions.length > 0) {
        extensions += `\nThis person has been told about you by: ${mentions.map(m => m.from).join(', ')}\n`;
      }
    }
  }

  return extensions;
}

module.exports = {
  buildExtendedContext
};
```

### Test for Phase 7

Add to `tests/prompt-extensions.test.js`:

```javascript
#!/usr/bin/env node
/**
 * Prompt Extensions Integration Tests
 * AUDITOR INSTANCE: 5f069a8e-52eb-42c4-a874-17ce01f2100b
 */

const { strict: assert } = require('assert');

let promptExt;
try {
  promptExt = require('../src/prompt-extensions');
} catch (e) {
  console.error('Prompt-extensions module not yet implemented.\n');
  promptExt = {};
}

const { buildExtendedContext } = promptExt;

function runTests(tests) {
  let passed = 0, failed = 0;
  for (const [name, fn] of Object.entries(tests)) {
    try {
      fn();
      console.log(`\x1b[32m✓\x1b[0m ${name}`);
      passed++;
    } catch (e) {
      console.log(`\x1b[31m✗\x1b[0m ${name}`);
      console.log(`    ${e.message}`);
      failed++;
    }
  }
  console.log(`\n${passed}/${passed + failed} tests passed`);
  return failed === 0;
}

const tests = {
  'buildExtendedContext returns string': () => {
    const result = buildExtendedContext({}, null, null);
    assert.equal(typeof result, 'string');
  },

  'buildExtendedContext handles null inputs gracefully': () => {
    assert.doesNotThrow(() => buildExtendedContext(null, null, null));
    assert.doesNotThrow(() => buildExtendedContext({}, null, null));
    assert.doesNotThrow(() => buildExtendedContext({}, {}, null));
  },

  'buildExtendedContext includes disposition when pc provided': () => {
    const persona = { id: 'test-npc' };
    const pc = { id: 'test-pc' };
    const result = buildExtendedContext(persona, pc, null);
    // Should include disposition modifier (default neutral)
    assert.ok(result.includes('NEUTRAL') || result.toLowerCase().includes('neutral'));
  },

  'buildExtendedContext includes plot context when storyState provided': () => {
    const persona = { id: 'test-npc', plotAwareness: { scope: 'adventure' } };
    const storyState = { adventure: 'high-and-dry', currentAct: 'act-1', completedBeats: [] };
    const result = buildExtendedContext(persona, null, storyState);
    assert.ok(result.includes('high-and-dry') || result.includes('SITUATION'));
  }
};

console.log('\n══════════════════════════════════════════');
console.log('  PROMPT EXTENSIONS TESTS');
console.log('══════════════════════════════════════════\n');

const allPassed = runTests(tests);
process.exit(allPassed ? 0 : 1);
```

---

## ⚠️ STOP POINT — AUDITOR REVIEW REQUIRED

After completing Phases 1-7:
1. GENERATOR reports completion
2. AUDITOR verifies all tests pass
3. AUDITOR approves Phase 8

---

## Phase 8: Core Integration (`src/prompts.js`) — LOW+ RISK

### Purpose
Minimal modification to prompts.js to use the integration layer.

### Change Required

**Single addition to `assembleFullPrompt()`:**

```javascript
// At top of file, add import:
const { buildExtendedContext } = require('./prompt-extensions');

// In assembleFullPrompt(), after buildPCContext(), add:
function assembleFullPrompt(persona, memory, userMessage, pc = null, storyState = null) {
  let system = buildSystemPrompt(persona);

  if (pc) {
    system += buildPCContext(pc);
  }

  // === NEW: Gap features integration (3 lines) ===
  const extendedContext = buildExtendedContext(persona, pc, storyState);
  system += extendedContext;
  // === END NEW ===

  const contextSection = buildContextSection(memory);
  // ... rest unchanged
}
```

### Signature Change

Update function signature:
```javascript
// OLD:
function assembleFullPrompt(persona, memory, userMessage, pc = null)

// NEW:
function assembleFullPrompt(persona, memory, userMessage, pc = null, storyState = null)
```

### Rollback Plan

If issues occur:
1. Remove the 3-line addition
2. Remove import
3. All new modules remain functional for later integration

---

## Optional Phase 9: Story Engine Integration — DEFERRED

**NOT IN SCOPE for initial implementation.**

If needed later, add to `story-engine.js`:
```javascript
function recordBeatWithTriggers(state, beatId, gameDate, allNpcs) {
  recordBeat(state, beatId, gameDate);
  const { processAllTriggers } = require('./triggers');
  return processAllTriggers(state, gameDate, allNpcs);
}
```

---

## Test Commands

After each phase:
```bash
npm test
```

Individual test files:
```bash
node tests/disposition.test.js        # Phase 1
node tests/plot-context.test.js       # Phase 2
node tests/skill-check.test.js        # Phase 3
node tests/info-gating.test.js        # Phase 4
node tests/triggers.test.js           # Phase 5
node tests/world-state.test.js        # Phase 6
node tests/prompt-extensions.test.js  # Phase 7
```

---

## Files Summary

### New Files (Phases 1-7) — LOW RISK
- `src/disposition.js`
- `src/plot-context.js` (NEW - extracted from original Phase 2)
- `src/skill-check.js`
- `src/info-gating.js`
- `src/triggers.js`
- `src/world-state.js`
- `src/prompt-extensions.js` (NEW - integration layer)

### State Files (Already Created)
- `data/state/dispositions.json`
- `data/state/pc-unlocks.json`
- `data/state/trigger-state.json`
- `data/state/world-facts.json`

### Files Modified (Phase 8 only) — LOW+ RISK
- `src/prompts.js` — 3-line addition + signature change

### NOT Modified
- `src/story-engine.js` — Deferred to optional Phase 9

---

## GENERATOR: Begin Implementation

1. Implement Phases 1-7 (all LOW risk)
2. Run `npm test` after each phase
3. **STOP after Phase 7** — Report to AUDITOR
4. Wait for AUDITOR approval before Phase 8
