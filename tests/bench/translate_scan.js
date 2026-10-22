// The translate bar asks translateScanChannel whether a chat has a message in another language on every render and on
// every MessageStore change, from any chat. Discord swaps a chat's message collection for a new one when it changes, so
// the new version only walks a collection it hasn't seen. 50 messages in view (Discord keeps about that many per chat),
// 100 store changes from other chats while this one stays the same.
var msgStore = {_c: null, getMessages: function () { return this._c; }};
var me = {id: "1"};
function currentUser() { return me; }
function translateTarget() { return "en"; }
function translateContentSource(m) { return m; }
var seen = 0;
function translateSeen() { seen++; }
function translateLooksForeign(text) { return /[\u0400-\u04ff]/.test(text) || text.indexOf("gracias") >= 0; }
var translate = {foreign: new Map()};
var TRANSLATE_FOREIGN = 200;
var list = [];
for (var i = 0; i < 50; i++) list.push({id: String(1e17 + i), content: "message number " + i + " about the game tonight", author: {id: String(2 + i % 5)}});
msgStore._c = {_array: list};
function scanOld(channelId) {
    var msgs = msgStore.getMessages(channelId);
    var list = msgs && (Array.isArray(msgs._array) ? msgs._array : null);
    if (!Array.isArray(list) || !list.length) return false;
    var me = currentUser(), myId = me && me.id, found = false;
    for (var i = list.length - 1; i >= 0; i--) {
        var msg = list[i], src = translateContentSource(msg), text = src && src.content;
        if (typeof text !== "string" || !text) continue;
        translateSeen(msg, channelId, msg.id, null);
        var authorId = msg.author && msg.author.id;
        if (!found && authorId !== myId && translateLooksForeign(text)) found = true;
    }
    return found;
}
var scans = new Map();
function scanNew(channelId, force) {
    var msgs = msgStore.getMessages(channelId);
    var me = currentUser(), myId = me && me.id, target = translateTarget(), last = scans.get(channelId);
    if (!force && last && last.msgs === msgs && last.target === target && last.myId === myId) return last.result;
    var result = scanOld(channelId);
    scans.set(channelId, {msgs: msgs, target: target, myId: myId, result: result});
    return result;
}
if (scanOld("9") !== scanNew("9")) throw new Error("mismatch");
bench("old: walk the chat on every store change (100 changes)", function () { for (var i = 0; i < 100; i++) scanOld("9"); });
bench("new: walk only a new message collection (100 changes)", function () { for (var i = 0; i < 100; i++) scanNew("9"); });
