// Custom themes: compileThemeIntoTables + restoreOriginalColorTables + snapshotColorTables
// In Discord 349.9:
// RawColors has ~1700 keys, SemanticColors has ~414 tokens (each with 4 theme slots: dark, light, midnight, darker),
// SemanticColorExperiments has ~400 tokens (each with 1-2 experiments, each with 4 theme slots = ~2000 slots).
var THEME_SLOTS = ["dark", "light", "midnight", "darker"];
var rawTable = {}, semTable = {}, expTable = {};
for (var i = 0; i < 1700; i++) rawTable["RAW_" + i] = "#112233";
for (var i = 0; i < 414; i++) {
    var tok = "SEM_" + i;
    semTable[tok] = {
        dark: {raw: "RAW_" + i, opacity: 1},
        light: {raw: "RAW_" + (i + 400), opacity: 1},
        midnight: {raw: "RAW_" + (i + 800), opacity: 1},
        darker: {raw: "RAW_" + (i + 1200), opacity: 1}
    };
}
for (var i = 0; i < 400; i++) {
    var tok = "SEM_" + i;
    expTable[tok] = {
        "2025-01_visual_refresh": {
            dark: {raw: "RAW_" + i, opacity: 1},
            light: {raw: "RAW_" + (i + 400), opacity: 1},
            midnight: {raw: "RAW_" + (i + 800), opacity: 1},
            darker: {raw: "RAW_" + (i + 1200), opacity: 1}
        }
    };
}

// Simulate a typical theme that touches ~120 semantic tokens and ~60 raw colors
var touchedSem = new Set();
for (var i = 0; i < 120; i++) {
    var tok = "SEM_" + i;
    touchedSem.add(tok);
    semTable[tok].dark.raw = "__VENUS_" + tok + "_dark";
}
var origSem = {};
for (var i = 0; i < 414; i++) {
    var tok = "SEM_" + i;
    origSem[tok] = {
        dark: {raw: "RAW_" + i, opacity: 1},
        light: {raw: "RAW_" + (i + 400), opacity: 1},
        midnight: {raw: "RAW_" + (i + 800), opacity: 1},
        darker: {raw: "RAW_" + (i + 1200), opacity: 1}
    };
}

function eachExperimentSlot(table, fn) {
    if (!table || typeof table !== "object") return;
    for (var _i = 0, _keys = Object.keys(table); _i < _keys.length; _i++) {
        var token = _keys[_i], byExperiment = table[token];
        if (!byExperiment || typeof byExperiment !== "object") continue;
        for (var _j = 0, _ekeys = Object.keys(byExperiment); _j < _ekeys.length; _j++) {
            var experiment = _ekeys[_j], byTheme = byExperiment[experiment];
            if (!byTheme || typeof byTheme !== "object") continue;
            for (var _k = 0; _k < THEME_SLOTS.length; _k++) {
                var theme = THEME_SLOTS[_k], slot = byTheme[theme];
                if (slot && typeof slot === "object") fn(token, slot, theme);
            }
        }
    }
}

var origExp = [];
eachExperimentSlot(expTable, function (token, slot) { origExp.push([slot, slot.raw, slot.opacity]); });

// Shipped restore + step 6:
function expShip() {
    origExp.forEach(function (item) { item[0].raw = item[1]; item[0].opacity = item[2]; });
    eachExperimentSlot(expTable, function (token, slot, theme) {
        var themed = semTable[token] && semTable[token][theme], was = origSem[token] && origSem[token][theme];
        if (themed && was && (themed.raw !== was.raw || themed.opacity !== was.opacity)) { slot.raw = themed.raw; slot.opacity = themed.opacity; }
    });
}

// Fast restore + step 6: journal touched experiment slots, and in step 6 only walk expTable[token] for token in touchedSem!
var expJournal = [];
function expFast() {
    for (var i = 0; i < expJournal.length; i += 3) {
        var s = expJournal[i];
        s.raw = expJournal[i + 1];
        s.opacity = expJournal[i + 2];
    }
    expJournal.length = 0;
    if (!expTable || typeof expTable !== "object") return;
    touchedSem.forEach(function (token) {
        var byExperiment = expTable[token];
        if (!byExperiment || typeof byExperiment !== "object") return;
        var semEntry = semTable[token], wasEntry = origSem[token];
        if (!semEntry || !wasEntry) return;
        for (var experiment in byExperiment) {
            if (!Object.prototype.hasOwnProperty.call(byExperiment, experiment)) continue;
            var byTheme = byExperiment[experiment];
            if (!byTheme || typeof byTheme !== "object") continue;
            for (var k = 0; k < THEME_SLOTS.length; k++) {
                var theme = THEME_SLOTS[k], slot = byTheme[theme];
                if (!slot || typeof slot !== "object") continue;
                var themed = semEntry[theme], was = wasEntry[theme];
                if (themed && was && (themed.raw !== was.raw || themed.opacity !== was.opacity)) {
                    expJournal.push(slot, slot.raw, slot.opacity);
                    slot.raw = themed.raw;
                    slot.opacity = themed.opacity;
                }
            }
        }
    });
}

bench("experiment sync + restore (ships: full table walk)", function () {
    for (var i = 0; i < 100; i++) expShip();
});
bench("experiment sync + restore (touchedSem + journal)", function () {
    for (var i = 0; i < 100; i++) expFast();
});
