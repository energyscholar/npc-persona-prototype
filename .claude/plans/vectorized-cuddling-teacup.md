# Meta-Plan: All Plans Implementation Roadmap

**Status:** READY FOR APPROVAL
**Date:** 2026-01-18
**Scope:** 36 plans analyzed, 26 viable, 5 deferred, 1 complete

---

## 5-LINE SUMMARY

1. **26 plans viable** across 4 tiers: Foundation → Core Systems → Content → TUI
2. **5 plans deferred** (equipment extraction) - 988 items already sufficient
3. **Sequential execution** with state verification; easy regressions fixed inline, hard ones logged
4. **Start with agm-orchestration** (Tier 0) - unlocks all downstream NPC work
5. **Suggestion:** Begin Sprint 1 (agm-orchestration), then reassess scope after seeing velocity

---

## Executive Summary

| Category | Count | Status |
|----------|-------|--------|
| Complete | 1 | tuesday-npc-contexts (70/70 tests) |
| Tier 0: Foundation | 1 | agm-orchestration |
| Tier 1: Core Systems | 4 | npc-knowledge, gap-features, red-team, knowledge-extraction |
| Tier 2: High-and-Dry | 14 | Scene/NPC content work |
| Tier 3: Features/TUI | 7 | Inventory, email, menu, testing |
| Deferred | 5 | Equipment extraction (988 items sufficient) |
| Obsolete/Absorbed | 4 | Merged into other plans |

**Total work:** ~26 plans across 4 tiers

---

## Role Verification (CRITICAL)

**Before ANY action, use AskUserQuestion:**

```javascript
AskUserQuestion({
  questions: [{
    question: "What is my role for this task?",
    header: "Role",
    options: [
      { label: "Auditor", description: "Review plan, refine tests, provide Generator handoff" },
      { label: "Generator", description: "Read plan, implement code, run tests until pass" }
    ],
    multiSelect: false
  }]
})
```

---

## Dependency Graph

```
TIER 0: FOUNDATION
└── agm-orchestration-audit
    Creates: agm-state.js, agm-npc-bridge.js
    Enables: All downstream NPC orchestration

TIER 1: CORE SYSTEMS (after Tier 0)
├── npc-knowledge-and-context (Phase 0 - bug fix + world knowledge)
├── gap-features-implementation (Phases 1-8, absorbs goal-driven-npcs)
├── red-team-learning-loop
└── knowledge-extraction-audit (Phases 1-4)

TIER 2: HIGH-AND-DRY CONTENT (after Tier 1)
├── CRITICAL: anders-knowledge-fix-audit (prevents plot spoilers)
├── scene-ordering-audit → act2-scene-order-audit
├── hierarchical-scenes-audit → narrative-elements-audit
├── settlement-island-geography-audit
├── world-knowledge-integration-audit
├── species-system-audit
├── narrator-improvisation-audit → emergent-npc-generator-audit
├── narrator-npc-voice-mixing-audit
├── scene-opening-flow-audit (shares adventure-player.js with agm-orchestration)
├── anders-crew-location-fix
└── high-and-dry-improvements (may be superseded by above)

TIER 3: FEATURES/TUI (parallel with Tier 2)
├── inventory-and-porter-audit → inventory-storage-system
├── email-system-audit → scene-email-triggers-audit
├── menu-cleanup-audit
├── tui-improvements
└── e2e-adventure-testing (LAST - validates everything)

DEFERRED:
├── central-supply-extraction.md (equipment sufficient)
├── equipment-extraction-audit.md (equipment sufficient)
├── csc-extraction-v2.md (equipment sufficient)
├── vectorized-cuddling-teacup.md (depends on extraction)
└── adventure-play-mode.md (DRAFT - scope unclear)
```

---

## TIER 0: FOUNDATION

### agm-orchestration-audit.md

**Scope:** Large (20 tests, 2 new modules, 2 modifications)
**Risk:** Medium - modifies prompts.js and adventure-player.js

**Creates:**
- `src/agm-state.js` - Central AGM state manager
- `src/agm-npc-bridge.js` - NPC context injection bridge
- 3 test files (20 tests total)

**Modifies:**
- `src/prompts.js` - Add agmContext parameter
- `src/adventure-player.js` - Initialize AGM state, inject context

**Red-Team Analysis (3 iterations):**

| Iteration | Risk Identified | Mitigation |
|-----------|-----------------|------------|
| 1 | prompts.js change could break existing NPC calls | Backward-compatible: agmContext is optional parameter with default null |
| 2 | adventure-player.js has merge conflicts with scene-opening-flow | Execute agm-orchestration FIRST, scene-opening-flow second |
| 3 | No rollback plan if AGM breaks dialogue | Add feature flag `AGM_ENABLED` to bypass if needed |

**Refined Plan:**
1. Create agm-state.js (standalone, no risk)
2. Create agm-npc-bridge.js (standalone, no risk)
3. Create all 3 test files
4. Run tests - expect partial failure (modules not integrated)
5. Modify prompts.js with backward-compatible change
6. Modify adventure-player.js
7. Run tests - all should pass
8. Manual smoke test in TUI

**Estimated effort:** 1 Generator session

---

## TIER 1: CORE SYSTEMS

### 1.1 npc-knowledge-and-context.md

**Scope:** Medium (5 phases, bug fix + enhancements)
**Risk:** Low - mostly new files + 1-line bug fix
**Prerequisite for:** gap-features (provides storyState to prompts)

**Key deliverables:**
- Fix storyState pass-through bug in TUI
- World knowledge injection (UWP parsing)
- Beat summaries and timeline context
- PC identity propagation

**Red-Team (3 iterations):**

| Iteration | Risk | Mitigation |
|-----------|------|------------|
| 1 | World knowledge injection could bloat prompts | Cap at 500 tokens, priority filtering |
| 2 | UWP parsing edge cases | Use existing wiki-cache format, validate |
| 3 | Beat summaries could spoil plot | Filter by NPC.plotAwareness.scope |

### 1.2 gap-features-implementation.md (MERGED)

**Scope:** Large (8 phases)
**Risk:** Low (Phases 1-7), Low+ (Phase 8)
**Absorbs:** goal-driven-npcs-audit.md

**Phases:**
1. Disposition tracking - NEW FILE
2. Plot context builder - NEW FILE
3. Skill checks - NEW FILE
4. Info gating - NEW FILE
5. Triggers - NEW FILE
6. World state - NEW FILE
7. Integration layer - NEW FILE
8. Core integration - 3-line prompts.js change

**Red-Team (3 iterations):**

| Iteration | Risk | Mitigation |
|-----------|------|------------|
| 1 | 8 phases too large for single session | STOP POINT after Phase 7 for audit |
| 2 | Disposition changes not persisted | Repository pattern with JSON files |
| 3 | Phase 8 breaks prompts | Rollback: remove 3 lines, modules remain |

**Merge with goal-driven-npcs:**
- goal-driven-npcs adds `goals[]` to 4 NPCs
- gap-features Phase 1 disposition + Phase 7 integration supports goals
- Execute goal-driven-npcs as Phase 1.1 WITHIN gap-features

### 1.3 red-team-learning-loop.md

**Scope:** Medium
**Risk:** Low - extends existing learner
**Dependencies:** knowledge-extraction phases

**Red-Team (3 iterations):**

| Iteration | Risk | Mitigation |
|-----------|------|------------|
| 1 | LLM-generated patches could be wrong | Verify step before apply, rollback if tests fail |
| 2 | Audit log grows unbounded | Rotate logs, cap at 1000 entries |
| 3 | Learning loop infinite on unfixable issue | Max 3 attempts per failure, then escalate to human |

### 1.4 knowledge-extraction-audit.md (Phases 1-4)

**Scope:** Medium (4 sequential phases)
**Risk:** Low - new files only

**Phases:**
1. Scene fact extraction
2. Query generator from facts
3. Context injector
4. Learning loop bridge

**Red-Team (3 iterations):**

| Iteration | Risk | Mitigation |
|-----------|------|------------|
| 1 | Extracted facts may be wrong | Validation queries catch errors |
| 2 | Query generator produces bad queries | Template system with manual review |
| 3 | Context injection slows response | Cache extracted facts, lazy load |

---

## TIER 2: HIGH-AND-DRY CONTENT

### 2.0 anders-knowledge-fix-audit.md (CRITICAL - DO FIRST)

**Scope:** Small but CRITICAL
**Risk:** HIGH if not done - Anders reveals plot spoilers

**Deliverables:**
- Remove Mount Salbarii / volcano location from Anders' knowledge
- Add `knowledge_limits` field
- Create boundary test queries

**Red-Team:**
- Risk: Other NPCs may also have spoiler knowledge
- Mitigation: Audit all NPC knowledge fields in Tier 2

### 2.1-2.14 Scene/NPC Content Plans

| Plan | Scope | Dependencies | Can Parallelize? |
|------|-------|--------------|------------------|
| scene-ordering-audit | Large | None | No - foundational |
| act2-scene-order-audit | Small | scene-ordering | Yes with others |
| hierarchical-scenes-audit | Medium | scene-ordering | Yes |
| narrative-elements-audit | Medium | hierarchical-scenes | No |
| settlement-island-geography | Large | None | Yes |
| world-knowledge-integration | Medium | None | Yes |
| species-system-audit | Medium | None | Yes |
| narrator-improvisation-audit | Large | None | No - has dependent |
| emergent-npc-generator | Small | narrator-improvisation | No |
| narrator-npc-voice-mixing | Medium | agm-orchestration | Yes |
| scene-opening-flow-audit | Small | agm-orchestration | Yes (after agm) |
| anders-crew-location-fix | Small | None | Yes |
| high-and-dry-improvements | Large | All above | Last - may be superseded |

**Parallelization Strategy:**
- Group A (sequential): scene-ordering → act2 → hierarchical → narrative-elements
- Group B (sequential): narrator-improvisation → emergent-npc-generator
- Group C (parallel): settlement-geography, world-knowledge, species-system
- Group D (after Tier 0): voice-mixing, scene-opening-flow

**Red-Team (Tier 2 overall):**

| Iteration | Risk | Mitigation |
|-----------|------|------------|
| 1 | Scene ordering changes break existing saves | Migration script for save files |
| 2 | Too many scene changes at once | Stage releases, test each group |
| 3 | high-and-dry-improvements may conflict | Review after other plans, likely superseded |

---

## TIER 3: FEATURES/TUI

### 3.1 inventory-and-porter-audit.md

**Scope:** Medium
**Risk:** Low - new files + NPCs

**Can run parallel with Tier 1** - no dependencies on AGM/gap-features

**Deliverables:**
- PC inventory system
- Vargr porter NPC (Gvoudzon)
- Hotel scene + doorman NPC

### 3.2 inventory-storage-system.md

**Scope:** Medium
**Depends on:** inventory-and-porter

**Deliverables:**
- Item storage at locations (customs, etc.)
- Legal/illegal tracking by law level
- Retrieval mechanics

### 3.3 email-system-audit.md

**Scope:** Medium
**Risk:** Low

**Deliverables:**
- NPC email delivery system
- Main menu "Check Email" option
- Email templates

### 3.4 scene-email-triggers-audit.md

**Scope:** Medium
**Depends on:** email-system

**Deliverables:**
- Scene completion triggers emails
- UI notification for new mail

### 3.5 menu-cleanup-audit.md

**Scope:** Small
**Risk:** Low

**Deliverables:**
- Remove training/red-team/quick-chat options
- Streamline main menu

### 3.6 tui-improvements.md

**Scope:** Small (DRAFT)
**Risk:** Low

**Deliverables:**
- Extract config colors
- /status command
- Action notifications
- /actions command

### 3.7 e2e-adventure-testing.md

**Scope:** Large
**Risk:** Low
**Execute LAST** - validates everything

**Deliverables:**
- Automated walkthrough scripts
- Debug overlay
- Golden path verification

**Red-Team (Tier 3 overall):**

| Iteration | Risk | Mitigation |
|-----------|------|------------|
| 1 | Inventory/email could conflict with adventure flow | Test integration points early |
| 2 | Menu changes break muscle memory | Document changes, announce |
| 3 | E2E tests flaky due to LLM variance | Use deterministic mocks for CI |

---

## DEFERRED PLANS

| Plan | Reason | Revisit When |
|------|--------|--------------|
| central-supply-extraction | 988 items sufficient | Need specific missing items |
| equipment-extraction-audit | 988 items sufficient | Need specific missing items |
| csc-extraction-v2 | 988 items sufficient | Need specific missing items |
| vectorized-cuddling-teacup | Depends on extraction | After extraction if needed |
| adventure-play-mode | DRAFT, scope unclear | After Tier 1-2 stable |

---

## ABSORBED/OBSOLETE PLANS

| Plan | Status | Absorbed Into |
|------|--------|---------------|
| goal-driven-npcs-audit | ABSORBED | gap-features Phase 1.1 |
| high-and-dry-improvements | LIKELY SUPERSEDED | Tier 2 plans cover same scope |

---

## EXECUTION ROADMAP

### Sprint 1: Foundation
1. agm-orchestration-audit (1 session)

### Sprint 2: Core Systems (parallel tracks)
Track A:
1. npc-knowledge-and-context
2. gap-features Phases 1-7
3. AUDIT STOP
4. gap-features Phase 8

Track B (parallel):
1. inventory-and-porter-audit
2. inventory-storage-system

Track C (parallel):
1. knowledge-extraction Phases 1-4
2. red-team-learning-loop

### Sprint 3: Content & Features (parallel tracks)
Track A (sequential):
1. anders-knowledge-fix-audit (CRITICAL FIRST)
2. scene-ordering-audit
3. act2-scene-order-audit
4. hierarchical-scenes-audit
5. narrative-elements-audit

Track B (parallel):
1. settlement-island-geography
2. world-knowledge-integration
3. species-system-audit

Track C (sequential):
1. narrator-improvisation-audit
2. emergent-npc-generator

Track D (parallel):
1. narrator-npc-voice-mixing
2. scene-opening-flow-audit
3. anders-crew-location-fix

### Sprint 4: TUI & Validation
1. email-system-audit
2. scene-email-triggers-audit
3. menu-cleanup-audit
4. tui-improvements
5. e2e-adventure-testing (LAST)

### Sprint 5: Review
1. Review high-and-dry-improvements - likely superseded
2. Review deferred plans - still deferred?
3. Manual playtesting

---

## RED-TEAM: META-PLAN ITSELF

### Iteration 1: Scope Creep
**Risk:** 26 plans is massive scope
**Mitigation:**
- Sprint structure with clear milestones
- Each sprint has shippable outcome
- Can stop after any sprint

### Iteration 2: Dependency Errors
**Risk:** Dependency graph may have hidden edges
**Mitigation:**
- Run tests after each plan
- If plan fails, check if dependency was missed
- Update graph as learned

### Iteration 3: Merge Conflicts
**Risk:** Multiple plans modify same files
**Mitigations:**
- agm-orchestration + scene-opening-flow both touch adventure-player.js → sequential
- gap-features + npc-knowledge both touch prompts.js → npc-knowledge first
- Tier 2 plans may all touch NPC JSON files → no conflict, additive

---

## VERIFICATION

After each sprint:
```bash
npm test                    # All tests pass
node src/chat-tui.js       # Smoke test
```

After Sprint 4:
```bash
node tests/e2e/*.test.js   # Full E2E validation
```

---

## GENERATOR HANDOFF

For each plan, Generator receives:
```
You are the Generator. Read .claude/plans/[plan-name].md.

Deliverables: [from plan]

Run tests after each major step. Report pass/fail.
```

---

## USER DECISIONS

| Decision | Choice |
|----------|--------|
| Parallelism | **Sequential** - one Generator session at a time |
| State verification | **Always verify** - each plan starts with test run |
| Regression handling | Easy: fix immediately. Hard: log & continue. Blocking: plan mode + raise alarms |

---

## GENERATOR PROTOCOL

For each plan:
1. **Verify state first** - run existing tests, check if files exist
2. **Implement missing pieces** - skip what's already done
3. **Run tests after each step** - report pass/fail
4. **On regression:**
   - Easy fix? Do it immediately
   - Hard fix? Log issue, continue, fix later
   - Blocking? Enter plan mode, raise alarm to user
