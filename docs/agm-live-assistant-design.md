# AGM Live Play Assistant - Design Exploration

**Status:** BRAINSTORMING
**Last Updated:** 2026-01-17

---

## Table of Contents

1. [Problem Analysis](#1-problem-analysis)
2. [Technology Options](#2-technology-options)
3. [Assistance Modes](#3-assistance-modes)
4. [Architecture Options](#4-architecture-options)
5. [Feature Priority Matrix](#5-feature-priority-matrix)
6. [Low-Hanging Fruit](#6-low-hanging-fruit)
7. [Open Questions](#7-open-questions)
8. [Future Ideas Parking Lot](#8-future-ideas-parking-lot)

---

## 1. Problem Analysis

### The Core Challenge
Online play with voice creates unique cognitive load that doesn't exist in person.

### Pain Points (Indexed)

| ID | Pain Point | Severity | Frequency |
|----|------------|----------|-----------|
| P1 | Can't see player faces (missing engagement cues) | HIGH | Constant |
| P2 | VTT requires clicking while narrating | MEDIUM | Frequent |
| P3 | Discord chat scrolls past while talking | MEDIUM | Frequent |
| P4 | No physical dice/cards for tactical feel | LOW | Constant |
| P5 | Dead air feels worse than in person | HIGH | Occasional |
| P6 | Forgetting NPC names mid-session | HIGH | Frequent |
| P7 | Rules lookups break flow | MEDIUM | Occasional |
| P8 | Tracking player spotlight time | LOW | Constant |
| P9 | Session recap/notes burden | MEDIUM | Post-session |

### Key Question
**What can AI do during live play that a human can't?**

- Process audio in real-time while GM is talking
- Instantly recall any detail from session history
- Generate content with zero prep time
- Track multiple metrics simultaneously (engagement, time, plot threads)

---

## 2. Technology Options

### 2.1 Voice → Text (Listening)

| Tech | Latency | Quality | Cost | Self-Host? |
|------|---------|---------|------|------------|
| Whisper API | ~2-3s | Excellent | $0.006/min | No |
| Deepgram | ~300ms | Excellent | $0.0043/min | No |
| AssemblyAI | ~300ms | Excellent | $0.00025/sec | No |
| Discord bot + Whisper local | Real-time | Good | Free | Yes |
| Vosk (local) | Real-time | Good | Free | Yes |

**Recommendation:** Deepgram for quality, local Whisper for cost

### 2.2 Text → Voice (Speaking)

| Tech | Latency | Quality | Cost | Notes |
|------|---------|---------|------|-------|
| ElevenLabs | ~1-2s | Excellent | $0.30/1k chars | Best voices |
| PlayHT | ~1s | Very good | $0.10/1k chars | Good value |
| OpenAI TTS | ~500ms | Good | $0.015/1k chars | Fastest cheap |
| Coqui (local) | ~200ms | Variable | Free | Self-host |
| Piper (local) | ~100ms | Good | Free | Lightweight |

**Recommendation:** OpenAI TTS for MVP, ElevenLabs for polish

### 2.3 Discord Integration

| Component | Purpose |
|-----------|---------|
| discord.js | Bot framework, slash commands |
| @discordjs/voice | Join voice channels, stream audio |
| @discordjs/opus | Audio encoding |
| prism-media | Audio processing |

### 2.4 VTT Integration

| VTT | API Quality | Automation Potential | Notes |
|-----|-------------|---------------------|-------|
| Foundry VTT | Full module API | HIGH | Can control everything |
| Roll20 | Limited API | MEDIUM | Macros, some automation |
| Fantasy Grounds | Extension API | MEDIUM | Windows-focused |
| Owlbear Rodeo | No API | LOW | Manual only |
| Talespire | Mod support | MEDIUM | 3D focused |

**Current target:** Roll20 (limited API = focus on Discord)

---

## 3. Assistance Modes

### 3.1 GM Whisper Channel (Earpiece)

AGM speaks only to GM via private audio:
- "Jordan hasn't spoken in 12 minutes"
- "The merchant's name was Kowalski"
- "Vacuum rules: 1D per round, END check"

**Tech:** Private Discord DM + TTS, GM wears earbuds
**Effort:** MEDIUM | **Impact:** HIGH

### 3.2 Voice-Activated NPC

GM says: "AGM, the bartender responds"
AGM generates and speaks NPC dialogue in character voice

**Tech:** Keyword detection → LLM → TTS → Discord voice
**Effort:** HIGH | **Impact:** MEDIUM

### 3.3 Combat Color Commentary

AGM hears: "8 damage to the pirate"
AGM speaks: "The blade catches him across the ribs—he staggers."

**Tech:** Pattern matching → LLM → TTS
**Effort:** MEDIUM | **Impact:** LOW (novelty wears off)

### 3.4 Live Transcription + Memory

- Session auto-transcribed in background
- Searchable during play: `/search Kowalski`
- Auto-recap at session end
- Unresolved threads identified

**Tech:** Voice channel → Whisper → searchable log
**Effort:** MEDIUM | **Impact:** HIGH

### 3.5 Engagement Monitor

- Tracks speaking time per player
- Detects silence/low energy periods
- Suggests spotlight shifts to GM

**Tech:** Speaker diarization + timing
**Effort:** HIGH | **Impact:** MEDIUM

### 3.6 Rules Oracle

Hears: "can I shoot through the window?"
Whispers: "Cover: -2 to hit, +4 armor"

**Tech:** Keyword trigger → rules DB lookup
**Effort:** LOW | **Impact:** MEDIUM

### 3.7 Instant Content Generation

- `/npc gruff mechanic` → full NPC in 2 seconds
- `/rumor starport` → 4 rumors
- `/name vilani` → appropriate name
- `/patron` → mission hook with twist

**Tech:** Slash command → Claude API → text
**Effort:** LOW | **Impact:** HIGH

---

## 4. Architecture Options

### Option A: Discord Bot Only (Simplest)

```
Discord Voice Channel
        ↓
   Discord Bot (listens)
        ↓
   Whisper API (transcription)
        ↓
   Claude API (brain)
        ↓
   Text Response (or TTS)
        ↓
   Discord Channel
```

**Pros:** Single integration, works with any VTT
**Cons:** No VTT automation

### Option B: Foundry + Discord Hybrid

```
Foundry Module ←→ AGM Server ←→ Discord Bot
     ↓                ↓              ↓
  Map/tokens       Claude        Voice I/O
  Chat log         Memory        Transcription
  Dice rolls       Context
```

**Pros:** Full automation, deep integration
**Cons:** Foundry-specific, complex

### Option C: Overlay App

Standalone app that:
- Captures system audio
- Shows suggestions to GM only
- Types into Discord/VTT on command

**Pros:** VTT-agnostic, non-invasive
**Cons:** Platform-specific builds

### Option D: Web Dashboard + Bot

```
Web UI (GM view) ←→ Backend Server ←→ Discord Bot
      ↓                   ↓               ↓
  Controls            Claude API      Voice/Text
  Transcript          Session DB      Commands
  NPC cards           Memory
```

**Pros:** Rich UI, flexible
**Cons:** More infrastructure

---

## 5. Feature Priority Matrix

| Feature | Effort | Impact | Tech Complexity | Priority |
|---------|--------|--------|-----------------|----------|
| `/npc` generation | LOW | HIGH | LOW | ⭐⭐⭐ |
| `/name` generation | LOW | HIGH | LOW | ⭐⭐⭐ |
| `/rumor` generation | LOW | MEDIUM | LOW | ⭐⭐⭐ |
| Session transcription | MEDIUM | HIGH | MEDIUM | ⭐⭐ |
| `/recap` from transcript | LOW | HIGH | LOW | ⭐⭐ |
| `/search` transcript | LOW | MEDIUM | LOW | ⭐⭐ |
| `/rule` lookup | LOW | MEDIUM | LOW | ⭐⭐ |
| Player spotlight tracking | MEDIUM | MEDIUM | HIGH | ⭐ |
| NPC voice synthesis | MEDIUM | MEDIUM | MEDIUM | ⭐ |
| GM whisper channel | MEDIUM | MEDIUM | MEDIUM | ⭐ |
| Combat narration | MEDIUM | LOW | MEDIUM | - |
| VTT automation | HIGH | MEDIUM | HIGH | - |
| Engagement alerts | HIGH | MEDIUM | HIGH | - |

---

## 6. Low-Hanging Fruit

### 🍎 Option 1: Discord Slash Commands (Text Only)

**What:** Bot responds to `/npc`, `/name`, `/rumor`, `/rule` with text

**Why it's easy:**
- No voice processing
- No transcription
- Just Claude API calls
- 2-3 hours to working prototype

**Delivers:**
- Instant NPC generation mid-session
- Name generation without breaking flow
- Rules quick-reference
- Works for all players

**Example flow:**
```
GM: /npc "suspicious customs officer"
Bot: **Officer Delacroix** (she/her)
     Voice: Clipped, formal, slight accent
     Quirk: Taps pen rhythmically when lying
     Opening: "Your cargo manifest seems... incomplete."
```

---

### 🍎 Option 2: Passive Transcription + Search

**What:** Bot joins voice, transcribes silently, enables `/search`

**Why it's easy:**
- One-way audio (listen only)
- No real-time processing needed
- Whisper handles heavy lifting
- 4-6 hours to working prototype

**Delivers:**
- "What was that NPC's name?" → instant answer
- Post-session notes automated
- Searchable session history
- Player quotes captured

**Example flow:**
```
[During session, bot silently transcribes]

GM: /search "the contact in the bar"
Bot: Found 3 mentions:
     - 01:23:45 "You meet Kowalski at the bar"
     - 01:45:12 "Kowalski slides you a datapad"
     - 02:01:33 "Remember what Kowalski said about..."
```

---

### 🍎 Option 3: Hybrid - Commands + Session Memory

**What:** Combine slash commands with session context awareness

**Why it's easy:**
- Build on Option 1
- Add simple transcript logging (even text chat only)
- `/recap` summarizes logged content
- 4-5 hours total

**Delivers:**
- All of Option 1
- Session continuity ("last session you met...")
- Auto-recap for session notes
- Context-aware generation

**Example flow:**
```
GM: /npc "the mechanic they hired last session"
Bot: **Zara Chen** (returning NPC from Session 4)
     Previously: Fixed their air recycler, overcharged 200cr
     Current mood: Friendly (they paid well)
     Opening: "Back again? What'd you break this time?"
```

---

## 7. Open Questions

| Question | Options | Implication |
|----------|---------|-------------|
| VTT platform? | Roll20 / Foundry / Other | API depth |
| Voice priority? | Text-first / Voice-first | TTS complexity |
| Who can query? | GM-only / All players | Permission model |
| Hosting? | Self-hosted / Cloud | Cost vs simplicity |
| Session persistence? | Per-session / Campaign-long | Storage needs |
| Traveller-specific? | Yes / Generic | Content generation |

---

## 8. Future Ideas Parking Lot

Ideas captured but not prioritized:

- **Initiative tracker integration** - auto-roll, announce turns
- **Map fog-of-war control** - reveal areas via voice command
- **Background music DJ** - mood-appropriate ambient audio
- **Character sheet lookup** - "what's Maya's Pilot skill?"
- **Consequence oracle** - "the jump drive fails, what happens?"
- **Session scheduling bot** - coordinate availability
- **XP/reward tracking** - log accomplishments
- **Relationship map** - visualize NPC connections
- **Plot thread tracker** - unresolved hooks dashboard
- **Player absence summaries** - "last session while you were gone..."
- **In-character chat translation** - NPC speaks in dialect
- **Combat damage descriptions** - procedural narration
- **Merchant inventory generation** - contextual stock
- **Starship encounter generator** - traffic, pirates, patrol
- **Jump space interlude generator** - week-in-transit events

---

## Recommended Starting Point

**Option 3 (Hybrid)** offers best value:
- Immediate utility from slash commands
- Foundation for future features
- Low technical risk
- Expandable to voice later

### Minimum Viable Commands

1. `/npc [description]` - instant NPC
2. `/name [culture]` - quick name
3. `/rumor [location]` - local gossip
4. `/recap` - session summary
5. `/rule [topic]` - rules lookup

### Tech Stack

```
discord.js (bot framework)
@anthropic-ai/sdk (already have)
Simple JSON file (session log)
```

No voice processing, no TTS, no complex infrastructure.
