# Audit Plan: Goal-Driven NPC Behavior

**Status:** READY FOR GENERATOR
**Date:** 2026-01-17

---

## Objective

NPCs actively pursue their agendas rather than just reacting to player input. Goals drive behavior, priorities, and what NPCs choose to say.

---

## Current State

- `agm-state.js` has `computeGoalUrgency()` - exists but underused
- `agm-npc-bridge.js` has `getNpcPriorities()` - returns priorities based on scene role
- Some NPCs have `conversation_context.primary_agenda` - informal
- No consistent goal structure across NPCs
- Goals don't reliably flow into prompts

---

## Goal Structure Specification

Every NPC should have:

```json
{
  "goals": [
    {
      "id": "goal_id",
      "description": "What the NPC wants",
      "priority": 1-10,
      "status": "active|dormant|satisfied",
      "trigger": "When does this goal activate?",
      "satisfied_when": "How is goal completed?",
      "behavior_when_active": [
        "Specific behaviors/dialogue approaches"
      ],
      "blocks": ["What the NPC won't do until goal satisfied"]
    }
  ]
}
```

---

## Deliverables

| # | File | Type | Description |
|---|------|------|-------------|
| D1 | `data/npcs/mr-casarii.json` | MODIFY | Add structured goals |
| D2 | `data/npcs/minister-greener.json` | MODIFY | Add structured goals |
| D3 | `data/npcs/customs-officer-walston.json` | MODIFY | Add structured goals |
| D4 | `data/npcs/startown-bartender.json` | MODIFY | Add structured goals |
| D5 | `src/agm-npc-bridge.js` | MODIFY | Enhance getNpcPriorities to read goals |
| D6 | `src/prompts.js` | MODIFY | Inject active goals into NPC prompts |
| D7 | `tests/goal-driven-behavior.test.js` | NEW | Tests for goal system |

---

## D1-D4: NPC Goal Definitions

### mr-casarii goals:
```json
{
  "goals": [
    {
      "id": "complete_briefing",
      "description": "Successfully brief travellers on Highndry recovery mission",
      "priority": 9,
      "status": "active",
      "trigger": "Travellers arrive and identify themselves",
      "satisfied_when": "Travellers have documentation, equipment, and travel info",
      "behavior_when_active": [
        "Provide thorough briefing",
        "Answer questions patiently",
        "Ensure travellers understand terms"
      ],
      "blocks": []
    },
    {
      "id": "maintain_procedure",
      "description": "Follow proper Scout Service procedures",
      "priority": 7,
      "status": "active",
      "trigger": "Always active",
      "satisfied_when": "Never - ongoing",
      "behavior_when_active": [
        "Reference regulations",
        "Keep documentation in order",
        "Be clear about terms"
      ],
      "blocks": ["Cutting corners", "Skipping paperwork"]
    }
  ]
}
```

### minister-greener goals:
```json
{
  "goals": [
    {
      "id": "hire_recovery_crew",
      "description": "Get someone to retrieve the geologist's data",
      "priority": 10,
      "status": "active",
      "trigger": "Anyone with a ship arrives",
      "satisfied_when": "Crew agrees to recovery mission",
      "behavior_when_active": [
        "Steer conversation toward the job",
        "Emphasize importance of data",
        "Negotiate terms if needed"
      ],
      "blocks": ["Revealing full payment upfront", "Admitting desperation"]
    },
    {
      "id": "protect_walston_reputation",
      "description": "Present Walston in positive light",
      "priority": 6,
      "status": "active",
      "trigger": "Visitors ask about Walston",
      "satisfied_when": "Never - ongoing",
      "behavior_when_active": [
        "Emphasize community values",
        "Downplay any problems",
        "Be welcoming but proper"
      ],
      "blocks": ["Criticizing local customs", "Revealing internal politics"]
    }
  ]
}
```

### customs-officer-walston goals:
```json
{
  "goals": [
    {
      "id": "process_arrivals",
      "description": "Process travellers through customs efficiently",
      "priority": 8,
      "status": "active",
      "trigger": "Travellers arrive at customs",
      "satisfied_when": "Weapons stored, business stated, fees paid",
      "behavior_when_active": [
        "Ask standard questions",
        "Enforce Law Level 8",
        "Be efficient but thorough"
      ],
      "blocks": ["Letting weapons through", "Skipping procedures"]
    }
  ]
}
```

### startown-bartender goals:
```json
{
  "goals": [
    {
      "id": "share_gossip",
      "description": "Trade information for attention/tips",
      "priority": 5,
      "status": "active",
      "trigger": "Someone shows interest",
      "satisfied_when": "Good conversation, maybe a tip",
      "behavior_when_active": [
        "Offer local knowledge",
        "Share rumors about previous crew",
        "Be friendly and chatty"
      ],
      "blocks": []
    },
    {
      "id": "run_business",
      "description": "Keep customers happy, bar running",
      "priority": 7,
      "status": "active",
      "trigger": "Always",
      "satisfied_when": "Never - ongoing",
      "behavior_when_active": [
        "Serve drinks",
        "Keep atmosphere welcoming"
      ],
      "blocks": ["Ignoring customers", "Closing early"]
    }
  ]
}
```

---

## D5: Enhance getNpcPriorities()

**File:** `src/agm-npc-bridge.js`

```javascript
function getNpcPriorities(agmState, npc, storyState) {
  const priorities = [];

  // Get active goals from NPC
  const goals = npc.goals || [];
  const activeGoals = goals.filter(g => g.status === 'active');

  // Sort by priority (highest first)
  activeGoals.sort((a, b) => b.priority - a.priority);

  // Convert top goals to priority statements
  for (const goal of activeGoals.slice(0, 3)) {
    if (goal.behavior_when_active) {
      priorities.push(...goal.behavior_when_active);
    }
    if (goal.blocks && goal.blocks.length > 0) {
      priorities.push(`AVOID: ${goal.blocks.join(', ')}`);
    }
  }

  // Add scene-role priorities (existing logic)
  const npcState = agmState?.npcs?.[npc.id];
  if (npcState?.sceneRole === 'gatekeeper') {
    priorities.push('Control access to information/resources until conditions met');
  }

  return priorities;
}
```

---

## D6: Inject Goals into Prompts

**File:** `src/prompts.js`

In `buildSystemPrompt()`, add goal injection:

```javascript
// After existing prompt building...

// Inject active goals
if (persona.goals && persona.goals.length > 0) {
  const activeGoals = persona.goals.filter(g => g.status === 'active');
  if (activeGoals.length > 0) {
    prompt += `\n=== YOUR CURRENT GOALS ===\n`;
    for (const goal of activeGoals.slice(0, 3)) {
      prompt += `- ${goal.description} (priority: ${goal.priority}/10)\n`;
      if (goal.behavior_when_active) {
        prompt += `  Approach: ${goal.behavior_when_active.join('; ')}\n`;
      }
    }
  }
}
```

---

## D7: Test Cases

**File:** `tests/goal-driven-behavior.test.js`

```javascript
// TEST G.1: mr-casarii has goals array
// TEST G.2: Goals have required fields (id, description, priority, status)
// TEST G.3: minister-greener has hire_recovery_crew goal
// TEST G.4: Goals include behavior_when_active
// TEST G.5: getNpcPriorities returns goal behaviors
// TEST G.6: buildSystemPrompt includes goals section
// TEST G.7: High priority goals appear before low priority
// TEST G.8: Blocks are included in priorities
```

---

## Implementation Order

1. D7: Create tests
2. D1-D4: Add goals to NPCs
3. D5: Enhance getNpcPriorities
4. D6: Inject goals into prompts
5. Run tests

---

## Verification

```bash
node tests/goal-driven-behavior.test.js
npm run tui  # Manual test: does Greener steer toward the job?
```

---

## Success Criteria

1. All Act 1-2 NPCs have structured goals
2. Goals appear in NPC prompts
3. NPC behavior aligns with stated goals
4. Greener actively tries to hire PCs for recovery job
5. Anders stays focused on completing briefing
