if (typeof browser === "undefined") {
    var browser = chrome;
}

const ACCENT_PRESETS = [
    "#ff9400",
    "#ff5a36",
    "#ff3b6b",
    "#a855f7",
    "#3b82f6",
    "#06b6d4",
    "#22c55e",
    "#eab308",
    "#f472b6",
    "#f8fafc"
];

const SITE_ACCESS_ORIGINS = ["*://*/*"];

let accentPaletteState = null;

function localizePage() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        const msg = getMessage(key);
        if (msg) el.textContent = msg;
    });
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
        const key = el.getAttribute("data-i18n-title");
        const msg = getMessage(key);
        if (msg) {
            el.title = msg;
            el.setAttribute("aria-label", msg);
        }
    });
    const titleMsg = getMessage("optionsTitle");
    if (titleMsg) document.title = titleMsg;
    const langSelect = document.getElementById("ui-language-select");
    const uiLang = langSelect?.value || "auto";
    const resolved = uiLang === "auto"
        ? (browser.i18n?.getUILanguage?.() || "en")
        : uiLang.replace("_", "-");
    document.documentElement.lang = resolved.split("-")[0];
}

function refreshLocalizedDynamicUI() {
    if (accentPaletteState) {
        buildAccentPalette(
            accentPaletteState.el,
            accentPaletteState.color,
            accentPaletteState.onPick
        );
    }
}

const DEFAULT_APPEARANCE = {
    highlightColor: "#ff9400",
    highlightCardColor: "",
    highlightUnderlineColor: "",
    highlightGlowColor: "",
    highlightCardWidth: 1,
    highlightUnderlineWidth: 1,
    highlightGlowStrength: 40,
    highlightGlowRingWidth: 1
};

function showStatus(msg, type = "success") {
    const el = document.getElementById("status-msg");
    el.textContent = msg;
    el.className = type;
    el.style.opacity = 1;
    setTimeout(() => {
        el.style.opacity = 0;
    }, 2000);
}

function normalizeHex(hex) {
    if (!hex || typeof hex !== "string") return null;
    const trimmed = hex.trim();
    if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
        return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
    }
    return null;
}

function resolveColor(specific, accent) {
    return normalizeHex(specific) || normalizeHex(accent) || DEFAULT_APPEARANCE.highlightColor;
}

function setSubgroupEnabled(enabled) {
    const opacity = enabled ? "1" : "0.45";
    const pointer = enabled ? "" : "none";
    for (const id of ["link-highlight-options", "link-highlight-styles"]) {
        const el = document.getElementById(id);
        if (!el) continue;
        el.style.opacity = opacity;
        el.style.pointerEvents = pointer;
    }
}

function buildAccentPalette(paletteEl, activeColor, onPick) {
    const pickLabel = getMessage("highlightChooseColor") || "Choose color";
    paletteEl.replaceChildren();
    for (const color of ACCENT_PRESETS) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "color-swatch";
        btn.style.backgroundColor = color;
        btn.dataset.color = color;
        btn.title = pickLabel;
        btn.setAttribute("aria-label", pickLabel);
        if (color === activeColor) btn.classList.add("active");
        btn.addEventListener("click", () => onPick(color));
        paletteEl.appendChild(btn);
    }
}

function updatePaletteActive(paletteEl, color) {
    const normalized = normalizeHex(color);
    paletteEl.querySelectorAll(".color-swatch").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.color === normalized);
    });
}

function setColorInput(input, color) {
    const normalized = normalizeHex(color) || DEFAULT_APPEARANCE.highlightColor;
    input.value = normalized;
    if (input.id === "highlight-accent-color") return normalized;
    const triggerId = input.id.replace("highlight-", "").replace("-color", "-color-trigger");
    const trigger = document.getElementById(triggerId);
    if (trigger) {
        trigger.style.backgroundColor = normalized;
        trigger.classList.add("has-color");
    }
    return normalized;
}

function setAccentDisplay(color) {
    const input = document.getElementById("highlight-accent-color");
    const normalized = normalizeHex(color) || DEFAULT_APPEARANCE.highlightColor;
    input.value = normalized;
    const palette = document.getElementById("accent-palette");
    if (palette) updatePaletteActive(palette, normalized);
    return normalized;
}

async function hasSiteAccess() {
    if (!browser.permissions?.contains) return true;
    return browser.permissions.contains({ origins: SITE_ACCESS_ORIGINS });
}

async function updateSiteAccessUI() {
    const prompt = document.getElementById("site-access-prompt");
    const inline = document.getElementById("site-access-inline");
    const fallback = document.getElementById("site-access-fallback");
    if (!prompt || !inline || !browser.permissions?.contains) return;

    const granted = await hasSiteAccess();
    const { siteAccessDeclined } = await chrome.storage.local.get({ siteAccessDeclined: false });

    if (granted) {
        prompt.classList.add("hidden");
        inline.classList.add("hidden");
        if (fallback) fallback.classList.add("hidden");
        if (siteAccessDeclined) {
            await chrome.storage.local.set({ siteAccessDeclined: false });
        }
        return;
    }

    if (siteAccessDeclined) {
        prompt.classList.add("hidden");
        inline.classList.remove("hidden");
        if (fallback) fallback.classList.add("hidden");
    } else {
        inline.classList.add("hidden");
        prompt.classList.remove("hidden");
    }
}

async function requestSiteAccess() {
    if (!browser.permissions?.request) return false;
    const granted = await browser.permissions.request({ origins: SITE_ACCESS_ORIGINS });
    const fallback = document.getElementById("site-access-fallback");
    if (granted) {
        await chrome.storage.local.set({ siteAccessDeclined: false });
        if (fallback) fallback.classList.add("hidden");
        await updateSiteAccessUI();
        browser.runtime.sendMessage({ action: "RELOAD_ACTIVE_TAB" }).catch(() => {});
        showStatus(getMessage("saved") || "Saved");
        return true;
    }
    if (fallback) fallback.classList.remove("hidden");
    await updateSiteAccessUI();
    return false;
}

function bindSiteAccessControls() {
    for (const id of ["site-access-enable", "site-access-inline-enable"]) {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener("click", () => requestSiteAccess());
    }

    const skipBtn = document.getElementById("site-access-skip");
    if (skipBtn) {
        skipBtn.addEventListener("click", async () => {
            await chrome.storage.local.set({ siteAccessDeclined: true });
            const fallback = document.getElementById("site-access-fallback");
            if (fallback) fallback.classList.add("hidden");
            await updateSiteAccessUI();
        });
    }

    if (browser.permissions?.onAdded) {
        browser.permissions.onAdded.addListener(updateSiteAccessUI);
    }
    if (browser.permissions?.onRemoved) {
        browser.permissions.onRemoved.addListener(async () => {
            await chrome.storage.local.set({ siteAccessDeclined: false });
            const fallback = document.getElementById("site-access-fallback");
            if (fallback) fallback.classList.add("hidden");
            await updateSiteAccessUI();
        });
    }
}

function bindLanguageSelect() {
    const langSelect = document.getElementById("ui-language-select");
    if (!langSelect) return;

    langSelect.addEventListener("change", () => {
        const newLang = langSelect.value;
        browser.storage.local.set({ ui_language: newLang }).then(() => {
            showStatus(getMessage("languageUpdated") || "Language updated. Reloading...");
            setTimeout(() => location.reload(), 800);
        });
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const { ui_language } = await browser.storage.local.get({ ui_language: "auto" });
    const langSelect = document.getElementById("ui-language-select");
    if (langSelect) langSelect.value = ui_language || "auto";

    if (window.initI18n) await window.initI18n();
    localizePage();
    bindLanguageSelect();
    bindSiteAccessControls();
    await updateSiteAccessUI();

    const counterCheck = document.getElementById("show-counter");
    const duplicateHighlightCheck = document.getElementById("enable-duplicate-highlight");
    const hoverHighlightCheck = document.getElementById("enable-hover-highlight");
    const unhighlightCheck = document.getElementById("unhighlight-leave");
    const delayInput = document.getElementById("hover-delay");
    const delayValue = document.getElementById("delay-value");
    const autoHideDelayInput = document.getElementById("auto-hide-delay");
    const autoHideDelayValue = document.getElementById("auto-hide-delay-value");
    const linkHighlightEnabled = document.getElementById("link-highlight-enabled");
    const linkScopeHidden = document.getElementById("link-scope-hidden");
    const linkScopeAlways = document.getElementById("link-scope-always");
    const linkCard = document.getElementById("link-highlight-card");
    const linkUnderline = document.getElementById("link-highlight-underline");
    const linkGlow = document.getElementById("link-highlight-glow");

    const accentPalette = document.getElementById("accent-palette");
    const accentColorInput = document.getElementById("highlight-accent-color");
    const cardColorInput = document.getElementById("highlight-card-color");
    const underlineColorInput = document.getElementById("highlight-underline-color");
    const glowColorInput = document.getElementById("highlight-glow-color");
    const cardWidthInput = document.getElementById("highlight-card-width");
    const cardWidthValue = document.getElementById("highlight-card-width-value");
    const underlineWidthInput = document.getElementById("highlight-underline-width");
    const underlineWidthValue = document.getElementById("highlight-underline-width-value");
    const glowStrengthInput = document.getElementById("highlight-glow-strength");
    const glowStrengthValue = document.getElementById("highlight-glow-strength-value");
    const glowRingInput = document.getElementById("highlight-glow-ring");
    const glowRingValue = document.getElementById("highlight-glow-ring-value");

    const data = await chrome.storage.local.get({
        showCounter: true,
        enableDuplicateHighlight: true,
        enableHoverHighlight: true,
        hoverDelay: 10,
        unhighlightOnWindowLeave: true,
        duplicateAutoHideDelay: 200,
        linkHighlightEnabled: true,
        linkHighlightScope: "always",
        linkHighlightCard: false,
        linkHighlightUnderline: false,
        linkHighlightGlow: true,
        ...DEFAULT_APPEARANCE
    });

    let currentAccent = resolveColor(data.highlightColor, DEFAULT_APPEARANCE.highlightColor);
    let syncedCard = !data.highlightCardColor;
    let syncedUnderline = !data.highlightUnderlineColor;
    let syncedGlow = !data.highlightGlowColor;

    counterCheck.checked = data.showCounter !== false;
    duplicateHighlightCheck.checked = data.enableDuplicateHighlight !== false;
    hoverHighlightCheck.checked = data.enableHoverHighlight !== false;
    unhighlightCheck.checked = data.unhighlightOnWindowLeave !== false;
    const hoverDelay = Math.max(1, Number(data.hoverDelay) || 10);
    delayInput.value = hoverDelay;
    delayValue.textContent = hoverDelay + "ms";
    autoHideDelayInput.value = data.duplicateAutoHideDelay;
    autoHideDelayValue.textContent = data.duplicateAutoHideDelay + "ms";

    linkHighlightEnabled.checked = data.linkHighlightEnabled !== false;
    if (data.linkHighlightScope === "hidden_only") {
        linkScopeHidden.checked = true;
    } else {
        linkScopeAlways.checked = true;
    }
    linkCard.checked = data.linkHighlightCard === true;
    linkUnderline.checked = data.linkHighlightUnderline === true;
    linkGlow.checked = data.linkHighlightGlow !== false;
    setSubgroupEnabled(linkHighlightEnabled.checked);

    setAccentDisplay(currentAccent);
    setColorInput(cardColorInput, resolveColor(data.highlightCardColor, currentAccent));
    setColorInput(underlineColorInput, resolveColor(data.highlightUnderlineColor, currentAccent));
    setColorInput(glowColorInput, resolveColor(data.highlightGlowColor, currentAccent));
    cardWidthInput.value = data.highlightCardWidth;
    cardWidthValue.textContent = data.highlightCardWidth + "px";
    underlineWidthInput.value = data.highlightUnderlineWidth;
    underlineWidthValue.textContent = data.highlightUnderlineWidth + "px";
    glowStrengthInput.value = data.highlightGlowStrength;
    glowStrengthValue.textContent = String(data.highlightGlowStrength);
    glowRingInput.value = data.highlightGlowRingWidth;
    glowRingValue.textContent = data.highlightGlowRingWidth + "px";

    buildAccentPalette(accentPalette, currentAccent, (color) => {
        applyAccentColor(color, true);
    });
    accentPaletteState = {
        el: accentPalette,
        color: currentAccent,
        onPick: (color) => applyAccentColor(color, true)
    };
    updatePaletteActive(accentPalette, currentAccent);

    const save = async (obj) => {
        await chrome.storage.local.set(obj);
        showStatus(getMessage("saved") || "Saved");
        chrome.runtime.sendMessage({ action: "SETTINGS_UPDATED", settings: obj });
    };

    function applyAccentColor(color, syncChildren) {
        const normalized = setAccentDisplay(color);
        currentAccent = normalized;
        if (accentPaletteState) accentPaletteState.color = normalized;
        updatePaletteActive(accentPalette, normalized);

        const patch = { highlightColor: normalized };
        if (syncChildren) {
            if (syncedCard) {
                setColorInput(cardColorInput, normalized);
                patch.highlightCardColor = "";
            }
            if (syncedUnderline) {
                setColorInput(underlineColorInput, normalized);
                patch.highlightUnderlineColor = "";
            }
            if (syncedGlow) {
                setColorInput(glowColorInput, normalized);
                patch.highlightGlowColor = "";
            }
        }
        save(patch);
    }

    function resetAccent() {
        applyAccentColor(DEFAULT_APPEARANCE.highlightColor, false);
    }

    function resetCard() {
        syncedCard = true;
        cardWidthInput.value = DEFAULT_APPEARANCE.highlightCardWidth;
        cardWidthValue.textContent = DEFAULT_APPEARANCE.highlightCardWidth + "px";
        setColorInput(cardColorInput, currentAccent);
        save({
            highlightCardColor: "",
            highlightCardWidth: DEFAULT_APPEARANCE.highlightCardWidth
        });
    }

    function resetUnderline() {
        syncedUnderline = true;
        underlineWidthInput.value = DEFAULT_APPEARANCE.highlightUnderlineWidth;
        underlineWidthValue.textContent = DEFAULT_APPEARANCE.highlightUnderlineWidth + "px";
        setColorInput(underlineColorInput, currentAccent);
        save({
            highlightUnderlineColor: "",
            highlightUnderlineWidth: DEFAULT_APPEARANCE.highlightUnderlineWidth
        });
    }

    function resetGlowColor() {
        syncedGlow = true;
        setColorInput(glowColorInput, currentAccent);
        save({ highlightGlowColor: "" });
    }

    function resetGlowStrength() {
        glowStrengthInput.value = DEFAULT_APPEARANCE.highlightGlowStrength;
        glowStrengthValue.textContent = String(DEFAULT_APPEARANCE.highlightGlowStrength);
        save({ highlightGlowStrength: DEFAULT_APPEARANCE.highlightGlowStrength });
    }

    function resetGlowRing() {
        glowRingInput.value = DEFAULT_APPEARANCE.highlightGlowRingWidth;
        glowRingValue.textContent = DEFAULT_APPEARANCE.highlightGlowRingWidth + "px";
        save({ highlightGlowRingWidth: DEFAULT_APPEARANCE.highlightGlowRingWidth });
    }

    counterCheck.addEventListener("change", () => save({ showCounter: counterCheck.checked }));
    duplicateHighlightCheck.addEventListener("change", () => {
        save({ enableDuplicateHighlight: duplicateHighlightCheck.checked });
    });
    hoverHighlightCheck.addEventListener("change", () => {
        save({ enableHoverHighlight: hoverHighlightCheck.checked });
    });
    unhighlightCheck.addEventListener("change", () => {
        save({ unhighlightOnWindowLeave: unhighlightCheck.checked });
    });

    delayInput.addEventListener("input", () => {
        delayValue.textContent = delayInput.value + "ms";
    });
    delayInput.addEventListener("change", () => {
        save({ hoverDelay: Math.max(1, parseInt(delayInput.value, 10) || 10) });
    });

    autoHideDelayInput.addEventListener("input", () => {
        autoHideDelayValue.textContent = autoHideDelayInput.value + "ms";
    });
    autoHideDelayInput.addEventListener("change", () => {
        save({ duplicateAutoHideDelay: parseInt(autoHideDelayInput.value, 10) });
    });

    linkHighlightEnabled.addEventListener("change", () => {
        setSubgroupEnabled(linkHighlightEnabled.checked);
        save({ linkHighlightEnabled: linkHighlightEnabled.checked });
    });

    linkScopeHidden.addEventListener("change", () => {
        if (linkScopeHidden.checked) save({ linkHighlightScope: "hidden_only" });
    });
    linkScopeAlways.addEventListener("change", () => {
        if (linkScopeAlways.checked) save({ linkHighlightScope: "always" });
    });

    linkCard.addEventListener("change", () => save({ linkHighlightCard: linkCard.checked }));
    linkUnderline.addEventListener("change", () => save({ linkHighlightUnderline: linkUnderline.checked }));
    linkGlow.addEventListener("change", () => save({ linkHighlightGlow: linkGlow.checked }));

    accentColorInput.addEventListener("input", () => {
        applyAccentColor(accentColorInput.value, true);
    });

    document.getElementById("reset-accent").addEventListener("click", resetAccent);
    document.getElementById("reset-card").addEventListener("click", resetCard);
    document.getElementById("reset-underline").addEventListener("click", resetUnderline);
    document.getElementById("reset-glow-color").addEventListener("click", resetGlowColor);
    document.getElementById("reset-glow-strength").addEventListener("click", resetGlowStrength);
    document.getElementById("reset-glow-ring").addEventListener("click", resetGlowRing);

    cardColorInput.addEventListener("input", () => {
        const color = normalizeHex(cardColorInput.value);
        if (!color) return;
        syncedCard = color === currentAccent;
        setColorInput(cardColorInput, color);
        save({ highlightCardColor: syncedCard ? "" : color });
    });

    underlineColorInput.addEventListener("input", () => {
        const color = normalizeHex(underlineColorInput.value);
        if (!color) return;
        syncedUnderline = color === currentAccent;
        setColorInput(underlineColorInput, color);
        save({ highlightUnderlineColor: syncedUnderline ? "" : color });
    });

    glowColorInput.addEventListener("input", () => {
        const color = normalizeHex(glowColorInput.value);
        if (!color) return;
        syncedGlow = color === currentAccent;
        setColorInput(glowColorInput, color);
        save({ highlightGlowColor: syncedGlow ? "" : color });
    });

    cardWidthInput.addEventListener("input", () => {
        cardWidthValue.textContent = cardWidthInput.value + "px";
    });
    cardWidthInput.addEventListener("change", () => {
        save({ highlightCardWidth: parseInt(cardWidthInput.value, 10) });
    });

    underlineWidthInput.addEventListener("input", () => {
        underlineWidthValue.textContent = underlineWidthInput.value + "px";
    });
    underlineWidthInput.addEventListener("change", () => {
        save({ highlightUnderlineWidth: parseInt(underlineWidthInput.value, 10) });
    });

    glowStrengthInput.addEventListener("input", () => {
        glowStrengthValue.textContent = glowStrengthInput.value;
    });
    glowStrengthInput.addEventListener("change", () => {
        save({ highlightGlowStrength: parseInt(glowStrengthInput.value, 10) });
    });

    glowRingInput.addEventListener("input", () => {
        glowRingValue.textContent = glowRingInput.value + "px";
    });
    glowRingInput.addEventListener("change", () => {
        save({ highlightGlowRingWidth: parseInt(glowRingInput.value, 10) });
    });
});
