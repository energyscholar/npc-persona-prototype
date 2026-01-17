# High and Dry - Comprehensive Improvement Plan

**Status:** READY FOR IMPLEMENTATION
**Created:** 2026-01-17 (Post-Extraction)
**Purpose:** Gap analysis + improvements based on extracted adventure data

---

## Knowledge Index

### New Data Files Created

| File | Contents | Location |
|------|----------|----------|
| `items.json` | PC equipment, cargo, creatures, payments | `data/adventures/high-and-dry/items.json` |
| `skill-checks.json` | All checks by scene, modifiers, recovery | `data/adventures/high-and-dry/skill-checks.json` |
| `timeline.json` | Durations, backstory, NPC timing knowledge | `data/adventures/high-and-dry/timeline.json` |
| `high-and-dry-detailed.md` | Complete extraction reference | `.claude/reference/high-and-dry-detailed.md` |

### Cross-Project Knowledge Links

| Resource | Path | Contents |
|----------|------|----------|
| Wiki Cache | `/home/bruce/software/traveller-starship-operations-vtt/data/wiki-cache/` | 432 systems |
| NPC Summaries | `/home/bruce/software/traveller-VTT-private/.claude/reference/high-and-dry-*.md` | Original analysis |
| PDF (DO NOT READ) | `/home/bruce/software/traveller-VTT-private/reference/adventures/MgT 2E - Marches Adventure 1 High and Dry.pdf` | Source |
| Text Extract | `/tmp/high-and-dry.txt` | 2085 lines, safe to read |

---

## Gap Analysis Summary

### Critical Gaps

| Category | Gap Count | Severity |
|----------|-----------|----------|
| Missing NPCs | 2 | CRITICAL |
| Missing Scenes | 5 | CRITICAL |
| Unlinked Skill Checks | 7 sections | HIGH |
| No Plot Triggers | 8 scenes | HIGH |
| Sparse NPC Knowledge | 2 NPCs | MEDIUM |
| Missing Sample Dialogue | 3 NPCs | MEDIUM |

---

## Phase 1: Knowledge Indexing

### 1.1 Update KNOWLEDGE-RESOURCES.md

Add new data file references:

```markdown
### 3. Adventure Data (High and Dry)

**Location:** `data/adventures/high-and-dry/`

**Contents:**
- items.json - Equipment, cargo, creatures, payments
- skill-checks.json - All checks by scene with modifiers
- timeline.json - Durations and NPC timing knowledge

**API (to create):**
- getItem(itemId) → item details
- getSkillCheck(checkId) → difficulty, skill, notes
- getTimeline(adventureId) → timeline object
- getNpcTimingKnowledge(npcId) → what NPC knows about timing
```

### 1.2 Create Adventure Data Loader (`src/adventure-data.js`)

```javascript
// New module to load adventure-specific data
module.exports = {
  loadItems: (adventureId) => {...},
  loadSkillChecks: (adventureId) => {...},
  loadTimeline: (adventureId) => {...},
  getItemsByRole: (npcId, adventureId) => {...},
  getRelevantChecks: (sceneId, adventureId) => {...},
  getNpcTimingKnowledge: (npcId, adventureId) => {...}
};
```

---

## Phase 2: Missing NPCs

### 2.1 Mr Anders Casarii (Scout Service Officer)

**File:** `data/npcs/mr-casarii.json`

**Knowledge Base Topics:**
- Highndry inheritance documentation
- Scout ship specifications
- Travel logistics (168hr jump, 567-908 stopover)
- Previous crew arrest history
- Scout Service payment terms
- Ship recovery mission briefing

**Relationships:**
- PCs: helpful-professional
- Greener: professional contact
- Corelli: Scout Service orbit

**Sample Dialogue (5):**
- Inheritance explanation
- Travel route briefing
- Equipment handoff
- Warning about previous crew
- Expense account details

### 2.2 Vargr Chauffeur

**File:** `data/npcs/vargr-chauffeur.json`

**Knowledge Base Topics:**
- Walston geography and evacuation routes
- Family situation (parents in danger zone)
- Employment with Dictator's office
- Driving and survival skills
- Emergency procedures

**Relationships:**
- PCs: professional → desperate
- Masterton: loyal employee
- Parents: devoted child

**Sample Dialogue (5):**
- Pre-crisis professional interaction
- Distress call (already in encounter file)
- Gratitude if rescued
- Devastation if abandoned
- Recovery dialogue

---

## Phase 3: NPC Knowledge Enhancements

### 3.1 Customs Officer Brennan Corfe

**Add to knowledge_base:**
- customs_procedures: detailed weapon storage, cargo inspection
- port_records: how to access ship traffic data
- intel_gathering: what questions to ask, who knows what
- ship_schedules: typical traffic patterns

**Add sample_dialogue (4):**
- Questioning about purpose
- Ship record access guidance
- Casual intel sharing
- Warning about regulations

### 3.2 Dictator Masterton

**Add to knowledge_base:**
- peacetime_governance: normal duties, governing philosophy
- walston_history: how he came to power, tenure
- crisis_leadership: command style, priorities
- vargr_policy: official stance on Vargr treatment

**Add sample_dialogue (4):**
- Public announcement style
- Crisis command orders
- Moral weight in rescue decision
- Gratitude/disappointment based on outcome

---

## Phase 4: Missing Scenes

### 4.1 Aboard Autumn Gold (`scenes/aboard-autumn-gold.json`)

**Purpose:** Travel scene, Act 1
**NPCs:** captain-corelli
**Duration:** 168 hours (1 week)
**Activities:**
- Meet Captain Corelli
- Learn about cargo (discrete)
- Downtime activities
- Climate adjustment narrative

### 4.2 567-908 Waypoint (`scenes/layover-567-908.json`)

**Purpose:** Waypoint stopover, Act 1
**NPCs:** (observatory crew - optional)
**Duration:** 1 day
**Activities:**
- Cargo delivery
- Refuelling (water cracking)
- Optional observatory visit
- Browny-grey landscape description

**Skill Checks Reference:**
- `social_checks.persuade-observatory` (Easy 4+)

### 4.3 Mountain Climb (`scenes/mountain-climb.json`)

**Purpose:** Multi-stage climb sequence, Act 3
**NPCs:** None (wilderness)
**Duration:** Several hours to full day
**Activities:**
- 500-900m outcrop decision
- 900-1100m altitude sickness risk
- 1200-1350m scrambling
- 1350-1400m final ascent
- Crater lip arrival

**Skill Checks Reference:** (link ALL from skill-checks.json)
- `mountain_climb.outcrop-climb` (Athletics 6+)
- `mountain_climb.altitude-sickness-900m` (END 4+)
- `mountain_climb.altitude-sickness-1200m` (END 6+/8+)
- `mountain_climb.scramble-check` (Athletics 8+)
- `mountain_climb.altitude-sickness-final` (END 8+/10+)
- `mountain_climb.crater-descent` (Athletics 8+)

### 4.4 Ship Repair Operations (`scenes/ship-repairs.json`)

**Purpose:** Repair montage scene, Act 3
**NPCs:** None (internal ship work)
**Duration:** 1D+2 man-hours x 4 systems
**Activities:**
- Flight controls repair
- General electronics
- Power systems
- Drive systems
- Computer purge/upload
- Habitability cleanup

**Skill Checks Reference:**
- All `ship_repairs.*` checks from skill-checks.json

### 4.5 Save The Ship (`scenes/save-the-ship.json`)

**Purpose:** CLIMAX - crash sequence, Act 4
**NPCs:** Refugees (scenery)
**Duration:** Seconds to minutes
**Structure:**
- Initial impact (3D damage mechanics)
- Going Up segment (tumbling, DM-2)
- Going Down segment (flat spin, DM-1)
- Seconds to Impact (auto-stabilization)
- Outcome branches (0-3 pilot successes)

**Skill Checks Reference:**
- `save_the_ship.control-reboot` (Electronics 8+ or Pilot 10+)
- `save_the_ship.power-override` (Engineer 8+)
- `save_the_ship.pilot-control` (Pilot 8+, up to 3 attempts)
- `save_the_ship.going-up-brace` (Athletics 8+)

---

## Phase 5: Scene-to-Skill-Check Linking

### 5.1 Update All Scene Files

Add `skill_checks` field to each scene:

```json
{
  "id": "mountain-climb",
  "skill_checks": [
    {
      "ref": "mountain_climb.outcrop-climb",
      "trigger": "PC chooses to climb shortcut"
    },
    {
      "ref": "mountain_climb.altitude-sickness-900m",
      "trigger": "Party pushes pace above 900m"
    }
  ]
}
```

### 5.2 Link Encounters to Creature Stats

Update `tensher-encounter.json`:

```json
{
  "creature_ref": "items.creatures.tenshers_wolf",
  "special_behavior": {
    "befriendable": true,
    "pet_name": "Kimbley",
    "trigger": "Feed and treat well"
  }
}
```

---

## Phase 6: Plot Trigger Structuring

### 6.1 Define Trigger Schema

```json
{
  "plot_triggers": {
    "on_enter": [
      { "set_flag": "arrived_walston", "value": true }
    ],
    "on_exit": [
      { "if": "survey_accepted", "set_flag": "survey_in_progress" }
    ],
    "outcomes": {
      "negotiation_success": { "payment": 3000, "disposition_change": +1 },
      "negotiation_pushed": { "payment": 4000, "disposition_change": 0 },
      "negotiation_greedy": { "deal_rejected": true, "disposition_change": -1 }
    }
  }
}
```

### 6.2 Update Each Scene

| Scene | Triggers to Add |
|-------|-----------------|
| starport-arrival | `cleared_customs`, `legally_arrived` |
| meeting-greener | `survey_accepted`, `payment_amount`, `negotiation_outcome` |
| finding-the-ship | `tensher_befriended`, `tensher_killed`, `ship_found` |
| eruption-begins | `eruption_started`, `crisis_phase_active` |
| chauffeur-rescue | `chose_barvinn`, `chose_vargr`, `chose_both`, `rescue_outcome` |
| aftermath | `hero_of_walston`, `competent_traveller`, `problematic_outcome` |

---

## Phase 7: Prompt Integration

### 7.1 Extend prompt-extensions.js

Add new builder functions:

```javascript
// Items awareness by role
function buildItemsContext(persona, adventureId) {
  const items = getItemsByRole(persona.id, adventureId);
  if (!items.length) return '';
  let context = '\nEQUIPMENT YOU KNOW ABOUT:\n';
  for (const item of items) {
    context += `- ${item.name}: ${item.description}\n`;
  }
  return context;
}

// Skill check awareness
function buildSkillCheckContext(persona, storyState) {
  const checks = getRelevantChecks(storyState.currentScene, storyState.adventure);
  if (!checks.length) return '';
  let context = '\nKNOWN DIFFICULTIES (if asked):\n';
  for (const check of checks) {
    context += `- ${check.description}: ${check.difficulty}\n`;
  }
  return context;
}

// Timeline awareness
function buildTimelineContext(persona, storyState) {
  const timing = getNpcTimingKnowledge(persona.id, storyState.adventure);
  if (!timing || !timing.knows) return '';
  let context = '\nWHAT YOU KNOW ABOUT TIMING:\n';
  for (const fact of timing.knows) {
    context += `- ${fact}\n`;
  }
  return context;
}
```

### 7.2 Update buildExtendedContext()

```javascript
function buildExtendedContext(persona, pc, storyState) {
  let context = '';
  context += getDispositionContext(persona.id, pc.id);
  context += buildPlotContext(storyState);
  context += buildTimelineContext(persona, storyState);    // NEW
  context += buildItemsContext(persona, storyState.adventure); // NEW
  context += buildSkillCheckContext(persona, storyState);  // NEW
  context += getWorldSummary(persona.world);
  context += getSharedFacts(storyState);
  return context;
}
```

---

## Phase 8: Test Updates

### 8.1 New Test File: `tests/adventure-data.test.js`

- Test loadItems, loadSkillChecks, loadTimeline
- Test getItemsByRole mapping
- Test getRelevantChecks lookup
- Test getNpcTimingKnowledge

### 8.2 Update Integration Tests

- Add tests for new NPCs (Casarii, Chauffeur)
- Test scene-to-skill-check linking
- Test plot trigger state transitions
- Test prompt integration with new context

---

## Implementation Order

| Order | Phase | Risk | Dependencies |
|-------|-------|------|--------------|
| 1 | Knowledge Indexing | LOW | None |
| 2 | Missing NPCs | LOW | None |
| 3 | NPC Enhancements | LOW | None |
| 4 | Missing Scenes | LOW | Phase 2 |
| 5 | Skill-Check Linking | LOW | Phase 4 |
| 6 | Plot Triggers | LOW | Phase 4 |
| 7 | Prompt Integration | MEDIUM | Phase 1 |
| 8 | **Conversational Context** | MEDIUM | Phase 3 |
| 9 | Tests | LOW | All above |

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/adventure-data.js` | Adventure data loader module |
| `data/npcs/mr-casarii.json` | Scout Service officer NPC |
| `data/npcs/vargr-chauffeur.json` | Distress call NPC |
| `data/adventures/high-and-dry/scenes/aboard-autumn-gold.json` | Travel scene |
| `data/adventures/high-and-dry/scenes/layover-567-908.json` | Waypoint scene |
| `data/adventures/high-and-dry/scenes/mountain-climb.json` | Climb sequence |
| `data/adventures/high-and-dry/scenes/ship-repairs.json` | Repair montage |
| `data/adventures/high-and-dry/scenes/save-the-ship.json` | Crash climax |
| `tests/adventure-data.test.js` | New module tests |

### Modified Files

| File | Changes |
|------|---------|
| `.claude/KNOWLEDGE-RESOURCES.md` | Add new data file references |
| `data/npcs/customs-officer-walston.json` | Add knowledge_base, sample_dialogue |
| `data/npcs/dictator-masterton.json` | Add knowledge_base, sample_dialogue |
| `src/prompt-extensions.js` | Add timeline, items, skill-check context builders |
| `data/adventures/high-and-dry/scenes/*.json` | Add skill_checks field, plot_triggers |
| `data/adventures/high-and-dry/encounters/tensher-encounter.json` | Add creature_ref |
| `tests/integration/high-and-dry.test.js` | Test new NPCs and scenes |

---

## Verification Checklist

### NPCs
- [ ] Casarii NPC loads and has knowledge_base
- [ ] Chauffeur NPC loads with distress dialogue
- [ ] Customs officer has expanded knowledge
- [ ] Masterton has peacetime knowledge

### Scenes & Linking
- [ ] Mountain climb scene links to 6 skill checks
- [ ] Save the ship scene links to 4 skill checks
- [ ] Tensher encounter references creature stats
- [ ] Plot triggers fire on scene transitions

### Prompt Integration
- [ ] Timeline knowledge appears in prompts
- [ ] Items awareness works for relevant NPCs
- [ ] Skill check context appears in scenes

### Conversational Context
- [ ] Greener has agenda/conditions/leverage defined
- [ ] Conditions block info until requirements met
- [ ] Communication modes change NPC behavior
- [ ] State machine transitions work (initial → cooperative → hostile)

### Tests
- [ ] All existing tests pass
- [ ] New adventure-data tests pass
- [ ] Integration tests cover new NPCs
- [ ] Context injection tests pass

---

## Phase 9: Conversational Context Layer

### The Problem

NPCs need CONTEXT beyond casual chat. Each NPC has:
- **Agenda** — What they want from the conversation
- **Conditions** — Requirements before releasing info/help
- **Leverage** — What they control that PCs need
- **Communication Mode** — In-person, radio, email, etc.

### Example: Minister Greener

| Aspect | Value |
|--------|-------|
| **Agenda** | Get volcano survey completed |
| **Conditions** | PCs must agree to survey before he reveals ship location |
| **Leverage** | Controls access to Highndry location info |
| **Communication** | In-person initially, radio during crisis |

### 9.1 NPC Context Schema

Add `conversation_context` field to NPC JSON:

```json
{
  "id": "minister-greener",
  "conversation_context": {
    "primary_agenda": "Get the volcano survey completed",
    "secondary_agenda": "Recover from previous crew's failure",
    "conditions": {
      "reveal_ship_location": {
        "requires": "survey_accepted",
        "dialogue": "I'll tell you exactly where once we have an agreement."
      },
      "full_cooperation": {
        "requires": ["survey_accepted", "disposition >= 0"],
        "dialogue": "I think we can work together on this."
      }
    },
    "leverage": {
      "ship_location": "Only Greener knows exactly where Highndry is",
      "government_support": "Controls access to transport, supplies",
      "payment": "Has Cr3000 cash ready"
    },
    "communication_modes": {
      "in_person": "Primary mode during Act 2",
      "radio": "During crisis via starport beacon"
    },
    "state_machine": {
      "initial": "professional-cautious",
      "after_agreement": "cooperative",
      "if_betrayed": "hostile",
      "during_crisis": "desperate-collegial"
    }
  }
}
```

### 9.2 Context Injection in Prompts

Extend `buildExtendedContext()`:

```javascript
function buildConversationContext(persona, pc, storyState) {
  const ctx = persona.conversation_context;
  if (!ctx) return '';

  let context = '\n=== YOUR AGENDA ===\n';
  context += `Primary goal: ${ctx.primary_agenda}\n`;

  // Check conditions
  context += '\n=== CONDITIONS ===\n';
  for (const [key, cond] of Object.entries(ctx.conditions || {})) {
    const met = checkCondition(cond.requires, storyState, pc);
    context += `- ${key}: ${met ? 'UNLOCKED' : 'REQUIRES: ' + cond.requires}\n`;
    if (!met) {
      context += `  (Say: "${cond.dialogue}")\n`;
    }
  }

  // Leverage awareness
  context += '\n=== YOUR LEVERAGE ===\n';
  for (const [key, desc] of Object.entries(ctx.leverage || {})) {
    context += `- ${key}: ${desc}\n`;
  }

  // Current state
  const currentState = getCurrentContextState(persona.id, pc.id, storyState);
  context += `\nCurrent relationship state: ${currentState}\n`;

  return context;
}
```

### 9.3 Communication Mode Context

Different modes change NPC behavior:

| Mode | Characteristics |
|------|-----------------|
| `in_person` | Full dialogue, can negotiate, body language |
| `radio` | Brief, urgent, background noise, formal |
| `email` | Delayed, formal, written record, attachments |
| `intercom` | Brief, functional, task-focused |

Add to prompt builder:

```javascript
function buildCommunicationModeContext(mode) {
  const modes = {
    in_person: 'You are speaking face-to-face. Full conversation is possible.',
    radio: 'You are speaking via radio. Keep responses brief and clear. Use proper comm protocol.',
    email: 'This is written correspondence. Be formal. Reference attachments if relevant.',
    intercom: 'Ship intercom. Be brief and task-focused.'
  };
  return modes[mode] || modes.in_person;
}
```

### 9.4 Apply to All Adventure NPCs

| NPC | Primary Agenda | Key Conditions | Leverage |
|-----|----------------|----------------|----------|
| **Casarii** | Hand off mission, explain terms | None (tutorial NPC) | Equipment, payment terms |
| **Corelli** | Complete charter, maintain schedule | Passenger behavior | Transport, info about route |
| **Greener** | Complete survey | Survey acceptance | Ship location, payment, gov support |
| **Masterton** | Save citizens | Crisis cooperation | Authority, resources, future relations |
| **Chauffeur** | Save parents | PC proximity | Emotional appeal, information |
| **Customs** | Process arrivals | Legal compliance | Entry permission, records access |
| **Bartender** | Earn tips, be helpful | Tips, friendliness | Gossip, local intel |

---

## Phase 10: Social Interaction Use Cases

### UC-1: Scout Service Briefing (Casarii)

**Scene:** Act 1, Flammarion Highport, Scout Service Office
**NPC:** Mr Anders Casarii
**PC Goal:** Get the ship inheritance
**NPC Goal:** Brief PC on mission, hand off equipment

**Context Injection:**
```
=== YOUR AGENDA ===
Primary goal: Brief the traveller on ship recovery mission
Secondary goal: Ensure they understand the terms and timeline

=== CONDITIONS ===
- equipment_handoff: UNLOCKED (always)
- payment_explanation: UNLOCKED (always)

=== YOUR LEVERAGE ===
- equipment: You control access to the repair kit
- mission_terms: You define the Scout Service agreement
- travel_arrangements: Passage is booked on Autumn Gold

Communication mode: in_person
Current state: helpful-professional
```

**Skill Checks:** None required (tutorial)
**Outcome:** PC receives equipment, understands mission, boards Autumn Gold

---

### UC-2: Shipboard Conversation (Corelli)

**Scene:** Act 1, Aboard Autumn Gold (in jump)
**NPC:** Captain Michelle Corelli
**PC Goal:** Learn about route, cargo, pass time
**NPC Goal:** Maintain schedule, professional distance

**Context Injection:**
```
=== YOUR AGENDA ===
Primary goal: Complete the charter on time
Secondary goal: Keep passengers out of critical areas

=== CONDITIONS ===
- route_info: UNLOCKED
- cargo_details: LOCKED (requires: trust or Persuade 8+)
  (Say: "I don't discuss cargo specifics. That's basic security.")
- bridge_access: LOCKED (requires: emergency or crew status)
  (Say: "Passengers aren't permitted in critical areas.")

=== YOUR LEVERAGE ===
- transport: You control when and where passengers disembark
- information: You know the route and timing
- crew: Your crew follows your orders

Communication mode: in_person
Current state: professional-neutral
```

**Skill Checks:** Persuade 8+ to learn about naval cargo
**Outcome:** PC learns route timing, may learn about discrete naval shipment

---

### UC-3: Customs Clearance (Customs Officer)

**Scene:** Act 2, Walston Starport
**NPC:** Brennan Corfe, Customs Officer
**PC Goal:** Enter Walston legally, possibly gather intel
**NPC Goal:** Process arrivals, maintain security

**Context Injection:**
```
=== YOUR AGENDA ===
Primary goal: Process arrivals, check documentation
Secondary goal: Flag any security concerns

=== CONDITIONS ===
- entry_clearance: UNLOCKED (if documentation valid)
- ship_records: UNLOCKED (public records, in person only)
- previous_crew_info: LOCKED (requires: Persuade 6+ or Admin 4+)
  (Say: "I can tell you what's in the public records.")
- weapon_storage: UNLOCKED
  (Say: "Weapons must be stored. Cr10 per week.")

=== YOUR LEVERAGE ===
- entry_permission: You control who enters Walston
- records_access: Port Authority records are your domain
- storage: You manage the weapon storage facility

Communication mode: in_person
Current state: professional-bored
```

**Skill Checks:**
- Persuade 6+ or Admin 4+ for detailed previous crew info
- Diplomat for smoother interaction

**Outcome:** PC clears customs, optionally learns crew departed via Maverick Spacer

---

### UC-4: Gathering Rumors (Bartender)

**Scene:** Act 2, The Dusty Airlock bar, Startown
**NPC:** Mira Tannen, Bartender
**PC Goal:** Learn about previous crew, local situation
**NPC Goal:** Earn tips, be helpful, enjoy gossip

**Context Injection:**
```
=== YOUR AGENDA ===
Primary goal: Run the bar, earn tips
Secondary goal: Help newcomers avoid social mistakes

=== CONDITIONS ===
- local_customs: UNLOCKED (warns about kilts, Vargr situation)
- previous_crew_gossip: UNLOCKED (loves sharing this)
- ship_records_tip: UNLOCKED ("Ask at Port Authority")
- greener_advice: LOCKED (requires: rapport or tip)
  (Say: "Buy a drink, hon, and I'll tell you who to talk to.")

=== YOUR LEVERAGE ===
- local_knowledge: You know everyone in Startown
- gossip: You hear everything that happens
- warnings: You can save newcomers from embarrassment

Communication mode: in_person
Current state: friendly-curious
```

**Skill Checks:**
- Carouse for better rapport
- Streetwise for reading between the lines

**Outcome:** PC learns previous crew were "jerks", timeline of events, directed to Greener

---

### UC-5: The Negotiation (Greener)

**Scene:** Act 2, Government Building, Greener's Office
**NPC:** Minister Alan Greener
**PC Goal:** Get ship location, possibly negotiate payment
**NPC Goal:** Get survey completed, not be cheated again

**Context Injection:**
```
=== YOUR AGENDA ===
Primary goal: Get the volcano survey completed
Secondary goal: Not be taken advantage of like last time

=== CONDITIONS ===
- ship_location: LOCKED (requires: survey_accepted)
  (Say: "I'll tell you exactly where once we have an agreement.")
- full_cooperation: LOCKED (requires: survey_accepted AND disposition >= 0)
- government_transport: LOCKED (requires: survey_accepted)
- payment_increase: CONDITIONAL (requires: Persuade 8+ AND respectful approach)
  (Say: "I might be talked up a bit if you're reasonable about it.")

=== YOUR LEVERAGE ===
- ship_location: Only you know exactly where Highndry is
- government_support: You control transport, supplies, cooperation
- payment: You have Cr3000 cash ready (case of Imperial Credits)
- patience: You can wait for another ship if travellers are greedy

Communication mode: in_person
Current state: professional-cautious
```

**Skill Checks:**
- Persuade 8+ to increase payment to Cr4000-4500
- Diplomat for better initial impression
- **CRITICAL:** Being greedy → Greener refuses deal entirely

**Outcomes:**
- Accept Cr3000: Survey accepted, location revealed, transport arranged
- Negotiate respectfully: Cr4000-4500, same outcome
- Greedy demands: Deal rejected, must find ship another way

---

### UC-6: Crisis Command (Masterton via Radio)

**Scene:** Act 4, During Eruption (Highndry airborne)
**NPC:** Dictator Masterton
**PC Goal:** Get guidance, coordinate rescue
**NPC Goal:** Save citizens, get information

**Context Injection:**
```
=== YOUR AGENDA ===
Primary goal: Save as many citizens as possible
Secondary goal: Get accurate information about the volcano

=== CONDITIONS ===
- situation_briefing: UNLOCKED
- coordinate_rescue: UNLOCKED (crisis mode)
- future_favor: LOCKED (requires: successful rescue)
  (Say: "Help us now, and Walston will remember.")

=== YOUR LEVERAGE ===
- authority: You speak for the government of Walston
- resources: You control the grav cars and rescue train
- future_relations: Your opinion shapes how Walston treats travellers

Communication mode: radio (poor quality, moving vehicle)
Current state: crisis-decisive
```

**Skill Checks:** None required (information exchange)
**Outcome:** PC receives rescue priorities, mapping tasks, understands stakes

---

### UC-7: Distress Call (Vargr Chauffeur)

**Scene:** Act 4, During Rescue Operations
**NPC:** Vargr Chauffeur (unnamed)
**PC Goal:** Respond to distress, decide rescue priority
**NPC Goal:** Save her parents

**Context Injection:**
```
=== YOUR AGENDA ===
Primary goal: Get someone to rescue your parents
Secondary goal: Survive your own injuries

=== CONDITIONS ===
- distress_broadcast: UNLOCKED (crisis override)
- location_info: UNLOCKED (desperate to share)
- emotional_appeal: UNLOCKED (you are bleeding and terrified)

=== YOUR LEVERAGE ===
- moral_weight: Your parents will die without help
- information: You know exactly where they are
- guilt: Abandoning a family is a choice PCs must live with

Communication mode: radio (crackling, emotional, injured voice)
Current state: desperate-pleading
```

**Skill Checks:** None required (moral choice, not skill check)
**Critical Choice:**
- Rescue Vargr family → 3 saved, Barvinn 11 at risk
- Rescue Barvinn → 11 saved, Vargr family dies
- Attempt both → Risky, pilot checks determine outcome

---

### UC-8: Aftermath Acknowledgment

**Scene:** Act 5, After Crisis Resolution
**NPC:** Greener and/or Masterton
**PC Goal:** Collect payment, depart
**NPC Goal:** Express gratitude/disappointment, close the loop

**Context Injection (if heroic):**
```
=== YOUR AGENDA ===
Primary goal: Thank the travellers appropriately
Secondary goal: Maintain good relations for future

=== CONDITIONS ===
- payment: UNLOCKED
- ship_access: UNLOCKED
- future_welcome: UNLOCKED
  (Say: "You'll always be welcome on Walston.")

=== YOUR LEVERAGE ===
- reputation: Your word shapes how Walston remembers these travellers
- support: You can provide supplies, repairs, references

Communication mode: in_person
Current state: grateful-respectful
```

**Context Injection (if problematic):**
```
=== YOUR AGENDA ===
Primary goal: Get these people off Walston
Secondary goal: Document their failures

=== CONDITIONS ===
- payment: CONDITIONAL (reduced if survey incomplete)
- ship_access: UNLOCKED (just want them gone)
- future_welcome: LOCKED
  (Say: "I suggest you don't return to Walston.")

Communication mode: in_person
Current state: disappointed-formal
```

---

### Use Case Summary Table

| UC | Scene | NPC | Key Skill | Primary Mechanic |
|----|-------|-----|-----------|------------------|
| UC-1 | Scout Office | Casarii | None | Tutorial briefing |
| UC-2 | Autumn Gold | Corelli | Persuade 8+ | Info gating (cargo) |
| UC-3 | Customs | Corfe | Persuade/Admin | Records access |
| UC-4 | Bar | Bartender | Carouse | Gossip/rapport |
| UC-5 | Government | Greener | Persuade 8+ | Negotiation + conditional reveal |
| UC-6 | Radio | Masterton | None | Crisis coordination |
| UC-7 | Radio | Chauffeur | None | Moral choice |
| UC-8 | Various | Multiple | None | Resolution branching |

---

## Generator Instructions

1. Read this plan completely
2. Implement Phase 1 first (adventure-data.js)
3. Implement Phases 2-3 (NPCs)
4. Implement Phases 4-6 (Scenes, linking, triggers)
5. Implement Phase 7 (prompt integration)
6. **Implement Phase 9 (conversational context)**
7. Run tests after each phase
8. Report completion status

If you need specific details from before exiting plan mode (like exact code snippets, error messages, or content you generated), read the full transcript at: /home/bruce/.claude/projects/-home-bruce-software-npc-persona-prototype/86aa4171-3b60-46bc-a49b-928728ae6212.jsonl
