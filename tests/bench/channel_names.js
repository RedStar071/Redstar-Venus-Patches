// Benchmark receivedName, rememberChannelName, and channel scan loops on Hermes HBC98.
var HIDDEN_CHANNEL = "Hidden channel (name unavailable)", HIDDEN_CATEGORY = "Hidden category (name unavailable)";
var pack = {"Hidden channel (name unavailable)": "Canal oculto (nombre no disponible)", "Hidden category (name unavailable)": "Categoría oculta (nombre no disponible)"};
function tr(english) { return pack[english] || english; }

var hiddenNames = new Map(), hiddenAccount = "100000000000000001";

function receivedNameOld(channel) {
    if (!channel || typeof channel.name !== "string") return null;
    var trimmed = channel.name.trim();
    if (!trimmed) return null;
    if (trimmed.replace(/^_+|_+$/g, "").toLowerCase() === "hidden") return null;
    if (trimmed === HIDDEN_CHANNEL || trimmed === HIDDEN_CATEGORY || trimmed === tr(HIDDEN_CHANNEL) || trimmed === tr(HIDDEN_CATEGORY)) return null;
    return channel.name;
}

function rememberChannelNameOld(channel, accountId, knownName, guildId) {
    var owner = accountId;
    if (hiddenAccount !== owner) { hiddenNames.clear(); hiddenAccount = owner; }
    if (!channel) return;
    var guild = guildId || channel.guild_id;
    var name = knownName || receivedNameOld(channel);
    if (!guild || !channel.id || !name) return;
    var known = hiddenNames.get(channel.id);
    if (known && known.guild === guild && known.name === name) return;
    if (hiddenNames.size >= 4096 && !known) hiddenNames.delete(hiddenNames.keys().next().value);
    hiddenNames.set(channel.id, {guild: guild, name: name});
}

var HIDDEN_REDACTED_RE = /^_*hidden_*$/i;
function receivedNameNew(channel) {
    if (!channel) return null;
    var raw = channel.name;
    if (typeof raw !== "string" || !raw) return null;
    var trimmed = raw.trim();
    var len = trimmed.length;
    if (!len) return null;
    var c0 = trimmed.charCodeAt(0);
    // "hidden", "_hidden_", "__HIDDEN__" etc. all start with '_', 'h', or 'H' and are >= 6 chars.
    if (len >= 6 && (c0 === 95 || c0 === 104 || c0 === 72) && HIDDEN_REDACTED_RE.test(trimmed)) return null;
    if (len > 10 && (trimmed === HIDDEN_CHANNEL || trimmed === HIDDEN_CATEGORY || trimmed === tr(HIDDEN_CHANNEL) || trimmed === tr(HIDDEN_CATEGORY))) return null;
    return raw;
}

function rememberChannelNameNew(channel, accountId, knownName, guildId) {
    var owner = accountId;
    if (hiddenAccount !== owner) { hiddenNames.clear(); hiddenAccount = owner; }
    if (!channel) return;
    var id = channel.id;
    var guild = guildId || channel.guild_id;
    if (!guild || !id) return;
    var name = knownName || receivedNameNew(channel);
    if (!name) return;
    var known = hiddenNames.get(id);
    if (known && known.guild === guild && known.name === name) return;
    if (hiddenNames.size >= 4096 && !known) hiddenNames.delete(hiddenNames.keys().next().value);
    hiddenNames.set(id, {guild: guild, name: name});
}

// Create 400 realistic channels across guilds (including normal names, categories, voice, and redacted stubs)
var channels = [];
var sampleNames = ["general", "announcements", "rules", "welcome", "memes", "clips", "voice-lobby", "staff-chat", "hidden", "__hidden__", "_HIDDEN_", "Hidden channel (name unavailable)", "bot-commands", "art-showcase", "music", "tech-talk"];
for (var i = 0; i < 400; i++) {
    channels.push({
        id: String(300000000000000000 + i),
        guild_id: String(10000000 + (i >> 4)),
        type: i % 8 === 0 ? 4 : (i % 5 === 0 ? 2 : 0),
        name: sampleNames[i % sampleNames.length] + (i % 8 < 5 ? "-" + (i % 20) : "")
    });
}

bench("old rememberChannelName scan (400 channels)", function () {
    hiddenNames.clear();
    for (var i = 0; i < channels.length; i++) {
        var ch = channels[i];
        rememberChannelNameOld(ch, "100000000000000001", undefined, ch.guild_id);
    }
});

bench("new rememberChannelName scan (400 channels)", function () {
    hiddenNames.clear();
    for (var i = 0; i < channels.length; i++) {
        var ch = channels[i];
        rememberChannelNameNew(ch, "100000000000000001", undefined, ch.guild_id);
    }
});
