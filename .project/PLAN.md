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
- [x] manifest version bumped with releases
- [x] `.project/context.md` and this plan

## STEP-05 — Site access on by default (no ask UI)
- [x] Restore `<all_urls>` in `host_permissions` + `content_scripts` (as in working commits before 1.6)
- [x] `granted_host_permissions: true` for temporary installs
- [x] Remove grant.html / permission-request UX
- [x] Note: Add-ons Manager may still label site access “Optional” (Firefox UI)

## STEP-06 — Early duplicate match (loading / unloaded tabs)
- [x] Prefer `pendingUrl` then `url` for matching
- [x] Refresh on create / url / loading / discarded, not only `complete`

## STEP-07 — On-page link highlight (combinable styles)
- [x] Styles: card frame, link underline, soft glow (combinable); dot removed
- [x] Defaults: glow on, card off; underline uses per-line Range rects
- [x] Scroll: rAF reposition via transform3d (no DOM rebuild on scroll)
- [x] Scope: hidden copies only (default) or always when duplicate exists
- [x] Tab-bar multi-select unchanged; on-page highlight is additive
- [x] Smart card detection (Google `.g`, YouTube, articles) — full card rect, underline on link text only
- [x] Options page reorganized + i18n (en, ru full; other locales synced)

