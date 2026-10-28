# Changelog

1.9.5
- Interface language selector on the Options page (as in Workspaces): Auto (browser language) or any of the 19 languages.
- Removed `i18n.onLanguageChanged`, which does not work in Firefox.

1.9.4
- Fixed: installing the extension no longer reloads all open tabs (removed `tabs.reload` on `permissions.onAdded`).
- After access is granted manually in Options, only the active tab is reloaded.

1.9.3
- A large "Allow access" banner at the top of Options when site access is off (including when it was turned off by accident in about:addons).
- A muted banner is shown only after an explicit "No highlighting on pages" choice.
- Declining the Firefox permission dialog no longer counts as opting out of highlighting; the large banner is shown again.
- The Options language is updated when you return to the tab (Firefox does not support `i18n.onLanguageChanged`).

1.9.2
- Host permissions changed from `<all_urls>` to `*://*/*` (removes the "local files" toggle in Firefox 153).
- "!" badge on the icon, Options open automatically when installed without site access, and tabs are reloaded after the permission is granted.
- Access banner in the link highlighting section and a "No highlighting on pages" button.

1.9.1
- Customizable on-page link highlight: card frame, link underline and soft glow (combine any), with color, border width, line thickness, glow strength and ring width settings.
- Choose when the on-page highlight is shown: only when copies are hidden, or whenever a duplicate exists (default).
- Reworked Options page with grouped sections: tab selection, on-page link highlight and the duplicate count on the icon.
- Removed `granted_host_permissions` from the manifest.

1.7.2
- Restored working host access like earlier releases: `host_permissions` + `content_scripts` with `<all_urls>`.
- Removed the grant/ask page – no permission prompt from the extension.
- Kept `granted_host_permissions` so temporary installs start with site access on.

1.7.1
- (superseded) Grant-page approach – removed in 1.7.2.

1.7
- Restored link hover with `content_scripts` + `host_permissions` for http/https: access to websites is required for the main feature.

1.6.1
- New settings to turn duplicate highlighting on or off and to show a counter on the icon.
- Improved hover responsiveness and hover tracking.
- Adjusted the default auto-hide delay for duplicate highlights.
- Clearer texts in all languages.

1.2
- Auto-hide delay setting for duplicate tab highlights (0 turns it off), default 2 seconds.
- Clearer label for the "remove highlight when leaving the window" option.
- Better duplicate detection: addresses are normalized and tracking parameters are ignored.
- Fixed conflicts between link hover and duplicate highlighting, and edge cases when the cursor leaves the window.
- Duplicate highlights come back after a link hover ends.
- Clicking the toolbar icon opens the Options page; fixed the toolbar icon.

1.1
- Fixed highlights being cleared by accident when switching tabs; old highlights are cleared before new duplicates are highlighted.
- Fixed the GitHub link on the Options page.
- Higher-resolution 200 px icon and an updated add-on ID.

1.0
- First release: highlights tabs that are already open when you hover a link, and highlights duplicate tabs when you open a tab.
- Options: duplicate counter, hover delay, and removing highlights when the cursor leaves the window.
- Localized interface.
