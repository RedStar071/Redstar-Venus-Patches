// enabled(key): called many times per message row and per render (messageRow, hooks, previews).
var features = {pastelize:true, translate:true, noDelete:true, messageHighlight:true, platformIndicators:true, freeNitro:true};
var settings = {pastelize:false, translate:true, translateNote:true, noDelete:true, noDeleteEdits:true, messageHighlight:false,
    platformIndicators:true, piUserList:true, freeNitro:true, emojis:true, picker:false};
var featureFor = key => key === "reviewWarning" ? "reviewDB" : key === "emojis" || key === "stickers" || key === "hyperlinks" ? "freeNitro" : key === "noDeleteSave" || key === "noDeleteLimit" || key === "noDeleteEdits" ? "noDelete" : /^pi[A-Z]/.test(key) ? "platformIndicators" : key === "pastelAll" || key === "pastelContent" ? "pastelize" : key === "readAllMode" ? "readAll" : /^quests[A-Z]/.test(key) ? "quests" : /^gesture[A-Z]/.test(key) ? "gestures" : /^translate[A-Z]/.test(key) ? "translate" : /^userNotif[A-Z]/.test(key) ? "userNotif" : /^accountSwitcher[A-Z]/.test(key) ? "accountSwitcher" : /^hiddenChannels[A-Z]/.test(key) ? "hiddenChannels" : /^customThemes[A-Z]/.test(key) ? "customThemes" : /^messageHighlight[A-Z]/.test(key) ? "messageHighlight" : key;

// Before: Map cache of featureFor.
var featureTable = new Map();
var enabledMap = function (key) {
    var feature = featureTable.get(key);
    if (feature === undefined) featureTable.set(key, feature = featureFor(key));
    return !!(features[feature] && settings[key] && (feature === key || settings[feature]));
};
// Candidate: same result; main switches (the common case) skip the lookup entirely.
var optionOwner = Object.create(null);
var enabledFast = function (key) {
    if (!settings[key]) return false;
    var feature = optionOwner[key];
    if (feature === undefined) optionOwner[key] = feature = featureFor(key);
    return feature === key ? !!features[key] : !!(features[feature] && settings[feature]);
};
var keys = ["pastelize","translate","noDelete","messageHighlight","translateNote","noDeleteEdits","piUserList","emojis","picker","platformIndicators"];
for (var i = 0; i < keys.length; i++) if (enabledMap(keys[i]) !== enabledFast(keys[i])) throw new Error("mismatch " + keys[i]);
var sink = 0;
bench("Map cache (before)", function () { for (var r = 0; r < 2000; r++) for (var i = 0; i < keys.length; i++) if (enabledMap(keys[i])) sink++; });
bench("settings first + plain-object cache", function () { for (var r = 0; r < 2000; r++) for (var i = 0; i < keys.length; i++) if (enabledFast(keys[i])) sink++; });
