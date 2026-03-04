if (typeof browser === "undefined") {
    var browser = chrome;
}

const state = {
    mode: "duplicates",
    highlightedTabIds: new Set(),
    hoverSourceTabId: null,
    restoreDuplicatesOnHoverEnd: false,
    requestId: 0
};

const suppressedSourceTabs = new Map();
let refreshTimer = null;
let duplicateAutoHideTimer = null;
let duplicateAutoHideDelay = 2000;

browser.storage.local.get({ duplicateAutoHideDelay: 2000 }).then(data => {
    duplicateAutoHideDelay = Number.isFinite(data.duplicateAutoHideDelay) ? data.duplicateAutoHideDelay : 2000;
});

function cancelDuplicateAutoHide() {
    if (duplicateAutoHideTimer) {
        clearTimeout(duplicateAutoHideTimer);
        duplicateAutoHideTimer = null;
    }
}

function scheduleDuplicateAutoHide(requestId) {
    cancelDuplicateAutoHide();
    if (!duplicateAutoHideDelay || duplicateAutoHideDelay <= 0) return;
    duplicateAutoHideTimer = setTimeout(async () => {
        if (state.mode !== "duplicates") return;
        if (requestId !== state.requestId) return;
        await syncHighlights([]);
    }, duplicateAutoHideDelay);
}

function getNormalizedUrlKey(urlStr) {
    try {
        const url = new URL(urlStr);
        if (!url.protocol.startsWith("http")) return null;

        const hostname = url.hostname.toLowerCase();

        if (hostname.includes("youtube.com") || hostname === "youtu.be") {
            if (hostname === "youtu.be") {
                const shortId = url.pathname.split("/").filter(Boolean)[0];
                if (shortId) return `youtube.com/watch?v=${shortId}`;
            }
            if (url.pathname === "/watch") {
                const v = url.searchParams.get("v");
                if (v) return `youtube.com/watch?v=${v}`;
            }
            if (url.pathname.startsWith("/shorts/")) {
                const id = url.pathname.split("/")[2];
                if (id) return `youtube.com/shorts/${id}`;
            }
        }

        const normalizedHost = hostname.replace(/^www\./, "");
        const port = url.port ? `:${url.port}` : "";
        let pathname = url.pathname;

        try {
            pathname = decodeURIComponent(pathname);
        } catch (_) {}

        if (pathname.endsWith("/") && pathname.length > 1) {
            pathname = pathname.slice(0, -1);
        }

        const trackingParamPattern = /^(utm_.+|fbclid|gclid|yclid|mc_cid|mc_eid)$/i;
        const params = [];
        url.searchParams.forEach((value, key) => {
            if (trackingParamPattern.test(key)) return;
            params.push([key, value]);
        });

        params.sort(([aKey, aValue], [bKey, bValue]) => {
            if (aKey !== bKey) return aKey.localeCompare(bKey);
            return aValue.localeCompare(bValue);
        });

        const query = params
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join("&");

        return `${normalizedHost}${port}${pathname}${query ? `?${query}` : ""}`;
    } catch (_) {
        return null;
    }
}

async function getActiveTab() {
    const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
    return activeTabs.length > 0 ? activeTabs[0] : null;
}

async function setBadge(tabId, count) {
    const { showCounter } = await browser.storage.local.get({ showCounter: true });
    if (!showCounter || !count) {
        await browser.action.setBadgeText({ text: "", tabId });
        return;
    }

    await browser.action.setBadgeText({ text: String(count), tabId });
    await browser.action.setBadgeBackgroundColor({ color: "#FF4444", tabId });
}

async function clearBadgeOnActiveTab() {
    const activeTab = await getActiveTab();
    if (activeTab) {
        await browser.action.setBadgeText({ text: "", tabId: activeTab.id });
    }
}

async function syncHighlights(nextTabIds) {
    const nextSet = new Set(nextTabIds);
    const previousSet = state.highlightedTabIds;

    for (const tabId of previousSet) {
        if (!nextSet.has(tabId)) {
            browser.tabs.update(tabId, { highlighted: false }).catch(() => {});
        }
    }

    for (const tabId of nextSet) {
        if (!previousSet.has(tabId)) {
            browser.tabs.update(tabId, { active: false, highlighted: true }).catch(() => {});
        }
    }

    state.highlightedTabIds = nextSet;
}

function scheduleDuplicateRefresh(delay = 120) {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
        if (state.mode === "hover") return;
        showDuplicatesForActiveTab();
    }, delay);
}

async function showDuplicatesForActiveTab() {
    const requestId = ++state.requestId;
    state.mode = "duplicates";
    state.hoverSourceTabId = null;
    state.restoreDuplicatesOnHoverEnd = false;

    const activeTab = await getActiveTab();
    if (!activeTab) return;

    const activeKey = getNormalizedUrlKey(activeTab.url || "");
    if (!activeKey) {
        if (activeTab.status === "loading") {
            scheduleDuplicateRefresh(180);
            return;
        }
        if (requestId !== state.requestId) return;
        cancelDuplicateAutoHide();
        await syncHighlights([]);
        await browser.action.setBadgeText({ text: "", tabId: activeTab.id });
        return;
    }

    const tabs = await browser.tabs.query({});
    if (requestId !== state.requestId) return;

    const matchedTabs = tabs.filter(tab => getNormalizedUrlKey(tab.url || "") === activeKey);
    const highlightIds = matchedTabs
        .filter(tab => tab.id !== activeTab.id)
        .map(tab => tab.id);

    await syncHighlights(highlightIds);
    if (requestId !== state.requestId) return;

    await setBadge(activeTab.id, matchedTabs.length);
    if (highlightIds.length > 0) {
        scheduleDuplicateAutoHide(requestId);
    } else {
        cancelDuplicateAutoHide();
    }
}

async function showHoverMatches(sourceTabId, hoveredUrl) {
    if (!sourceTabId || !hoveredUrl) {
        return { count: 0, tabIds: [] };
    }

    const suppressedUntil = suppressedSourceTabs.get(sourceTabId);
    if (suppressedUntil && suppressedUntil > Date.now()) {
        return { count: 0, tabIds: [] };
    }
    suppressedSourceTabs.delete(sourceTabId);

    const hoveredKey = getNormalizedUrlKey(hoveredUrl);
    if (!hoveredKey) {
        return { count: 0, tabIds: [] };
    }
    cancelDuplicateAutoHide();

    const sourceTab = await browser.tabs.get(sourceTabId).catch(() => null);
    const sourceKey = sourceTab ? getNormalizedUrlKey(sourceTab.url || "") : null;
    if (sourceKey && sourceKey === hoveredKey) {
        await showDuplicatesForActiveTab();
        const tabIds = Array.from(state.highlightedTabIds);
        return { count: tabIds.length, tabIds };
    }

    const requestId = ++state.requestId;
    state.mode = "hover";
    state.hoverSourceTabId = sourceTabId;
    state.restoreDuplicatesOnHoverEnd = state.highlightedTabIds.size > 0;

    const tabs = await browser.tabs.query({});
    if (requestId !== state.requestId) {
        return { count: 0, tabIds: [] };
    }

    const matchedTabs = tabs.filter(tab => {
        if (tab.id === sourceTabId) return false;
        return getNormalizedUrlKey(tab.url || "") === hoveredKey;
    });

    const highlightIds = matchedTabs.map(tab => tab.id);
    await syncHighlights(highlightIds);

    return { count: matchedTabs.length, tabIds: highlightIds };
}

async function endHoverMode(sourceTabId) {
    if (state.mode !== "hover") return;
    if (sourceTabId && state.hoverSourceTabId && sourceTabId !== state.hoverSourceTabId) return;

    const shouldRestoreDuplicates = state.restoreDuplicatesOnHoverEnd;
    state.mode = "duplicates";
    state.hoverSourceTabId = null;
    state.restoreDuplicatesOnHoverEnd = false;

    if (shouldRestoreDuplicates) {
        scheduleDuplicateRefresh(0);
        return;
    }

    await syncHighlights([]);
}

async function clearAllVisuals() {
    state.requestId++;
    state.mode = "none";
    state.hoverSourceTabId = null;
    cancelDuplicateAutoHide();
    await syncHighlights([]);
    await clearBadgeOnActiveTab();
}

browser.tabs.onActivated.addListener(activeInfo => {
    suppressedSourceTabs.delete(activeInfo.tabId);
    state.mode = "duplicates";
    state.hoverSourceTabId = null;
    state.restoreDuplicatesOnHoverEnd = false;
    scheduleDuplicateRefresh(80);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!tab.active) return;
    if (!changeInfo.url && changeInfo.status !== "complete") return;

    state.mode = "duplicates";
    scheduleDuplicateRefresh(120);
});

browser.tabs.onRemoved.addListener(tabId => {
    if (state.highlightedTabIds.has(tabId)) {
        state.highlightedTabIds.delete(tabId);
    }
    if (state.mode !== "hover") {
        scheduleDuplicateRefresh(80);
    }
});

browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.showCounter) {
        scheduleDuplicateRefresh(0);
    }
    if (changes.duplicateAutoHideDelay) {
        const nextDelay = changes.duplicateAutoHideDelay.newValue;
        duplicateAutoHideDelay = Number.isFinite(nextDelay) ? nextDelay : 2000;
        if (state.mode === "duplicates" && state.highlightedTabIds.size > 0) {
            scheduleDuplicateAutoHide(state.requestId);
        } else {
            cancelDuplicateAutoHide();
        }
    }
});

browser.runtime.onMessage.addListener(async (message, sender) => {
    try {
        const sourceTabId = sender.tab ? sender.tab.id : null;

        if (message.action === "highlightTab" || message.action === "HOVER_LINK") {
            return await showHoverMatches(sourceTabId, message.url);
        }

        if (message.action === "SETTINGS_UPDATED" && message.settings) {
            if (Object.prototype.hasOwnProperty.call(message.settings, "duplicateAutoHideDelay")) {
                const nextDelay = message.settings.duplicateAutoHideDelay;
                duplicateAutoHideDelay = Number.isFinite(nextDelay) ? nextDelay : 2000;
                if (state.mode === "duplicates" && state.highlightedTabIds.size > 0) {
                    scheduleDuplicateAutoHide(state.requestId);
                } else {
                    cancelDuplicateAutoHide();
                }
            }
            return { ok: true };
        }

        if (message.action === "removeHighlight" || message.action === "HOVER_END") {
            await endHoverMode(sourceTabId);
            return { ok: true };
        }

        if (message.action === "UNHIGHLIGHT_ALL") {
            await clearAllVisuals();
            return { ok: true };
        }

        if (message.action === "SUPPRESS_HIGHLIGHT_FOR_TAB") {
            if (sourceTabId) {
                suppressedSourceTabs.set(sourceTabId, Date.now() + 700);
            }
            await clearAllVisuals();
            return { ok: true };
        }

        if (message.action === "SWITCH_TO_TAB" && message.tabId) {
            await browser.tabs.update(message.tabId, { active: true });
            const tab = await browser.tabs.get(message.tabId);
            await browser.windows.update(tab.windowId, { focused: true });
            return { ok: true };
        }
    } catch (error) {
        console.error("Background error:", error);
    }

    return undefined;
});

browser.action.onClicked.addListener(() => {
    browser.runtime.openOptionsPage().catch(() => {});
});

showDuplicatesForActiveTab();
