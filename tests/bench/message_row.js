// Benchmark messageRowResult + translateSeen + highlightMentioned + pastelReply hot path on Hermes HBC98.
var features = {pastelize: true, translate: true, noDelete: true, messageHighlight: true};
var settings = {
    pastelize: false, pastelAll: false, pastelContent: false,
    translate: false, translateTarget: "discord", translateMode: "auto", translateNote: true, translateOriginal: false,
    noDelete: false, noDeleteSave: false, noDeleteLimit: 512, noDeleteEdits: true,
    messageHighlight: false, messageHighlightThickness: 2, messageHighlightPingColor: "default", messageHighlightDeletedColor: "default"
};
var featureTable = Object.create(null);
function featureFor(key) {
    return key === "reviewWarning" ? "reviewDB" : key === "emojis" || key === "stickers" || key === "hyperlinks" ? "freeNitro" : key === "noDeleteSave" || key === "noDeleteLimit" || key === "noDeleteEdits" ? "noDelete" : /^pi[A-Z]/.test(key) ? "platformIndicators" : key === "pastelAll" || key === "pastelContent" ? "pastelize" : key === "readAllMode" ? "readAll" : /^quests[A-Z]/.test(key) ? "quests" : /^gesture[A-Z]/.test(key) ? "gestures" : /^translate[A-Z]/.test(key) ? "translate" : /^userNotif[A-Z]/.test(key) ? "userNotif" : /^accountSwitcher[A-Z]/.test(key) ? "accountSwitcher" : /^hiddenChannels[A-Z]/.test(key) ? "hiddenChannels" : /^customThemes[A-Z]/.test(key) ? "customThemes" : /^messageHighlight[A-Z]/.test(key) ? "messageHighlight" : key;
}
function enabled(key) {
    if (!settings[key]) return false;
    var feature = featureTable[key];
    if (feature === undefined) featureTable[key] = feature = featureFor(key);
    return feature === key ? !!features[key] : !!(features[feature] && settings[feature]);
}

var edits = new Map(), deleted = new Map(), deletedByChannel = new Map(), highlightRecent = new Map();
var translate = {refreshing: new Set(), shown: new Map(), choice: new Map(), asked: new Set()};
var RN = {processColor: function (c) { return 0xff000000; }};
var meObj = {id: "999999999999999999"};
function currentUser() { return meObj; }
function pastelMessage(m) { return m; }
function pastelReply(m) { return m; }
function translateRow(m, s, c, id) { translateSeenOld(s, c, id, null); return m; }
function translateReply(m) { return m; }
function withEditHistory(m) { return m; }
function deletedKey(c, id) { return c + ":" + id; }
function highlightCustomPair() { return null; }
function highlightEncodeGutter(c) { return c; }
var deletedHighlight = {};

function translateContentSource(message) {
    if (!message || typeof message !== "object") return null;
    if (typeof message.getContentMessage === "function") try { var inner = message.getContentMessage(); if (inner && typeof inner === "object") return inner; } catch (_) {}
    var snapshots = message.messageSnapshots || message.message_snapshots;
    if (Array.isArray(snapshots) && snapshots[0] && snapshots[0].message && typeof snapshots[0].message === "object") return snapshots[0].message;
    return message;
}

function translateSeenOld(source, channelId, id, key, quoteKey, quotedId) {
    if (!source || !channelId || !id || translate.refreshing.has(id)) return;
    var existing = translate.shown.get(id);
    var reference = source.messageReference || source.message_reference;
    var nextQuotes = quotedId || reference && (reference.message_id || reference.messageId) || (existing && existing.quotes) || null;
    if (existing && existing.source === source && existing.channelId === channelId &&
        (!key || existing.key === key) && (!quoteKey || existing.quoteKey === quoteKey) && existing.quotes === nextQuotes) return;
    var contentSource = translateContentSource(source);
    var raw = typeof source.content === "string" && source.content ? source.content : "";
    var snapshot = null;
    if (!raw && contentSource && contentSource !== source && typeof contentSource.content === "string" && contentSource.content) {
        var list = source.messageSnapshots || source.message_snapshots;
        var first = Array.isArray(list) && list[0];
        if (first && first.message) snapshot = {message: Object.assign({}, first.message)};
    }
    if (!raw && !snapshot) return;
    var entry = existing;
    if (entry) translate.shown.delete(id);
    else if (translate.shown.size >= 300) translate.shown.delete(translate.shown.keys().next().value);
    if (!entry) entry = {channelId: channelId, id: id, source: null, raw: "", snapshot: null, key: null, quoteKey: null, quotes: null};
    entry.source = source; entry.raw = raw; entry.snapshot = snapshot; entry.key = key || entry.key; entry.quoteKey = quoteKey || entry.quoteKey;
    entry.quotes = nextQuotes;
    translate.shown.set(id, entry);
}

function translateSeenNew(source, channelId, id, key, quoteKey, quotedId) {
    if (!source || !channelId || !id || translate.refreshing.size && translate.refreshing.has(id)) return;
    var existing = translate.shown.get(id);
    var reference = source.messageReference || source.message_reference;
    var nextQuotes = quotedId || (reference ? reference.message_id || reference.messageId : existing && existing.quotes) || null;
    if (existing && existing.source === source && existing.channelId === channelId &&
        (!key || existing.key === key) && (!quoteKey || existing.quoteKey === quoteKey) && existing.quotes === nextQuotes) return;
    var raw = source.content;
    var hasRaw = typeof raw === "string" && raw.length > 0;
    var snapshot = null;
    if (!hasRaw) {
        raw = "";
        var contentSource = translateContentSource(source);
        if (contentSource && contentSource !== source && typeof contentSource.content === "string" && contentSource.content) {
            var list = source.messageSnapshots || source.message_snapshots;
            var first = Array.isArray(list) && list[0];
            if (first && first.message) snapshot = {message: Object.assign({}, first.message)};
        }
        if (!snapshot) return;
    }
    var entry = existing;
    if (entry) translate.shown.delete(id);
    else if (translate.shown.size >= 300) translate.shown.delete(translate.shown.keys().next().value);
    if (!entry) entry = {channelId: channelId, id: id, source: source, raw: raw, snapshot: snapshot, key: key || null, quoteKey: quoteKey || null, quotes: nextQuotes};
    else {
        entry.source = source; entry.raw = raw; entry.snapshot = snapshot;
        if (key) entry.key = key;
        if (quoteKey) entry.quoteKey = quoteKey;
        entry.quotes = nextQuotes;
    }
    translate.shown.set(id, entry);
}

function highlightMentionedOld(source, message) {
    if (source && source.mentioned || message && message.mentioned) return true;
    if (!source || typeof source !== "object") return false;
    if (source.mention_everyone || source.mentionEveryone) return true;
    var mentions = source.mentions;
    var ref = source.referenced_message || source.referencedMessage && source.referencedMessage.message;
    var hasMentions = Array.isArray(mentions) && mentions.length > 0;
    var refAuthor = ref && ref.author && ref.author.id;
    if (!hasMentions && !refAuthor) return false;
    var me = currentUser();
    var myId = me && me.id;
    if (!myId) return false;
    if (refAuthor === myId) return true;
    if (hasMentions) for (var i = 0; i < mentions.length; i++) {
        var u = mentions[i];
        if (u && (u === myId || u.id === myId)) return true;
    }
    return false;
}

function highlightMentionedNew(source, message) {
    if (!source || typeof source !== "object") return !!(message && message.mentioned);
    if (source.mentioned || message && message.mentioned || source.mention_everyone || source.mentionEveryone) return true;
    var mentions = source.mentions;
    var hasMentions = mentions && mentions.length > 0 && Array.isArray(mentions);
    var ref = source.referenced_message || source.referencedMessage && source.referencedMessage.message;
    var refAuthor = ref && ref.author && ref.author.id;
    if (!hasMentions && !refAuthor) return false;
    var me = currentUser();
    var myId = me && me.id;
    if (!myId) return false;
    if (refAuthor === myId) return true;
    if (hasMentions) for (var i = 0; i < mentions.length; i++) {
        var u = mentions[i];
        if (u && (u === myId || u.id === myId)) return true;
    }
    return false;
}

function highlightRemember(channelId, id, source) {
    if (!features.messageHighlight || typeof channelId !== "string" || !channelId || typeof id !== "string" || !id) return;
    var key = channelId + ":" + id;
    var existing = highlightRecent.get(key);
    if (existing && existing.source === source) return;
    if (existing) highlightRecent.delete(key);
    else if (highlightRecent.size >= 80) highlightRecent.delete(highlightRecent.keys().next().value);
    highlightRecent.set(key, {
        channelId: channelId, id: id, source: source,
        content: source && typeof source.content === "string" ? source.content : "",
        embeds: source && Array.isArray(source.embeds) ? source.embeds : null,
        components: source && Array.isArray(source.components) ? source.components : null
    });
}

function messageRowResultOld(result, row) {
    if (!result || !row || row.rowType !== 1 || !result.message) return result;
    var pastelOn = enabled("pastelize"), translateOn = enabled("translate"), noDeleteOn = enabled("noDelete"), highlightOn = enabled("messageHighlight");
    var message = result.message;
    if (pastelOn) message = pastelMessage(message, row.message);
    if (features.pastelize && message.referencedMessage && message.referencedMessage.message) {
        var reply = pastelReply(message.referencedMessage.message);
        if (reply !== message.referencedMessage.message) message = Object.assign({}, message, {referencedMessage: Object.assign({}, message.referencedMessage, {message: reply})});
    }
    var next = message === result.message ? result : Object.assign({}, result, {message: message});
    if (!translateOn && !features.translate && !(noDeleteOn && (edits.size || deleted.size)) && !highlightOn && !features.messageHighlight) return next;
    var source = row.message || message;
    var channelId = source.channel_id || source.channelId || message.channelId;
    var id = source.id || message.id;
    if (translateOn) {
        var shown = translateRow(next.message, source, channelId, id);
        if (shown.referencedMessage) shown = translateReply(shown, source, channelId, id);
        if (shown !== next.message) next = Object.assign({}, next, {message: shown});
    } else if (features.translate) translateSeenOld(source, channelId, id, null);
    if (edits.size && noDeleteOn) {
        var shown2 = withEditHistory(next.message, channelId, id);
        if (shown2 !== next.message) next = Object.assign({}, next, {message: shown2});
    }
    var bucket = deleted.size && noDeleteOn && deletedByChannel.get(channelId);
    var isDeletedRow = !!(bucket && bucket.has(deletedKey(channelId, id)));
    var needHighlightCheck = highlightOn || features.messageHighlight;
    var isMentionRow = !isDeletedRow && needHighlightCheck && highlightMentionedOld(source, next.message);
    if (features.messageHighlight && (isDeletedRow || isMentionRow || next.backgroundHighlight))
        highlightRemember(channelId, id, source);
    var mult = highlightOn ? settings.messageHighlightThickness : 1;
    if (isDeletedRow && RN && typeof RN.processColor === "function") {
        next = Object.assign({}, next, {backgroundHighlight: {}});
    } else if (highlightOn && RN && typeof RN.processColor === "function") {
        var existing = next.backgroundHighlight;
        if (isMentionRow && settings.messageHighlightPingColor !== "default") {
            var custom = highlightCustomPair(settings.messageHighlightPingColor, "#f0b232", mult);
            if (custom) next = Object.assign({}, next, {backgroundHighlight: custom});
        } else if (existing && typeof existing.gutterColor === "number" && mult > 1) {
            next = Object.assign({}, next, {backgroundHighlight: Object.assign({}, existing, {gutterColor: highlightEncodeGutter(existing.gutterColor, mult)})});
        }
    }
    return next;
}

function messageRowResultNew(result, row) {
    if (!result || !row || row.rowType !== 1) return result;
    var message = result.message;
    if (!message) return result;
    var pastelOn = settings.pastelize && features.pastelize;
    if (pastelOn) {
        message = pastelMessage(message, row.message);
        if (message.referencedMessage && message.referencedMessage.message) {
            var reply = pastelReply(message.referencedMessage.message);
            if (reply !== message.referencedMessage.message) message = Object.assign({}, message, {referencedMessage: Object.assign({}, message.referencedMessage, {message: reply})});
        }
    }
    var next = message === result.message ? result : Object.assign({}, result, {message: message});
    var translateFeature = features.translate, highlightFeature = features.messageHighlight;
    var noDeleteActive = settings.noDelete && features.noDelete && (edits.size > 0 || deleted.size > 0);
    if (!translateFeature && !noDeleteActive && !highlightFeature) return next;
    var source = row.message || message;
    var channelId = source.channel_id || source.channelId || message.channelId;
    var id = source.id || message.id;
    if (translateFeature) {
        if (settings.translate) {
            var shown = translateRow(next.message, source, channelId, id);
            if (shown.referencedMessage) shown = translateReply(shown, source, channelId, id);
            if (shown !== next.message) next = Object.assign({}, next, {message: shown});
        } else {
            translateSeenNew(source, channelId, id, null);
        }
    }
    var isDeletedRow = false;
    if (noDeleteActive) {
        if (edits.size > 0) {
            var shown2 = withEditHistory(next.message, channelId, id);
            if (shown2 !== next.message) next = Object.assign({}, next, {message: shown2});
        }
        if (deleted.size > 0) {
            var bucket = deletedByChannel.get(channelId);
            if (bucket && bucket.has(deletedKey(channelId, id))) isDeletedRow = true;
        }
    }
    if (!isDeletedRow && !highlightFeature) return next;
    var highlightOn = settings.messageHighlight && highlightFeature;
    var isMentionRow = !isDeletedRow && highlightFeature && highlightMentionedNew(source, next.message);
    if (highlightFeature && (isDeletedRow || isMentionRow || next.backgroundHighlight))
        highlightRemember(channelId, id, source);
    if ((isDeletedRow || highlightOn) && RN && typeof RN.processColor === "function") {
        var mult = highlightOn ? settings.messageHighlightThickness : 1;
        if (isDeletedRow) {
            next = Object.assign({}, next, {backgroundHighlight: {}});
        } else {
            var existing = next.backgroundHighlight;
            if (isMentionRow && settings.messageHighlightPingColor !== "default") {
                var custom = highlightCustomPair(settings.messageHighlightPingColor, "#f0b232", mult);
                if (custom) next = Object.assign({}, next, {backgroundHighlight: custom});
            } else if (existing && typeof existing.gutterColor === "number" && mult > 1) {
                next = Object.assign({}, next, {backgroundHighlight: Object.assign({}, existing, {gutterColor: highlightEncodeGutter(existing.gutterColor, mult)})});
            }
        }
    }
    return next;
}

// Create 50 realistic chat rows (mix of plain messages, replies, mentions)
var rows = [], results = [];
for (var i = 0; i < 50; i++) {
    var id = String(100000000000000000 + i);
    var src = {
        id: id,
        channel_id: "123456789012345678",
        content: "Hello world, this is chat message number " + i + " in the channel!",
        mentions: i % 10 === 0 ? [{id: "999999999999999999"}] : [],
        mention_everyone: false,
        author: {id: String(200000000000000000 + (i % 7))}
    };
    var msg = {
        id: id,
        channelId: "123456789012345678",
        content: [{type: "text", content: src.content}],
        referencedMessage: i % 4 === 0 ? {message: {id: String(90000 + i), username: "User", content: [{type: "text", content: "quoted"}]}} : null
    };
    rows.push({rowType: 1, message: src});
    results.push({message: msg});
}

var idx = 0;
bench("old messageRowResult (50 rows batch)", function () {
    var r = rows[idx], res = results[idx];
    idx = (idx + 1) % 50;
    // simulate slight message mutation so translateSeen runs realistic both-hit-and-miss paths
    if (idx === 0) translate.shown.clear();
    return messageRowResultOld(res, r);
});
bench("new messageRowResult (50 rows batch)", function () {
    var r = rows[idx], res = results[idx];
    idx = (idx + 1) % 50;
    if (idx === 0) translate.shown.clear();
    return messageRowResultNew(res, r);
});
