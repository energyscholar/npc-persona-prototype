# Tuesday Spinward Marches Campaign - NPC Registry

**Campaign ID:** `tuesday-spinward-marches`
**Source:** Roll20 Export + Discord + Session Logs
**Location:** `/home/bruce/software/traveller-VTT-private/reference/BruceCampaignA/`
**Last Updated:** 2026-01-18

---

## Player Characters (5)

| Name | Player | Role | Status |
|------|--------|------|--------|
| James Delleron | jaimesbeam | Captain | Active PC |
| Von Sydo | les___ | Sensors/Comms, Psion | Active PC |
| Asao Ora | dragonknight912 | Marine Commander | Active PC |
| Max Planck | bagored | Chief Engineer | Active PC |
| Marina DeVeillter | alexa076829 | Gunnery Chief | Active PC |

---

## Top 20 NPCs (Priority for AI Enhancement)

### Tier 1: Core Ship Crew (7)

| # | Name | Role | AI Priority | Notes |
|---|------|------|-------------|-------|
| 1 | Vera | Psionic Trainer / Cover Wife | HIGH | Von Sydo's "wife", strong-willed instructor |
| 2 | Eddie ED-7 | Ship AI / Engineer | HIGH | TL15 droid, fragmentary memories, collects tools |
| 3 | Jeri Tallux | Computer Chief | HIGH | Hero under fire, negotiated 20% raise, fills critical skill gap |
| 4 | Lt. Dex Morain "Hardpoint" | Fighter Lead | MEDIUM | Professional, quiet, bounty hunter ex-wife |
| 5 | Anemone Lindqvist | Assistant Gunner | HIGH | 18yo Rachevian, Kaylee-like, hero worship of Marina |
| 6 | AG-3 "Gamma" | AI Gunner Speaker | MEDIUM | Has "hesitation quirk" - emergent ethics from trauma |
| 7 | Sgt. Tomas Reyes | Senior Marine NCO | MEDIUM | Asao's right hand, knows assassination charge is false |

### Tier 2: Ship Crew Extended (6)

| # | Name | Role | AI Priority | Notes |
|---|------|------|-------------|-------|
| 8 | Wellen Stova | Medical Officer | MEDIUM | Garoo refugee, Medic 3, quietly grateful |
| 9 | Mr. Breck-92 | Steward Droid | LOW | Rescued from taco stand, chef at level 3 |
| 10 | Ens. Yuki Tanaka "Whisper" | Fighter Pilot | LOW | Eager, nervous, nemesis now pirate |
| 11 | PO Chen Weyland "Brick" | Fighter Pilot | LOW | Gruff, kind, pirates took his ship |
| 12 | Cpl. Lise Henriksen | Fire Team Alpha | LOW | Best marksman, from Raschev |
| 13 | Cpl. Jin Woo-Park | Fire Team Bravo | LOW | Breaching specialist |

### Tier 3: External Contacts (7)

| # | Name | Role | AI Priority | Notes |
|---|------|------|-------------|-------|
| 14 | Commander Adele Reyes | JSI Handler | MEDIUM | Mission controller |
| 15 | "Scarface" Tomas | JSI Asset | LOW | Posed as criminal fixer at Caladbolg |
| 16 | Mira Koss | Datrillian Smuggler | HIGH | REAL criminal (not JSI), favor owed |
| 17 | Lewis Clarke | Captain of Tanagra | LOW | Original scout ship captain |
| 18 | Sir Baxton Fauntleroy | Imperial Knight | LOW | Caladbolg contact |
| 19 | Castellen Vane | Dorannia Noble | LOW | Party NPC |
| 20 | Dr. Heiyoao | Aslan Scientist | LOW | Raschev contact |

### Antagonists (Not for AI chat, but tracked)

| Name | Role | Notes |
|------|------|-------|
| Vargr "Blood Profit" Pack | Pirates | Primary current threat |
| Ryoc IV | Dictator of Garoo | Health Police regime |
| Agent Thale | Health Police | Past antagonist |
| Commander Torrins | Garoovian Navy | Past antagonist |

---

## Full Amishi Crew Roster

### Command (5 PCs)
- James Delleron (Captain)
- Marina DeVeillter (Gunnery Chief)
- Asao Ora (Marine Commander)
- Max Planck (Chief Engineer)
- Von Sydo (Sensor Officer)

### Fighter Pilots (6)
- Lt. Dex Morain "Hardpoint" (Lead)
- Ens. Yuki Tanaka "Whisper"
- PO Chen Weyland "Brick"
- Ens. Petra Valis "Ghost"
- PO Marcus DuBois "Preacher"
- Ens. Ravi Sharma "Dice"

### Gunnery Section (1 human + 6 AI)
- 2nd Lt. Anemone Lindqvist
- AG-1 "Alpha", AG-2 "Beta", AG-3 "Gamma", AG-4 "Delta", AG-5 "Echo", AG-6 "Foxtrot"

### Computer Section (1)
- Jeri Tallux

### Medical Section (2)
- Wellen Stova (Chief)
- Vera (Assistant / Cover role)

### Marines (8)
- Sgt. Tomas Reyes (Senior NCO)
- Cpl. Lise Henriksen (Alpha Lead)
- Cpl. Jin Woo-Park (Bravo Lead)
- Kowalski, Mbeki, O'Brien, Chen (Enlisted)

### Ship's Robots (2)
- Mr. Breck-92 (Steward)
- Eddie ED-7 (Engineer)

**Total: 25 crew + 7 AI/robots**

---

## Campaign Guardrails

**CRITICAL: NPCs must NEVER cross campaigns.**

Each NPC JSON file MUST include:
```json
{
  "campaign": "tuesday-spinward-marches",
  "campaign_exclusive": true
}
```

The solo campaign uses:
```json
{
  "campaign": "solo-high-and-dry",
  "campaign_exclusive": true
}
```

Any NPC lookup or conversation system MUST filter by campaign ID.

---

## Source Files

| Content | Path |
|---------|------|
| Campaign Index | `BruceCampaignA/CAMPAIGN-INDEX.md` |
| Crew Roster | `BruceCampaignA/crew-roster-amishi.md` |
| Roll20 Export | `BruceCampaignA/gigantic_roll20_campaign/` |
| Discord Export | `BruceCampaignA/discord-exports/` |
| Session Logs | `BruceCampaignA/session-*.md` |
