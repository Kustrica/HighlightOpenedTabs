if (typeof browser === "undefined") {
    var browser = chrome;
}

let hoverTimeout = null;
let pendingLinkUrl = null;
let activeHoverUrl = null;
let hoverDelay = 50;
let unhighlightOnWindowLeave = true;
let clearLock = false;

browser.storage.local.get({ hoverDelay: 50, unhighlightOnWindowLeave: true }).then(data => {
    hoverDelay = data.hoverDelay;
    unhighlightOnWindowLeave = data.unhighlightOnWindowLeave;
});

browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
        if (changes.hoverDelay) {
            hoverDelay = changes.hoverDelay.newValue;
        }
        if (changes.unhighlightOnWindowLeave) {
            unhighlightOnWindowLeave = changes.unhighlightOnWindowLeave.newValue;
        }
    }
});

browser.runtime.onMessage.addListener((message) => {
    if (message.action === "SETTINGS_UPDATED") {
        if (message.settings.hoverDelay !== undefined) hoverDelay = message.settings.hoverDelay;
        if (message.settings.unhighlightOnWindowLeave !== undefined) unhighlightOnWindowLeave = message.settings.unhighlightOnWindowLeave;
    }
});

function cancelHoverTimer() {
    if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
    }
    pendingLinkUrl = null;
}

function sendHoverStart(url) {
    browser.runtime.sendMessage({ action: "HOVER_LINK", url }).catch(() => {});
}

function sendHoverEnd() {
    browser.runtime.sendMessage({ action: "HOVER_END" }).catch(() => {});
}

function clearHighlights(action) {
    if (clearLock) return;
    clearLock = true;
    cancelHoverTimer();
    activeHoverUrl = null;
    browser.runtime.sendMessage({ action }).catch(() => {});
    setTimeout(() => {
        clearLock = false;
    }, 160);
}

function canProcessWindowExit() {
    if (document.visibilityState !== "visible") return false;
    if (!document.hasFocus()) return false;
    return true;
}

function getHttpLinkUrl(target) {
    if (!target || typeof target.closest !== "function") return null;
    const link = target.closest("a[href]");
    if (!link || !link.href) return null;
    if (!link.href.startsWith("http")) return null;
    return link.href;
}

function scheduleHover(url) {
    if (!url) return;
    if (url === activeHoverUrl) return;
    if (url === pendingLinkUrl && hoverTimeout) return;

    cancelHoverTimer();
    pendingLinkUrl = url;
    hoverTimeout = setTimeout(() => {
        hoverTimeout = null;
        if (pendingLinkUrl !== url) return;
        activeHoverUrl = url;
        pendingLinkUrl = null;
        sendHoverStart(url);
    }, hoverDelay);
}

function endHoverIfNeeded() {
    const hadPending = Boolean(hoverTimeout);
    const hadActive = Boolean(activeHoverUrl);
    cancelHoverTimer();
    if (!hadPending && !hadActive) return;
    activeHoverUrl = null;
    sendHoverEnd();
}

document.addEventListener("mousemove", (e) => {
    const url = getHttpLinkUrl(e.target);
    if (!url) {
        endHoverIfNeeded();
        return;
    }
    scheduleHover(url);
}, { passive: true, capture: true });

document.addEventListener("mouseleave", (e) => {
    if (!unhighlightOnWindowLeave) return;
    if (!canProcessWindowExit()) return;
    clearHighlights(e.clientY <= 0 ? "SUPPRESS_HIGHLIGHT_FOR_TAB" : "UNHIGHLIGHT_ALL");
}, { passive: true });

document.addEventListener("mouseout", (e) => {
    if (!unhighlightOnWindowLeave) return;
    if (!canProcessWindowExit()) return;
    if (!e.relatedTarget && !e.toElement) {
        const isOutsideViewport =
            e.clientX <= 0 ||
            e.clientY <= 0 ||
            e.clientX >= window.innerWidth ||
            e.clientY >= window.innerHeight;
        if (!isOutsideViewport) return;
        clearHighlights(e.clientY <= 0 ? "SUPPRESS_HIGHLIGHT_FOR_TAB" : "UNHIGHLIGHT_ALL");
    }
}, { passive: true, capture: true });
