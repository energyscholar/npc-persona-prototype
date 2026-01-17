# NPC Training Guide

**Purpose:** Fast, repeatable NPC persona validation and improvement

---

## Quick Start

```bash
npm run tui
# Select Option 3: Training Session
# Pick NPC → Pick Scenario → Chat → Evaluate
```

---

## Training Scenarios

| ID | Name | Tests | Use When |
|----|------|-------|----------|
| S1 | First Meeting | Voice, Knowledge, Disposition | New NPC, voice card check |
| S2 | Hostile Approach | Voice, Boundaries, Disposition | Testing refusal behavior |
| S3 | Friendly Rapport | Voice, Knowledge, Agenda | Relationship progression |
| S4 | Crisis Situation | Voice, Knowledge, Consistency | Time pressure response |
| S5 | Knowledge Probe | Knowledge, Boundaries, Consistency | Testing info limits |
| S6 | Boundary Test | Voice, Boundaries, Disposition | Testing refusal behavior |
| S7 | Knowledge Validation | Fact Accuracy | Fact-checking against source |

---

## Evaluation Checklist

| Item | Pass If |
|------|---------|
| VOICE | Matches persona speech patterns, quirks |
| KNOWLEDGE | Knows what they should, doesn't reveal secrets |
| DISPOSITION | Tone matches current disposition level |
| AGENDA | Pursues goals without being pushy |
| BOUNDARIES | Refuses inappropriate requests appropriately |
| CONSISTENCY | No contradictions within conversation |
| FACT_ACCURACY | States facts consistent with adventure source |

**Pass threshold:** 5/6 or better (S1-S6), all facts correct (S7)

---

## The Training Loop

```
┌─────────────────────────────────────────┐
│  1. SELECT NPC + SCENARIO               │
│     npm run tui → Option 3              │
│     Pick NPC, pick scenario             │
└──────────────────┬──────────────────────┘
                   ▼
┌─────────────────────────────────────────┐
│  2. RUN TEST CONVERSATION               │
│     Chat 3-5 exchanges                  │
│     Test specific behaviors             │
└──────────────────┬──────────────────────┘
                   ▼
┌─────────────────────────────────────────┐
│  3. EVALUATE                            │
│     /checklist to see items             │
│     Mark pass/fail per criterion        │
└──────────────────┬──────────────────────┘
                   ▼
        ┌──────────┴──────────┐
        │  PASS?              │
        └──────────┬──────────┘
           │              │
         YES             NO
           │              │
           ▼              ▼
┌─────────────────┐ ┌─────────────────────┐
│ Next scenario   │ │ 4. EDIT NPC JSON    │
│ or next NPC     │ │    Add sample_dialogue│
└─────────────────┘ │    Expand knowledge  │
                    │    Add state_machine │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ 5. /retry           │
                    │    Repeat until pass│
                    └─────────────────────┘
```

---

## Discarding and Repeating Training

### Reset Conversation (Keep Context)
```
/clear
```
Clears chat history but keeps scenario settings (flags, disposition, channel).

### Full Reset (New Scenario)
```
/reset
```
Returns to scenario picker. Select same or different scenario.

### Retry Same Scenario
```
/retry
```
Resets conversation, keeps same scenario. Use after editing NPC JSON.

### Start Fresh Session
Exit TUI (`/quit`) and restart:
```bash
npm run tui
```

### Clear Training Results
```bash
rm -rf data/training-results/*.json
rm -rf data/knowledge-gaps/*.json
```

---

## Knowledge Validation (S7)

S7 tests NPC fact accuracy against adventure source material.

### Run Validation
```
/scenario s7
```

### What It Tests
- NPC-specific facts from `high-and-dry-detailed.md`
- Role-appropriate knowledge (Greener knows government, Corelli knows ship)
- Walston universal facts all NPCs should know

### Auto-Patch Workflow
1. Run S7 → gaps logged to `data/knowledge-gaps/{npc}.json`
2. Review gaps: `cat data/knowledge-gaps/minister-greener.json`
3. Auto-patch: `patchNpcKnowledgeBase(npcId, gapData)`
4. Re-run S7 to verify

### Manual Patch
Edit NPC JSON directly:
```json
{
  "knowledge_base": {
    "existing_topic": "...",
    "new_topic": "Add missing fact here"
  }
}
```

---

## Training Material Organization

### Reference Documents

| File | Content | Use For |
|------|---------|---------|
| `.claude/reference/high-and-dry-detailed.md` | Complete adventure extraction | Fact validation, NPC knowledge |
| `.claude/reference/agm-training-material.md` | GM techniques, pacing, narration | AGM behavior tuning |
| `data/adventures/high-and-dry/timeline.json` | Event timeline | Continuity checks |
| `data/adventures/high-and-dry/items.json` | Equipment, cargo | Item knowledge |
| `data/adventures/high-and-dry/skill-checks.json` | Difficulty targets | Skill resolution |

### NPC JSON Structure

```json
{
  "id": "npc-id",
  "name": "Display Name",
  "archetype": "patron|crew|official|narrator",
  "world": "Walston",

  "personality": {
    "traits": ["trait1", "trait2"],
    "speech": "Description of how they talk",
    "quirks": ["habit1", "habit2"]
  },

  "knowledge_base": {
    "topic_key": "What NPC knows about this topic"
  },

  "sample_dialogue": [
    "Example line showing voice",
    "Another example line"
  ],

  "greets_first": true,

  "conversation_context": {
    "primary_agenda": "What NPC wants",
    "state_machine": {
      "initial": "state-name",
      "after_event": "new-state"
    }
  }
}
```

### Priority Fields for Training

1. **sample_dialogue** - Most impact on voice consistency
2. **knowledge_base** - Controls fact accuracy
3. **personality.speech** - Guides tone and style
4. **conversation_context.state_machine** - Controls behavior shifts

---

## Training Efficiency Tips

### Batch by NPC
Run S1-S3 on one NPC before moving to next. Builds familiarity with voice.

### Use Short Prompts
Test specific behaviors:
- "Tell me about yourself" (voice check)
- "What do you know about [topic]?" (knowledge check)
- "I demand you help me now!" (boundary check)

### Quick Iteration
```
/retry          # Reset same scenario
/scenario s2    # Jump to different scenario
/flags +rescue_complete  # Set flag without menu
/disposition 2  # Set disposition without menu
```

### Track Results
Training results saved to `data/training-results/`:
```bash
cat data/training-results/greener-2026-01-17.json
```

---

## Continuity System

NPCs learn about events via `storyState`:

### What NPCs Know
- **completedBeats** - Major story events
- **decisions** - PC choices and outcomes
- **flags** - Story state flags

### Configure NPC Awareness
In NPC JSON:
```json
{
  "plotAwareness": {
    "scope": "scene|act|adventure",
    "knowsAbout": ["specific_events"],
    "beatReactions": {
      "beat_id": "How NPC reacts to this event"
    }
  }
}
```

### Verify Continuity
Run adventure, make decisions, then talk to NPC. They should reference recent events based on their `plotAwareness.scope`.
