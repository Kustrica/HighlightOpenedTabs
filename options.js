function localizePage() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        const msg = chrome.i18n.getMessage(key);
        if (msg) el.textContent = msg;
    });
}

function showStatus(msg, type = 'success') {
    const el = document.getElementById('status-msg');
    el.textContent = msg;
    el.className = type;
    el.style.opacity = 1;
    setTimeout(() => {
        el.style.opacity = 0;
    }, 2000);
}

document.addEventListener('DOMContentLoaded', async () => {
    localizePage();

    const counterCheck = document.getElementById('show-counter');
    const unhighlightCheck = document.getElementById('unhighlight-leave');
    const delayInput = document.getElementById('hover-delay');
    const delayValue = document.getElementById('delay-value');
    
    // Load settings
    const data = await chrome.storage.local.get({
        showCounter: true,
        hoverDelay: 50,
        unhighlightOnWindowLeave: true
    });

    counterCheck.checked = data.showCounter;
    unhighlightCheck.checked = data.unhighlightOnWindowLeave;
    delayInput.value = data.hoverDelay;
    delayValue.textContent = data.hoverDelay + 'ms';

    // Save functions
    const save = async (obj) => {
        await chrome.storage.local.set(obj);
        showStatus(chrome.i18n.getMessage("saved") || "Saved");
        
        // Notify background/content scripts
        chrome.runtime.sendMessage({ action: 'SETTINGS_UPDATED', settings: obj });
    };

    counterCheck.addEventListener('change', () => save({ showCounter: counterCheck.checked }));
    unhighlightCheck.addEventListener('change', () => save({ unhighlightOnWindowLeave: unhighlightCheck.checked }));
    
    delayInput.addEventListener('input', () => {
        delayValue.textContent = delayInput.value + 'ms';
    });
    
    delayInput.addEventListener('change', () => {
        save({ hoverDelay: parseInt(delayInput.value, 10) });
    });
});