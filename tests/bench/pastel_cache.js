// pastelColor: hit on every message row (author) and every mention, as you scroll.
var ids = []; for (var i = 0; i < 60; i++) ids.push(String(100000000000000000 + i * 7919));
function computePastel(seed) { return {value: seed.length, hex: "#000"}; }
// Before: one Map, key = saturation + ":" + lightness + ":" + seed (string build per call).
var cache = new Map();
function before(seed, s, l) {
    var key = s + ":" + l + ":" + seed, known = cache.get(key);
    if (known) return known;
    var c = computePastel(seed, s, l); cache.set(key, c); return c;
}
// Candidate: a Map per (saturation, lightness) pair, keyed by the seed itself.
var caches = new Map();
function after(seed, s, l) {
    var tone = s === 0.75 && l === 0.6 ? "name" : s === 0.85 && l === 0.75 ? "mention" : s + ":" + l;
    var table = caches.get(tone); if (!table) caches.set(tone, table = new Map());
    var known = table.get(seed);
    if (known) return known;
    var c = computePastel(seed, s, l); table.set(seed, c); return c;
}
var sink = 0;
bench("joined string key (before)", function () { for (var r = 0; r < 50; r++) for (var i = 0; i < ids.length; i++) { sink += before(ids[i], 0.75, 0.6).value + before(ids[i], 0.85, 0.75).value; } });
bench("per-tone Map keyed by seed", function () { for (var r = 0; r < 50; r++) for (var i = 0; i < ids.length; i++) { sink += after(ids[i], 0.75, 0.6).value + after(ids[i], 0.85, 0.75).value; } });
