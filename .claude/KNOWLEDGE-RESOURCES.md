# Knowledge Resources for NPC Personas

## Traveller Universe Data Sources

### 1. Wiki Cache (Traveller Encyclopedia)

**Location:** `/home/bruce/software/traveller-starship-operations-vtt/data/wiki-cache/`

**Contents:**
- 432 systems from the Spinward Marches
- Full wiki articles with UWP data, history, demographics, etc.
- Indexed for O(1) lookup by hex, name, or slug

**Structure:**
```
data/wiki-cache/
├── index.json              # 281KB index with byHex, byName, bySlug lookups
└── systems/
    ├── 1232.json          # Walston (65KB+ of content)
    ├── 1910.json          # Regina
    └── ... (432 total)
```

**Access Module:** `/home/bruce/software/traveller-starship-operations-vtt/lib/wiki-cache.js`

**API:**
```javascript
const wikiCache = require('./wiki-cache');

wikiCache.getByHex('1232');       // Walston by hex
wikiCache.getByName('Walston');   // Walston by name
wikiCache.getTextContent('1232'); // Plain text content
wikiCache.getRawHtml('1232');     // Full HTML
```

**Data per system:**
- `hex` - Hex coordinate (e.g., "1232")
- `name` - System name
- `slug` - URL-friendly name
- `wikiUrl` - Source URL
- `rawHtml` - Full wiki page HTML
- `textContent` - Plain text extraction
- `hasContent` - Boolean

---

### 2. TravellerMap Cache (Planned)

**Planned Location:** `/home/bruce/software/traveller-VTT-private/data/travellermap-cache/`

**Plan Document:** `/home/bruce/software/traveller-VTT-private/.claude/plans/travellermap-cache-plan.md`

**Would contain:**
- UWP data from TravellerMap API
- Sector/subsector metadata
- Jump neighborhoods
- Route calculations

---

## Usage in NPC Personas

NPCs should have access to:

1. **World Knowledge** — Any educated NPC knows basic facts about worlds they've visited or heard of
2. **Current Location** — Deep knowledge of the world they're currently on
3. **UWP Interpretation** — Can explain what starport class, population, tech level mean
4. **Current Date** — From story state `gameDate` field
5. **Recent Events** — From story beats and flags

### Integration Points

| Data | Source | Injection Point |
|------|--------|-----------------|
| World facts | wiki-cache | `buildExtendedContext()` |
| Current date | storyState.gameDate | `buildPlotContext()` |
| Local knowledge | NPC knowledge_base | `buildSystemPrompt()` |

---

## Future: Knowledge Injection Strategy

1. **Static Knowledge Layer** — Baked into NPC JSON as `knowledge_base`
2. **Dynamic World Layer** — Injected from wiki-cache based on NPC's `world` field
3. **Story Layer** — Injected from storyState (current date, beats, flags)

See: `.claude/plans/gap-features-implementation.md` for integration architecture.
