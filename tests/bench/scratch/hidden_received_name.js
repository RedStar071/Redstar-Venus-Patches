// Old vs new receivedName on a 500-channel server (every directory lookup walks every channel).
var HIDDEN_CHANNEL = "Hidden channel", HIDDEN_CATEGORY = "Hidden category";
var pack = {"Hidden channel": "Versteckter Kanal", "Hidden category": "Versteckte Kategorie"};
function tr(t) { var f = pack[t]; return typeof f === "string" && f ? f : t; }
var names = [];
for (var i = 0; i < 500; i++) names.push({name: i % 11 === 0 ? "_______hidden_______" : i % 13 === 0 ? "Versteckter Kanal" : i % 7 === 0 ? "hidden" : i % 3 ? "general-chat-" + i : "🎫┃help-" + i});
function oldName(channel) {
    if (!channel || typeof channel.name !== "string") return null;
    var trimmed = channel.name.trim();
    if (!trimmed) return null;
    if (trimmed.replace(/^_+|_+$/g, "").toLowerCase() === "hidden") return null;
    if (trimmed === HIDDEN_CHANNEL || trimmed === HIDDEN_CATEGORY || trimmed === tr(HIDDEN_CHANNEL) || trimmed === tr(HIDDEN_CATEGORY)) return null;
    return channel.name;
}
var REDACTED = /^_*hidden_*$/i;
function newName(channel) {
    if (!channel) return null;
    var name = channel.name;
    if (typeof name !== "string") return null;
    var n = name.length;
    // Only names as short as the facades or the redaction can be either; everything else is a real name.
    var trimmed = name.trim();
    if (!trimmed) return null;
    if (REDACTED.test(trimmed)) return null;
    if (trimmed === HIDDEN_CHANNEL || trimmed === HIDDEN_CATEGORY || trimmed === tr(HIDDEN_CHANNEL) || trimmed === tr(HIDDEN_CATEGORY)) return null;
    return name;
}
var edge=["_".repeat(60)+"HIDDEN","  hidden  ","_ hidden","hidden_ ","hİdden","\u00a0hidden\u00a0","\ufeffhidden","Hidden channel "," Versteckte Kategorie","",  "   ","x".repeat(100)];
for (var e=0;e<edge.length;e++) names.push({name:edge[e]});
names.push({}); names.push({name:5});
for (var k = 0; k < names.length; k++) if (oldName(names[k]) !== newName(names[k])) throw Error("mismatch " + names[k].name);
bench("old receivedName x500", function () { var c = 0; for (var i = 0; i < names.length; i++) if (oldName(names[i])) c++; return c; });
bench("new receivedName x500", function () { var c = 0; for (var i = 0; i < names.length; i++) if (newName(names[i])) c++; return c; });
