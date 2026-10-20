// Benchmark parseThemeColorUncached on Hermes HBC98.
function parseAlphaValue(rawAlpha) {
    if (rawAlpha === undefined || rawAlpha === null || rawAlpha === "") return 1;
    var s = String(rawAlpha).trim();
    var a = s.endsWith("%") ? parseFloat(s) / 100 : parseFloat(s);
    if (!Number.isFinite(a)) return null;
    return Math.max(0, Math.min(1, a));
}

function parseThemeColorUncachedOld(value) {
    var s = value.trim();
    if (!s) return null;
    var compact = s.replace(/\s+/g, "");
    if (/^#?transparent$/i.test(compact)) return {hex: "#000000", opacity: 0};
    var m = /^#([0-9a-f]{3,8})$/i.exec(compact) || /^([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(compact);
    if (m) {
        var hex = m[1].toLowerCase();
        if (hex.length === 3) return {hex: "#" + hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2], opacity: 1};
        if (hex.length === 4) {
            var a = parseInt(hex[3] + hex[3], 16) / 255;
            return {hex: "#" + hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2], opacity: Number(a.toFixed(4))};
        }
        if (hex.length === 6) return {hex: "#" + hex, opacity: 1};
        if (hex.length === 8) {
            var a2 = parseInt(hex.slice(6, 8), 16) / 255;
            return {hex: "#" + hex.slice(0, 6), opacity: Number(a2.toFixed(4))};
        }
        return null;
    }
    m = /^rgba?\(\s*([0-9.]+%?)\s*(?:,\s*|\s+)([0-9.]+%?)\s*(?:,\s*|\s+)([0-9.]+%?)(?:\s*[,/]\s*([0-9.]+%?))?\s*\)$/i.exec(s);
    if (m) {
        var chan = function (part) {
            var v = part.endsWith("%") ? parseFloat(part) * 2.55 : parseFloat(part);
            return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
        };
        var a3 = parseAlphaValue(m[4]);
        if (a3 === null) return null;
        return {hex: "#" + chan(m[1]) + chan(m[2]) + chan(m[3]), opacity: Number(a3.toFixed(4))};
    }
    return null;
}

var HEX6_CLEAN_RE = /^#[0-9a-f]{6}$/;
var HEX8_CLEAN_RE = /^#[0-9a-f]{8}$/;
var WHITESPACE_RE = /\s/;
function parseThemeColorUncachedNew(value) {
    // Fast path for clean lowercase #rrggbb and #rrggbbaa (>90% of theme colors)
    var len = value.length;
    if (len === 7 && value.charCodeAt(0) === 35 && HEX6_CLEAN_RE.test(value)) {
        return {hex: value, opacity: 1};
    }
    if (len === 9 && value.charCodeAt(0) === 35 && HEX8_CLEAN_RE.test(value)) {
        var aFast = parseInt(value.slice(7, 9), 16) / 255;
        return {hex: value.slice(0, 7), opacity: Math.round(aFast * 10000) / 10000};
    }
    var s = value.trim();
    if (!s) return null;
    var compact = WHITESPACE_RE.test(s) ? s.replace(/\s+/g, "") : s;
    if (/^#?transparent$/i.test(compact)) return {hex: "#000000", opacity: 0};
    var m = /^#([0-9a-f]{3,8})$/i.exec(compact) || /^([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(compact);
    if (m) {
        var hex = m[1].toLowerCase();
        if (hex.length === 3) return {hex: "#" + hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2], opacity: 1};
        if (hex.length === 4) {
            var a = parseInt(hex[3] + hex[3], 16) / 255;
            return {hex: "#" + hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2], opacity: Math.round(a * 10000) / 10000};
        }
        if (hex.length === 6) return {hex: "#" + hex, opacity: 1};
        if (hex.length === 8) {
            var a2 = parseInt(hex.slice(6, 8), 16) / 255;
            return {hex: "#" + hex.slice(0, 6), opacity: Math.round(a2 * 10000) / 10000};
        }
        return null;
    }
    m = /^rgba?\(\s*([0-9.]+%?)\s*(?:,\s*|\s+)([0-9.]+%?)\s*(?:,\s*|\s+)([0-9.]+%?)(?:\s*[,/]\s*([0-9.]+%?))?\s*\)$/i.exec(s);
    if (m) {
        var chan = function (part) {
            var v = part.endsWith("%") ? parseFloat(part) * 2.55 : parseFloat(part);
            return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
        };
        var a3 = parseAlphaValue(m[4]);
        if (a3 === null) return null;
        return {hex: "#" + chan(m[1]) + chan(m[2]) + chan(m[3]), opacity: Math.round(a3 * 10000) / 10000};
    }
    return null;
}

var themeColors = [
    "#1e1f22", "#2b2d31", "#313338", "#f2f3f5", "#dbdee1", "#949ba4", "#5865f2", "#23a55a",
    "#f0b232", "#f23f43", "#1e1f22cc", "#2b2d3180", "#5865f21a", "#FFFFFF", "#abc", "#abcd",
    "rgba(88, 101, 242, 0.25)", "transparent", "#00000000", "ff00ff"
];
for (var i = 0; i < themeColors.length; i++) {
    var o = parseThemeColorUncachedOld(themeColors[i]);
    var n = parseThemeColorUncachedNew(themeColors[i]);
    if (JSON.stringify(o) !== JSON.stringify(n)) throw new Error("Mismatch on " + themeColors[i] + ": " + JSON.stringify(o) + " vs " + JSON.stringify(n));
}

bench("old parseThemeColorUncached (20 theme colors)", function () {
    for (var i = 0; i < themeColors.length; i++) parseThemeColorUncachedOld(themeColors[i]);
});
bench("new parseThemeColorUncached (20 theme colors)", function () {
    for (var i = 0; i < themeColors.length; i++) parseThemeColorUncachedNew(themeColors[i]);
});
