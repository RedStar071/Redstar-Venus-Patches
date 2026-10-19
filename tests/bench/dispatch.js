// The dispatcher hook runs for every Flux event: mostly presence, typing and voice, which Venus ignores.
var features = {noDelete: true, hiddenChannels: true}, settings = {noDelete: true, noDeleteEdits: true, hiddenChannels: true};
var enabled = function (k) { return !!settings[k]; };
var CHANNEL_EVENTS = new Set(["CHANNEL_CREATE","CHANNEL_UPDATE"]), GUILD_EVENTS = new Set(["GUILD_CREATE","GUILD_UPDATE"]);
var MESSAGE_EVENTS = new Set(["MESSAGE_CREATE","MESSAGE_UPDATE"]), RESTORE_EVENTS = new Set(["CONNECTION_OPEN","CACHE_LOADED"]);
var HIDDEN_EVENTS = new Set(["LOGOUT","CHANNEL_DELETE","GUILD_DELETE","CHANNEL_CREATE","CHANNEL_UPDATE","GUILD_CREATE","GUILD_UPDATE","CONNECTION_OPEN","MESSAGE_CREATE","MESSAGE_UPDATE"]);
var deleted = new Map(), edits = new Map();
function channelMetadataEvent(event) { if (!HIDDEN_EVENTS.has(event.type)) return; if (MESSAGE_EVENTS.has(event.type)) { var m = event.message || event; if (!m || !Array.isArray(m.mention_channels) || !m.mention_channels.length) return; } }
function rememberEdit() {} function rememberDeleted() { return false; } function clearDeleted() {} function clearReviewAuth() {} function restoreDeleted() {}
var archiveRestored = false;
function dispatchBefore(orig, self, args) {
        const event = args[0];
        if (!event) return orig.apply(self, args);
        if (features.hiddenChannels) channelMetadataEvent(event);
        if (event.type === "LOGOUT") { clearDeleted(false); edits.clear(); archiveRestored = false; clearReviewAuth(); }
        if (!features.noDelete) return orig.apply(self, args);
        if (RESTORE_EVENTS.has(event.type)) Promise.resolve().then(restoreDeleted);
        // Views are keyed by the store's own ChannelMessages identity, so unrelated events
        // (typing, presence, reactions) no longer force a re-merge and re-sort of every chat.
        if (event.type === "CHANNEL_DELETE" && (deleted.size || edits.size)) forgetChannels(new Set([event.channel && event.channel.id || event.channelId || event.id]));
        // Leaving a server (not an outage, which says unavailable) used to keep its kept messages and edit history
        // in memory and in the saved file for good, where nothing could ever show or remove them.
        if (event.type === "GUILD_DELETE" && event.guild && event.guild.id && !event.guild.unavailable && (deleted.size || edits.size)) {
            const ids = new Set(), guild = event.guild.id;
            const inGuild = channelId => { const channel = receivedChannel(channelId); return !!(channel && channel.guild_id === guild); };
            deletedByChannel.forEach((bucket, channelId) => { if (inGuild(channelId)) ids.add(channelId); });
            edits.forEach(entry => { if (!ids.has(entry.channelId) && inGuild(entry.channelId)) ids.add(entry.channelId); });
            if (ids.size) forgetChannels(ids);
        }
        if (!enabled("noDelete")) return orig.apply(self, args);
        if (event.type === "MESSAGE_UPDATE" && settings.noDeleteEdits) rememberEdit(event.message);
        if (event.type === "MESSAGE_DELETE" && event.channelId && event.id) {
            // Your own deletion of a message we were already showing: remove it for real.
            const kept = rememberDeleted(event, orig, self);
            // Discord's deleteMessage chains .then() on dispatch(); always hand back a thenable.
            if (kept) return kept === true ? Promise.resolve() : kept;
        }
        if (event.type === "MESSAGE_DELETE_BULK" && event.channelId && Array.isArray(event.ids)) {
            const remaining = event.ids.filter(id => !rememberDeleted({channelId:event.channelId,id}, orig, self));
            if (!remaining.length) return Promise.resolve();
            const next = Array.from(args); next[0] = Object.assign({}, event, {ids:remaining});
            return orig.apply(self, next);
        }
        return orig.apply(self, args);
    }

// Candidate: events none of Venus' handlers look at return straight away, decided by one Set lookup.
var DISPATCH_SEEN = new Set(["LOGOUT","CHANNEL_DELETE","GUILD_DELETE","MESSAGE_UPDATE","MESSAGE_DELETE","MESSAGE_DELETE_BULK"]);
HIDDEN_EVENTS.forEach(function (t) { DISPATCH_SEEN.add(t); }); RESTORE_EVENTS.forEach(function (t) { DISPATCH_SEEN.add(t); });
function dispatchAfter(orig, self, args) {
    var event = args[0];
    if (!event || !DISPATCH_SEEN.has(event.type)) return orig.apply(self, args);
    return dispatchBefore(orig, self, args);
}
var events = []; var types = ["PRESENCE_UPDATES","TYPING_START","VOICE_STATE_UPDATES","MESSAGE_CREATE","PRESENCE_UPDATES","TRACK","TYPING_START","MESSAGE_ACK","PRESENCE_UPDATES","CHANNEL_UPDATE"];
for (var i = 0; i < 1000; i++) events.push({type: types[i % types.length], message: {id: "1", channel_id: "2", content: "x"}});
var store = {dispatch: function (e) { return e; }}; var orig = store.dispatch;
bench("dispatchEvent (before)", function () { for (var i = 0; i < events.length; i++) dispatchBefore(orig, store, [events[i]]); });
bench("early return for ignored types", function () { for (var i = 0; i < events.length; i++) dispatchAfter(orig, store, [events[i]]); });
// call1 path for ignored events: no arguments object, one Set check, then Discord's dispatch.
function call1(orig, self, event) { return !event || !DISPATCH_SEEN.has(event.type) ? orig.call(self, event) : dispatchBefore(orig, self, [event]); }
var hookedArgs = function () { return dispatchAfter(orig, this, arguments); };
var hooked1 = function (e) { return arguments.length === 1 ? call1(orig, this, e) : dispatchAfter(orig, this, arguments); };
bench("hooked dispatch, arguments path", function () { for (var i = 0; i < events.length; i++) hookedArgs.call(store, events[i]); });
bench("hooked dispatch, call1 path", function () { for (var i = 0; i < events.length; i++) hooked1.call(store, events[i]); });
