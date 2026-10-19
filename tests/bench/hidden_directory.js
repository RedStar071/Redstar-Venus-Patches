// Benchmark hiddenDirectory on Hermes HBC98.
var settings = {hiddenChannels: true};
var features = {hiddenChannels: true};
function enabled(k) { return settings[k] && features[k]; }
function tr(s) { return s; }

var userStore = {getCurrentUser: function () { return {id: "100"}; }};
var hiddenNames = new Map(), hiddenViews = new Map(), hiddenScans = new Map();
var hiddenAccount = "100";
var renamedChannels = new WeakMap();
function cloneWith(obj, k, v) { var c = Object.assign({}, obj); c[k] = v; return c; }
function renamedChannel(channel, name) {
    if (name === channel.name) return channel;
    var known = renamedChannels.get(channel);
    if (known && known.name === name) return known.value;
    var value = cloneWith(channel, "name", name);
    renamedChannels.set(channel, {name: name, value: value});
    return value;
}
function rememberChannelName(channel, owner, knownName, guildId) {
    if (!channel || !channel.id || !channel.name) return;
    hiddenNames.set(channel.id, {guild: guildId || channel.guild_id, name: channel.name});
}
function hiddenName(channel) { return channel.name || "Hidden channel (name unavailable)"; }

// Build a guild with 80 channels (70 visible, 10 hidden)
var full = {};
var origSelectable = [], origVocal = [], origCat = [], orig0 = [], orig2 = [];
for (var i = 0; i < 80; i++) {
    var id = String(1000 + i);
    var type = i % 10 === 0 ? 4 : (i % 5 === 0 ? 2 : 0);
    var isHidden = i >= 70;
    var ch = {id: id, guild_id: "g1", type: type, position: i, parent_id: String(1000 + Math.floor(i / 10) * 10), name: "chan-" + i, _hidden: isHidden};
    full[id] = ch;
    if (!isHidden) {
        var entry = {channel: ch, comparator: i};
        if (type === 4) origCat.push(entry);
        else if (type === 2) { orig2.push(entry); origVocal.push(entry); }
        else { orig0.push(entry); origSelectable.push(entry); }
    }
}
var channelStore = {
    getMutableGuildChannelsForGuild: function () { return full; },
    getMutableBasicGuildChannelsForGuild: function () { return null; }
};
var permissions = {};
function hiddenMetadata(ch) { return !!(ch && ch._hidden); }
function displayChannel(ch) { return hiddenMetadata(ch) ? renamedChannel(ch, hiddenName(ch)) : ch; }

var rawResult = {
    0: orig0, 2: orig2, 4: origCat, 5: [], 10: [], 11: [], 12: [], 13: [], 15: [], 16: [],
    SELECTABLE: origSelectable, VOCAL: origVocal
};
function origFn() { return rawResult; }

function hiddenDirectoryOld(orig, self, args) {
    var result = orig.apply(self, args), guild = args[0];
    var full, basic, source;
    function remember() {
        var current = userStore && userStore.getCurrentUser(), owner = current && current.id;
        var last = hiddenScans.get(guild);
        if (last && last.full === full && last.basic === basic && last.owner === owner) {
            if (last.source) source = last.source;
            if (!enabled("hiddenChannels")) return;
        }
        if (!source) source = basic ? Object.assign({}, basic, full) : full;
        if (hiddenScans.size >= 64 && !last) hiddenScans.delete(hiddenScans.keys().next().value);
        hiddenScans.set(guild, {full: full, basic: basic, owner: owner, source: source});
        if (basic) for (var k in basic) if (Object.prototype.hasOwnProperty.call(basic, k)) rememberChannelName(basic[k], owner, undefined, guild);
        for (var k2 in full) if (Object.prototype.hasOwnProperty.call(full, k2)) rememberChannelName(full[k2], owner, undefined, guild);
    }
    function read() {
        full = channelStore.getMutableGuildChannelsForGuild(guild);
        if (!full) return;
        basic = typeof channelStore.getMutableBasicGuildChannelsForGuild === "function" && channelStore.getMutableBasicGuildChannelsForGuild(guild);
        remember();
    }
    var readable = guild && channelStore && typeof channelStore.getMutableGuildChannelsForGuild === "function";
    try { if (readable) read(); } catch (_) { source = undefined; }
    if (!enabled("hiddenChannels") || !result || !readable || !permissions) return result;
    if (!source) { read(); if (!source) return result; }
    var extra = [];
    for (var k in source) {
        if (Object.prototype.hasOwnProperty.call(source, k) && hiddenMetadata(source[k])) extra.push(source[k]);
    }
    var names = new Map();
    var sigParts = new Array(extra.length);
    var references = extra.slice();
    for (var i = 0; i < extra.length; i++) {
        var c = extra[i], name = hiddenName(c);
        names.set(c, name);
        sigParts[i] = c.id + ":" + c.position + ":" + c.type + ":" + c.parent_id + ":" + name;
        var parent = source[c.parent_id];
        if (parent) references.push(parent);
    }
    var signature = sigParts.join("|");
    var cached = hiddenViews.get(guild);
    if (cached && cached.orig === result && cached.source === full && cached.basic === basic && cached.signature === signature &&
        references.length === cached.references.length && references.every(function (c, idx) { return c === cached.references[idx]; })) return cached.value;
    var next = result;
    function append(key, channels) {
        if (!Array.isArray(next[key])) return;
        var original = next[key];
        var existing = original, renamed = false;
        for (var i = 0; i < original.length; i++) {
            var entry = original[i];
            if (!entry.channel) continue;
            var channel = displayChannel(entry.channel);
            if (channel !== entry.channel) {
                if (!renamed) { existing = original.slice(); renamed = true; }
                existing[i] = Object.assign({}, entry, {channel: channel});
            }
        }
        if (!channels.length && !renamed) return;
        var ids = new Set();
        for (var j = 0; j < existing.length; j++) {
            var ch = existing[j] && existing[j].channel;
            if (ch) ids.add(ch.id);
        }
        var added = [];
        for (var m = 0; m < channels.length; m++) {
            var channel2 = channels[m];
            if (ids.has(channel2.id)) continue;
            ids.add(channel2.id);
            var name2 = names.get(channel2);
            var shown = name2 === undefined ? displayChannel(channel2) : renamedChannel(channel2, name2);
            added.push({channel: shown, comparator: channel2.position || 0});
        }
        if (!added.length && !renamed) return;
        if (next === result) next = Object.assign({}, result);
        next[key] = existing.concat(added).sort(function (a, b) { return a.comparator - b.comparator; });
    }
    var byType = new Map(), selectable = [], vocal = [], parents = [];
    for (var i2 = 0; i2 < extra.length; i2++) {
        var c2 = extra[i2], t = c2.type;
        var bucket = byType.get(t);
        if (!bucket) byType.set(t, bucket = []);
        bucket.push(c2);
        if (t !== 2 && t !== 4 && t !== 13) selectable.push(c2);
        if (t === 2 || t === 13) vocal.push(c2);
        var p = source[c2.parent_id];
        if (p && p.type === 4) parents.push(p);
    }
    var empty = [];
    var types = [0, 2, 4, 5, 10, 11, 12, 13, 15, 16];
    for (var ti = 0; ti < types.length; ti++) append(types[ti], byType.get(types[ti]) || empty);
    append("SELECTABLE", selectable);
    append("VOCAL", vocal);
    append(4, parents);
    if (hiddenViews.size >= 16 && !hiddenViews.has(guild)) hiddenViews.delete(hiddenViews.keys().next().value);
    hiddenViews.set(guild, {orig: result, source: full, basic: basic, signature: signature, references: references, value: next});
    return next;
}

var HIDDEN_BUCKET_TYPES = [0, 2, 4, 5, 10, 11, 12, 13, 15, 16];
function hiddenDirectoryNew(orig, self, args) {
    var result = orig.apply(self, args), guild = args[0];
    var full, basic, source;
    function remember() {
        var current = userStore && userStore.getCurrentUser(), owner = current && current.id;
        var last = hiddenScans.get(guild);
        if (last && last.full === full && last.basic === basic && last.owner === owner && last.source) {
            source = last.source;
            return;
        }
        source = basic ? Object.assign({}, basic, full) : full;
        if (hiddenScans.size >= 64 && !last) hiddenScans.delete(hiddenScans.keys().next().value);
        hiddenScans.set(guild, {full: full, basic: basic, owner: owner, source: source});
        if (basic) for (var k in basic) if (Object.prototype.hasOwnProperty.call(basic, k)) rememberChannelName(basic[k], owner, undefined, guild);
        for (var k2 in full) if (Object.prototype.hasOwnProperty.call(full, k2)) rememberChannelName(full[k2], owner, undefined, guild);
    }
    function read() {
        full = channelStore.getMutableGuildChannelsForGuild(guild);
        if (!full) return;
        basic = typeof channelStore.getMutableBasicGuildChannelsForGuild === "function" && channelStore.getMutableBasicGuildChannelsForGuild(guild);
        remember();
    }
    var readable = guild && channelStore && typeof channelStore.getMutableGuildChannelsForGuild === "function";
    try { if (readable) read(); } catch (_) { source = undefined; }
    if (!enabled("hiddenChannels") || !result || !readable || !permissions) return result;
    if (!source) { read(); if (!source) return result; }
    var extra = [];
    for (var k in source) {
        if (Object.prototype.hasOwnProperty.call(source, k) && hiddenMetadata(source[k])) extra.push(source[k]);
    }
    var names = new Map();
    var signature = "";
    var references = extra.slice();
    for (var i = 0; i < extra.length; i++) {
        var c = extra[i], name = hiddenName(c);
        names.set(c, name);
        if (i) signature += "|";
        signature += c.id + ":" + c.position + ":" + c.type + ":" + c.parent_id + ":" + name;
        var parent = source[c.parent_id];
        if (parent) references.push(parent);
    }
    var cached = hiddenViews.get(guild);
    if (cached && cached.orig === result && cached.source === full && cached.basic === basic && cached.signature === signature &&
        references.length === cached.references.length) {
        var sameRefs = true;
        for (var ri = 0; ri < references.length; ri++) if (references[ri] !== cached.references[ri]) { sameRefs = false; break; }
        if (sameRefs) return cached.value;
    }
    var next = result;
    function append(key, channels) {
        if (!Array.isArray(next[key])) return;
        var original = next[key];
        var existing = original, renamed = false;
        for (var i = 0; i < original.length; i++) {
            var entry = original[i];
            if (!entry.channel) continue;
            var channel = displayChannel(entry.channel);
            if (channel !== entry.channel) {
                if (!renamed) { existing = original.slice(); renamed = true; }
                existing[i] = Object.assign({}, entry, {channel: channel});
            }
        }
        if (!channels.length && !renamed) return;
        var ids = new Set();
        for (var j = 0; j < existing.length; j++) {
            var ch = existing[j] && existing[j].channel;
            if (ch) ids.add(ch.id);
        }
        var added = [];
        for (var m = 0; m < channels.length; m++) {
            var channel2 = channels[m];
            if (ids.has(channel2.id)) continue;
            ids.add(channel2.id);
            var name2 = names.get(channel2);
            var shown = name2 === undefined ? displayChannel(channel2) : renamedChannel(channel2, name2);
            added.push({channel: shown, comparator: channel2.position || 0});
        }
        if (!added.length && !renamed) return;
        if (next === result) next = Object.assign({}, result);
        next[key] = existing.concat(added).sort(function (a, b) { return a.comparator - b.comparator; });
    }
    var byType = new Map(), selectable = [], vocal = [], parents = [];
    for (var i2 = 0; i2 < extra.length; i2++) {
        var c2 = extra[i2], t = c2.type;
        var bucket = byType.get(t);
        if (!bucket) byType.set(t, bucket = []);
        bucket.push(c2);
        if (t !== 2 && t !== 4 && t !== 13) selectable.push(c2);
        if (t === 2 || t === 13) vocal.push(c2);
        var p = source[c2.parent_id];
        if (p && p.type === 4) parents.push(p);
    }
    var empty = [];
    for (var ti = 0; ti < HIDDEN_BUCKET_TYPES.length; ti++) {
        var bType = HIDDEN_BUCKET_TYPES[ti];
        append(bType, byType.get(bType) || empty);
    }
    append("SELECTABLE", selectable);
    append("VOCAL", vocal);
    append(4, parents);
    if (hiddenViews.size >= 16 && !hiddenViews.has(guild)) hiddenViews.delete(hiddenViews.keys().next().value);
    hiddenViews.set(guild, {orig: result, source: full, basic: basic, signature: signature, references: references, value: next});
    return next;
}

bench("old hiddenDirectory (cached + uncached guild directory lookup)", function () {
    hiddenViews.clear();
    hiddenDirectoryOld(origFn, null, ["g1"]);
    hiddenDirectoryOld(origFn, null, ["g1"]);
});

bench("new hiddenDirectory (cached + uncached guild directory lookup)", function () {
    hiddenViews.clear();
    hiddenDirectoryNew(origFn, null, ["g1"]);
    hiddenDirectoryNew(origFn, null, ["g1"]);
});
