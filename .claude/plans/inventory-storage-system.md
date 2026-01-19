# Plan: Inventory Storage System

**Status:** READY FOR REVIEW
**Date:** 2026-01-17
**Scope:** Item storage with object permanence and availability tracking

---

## Summary

Items can be stored at locations (e.g., customs locker). Stored items:
- Remain in inventory (object permanence)
- Are marked unavailable until retrieved
- Track where they are stored
- Can be retrieved later

---

## Data Model

### Stored Item Fields

When an item is stored, these fields are added:

```javascript
{
  id: 'autopistol-standard',
  name: 'Autopistol',
  type: 'weapon',
  // ... existing fields preserved ...

  // Storage fields (added when stored, removed when retrieved):
  stored_at: {
    location_id: 'starport-customs',
    location_name: 'Walston Starport Customs Locker',
    timestamp: '2026-01-17T10:30:00Z',
    claim_ticket: 'WSC-4721'  // optional, for narrative flavor
  }
}
```

### Availability Rule

**Item is available if and only if `stored_at` is undefined.**

No separate `available` flag needed - presence of `stored_at` implies unavailable.

---

## Function Specifications

### `storeItem(session, itemId, locationData)`

```javascript
// locationData = { location_id, location_name, claim_ticket? }
// Returns: { success: boolean, item?: object, error?: string }
```

**Behavior:**
1. Find item in inventory by id
2. If not found → return `{ success: false, error: 'Item not found' }`
3. If already stored → return `{ success: false, error: 'Item already stored' }`
4. Add `stored_at` object with location and timestamp
5. Return `{ success: true, item: updatedItem }`

### `retrieveItem(session, itemId)`

```javascript
// Returns: { success: boolean, item?: object, error?: string }
```

**Behavior:**
1. Find item in inventory by id
2. If not found → return `{ success: false, error: 'Item not found' }`
3. If not stored → return `{ success: false, error: 'Item not stored anywhere' }`
4. Delete `stored_at` field
5. Return `{ success: true, item: updatedItem }`

### `isItemAvailable(session, itemId)`

```javascript
// Returns: boolean
```

**Behavior:**
- Return `true` if item exists AND has no `stored_at` field
- Return `false` otherwise

### `getStoredItems(session)`

```javascript
// Returns: Array of items that have stored_at set
```

### `getItemsAtLocation(session, locationId)`

```javascript
// Returns: Array of items stored at specific location
```

### `getAvailableItems(session)`

```javascript
// Returns: Array of items without stored_at (carried items)
```

### `describeStoredItem(item)`

```javascript
// Returns: string like "Autopistol (stored at Walston Starport Customs Locker)"
```

For inventory display, shows where unavailable items are.

---

## Integration with Existing Functions

### `hasItem(session, itemId)` - NO CHANGE
Returns true if item is in inventory, regardless of storage status.
Object permanence: you "have" it even if stored elsewhere.

### `getIllegalItems(session, lawLevel)` - MODIFY
Only returns items that are:
- type === 'weapon'
- legal_at_law_level < lawLevel
- **AND not stored** (no `stored_at` field)

Rationale: Stored weapons aren't being carried, so they're not illegal to have on-world.

### `describeInventory(session)` - MODIFY
Show stored items separately with their locations:
```
Carried:
- Combat Blade
- Personal Medkit

Stored:
- Autopistol (Walston Starport Customs - ticket WSC-4721)
```

---

## Test Cases

```javascript
// S.1: storeItem adds stored_at with correct structure
// S.2: storeItem fails gracefully for non-existent item
// S.3: storeItem fails if item already stored
// S.4: retrieveItem removes stored_at field
// S.5: retrieveItem fails gracefully for non-existent item
// S.6: retrieveItem fails if item not stored
// S.7: isItemAvailable returns false for stored items
// S.8: isItemAvailable returns true for carried items
// S.9: getStoredItems returns only items with stored_at
// S.10: getAvailableItems returns only items without stored_at
// S.11: getItemsAtLocation filters by location_id
// S.12: getIllegalItems excludes stored weapons
// S.13: hasItem returns true for stored items (object permanence)
// S.14: describeInventory shows stored items with locations
```

---

## Narrative Integration

When weapons are checked at customs:

```javascript
storeItem(session, 'autopistol-standard', {
  location_id: 'starport-customs',
  location_name: 'Walston Starport Customs Locker',
  claim_ticket: 'WSC-4721'
});
```

Narrative output:
> "You hand over the autopistol. The officer tags it, locks it in the customs locker, and hands you a claim ticket: WSC-4721. 'Pick it up when you leave,' she says."

On departure, if `weapons_checked_at_starport` flag is set:
> "Your autopistol is still at customs (Locker WSC-4721). Retrieve it before departure?"

---

## Files to Modify/Create

| File | Action |
|------|--------|
| `src/inventory.js` | Add storage functions, modify getIllegalItems, modify describeInventory |
| `tests/inventory-storage.test.js` | New test file for storage system |

---

## Verification

```bash
npm test -- tests/inventory-storage.test.js
```

All 14 tests (S.1-S.14) must pass.
