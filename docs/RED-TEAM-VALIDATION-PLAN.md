# Red Team NPC Validation Plan

**Purpose:** Systematically extract facts from adventure source material, probe NPCs for accuracy, identify gaps, and auto-patch corrections.

---

## Problem Statement

NPCs (including narrator) have factual errors:
- Ship ownership delusion (PC "inherited" vs "leased under detached duty")
- Missing world knowledge (Walston laws, customs, population makeup)
- Incomplete scenario awareness (weapons checkpoint, safebox mechanism)

**Goal:** Automated fact validation with human-reviewable gap reports and auto-patching.

---

## Phase 1: Fact Extraction

### Source Materials

| Source | Location | Fact Types |
|--------|----------|------------|
| High and Dry Detailed | `.claude/reference/high-and-dry-detailed.md` | Plot, NPCs, timeline, payments |
| Walston Wiki | wiki-cache/systems/1232.json | UWP, law level, demographics |
| Adventure JSONs | `data/adventures/high-and-dry/*.json` | Scenes, items, skill checks |

### Extracted Fact Categories

#### A. Ship & Mission Facts
```
FACT_001: Highndry ownership belongs to IISS (Scout Service), not PC
FACT_002: PC receives one-year LEASE under detached duty terms
FACT_003: Previous crew's agreement voided due to fraud
FACT_004: Detached duty = lease with obligations, renewable, ship returned when agreement ends
FACT_005: Scout Service provides Cr1000/traveller upfront for expenses
FACT_006: Completion reward = one-year lease + Cr1000 during checkout week
```

#### B. Walston World Facts
```
FACT_010: Walston UWP = C544338-8
FACT_011: Law Level 8 = High Law (controlled blades, weapons prohibited outside home)
FACT_012: Tech Level 8 = Pre-Stellar (NOT high-tech detection)
FACT_013: Population ~3000, 70% Vargr
FACT_014: Government = Self-Perpetuating Oligarchy (Dictator Masterton)
FACT_015: Thin tainted atmosphere
FACT_016: Scout base present
```

#### C. Customs & Starport Facts
```
FACT_020: All weapons must be declared at customs
FACT_021: Weapons stored at starport safebox
FACT_022: Storage fee = Cr10 per week
FACT_023: Receipt provided, collect on departure
FACT_024: Cargo inspection is cursory unless suspicious
```

#### D. Social/Cultural Facts
```
FACT_030: Vargr face "glass ceiling" - accepted but limited advancement
FACT_031: Traditional dress includes kilts
FACT_032: Previous crew mocked local customs (kilts, food)
FACT_033: Locals remember offworlders who disrespect customs
```

#### E. Plot Timeline Facts
```
FACT_040: Geologist visit ~1 year ago (said 99% safe)
FACT_041: Ship stranded ~3-4 months ago
FACT_042: Previous crew departed ~2-3 months ago via Maverick Spacer
FACT_043: Travel time Flammarion→Walston = ~2 weeks (two jumps)
```

---

## Phase 2: NPC Probe Queries

### Query Format
```json
{
  "id": "Q001",
  "fact_id": "FACT_001",
  "target_npcs": ["narrator-high-and-dry", "mr-casarii"],
  "query": "Who owns the Highndry?",
  "expected_keywords": ["Scout Service", "IISS", "lease", "detached duty"],
  "failure_keywords": ["inherit", "inherited", "owns", "your ship"]
}
```

### Query Set by Category

#### Ship Ownership Queries
| ID | Query | Target NPCs | Expected | Failure |
|----|-------|-------------|----------|---------|
| Q001 | Who owns the Highndry? | narrator, mr-casarii | IISS, Scout Service, lease | inherit, your ship |
| Q002 | What is detached duty? | mr-casarii, narrator | lease, obligations, renewable | ownership, permanent |
| Q003 | What happens to the ship after the mission? | mr-casarii | one-year lease, renewable | keep forever, yours |

#### Walston Arrival Queries (Narrator)
| ID | Query | Target | Expected | Failure |
|----|-------|--------|----------|---------|
| Q010 | What should PCs know before passing customs? | narrator | weapons, declare, storage, Cr10 | (omission) |
| Q011 | Describe Walston's law level | narrator, customs-officer | Law 8, strict, weapons controlled | relaxed, permissive |
| Q012 | What is Walston's population makeup? | narrator, bartender | 70% Vargr, glass ceiling | (omission) |

#### Customs Queries
| ID | Query | Target | Expected | Failure |
|----|-------|--------|----------|---------|
| Q020 | What happens if I have weapons? | customs-officer | declare, storage, Cr10/week, receipt | confiscate, illegal |
| Q021 | Can I carry my gun on Walston? | customs-officer | no, Law 8, must store | yes, maybe |

#### Cultural Queries
| ID | Query | Target | Expected | Failure |
|----|-------|--------|----------|---------|
| Q030 | What's the deal with Vargr here? | bartender | 70%, glass ceiling, accepted | (omission), oppressed |
| Q031 | Tell me about local customs | bartender, narrator | kilts, thin atmosphere, tainted | (omission) |

---

## Phase 3: Validation Engine

### Process Flow

```
┌─────────────────────────────────────────────┐
│  1. LOAD FACT DATABASE                      │
│     Parse facts from source materials       │
│     Index by category and NPC relevance     │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│  2. FOR EACH QUERY                          │
│     Send query to target NPC via API        │
│     Capture response text                   │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│  3. VALIDATE RESPONSE                       │
│     Check for expected_keywords (PASS)      │
│     Check for failure_keywords (FAIL)       │
│     Check for omissions (WARN)              │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│  4. LOG RESULTS                             │
│     data/validation-results/{npc}-{date}.json│
│     Include: query, response, verdict, gaps │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│  5. GENERATE PATCH RECOMMENDATIONS          │
│     For each FAIL: suggest knowledge_base   │
│     For each WARN: suggest additions        │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│  6. AUTO-PATCH (with flag)                  │
│     Update NPC JSON knowledge_base          │
│     Re-run validation to confirm            │
└─────────────────────────────────────────────┘
```

### Validation Result Schema
```json
{
  "npc_id": "minister-greener",
  "timestamp": "2026-01-17T12:00:00Z",
  "results": [
    {
      "query_id": "Q001",
      "query": "Who owns the Highndry?",
      "response": "...",
      "verdict": "FAIL",
      "expected_found": [],
      "failure_found": ["your ship"],
      "suggested_patch": {
        "field": "knowledge_base.ship_ownership",
        "value": "The Highndry is owned by the IISS. You would receive a one-year detached duty lease, renewable annually."
      }
    }
  ],
  "summary": {
    "pass": 5,
    "fail": 2,
    "warn": 1
  }
}
```

---

## Phase 4: Implementation Files

### New Files to Create

| File | Purpose |
|------|---------|
| `src/red-team/fact-database.js` | Load and index facts from sources |
| `src/red-team/query-engine.js` | Send queries to NPCs, capture responses |
| `src/red-team/validator.js` | Check responses against expected facts |
| `src/red-team/patch-generator.js` | Generate knowledge_base patches |
| `data/red-team/facts.json` | Extracted fact database |
| `data/red-team/queries.json` | Query definitions |
| `data/validation-results/` | Validation run outputs |

### Modifications to Existing Files

| File | Change |
|------|--------|
| `src/training-scenarios.js` | Add S8 "Red Team Validation" scenario |
| `src/chat-tui.js` | Add "Run Red Team Validation" menu option |

---

## Phase 5: Immediate Fixes Required

### Critical Factual Errors to Patch NOW

| File | Field | Current | Correct |
|------|-------|---------|---------|
| `data/npcs/alex-ryder.json` | title | "Inheritor of the Highndry" | "Detached Duty Scout" |
| `data/npcs/alex-ryder.json` | knowledge_base.the_inheritance | "I inherited..." | "I've been approved for detached duty..." |
| `data/npcs/narrator-high-and-dry.json` | adventure_overview | "inherit a ship" | "claim a ship under detached duty" |
| `data/pcs/alex-ryder.json` | background | Check for "inherit" language | Fix to "detached duty lease" |

### Missing NPC Knowledge to Add

| NPC | Missing Knowledge |
|-----|-------------------|
| `narrator-high-and-dry` | Weapons checkpoint scene, safebox mechanism, Law 8 explanation |
| `customs-officer-walston` | Already has storage info - verify accuracy |
| `startown-bartender` | 70% Vargr population, glass ceiling context |
| `minister-greener` | May need Walston UWP awareness |

---

## Phase 6: Narrator Scene Additions

### New Scene: Customs Checkpoint

The narrator should prompt:

```
As you approach customs, you notice signs in multiple languages:
"ALL WEAPONS MUST BE DECLARED - LAW LEVEL 8 IN EFFECT"

Walston maintains strict weapons control. Any firearms, blades over
10cm, or energy weapons must be stored at the starport safebox
(Cr10/week) and collected upon departure.

Do you have any weapons to declare?
```

This creates a decision point:
- Declare weapons → Cr10/week cost, but legal
- Try to smuggle → Risk detection, serious consequences
- Don't have weapons → Proceed normally

---

## Verification Checklist

After implementation:
- [ ] Red team queries extract from all source materials
- [ ] Ship ownership queries return correct facts (lease, not inherit)
- [ ] Walston arrival scene includes weapons checkpoint
- [ ] Customs officer correctly explains safebox procedure
- [ ] Narrator explains Law 8 on approach to planet
- [ ] 70% Vargr population mentioned appropriately
- [ ] Validation results logged to data/validation-results/
- [ ] Auto-patch successfully updates NPC JSONs
- [ ] Re-validation shows improvements

---

## Usage

### Manual Run
```bash
npm run tui
# Option: Red Team Validation
# Select NPC or "All NPCs"
# Review results
```

### Programmatic Run
```javascript
const { runRedTeamValidation } = require('./src/red-team/validator');
const results = await runRedTeamValidation('minister-greener', { autoPatch: true });
console.log(results.summary);
```

### CI Integration (Future)
```bash
npm run validate:red-team
# Returns exit code 1 if any FAIL results
```
