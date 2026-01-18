# Audit Plan: Act 2 Scene Order Correction

**Status:** READY FOR GENERATOR
**Date:** 2026-01-17
**Auditor:** Claude (Auditor role)

---

## Problem Statement

Act 2 scene order violates geography and practical logic:

| Current Order | Issue |
|---------------|-------|
| 1. starport-arrival | ✓ Correct |
| 2. meeting-greener | ✗ Wrong - Minister is in CAPITAL, not starport |
| 3. startown-investigation | ✗ Wrong - should be BEFORE meeting minister |

## Geographic Facts (from source)

```
Starport: Small, handles ~1 ship every 2 days (separate location)
Capital: On Central Lake, ~600 people (different location)
Startown: Commercial district NEAR starport
Travel: Rail connection between locations
```

The Minister's office is in "Government building, Settlement Island" - the CAPITAL, not the starport area.

## Logical Flow (corrected)

1. **starport-arrival** - Land, clear customs
2. **startown** - Go to hotel (Frontier Inn), stow cargo/crates, gather intel
3. **travel-to-capital** - Rail journey to Central Lake (NEW scene or substage)
4. **meeting-greener** - Negotiate in Minister's office at capital

## Current Scene Problems

### startown-investigation.json
- Order: 6 (should be 5)
- Description says "optional" but it's the logical next step
- Contains hotel (Frontier Inn) where PCs would stay
- Should include: contacting Minister to arrange meeting

### meeting-greener.json
- Order: 5 (should be 6 or 7)
- Missing: How PCs get to capital
- Trigger says "Travellers request ship access at starport, directed here" - but "here" is in a different city

---

## Deliverables

| # | File | Change |
|---|------|--------|
| D1 | `acts/act-2-walston.json` | Reorder scenes array: starport-arrival, startown-investigation, meeting-greener |
| D2 | `scenes/startown-investigation.json` | Change order to 5, remove "optional", add hotel check-in objectives |
| D3 | `scenes/meeting-greener.json` | Change order to 6, update trigger to reference travel from startown |
| D4 | `scenes/startown-investigation.json` | Add substage or beat for "contact minister / arrange meeting" |
| D5 | Optional: `scenes/travel-to-capital.json` | NEW scene for rail journey (can be brief transition) |

---

## Updated Act 2 Structure

```json
{
  "scenes": [
    "starport-arrival",      // Order 4: Land, customs
    "startown-investigation", // Order 5: Hotel, intel, contact minister
    "meeting-greener"         // Order 6: Travel to capital, negotiate
  ]
}
```

### Startown Scene Enhancement

Add to startown-investigation.json:
```json
{
  "stages": [
    {
      "id": "arrival-and-lodging",
      "name": "Finding Lodging",
      "objective": "Secure rooms at Frontier Inn, stow equipment"
    },
    {
      "id": "gathering-intel",
      "name": "Local Investigation",
      "objective": "Learn about the ship, previous crew, local conditions"
    },
    {
      "id": "contacting-minister",
      "name": "Arranging the Meeting",
      "objective": "Contact Minister Greener's office, arrange travel to capital"
    }
  ]
}
```

### Meeting Greener Trigger Update

```json
{
  "triggers": {
    "entry": "Travellers take rail to capital after arranging meeting from Startown",
    "exit": "Survey deal struck OR Travellers refuse terms"
  }
}
```

---

## Test Cases

```javascript
// TEST A2.1: Act 2 scenes in correct order
const act = loadAct('high-and-dry', 'act-2-walston');
assert.deepStrictEqual(act.scenes, [
  'starport-arrival',
  'startown-investigation',
  'meeting-greener'
]);

// TEST A2.2: Startown comes before meeting-greener
const startown = loadScene('high-and-dry', 'startown-investigation');
const meeting = loadScene('high-and-dry', 'meeting-greener');
assert.ok(startown.order < meeting.order);

// TEST A2.3: Startown not marked optional
assert.ok(!startown.description.toLowerCase().includes('optional'));

// TEST A2.4: Startown has stages for hotel/intel/contact
assert.ok(startown.stages && startown.stages.length >= 2);

// TEST A2.5: Meeting-greener trigger references travel
assert.ok(meeting.triggers.entry.includes('rail') ||
          meeting.triggers.entry.includes('travel') ||
          meeting.triggers.entry.includes('capital'));
```

---

## Verification

```bash
node tests/act2-scene-order.test.js
```

Then TUI test:
- Start adventure
- Arrive at Walston (scene 4)
- Next scene should be Startown (scene 5), not Meeting Greener
- Meeting Greener should be scene 6

---

## Implementation Order

1. Create test file (tests fail initially)
2. Update act-2-walston.json scene order
3. Update startown-investigation.json (order, remove optional, add stages)
4. Update meeting-greener.json (order, trigger)
5. Verify tests pass
