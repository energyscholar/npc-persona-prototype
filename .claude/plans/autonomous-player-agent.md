# Plan: Autonomous Player Agent (CC Plays Alex Ryder)

**Status:** READY FOR REVIEW
**Date:** 2026-01-18
**Scope:** Claude Code autonomously plays through High and Dry adventure

---

## Summary

Create infrastructure for Claude Code to play through adventures as an autonomous agent. CC controls Alex Ryder, interacts with NPCs, makes decisions at choice points, and attempts to complete the adventure. This tests the adventure's coherence, NPC responses, and overall playability from a real player's perspective.

---

## Concept

Unlike the scripted golden path tests, the autonomous player:
- **Makes decisions** based on goals and context
- **Adapts** to NPC responses and unexpected situations
- **Explores** alternative paths
- **Reports** on experience (confusion, dead ends, inconsistencies)

### Use Cases

1. **Adventure QA** - Does the adventure flow well? Are choices meaningful?
2. **NPC Quality** - Do NPCs respond appropriately? Are they helpful when needed?
3. **Completability** - Can a reasonable player complete the adventure?
4. **Edge Case Discovery** - What happens with unusual choices?

---

## Architecture

### Player Agent Loop

```javascript
async function playAdventure(adventureId, playerId, options = {}) {
  const session = await initSession(adventureId, playerId);
  const agent = createPlayerAgent(options);

  while (!session.isComplete && !session.isStuck) {
    // 1. Observe current state
    const observation = await observeState(session);

    // 2. Agent decides action
    const action = await agent.decide(observation);

    // 3. Execute action
    const result = await executeAction(session, action);

    // 4. Log for analysis
    agent.log({ observation, action, result });

    // 5. Check for stuck/loop detection
    if (agent.detectLoop()) {
      session.isStuck = true;
    }
  }

  return agent.generateReport();
}
```

### Observation Structure

```javascript
{
  scene: {
    id: 'starport-arrival',
    description: '...',
    availableActions: ['talk_to_customs', 'explore_starport', 'go_to_hotel']
  },
  flags: ['mission_accepted', 'met_corelli'],
  inventory: { carried: [...], stored: {...} },
  recentHistory: [
    { turn: 1, action: 'talked to Jeri', response: '...' },
    { turn: 2, action: 'accepted mission', response: '...' }
  ],
  currentGoal: 'Get to Walston and find the ship',
  npcPresent: ['customs-officer-walston']
}
```

### Agent Decision Prompt

```javascript
const PLAYER_AGENT_SYSTEM = `You are Alex Ryder, playing through the High and Dry adventure.

Your goals:
1. Complete the mission (find and claim the downed scout ship)
2. Explore thoroughly but don't get stuck
3. Be a "reasonable player" - make choices a typical player would make
4. Note when things are confusing, inconsistent, or frustrating

Current situation:
{observation}

What do you do next? Respond with:
- ACTION: [specific action to take]
- REASONING: [why you chose this]
- CONCERNS: [any issues noticed, or "none"]
`;
```

### Action Types

| Type | Example | Execution |
|------|---------|-----------|
| `talk` | `talk customs-officer-walston "Hello"` | Send chat to NPC |
| `choice` | `choice accept_mission` | Select menu option |
| `move` | `move startown-hotel` | Scene transition |
| `examine` | `examine surroundings` | Request description |
| `inventory` | `inventory check` | Review items |
| `wait` | `wait` | Pass time |

---

## Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `src/player-agent.js` | Agent decision engine |
| 2 | `src/agent-runner.js` | Session management and action execution |
| 3 | `src/agent-reporter.js` | Generate playthrough reports |
| 4 | `tests/autonomous-player.test.js` | Acceptance tests |
| 5 | `scripts/run-player-agent.js` | CLI to run autonomous play |

---

## Test Cases

### Core Functionality (autonomous-player.test.js)

```javascript
// Module existence
test('player-agent.js exports createPlayerAgent');
test('agent-runner.js exports playAdventure');
test('agent-reporter.js exports generateReport');

// Agent decisions
test('agent produces valid action from observation');
test('agent action has ACTION, REASONING, CONCERNS fields');
test('agent detects when stuck in loop');

// Session integration
test('playAdventure initializes session correctly');
test('playAdventure can complete scout-office scene');
test('playAdventure logs each turn');

// Report generation
test('generateReport includes scenes visited');
test('generateReport includes concerns raised');
test('generateReport includes completion status');
```

### Integration Tests

```javascript
// Can play through first scene
test('agent completes scout-office accepting mission');

// Loop detection works
test('agent detects if repeating same action 3+ times');

// Handles NPC conversation
test('agent can have multi-turn NPC conversation');
```

---

## Report Format

```javascript
{
  adventureId: 'high-and-dry',
  playerId: 'alex-ryder',
  result: 'completed' | 'stuck' | 'failed' | 'abandoned',
  turns: 47,
  scenesVisited: ['scout-office', 'aboard-autumn-gold', ...],
  flagsAcquired: ['mission_accepted', 'met_corelli', ...],
  concerns: [
    { turn: 12, scene: 'meeting-greener', issue: 'Unclear how to proceed after negotiation' },
    { turn: 23, scene: 'desert-crossing', issue: 'NPC gave contradictory directions' }
  ],
  npcInteractions: {
    'minister-greener': { turns: 5, disposition_change: +2 },
    'customs-officer-walston': { turns: 2, disposition_change: 0 }
  },
  timeline: [
    { turn: 1, scene: 'scout-office', action: 'talk jeri-tallux', summary: 'Accepted mission' },
    ...
  ]
}
```

---

## CLI Usage

```bash
# Run autonomous playthrough
node scripts/run-player-agent.js high-and-dry alex-ryder

# With options
node scripts/run-player-agent.js high-and-dry alex-ryder --max-turns 100 --verbose

# Save report
node scripts/run-player-agent.js high-and-dry alex-ryder --output report.json
```

---

## Implementation Order

1. **Test file** - Write acceptance tests first (Auditor)
2. **player-agent.js** - Agent decision logic
3. **agent-runner.js** - Session and action execution
4. **agent-reporter.js** - Report generation
5. **run-player-agent.js** - CLI runner
6. **Integration** - End-to-end test with real adventure

---

## Risks

| Risk | Mitigation |
|------|------------|
| Agent makes nonsensical choices | Constrain action space, validate actions |
| Infinite loops | Loop detection, max turns limit |
| API costs | Use Haiku for agent decisions |
| Non-deterministic | Log everything for reproducibility |

---

## Success Criteria

1. Agent can complete scout-office scene (accept mission)
2. Agent can navigate to Walston (starport-arrival)
3. Agent can have meaningful NPC conversation
4. Agent reports concerns when confused
5. Full playthrough generates actionable report

---

## Handoff

Generator implements: `src/player-agent.js`, `src/agent-runner.js`, `src/agent-reporter.js`, `scripts/run-player-agent.js` per tests in `tests/autonomous-player.test.js`.
