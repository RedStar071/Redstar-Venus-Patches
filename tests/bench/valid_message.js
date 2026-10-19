// Benchmark validMessage + messageMentionIds across 50 loaded messages on Hermes HBC98.
var MENTION_ID = /<@!?(\d{17,20})>/g;
var valid = {refreshing: new Set(), tried: new Set(), waiting: new Map(), queued: new Set(), queue: [], running: false};
var knownSet = new Set(["111111111111111111", "222222222222222222"]);
function knownUser(id) { return knownSet.has(id); }

function mentionIdsOld(text, out) {
    if (typeof text !== "string" || text.indexOf("<@") < 0) return;
    MENTION_ID.lastIndex = 0;
    var match;
    while ((match = MENTION_ID.exec(text))) out.add(match[1]);
}
function componentIdsOld(components, out, depth) {
    if (!Array.isArray(components) || depth > 5) return;
    for (var i = 0; i < components.length; i++) {
        var part = components[i];
        if (!part || typeof part !== "object") continue;
        mentionIdsOld(part.content, out); mentionIdsOld(part.label, out);
        componentIdsOld(part.components, out, depth + 1);
    }
}
function messageMentionIdsOld(message, out) {
    mentionIdsOld(message.content, out);
    if (Array.isArray(message.embeds)) for (var i = 0; i < message.embeds.length; i++) {
        var embed = message.embeds[i];
        if (embed) {
            mentionIdsOld(embed.title, out); mentionIdsOld(embed.description, out);
            mentionIdsOld(embed.rawTitle, out); mentionIdsOld(embed.rawDescription, out);
            if (embed.footer) mentionIdsOld(embed.footer.text, out);
            if (Array.isArray(embed.fields)) for (var j = 0; j < embed.fields.length; j++) {
                var field = embed.fields[j];
                if (field) {
                    mentionIdsOld(field.name, out); mentionIdsOld(field.value, out); mentionIdsOld(field.rawName, out); mentionIdsOld(field.rawValue, out);
                }
            }
        }
    }
    componentIdsOld(message.components, out, 0);
    var snapshots = message.message_snapshots || message.messageSnapshots;
    if (Array.isArray(snapshots)) for (var k = 0; k < snapshots.length; k++) {
        var inner = snapshots[k] && snapshots[k].message;
        if (inner) { mentionIdsOld(inner.content, out); componentIdsOld(inner.components, out, 0); }
    }
    return out;
}
var validScratchOld = new Set();
function validMessageOld(message, channelId) {
    if (!message || !message.id || !channelId || valid.refreshing.has(message.id)) return;
    validScratchOld.clear();
    messageMentionIdsOld(message, validScratchOld);
    if (!validScratchOld.size) return;
    var missing = [];
    validScratchOld.forEach(function (id) { if (!valid.tried.has(id) && !knownUser(id)) missing.push(id); });
    validScratchOld.clear();
}

function componentIdsNew(components, out, depth) {
    if (!components || !components.length || depth > 5 || !Array.isArray(components)) return;
    for (var i = 0; i < components.length; i++) {
        var part = components[i];
        if (!part || typeof part !== "object") continue;
        mentionIdsOld(part.content, out); mentionIdsOld(part.label, out);
        if (part.components && part.components.length) componentIdsNew(part.components, out, depth + 1);
    }
}
function messageMentionIdsNew(message, out) {
    var content = message.content;
    if (typeof content === "string" && content.indexOf("<@") >= 0) mentionIdsOld(content, out);
    var embeds = message.embeds;
    if (embeds && embeds.length && Array.isArray(embeds)) for (var i = 0; i < embeds.length; i++) {
        var embed = embeds[i];
        if (embed) {
            mentionIdsOld(embed.title, out); mentionIdsOld(embed.description, out);
            mentionIdsOld(embed.rawTitle, out); mentionIdsOld(embed.rawDescription, out);
            if (embed.footer) mentionIdsOld(embed.footer.text, out);
            var fields = embed.fields;
            if (fields && fields.length && Array.isArray(fields)) for (var j = 0; j < fields.length; j++) {
                var field = fields[j];
                if (field) {
                    mentionIdsOld(field.name, out); mentionIdsOld(field.value, out); mentionIdsOld(field.rawName, out); mentionIdsOld(field.rawValue, out);
                }
            }
        }
    }
    var comps = message.components;
    if (comps && comps.length) componentIdsNew(comps, out, 0);
    var snapshots = message.message_snapshots || message.messageSnapshots;
    if (snapshots && snapshots.length && Array.isArray(snapshots)) for (var k = 0; k < snapshots.length; k++) {
        var inner = snapshots[k] && snapshots[k].message;
        if (inner) { mentionIdsOld(inner.content, out); if (inner.components && inner.components.length) componentIdsNew(inner.components, out, 0); }
    }
    return out;
}
var validScratchNew = new Set();
function validMessageNew(message, channelId) {
    if (!message || !message.id || !channelId || valid.refreshing.size && valid.refreshing.has(message.id)) return;
    messageMentionIdsNew(message, validScratchNew);
    if (!validScratchNew.size) return;
    var missing = [];
    validScratchNew.forEach(function (id) { if (!valid.tried.has(id) && !knownUser(id)) missing.push(id); });
    validScratchNew.clear();
}

var messages = [];
for (var i = 0; i < 50; i++) {
    messages.push({
        id: String(100000000000000000 + i),
        channel_id: "999",
        content: i % 10 === 0 ? "Hey <@111111111111111111> check this out!" : "Just a normal message in the channel without any mentions #" + i,
        embeds: [],
        components: []
    });
}

bench("old validMessage (50 channel messages)", function () {
    for (var i = 0; i < messages.length; i++) validMessageOld(messages[i], "999");
});
bench("new validMessage (50 channel messages)", function () {
    for (var i = 0; i < messages.length; i++) validMessageNew(messages[i], "999");
});
