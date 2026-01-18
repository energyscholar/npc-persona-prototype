# Audit Plan: Settlement Island Detailed Geography

**Status:** READY FOR GENERATOR
**Date:** 2026-01-17
**Auditor:** Claude (Auditor role)

---

## Objective

Create comprehensive Settlement Island geography with rail network, towns, farms, and points of interest. The adventure PDF provides incomplete maps - we must synthesize and extend.

---

## Source Material (from PDF)

### Known Locations
| Location | Description | Source |
|----------|-------------|--------|
| Capital (Central) | On Central Lake, ~600 people, government center | p8-9 |
| Salbarii town | West shore lake, ~20km north of volcano | p8 |
| Barvinn | Coastal hamlet, threatened by eruption | p8 |
| Starport | Small, ~1 ship every 2 days | p17-19 |
| Startown | Commercial district near starport | p19-20 |
| Mount Salbarii | Southern extreme of island, ~1500m | p24 |

### Rail Network (from text, p17-19)
```
"There is a regular rail service which runs once a day."
"The railroad is not in the best of condition"
"trains are short, just a small electric"
"Central is the rail hub for the island, with a line out"
"all of which are owned by Dictator Masterton"
"railroad staff... minor stations, plus the rail depot at the capital"
```

### Geography (from text)
```
- Two great lakes fed by mountain rainfall
- Warm current creates fertile zone
- Settlement Island is main inhabited area
- Population ~3,000 (70% Vargr)
```

---

## New Data Structure

### File: `data/adventures/high-and-dry/geography/settlement-island.json`

```json
{
  "id": "settlement-island",
  "name": "Settlement Island",
  "world": "walston",
  "population": 3000,
  "demographics": {
    "vargr_percentage": 70,
    "human_percentage": 30
  },

  "geography": {
    "terrain": "Volcanic island with two great lakes",
    "climate": "Temperate due to warm ocean current",
    "atmosphere": "Thin - filter masks recommended outside settlements",
    "notable_features": [
      "Central Lake - largest, government center on shores",
      "Western Lake - agricultural region",
      "Mount Salbarii - southern volcanic peak, 1500m"
    ]
  },

  "settlements": [
    {
      "id": "central",
      "name": "Central",
      "type": "capital",
      "population": 600,
      "location": "Eastern shore of Central Lake",
      "description": "Seat of government, Dictator's residence, rail hub",
      "facilities": ["Government House", "Rail Depot", "Hospital", "School"],
      "rail_connections": ["startown", "salbarii", "lakeside"]
    },
    {
      "id": "startown",
      "name": "Startown",
      "type": "port-town",
      "population": 400,
      "location": "Adjacent to starport, northern coast",
      "description": "Commercial district serving the starport",
      "facilities": ["Starport", "Customs", "Frontier Inn", "Dusty Airlock Bar", "Rail Station"],
      "rail_connections": ["central"]
    },
    {
      "id": "salbarii",
      "name": "Salbarii",
      "type": "town",
      "population": 500,
      "location": "West shore of Western Lake, 20km north of volcano",
      "description": "Mining and farming community, Vargr quarter at south end",
      "facilities": ["Mining Office", "General Store", "Vargr Quarter", "Rail Station"],
      "rail_connections": ["central"],
      "evacuation_zone": true
    },
    {
      "id": "barvinn",
      "name": "Barvinn",
      "type": "hamlet",
      "population": 150,
      "location": "Coastal, south of Salbarii",
      "description": "Fishing hamlet, no rail connection, evacuation priority",
      "facilities": ["Fishing Dock", "Community Hall"],
      "rail_connections": [],
      "evacuation_zone": true
    },
    {
      "id": "lakeside",
      "name": "Lakeside",
      "type": "village",
      "population": 200,
      "location": "Western shore of Central Lake",
      "description": "Agricultural community, farms supply capital",
      "facilities": ["Grain Silos", "Market", "Rail Stop"],
      "rail_connections": ["central"]
    }
  ],

  "rail_network": {
    "operator": "Walston Rail (owned by Dictator Masterton)",
    "condition": "Poor - slow speeds only",
    "frequency": "One train per day on each line",
    "lines": [
      {
        "id": "northern-line",
        "name": "Northern Line",
        "route": ["startown", "central"],
        "travel_time": "2 hours",
        "description": "Main link from starport to capital"
      },
      {
        "id": "western-line",
        "name": "Western Line",
        "route": ["central", "lakeside", "salbarii"],
        "travel_time": "3 hours to Salbarii",
        "description": "Agricultural and mining communities"
      }
    ],
    "staff": "Minimal - overworked running one train per day"
  },

  "roads": {
    "quality": "Unpaved tracks, suitable for ATV",
    "main_routes": [
      "Startown to Central (parallels rail)",
      "Central to Salbarii (parallels rail)",
      "Salbarii to volcano base (rough track)",
      "Coastal road to Barvinn (poor condition)"
    ]
  },

  "agriculture": {
    "main_crops": ["Grain", "Vegetables"],
    "farming_regions": ["Lakeside plains", "Central Lake basin"],
    "fishing": "Coastal - Barvinn primary fishing village"
  },

  "points_of_interest": [
    {
      "id": "government-house",
      "name": "Government House",
      "location": "central",
      "description": "Dictator Masterton's residence and offices"
    },
    {
      "id": "ministry-building",
      "name": "Ministry Building",
      "location": "central",
      "description": "Minister Greener's office, handles offworld affairs"
    },
    {
      "id": "vargr-quarter",
      "name": "Old Vargr Quarter",
      "location": "salbarii",
      "description": "Traditional Vargr neighborhood, near volcano base"
    },
    {
      "id": "defunct-scout-base",
      "name": "Defunct Scout Base",
      "location": "Remote mountains",
      "description": "Abandoned 20 years ago during Fourth Frontier War"
    }
  ]
}
```

---

## Travel Times Matrix

| From | To | Rail | Road (ATV) |
|------|----|------|------------|
| Startown | Central | 2 hours | 3 hours |
| Central | Salbarii | 3 hours | 4 hours |
| Central | Lakeside | 1.5 hours | 2 hours |
| Salbarii | Volcano Base | N/A | 2 hours |
| Salbarii | Barvinn | N/A | 1 hour |

---

## Deliverables

| # | File | Description |
|---|------|-------------|
| D1 | `data/adventures/high-and-dry/geography/settlement-island.json` | Complete geography data |
| D2 | `src/geography-data.js` | Load and query geography |
| D3 | `data/adventures/high-and-dry/scenes/*.json` | Add `location` field linking to geography |
| D4 | Narrator integration | Inject travel times and location context |
| D5 | `tests/geography-data.test.js` | Test cases |

---

## Test Cases

```javascript
// TEST G.1: Geography data loads
const geo = loadGeography('high-and-dry', 'settlement-island');
assert.ok(geo);
assert.strictEqual(geo.population, 3000);

// TEST G.2: Settlements queryable
const central = geo.settlements.find(s => s.id === 'central');
assert.ok(central);
assert.strictEqual(central.type, 'capital');

// TEST G.3: Rail connections defined
assert.ok(central.rail_connections.includes('startown'));

// TEST G.4: Travel time calculable
const { getTravelTime } = require('../src/geography-data');
const time = getTravelTime('startown', 'central', 'rail');
assert.strictEqual(time, '2 hours');

// TEST G.5: Evacuation zones marked
const evac = geo.settlements.filter(s => s.evacuation_zone);
assert.ok(evac.length >= 2); // Salbarii and Barvinn
```

---

## Integration with Scenes

Update scene files to reference geography:

```json
// startown-investigation.json
{
  "location": {
    "settlement": "startown",
    "facilities_available": ["Frontier Inn", "Dusty Airlock Bar", "Rail Station"]
  }
}

// meeting-greener.json
{
  "location": {
    "settlement": "central",
    "building": "ministry-building"
  },
  "travel_from_startown": {
    "method": "rail",
    "time": "2 hours",
    "description": "The small electric train rattles along poorly-maintained tracks"
  }
}
```
