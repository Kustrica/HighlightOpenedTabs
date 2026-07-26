# Project Overview

Firefox WebExtension: highlights already-open tabs when hovering links on a page, and briefly highlights duplicates when activating a tab / pasting a URL. Short-lived badge shows counts.

# Stack & Architecture

- Manifest V3, Firefox (min 142)
- `background.js` — URL normalization, duplicates, badge, multi-select flash, hover matching
- `content.js` — link hover (matches `<all_urls>`)
- `options.html` / `options.js` — settings + i18n
- Permissions: `tabs`, `storage`
- `host_permissions`: `["<all_urls>"]` (same as working pre-1.6 releases)
- `granted_host_permissions: true` — auto-ON for temporary (about:debugging) installs
- Storage: `showCounter`, `enableDuplicateHighlight`, `enableHoverHighlight`, `hoverDelay`, `unhighlightOnWindowLeave`, `duplicateAutoHideDelay`

# Constraints & Rules

- Firefox has no cosmetic per-tab color API; use multi-select `highlighted` briefly.
- No tab-strip hover API.
- Firefox Add-ons Manager still lists website access under “Optional” (browser UI). Do not add a grant/ask page — use `<all_urls>` + `granted_host_permissions` so access is on after install.
- Quiet `onUpdated` must not bump `requestId` (kills flash timers).
- Badge page pulse: `max(2000ms, duplicateAutoHideDelay)`; idle badge empty; hover badge = open copies of hovered URL.

# Glossary

- **Дубль** — другая вкладка с тем же нормализованным URL.
- **Вспышка** — краткое выделение дублей при переходе / вставке URL.
- **Hover** — подсветка при наведении на ссылку на странице.
