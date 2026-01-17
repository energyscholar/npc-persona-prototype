# TUI Improvements - Generator Instructions

**Sequence:** T4 → T1 → T2 → T3

## T4: Formatting Refactor
Extract hardcoded colors/widths in `src/chat-tui.js` to a `TUI_CONFIG` object at top of file with `boxWidth`, `indent`, and `colors` (prompt, npc, system, action, error).

## T1: /status Command
Add `/status` command to `src/chat-tui.js` displaying: World, NPC, PC, Date, Scene, Messages count, Disposition (with star rating). Use box drawing characters.

## T2: Action Notifications
In main chat loop, poll `getReportsForPc()` from `src/action-reports.js` after each turn. Display reports as `[CREW ACTION]`, `[NPC MESSAGE]`, `[TIMED]` lines before NPC response.

## T3: /actions Command
Add `/actions` command showing active timed actions with progress bars (████░░░░). Integrate with `getActiveTimedActions()` from `src/timed-actions.js`.

## Tests
Create `tests/chat-tui.test.js` covering `/status` output, `/actions` output, and action notification formatting.

## Integration Points
- `src/action-reports.js` — `getReportsForPc(pcId)`
- `src/timed-actions.js` — `getActiveTimedActions(worldId)`
- `src/disposition.js` — disposition display
- `src/plot-context.js` — scene/date info
