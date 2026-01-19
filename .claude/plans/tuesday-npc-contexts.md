# Plan: Tuesday Campaign NPC Contexts

**Status:** READY FOR GENERATOR
**Date:** 2026-01-18

---

## CRITICAL: Role Verification

**Before ANY action, use AskUserQuestion tool to confirm role:**

```javascript
AskUserQuestion({
  questions: [{
    question: "What is my role for this task?",
    header: "Role",
    options: [
      { label: "Auditor", description: "Write tests, verify plan, provide Generator handoff prompt" },
      { label: "Generator", description: "Read plan, implement code, run tests until pass" }
    ],
    multiSelect: false
  }]
})
```

**Then:**
- If Auditor → Review plan, refine tests, issue handoff prompt
- If Generator → Read plan, implement deliverables, run tests

**Never self-assign. Never assume. Always ask via UQ.**

---

## Summary

Create 30 Tuesday campaign NPCs with location-aware context presets. Shipboard crew see shipboard contexts; planet-side contacts see planet contexts. Update Vera to match campaign lore.

---

## Deliverables

| # | File | Description |
|---|------|-------------|
| D1 | `src/campaign-contexts.js` | Context definitions + `getContextsForNpc()` |
| D2 | `src/npc-test-mode.js` | Modify to use location-aware contexts |
| D3 | 27 new NPC JSON files | See NPC list below |
| D4 | `data/npcs/vera.json` | Rewrite Vera as psionic trainer |
| D5 | 5 existing NPC updates | Add `location` field |
| D6 | `tests/tuesday-npc-contexts.test.js` | Verification tests |

---

## Context Definitions (D1)

### Shipboard Contexts (location: "amishi")

```javascript
const SHIPBOARD_CONTEXTS = {
  'on-duty': {
    key: '1',
    label: 'On Duty (at station)',
    description: 'NPC is at their duty station during normal operations',
    promptModifier: 'You are currently on duty at your station. Professional demeanor, focused on your responsibilities.'
  },
  'off-duty': {
    key: '2',
    label: 'Off Duty (mess hall/rec)',
    description: 'NPC is relaxing in common areas',
    promptModifier: 'You are off duty, relaxing. More casual, willing to chat, might share personal thoughts.'
  },
  'combat-stations': {
    key: '3',
    label: 'Combat Stations (Red Alert)',
    description: 'Ship is at battle stations',
    promptModifier: 'COMBAT STATIONS. Terse, focused, adrenaline. No time for small talk. Report status, await orders.'
  },
  'private-quarters': {
    key: '4',
    label: 'Private (in quarters)',
    description: 'Private conversation in personal space',
    promptModifier: 'You are in your private quarters. Guard is down, can discuss personal matters, more vulnerable.'
  },
  'intercom': {
    key: '5',
    label: 'Intercom/Comms',
    description: 'Speaking over ship intercom',
    promptModifier: 'Speaking over intercom. Brief, functional, others may overhear. Use proper comm protocol.'
  }
};
```

### External Contexts (location: "external")

```javascript
const EXTERNAL_CONTEXTS = {
  'their-office': {
    key: '1',
    label: 'At Their Office',
    description: 'Meeting at their place of work',
    promptModifier: 'You are at your office/workplace. Professional setting, you have home advantage.'
  },
  'public-meeting': {
    key: '2',
    label: 'Public Meeting (bar/cafe)',
    description: 'Meeting in a public place',
    promptModifier: 'Meeting in a public place. Be aware of who might overhear. Neutral ground.'
  },
  'comms-from-ship': {
    key: '3',
    label: 'Comms Call from Amishi',
    description: 'Video/audio call from the ship',
    promptModifier: 'This is a comms call. Slight delay, formal, aware transmission could be intercepted.'
  },
  'dockside': {
    key: '4',
    label: 'Dockside Encounter',
    description: 'Meeting at the starport',
    promptModifier: 'Meeting at the starport docks. Busy, noisy, time pressure, ships coming and going.'
  }
};
```

---

## NPC List (D3, D4)

### Shipboard - Amishi (22)

| # | ID | Name | Role |
|---|-----|------|------|
| 1 | vera | Vera | Psionic Trainer |
| 2 | eddie-ed7 | Eddie ED-7 | Ship AI Engineer |
| 3 | sgt-tomas-reyes | Sgt. Tomas Reyes | Marine NCO |
| 4 | wellen-stova | Wellen Stova | Medical Officer |
| 5 | lt-dex-morain | Lt. Dex Morain | Fighter Lead |
| 6 | mr-breck-92 | Mr. Breck-92 | Steward Droid |
| 7 | ens-yuki-tanaka | Ens. Yuki Tanaka | Fighter Pilot |
| 8 | po-chen-weyland | PO Chen Weyland | Fighter Pilot |
| 9 | ens-petra-valis | Ens. Petra Valis | Fighter Pilot |
| 10 | po-marcus-dubois | PO Marcus DuBois | Fighter Pilot |
| 11 | ens-ravi-sharma | Ens. Ravi Sharma | Fighter Pilot |
| 12 | cpl-lise-henriksen | Cpl. Lise Henriksen | Marine Team Lead |
| 13 | cpl-jin-woo-park | Cpl. Jin Woo-Park | Marine Team Lead |
| 14 | alpha-ag1 | AG-1 "Alpha" | AI Gunner |
| 15 | beta-ag2 | AG-2 "Beta" | AI Gunner |
| 16 | delta-ag4 | AG-4 "Delta" | AI Gunner |
| 17 | echo-ag5 | AG-5 "Echo" | AI Gunner |
| 18 | foxtrot-ag6 | AG-6 "Foxtrot" | AI Gunner |
| 19 | kimbly | Kimbly | Tenser Wolf Mascot |

### External (8)

| # | ID | Name | Role |
|---|-----|------|------|
| 20 | commander-adele-reyes | Cmdr. Adele Reyes | JSI Handler |
| 21 | mira-koss | Mira Koss | Smuggler |
| 22 | dr-helena-voss | Dr. Helena Voss | Researcher |
| 23 | d-contact | "D." | Darrian Intel |
| 24 | scarface-tomas | "Scarface" Tomas | JSI Asset |
| 25 | lt-cmdr-vasquez | Lt. Cmdr. Vasquez | Naval Intel |
| 26 | captain-kfourrz | Captain Kfourrz | Enemy Negotiator |
| 27 | captain-yuen | Captain Yuen | Survivor |

### Existing NPCs to Update (D5)

| File | Add Field |
|------|-----------|
| anemone-lindqvist.json | `"location": "amishi"` |
| gamma-ag3.json | `"location": "amishi"` |
| jeri-tallux.json | `"location": "amishi"` |
| marcus-chen.json | `"location": "external"` |
| commander-park.json | `"location": "external"` |

---

## NPC Template

```json
{
  "id": "sgt-tomas-reyes",
  "name": "Sergeant Tomas Reyes",
  "archetype": "military",
  "title": "Senior Marine NCO",
  "location": "amishi",
  "location_detail": "Marine Barracks",
  "campaign": "tuesday-spinward-marches",
  "campaign_exclusive": true,
  "personality": {
    "traits": ["calm", "competent", "protective"],
    "speech": "measured, professional, military terminology"
  },
  "background": "Professional soldier. Recruited by Asao Ora.",
  "knowledge": ["marine-tactics", "amishi-security"],
  "relationships": {}
}
```

---

## Test Cases (D6)

```javascript
test('getContextsForNpc returns shipboard contexts for amishi NPCs')
test('getContextsForNpc returns external contexts for external NPCs')
test('getContextsForNpc returns default contexts for NPCs without location')
test('Vera has location amishi and role Psionic Trainer')
test('All 27 new NPCs have required fields')
test('All 5 existing NPCs have location field')
test('Solo campaign still uses default contexts')
```

---

## Execution Order

1. Create `src/campaign-contexts.js`
2. Create `tests/tuesday-npc-contexts.test.js`
3. Run tests (should fail - no NPCs yet)
4. Create 27 new NPC files
5. Update 5 existing NPCs with location field
6. Rewrite Vera
7. Modify `src/npc-test-mode.js`
8. Run tests (should pass)

---

## Generator Handoff Prompt

```
You are the Generator. Read .claude/plans/tuesday-npc-contexts.md.

Deliverables:
1. Create src/campaign-contexts.js with SHIPBOARD_CONTEXTS, EXTERNAL_CONTEXTS, getContextsForNpc()
2. Create tests/tuesday-npc-contexts.test.js
3. Create 27 new NPC JSON files in data/npcs/
4. Rewrite data/npcs/vera.json (psionic trainer, location: amishi)
5. Add location field to 5 existing NPCs
6. Modify src/npc-test-mode.js to use getContextsForNpc()

Run tests after each major step. Report pass/fail.
```
