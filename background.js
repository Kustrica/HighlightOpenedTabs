// background.js

if (typeof browser === "undefined") {
    var browser = chrome;
}

function highlightTab(tabId) {
    browser.tabs.update(tabId, { active: false, highlighted: true })
        .catch(err => console.error("Error highlighting tab:", err));
}

function removeHighlight(tabId) {
    browser.tabs.update(tabId, { highlighted: false })
        .catch(err => console.error("Error removing highlight:", err));
}

function getNormalizedUrlHref(urlStr) {
    try {
        const url = new URL(urlStr);
        
        // Special case for YouTube: strictly match Video ID
        if (url.hostname.includes('youtube.com') || url.hostname === 'youtu.be') {
            if (url.pathname === '/watch') {
                const v = new URLSearchParams(url.search).get('v');
                if (v) return 'youtube.com/watch?v=' + v;
            }
            // Handle short links if needed (youtu.be/ID) or shorts (/shorts/ID)
            if (url.pathname.startsWith('/shorts/')) {
                 // Remove trailing slash from shorts ID if present
                 let id = url.pathname.split('/')[2];
                 if (id) return 'youtube.com/shorts/' + id;
            }
        }
        
        // Normalize hostname: remove common subdomains
        let hostname = url.hostname.replace(/^(www|new|old|sh)\./, '');
        
        // Normalize pathname: decode URI components (fixes Wikipedia etc.)
        let pathname = url.pathname;
        try {
            pathname = decodeURIComponent(pathname);
        } catch (e) {}
        
        if (pathname.endsWith('/') && pathname.length > 1) {
            pathname = pathname.slice(0, -1);
        }
        
        // Return without protocol to match http vs https
        return hostname + pathname;
    } catch (e) {
        return urlStr;
    }
}

async function highlightDuplicatesOfActiveTab() {
    try {
        let activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (activeTabs.length === 0) return;

        let activeTab = activeTabs[0];
        if (!activeTab.url || !activeTab.url.startsWith('http')) {
            browser.action.setBadgeText({ text: "", tabId: activeTab.id });
            return;
        }

        const targetHref = getNormalizedUrlHref(activeTab.url);
        let tabs = await browser.tabs.query({});
        let matchCount = 0;

        // Clear existing highlights on other tabs first to avoid stuck states
        tabs.forEach(tab => {
             if (tab.id !== activeTab.id && tab.highlighted) {
                 removeHighlight(tab.id);
             }
        });

        for (let tab of tabs) {
            if (tab.id === activeTab.id) continue;
            if (!tab.url) continue;

            const tabHref = getNormalizedUrlHref(tab.url);
            if (tabHref === targetHref) {
                highlightTab(tab.id);
                matchCount++;
            }
        }

        const { showCounter } = await browser.storage.local.get({ showCounter: true });

        if (matchCount > 0 && showCounter) {
            browser.action.setBadgeText({ text: matchCount.toString(), tabId: activeTab.id });
            browser.action.setBadgeBackgroundColor({ color: '#FF4444', tabId: activeTab.id });
        } else {
            browser.action.setBadgeText({ text: "", tabId: activeTab.id });
        }
    } catch (e) {
        console.error("Error in highlightDuplicatesOfActiveTab:", e);
    }
}

function clearAllHighlights() {
    browser.tabs.query({ active: false, highlighted: true }).then(tabs => {
        tabs.forEach(tab => removeHighlight(tab.id));
    });
}

// Event Listeners
browser.tabs.onActivated.addListener(() => {
    setTimeout(() => {
        highlightDuplicatesOfActiveTab();
    }, 200);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
        if (tab.active) {
            setTimeout(() => {
                highlightDuplicatesOfActiveTab();
            }, 200);
        }
    }
});

// Update badge if setting changes
browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.showCounter) {
        highlightDuplicatesOfActiveTab();
    }
});

browser.runtime.onMessage.addListener(async (message, sender) => {
    try {
        if (message.action === 'highlightTab') {
            if (!message.url) return;
            
            const targetHref = getNormalizedUrlHref(message.url);
            let tabs = await browser.tabs.query({});
            
            let activeTabId = sender.tab ? sender.tab.id : null;
            if (!activeTabId) {
                let activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
                if (activeTabs.length > 0) activeTabId = activeTabs[0].id;
            }

            let matchCount = 0;
            let matchedTabIds = [];

            for (let tab of tabs) {
                if (!tab.url) continue;
                if (activeTabId && tab.id === activeTabId) continue;

                const tabHref = getNormalizedUrlHref(tab.url);
                if (tabHref === targetHref) {
                    highlightTab(tab.id);
                    matchCount++;
                    matchedTabIds.push(tab.id);
                }
            }

            const { showCounter } = await browser.storage.local.get({ showCounter: true });

            if (activeTabId) {
                if (matchCount > 0 && showCounter) {
                    // Update badge text for the active tab (where the user is hovering)
                    // Note: This badge is temporary while hovering. 
                    // Usually we want duplicate count of CURRENT page, not hover link.
                    // But user requested "duplicate counter on icon". 
                    // Let's assume standard behavior is count of duplicates of CURRENT PAGE URL.
                    // If this block was intended to show count of HOVERED link, it might be confusing.
                    // Reverting to standard behavior: Badge always shows duplicates of current page URL.
                    // So we do NOT update badge here based on hover.
                }
            }
            return { count: matchCount, tabIds: matchedTabIds };

        } else if (message.action === 'removeHighlight') {
            let tabs = await browser.tabs.query({ active: false, highlighted: true });
            for (let tab of tabs) {
                removeHighlight(tab.id);
            }
            
            if (sender.tab) {
                browser.action.setBadgeText({ text: "", tabId: sender.tab.id });
            }
            
            await highlightDuplicatesOfActiveTab();

        } else if (message.action === 'UNHIGHLIGHT_ALL') {
            clearAllHighlights();
        } else if (message.action === 'SWITCH_TO_TAB') {
            if (message.tabId) {
                browser.tabs.update(message.tabId, { active: true }).then(() => {
                    browser.tabs.get(message.tabId).then(tab => {
                        browser.windows.update(tab.windowId, { focused: true });
                    });
                });
            }
        }
    } catch (error) {
        console.error("Background error:", error);
    }
});
