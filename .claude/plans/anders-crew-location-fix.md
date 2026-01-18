# Quick Fix: Anders Previous Crew Knowledge

**Status:** READY FOR GENERATOR
**Priority:** HIGH - Plot-breaking error

---

## Problem

Anders says: "caught commercial transport to Flammarion where they were arrested"

**WRONG.** The adventure establishes:
- Previous crew left Walston on **Maverick Spacer**
- Headed to **Caladbolg via Datrillian**
- Their current status is unknown to Anders

---

## What Anders Actually Knows

As a Flammarion-based administrator, Anders knows:
1. The previous crew's lease was voided
2. Ship records showed fraud (refit scam documented)
3. The ship is abandoned on Walston
4. The crew departed Walston (per Scout Service reports)

**Anders does NOT know:**
- Where crew went after leaving Walston
- Whether they've been arrested
- Anything about Caladbolg jurisdiction

---

## Fix

**File:** `data/npcs/mr-casarii.json`

```json
"the_previous_crew": "The previous operators' lease was voided after ship records revealed fraud - they'd bribed a dockyard to install breaker-yard parts and sold the original IISS components. *shakes head* The documentation is thorough. They abandoned Highndry on Walston and departed via commercial transport. Where they are now? Not my department - that's a matter for law enforcement, wherever they ended up. Our concern is the ship, and getting her back in service."
```

Also update `knowledge_limits`:
```json
"does_not_know": [
  "Exact location of Highndry on Walston",
  "Mount Salbarii connection",
  "Where previous crew went after leaving Walston",
  "Whether previous crew has been arrested",
  "Caladbolg or Datrillian (never heard of them)"
]
```

---

## Add Red Team Query

```json
{
  "id": "Q_BOUNDARY_004",
  "tier": 1,
  "fact_id": "FACT_BOUNDARY_004",
  "target_npcs": ["mr-casarii"],
  "query": "Where are the previous crew now? Were they arrested?",
  "expected_keywords": ["don't know", "not my department", "law enforcement", "wherever they ended up"],
  "failure_keywords": ["Flammarion", "arrested here", "in custody", "jail"]
}
```

---

## Verification

```bash
npm run redteam mr-casarii
```
