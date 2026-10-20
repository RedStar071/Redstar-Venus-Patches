// Benchmark snapshotColorTables + compileThemeIntoTables on Hermes HBC98.
var THEME_SLOTS = ["dark", "light", "darker", "midnight"];
var CHAT_SURFACE_TOKENS = [
    "CHANNEL_BACKGROUND_DEFAULT",
    "STANDALONE_CHANNEL_CONTENT_BACKGROUND",
    "BACKGROUND_BASE_LOWER",
    "PANEL_BG",
    "MOBILE_TYPING_INDICATOR_BACKGROUND_DEFAULT",
    "MOBILE_KEYBOARD_GAP_BACKGROUND"
];
var PLUS_STATUS_ICON_MAP = {
    StatusOnline: {raw: ["GREEN_360"], sem: ["STATUS_ONLINE", "ICON_STATUS_ONLINE", "TEXT_STATUS_ONLINE"]},
    StatusMobileOnline: {raw: ["GREEN_360"], sem: ["STATUS_ONLINE", "ICON_STATUS_ONLINE"]},
    StatusIdle: {raw: ["YELLOW_300"], sem: ["ICON_STATUS_IDLE", "TEXT_STATUS_IDLE"]},
    StatusDND: {raw: ["RED_400"], sem: ["ICON_STATUS_DND", "TEXT_STATUS_DND"]},
    StatusOffline: {raw: ["PRIMARY_400"], sem: ["ICON_STATUS_OFFLINE", "TEXT_STATUS_OFFLINE"]},
    StatusStreaming: {raw: ["PLATFORM_TWITCH"], sem: []}
};
var LEGACY_RAW_BRIDGES = [
    ["NEUTRAL_100", ["PLUM_24", "PLUM_23", "PRIMARY_830", "PRIMARY_800", "BLACK"]],
    ["NEUTRAL_96", ["PLUM_23", "PLUM_22", "PRIMARY_800", "PRIMARY_730"]],
    ["NEUTRAL_92", ["PLUM_22", "PLUM_20", "PRIMARY_730", "PRIMARY_700"]],
    ["BLURPLE_50", ["BRAND_500", "BRAND_560"]]
];
var LEGACY_SEMANTIC_ALIASES = {
    BACKGROUND_PRIMARY: ["BACKGROUND_BASE_LOW", "CHANNEL_BACKGROUND_DEFAULT", "PANEL_BG"],
    BACKGROUND_SECONDARY: ["BACKGROUND_BASE_LOWER", "CARD_BACKGROUND_DEFAULT"],
    TEXT_NORMAL: ["TEXT_DEFAULT", "CHAT_MESSAGE_TEXT"],
    TEXT_MUTED: ["TEXT_MUTED_DEFAULT"]
};
var settings = {customThemesBackground: true};
function owns(obj, key) { return obj != null && Object.prototype.hasOwnProperty.call(obj, key); }

var parsedColorCache = new Map();
var HEX6_CLEAN_RE = /^#[0-9a-f]{6}$/;
function parseThemeColor(value) {
    if (typeof value !== "string") return null;
    var hit = parsedColorCache.get(value);
    if (hit !== undefined) return hit;
    if (value.length === 7 && value.charCodeAt(0) === 35 && HEX6_CLEAN_RE.test(value)) {
        hit = Object.freeze({hex: value, opacity: 1});
    } else {
        hit = Object.freeze({hex: value.slice(0, 7).toLowerCase(), opacity: 1});
    }
    parsedColorCache.set(value, hit);
    return hit;
}
function formatThemeColor(p) { return p.hex; }

// Build realistic RawColors (400 keys) and SemanticColors (150 keys)
function makeTables() {
    var rawTable = {}, semTable = {};
    for (var i = 0; i < 400; i++) rawTable["COLOR_" + i] = "#1e1f22";
    rawTable.PLUM_24 = "#111214"; rawTable.BRAND_500 = "#5865f2";
    var semKeys = ["BACKGROUND_BASE_LOW", "CHANNEL_BACKGROUND_DEFAULT", "PANEL_BG", "BACKGROUND_BASE_LOWER", "CARD_BACKGROUND_DEFAULT", "TEXT_DEFAULT", "CHAT_MESSAGE_TEXT", "TEXT_MUTED_DEFAULT"];
    for (var j = 0; j < 150; j++) {
        var k = j < semKeys.length ? semKeys[j] : "TOKEN_" + j;
        semTable[k] = {
            dark: {raw: "COLOR_1", opacity: 1},
            light: {raw: "COLOR_2", opacity: 1},
            darker: {raw: "COLOR_3", opacity: 1},
            midnight: {raw: "COLOR_4", opacity: 1}
        };
    }
    return {rawTable: rawTable, semTable: semTable, expTable: null, origRaw: null, origSem: null, origExp: null, journal: null};
}

var sampleTheme = {
    id: "t1",
    rawColors: {PRIMARY_800: "#141518", BRAND_500: "#7289da"},
    semanticColors: {
        BACKGROUND_PRIMARY: ["#18191c", "#ffffff", "#000000"],
        BACKGROUND_SECONDARY: ["#202225", "#f2f3f5", "#08080a"],
        TEXT_NORMAL: ["#dcddde", "#2e3338", "#ffffff"],
        TEXT_MUTED: ["#72767d", "#747f8d", "#8e9297"],
        TOKEN_10: ["#ff0055", "#ff0055", "#ff0055"],
        TOKEN_20: ["#00ffaa"]
    },
    background: {url: "https://example.com/bg.png", alpha: 0.85, color: "#101114"}
};

function compileOld(customThemes, theme) {
    var rawTable = customThemes.rawTable, sem = customThemes.semTable;
    if (!customThemes.origRaw) {
        var copy = {};
        for (var k of Object.keys(rawTable)) copy[k] = rawTable[k];
        customThemes.origRaw = copy;
    }
    if (!customThemes.origSem) {
        var copy2 = {};
        for (var k2 of Object.keys(sem)) {
            var entry = sem[k2];
            if (!entry || typeof entry !== "object") continue;
            var snap = {};
            for (var slot of THEME_SLOTS) {
                if (entry[slot] && typeof entry[slot] === "object")
                    snap[slot] = {raw: entry[slot].raw, opacity: entry[slot].opacity};
            }
            copy2[k2] = snap;
        }
        customThemes.origSem = copy2;
    }
    if (!customThemes.journal) customThemes.journal = {raw: new Set(), sem: new Set(), exp: [], rawTable: rawTable, semTable: sem};
    var journal = customThemes.journal;
    var origRaw = customThemes.origRaw, origSem = customThemes.origSem;
    var kept = [];
    journal.raw.forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(origRaw, k)) rawTable[k] = origRaw[k];
        else if (theme && k.startsWith("__VENUS_")) kept.push(k);
        else delete rawTable[k];
    });
    journal.sem.forEach(function (k) {
        var entry = sem[k], snap = origSem[k];
        if (!entry || !snap) return;
        for (var slot of THEME_SLOTS) {
            if (snap[slot] && entry[slot] && typeof entry[slot] === "object") { entry[slot].raw = snap[slot].raw; entry[slot].opacity = snap[slot].opacity; }
        }
    });
    journal.raw.clear(); kept.forEach(function (k) { journal.raw.add(k); }); journal.sem.clear();

    var touchedRaw = journal.raw, touchedSem = journal.sem;
    var raw = {set: function (k, v) { touchedRaw.add(k); rawTable[k] = v; }};
    var rawIn = theme.rawColors || {}, semIn = theme.semanticColors || {}, bg = theme.background;
    for (var rk of Object.keys(rawIn)) {
        var p = parseThemeColor(rawIn[rk]);
        if (p) raw.set(rk, p.hex);
    }
    for (var i = 0; i < LEGACY_RAW_BRIDGES.length; i++) {
        var target = LEGACY_RAW_BRIDGES[i][0], sources = LEGACY_RAW_BRIDGES[i][1];
        if (rawIn[target]) continue;
        for (var j = 0; j < sources.length; j++) {
            var src = sources[j];
            if (rawIn[src]) {
                var p2 = parseThemeColor(rawIn[src]);
                if (p2) { raw.set(target, p2.hex); break; }
            }
        }
    }
    var directWritten = new Set();
    function writeSemanticTarget(targetKey, arr, isDirect) {
        var entry = sem[targetKey];
        if (!entry || typeof entry !== "object") return;
        if (!isDirect && directWritten.has(targetKey)) return;
        if (isDirect) directWritten.add(targetKey);
        touchedSem.add(targetKey);
        var slotColor = function (idx) { return parseThemeColor(idx < arr.length ? arr[idx] : arr[0]); };
        var slotColors = {dark: slotColor(0), light: slotColor(1), midnight: slotColor(2), darker: slotColor(3)};
        for (var slot of THEME_SLOTS) {
            var picked = slotColors[slot];
            if (!picked) continue;
            var syntheticKey = "__VENUS_" + targetKey + "_" + slot;
            raw.set(syntheticKey, picked.hex);
            entry[slot].raw = syntheticKey;
            entry[slot].opacity = picked.opacity;
        }
    }
    var aliasRank = new Map();
    for (var sk of Object.keys(semIn)) {
        var arr = semIn[sk];
        if (!Array.isArray(arr) || !arr.length || sem[sk]) continue;
        var targets = LEGACY_SEMANTIC_ALIASES[sk];
        if (!targets) continue;
        for (var ti = 0; ti < targets.length; ti++) {
            var was = aliasRank.get(targets[ti]);
            if (!was || ti < was.rank || ti === was.rank && targets.length < was.width) aliasRank.set(targets[ti], {rank: ti, width: targets.length, arr: arr});
        }
    }
    aliasRank.forEach(function (pick, target) { writeSemanticTarget(target, pick.arr, false); });
    for (var sk2 of Object.keys(semIn)) {
        var arr2 = semIn[sk2];
        if (Array.isArray(arr2) && arr2.length && sem[sk2]) writeSemanticTarget(sk2, arr2, true);
    }
    if (bg && bg.url && bg.alpha < 1) {
        var alpha = bg.alpha;
        for (var ci = 0; ci < CHAT_SURFACE_TOKENS.length; ci++) {
            var e = sem[CHAT_SURFACE_TOKENS[ci]];
            if (!e) continue;
            touchedSem.add(CHAT_SURFACE_TOKENS[ci]);
            for (var s of THEME_SLOTS) e[s].opacity = Number((e[s].opacity * alpha).toFixed(4));
        }
    }
}

function compileNew(customThemes, theme) {
    var rawTable = customThemes.rawTable, sem = customThemes.semTable;
    if (!customThemes.origRaw) customThemes.origRaw = Object.assign({}, rawTable);
    if (!customThemes.origSem) {
        var copy2 = {};
        for (var k2 in sem) {
            if (!owns(sem, k2)) continue;
            var entry = sem[k2];
            if (!entry || typeof entry !== "object") continue;
            var snap = {};
            for (var si = 0; si < 4; si++) {
                var slot = THEME_SLOTS[si], sObj = entry[slot];
                if (sObj && typeof sObj === "object") snap[slot] = {raw: sObj.raw, opacity: sObj.opacity};
            }
            copy2[k2] = snap;
        }
        customThemes.origSem = copy2;
    }
    if (!customThemes.journal) customThemes.journal = {raw: new Set(), sem: new Set(), exp: [], rawTable: rawTable, semTable: sem};
    var journal = customThemes.journal;
    var origRaw = customThemes.origRaw, origSem = customThemes.origSem;
    var kept = [];
    journal.raw.forEach(function (k) {
        if (owns(origRaw, k)) rawTable[k] = origRaw[k];
        else if (theme && k.startsWith("__VENUS_")) kept.push(k);
        else delete rawTable[k];
    });
    journal.sem.forEach(function (k) {
        var entry = sem[k], snap = origSem[k];
        if (!entry || !snap) return;
        for (var si = 0; si < 4; si++) {
            var slot = THEME_SLOTS[si], sn = snap[slot], en = entry[slot];
            if (sn && en && typeof en === "object") { en.raw = sn.raw; en.opacity = sn.opacity; }
        }
    });
    journal.raw.clear();
    for (var ki = 0; ki < kept.length; ki++) journal.raw.add(kept[ki]);
    journal.sem.clear();

    var touchedRaw = journal.raw, touchedSem = journal.sem;
    var rawIn = theme.rawColors || {}, semIn = theme.semanticColors || {}, bg = theme.background;
    for (var rk in rawIn) {
        if (!owns(rawIn, rk)) continue;
        var p = parseThemeColor(rawIn[rk]);
        if (p) { touchedRaw.add(rk); rawTable[rk] = p.hex; }
    }
    for (var i = 0; i < LEGACY_RAW_BRIDGES.length; i++) {
        var target = LEGACY_RAW_BRIDGES[i][0], sources = LEGACY_RAW_BRIDGES[i][1];
        if (rawIn[target]) continue;
        for (var j = 0; j < sources.length; j++) {
            var src = sources[j];
            if (rawIn[src]) {
                var p2 = parseThemeColor(rawIn[src]);
                if (p2) { touchedRaw.add(target); rawTable[target] = p2.hex; break; }
            }
        }
    }
    var directWritten = new Set();
    function writeSemanticTarget(targetKey, arr, isDirect) {
        var entry = sem[targetKey];
        if (!entry || typeof entry !== "object") return;
        if (!isDirect && directWritten.has(targetKey)) return;
        if (isDirect) directWritten.add(targetKey);
        touchedSem.add(targetKey);
        var len = arr.length;
        var c0 = parseThemeColor(arr[0]);
        var c1 = len > 1 ? parseThemeColor(arr[1]) : c0;
        var c2 = len > 2 ? parseThemeColor(arr[2]) : c0;
        var c3 = len > 3 ? parseThemeColor(arr[3]) : c0;
        var prefix = "__VENUS_" + targetKey + "_";
        for (var si = 0; si < 4; si++) {
            var slot = THEME_SLOTS[si];
            var picked = si === 0 ? c0 : si === 1 ? c1 : si === 2 ? c3 : c2;
            if (!picked) continue;
            var syntheticKey = prefix + slot;
            touchedRaw.add(syntheticKey);
            rawTable[syntheticKey] = picked.hex;
            entry[slot].raw = syntheticKey;
            entry[slot].opacity = picked.opacity;
        }
    }
    var aliasRank = new Map();
    for (var sk in semIn) {
        if (!owns(semIn, sk)) continue;
        var arr = semIn[sk];
        if (!Array.isArray(arr) || !arr.length || sem[sk]) continue;
        var targets = LEGACY_SEMANTIC_ALIASES[sk];
        if (!targets) continue;
        for (var ti = 0; ti < targets.length; ti++) {
            var was = aliasRank.get(targets[ti]);
            if (!was || ti < was.rank || ti === was.rank && targets.length < was.width) aliasRank.set(targets[ti], {rank: ti, width: targets.length, arr: arr});
        }
    }
    aliasRank.forEach(function (pick, target) { writeSemanticTarget(target, pick.arr, false); });
    for (var sk2 in semIn) {
        if (!owns(semIn, sk2)) continue;
        var arr2 = semIn[sk2];
        if (Array.isArray(arr2) && arr2.length && sem[sk2]) writeSemanticTarget(sk2, arr2, true);
    }
    if (bg && bg.url && bg.alpha < 1) {
        var alpha = bg.alpha;
        for (var ci = 0; ci < CHAT_SURFACE_TOKENS.length; ci++) {
            var e = sem[CHAT_SURFACE_TOKENS[ci]];
            if (!e) continue;
            touchedSem.add(CHAT_SURFACE_TOKENS[ci]);
            for (var si2 = 0; si2 < 4; si2++) {
                var sl = e[THEME_SLOTS[si2]];
                sl.opacity = Math.round(sl.opacity * alpha * 10000) / 10000;
            }
        }
    }
}

var ctOld = makeTables(), ctNew = makeTables();
compileOld(ctOld, sampleTheme);
compileNew(ctNew, sampleTheme);
if (JSON.stringify(ctOld.semTable) !== JSON.stringify(ctNew.semTable)) throw new Error("semTable mismatch");

bench("old compileThemeIntoTables", function () {
    compileOld(ctOld, sampleTheme);
});
bench("new compileThemeIntoTables", function () {
    compileNew(ctNew, sampleTheme);
});
