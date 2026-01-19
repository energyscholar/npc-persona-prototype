# Audit Plan: Menu Cleanup

**Status:** READY FOR GENERATOR
**Date:** 2026-01-17
**Scope:** Remove obsolete main menu options

---

## Summary

Remove 3 menu options no longer needed:
- Training Session (option 3)
- Quick Chat Legacy Mode (option 4)
- Red Team Validation (option 5)

Final menu will have 3 options:
1. Play High and Dry Adventure
2. Communicate with NPC (Test Mode)
3. Exit

---

## Deliverables

| # | File | Action |
|---|------|--------|
| D1 | `src/tui-menu.js` | Remove options 3, 4, 5 from MAIN_MENU_OPTIONS |
| D2 | `src/chat-tui.js` | Remove case handlers for 'training', 'quick-chat', 'red-team' |
| D3 | `src/chat-tui.js` | Remove imports: listScenarios, getScenario, initializeRedTeam, getCoverageSummary |
| D4 | `src/chat-tui.js` | Remove functions: runTrainingSession, runRedTeamMode |
| D5 | `src/chat-tui.js` | Remove legacy quick-chat flow (lines after case 'quick-chat') |
| D6 | `tests/tui-menu.test.js` | Update test to expect 3 menu options |

---

## Files to KEEP (not delete)

These modules may be used by other parts or future work:
- `src/training-scenarios.js` - Keep (may be used elsewhere)
- `src/red-team/` - Keep directory (may be used for automated tests)

Only remove the TUI entry points and handlers.

---

## Test Cases

### T1: Menu has exactly 3 options
```javascript
test('Main menu has 3 options', () => {
  const { MAIN_MENU_OPTIONS } = require('../src/tui-menu');
  assert.strictEqual(MAIN_MENU_OPTIONS.length, 3);
});
```

### T2: Menu options are adventure, npc-test, exit
```javascript
test('Menu actions are adventure, npc-test, exit', () => {
  const { MAIN_MENU_OPTIONS } = require('../src/tui-menu');
  const actions = MAIN_MENU_OPTIONS.map(o => o.action);
  assert.deepStrictEqual(actions, ['adventure', 'npc-test', 'exit']);
});
```

### T3: No training case handler in chat-tui
```javascript
test('No training handler in chat-tui', () => {
  const chatTuiCode = fs.readFileSync('src/chat-tui.js', 'utf8');
  assert.ok(!chatTuiCode.includes("case 'training':"), 'training case should be removed');
});
```

### T4: No red-team case handler in chat-tui
```javascript
test('No red-team handler in chat-tui', () => {
  const chatTuiCode = fs.readFileSync('src/chat-tui.js', 'utf8');
  assert.ok(!chatTuiCode.includes("case 'red-team':"), 'red-team case should be removed');
});
```

### T5: No quick-chat case handler in chat-tui
```javascript
test('No quick-chat handler in chat-tui', () => {
  const chatTuiCode = fs.readFileSync('src/chat-tui.js', 'utf8');
  assert.ok(!chatTuiCode.includes("case 'quick-chat':"), 'quick-chat case should be removed');
});
```

### T6: Keys are sequential 1, 2, 3
```javascript
test('Menu keys are 1, 2, 3', () => {
  const { MAIN_MENU_OPTIONS } = require('../src/tui-menu');
  const keys = MAIN_MENU_OPTIONS.map(o => o.key);
  assert.deepStrictEqual(keys, ['1', '2', '3']);
});
```

---

## Verification

```bash
node tests/menu-cleanup.test.js    # 6 tests
node tests/tui-menu.test.js        # Existing tests still pass
```

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing tests | Update tui-menu.test.js expectations |
| Orphaned imports | Grep for removed function names after cleanup |
| Lost functionality | Keep underlying modules, only remove TUI entry |
