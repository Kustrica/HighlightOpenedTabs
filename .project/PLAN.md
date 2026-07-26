# Project Plan — Highlight Opened Tabs

## STEP-01 — Badge shows duplicate count only
- [x] Show `matchedTabs.length - 1` on action badge
- [x] Hide badge when count is 0 or `showCounter` is off

## STEP-02 — Safe flash highlight on tab activate
- Flash duration default is 200ms (`duplicateAutoHideDelay`)
- Hover delay default is 10ms, minimum 1ms
- Clear multi-select via `tabs.highlight` to active tab only
- Gate with `enableDuplicateHighlight`

## STEP-03 — Settings and hover gate
- [x] Toggles: counter, duplicate highlight, link-hover highlight
- [x] Flash slider step 50, range 0–5000, default 200
- [x] Hover delay min 1, default 10
- [x] `enableHoverHighlight` respected in content + background
- [x] User-facing copy localized for all supported languages (no API-limit notes in UI)

## STEP-04 — Docs and version
- [x] manifest version 1.5
- [x] No host permissions / content scripts (permission page clean; link-hover removed)
- [x] `.project/context.md` and this plan

## STEP-06 — Early duplicate match (loading / unloaded tabs)
- [x] Prefer `pendingUrl` then `url` for matching
- [x] Refresh on create / url / loading / discarded, not only `complete`

