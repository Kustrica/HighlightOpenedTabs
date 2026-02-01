if (typeof browser === "undefined") {
    var browser = chrome;
}

let hoverTimeout;
let currentTarget = null;
let hoverDelay = 50; 
let unhighlightOnWindowLeave = true;

// Initialize from storage
browser.storage.local.get({ hoverDelay: 50, unhighlightOnWindowLeave: true }).then(data => {
    hoverDelay = data.hoverDelay;
    unhighlightOnWindowLeave = data.unhighlightOnWindowLeave;
});

// Listen for changes
browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        if (changes.hoverDelay) {
            hoverDelay = changes.hoverDelay.newValue;
        }
        if (changes.unhighlightOnWindowLeave) {
            unhighlightOnWindowLeave = changes.unhighlightOnWindowLeave.newValue;
        }
    }
});

// Also listen for runtime messages if storage listener fails
browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'SETTINGS_UPDATED') {
        if (message.settings.hoverDelay !== undefined) hoverDelay = message.settings.hoverDelay;
        if (message.settings.unhighlightOnWindowLeave !== undefined) unhighlightOnWindowLeave = message.settings.unhighlightOnWindowLeave;
    }
});

// Event Listeners
document.addEventListener('mouseover', (e) => {
    const link = e.target.closest('a');
    if (!link || !link.href) return;
    if (!link.href.startsWith('http')) return;
    
    if (link === currentTarget) return;

    if (hoverTimeout) clearTimeout(hoverTimeout);
    
    if (currentTarget && currentTarget !== link) {
        browser.runtime.sendMessage({ action: 'removeHighlight', url: currentTarget.href }).catch(() => {});
    }

    hoverTimeout = setTimeout(() => {
        currentTarget = link;
        browser.runtime.sendMessage({ action: 'highlightTab', url: link.href })
            .catch(err => console.error("Error checking tabs:", err));
    }, hoverDelay); 
}, { passive: true });

document.addEventListener('mouseout', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    
    if (hoverTimeout) clearTimeout(hoverTimeout);
    
    if (link === currentTarget) {
        if (link.contains(e.relatedTarget)) return;
        
        browser.runtime.sendMessage({ action: 'removeHighlight', url: link.href }).catch(() => {});
        currentTarget = null;
    }
}, { passive: true });

// Optional unhighlight on leaving window/document
document.addEventListener('mouseleave', (e) => {
    if (unhighlightOnWindowLeave) {
        // If leaving towards top (clientY <= 0), suppress highlighting until return
        if (e.clientY <= 0) {
             browser.runtime.sendMessage({ action: 'SUPPRESS_HIGHLIGHT_FOR_TAB' }).catch(() => {});
        } else {
             browser.runtime.sendMessage({ action: 'UNHIGHLIGHT_ALL' }).catch(() => {});
        }
    }
}, { passive: true });

document.addEventListener('mouseout', (e) => {
    if (unhighlightOnWindowLeave) {
        if (!e.relatedTarget && !e.toElement) {
             // Check if it's top exit
             if (e.clientY <= 0) {
                 browser.runtime.sendMessage({ action: 'SUPPRESS_HIGHLIGHT_FOR_TAB' }).catch(() => {});
             } else {
                 browser.runtime.sendMessage({ action: 'UNHIGHLIGHT_ALL' }).catch(() => {});
             }
        }
    }
}, { passive: true });

window.addEventListener('blur', () => {
    if (unhighlightOnWindowLeave) {
        browser.runtime.sendMessage({ action: 'UNHIGHLIGHT_ALL' }).catch(() => {});
    }
});
