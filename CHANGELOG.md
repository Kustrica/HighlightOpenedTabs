# Changelog

## 1.9.5

- Выбор языка на странице настроек (как в Workspaces): Auto (язык браузера) или вручную из 19 языков.
- Убран неработающий в Firefox `i18n.onLanguageChanged`.

## 1.9.4

- Исправлено: при установке больше не перезагружаются все открытые вкладки (убран `tabs.reload` на `permissions.onAdded`).
- После ручной выдачи доступа в настройках перезагружается только активная вкладка.

## 1.9.3

- Большая плашка «Выдать доступ» — вверху страницы, если доступ отключён (в т.ч. случайно в about:addons).
- Приглушённая плашка — только после явного «Без подсветки на страницах».
- Отказ в диалоге Firefox ≠ отказ от подсветки; снова показывается большая плашка.
- Язык настроек обновляется при возврате на вкладку (Firefox не поддерживает `i18n.onLanguageChanged`).

## 1.9.2

- `<all_urls>` → `*://*/*` (убран тумблер «локальные файлы» в FF 153).
- Badge `!`, авто-открытие настроек при установке без доступа, перезагрузка вкладок после выдачи разрешения.
- Баннер доступа в блоке подсветки ссылок, кнопка «Без подсветки на страницах».

## 1.7.2

- Restored working host access like earlier releases: `host_permissions` + `content_scripts` with `<all_urls>`.
- Removed the grant/ask page — no permission prompt from the extension.
- Kept `granted_host_permissions` so temporary installs start with site access ON.

## 1.7.1

- (superseded) grant-page approach — removed in 1.7.2.

## 1.7

- Restored link-hover with `content_scripts` + `host_permissions`.
