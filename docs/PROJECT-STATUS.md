# NPC Persona Prototype - Project Status

**Last Updated:** 2026-01-17
**Branch:** main

---

## Current State

### Working Features

| Feature | Status | Entry Point |
|---------|--------|-------------|
| Adventure Mode (High and Dry) | Working | TUI Option 1 |
| NPC Test Mode | Working | TUI Option 2 |
| Training Session | Working | TUI Option 3 |
| Legacy Quick Chat | Working | TUI Option 4 |
| Scene Navigation | Working | Adventure mode |
| NPC Dialogue | Working | During adventure |
| Escape Commands | Working | `/b`, `/q`, `/back`, `/quit` |

### Test Status

- **Core tests:** Passing
- **Integration tests:** 2 minor failures (disposition clamping edge cases)
- **TUI tests:** Passing

### Recent Additions (This Session)

1. **Bug Fixes:**
   - PC ID mismatch (`alex-ryder-npc` → `alex-ryder`)
   - `chat` import from wrong module
   - `assembleFullPrompt` memory object fix
   - Scene frame `B` key handling
   - `/b` command immediate return to menu

2. **New Features:**
   - `greets_first` per-NPC config (controls auto-greeting)
   - S7 Knowledge Validation scenario with auto-patch
   - `FACT_ACCURACY` checklist item
   - Short command aliases (`/b`, `/q`, `/r`, `/s`)

3. **New Test Coverage:**
   - `tests/tui-live-system.test.js` (59 unit tests)
   - `tests/tui-exercise.test.js` (15 process spawn tests)

---

## Architecture Overview

```
src/
├── chat-tui.js          # Main TUI entry point
├── adventure-player.js  # Adventure mode orchestration
├── prompts.js           # Prompt assembly
├── prompt-extensions.js # Context injection (plot, world, items)
├── training-scenarios.js # S1-S7 training scenarios
├── npc-test-mode.js     # Test mode state management
├── disposition.js       # NPC disposition tracking
├── plot-context.js      # Story state → prompt context
└── [30+ other modules]  # See src/ for full list

data/
├── npcs/                # NPC persona JSON files
├── pcs/                 # Player character JSON files
├── adventures/          # Adventure data (scenes, items, etc)
└── state/               # Saved game state

.claude/
├── reference/           # Training material, adventure details
└── plans/               # Implementation plans
```

---

## NPCs by Readiness

### Production Ready (Walston/High and Dry)

| NPC | File | greets_first | knowledge_base |
|-----|------|--------------|----------------|
| Minister Greener | `minister-greener.json` | true | Complete |
| Captain Corelli | `captain-corelli.json` | true | Complete |
| Startown Bartender | `startown-bartender.json` | false | Complete |
| Customs Officer | `customs-officer-walston.json` | - | Partial |
| Dictator Masterton | `dictator-masterton.json` | - | Partial |
| Vargr Chauffeur | `vargr-chauffeur.json` | - | Basic |
| Mr Casarii | `mr-casarii.json` | - | Basic |

### Needs Training (ISS Amishi)

| NPC | Issue |
|-----|-------|
| Marcus Chen | Needs voice, sample_dialogue |
| Vera Santos | Needs voice, sample_dialogue |
| Commander Park | Needs voice, sample_dialogue |
| Jeri Tallux | Needs voice, sample_dialogue |

---

## Key Commands

### TUI Navigation
- `1-5` - Menu selection
- `B` - Back at scene frame
- `/b`, `/back` - Return to previous menu
- `/q`, `/quit` - Exit

### Adventure Mode
- `/status` - Current scene/objectives
- `/resume`, `/r` - Return from NPC to AGM
- `/save`, `/s` - Force save
- `/cast` - Show NPCs in scene

### Training Mode
- `/scenario s1-s7` - Load scenario
- `/retry` - Reset, same scenario
- `/pass`, `/fail` - Mark result
- `/checklist` - Show evaluation items

---

## Known Issues

1. Disposition clamping at -3 boundary (test failure)
2. Chauffeur disposition after rescue (test failure)
3. Some integration tests need `storyState` fixture updates

---

## Next Steps

1. Run S7 Knowledge Validation on all Walston NPCs
2. Train ISS Amishi NPCs (voice cards, sample_dialogue)
3. Fix remaining test failures
4. Add more beat summaries for continuity
