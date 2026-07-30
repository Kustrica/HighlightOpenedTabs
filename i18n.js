if (typeof browser === "undefined") {
    var browser = chrome;
}

window.i18nDict = null;

window.initI18n = async function () {
    const res = await browser.storage.local.get("ui_language");
    const lang = res.ui_language || "auto";
    if (lang === "auto") {
        window.i18nDict = null;
        return;
    }
    try {
        const req = await fetch(browser.runtime.getURL(`_locales/${lang}/messages.json`));
        window.i18nDict = await req.json();
    } catch (_) {
        window.i18nDict = null;
    }
};

window.getMessage = function (key, params) {
    if (window.i18nDict && window.i18nDict[key]) {
        let msg = window.i18nDict[key].message;
        if (params) {
            if (!Array.isArray(params)) params = [params];
            params.forEach((p, i) => {
                msg = msg.replace(new RegExp(`\\$${i + 1}`, "g"), p);
            });
        }
        return msg;
    }
    return browser.i18n.getMessage(key, params);
};
