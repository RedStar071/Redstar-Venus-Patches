// NoDelete retainedMessages: sorting a 3000-message view (the regex + per-message id cache that ships).
var N = 3000, msgs = [];
for (var i = 0; i < N; i++) msgs.push({id: String(1200000000000000000 + ((i * 7919) % N) * 1000)});
function isDigits(s) { if (!s) return false; for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); if (c < 48 || c > 57) return false; } return true; }
function cachedSort(test) {
    var a = msgs.slice(), ids = new Map();
    function idOf(m) { var id = ids.get(m); if (id === undefined) { var t = String(m.id); id = test(t) ? t : null; ids.set(m, id); } return id; }
    a.sort(function (x, y) { var l = idOf(x), r = idOf(y); if (l === null || r === null) return 0; return l.length - r.length || (l === r ? 0 : l < r ? -1 : 1); });
}
bench("regex, no cache", function () {
    msgs.slice().sort(function (x, y) { var l = String(x.id), r = String(y.id); if (!/^\d+$/.test(l) || !/^\d+$/.test(r)) return 0; return l.length - r.length || (l === r ? 0 : l < r ? -1 : 1); });
});
bench("isDigits + id cache", function () { cachedSort(isDigits); });
bench("regex + id cache (ships)", function () { cachedSort(function (s) { return /^\d+$/.test(s); }); });
