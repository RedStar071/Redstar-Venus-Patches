// Old vs new hiddenMetadata over a 300-channel server: realCan per call vs per-record cache keyed on
// PermissionStore.getChannelsVersion(). canCost simulates Discord's can(): getChannelPermissions lookup + BigFlag has.
var VIEW = BigInt(1024);
var table = [], perms = {};
for (var i = 0; i < 300; i++) { var c = {id: String(1000 + i), guild_id: "1", type: i % 10 === 0 ? 4 : 0}; table.push(c); perms[c.id] = i % 7 === 0 ? BigInt(0) : BigInt(3072); }
var version = 1;
function Flags() {} Flags.prototype.has = function (a, b) { return (a & b) === b; };
var store = {}; function cached(ch) { var v = store[ch.id]; if (v == null) { v = perms[ch.id]; store[ch.id] = v; } return v; }
var flags = new Flags();
function getChannelPermissions(ch) { return cached(ch); }
function asBig(x) { return x; } function bf() { return flags; }
function realCanRaw(bit, ch) { var p = getChannelPermissions(ch); return bf().has(asBig(p), bit); }
var permissionsCanOrig = realCanRaw.bind(null);
function realCan(bit, channel) {
    if (channel && channel.realCheck) { channel = Object.assign({}, channel); delete channel.realCheck; }
    try { return !!permissionsCanOrig && permissionsCanOrig(bit, channel); } catch (_) { return false; }
}
function oldHidden(channel) {
    return !!(channel && channel.guild_id && channel.type !== 1 && channel.type !== 3 && VIEW != null && !realCan(VIEW, channel));
}
var cache = new WeakMap(), cacheVersion = -1;
function getChannelsVersion() { return version; }
function newHidden(channel) {
    if (!(channel && channel.guild_id && channel.type !== 1 && channel.type !== 3 && VIEW != null)) return false;
    if (channel.realCheck) return !realCan(VIEW, channel);
    var v = getChannelsVersion();
    if (v !== cacheVersion) { cache = new WeakMap(); cacheVersion = v; }
    var known = cache.get(channel);
    if (known !== undefined) return known;
    var hidden = !realCan(VIEW, channel);
    cache.set(channel, hidden);
    return hidden;
}
for (var k = 0; k < table.length; k++) if (oldHidden(table[k]) !== newHidden(table[k])) throw Error("mismatch");
bench("old hiddenMetadata x300", function () { var n = 0; for (var i = 0; i < table.length; i++) if (oldHidden(table[i])) n++; return n; });
bench("new hiddenMetadata x300 (warm)", function () { var n = 0; for (var i = 0; i < table.length; i++) if (newHidden(table[i])) n++; return n; });
bench("new hiddenMetadata x300 (version bumped every lookup)", function () { version++; var n = 0; for (var i = 0; i < table.length; i++) if (newHidden(table[i])) n++; return n; });
