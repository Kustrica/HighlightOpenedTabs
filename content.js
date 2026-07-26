if (typeof browser === "undefined") {
    var browser = chrome;
}

let hoverTimeout = null;
let pendingLinkUrl = null;
let activeHoverUrl = null;
let hoverDelay = 10;
let unhighlightOnWindowLeave = true;
let enableHoverHighlight = true;
let showCounter = true;
let clearLock = false;

browser.storage.local.get({
    hoverDelay: 10,
    unhighlightOnWindowLeave: true,
    enableHoverHighlight: true,
    showCounter: true
}).then(data => {
    hoverDelay = Math.max(1, Number.isFinite(data.hoverDelay) ? data.hoverDelay : 10);
    unhighlightOnWindowLeave = data.unhighlightOnWindowLeave;
    enableHoverHighlight = data.enableHoverHighlight !== false;
    showCounter = data.showCounter !== false;
});

function hoverTrackingEnabled() {
    return enableHoverHighlight || showCounter;
}

browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.hoverDelay) {
        hoverDelay = Math.max(1, Number(changes.hoverDelay.newValue) || 10);
    }
    if (changes.unhighlightOnWindowLeave) {
        unhighlightOnWindowLeave = changes.unhighlightOnWindowLeave.newValue;
    }
    if (changes.enableHoverHighlight) {
        enableHoverHighlight = changes.enableHoverHighlight.newValue !== false;
        if (!hoverTrackingEnabled()) {
            endHoverIfNeeded();
        }
    }
    if (changes.showCounter) {
        showCounter = changes.showCounter.newValue !== false;
        if (!hoverTrackingEnabled()) {
            endHoverIfNeeded();
        }
    }
});

browser.runtime.onMessage.addListener((message) => {
    if (message.action === "SETTINGS_UPDATED") {
        if (message.settings.hoverDelay !== undefined) {
            hoverDelay = Math.max(1, Number(message.settings.hoverDelay) || 10);
        }
        if (message.settings.unhighlightOnWindowLeave !== undefined) {
            unhighlightOnWindowLeave = message.settings.unhighlightOnWindowLeave;
        }
        if (message.settings.enableHoverHighlight !== undefined) {
            enableHoverHighlight = message.settings.enableHoverHighlight !== false;
        }
        if (message.settings.showCounter !== undefined) {
            showCounter = message.settings.showCounter !== false;
        }
        if (!hoverTrackingEnabled()) {
            endHoverIfNeeded();
        }
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

function getHttpLinkUrl(target) {
    if (!target || typeof target.closest !== "function") return null;
    const link = target.closest("a[href]");
    if (!link || !link.href) return null;
    if (!link.href.startsWith("http")) return null;
    return link.href;
}

function scheduleHover(url) {
    if (!hoverTrackingEnabled()) return;
    if (!url) return;
    if (url === activeHoverUrl) return;
    if (url === pendingLinkUrl && hoverTimeout) return;

    cancelHoverTimer();
    pendingLinkUrl = url;
    hoverTimeout = setTimeout(() => {
        hoverTimeout = null;
        if (!hoverTrackingEnabled()) return;
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
    if (!hoverTrackingEnabled()) {
        endHoverIfNeeded();
        return;
    }
    const url = getHttpLinkUrl(e.target);
    if (!url) {
        endHoverIfNeeded();
        return;
    }
    scheduleHover(url);
}, { passive: true, capture: true });

document.addEventListener("mouseleave", (e) => {
    if (!unhighlightOnWindowLeave) return;
    const isOutsideViewport =
        e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight;
    if (!isOutsideViewport) return;
    clearHighlights(e.clientY <= 0 ? "SUPPRESS_HIGHLIGHT_FOR_TAB" : "UNHIGHLIGHT_ALL");
}, { passive: true });

document.addEventListener("mouseout", (e) => {
    if (!unhighlightOnWindowLeave) return;
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
