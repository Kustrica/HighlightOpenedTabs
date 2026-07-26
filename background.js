if (typeof browser === "undefined") {
    var browser = chrome;
}

const DEFAULT_SETTINGS = {
    showCounter: true,
    enableDuplicateHighlight: true,
    enableHoverHighlight: true,
    duplicateAutoHideDelay: 200
};

const PAGE_BADGE_MIN_MS = 2000;

const state = {
    mode: "idle",
    highlightedTabIds: new Set(),
    hoverSourceTabId: null,
    requestId: 0,
    pageBadgeActive: false
};

const suppressedSourceTabs = new Map();
let refreshTimer = null;
let duplicateAutoHideTimer = null;
let pageBadgeTimer = null;
let settings = { ...DEFAULT_SETTINGS };

browser.storage.local.get(DEFAULT_SETTINGS).then(data => {
    settings = {
        showCounter: data.showCounter !== false,
        enableDuplicateHighlight: data.enableDuplicateHighlight !== false,
        enableHoverHighlight: data.enableHoverHighlight !== false,
        duplicateAutoHideDelay: Number.isFinite(data.duplicateAutoHideDelay)
            ? data.duplicateAutoHideDelay
            : DEFAULT_SETTINGS.duplicateAutoHideDelay
    };
});

function cancelDuplicateAutoHide() {
    if (duplicateAutoHideTimer) {
        clearTimeout(duplicateAutoHideTimer);
        duplicateAutoHideTimer = null;
    }
}

function cancelPageBadgeTimer() {
    if (pageBadgeTimer) {
        clearTimeout(pageBadgeTimer);
        pageBadgeTimer = null;
    }
}

function getPageBadgeDurationMs() {
    const delay = settings.duplicateAutoHideDelay;
    if (!Number.isFinite(delay) || delay <= 0) {
        return PAGE_BADGE_MIN_MS;
    }
    return Math.max(PAGE_BADGE_MIN_MS, delay);
}

function scheduleDuplicateAutoHide(requestId) {
    cancelDuplicateAutoHide();
    if (!settings.duplicateAutoHideDelay || settings.duplicateAutoHideDelay <= 0) return;
    duplicateAutoHideTimer = setTimeout(async () => {
        if (state.mode === "hover") return;
        if (requestId !== state.requestId) return;
        await syncHighlights([]);
    }, settings.duplicateAutoHideDelay);
}

function schedulePageBadgeClear(tabId, requestId) {
    cancelPageBadgeTimer();
    pageBadgeTimer = setTimeout(async () => {
        if (requestId !== state.requestId) return;
        if (state.mode === "hover") return;
        state.pageBadgeActive = false;
        await setBadge(tabId, 0);
    }, getPageBadgeDurationMs());
}

const IGNORED_ABOUT_PAGES = new Set([
    "blank",
    "newtab",
    "home",
    "privatebrowsing",
    "welcome",
    "logo",
    "neon"
]);

function getNormalizedUrlKey(urlStr) {
    try {
        const url = new URL(urlStr);
        const protocol = url.protocol.toLowerCase();

        // Browser system pages (about:addons, about:preferences, …).
        // Content scripts cannot run there; duplicate matching via tabs API still can.
        if (protocol === "about:") {
            let page = (url.pathname || "").replace(/^\//, "").toLowerCase();
            if (!page) {
                page = url.href.replace(/^about:/i, "").split(/[?#]/)[0].toLowerCase();
            }
            page = page.split(/[?#]/)[0];
            if (!page || IGNORED_ABOUT_PAGES.has(page)) return null;
            const params = [];
            url.searchParams.forEach((value, key) => {
                params.push([key, value]);
            });
            params.sort(([aKey], [bKey]) => aKey.localeCompare(bKey));
            const query = params
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                .join("&");
            return `about:${page}${query ? `?${query}` : ""}`;
        }

        if (!protocol.startsWith("http")) return null;

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

function getTabUrlCandidate(tab) {
    if (!tab) return "";
    return tab.pendingUrl || tab.url || "";
}

function getTabNormalizedKey(tab) {
    return getNormalizedUrlKey(getTabUrlCandidate(tab));
}

async function getActiveTab() {
    const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
    return activeTabs.length > 0 ? activeTabs[0] : null;
}

async function setBadge(tabId, duplicateCount) {
    if (!settings.showCounter || !duplicateCount || duplicateCount <= 0) {
        await browser.action.setBadgeText({ text: "", tabId });
        return;
    }

    await browser.action.setBadgeText({ text: String(duplicateCount), tabId });
    await browser.action.setBadgeBackgroundColor({ color: "#FF4444", tabId });
}

async function clearBadgeOnActiveTab() {
    const activeTab = await getActiveTab();
    if (activeTab) {
        await browser.action.setBadgeText({ text: "", tabId: activeTab.id });
    }
}

async function resetMultiselectToActiveOnly() {
    const activeTab = await getActiveTab();
    if (!activeTab) {
        state.highlightedTabIds = new Set();
        return;
    }

    try {
        await browser.tabs.highlight({
            windowId: activeTab.windowId,
            tabs: [activeTab.index],
            populate: false
        });
    } catch (_) {
        for (const tabId of state.highlightedTabIds) {
            browser.tabs.update(tabId, { highlighted: false }).catch(() => {});
        }
    }

    state.highlightedTabIds = new Set();
}

async function syncHighlights(nextTabIds) {
    const nextSet = new Set(nextTabIds);

    if (nextSet.size === 0) {
        if (state.highlightedTabIds.size > 0) {
            await resetMultiselectToActiveOnly();
        }
        return;
    }

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

function scheduleDuplicateRefresh(delay = 20, pulseBadge = false) {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
        if (state.mode === "hover") return;
        showDuplicatesForActiveTab({ pulseBadge });
    }, delay);
}

async function showDuplicatesForActiveTab({ pulseBadge = false } = {}) {
    // Quiet refreshes (loading/complete after paste) must NOT bump requestId —
    // that was cancelling the flash timer and leaving duplicates highlighted.
    const requestId = pulseBadge ? ++state.requestId : state.requestId;
    state.hoverSourceTabId = null;
    if (state.mode !== "hover") {
        state.mode = "idle";
    }

    const activeTab = await getActiveTab();
    if (!activeTab) return;

    const activeKey = getTabNormalizedKey(activeTab);
    if (!activeKey) {
        if (activeTab.status === "loading" || activeTab.pendingUrl) {
            scheduleDuplicateRefresh(40, pulseBadge);
            return;
        }
        if (requestId !== state.requestId) return;
        cancelDuplicateAutoHide();
        cancelPageBadgeTimer();
        state.pageBadgeActive = false;
        await syncHighlights([]);
        await browser.action.setBadgeText({ text: "", tabId: activeTab.id });
        return;
    }

    const tabs = await browser.tabs.query({});
    if (requestId !== state.requestId) return;

    const matchedTabs = tabs.filter(tab => getTabNormalizedKey(tab) === activeKey);
    const duplicateCount = Math.max(0, matchedTabs.length - 1);
    const highlightIds = settings.enableDuplicateHighlight
        ? matchedTabs.filter(tab => tab.id !== activeTab.id).map(tab => tab.id)
        : [];

    if (pulseBadge) {
        state.pageBadgeActive = duplicateCount > 0;
        await setBadge(activeTab.id, duplicateCount);
        if (duplicateCount > 0) {
            schedulePageBadgeClear(activeTab.id, requestId);
        } else {
            cancelPageBadgeTimer();
        }
    } else if (state.pageBadgeActive) {
        await setBadge(activeTab.id, duplicateCount);
        if (duplicateCount <= 0) {
            cancelPageBadgeTimer();
            state.pageBadgeActive = false;
        }
    } else {
        await setBadge(activeTab.id, 0);
    }
    if (requestId !== state.requestId) return;

    if (settings.enableDuplicateHighlight && pulseBadge) {
        await syncHighlights(highlightIds);
        if (requestId !== state.requestId) return;
        if (highlightIds.length > 0) {
            scheduleDuplicateAutoHide(requestId);
        } else {
            cancelDuplicateAutoHide();
        }
    } else if (!settings.enableDuplicateHighlight) {
        await syncHighlights([]);
        cancelDuplicateAutoHide();
    } else if (highlightIds.length === 0) {
        await syncHighlights([]);
        cancelDuplicateAutoHide();
    }
    // Quiet refresh with duplicates still highlighted: leave flash timer alone.
}

async function showHoverMatches(sourceTabId, hoveredUrl) {
    if (!settings.enableHoverHighlight && !settings.showCounter) {
        return { count: 0, tabIds: [] };
    }

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
    cancelPageBadgeTimer();
    state.pageBadgeActive = false;

    const requestId = ++state.requestId;
    state.mode = "hover";
    state.hoverSourceTabId = sourceTabId;

    const tabs = await browser.tabs.query({});
    if (requestId !== state.requestId) {
        return { count: 0, tabIds: [] };
    }

    const matchedTabs = tabs.filter(tab => {
        if (tab.id === sourceTabId) return false;
        return getTabNormalizedKey(tab) === hoveredKey;
    });

    await setBadge(sourceTabId, matchedTabs.length);
    if (requestId !== state.requestId) {
        return { count: 0, tabIds: [] };
    }

    const highlightIds = settings.enableHoverHighlight
        ? matchedTabs.map(tab => tab.id)
        : [];

    if (settings.enableHoverHighlight) {
        await syncHighlights(highlightIds);
    } else if (state.highlightedTabIds.size > 0) {
        await syncHighlights([]);
    }

    return { count: matchedTabs.length, tabIds: highlightIds };
}

async function endHoverMode(sourceTabId) {
    if (state.mode !== "hover") return;
    if (sourceTabId && state.hoverSourceTabId && sourceTabId !== state.hoverSourceTabId) return;

    state.mode = "idle";
    state.hoverSourceTabId = null;
    state.pageBadgeActive = false;
    cancelPageBadgeTimer();
    cancelDuplicateAutoHide();
    await syncHighlights([]);
    await clearBadgeOnActiveTab();
}

async function clearAllVisuals() {
    state.requestId++;
    state.mode = "idle";
    state.hoverSourceTabId = null;
    state.pageBadgeActive = false;
    cancelDuplicateAutoHide();
    cancelPageBadgeTimer();
    await syncHighlights([]);
    await clearBadgeOnActiveTab();
}

function applySettingsPatch(patch) {
    if (Object.prototype.hasOwnProperty.call(patch, "showCounter")) {
        settings.showCounter = patch.showCounter !== false;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "enableDuplicateHighlight")) {
        settings.enableDuplicateHighlight = patch.enableDuplicateHighlight !== false;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "enableHoverHighlight")) {
        settings.enableHoverHighlight = patch.enableHoverHighlight !== false;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "duplicateAutoHideDelay")) {
        const nextDelay = patch.duplicateAutoHideDelay;
        settings.duplicateAutoHideDelay = Number.isFinite(nextDelay)
            ? nextDelay
            : DEFAULT_SETTINGS.duplicateAutoHideDelay;
    }
}

browser.tabs.onActivated.addListener(activeInfo => {
    suppressedSourceTabs.delete(activeInfo.tabId);
    state.hoverSourceTabId = null;
    scheduleDuplicateRefresh(0, true);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (state.mode === "hover") return;

    const urlChanged = Boolean(changeInfo.url);
    const loadPhase =
        changeInfo.status === "loading" || changeInfo.status === "complete";
    const discardChanged = changeInfo.discarded !== undefined;
    if (!urlChanged && !loadPhase && !discardChanged) return;

    if (tab.active && urlChanged) {
        scheduleDuplicateRefresh(0, true);
        return;
    }

    if (tab.active || urlChanged || discardChanged) {
        scheduleDuplicateRefresh(urlChanged ? 0 : 20, false);
    }
});

browser.tabs.onCreated.addListener(tab => {
    if (state.mode === "hover") return;
    if (tab.active) {
        scheduleDuplicateRefresh(0, true);
    }
});

browser.tabs.onRemoved.addListener(tabId => {
    if (state.highlightedTabIds.has(tabId)) {
        state.highlightedTabIds.delete(tabId);
    }
    if (state.mode !== "hover") {
        scheduleDuplicateRefresh(0, false);
    }
});

browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;

    const patch = {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (changes[key]) {
            patch[key] = changes[key].newValue;
        }
    }
    if (Object.keys(patch).length === 0) return;

    applySettingsPatch(patch);

    if (
        Object.prototype.hasOwnProperty.call(patch, "showCounter") ||
        Object.prototype.hasOwnProperty.call(patch, "enableDuplicateHighlight")
    ) {
        scheduleDuplicateRefresh(0, false);
    }

    if (Object.prototype.hasOwnProperty.call(patch, "duplicateAutoHideDelay")) {
        if (state.highlightedTabIds.size > 0 && state.mode !== "hover") {
            scheduleDuplicateAutoHide(state.requestId);
        } else {
            cancelDuplicateAutoHide();
        }
        if (state.pageBadgeActive) {
            getActiveTab().then(activeTab => {
                if (activeTab && state.pageBadgeActive) {
                    schedulePageBadgeClear(activeTab.id, state.requestId);
                }
            });
        }
    }

    if (Object.prototype.hasOwnProperty.call(patch, "enableHoverHighlight") && !settings.enableHoverHighlight) {
        if (state.mode === "hover") {
            endHoverMode(state.hoverSourceTabId);
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
            applySettingsPatch(message.settings);
            if (
                Object.prototype.hasOwnProperty.call(message.settings, "showCounter") ||
                Object.prototype.hasOwnProperty.call(message.settings, "enableDuplicateHighlight")
            ) {
                scheduleDuplicateRefresh(0, false);
            }
            if (Object.prototype.hasOwnProperty.call(message.settings, "duplicateAutoHideDelay")) {
                if (state.highlightedTabIds.size > 0 && state.mode !== "hover") {
                    scheduleDuplicateAutoHide(state.requestId);
                } else {
                    cancelDuplicateAutoHide();
                }
                if (state.pageBadgeActive) {
                    const activeTab = await getActiveTab();
                    if (activeTab) {
                        schedulePageBadgeClear(activeTab.id, state.requestId);
                    }
                }
            }
            if (
                Object.prototype.hasOwnProperty.call(message.settings, "enableHoverHighlight") &&
                !settings.enableHoverHighlight &&
                state.mode === "hover"
            ) {
                await endHoverMode(state.hoverSourceTabId);
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

showDuplicatesForActiveTab({ pulseBadge: false });
