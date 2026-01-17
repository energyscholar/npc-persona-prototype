# SAFE PDF EXTRACTION PROTOCOL

**Created:** 2025-01-17
**Lesson learned:** Direct PDF reads crash Claude (5.1MB+ causes API 400 errors)

## SAFE APPROACH

1. **NEVER use Read tool on large PDFs directly** - causes "Could not process PDF" crash
2. **USE pdftotext CLI** - extract to text file first:
   ```bash
   pdftotext -layout "source.pdf" "/scratchpad/output.txt"
   ```
3. **Process text file** - grep/read as needed
4. **For images/maps** - use pdfimages CLI or manual extraction
5. **Background task with timeout** - for risky operations, use Task agent with kill option

## KNOWN LIMITATIONS

- pdftotext extracts only text, not images/maps/diagrams
- Layout may be imperfect for complex multi-column pages
- Tables may need reformatting

## VISUAL ELEMENTS REQUIRE MANUAL EXTRACTION

For PDFs with maps/diagrams, these must be extracted separately:
```bash
# Extract all images from PDF
pdfimages -all "source.pdf" "/scratchpad/images/prefix"

# Convert specific pages to PNG
pdftoppm -png -f 1 -l 1 "source.pdf" "/scratchpad/page"
```

---

# HIGH AND DRY - ENHANCED EXTRACTION

## Table of Contents (from PDF)
| Section | Page |
|---------|------|
| Introduction | 2 |
| The Bowman Arm | 4 |
| The World of Walston | 6 |
| Flammarion to Walston | 13 |
| Walston Star Town | 18 |
| Central Lake | 20 |
| Mount Salbarii | 23 |
| In the Crater | 27 |
| Eruption! | 31 |
| Fighting Mount Salbarii Part One | 33 |
| Fighting Mount Salbarii Part Two | 36 |
| Aftermath: As the Dust Settles | 42 |

## CRITICAL DETAIL PREVIOUSLY MISSED

### Walston Customs & Weapons Detection
**Source:** PDF text line 848-860

```
To enter the town, it is necessary to pass through customs. Although the locals
have a sustainable TL8, they have an imported weapon scanner and can detect
most weapons. Local laws prohibit private ownership of most weaponry. Any guns
or blades longer than a dagger must be placed in storage at the port for a fee
of Cr10 per week. The guards at the port carry handguns and wear light flak
jackets. They do not see a lot of trouble and would probably be caught by
surprise if someone did something stupid like trying to shoot their way through
customs. A response team equipped with assault rifles would respond in fairly
short order to such an incident.
```

**Key Facts:**
- Local TL: 8 (sustainable)
- Weapon scanner: **Imported** (higher TL)
- Detection: "most weapons" (NOT all - smuggling gap exists)
- Guards: Handguns, light flak jackets
- Guards are **complacent** ("don't see a lot of trouble")
- Response team: Assault rifles available
- Storage fee: Cr10/week
- Blade limit: Dagger or shorter allowed

**Smuggling Assessment:** Difficult but NOT impossible. Scanner detects "most" not "all" weapons. Guards are not vigilant.

### Scout Base Status
**Source:** PDF text line 493-500

```
Current maps of the region show a scout base present at Walston. This is,
strictly speaking, inaccurate. There was a scout installation there about
20 years ago, and it has never been removed from the maps as the IISS has
always planned to follow up the work done...
```

**Key Fact:** Scout base is **defunct** - closed 20 years ago but still on maps

### Highndry (Scout/Courier S001642-C)
**Source:** PDF text lines 528-620

- Official designation: IISS S001642-C
- Built: 892 in Gushemege sector
- Status: Control electronics **shot**, drives useless
- Location: Crater of extinct volcano on Walston
- Condition: Worn, torn upholstery, knocked corners, ragged edges
- Repair needed: "Couple briefcases of equipment" for temporary fix
- Previous crew: Fraudulent refit, stripped and sold IISS components

### Mount Salbarii
**Source:** PDF text lines 1103-1150

- Location: Southern Settlement Island, ~20km from town of Salbarii
- Height: ~1,500 metres above sea level
- Status: Thought extinct for millennia, showing "twitch" activity
- Survey result: 99%+ certain no danger (but more monitoring advised)
- Highndry location: Parked in crater

### Walston Geography
- Settlement Island: Main inhabited area
- Warm current creates fertile zone
- Mount Salbarii traps rainfall, feeds two great lakes
- Walston-Main: Large, cold, uninviting continent
- Walston-Antipodes: Southern hemisphere, Antarctic ice shelf

## VISUAL ELEMENTS NEEDING EXTRACTION

Based on text references, these maps/images exist in PDF:
1. **Partial Map of Sword Worlds Subsector and District 268** (p.4 area)
2. **Walston System/World Map** (p.6 area)
3. **Settlement Island Map** (p.18 area)
4. **Mount Salbarii climbing route/terrain** (p.23+ area)
5. **Crater/Highndry location** (p.27 area)
6. **Scout/Courier deck plans** (referenced as standard Type-S)

## EXTRACTION COMMANDS

```bash
# Already done: text extraction
pdftotext -layout "/home/bruce/software/traveller-VTT-private/reference/adventures/MgT 2E - Marches Adventure 1 High and Dry.pdf" "high-and-dry-full.txt"

# For maps (manual task):
pdfimages -all "/home/bruce/software/traveller-VTT-private/reference/adventures/MgT 2E - Marches Adventure 1 High and Dry.pdf" "images/had-"

# For specific page renders:
pdftoppm -png -r 150 -f 4 -l 4 "source.pdf" "map-page"
```

## NPC IMPLICATIONS

For customs officer NPC:
- KNOWS about imported scanner capabilities
- KNOWS it catches "most" weapons (professional awareness of limitations)
- DOESN'T expect trouble (complacent attitude)
- Quick to defer to response team for real incidents

For smuggler scenarios:
- Scanner is good but not perfect
- Concealed weapons might pass
- Guards are not suspicious by default
- Best approach: don't try to smuggle obvious weapons
