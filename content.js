if (typeof browser === "undefined") {
    var browser = chrome;
}

(function () {
    if (globalThis.__highlightOpenedTabsInjected) return;
    globalThis.__highlightOpenedTabsInjected = true;

let hoverTimeout = null;
let pendingLinkUrl = null;
let pendingLinkEl = null;
let activeHoverUrl = null;
let activeHoverLink = null;
let highlightActive = false;
let hoverDelay = 10;
let unhighlightOnWindowLeave = true;
let enableHoverHighlight = true;
let showCounter = true;
let clearLock = false;
let ringListenersAttached = false;
let lastMouseX = 0;
let lastMouseY = 0;

const HIGHLIGHT_ROOT_ID = "highlight-opened-tabs-root";
const RING_PAD = 3;
const UNDERLINE_COVER_OFFSET = 3;
const DEFAULT_HIGHLIGHT_COLOR = "#ff9400";

const CARD_HINT_SELECTOR = [
    ".g",
    "[data-sokoban-container]",
    "ytd-rich-item-renderer",
    "ytd-grid-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-video-renderer",
    "ytd-playlist-renderer",
    "article",
    "[data-testid*='card']",
    "li[data-testid]"
].join(",");

const KNOWN_CARD_SELECTOR = CARD_HINT_SELECTOR;

const DEFAULT_LINK_HIGHLIGHT = {
    linkHighlightEnabled: true,
    linkHighlightScope: "always",
    linkHighlightCard: false,
    linkHighlightUnderline: false,
    linkHighlightGlow: true,
    highlightColor: DEFAULT_HIGHLIGHT_COLOR,
    highlightCardColor: "",
    highlightUnderlineColor: "",
    highlightGlowColor: "",
    highlightCardWidth: 1,
    highlightUnderlineWidth: 1,
    highlightGlowStrength: 40,
    highlightGlowRingWidth: 1
};

let linkHighlight = { ...DEFAULT_LINK_HIGHLIGHT };

function rectArea(rect) {
    return Math.max(0, rect.width) * Math.max(0, rect.height);
}

function unionRects(rects) {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const rect of rects) {
        if (!rect || (!rect.width && !rect.height)) continue;
        left = Math.min(left, rect.left);
        top = Math.min(top, rect.top);
        right = Math.max(right, rect.right);
        bottom = Math.max(bottom, rect.bottom);
    }
    if (!isFinite(left)) return null;
    return { left, top, width: right - left, height: bottom - top, right, bottom };
}

function padRect(rect, pad = RING_PAD) {
    return {
        left: rect.left - pad,
        top: rect.top - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2
    };
}

function scoreCardCandidate(el, link) {
    const rect = el.getBoundingClientRect();
    const area = rectArea(rect);
    if (area < 320 || rect.width < 80 || rect.height < 24) return 0;

    const links = [...el.querySelectorAll("a[href]")].filter(a => {
        try {
            return a.href.startsWith("http");
        } catch (_) {
            return false;
        }
    });
    const hrefs = new Set(links.map(a => a.href));
    if (hrefs.size > 4) return 0;

    let score = 0;
    if (el.matches && el.matches(KNOWN_CARD_SELECTOR)) score += 60;
    if (links.some(a => a.href === link.href)) score += 25;
    if (el.querySelector("h1, h2, h3, h4")) score += 15;

    const linkArea = rectArea(link.getBoundingClientRect());
    if (area > linkArea * 1.4) score += 10;
    if (area < linkArea * 1.1) score -= 20;

    const viewportArea = window.innerWidth * window.innerHeight;
    if (area > viewportArea * 0.45) score -= 80;

    return score;
}

function findCardContainer(link) {
    let best = null;
    let bestScore = 0;
    for (let el = link.parentElement, depth = 0; el && depth < 12; el = el.parentElement, depth++) {
        if (el === document.body || el === document.documentElement) break;
        const score = scoreCardCandidate(el, link);
        if (score > bestScore) {
            bestScore = score;
            best = el;
        }
    }
    return bestScore >= 20 ? best : null;
}

function getCardRect(link) {
    const card = findCardContainer(link);
    if (card) {
        return padRect(card.getBoundingClientRect());
    }

    const rects = [link.getBoundingClientRect()];
    for (const media of link.querySelectorAll("img, video, picture, ytd-thumbnail")) {
        const mediaRect = media.getBoundingClientRect();
        if (rectArea(mediaRect) > 64) rects.push(mediaRect);
    }
    return padRect(unionRects(rects) || link.getBoundingClientRect());
}

function getLinkTextLineRects(link) {
    const rects = [];
    try {
        const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        });
        let textNode;
        while ((textNode = walker.nextNode())) {
            const range = document.createRange();
            range.selectNodeContents(textNode);
            for (const rect of range.getClientRects()) {
                if (rect.width > 1 && rect.height > 0) rects.push(rect);
            }
        }
    } catch (_) {}

    if (rects.length === 0) {
        try {
            const range = document.createRange();
            range.selectNodeContents(link);
            rects.push(...range.getClientRects());
        } catch (_) {}
    }

    const filtered = rects.filter(r => r.width > 1 && r.height > 0);
    if (filtered.length > 0) return filtered;

    const box = link.getBoundingClientRect();
    return [box];
}

function getUnderlineRectsAtPoint(link, clientX, clientY) {
    const lineRects = getLinkTextLineRects(link);
    if (lineRects.length <= 1 || !Number.isFinite(clientY)) return lineRects;

    const onLine = lineRects.filter(rect => clientY >= rect.top - 2 && clientY <= rect.bottom + 2);
    if (onLine.length > 0) return onLine;

    let best = lineRects[0];
    let bestDistance = Infinity;
    for (const rect of lineRects) {
        const midY = (rect.top + rect.bottom) / 2;
        const distance = Math.abs(clientY - midY);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = rect;
        }
    }
    return [best];
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function normalizeHexColor(hex) {
    if (!hex || typeof hex !== "string") return null;
    const trimmed = hex.trim();
    if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
        return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
    }
    return null;
}

function hexToRgb(hex) {
    const normalized = normalizeHexColor(hex) || DEFAULT_HIGHLIGHT_COLOR;
    return {
        r: parseInt(normalized.slice(1, 3), 16),
        g: parseInt(normalized.slice(3, 5), 16),
        b: parseInt(normalized.slice(5, 7), 16)
    };
}

function rgbaFromHex(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
}

function resolveHighlightColor(specific, general) {
    return normalizeHexColor(specific) || normalizeHexColor(general) || DEFAULT_HIGHLIGHT_COLOR;
}

function getHighlightAppearance() {
    const accent = resolveHighlightColor(linkHighlight.highlightColor, DEFAULT_HIGHLIGHT_COLOR);
    const strength = clamp(Number(linkHighlight.highlightGlowStrength) || 40, 0, 100);
    return {
        accent,
        cardColor: resolveHighlightColor(linkHighlight.highlightCardColor, accent),
        underlineColor: resolveHighlightColor(linkHighlight.highlightUnderlineColor, accent),
        glowColor: resolveHighlightColor(linkHighlight.highlightGlowColor, accent),
        cardWidth: clamp(Number(linkHighlight.highlightCardWidth) || 1, 1, 6),
        underlineWidth: clamp(Number(linkHighlight.highlightUnderlineWidth) || 2, 1, 6),
        glowStrength: strength,
        glowRingWidth: clamp(Number(linkHighlight.highlightGlowRingWidth) || 1, 0, 4),
        glowBlur: 6 + (strength / 100) * 18,
        glowSpread: 1 + (strength / 100) * 6,
        glowAlpha: 0.08 + (strength / 100) * 0.22,
        ringAlpha: 0.12 + (strength / 100) * 0.2
    };
}

function underlineRectFromLineRect(rect, thickness) {
    const height = clamp(thickness, 1, 6);
    return {
        left: rect.left,
        top: rect.bottom - UNDERLINE_COVER_OFFSET,
        width: rect.width,
        height
    };
}

function applyFixedRect(el, rect) {
    el.style.position = "fixed";
    el.style.left = "0";
    el.style.top = "0";
    el.style.width = `${Math.max(0, rect.width)}px`;
    el.style.height = `${Math.max(0, rect.height)}px`;
    el.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    el.style.willChange = "transform";
}

function hasActiveHighlightStyles() {
    return linkHighlight.linkHighlightCard ||
        linkHighlight.linkHighlightUnderline ||
        linkHighlight.linkHighlightGlow;
}

function hideLinkHighlight() {
    highlightActive = false;
    activeHoverLink = null;
    if (repositionFrame) {
        cancelAnimationFrame(repositionFrame);
        repositionFrame = null;
    }
    detachRingPositionListeners();
    document.getElementById(HIGHLIGHT_ROOT_ID)?.remove();
}

function buildHighlightLayers(root, linkEl) {
    root.replaceChildren();

    const cardRect = getCardRect(linkEl);
    const appearance = getHighlightAppearance();

    if (linkHighlight.linkHighlightCard || linkHighlight.linkHighlightGlow) {
        const box = document.createElement("div");
        box.className = "hot-layer hot-box";
        box.style.boxSizing = "border-box";
        box.style.borderRadius = "6px";
        applyFixedRect(box, cardRect);
        if (linkHighlight.linkHighlightCard) {
            box.style.border = `${appearance.cardWidth}px solid ${rgbaFromHex(appearance.cardColor, 0.85)}`;
            box.style.background = rgbaFromHex(appearance.cardColor, 0.06);
        }
        if (linkHighlight.linkHighlightGlow) {
            const ring = appearance.glowRingWidth;
            const ringPart = ring > 0
                ? `0 0 0 ${ring}px ${rgbaFromHex(appearance.glowColor, appearance.ringAlpha)}`
                : "";
            const glowPart = `0 0 ${appearance.glowBlur}px ${appearance.glowSpread}px ${rgbaFromHex(appearance.glowColor, appearance.glowAlpha)}`;
            box.style.boxShadow = ringPart ? `${ringPart}, ${glowPart}` : glowPart;
        }
        root.appendChild(box);
    }

    if (linkHighlight.linkHighlightUnderline) {
        for (const rect of getUnderlineRectsAtPoint(linkEl, lastMouseX, lastMouseY)) {
            const line = document.createElement("div");
            line.className = "hot-layer hot-underline";
            line.style.borderRadius = "1px";
            line.style.background = rgbaFromHex(appearance.underlineColor, 0.95);
            applyFixedRect(line, underlineRectFromLineRect(rect, appearance.underlineWidth));
            root.appendChild(line);
        }
    }
}

function repositionHighlightLayers() {
    const root = document.getElementById(HIGHLIGHT_ROOT_ID);
    if (!root || !activeHoverLink || !activeHoverLink.isConnected) return;

    const linkEl = activeHoverLink;
    const cardRect = getCardRect(linkEl);
    const box = root.querySelector(".hot-box");
    if (box) applyFixedRect(box, cardRect);

    const lineRects = linkHighlight.linkHighlightUnderline
        ? getUnderlineRectsAtPoint(linkEl, lastMouseX, lastMouseY)
        : [];
    const underlines = [...root.querySelectorAll(".hot-underline")];
    if (underlines.length !== lineRects.length) {
        buildHighlightLayers(root, linkEl);
        return;
    }
    lineRects.forEach((rect, index) => {
        const appearance = getHighlightAppearance();
        applyFixedRect(underlines[index], underlineRectFromLineRect(rect, appearance.underlineWidth));
        underlines[index].style.background = rgbaFromHex(appearance.underlineColor, 0.95);
    });
}

let repositionFrame = null;

function scheduleReposition() {
    if (repositionFrame) return;
    repositionFrame = requestAnimationFrame(() => {
        repositionFrame = null;
        repositionHighlightLayers();
    });
}

function renderLinkHighlight(linkEl) {
    if (window.top !== window || !linkEl || !linkEl.isConnected) return;
    if (!linkHighlight.linkHighlightEnabled || !hasActiveHighlightStyles()) {
        hideLinkHighlight();
        return;
    }

    let root = document.getElementById(HIGHLIGHT_ROOT_ID);
    if (!root) {
        root = document.createElement("div");
        root.id = HIGHLIGHT_ROOT_ID;
        root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483646;";
        document.documentElement.appendChild(root);
        attachRingPositionListeners();
    }

    highlightActive = true;
    activeHoverLink = linkEl;
    buildHighlightLayers(root, linkEl);
}

function updateLinkHighlightPosition(linkEl) {
    if (!highlightActive || !linkEl || !linkEl.isConnected) return;
    activeHoverLink = linkEl;
    scheduleReposition();
}

function onRingReposition() {
    if (highlightActive && activeHoverLink) {
        scheduleReposition();
    }
}

function attachRingPositionListeners() {
    if (ringListenersAttached) return;
    ringListenersAttached = true;
    window.addEventListener("scroll", onRingReposition, { passive: true, capture: true });
    window.addEventListener("resize", onRingReposition, { passive: true });
}

function detachRingPositionListeners() {
    if (!ringListenersAttached) return;
    ringListenersAttached = false;
    window.removeEventListener("scroll", onRingReposition, true);
    window.removeEventListener("resize", onRingReposition);
}

function applyLinkHighlightSettings(data) {
    linkHighlight = {
        linkHighlightEnabled: data.linkHighlightEnabled !== false,
        linkHighlightScope: data.linkHighlightScope === "hidden_only" ? "hidden_only" : "always",
        linkHighlightCard: data.linkHighlightCard === true,
        linkHighlightUnderline: data.linkHighlightUnderline === true,
        linkHighlightGlow: data.linkHighlightGlow !== false,
        highlightColor: resolveHighlightColor(data.highlightColor, DEFAULT_HIGHLIGHT_COLOR),
        highlightCardColor: normalizeHexColor(data.highlightCardColor) || "",
        highlightUnderlineColor: normalizeHexColor(data.highlightUnderlineColor) || "",
        highlightGlowColor: normalizeHexColor(data.highlightGlowColor) || "",
        highlightCardWidth: clamp(Number(data.highlightCardWidth) || 1, 1, 6),
        highlightUnderlineWidth: clamp(Number(data.highlightUnderlineWidth) || 1, 1, 6),
        highlightGlowStrength: clamp(Number(data.highlightGlowStrength) ?? 40, 0, 100),
        highlightGlowRingWidth: clamp(Number(data.highlightGlowRingWidth) ?? 1, 0, 4)
    };
}

function loadSettings(data) {
    hoverDelay = Math.max(1, Number.isFinite(data.hoverDelay) ? data.hoverDelay : 10);
    unhighlightOnWindowLeave = data.unhighlightOnWindowLeave !== false;
    enableHoverHighlight = data.enableHoverHighlight !== false;
    showCounter = data.showCounter !== false;
    applyLinkHighlightSettings({ ...DEFAULT_LINK_HIGHLIGHT, ...data });
}

browser.storage.local.get({
    hoverDelay: 10,
    unhighlightOnWindowLeave: true,
    enableHoverHighlight: true,
    showCounter: true,
    ...DEFAULT_LINK_HIGHLIGHT
}).then(loadSettings);

function hoverTrackingEnabled() {
    return enableHoverHighlight || showCounter;
}

browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const patch = {};
    for (const key of [
        "hoverDelay",
        "unhighlightOnWindowLeave",
        "enableHoverHighlight",
        "showCounter",
        "linkHighlightEnabled",
        "linkHighlightScope",
        "linkHighlightCard",
        "linkHighlightUnderline",
        "linkHighlightGlow",
        "highlightColor",
        "highlightCardColor",
        "highlightUnderlineColor",
        "highlightGlowColor",
        "highlightCardWidth",
        "highlightUnderlineWidth",
        "highlightGlowStrength",
        "highlightGlowRingWidth"
    ]) {
        if (changes[key]) patch[key] = changes[key].newValue;
    }
    if (Object.keys(patch).length === 0) return;
    loadSettings({ ...linkHighlight, ...patch });
    if (!hoverTrackingEnabled()) endHoverIfNeeded();
    else if (highlightActive && activeHoverLink) renderLinkHighlight(activeHoverLink);
});

browser.runtime.onMessage.addListener((message) => {
    if (message.action === "SETTINGS_UPDATED" && message.settings) {
        loadSettings({ ...linkHighlight, ...message.settings });
        if (!hoverTrackingEnabled()) endHoverIfNeeded();
        else if (highlightActive && activeHoverLink) renderLinkHighlight(activeHoverLink);
    }
});

function cancelHoverTimer() {
    if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
    }
    pendingLinkUrl = null;
    pendingLinkEl = null;
}

function sendHoverStart(url, linkEl) {
    browser.runtime.sendMessage({ action: "HOVER_LINK", url })
        .then(result => {
            if (activeHoverUrl !== url) return;
            if (result && result.showLinkHighlight) {
                renderLinkHighlight(linkEl);
            } else {
                hideLinkHighlight();
            }
        })
        .catch(() => hideLinkHighlight());
}

function sendHoverEnd() {
    browser.runtime.sendMessage({ action: "HOVER_END" }).catch(() => {});
}

function clearHighlights(action) {
    if (clearLock) return;
    clearLock = true;
    cancelHoverTimer();
    activeHoverUrl = null;
    hideLinkHighlight();
    browser.runtime.sendMessage({ action }).catch(() => {});
    setTimeout(() => {
        clearLock = false;
    }, 160);
}

function pickPrimaryLink(links) {
    if (links.length === 0) return null;
    if (links.length === 1) return links[0];
    const titled = links.find(a => a.querySelector("h1, h2, h3, h4"));
    if (titled) return titled;
    const watch = links.find(a => /\/watch|\/shorts\//.test(a.href));
    if (watch) return watch;
    return links.reduce((best, current) => {
        const bestArea = rectArea(best.getBoundingClientRect());
        const currentArea = rectArea(current.getBoundingClientRect());
        return currentArea > bestArea ? current : best;
    });
}

function getDirectHttpLink(target) {
    if (!target || typeof target.closest !== "function") return null;
    const direct = target.closest("a[href]");
    if (direct?.href?.startsWith("http")) return direct;
    return null;
}

function getHttpLink(target) {
    const direct = getDirectHttpLink(target);
    if (direct) return direct;

    const card = target.closest(CARD_HINT_SELECTOR);
    if (!card) return null;

    const links = [...card.querySelectorAll("a[href]")].filter(a => {
        try {
            return a.href.startsWith("http");
        } catch (_) {
            return false;
        }
    });
    return pickPrimaryLink(links);
}

function getHighlightLink(target, clientX, clientY) {
    const direct = getDirectHttpLink(target);
    if (direct) return direct;

    if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
        const hit = document.elementFromPoint(clientX, clientY);
        const hitLink = getDirectHttpLink(hit);
        if (hitLink) return hitLink;
    }

    return getHttpLink(target);
}

function scheduleHover(url, linkEl) {
    if (!hoverTrackingEnabled()) return;
    if (!url || !linkEl) return;
    if (url === activeHoverUrl) {
        if (highlightActive) updateLinkHighlightPosition(linkEl);
        return;
    }
    if (url === pendingLinkUrl && hoverTimeout) return;

    cancelHoverTimer();
    pendingLinkUrl = url;
    pendingLinkEl = linkEl;
    hoverTimeout = setTimeout(() => {
        hoverTimeout = null;
        if (!hoverTrackingEnabled()) return;
        if (pendingLinkUrl !== url) return;
        activeHoverUrl = url;
        pendingLinkUrl = null;
        const el = pendingLinkEl;
        pendingLinkEl = null;
        sendHoverStart(url, el);
    }, hoverDelay);
}

function endHoverIfNeeded() {
    const hadPending = Boolean(hoverTimeout);
    const hadActive = Boolean(activeHoverUrl);
    cancelHoverTimer();
    if (!hadPending && !hadActive) return;
    activeHoverUrl = null;
    hideLinkHighlight();
    sendHoverEnd();
}

document.addEventListener("mousemove", (e) => {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    if (!hoverTrackingEnabled()) {
        endHoverIfNeeded();
        return;
    }
    const link = getHttpLink(e.target);
    if (!link) {
        endHoverIfNeeded();
        return;
    }
    const highlightLink = getHighlightLink(e.target, e.clientX, e.clientY) || link;
    if (highlightActive && activeHoverUrl === link.href && activeHoverLink !== highlightLink) {
        activeHoverLink = highlightLink;
        renderLinkHighlight(highlightLink);
    }
    scheduleHover(link.href, highlightLink);
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
})();
