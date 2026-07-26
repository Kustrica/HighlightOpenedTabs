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
    const duplicateHighlightCheck = document.getElementById('enable-duplicate-highlight');
    const hoverHighlightCheck = document.getElementById('enable-hover-highlight');
    const unhighlightCheck = document.getElementById('unhighlight-leave');
    const delayInput = document.getElementById('hover-delay');
    const delayValue = document.getElementById('delay-value');
    const autoHideDelayInput = document.getElementById('auto-hide-delay');
    const autoHideDelayValue = document.getElementById('auto-hide-delay-value');

    const data = await chrome.storage.local.get({
        showCounter: true,
        enableDuplicateHighlight: true,
        enableHoverHighlight: true,
        hoverDelay: 10,
        unhighlightOnWindowLeave: true,
        duplicateAutoHideDelay: 200
    });

    counterCheck.checked = data.showCounter;
    duplicateHighlightCheck.checked = data.enableDuplicateHighlight !== false;
    hoverHighlightCheck.checked = data.enableHoverHighlight !== false;
    unhighlightCheck.checked = data.unhighlightOnWindowLeave;
    const hoverDelay = Math.max(1, Number(data.hoverDelay) || 10);
    delayInput.value = hoverDelay;
    delayValue.textContent = hoverDelay + 'ms';
    autoHideDelayInput.value = data.duplicateAutoHideDelay;
    autoHideDelayValue.textContent = data.duplicateAutoHideDelay + 'ms';

    const save = async (obj) => {
        await chrome.storage.local.set(obj);
        showStatus(chrome.i18n.getMessage("saved") || "Saved");
        chrome.runtime.sendMessage({ action: 'SETTINGS_UPDATED', settings: obj });
    };

    counterCheck.addEventListener('change', () => save({ showCounter: counterCheck.checked }));
    duplicateHighlightCheck.addEventListener('change', () => {
        save({ enableDuplicateHighlight: duplicateHighlightCheck.checked });
    });
    hoverHighlightCheck.addEventListener('change', () => {
        save({ enableHoverHighlight: hoverHighlightCheck.checked });
    });
    unhighlightCheck.addEventListener('change', () => {
        save({ unhighlightOnWindowLeave: unhighlightCheck.checked });
    });

    delayInput.addEventListener('input', () => {
        delayValue.textContent = delayInput.value + 'ms';
    });

    delayInput.addEventListener('change', () => {
        save({ hoverDelay: Math.max(1, parseInt(delayInput.value, 10) || 10) });
    });

    autoHideDelayInput.addEventListener('input', () => {
        autoHideDelayValue.textContent = autoHideDelayInput.value + 'ms';
    });

    autoHideDelayInput.addEventListener('change', () => {
        save({ duplicateAutoHideDelay: parseInt(autoHideDelayInput.value, 10) });
    });
});
