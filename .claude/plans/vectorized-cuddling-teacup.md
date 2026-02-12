# Strategic Decision: Continue Prototype Development

**Status:** DECIDED
**Date:** 2026-01-18
**Decision:** Continue developing npc-persona-prototype; defer merge to starship-ops

---

## Decision Summary

**Question:** Should we merge npc-persona-prototype into traveller-starship-operations-vtt?

**Answer:** No, not yet. Continue prototype development.

---

## Rationale

### Original Purpose
"AI-backed NPC conversation prototype with persistent memory" - this is a **prototype**, a proving ground for concepts.

### What's Proven (Ready for eventual port)
- AI-driven NPC conversations with persistent memory
- Disposition tracking and relationship mechanics
- AGM orchestration (narrator + NPC voice mixing)
- Goal-driven NPC behavior
- Knowledge boundaries (prevents spoilers)
- Red team validation (self-correction loop)
- Skill check integration (Traveller mechanics)

### What's Incomplete (26 plans pending)
| Tier | Plans | Status |
|------|-------|--------|
| Tier 1: Core Systems | 4 | npc-knowledge, gap-features, red-team, knowledge-extraction |
| Tier 2: High-and-Dry | 14 | Scene/NPC content work |
| Tier 3: Features/TUI | 7 | Inventory, email, menu |

### Why Not Merge Now
1. **Architecture mismatch** - TUI/file-based vs web/socket/SQLite
2. **26 pending plans** - Feature set not yet stable
3. **Prototype debt** - Code for experimentation, not production
4. **Better path** - Port patterns and learnings, not raw code

---

## Path Forward

1. **Continue prototype development** - Complete remaining plans in sandbox
2. **Validate features** - Use TUI for rapid iteration
3. **Document patterns** - Extract learnings as they mature
4. **Port when ready** - Write production code in starship-ops using proven patterns

---

## When to Revisit Merge Decision

Consider merge when:
- [ ] Tier 1 (Core Systems) complete
- [ ] At least one complete adventure playable end-to-end
- [ ] Autonomous player agent can complete High and Dry
- [ ] Architecture patterns documented
- [ ] Test coverage validates all core behaviors

---

## Immediate Next Steps

Return to prototype development:
1. Review meta-plan tier structure
2. Select next plan to implement
3. Continue Auditor/Generator workflow

---

## Gap Analysis (Reference for Future Merge)

### npc-persona-prototype → starship-ops Requirements

**This repo needs (before merge):**
- Storage abstraction layer (file → interface)
- Headless adventure player (decouple from TUI)
- Clean module exports

**Starship-ops needs (to receive):**
- Database schema: adventure_sessions, npc_memories, npc_dispositions
- Socket handlers: adventure.js
- React components: AdventurePanel, NPCDialogue, SkillCheckModal
- Enhanced ai-npc.js with new prompt system

**Estimated merge effort:** 4-6 sprints when ready
