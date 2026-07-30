const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "_locales");
const en = JSON.parse(fs.readFileSync(path.join(root, "en", "messages.json"), "utf8"));
const ru = JSON.parse(fs.readFileSync(path.join(root, "ru", "messages.json"), "utf8"));

const overwriteFromEn = new Set([
    "sectionTabsTitle",
    "sectionLinkHighlightTitle",
    "showCounterLabel",
    "showCounterDesc",
    "enableDuplicateHighlightLabel",
    "enableDuplicateHighlightDesc",
    "enableHoverHighlightLabel",
    "enableHoverHighlightDesc",
    "hoverDelayDesc",
    "autoHideDelayLabel",
    "autoHideDelayDesc",
    "unhighlightOnWindowLeaveLabel",
    "unhighlightOnWindowLeaveDesc",
    "linkHighlightEnabledLabel",
    "linkHighlightEnabledDesc",
    "linkHighlightScopeLabel",
    "linkHighlightScopeHiddenOnly",
    "linkHighlightScopeHiddenDesc",
    "linkHighlightScopeAlways",
    "linkHighlightScopeAlwaysDesc",
    "linkHighlightStylesLabel",
    "linkHighlightCardLabel",
    "linkHighlightCardDesc",
    "linkHighlightUnderlineLabel",
    "linkHighlightUnderlineDesc",
    "linkHighlightGlowLabel",
    "linkHighlightGlowDesc"
]);

for (const locale of fs.readdirSync(root)) {
    if (locale === "en" || locale === "ru") continue;
    const filePath = path.join(root, locale, "messages.json");
    if (!fs.existsSync(filePath)) continue;
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    for (const key of Object.keys(en)) {
        if (!data[key] || overwriteFromEn.has(key)) {
            data[key] = { message: en[key].message };
            if (en[key].description) data[key].description = en[key].description;
        }
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
    console.log("updated", locale);
}

console.log("done");
