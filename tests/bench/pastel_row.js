// pastelMessage + pastelMentions: runs on every chat row when pastelize is enabled.
var settings = {pastelize: true, pastelAll: false, pastelContent: false};
var guildMembers = {getMember: function () { return {userId: "1"}; }};
var pastelTable = new Map([["111", {hex: "#aabbcc", value: -111}], ["222", {hex: "#ddeeff", value: -222}]]);
function pastelColor(seed, sat, light) { return pastelTable.get(seed); }

function pastelMentionsShip(content, guildId) {
    if (!Array.isArray(content) || !content.length) return content;
    var next = null;
    for (var i = 0; i < content.length; i++) {
        var node = content[i];
        if (!node || typeof node !== "object") continue;
        var result = node;
        if (node.type === "mention" && node.userId && (!node.colorString || settings.pastelAll) &&
            (!guildId || guildMembers && guildMembers.getMember(guildId, node.userId))) {
            var color = pastelColor(node.userId, 0.85, 0.75);
            if (color) result = Object.assign({}, node, {roleColor: color.value, color: color.value, colorString: color.hex});
        }
        if (Array.isArray(node.content) && node.content.length) {
            var children = pastelMentionsShip(node.content, guildId);
            if (children !== node.content) result = Object.assign({}, result, {content: children});
        }
        if (result !== node) { if (!next) next = content.slice(); next[i] = result; }
    }
    return next || content;
}

function pastelMessageShip(message, source) {
    if (!message || !message.authorId) return message;
    if (message.guildId && (!guildMembers || !guildMembers.getMember(message.guildId, message.authorId)) && !(source && source.webhookId)) return message;
    var seed;
    if (source && source.webhookId) seed = message.username || source.webhookId;
    else if (!(source && source.colorString != null ? source.colorString : message.roleColor) || settings.pastelAll) seed = message.authorId;
    var color = seed && pastelColor(seed, 0.75, 0.6);
    var content = pastelMentionsShip(message.content, message.guildId);
    if (!color && content === message.content && message.shouldShowRoleOnName === true) return message;
    var changes = color ? {roleColor: color.value, usernameColor: color.value, colorString: color.value, shouldShowRoleOnName: true} : {shouldShowRoleOnName: true};
    if (content !== message.content) changes.content = content;
    if (color && settings.pastelContent) {
        var text = pastelColor(seed, 0.85, 0.75);
        if (text) changes.textColor = text.value;
    }
    return Object.assign({}, message, changes);
}

// Notice what pastelMessageShip does when `color` is truthy:
// `var changes = {roleColor: ..., usernameColor: ..., colorString: ..., shouldShowRoleOnName: true};`
// `return Object.assign({}, message, changes);`
// It allocates an intermediate `changes` object on every row and then merges TWO objects into `{}` with `Object.assign({}, message, changes)`!
// What if we copy `message` once with `const copy = Object.assign({}, message)` and set properties directly on `copy`?
// Even better: in `pastelMentions`, 95% of messages are a single `{type: "text", content: "..."}` node where `node.type !== "mention"` and `node.content` is a string (not an Array)!
// Checking `typeof node.content === "object"` before `Array.isArray(node.content)` avoids calling `Array.isArray` on every string content node!
function pastelMentionsFast(content, guildId) {
    if (!Array.isArray(content) || !content.length) return content;
    var next = null;
    for (var i = 0; i < content.length; i++) {
        var node = content[i];
        if (!node || typeof node !== "object") continue;
        var result = node;
        if (node.type === "mention" && node.userId && (!node.colorString || settings.pastelAll) &&
            (!guildId || guildMembers && guildMembers.getMember(guildId, node.userId))) {
            var color = pastelColor(node.userId, 0.85, 0.75);
            if (color) result = Object.assign({}, node, {roleColor: color.value, color: color.value, colorString: color.hex});
        }
        var sub = node.content;
        if (typeof sub === "object" && Array.isArray(sub) && sub.length) {
            var children = pastelMentionsFast(sub, guildId);
            if (children !== sub) result = Object.assign({}, result, {content: children});
        }
        if (result !== node) { if (!next) next = content.slice(); next[i] = result; }
    }
    return next || content;
}

function pastelMessageFast(message, source) {
    if (!message || !message.authorId) return message;
    if (message.guildId && (!guildMembers || !guildMembers.getMember(message.guildId, message.authorId)) && !(source && source.webhookId)) return message;
    var seed;
    if (source && source.webhookId) seed = message.username || source.webhookId;
    else if (!(source && source.colorString != null ? source.colorString : message.roleColor) || settings.pastelAll) seed = message.authorId;
    var color = seed && pastelColor(seed, 0.75, 0.6);
    var content = pastelMentionsFast(message.content, message.guildId);
    if (!color && content === message.content && message.shouldShowRoleOnName === true) return message;
    var copy = Object.assign({}, message);
    copy.shouldShowRoleOnName = true;
    if (color) {
        copy.roleColor = color.value;
        copy.usernameColor = color.value;
        copy.colorString = color.value;
        if (settings.pastelContent) {
            var text = pastelColor(seed, 0.85, 0.75);
            if (text) copy.textColor = text.value;
        }
    }
    if (content !== message.content) copy.content = content;
    return copy;
}

var msg = {
    id: "1",
    authorId: "111",
    guildId: "999",
    username: "Alice",
    content: [{type: "text", content: "Hello world, how is everyone doing today?"}]
};
var src = {id: "1", author: {id: "111"}};

bench("pastelMessage (ships: intermediate changes object)", function () {
    for (var i = 0; i < 10000; i++) pastelMessageShip(msg, src);
});
bench("pastelMessage (single Object.assign + direct props)", function () {
    for (var i = 0; i < 10000; i++) pastelMessageFast(msg, src);
});
