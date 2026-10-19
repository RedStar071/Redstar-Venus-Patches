// Benchmark translateTarget on Hermes HBC98:
// Old: runs localeCode(...), regex /^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})*$/, .replace("_", "-"), .split("-"), and .toLowerCase() on EVERY message row render and reply render!
// New: caches the resolved target code keyed on (settings.translateTarget, rawLocale), recomputing only when the setting or locale changes.

const settings = { translateTarget: "discord" };
const localeStore = { locale: "en-US", systemLocale: "en_US" };
const translate = { targetMode: null, targetRaw: null, targetCode: "" };

function localeCode(kind) {
    let value = null;
    try { value = localeStore && (kind === "phone" ? localeStore.systemLocale : localeStore.locale); } catch (_) {}
    if (typeof value !== "string" || !/^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})*$/.test(value)) value = kind === "phone" ? localeCode("discord") : "en-US";
    return value.replace("_", "-");
}

function translateTargetOld() {
    const locale = localeCode(settings.translateTarget === "phone" ? "phone" : "discord");
    const parts = locale.split("-"), base = parts[0].toLowerCase();
    if (base === "zh") return /^(TW|HK|MO|Hant)$/i.test(parts[1] || "") ? "zh-TW" : "zh-CN";
    if (base === "nb" || base === "nn") return "no";
    return base;
}

function translateTargetNew() {
    const mode = settings.translateTarget === "phone" ? "phone" : "discord";
    let raw = null;
    try { raw = localeStore && (mode === "phone" ? localeStore.systemLocale || localeStore.locale : localeStore.locale); } catch (_) {}
    if (mode === translate.targetMode && raw === translate.targetRaw && translate.targetCode) return translate.targetCode;
    const locale = localeCode(mode);
    const parts = locale.split("-"), base = parts[0].toLowerCase();
    const out = base === "zh" ? (/^(TW|HK|MO|Hant)$/i.test(parts[1] || "") ? "zh-TW" : "zh-CN") : (base === "nb" || base === "nn") ? "no" : base;
    translate.targetMode = mode;
    translate.targetRaw = raw;
    translate.targetCode = out;
    return out;
}

bench("translateTarget: regex + replace + split + toLowerCase per row (old, 32 rows)", function () {
    let n = 0;
    for (let i = 0; i < 32; i++) {
        n += translateTargetOld().length;
    }
    return n;
});

bench("translateTarget: cached by (mode, localeStore.locale) (new, 32 rows)", function () {
    let n = 0;
    for (let i = 0; i < 32; i++) {
        n += translateTargetNew().length;
    }
    return n;
});
