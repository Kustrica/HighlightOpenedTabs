# Project Overview

Firefox WebExtension that briefly highlights duplicate tabs when you activate a tab (or paste a URL) that is already open elsewhere, and shows a short-lived badge count.

# Stack & Architecture

- Manifest V3, Firefox (`browser_specific_settings.gecko`, min 142)
- `background.js` — URL normalization, duplicate detection, badge, tab multi-select flash
- `options.html` / `options.js` — settings UI + i18n
- Permissions: `tabs`, `storage` only — **no** `host_permissions`, **no** `content_scripts` (avoids optional “all websites” in Add-ons Manager)
- `content.js` kept in repo but unused (hover would require that permission again)
- Storage keys: `showCounter`, `enableDuplicateHighlight`, `duplicateAutoHideDelay`

# Constraints & Rules

- Firefox has no WebExtension API to color individual tabs; `highlighted` is multi-select only.
- Firefox does not expose tab-strip hover to extensions.
- Static `content_scripts` on http(s)/* always creates optional “Access your data for all websites” in Firefox MV3 — do not re-add unless product accepts that UI.
- Flash duration default is 200ms; page badge pulses for `max(2000ms, duplicateAutoHideDelay)`.
- Quiet `onUpdated` (loading/complete) must not bump `requestId` (would cancel flash timers).
- Duplicate matching uses `pendingUrl || url` and includes `about:` (except blank/newtab/home/…).

# Glossary

- **Дубль / duplicate** — другая вкладка с тем же нормализованным URL. Счётчик — импульс после перехода (мин. 2 с); в покое пусто.
- **Вспышка / flash** — краткое multi-select выделение дублей при активации вкладки / вставке URL.
