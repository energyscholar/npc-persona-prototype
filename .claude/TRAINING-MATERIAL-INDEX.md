# Training Material Index

**Purpose:** Quick reference to all training resources for NPC persona development

---

## Primary Training References

### 1. Adventure Source Material

| File | Content | Priority |
|------|---------|----------|
| `.claude/reference/high-and-dry-detailed.md` | Complete adventure extraction | **HIGH** |
| `data/adventures/high-and-dry/scenes/*.json` | Scene definitions | HIGH |
| `data/adventures/high-and-dry/timeline.json` | Event timeline | HIGH |
| `data/adventures/high-and-dry/items.json` | Equipment/cargo | MEDIUM |
| `data/adventures/high-and-dry/skill-checks.json` | Difficulty targets | MEDIUM |

### 2. GM/Narration Patterns

| File | Content | Priority |
|------|---------|----------|
| `.claude/reference/agm-training-material.md` | GM techniques from actual play | **HIGH** |
| `docs/agm-live-assistant-design.md` | AGM architecture design | MEDIUM |

### 3. NPC Definitions

| File | NPC | Completeness |
|------|-----|--------------|
| `data/npcs/minister-greener.json` | Alan Greener | Complete |
| `data/npcs/captain-corelli.json` | Ship captain | Complete |
| `data/npcs/startown-bartender.json` | Bartender | Complete |
| `data/npcs/customs-officer-walston.json` | Corfe | Partial |
| `data/npcs/vargr-chauffeur.json` | Chauffeur | Basic |

---

## Key Facts for Walston NPCs

All Walston NPCs should know:

### Planet Basics
- Thin atmosphere, low population
- Hereditary dictatorship (Dictator Masterton)
- Traditional views on Vargr (glass ceiling)
- Main industry: fishing, limited agriculture

### High and Dry Specific
- Mount Salbarii volcano on Settlement Island
- Highndry scout ship stranded in mountains
- Previous crew botched job and fled
- Government survey needed for eruption prediction

### Timeline
- Geologist visit: ~1 year ago (said 99% safe)
- Ship stranded: ~3-4 months ago
- Previous crew departure: ~2-3 months ago

---

## Training Workflow Reference

See `docs/TRAINING-GUIDE.md` for:
- Scenario definitions (S1-S7)
- Evaluation checklist
- Reset/repeat procedures
- Knowledge validation workflow

---

## Source Material Locations

### In This Repo
```
.claude/reference/           # Extracted adventure details
data/adventures/high-and-dry/ # Structured adventure data
data/npcs/                   # NPC persona files
```

### External (Linked)
```
/home/bruce/software/traveller-starship-operations-vtt/data/wiki-cache/
  └── systems/1232.json      # Walston wiki data (65KB)
```

---

## Training Efficiency Order

### For New NPC
1. Read adventure source (`.claude/reference/high-and-dry-detailed.md`)
2. Find NPC role and scenes they appear in
3. Draft `knowledge_base` entries
4. Write 4-6 `sample_dialogue` lines
5. Run S1 (First Meeting) - check voice
6. Run S7 (Knowledge Validation) - check facts
7. Iterate until pass

### For Existing NPC Improvement
1. Run S7 - identify knowledge gaps
2. Check `data/knowledge-gaps/{npc}.json`
3. Patch `knowledge_base`
4. Re-run S7 to verify
5. Run S1-S3 to ensure voice still works

### For Voice Tuning
1. Read `sample_dialogue` examples
2. Run S1 with varied prompts
3. Note where voice breaks
4. Add more `sample_dialogue` covering weak spots
5. Adjust `personality.speech` description
6. Retry until consistent

---

## Quick Commands

```bash
# Start training session
npm run tui  # → Option 3

# View NPC definition
cat data/npcs/minister-greener.json | jq .

# View knowledge gaps
cat data/knowledge-gaps/*.json

# View training results
cat data/training-results/*.json

# Run specific test
npm test -- --grep "Greener"
```
