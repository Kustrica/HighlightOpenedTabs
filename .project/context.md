# Project Overview

Firefox WebExtension: highlights already-open tabs when hovering links on a page, and briefly highlights duplicates when activating a tab / pasting a URL. Short-lived badge shows counts.

# Stack & Architecture

- Manifest V3, Firefox (min 142)
- `background.js` — URL normalization, duplicates, badge, multi-select flash, hover matching
- `content.js` — link hover on http(s) pages
- `options.html` / `options.js` — settings + i18n
- Permissions: `tabs`, `storage`
- **Required** `host_permissions`: `http://*/*`, `https://*/*` (needed for hover; declare as host_permissions so install grants them — not optional_host_permissions)
- Storage: `showCounter`, `enableDuplicateHighlight`, `enableHoverHighlight`, `hoverDelay`, `unhighlightOnWindowLeave`, `duplicateAutoHideDelay`

# Constraints & Rules

- Firefox has no cosmetic per-tab color API; use multi-select `highlighted` briefly.
- No tab-strip hover API.
- Do not put site access only in `optional_host_permissions` — that makes the main feature look optional/off.
- Quiet `onUpdated` must not bump `requestId` (kills flash timers).
- Badge page pulse: `max(2000ms, duplicateAutoHideDelay)`; idle badge empty; hover badge = open copies of hovered URL.

# Glossary

- **Дубль** — другая вкладка с тем же нормализованным URL.
- **Вспышка** — краткое выделение дублей при переходе / вставке URL.
- **Hover** — подсветка при наведении на ссылку на странице.
