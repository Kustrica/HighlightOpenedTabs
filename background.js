// background.js

if (typeof browser === "undefined") {
    var browser = chrome;
}

// Global flag to suppress highlighting for a specific tab until it becomes inactive or user switches tabs
let suppressionMap = new Map(); // tabId -> boolean
let lastTabSwitchTime = 0; // Timestamp of last tab switch to prevent race conditions

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
browser.tabs.onActivated.addListener((activeInfo) => {
    // Reset suppression for the newly activated tab (or any tab really, logic: switch resets state)
    // Actually, we should probably just clear suppression for the tab we are LEAVING? 
    // Or simpler: clear suppression for the new active tab so it starts fresh.
    suppressionMap.delete(activeInfo.tabId);
    
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
            
            // Clear ANY existing highlights before adding new ones
            // This prevents "mixing" of highlights from current page duplicates and hovered link duplicates
            let currentHighlighted = await browser.tabs.query({ highlighted: true });
            for (let t of currentHighlighted) {
                if (!t.active) {
                    removeHighlight(t.id);
                }
            }
            
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
                // Don't highlight the active tab (sender) itself
                if (activeTabId && tab.id === activeTabId) continue;
                
                // Don't highlight if suppressed
                if (suppressionMap.get(tab.id)) continue;

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
                    // Update badge logic here if needed
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
            // Only block UNHIGHLIGHT_ALL if it comes from a tab blur event right after switch
            // But if user explicitly moves mouse to top, we should allow it IF it comes from the ACTIVE tab.
            // However, content script messages don't always indicate "blur" vs "mouseleave".
            // Let's reduce the safety timeout or check if sender is active tab.
            
            // If the message comes from the ACTIVE tab, we should probably honor it immediately?
            // "blur" (switching tabs) usually comes from the OLD tab (inactive).
            // "mouseleave" (top hover) comes from the ACTIVE tab.
            
            let isActiveTab = false;
            if (sender.tab) {
                let activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
                if (activeTabs.length > 0 && activeTabs[0].id === sender.tab.id) {
                    isActiveTab = true;
                }
            }
            
            // If it's the active tab saying "unhighlight", we honor it.
            // If it's an inactive tab (blurring), we check the timeout.
            if (isActiveTab || Date.now() - lastTabSwitchTime > 500) {
                clearAllHighlights();
            }
        } else if (message.action === 'SUPPRESS_HIGHLIGHT_FOR_TAB') {
             // Same logic: if active tab requests suppression (mouse top), do it.
             let isActiveTab = false;
             if (sender.tab) {
                let activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
                if (activeTabs.length > 0 && activeTabs[0].id === sender.tab.id) {
                    isActiveTab = true;
                }
             }

             if (isActiveTab || Date.now() - lastTabSwitchTime > 500) {
                  if (sender.tab) {
                      suppressionMap.set(sender.tab.id, true);
                      clearAllHighlights();
                  }
             }
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
