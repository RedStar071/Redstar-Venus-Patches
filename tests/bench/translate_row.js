// translateRow runs for every chat row while Translate messages is on. In "Only when you ask" mode almost no row is
// wanted, yet the old order asked UserStore for the current user (a store getter) before the Map lookup that skips it.
// 3000-message channel, manual mode, 1% of messages picked from the hold menu, a third of them yours.
var settings = {translateMode: "manual"};
var translate = {choice: new Map()};
var me = {id: "100"};
var userStore = {_u: me, getCurrentUser: function () { return this._u; }};
function currentUser() { return userStore && userStore.getCurrentUser(); }
function translateWanted(id) {
    var choice = translate.choice.get(id);
    return settings.translateMode === "manual" ? choice === true : choice !== false;
}
var seen = 0;
function translateSeen() { seen++; }
function translateContentSource(m) { return m; }
var rows = [];
for (var i = 0; i < 3000; i++) {
    var id = String(1e17 + i);
    if (i % 100 === 0) translate.choice.set(id, true);
    rows.push({id: id, channel_id: "9", content: "hello there " + i, author: {id: i % 3 === 0 ? "100" : String(200 + i)}});
}
var message = {content: [{type: "text", content: "x"}], authorId: "1"};
function rowOld(message, source, channelId, id) {
    var contentSource = translateContentSource(source);
    if (!message || !Array.isArray(message.content) || !contentSource || typeof contentSource.content !== "string" || !channelId || !id) return message;
    var author = source && source.author && source.author.id || message.authorId, me = currentUser();
    if (me && author === me.id && translate.choice.get(id) !== true || !translateWanted(id)) { translateSeen(source, channelId, id, null); return message; }
    return null;
}
function rowNew(message, source, channelId, id) {
    var contentSource = translateContentSource(source);
    if (!message || !Array.isArray(message.content) || !contentSource || typeof contentSource.content !== "string" || !channelId || !id) return message;
    // Not wanted (most rows in manual mode) needs no user lookup; your own message only counts when you picked it.
    var choice = translate.choice.get(id);
    if (settings.translateMode === "manual" ? choice !== true : choice === false) { translateSeen(source, channelId, id, null); return message; }
    if (choice !== true) {
        var author = source && source.author && source.author.id || message.authorId, me = currentUser();
        if (me && author === me.id) { translateSeen(source, channelId, id, null); return message; }
    }
    return null;
}
// Same answers for every row, in both modes.
["manual", "auto"].forEach(function (mode) {
    settings.translateMode = mode;
    for (var i = 0; i < rows.length; i++) if (rowOld(message, rows[i], "9", rows[i].id) !== rowNew(message, rows[i], "9", rows[i].id)) throw new Error("mismatch " + mode + " " + i);
});
settings.translateMode = "manual";
bench("old: user lookup before the choice (3000 rows, manual)", function () { for (var i = 0; i < rows.length; i++) rowOld(message, rows[i], "9", rows[i].id); });
bench("new: choice first (3000 rows, manual)", function () { for (var i = 0; i < rows.length; i++) rowNew(message, rows[i], "9", rows[i].id); });
