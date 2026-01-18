# Audit Plan: Narrator/NPC Voice Mixing System

**Status:** READY FOR GENERATOR
**Date:** 2026-01-17
**Auditor:** Claude (Auditor role)

---

## Objective

Enable seamless mixing of narrator description with NPC dialogue within single responses. Narrator sets scenes, NPCs speak in their distinct voices.

**Use Case:** Customs scene
```
NARRATOR: The customs hall is small but efficient. A bored-looking officer
in a worn uniform glances up as you approach.

CUSTOMS OFFICER: "Papers." He doesn't look up from his screen.
```

---

## Current State

- Narrator and NPCs are separate chat modes
- No mid-response voice switching
- NPCs don't "appear" naturally in narrator scenes

## Target State

- Narrator can invoke NPC voices mid-narration
- NPCs speak in their defined personality/style
- Clear visual distinction between narrator and NPC speech
- Automatic NPC injection based on `npcs_present` in scene

---

## Voice Mixing Format

### Option A: Inline Labels (Recommended)
```
The customs officer looks up from his paperwork.

**Customs Officer:** "Papers, please. Any weapons to declare?"

His tone is bored but professional. Behind him, a scanner hums.

**You can:**
- Present your documents
- Ask about weapon storage
- Attempt small talk
```

### Option B: Theatrical Format
```
NARRATOR
The customs hall is sparse. Fluorescent lights flicker.

CUSTOMS OFFICER
(barely glancing up)
Papers. Weapons declaration.

NARRATOR
He slides a form across the counter.
```

### Option C: Prose Integration
```
The customs officer barely glances up. "Papers," he says, sliding a form
across the counter. "Weapons declaration if you're carrying." His tone
suggests he's said this ten thousand times.
```

**Recommendation:** Option A for clarity, with Option C for flowing prose when appropriate.

---

## NPC Voice Profiles

### Add to NPC JSON: `voice` field

```json
{
  "id": "customs-officer-walston",
  "voice": {
    "style": "terse",
    "tone": "bored, professional",
    "speech_patterns": [
      "Short sentences",
      "Minimal pleasantries",
      "Procedural focus"
    ],
    "verbal_tics": ["Hmm", "Right then"],
    "sample_lines": [
      "Papers.",
      "Weapons declaration?",
      "Storage is ten credits a week. Standard rate."
    ]
  }
}
```

```json
{
  "id": "minister-greener",
  "voice": {
    "style": "formal",
    "tone": "businesslike, fair",
    "speech_patterns": [
      "Complete sentences",
      "Direct but not rude",
      "Explains reasoning"
    ],
    "verbal_tics": ["I'll be direct with you", "Fair enough"],
    "sample_lines": [
      "I'll make you a fair offer.",
      "The previous crew didn't deliver. You will.",
      "Three thousand credits. That's the deal."
    ]
  }
}
```

```json
{
  "id": "startown-bartender",
  "voice": {
    "style": "casual",
    "tone": "friendly, gossipy",
    "speech_patterns": [
      "Conversational",
      "Asks questions back",
      "Drops hints"
    ],
    "verbal_tics": ["You know how it is", "Between you and me"],
    "sample_lines": [
      "First time on Walston? Let me give you some tips.",
      "That crew? Good riddance, I say.",
      "You didn't hear this from me, but..."
    ]
  }
}
```

```json
{
  "id": "vargr-chauffeur",
  "voice": {
    "style": "professional-to-desperate",
    "tone": "shifts from calm to pleading",
    "speech_patterns": [
      "Formal when professional",
      "Emotionally transparent when stressed",
      "Vargr directness"
    ],
    "verbal_tics": [],
    "body_language_cues": ["ears flatten", "tail drops", "voice cracks"],
    "sample_lines": [
      "I know these roads well. I can get you there.",
      "Please. My parents are in the old quarter. They can't evacuate alone."
    ]
  }
}
```

---

## Narrator Directive System

### Scene-Based NPC Injection

When scene has `npcs_present`, narrator should naturally include them:

```json
// starport-arrival.json
{
  "npcs_present": ["customs-officer-walston"],
  "npc_injection_rules": {
    "customs-officer-walston": {
      "trigger": "entering customs",
      "initial_line": "Papers.",
      "demeanor": "bored but not hostile"
    }
  }
}
```

### Narrator Prompt Enhancement

Add to narrator system prompt:
```
=== VOICE MIXING ===
You narrate scenes AND voice NPCs present. Use this format:

For scene description: Write as narrator (no label needed for prose)

For NPC dialogue: Use **NPC Name:** "Dialogue here."

Example:
The customs hall is quiet. A single officer mans the desk.

**Customs Officer:** "Papers." He doesn't look up.

NPCs present in this scene: [customs-officer-walston]
- Voice: terse, bored, professional
- Sample: "Papers.", "Weapons declaration?", "Ten credits a week for storage."

When an NPC speaks, stay in their voice until returning to narration.
```

---

## Implementation Components

### 1. Voice Profile Loader

**File:** `src/voice-profiles.js`

```javascript
// Functions:
// - getVoiceProfile(npcId) -> { style, tone, patterns, samples }
// - formatNpcDialogue(npcId, dialogue) -> "**Name:** dialogue"
// - buildVoiceContext(npcIds) -> prompt section for narrator
```

### 2. Scene NPC Context Builder

**File:** `src/scene-npc-context.js`

```javascript
// Functions:
// - getNpcsForScene(adventureId, sceneId) -> [npcIds]
// - buildNpcVoiceContext(npcIds) -> formatted prompt injection
// - getInitialNpcLines(sceneId) -> { npcId: line } for scene entry
```

### 3. AGM Controller Enhancement

Update `src/agm-controller.js`:
- Inject NPC voice profiles when building narrator context
- Include `npcs_present` voices in system prompt
- Format guidance for voice mixing

---

## Deliverables

| # | File | Description |
|---|------|-------------|
| D1 | `data/npcs/*.json` | Add `voice` field to key NPCs |
| D2 | `src/voice-profiles.js` | Voice profile loader and formatter |
| D3 | `src/scene-npc-context.js` | Scene-aware NPC context builder |
| D4 | `src/agm-controller.js` | Integrate voice mixing into narrator prompt |
| D5 | Scene JSON updates | Add `npc_injection_rules` where appropriate |
| D6 | `tests/voice-mixing.test.js` | Test cases |

---

## Test Cases

```javascript
// TEST V.1: NPCs have voice field
const customs = loadNpc('customs-officer-walston');
assert.ok(customs.voice);
assert.ok(customs.voice.style);
assert.ok(customs.voice.sample_lines);

// TEST V.2: Voice profile loads
const { getVoiceProfile } = require('../src/voice-profiles');
const voice = getVoiceProfile('customs-officer-walston');
assert.ok(voice.tone);

// TEST V.3: Dialogue formatting works
const { formatNpcDialogue } = require('../src/voice-profiles');
const formatted = formatNpcDialogue('customs-officer-walston', 'Papers.');
assert.ok(formatted.includes('**'));
assert.ok(formatted.includes('Papers.'));

// TEST V.4: Scene NPC context builds
const { buildNpcVoiceContext } = require('../src/scene-npc-context');
const ctx = buildNpcVoiceContext(['customs-officer-walston']);
assert.ok(ctx.includes('customs'));
assert.ok(ctx.includes('terse') || ctx.includes('bored'));

// TEST V.5: Multiple NPCs in context
const ctx2 = buildNpcVoiceContext(['minister-greener', 'customs-officer-walston']);
assert.ok(ctx2.includes('Greener') || ctx2.includes('Minister'));
assert.ok(ctx2.includes('Customs') || ctx2.includes('customs'));

// TEST V.6: Scene provides NPC list
const { getNpcsForScene } = require('../src/scene-npc-context');
const npcs = getNpcsForScene('high-and-dry', 'starport-arrival');
assert.ok(npcs.includes('customs-officer-walston'));
```

---

## Example Output

### Before (narrator only)
```
You arrive at customs. An officer checks your papers.
What do you do?
```

### After (voice mixing)
```
The customs hall is functional rather than welcoming - prefab walls,
flickering displays, the hum of a weapon scanner. A single officer
sits behind the counter, attention split between a terminal and a
half-eaten sandwich.

He notices you approach and sets down his lunch with visible reluctance.

**Customs Officer:** "Papers." A pause. "Weapons declaration if you're
carrying anything fun."

His eyes drift to the cases you're hauling. The scanner behind him
pulses with a soft blue light.
```

---

## Vargr Voice Considerations

For Vargr NPCs, include body language in voice profile:

```json
{
  "id": "vargr-chauffeur",
  "voice": {
    "style": "professional-to-desperate",
    "body_language": {
      "neutral": "Ears upright, professional posture",
      "stressed": "Ears flatten, tail low, voice cracks",
      "pleading": "Full submission posture, undisguised desperation"
    },
    "integration_note": "Describe body language when emotional state shifts"
  }
}
```

Usage:
```
**Kira:** "Please." Her ears flatten against her skull. "My parents
are trapped in the old quarter."
```

---

## Implementation Order

1. D6: Create test file
2. D1: Add voice field to customs-officer, minister-greener, bartender, chauffeur
3. D2: Create voice-profiles.js
4. D3: Create scene-npc-context.js
5. D4: Update agm-controller.js
6. D5: Add npc_injection_rules to starport-arrival.json
7. Verify tests pass
