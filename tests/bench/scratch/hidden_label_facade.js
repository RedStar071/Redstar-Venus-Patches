// Old vs new channelLabel facade for locked channels: a fresh Object.create per render vs one per record and name.
var FALSE_FN = function () { return false; };
function Rec(id) { this.id = id; this.guild_id = "1"; this.type = 0; this.name = "hidden"; this.flags = 1; }
Rec.prototype.isObfuscated = function () { return true; };
var recs = []; for (var i = 0; i < 60; i++) recs.push(new Rec(String(1000 + i)));
function compute(ch) { return ch.isObfuscated() ? "OBF" : ch.name; }
function hiddenName(ch) { return "staff-" + ch.id; }
function oldLabel(channel) {
    var next = [channel];
    next = Array.from(next);
    next[0] = Object.create(channel, {
        name: {value: hiddenName(channel), writable: true, configurable: true, enumerable: true},
        isObfuscated: {value: FALSE_FN, writable: true, configurable: true, enumerable: false}
    });
    return compute.apply(null, next);
}
var facades = new WeakMap();
function labelFacade(channel, name) {
    var known = facades.get(channel);
    if (known && known.name === name) return known;
    var facade = Object.create(channel, {
        name: {value: name, writable: true, configurable: true, enumerable: true},
        isObfuscated: {value: FALSE_FN, writable: true, configurable: true, enumerable: false}
    });
    facades.set(channel, facade);
    return facade;
}
function newLabel(channel) { return compute(labelFacade(channel, hiddenName(channel))); }
for (var k = 0; k < recs.length; k++) if (oldLabel(recs[k]) !== newLabel(recs[k])) throw Error("mismatch");
bench("old label x60 locked rows", function () { var s = 0; for (var i = 0; i < recs.length; i++) s += oldLabel(recs[i]).length; return s; });
bench("new label x60 locked rows", function () { var s = 0; for (var i = 0; i < recs.length; i++) s += newLabel(recs[i]).length; return s; });
