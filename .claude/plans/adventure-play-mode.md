# Adventure Play Mode - Implementation Plan

**Status:** DRAFT
**Created:** 2026-01-17
**Purpose:** Enable playing High and Dry adventure via TUI

---

## Overview

Player takes role of Alex Ryder. AGM (AI Game Master) narrates scenes, invites player actions, manages NPC interactions, and resolves outcomes. Flow is AGM-directed with hybrid skill resolution.

---

## Design Principles

| Principle | Implementation |
|-----------|----------------|
| AGM-directed | AGM controls pacing, prompts for actions, advances scenes |
| Narrative resolution | Most outcomes from player description, no dice |
| Dice when uncertain | Auto-roll 2D6 only when outcome genuinely in doubt |
| Seamless NPC switching | AGM hands off to NPCs for dialogue, resumes narration after |
| Persistent state | Story progress, flags, choices saved between sessions |
| Non-linear time | AGM can jump to any scene, flashback, or time-skip |
| Decision impact | Player choices drastically alter narrative paths |

---

## Non-Linear Scene Control

### AGM Scene Authority

AGM has full control over scene selection. Not constrained to linear progression.

| Capability | Example |
|------------|---------|
| Time skip | "Three days pass aboard the Autumn Gold..." |
| Flashback | "You remember your last conversation with Casarii..." |
| Jump ahead | Skip directly to crisis if players dawdle |
| Parallel scenes | "Meanwhile, at the starport..." |
| Scene revisit | Return to location with changed context |

### Scene Directive Syntax

```
[SCENE: scene-id]           - Jump to specific scene
[SCENE: scene-id, TIME: +3d] - Jump with time advancement
[FLASHBACK: scene-id]       - Narrative flashback (no state change)
[MONTAGE: scene1, scene2]   - Summarize multiple scenes quickly
```

### AGM Scene Selection Prompt

```
=== SCENE CONTROL ===
You may advance the story to ANY scene when dramatically appropriate.
Available scenes: ${listAllScenes()}
Current scene: ${currentScene}
Completed scenes: ${completedScenes}

Consider:
- Player pacing preference (do they want detail or momentum?)
- Dramatic tension (skip to crisis if stakes need raising)
- Player choices so far: ${summarizeKeyChoices()}

Use [SCENE: id] to transition. You are not required to follow
linear order. Time skips and flashbacks are valid narrative tools.
```

---

## Decision Tracking System

### Decision Types

| Type | Example | Impact |
|------|---------|--------|
| **Binary choice** | Accept/refuse survey | Gates content, changes NPC attitudes |
| **Negotiation outcome** | Payment amount | Affects resources, relationship |
| **Moral choice** | Rescue Vargr vs Barvinn | Determines ending, NPC survival |
| **Style choice** | Stealth vs direct approach | Changes encounter difficulty |
| **Relationship choice** | Befriend/antagonize NPC | Opens/closes future options |

### Decision Storage

```json
{
  "decisions": {
    "survey_negotiation": {
      "timestamp": "2026-01-17T15:30:00Z",
      "scene": "meeting-greener",
      "choice": "accepted_cr4000",
      "details": "Pushed for higher payment, Greener agreed reluctantly",
      "consequences": {
        "payment_amount": 4000,
        "greener_disposition": -1,
        "flag_set": "survey_accepted"
      }
    },
    "tensher_encounter": {
      "timestamp": "2026-01-17T16:45:00Z",
      "scene": "finding-the-ship",
      "choice": "befriended_wolf",
      "details": "Fed the tensher, named it Kimbley",
      "consequences": {
        "has_pet": true,
        "pet_name": "Kimbley",
        "flag_set": "tensher_befriended"
      }
    },
    "rescue_priority": {
      "timestamp": "2026-01-17T18:00:00Z",
      "scene": "chauffeur-rescue",
      "choice": "attempted_both",
      "details": "Tried to save Vargr family AND Barvinn passengers",
      "consequences": {
        "pilot_checks_required": 3,
        "risk_level": "high"
      }
    }
  }
}
```

### Decision Impact on Narrative

AGM receives decision history in every prompt:

```
=== PLAYER DECISIONS (CRITICAL - THESE SHAPE THE STORY) ===

Key choices made:
1. [meeting-greener] Negotiated payment up to Cr4000
   → Greener is slightly annoyed but cooperative
   → Player has extra funds but less goodwill

2. [finding-the-ship] Befriended the tensher wolf
   → "Kimbley" now follows the party
   → May help in future encounters

3. [tensher-encounter] Chose stealth approach
   → Avoided combat but took longer
   → Party is uninjured but behind schedule

These decisions MUST influence your narration:
- Reference past choices naturally ("Kimbley growls at the stranger")
- Show consequences ("Greener's curt tone reflects your earlier haggling")
- Open/close paths based on decisions
- NPCs remember player reputation
```

### Consequence Propagation

```javascript
// src/decision-tracker.js
module.exports = {
  recordDecision: (storyState, decision) => {
    storyState.decisions[decision.id] = {
      timestamp: new Date().toISOString(),
      scene: storyState.currentScene,
      choice: decision.choice,
      details: decision.details,
      consequences: decision.consequences
    };

    // Apply immediate consequences
    for (const [flag, value] of Object.entries(decision.consequences)) {
      if (flag.startsWith('flag_')) {
        setFlag(storyState, flag.replace('flag_', ''), value);
      }
    }

    saveStoryState(storyState);
  },

  getDecisionSummary: (storyState) => {
    return Object.entries(storyState.decisions)
      .map(([id, d]) => `[${d.scene}] ${d.choice}: ${d.details}`)
      .join('\n');
  },

  checkDecisionMade: (storyState, decisionId) => {
    return storyState.decisions.hasOwnProperty(decisionId);
  },

  getDecisionConsequence: (storyState, decisionId, key) => {
    return storyState.decisions[decisionId]?.consequences?.[key];
  }
};
```

### Branching Narrative Paths

```
HIGH AND DRY - MAJOR BRANCH POINTS

1. Survey Acceptance (Act 2)
   ├─ Accept → Standard path, Greener cooperative
   ├─ Refuse → Must find ship independently, hostile relationship
   └─ Negotiate hard → Path open but strained relationship

2. Tensher Encounter (Act 3)
   ├─ Befriend → Pet companion, easier wilderness
   ├─ Kill → No pet, faster progress, slight guilt
   └─ Flee → Delays, tensher may return

3. Rescue Priority (Act 4) [CRITICAL]
   ├─ Vargr family → 3 saved, 11 at Barvinn die
   ├─ Barvinn → 11 saved, Vargr family dies
   └─ Attempt both → Pilot checks determine outcome

4. Ship Departure (Act 5)
   ├─ Wait for eruption to subside → Safer but longer
   ├─ Emergency takeoff → Risky but immediate
   └─ Rescue more survivors → Heroic but dangerous

Each branch affects:
- Available scenes
- NPC dispositions
- Resource availability
- Ending determination
```

---

## User Experience

### TUI Main Menu

```
╔════════════════════════════════════════╗
║     NPC PERSONA PROTOTYPE              ║
╠════════════════════════════════════════╣
║  1. Play High and Dry Adventure        ║
║  2. Communicate with NPC (Test Mode)   ║
║  3. Settings                           ║
║  4. Exit                               ║
╚════════════════════════════════════════╝

Select mode: 2
```

---

## NPC Communication Test Mode

Testing tool to verify NPC behavior in various contexts before/during adventure play.

### NPC Selection

```
╔════════════════════════════════════════╗
║  SELECT NPC TO TEST                    ║
╠════════════════════════════════════════╣
║  HIGH AND DRY NPCs:                    ║
║    1. Minister Greener                 ║
║    2. Captain Corelli                  ║
║    3. Customs Officer Walston          ║
║    4. Startown Bartender               ║
║    5. Mr. Casarii                      ║
║    6. Dictator Masterton               ║
║    7. Vargr Chauffeur                  ║
║                                        ║
║  [B] Back to Main Menu                 ║
╚════════════════════════════════════════╝

Select NPC: 1
```

### Communication Channel

```
╔════════════════════════════════════════╗
║  COMMUNICATION CHANNEL                 ║
║  NPC: Minister Greener                 ║
╠════════════════════════════════════════╣
║  1. In-Person                          ║
║  2. Radio/Comm Link                    ║
║  3. Email/Text Message                 ║
║  4. Telephone/Voice Call               ║
║  5. Intercom                           ║
║                                        ║
║  [B] Back to NPC Selection             ║
╚════════════════════════════════════════╝

Select channel: 1
```

### Scene Context

```
╔════════════════════════════════════════╗
║  SCENE CONTEXT                         ║
║  NPC: Minister Greener                 ║
║  Channel: In-Person                    ║
╠════════════════════════════════════════╣
║  1. First Meeting (no prior contact)   ║
║  2. After Survey Accepted              ║
║  3. During Crisis (eruption active)    ║
║  4. After Rescue (grateful)            ║
║  5. After Rescue (disappointed)        ║
║  6. Custom Context...                  ║
║                                        ║
║  [B] Back to Channel Selection         ║
╚════════════════════════════════════════╝

Select context: 3
```

### Story Flags (Optional)

```
╔════════════════════════════════════════╗
║  SET STORY FLAGS                       ║
║  (affects NPC knowledge & mood)        ║
╠════════════════════════════════════════╣
║  [x] survey_accepted                   ║
║  [ ] survey_complete                   ║
║  [x] eruption_started                  ║
║  [ ] ship_found                        ║
║  [ ] tensher_befriended                ║
║  [ ] rescue_complete                   ║
║                                        ║
║  [Enter] Continue with these flags     ║
║  [B] Back                              ║
╚════════════════════════════════════════╝
```

### Contact History Display

```
╔════════════════════════════════════════════════════╗
║  PREVIOUS CONTACTS WITH GREENER                    ║
╠════════════════════════════════════════════════════╣
║  Session 1 - In-Person, First Meeting              ║
║    "Negotiated payment, accepted survey"           ║
║    Disposition: +1 (cooperative)                   ║
║                                                    ║
║  Session 2 - Radio, During Crisis                  ║
║    "Coordinated rescue priorities"                 ║
║    Disposition: +2 (grateful)                      ║
║                                                    ║
║  [Enter] Start new conversation                    ║
║  [C] Clear history for fresh test                  ║
║  [B] Back                                          ║
╚════════════════════════════════════════════════════╝
```

### Test Conversation

```
═══════════════════════════════════════════════════════
TEST MODE: Greener | In-Person | During Crisis
Flags: survey_accepted, eruption_started
═══════════════════════════════════════════════════════

[GREENER - stressed, urgent]
"The volcano's gone active faster than anyone
predicted. We need that survey data NOW. What's
your status?"

> We're at the ship, repairs almost complete

[GREENER - relieved but tense]
"Good. Get airborne as soon as you can. We've got
evacuation in progress but the roads are chaos.
If you can provide aerial recon, it would help
immensely."

> /context

Current Test Context:
- NPC: Minister Greener
- Channel: In-Person
- Scene: During Crisis
- Flags: survey_accepted, eruption_started
- Disposition: +1 (cooperative)
- Turns: 2

> /flags +rescue_in_progress

Flag set: rescue_in_progress = true

> /channel radio

Switching to radio channel...

[GREENER - over radio, background noise]
"Ryder, you copy? We've got a situation at Barvinn..."

> /back

Return to context menu? (y/n): y
```

### Test Mode Commands

| Command | Action |
|---------|--------|
| `/back` | Return to context menu |
| `/context` | Show current test context |
| `/flags` | List all story flags |
| `/flags +name` | Set flag to true |
| `/flags -name` | Set flag to false |
| `/channel <type>` | Switch communication channel mid-test |
| `/disposition <n>` | Set NPC disposition (-3 to +3) |
| `/clear` | Clear conversation, keep context |
| `/reset` | Full reset to context menu |
| `/save` | Save this test conversation |

### Context-Aware Behavior

NPCs adjust behavior based on communication channel:

| Channel | NPC Behavior Changes |
|---------|---------------------|
| In-Person | Full dialogue, body language cues, can negotiate |
| Radio | Brief, urgent, protocol phrases, background noise |
| Email | Formal, delayed feel, references attachments |
| Telephone | Conversational but no visuals, can be interrupted |
| Intercom | Terse, task-focused, ship/building context |

### Use Cases for Test Mode

1. **Verify NPC knowledge gates** - Does Greener reveal ship location before survey acceptance?
2. **Test disposition effects** - How does hostile Greener differ from grateful?
3. **Check crisis behavior** - Do NPCs shift personality appropriately during eruption?
4. **Validate communication modes** - Is radio dialogue appropriately terse?
5. **Regression testing** - After NPC edits, verify behavior unchanged
6. **Explore edge cases** - What if player asks about topics NPC doesn't know?

### PC Selection

```
╔════════════════════════════════════════╗
║  SELECT YOUR CHARACTER                 ║
╠════════════════════════════════════════╣
║  1. Alex Ryder (Human Traveller)       ║
╚════════════════════════════════════════╝

Select PC: 1

Loading Alex Ryder...
```

### Scene Picker

```
╔════════════════════════════════════════╗
║  HIGH AND DRY - SELECT SCENE           ║
╠════════════════════════════════════════╣
║  ACT 1: THE JOURNEY                    ║
║    1. Scout Service Briefing           ║
║    2. Aboard Autumn Gold               ║
║    3. Layover at 567-908               ║
║                                        ║
║  ACT 2: WALSTON                        ║
║    4. Starport Arrival          ✓      ║
║    5. Meeting Minister Greener  ✓      ║
║    6. Gathering Information            ║
║                                        ║
║  ACT 3: THE MOUNTAIN                   ║
║    7. Journey to Highndry              ║
║    8. Mountain Climb                   ║
║    9. Finding the Ship                 ║
║   10. Ship Repairs                     ║
║                                        ║
║  ACT 4: THE CRISIS                     ║
║   11. Eruption Begins                  ║
║   12. Save the Ship                    ║
║   13. Rescue Operations                ║
║                                        ║
║  ACT 5: RESOLUTION                     ║
║   14. Aftermath                        ║
║                                        ║
║  [B] Back to Main Menu                 ║
╚════════════════════════════════════════╝

Select scene (or B to go back): 5
```

### Scene Start - Theatrical Framing

```
╔════════════════════════════════════════════════════╗
║  SCENE 5: MEETING MINISTER GREENER                 ║
╠════════════════════════════════════════════════════╣
║  Setting: Government Building, Greener's Office    ║
║                                                    ║
║  DRAMATIS PERSONAE:                                ║
║  • Alex Ryder (You)                                ║
║  • Minister Alan Greener - Survey Coordinator      ║
║                                                    ║
║  [Press Enter to begin, B to go back]              ║
╚════════════════════════════════════════════════════╝
```

### Scene Play

```
═══════════════════════════════════════════════════════
AGM: The government building is modest but functional.
A receptionist waves you through to Greener's office.

Minister Greener looks up from his desk, sizing you up.
His expression is cautious—the last travellers he dealt
with took his money and vanished.

"So you're here about the ship," he says, gesturing to
a chair. "Sit. Let me explain the situation."

What do you do?
═══════════════════════════════════════════════════════
> I sit and listen carefully

AGM: Greener nods, appreciating your patience.

[GREENER speaks]
"Six weeks ago, a crew came through claiming they'd
recover the Highndry for the Scout Service. I paid
them three thousand credits to survey Mount Salbarii
first—we need volcanic data. They took the money
and left on the next ship out."

He fixes you with a hard stare.

"I won't make that mistake twice. Survey first,
then I'll tell you where the ship is. Deal?"

What do you do?
═══════════════════════════════════════════════════════
> /back

Return to scene picker? (y/n): y

[Returning to scene picker...]
```

### In-Scene Commands

| Command | Action |
|---------|--------|
| `/back` | Return to scene picker (confirms first) |
| `/status` | Show current scene state, objectives |
| `/cast` | Show dramatis personae for this scene |
| `/resume` | Return from NPC dialogue to AGM |
| `/save` | Force save current state |
| `/help` | Show available commands |

### AGM as Director

The AGM controls the theatrical flow:
- Narrates scene setting and transitions
- Indicates when NPCs speak: `[GREENER speaks]`
- Prompts player action: "What do you do?"
- Manages pacing and dramatic beats
- Can call for skill checks when outcome uncertain
- Tracks which NPCs are "on stage"

### Player Interaction
```
> I ask about the ship's condition

Casarii pulls up a file. "The Highndry is a Type-S
Scout/Courier. She's been sitting on Walston for
about six weeks now. Previous crew had some...
legal troubles."

He slides a case across the desk. "Here's a repair
kit and Cr1000 for expenses. The ship's yours if
you can get her flying."

> I take the kit and ask about transport

"Passage is booked on the Autumn Gold, departing
tomorrow. Captain Corelli runs a tight ship.
Questions before you go?"

> No, I'm ready to depart

[Scene complete: departure_flammarion]
[Advancing to: Aboard Autumn Gold]

The far trader Autumn Gold is a working vessel...
```

### Skill Check Example
```
> I try to climb the rocky outcrop to save time

[Athletics check - outcome uncertain]
Rolling 2D6 + Athletics (1) + DEX modifier (1)...
Result: 7 + 2 = 9 vs difficulty 6+

You scramble up the rocks efficiently, shaving
an hour off your climb. The volcanic crater comes
into view above.
```

### NPC Dialogue Mode
```
AGM: Minister Greener leans back in his chair.
"So you're here about the ship. Let me explain
the situation..."

[Entering dialogue with Minister Greener]
[Type /resume to return to AGM narration]

Greener: "The previous crew took my money and
vanished. I need that volcano surveyed before
I'll tell you where the ship is."

> I understand. What's the pay?

Greener: "Three thousand credits. Non-negotiable
after what happened last time."

> /resume

[Returning to AGM narration]

AGM: Greener waits for your decision. The survey
seems straightforward, but negotiating might be
worth a try.

What do you do?
```

---

## Architecture

### New TUI Mode: Adventure Play

```
src/chat-tui.js
├── Mode: "npc-chat" (existing)
└── Mode: "adventure-play" (new)
    ├── AGM as primary conversant
    ├── Scene state tracking
    ├── NPC handoff/resume
    └── Skill check integration
```

### Core Components

| Component | File | Purpose |
|-----------|------|---------|
| AdventurePlayer | `src/adventure-player.js` | Main orchestrator |
| AGMController | `src/agm-controller.js` | AGM prompt building, response parsing |
| SkillResolver | `src/skill-resolver.js` | Dice rolling, modifier calculation |
| SceneManager | `src/scene-manager.js` | Scene transitions, beat tracking |

---

## Phase 1: Core Loop

### 1.1 New Command: `/play`

```javascript
// In chat-tui.js command handling
case '/play':
  const adventureId = args[0] || 'high-and-dry';
  await startAdventureMode(adventureId);
  break;
```

### 1.2 Adventure Player Module

```javascript
// src/adventure-player.js
module.exports = {
  // Initialize adventure play session
  startAdventure: async (adventureId, pcId) => {
    const adventure = loadAdventure(adventureId);
    const pc = loadPC(pcId);
    const storyState = loadOrCreateStoryState(adventureId);
    const agm = loadPersona('narrator-high-and-dry');

    return {
      adventure,
      pc,
      storyState,
      agm,
      mode: 'narration', // or 'npc-dialogue'
      activeNpc: null
    };
  },

  // Main interaction loop
  processPlayerInput: async (session, input) => {
    if (input.startsWith('/')) {
      return handleAdventureCommand(session, input);
    }

    if (session.mode === 'npc-dialogue') {
      return handleNpcDialogue(session, input);
    }

    return handleAgmNarration(session, input);
  },

  // AGM decides next action
  handleAgmNarration: async (session, playerAction) => {
    const prompt = buildAgmPrompt(session, playerAction);
    const response = await chat(session.agm, prompt, session.pc);

    // Parse AGM response for directives
    const parsed = parseAgmResponse(response);

    if (parsed.enterNpcDialogue) {
      session.mode = 'npc-dialogue';
      session.activeNpc = loadPersona(parsed.npcId);
    }

    if (parsed.skillCheck) {
      const result = resolveSkillCheck(parsed.skillCheck, session.pc);
      // AGM will incorporate result in next response
    }

    if (parsed.advanceScene) {
      advanceToScene(session, parsed.nextSceneId);
    }

    return parsed.narrativeText;
  }
};
```

### 1.3 AGM Prompt Structure

```javascript
// src/agm-controller.js
function buildAgmPrompt(session, playerAction) {
  const scene = getCurrentScene(session);

  return `
=== CURRENT STATE ===
Adventure: ${session.adventure.title}
Act: ${session.storyState.currentAct}
Scene: ${scene.title}
Completed Beats: ${session.storyState.completedBeats.join(', ')}

=== SCENE CONTEXT ===
${scene.narrator_prompt}

Objectives: ${scene.objectives.join(', ')}
NPCs Present: ${scene.npcs_present.join(', ')}

=== PLAYER CHARACTER ===
${buildPCContext(session.pc)}

=== PLAYER ACTION ===
${playerAction}

=== YOUR TASK ===
Narrate what happens. You may:
- Describe the outcome narratively (most common)
- Call for [SKILL_CHECK: skill difficulty reason] if outcome uncertain
- Switch to [NPC_DIALOGUE: npc-id] for extended conversation
- Mark [BEAT_COMPLETE: beat-id] when objective achieved
- Advance to [NEXT_SCENE: scene-id] when scene complete

Respond in character as the narrator. Be vivid but concise.
`;
}
```

### 1.4 Response Parsing

```javascript
// Parse AGM response for embedded directives
function parseAgmResponse(response) {
  const result = {
    narrativeText: response,
    skillCheck: null,
    enterNpcDialogue: false,
    npcId: null,
    beatComplete: null,
    advanceScene: false,
    nextSceneId: null
  };

  // Extract directives like [SKILL_CHECK: Athletics 8+ climbing]
  const skillMatch = response.match(/\[SKILL_CHECK:\s*(\w+)\s+(\d+)\+\s*(.+?)\]/);
  if (skillMatch) {
    result.skillCheck = {
      skill: skillMatch[1],
      difficulty: parseInt(skillMatch[2]),
      reason: skillMatch[3]
    };
    result.narrativeText = response.replace(skillMatch[0], '');
  }

  // Extract [NPC_DIALOGUE: npc-id]
  const npcMatch = response.match(/\[NPC_DIALOGUE:\s*(.+?)\]/);
  if (npcMatch) {
    result.enterNpcDialogue = true;
    result.npcId = npcMatch[1];
    result.narrativeText = response.replace(npcMatch[0], '');
  }

  // Extract [BEAT_COMPLETE: beat-id]
  const beatMatch = response.match(/\[BEAT_COMPLETE:\s*(.+?)\]/);
  if (beatMatch) {
    result.beatComplete = beatMatch[1];
    result.narrativeText = response.replace(beatMatch[0], '');
  }

  // Extract [NEXT_SCENE: scene-id]
  const sceneMatch = response.match(/\[NEXT_SCENE:\s*(.+?)\]/);
  if (sceneMatch) {
    result.advanceScene = true;
    result.nextSceneId = sceneMatch[1];
    result.narrativeText = response.replace(sceneMatch[0], '');
  }

  return result;
}
```

---

## Phase 2: Skill Resolution

### 2.1 Skill Resolver Module

```javascript
// src/skill-resolver.js
module.exports = {
  // Roll 2D6 + modifiers vs difficulty
  resolveCheck: (check, pc) => {
    const roll = rollDice(2, 6);
    const skillMod = getSkillModifier(pc, check.skill);
    const attrMod = getAttributeModifier(pc, check.skill);
    const total = roll + skillMod + attrMod;

    const success = total >= check.difficulty;
    const exceptional = total >= check.difficulty + 6;
    const fumble = roll === 2;

    return {
      roll,
      skillMod,
      attrMod,
      total,
      difficulty: check.difficulty,
      success,
      exceptional,
      fumble,
      margin: total - check.difficulty,
      narrative: formatCheckResult(check, total, success)
    };
  },

  formatCheckResult: (check, total, success) => {
    if (success) {
      return `[${check.skill} check: ${total} vs ${check.difficulty}+ = Success]`;
    } else {
      return `[${check.skill} check: ${total} vs ${check.difficulty}+ = Failure]`;
    }
  }
};
```

### 2.2 PC Stats Reference

```javascript
// Get modifier from PC skills
function getSkillModifier(pc, skillName) {
  const skill = pc.skills?.find(s =>
    s.name.toLowerCase() === skillName.toLowerCase()
  );
  return skill?.level || 0;
}

// Get attribute modifier for skill
function getAttributeModifier(pc, skillName) {
  // Traveller skill-attribute mapping
  const skillAttrs = {
    'Athletics': 'dex',
    'Pilot': 'dex',
    'Persuade': 'soc',
    'Diplomat': 'soc',
    'Electronics': 'edu',
    'Engineer': 'edu',
    'Survival': 'end'
  };

  const attr = skillAttrs[skillName] || 'int';
  const value = pc.characteristics?.[attr] || 7;
  return Math.floor((value - 7) / 3); // Traveller DM formula
}
```

---

## Phase 3: NPC Handoff

### 3.1 Entering NPC Dialogue

```javascript
async function enterNpcDialogue(session, npcId) {
  session.mode = 'npc-dialogue';
  session.activeNpc = loadPersona(npcId);
  session.npcMemory = loadMemory(npcId, session.pc.id);

  // Display transition
  console.log(`\n[Entering dialogue with ${session.activeNpc.name}]`);
  console.log('[Type /resume to return to AGM narration]\n');

  // NPC greeting based on scene context
  const greeting = await generateNpcGreeting(session);
  return greeting;
}
```

### 3.2 Resuming AGM Narration

```javascript
async function resumeAgmNarration(session) {
  // Save NPC conversation
  saveMemory(session.activeNpc.id, session.pc.id, session.npcMemory);

  session.mode = 'narration';
  session.activeNpc = null;

  console.log('\n[Returning to AGM narration]\n');

  // AGM summarizes and continues
  const summary = await generateTransitionSummary(session);
  return summary;
}
```

### 3.3 Adventure Commands

| Command | Action |
|---------|--------|
| `/resume` | Return from NPC dialogue to AGM |
| `/status` | Show current scene, objectives, progress |
| `/inventory` | Show PC equipment |
| `/save` | Force save current state |
| `/quit` | Exit adventure mode (auto-saves) |

---

## Phase 4: Scene Management

### 4.1 Scene Transitions

```javascript
async function advanceToScene(session, sceneId) {
  const currentScene = getCurrentScene(session);

  // Apply exit triggers
  if (currentScene?.plot_triggers?.on_exit) {
    for (const trigger of currentScene.plot_triggers.on_exit) {
      setFlag(session.storyState, trigger.set_flag, trigger.value);
    }
  }

  // Load new scene
  const newScene = loadScene(session.adventure.id, sceneId);
  session.storyState.currentScene = sceneId;

  // Apply entry triggers
  if (newScene.plot_triggers?.on_enter) {
    for (const trigger of newScene.plot_triggers.on_enter) {
      setFlag(session.storyState, trigger.set_flag, trigger.value);
    }
  }

  // Save state
  saveStoryState(session.storyState);

  // Display transition
  console.log(`\n[Scene complete: ${currentScene.id}]`);
  console.log(`[Advancing to: ${newScene.title}]\n`);

  // AGM narrates new scene entry
  return newScene.narrator_prompt;
}
```

### 4.2 Beat Tracking

```javascript
function markBeatComplete(session, beatId) {
  recordBeat(session.storyState, beatId);
  saveStoryState(session.storyState);

  console.log(`[Beat complete: ${beatId}]`);
}
```

---

## Phase 5: State Persistence

### 5.1 Adventure State File

```
data/state/adventures/high-and-dry-alex-ryder.json
```

```json
{
  "adventureId": "high-and-dry",
  "pcId": "alex-ryder",
  "currentAct": "act-2-walston",
  "currentScene": "meeting-greener",
  "completedBeats": [
    "departure_flammarion",
    "arrival_walston",
    "cleared_customs"
  ],
  "flags": {
    "arrived_walston": true,
    "legally_arrived": true,
    "weapon_stored": true
  },
  "choices": {},
  "gameDate": "003-1105",
  "lastPlayed": "2026-01-17T15:30:00Z"
}
```

### 5.2 Resume Adventure

```javascript
async function resumeAdventure(adventureId, pcId) {
  const statePath = `data/state/adventures/${adventureId}-${pcId}.json`;

  if (fs.existsSync(statePath)) {
    const state = JSON.parse(fs.readFileSync(statePath));
    console.log(`Resuming ${adventureId} at ${state.currentScene}...`);
    return state;
  }

  return createStoryState(adventureId);
}
```

---

## Testing Strategy

### Unit Tests: `tests/adventure-player.test.js`

```javascript
'startAdventure initializes session correctly': async () => {
  const session = await startAdventure('high-and-dry', 'alex-ryder');
  assert.equal(session.adventure.id, 'high-and-dry');
  assert.equal(session.pc.id, 'alex-ryder');
  assert.equal(session.mode, 'narration');
}

'parseAgmResponse extracts skill check directive': async () => {
  const response = 'You attempt the climb. [SKILL_CHECK: Athletics 8+ rocky terrain]';
  const parsed = parseAgmResponse(response);
  assert.equal(parsed.skillCheck.skill, 'Athletics');
  assert.equal(parsed.skillCheck.difficulty, 8);
}

'resolveCheck calculates modifiers correctly': async () => {
  const pc = { skills: [{ name: 'Athletics', level: 1 }], characteristics: { dex: 9 } };
  // Mock dice roll
  const result = resolveCheck({ skill: 'Athletics', difficulty: 6 }, pc);
  assert.ok(result.skillMod === 1);
  assert.ok(result.attrMod === 0); // (9-7)/3 = 0
}
```

### Integration Tests: `tests/integration/adventure-play.test.js`

```javascript
'full scene playthrough updates state': async () => {
  const session = await startAdventure('high-and-dry', 'alex-ryder');

  // Simulate scene completion
  await advanceToScene(session, 'starport-arrival');

  assert.ok(session.storyState.flags.arrived_walston);
  assert.equal(session.storyState.currentScene, 'starport-arrival');
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/tui-menu.js` | Main menu, PC picker, scene picker with box drawing |
| `src/npc-test-mode.js` | NPC communication testing: channel, context, flags |
| `src/adventure-player.js` | Main orchestrator, scene loop |
| `src/agm-controller.js` | AGM prompt building, theatrical framing, decision injection |
| `src/skill-resolver.js` | Dice and modifier calculation |
| `src/scene-manager.js` | Non-linear scene transitions, dramatis personae |
| `src/decision-tracker.js` | Decision recording, consequence propagation |
| `src/contact-history.js` | Track test conversations per NPC/context |
| `tests/adventure-player.test.js` | Unit tests |
| `tests/skill-resolver.test.js` | Dice tests |
| `tests/decision-tracker.test.js` | Decision tracking tests |
| `tests/npc-test-mode.test.js` | Test mode unit tests |
| `tests/integration/adventure-play.test.js` | E2E tests |

## Files to Modify

| File | Changes |
|------|---------|
| `src/chat-tui.js` | Replace direct NPC chat with main menu, add adventure mode loop |
| `data/npcs/narrator-high-and-dry.json` | Add AGM directives, theatrical framing, decision awareness |
| `data/pcs/alex-ryder.json` | Ensure skills/characteristics complete |
| `data/adventures/high-and-dry/adventure.json` | Add scene ordering for picker display |

---

## Implementation Order

| Order | Phase | Deliverable |
|-------|-------|-------------|
| 1 | TUI Menu | Main menu, mode selection, box-drawing UI |
| 2 | NPC Test Mode | NPC picker, channel, context, flags, `/context` commands |
| 3 | Contact History | Track conversations, display history, clear option |
| 4 | Scene Picker | PC selector, scene list by act, `/back` navigation |
| 5 | Core Loop | AGM narration, theatrical framing, `[NPC speaks]` |
| 6 | Decision Tracking | Record choices, inject into AGM prompt |
| 7 | Non-Linear Scenes | AGM can jump to any scene, time skips |
| 8 | Skill Resolution | Dice rolling when outcome uncertain |
| 9 | NPC Handoff | `/resume`, dialogue mode switching |
| 10 | State Persistence | Save/load decisions, resume adventure |
| 11 | Polish | `/status`, `/cast`, `/help` in adventure mode |

---

## Verification Checklist

### Main Menu
- [ ] TUI starts with main menu (Play Adventure / Test NPC / Settings / Exit)
- [ ] `/back` navigation works at every level

### NPC Test Mode
- [ ] NPC picker shows all adventure NPCs
- [ ] Channel picker (in-person, radio, email, phone, intercom)
- [ ] Context picker shows scene-appropriate options
- [ ] Story flags can be toggled with `/flags +name` and `-name`
- [ ] `/channel` switches communication mode mid-conversation
- [ ] `/disposition` adjusts NPC attitude
- [ ] Contact history displays previous test sessions
- [ ] Clear history option for fresh testing
- [ ] NPC behavior changes appropriately per channel (radio = terse, email = formal)

### Adventure Mode
- [ ] "Play High and Dry" shows PC selector (Alex Ryder)
- [ ] Scene picker shows all scenes grouped by act with checkmarks for completed
- [ ] Scene start shows dramatis personae before beginning
- [ ] AGM narrates with `[NPC speaks]` for dialogue
- [ ] AGM prompts "What do you do?" for player action
- [ ] Decisions recorded with consequences
- [ ] AGM references past decisions in narration
- [ ] AGM can jump to any scene non-linearly
- [ ] `/cast` shows current scene NPCs
- [ ] Skill checks auto-roll when AGM requests
- [ ] NPC dialogue mode switches correctly
- [ ] `/resume` returns to AGM narration
- [ ] Scene transitions apply triggers and update state
- [ ] Beats marked when objectives complete
- [ ] State persists between sessions
- [ ] All existing tests still pass
