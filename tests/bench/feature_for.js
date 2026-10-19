// Benchmark featureFor(key) + enabled(key) across all settings keys on Hermes HBC98.
var features = {
    picker: true, voice: true, copyBios: true, dashless: true, favouriteAnything: true, freeNitro: true,
    noTyping: true, quickDelete: true, noDelete: true, jumpToTop: true, hiddenChannels: true,
    pastelize: true, platformIndicators: true, reviewDB: true, readAll: true, quests: true,
    systemFont: true, hideGift: true, hideQuestDock: true, systemEmoji: true, gestures: true,
    hideCall: true, validUser: true, youBarSettings: true, splitMessages: true, translate: true,
    userNotif: true, accountSwitcher: true, appIcons: true, customThemes: true, messageHighlight: true
};
var settings = {
    picker: false, voice: false, copyBios: false, dashless: false, favouriteAnything: false, freeNitro: true, emojis: true, stickers: true, hyperlinks: true,
    noTyping: false, quickDelete: false, noDelete: true, noDeleteSave: false, noDeleteLimit: 512, noDeleteEdits: true,
    jumpToTop: false, hiddenChannels: true, hiddenChannelsMenu: true, pastelize: false, pastelAll: false, pastelContent: false,
    platformIndicators: true, piDmHeader: true, piUserList: true, piProfile: true, piHideMobile: true, reviewDB: false, reviewWarning: true,
    readAll: false, readAllMode: "guilds", quests: true, questsVideo: true, questsPlay: true, questsActivity: true, questsEnroll: true,
    systemFont: false, hideGift: false, hideQuestDock: false, systemEmoji: false, gestures: true, gestureOwn: "edit", gestureTripleDelete: true,
    hideCall: false, validUser: false, youBarSettings: false, splitMessages: false,
    translate: true, translateTarget: "discord", translateMode: "auto", translateNote: true, translateOriginal: false,
    userNotif: true, userNotifFriends: true, userNotifStatus: true, userNotifMessages: true, userNotifTyping: true, userNotifPush: false,
    accountSwitcher: false, accountSwitcherYouBar: true, appIcons: false, customThemes: false, customThemesBackground: true,
    messageHighlight: true, messageHighlightThickness: 2, messageHighlightPingColor: "default", messageHighlightDeletedColor: "default", language: "auto"
};

var featureTableOld = Object.create(null);
function featureForOld(key) {
    return key === "reviewWarning" ? "reviewDB" : key === "emojis" || key === "stickers" || key === "hyperlinks" ? "freeNitro" : key === "noDeleteSave" || key === "noDeleteLimit" || key === "noDeleteEdits" ? "noDelete" : /^pi[A-Z]/.test(key) ? "platformIndicators" : key === "pastelAll" || key === "pastelContent" ? "pastelize" : key === "readAllMode" ? "readAll" : /^quests[A-Z]/.test(key) ? "quests" : /^gesture[A-Z]/.test(key) ? "gestures" : /^translate[A-Z]/.test(key) ? "translate" : /^userNotif[A-Z]/.test(key) ? "userNotif" : /^accountSwitcher[A-Z]/.test(key) ? "accountSwitcher" : /^hiddenChannels[A-Z]/.test(key) ? "hiddenChannels" : /^customThemes[A-Z]/.test(key) ? "customThemes" : /^messageHighlight[A-Z]/.test(key) ? "messageHighlight" : key;
}
function enabledOld(key) {
    if (!settings[key]) return false;
    var feature = featureTableOld[key];
    if (feature === undefined) featureTableOld[key] = feature = featureForOld(key);
    return feature === key ? !!features[key] : !!(features[feature] && settings[feature]);
}

var featureTableNew = Object.create(null);
function featureForNew(key) {
    var feature = featureTableNew[key];
    if (feature !== undefined) return feature;
    return featureTableNew[key] = key === "reviewWarning" ? "reviewDB" : key === "emojis" || key === "stickers" || key === "hyperlinks" ? "freeNitro" : key === "noDeleteSave" || key === "noDeleteLimit" || key === "noDeleteEdits" ? "noDelete" : /^pi[A-Z]/.test(key) ? "platformIndicators" : key === "pastelAll" || key === "pastelContent" ? "pastelize" : key === "readAllMode" ? "readAll" : /^quests[A-Z]/.test(key) ? "quests" : /^gesture[A-Z]/.test(key) ? "gestures" : /^translate[A-Z]/.test(key) ? "translate" : /^userNotif[A-Z]/.test(key) ? "userNotif" : /^accountSwitcher[A-Z]/.test(key) ? "accountSwitcher" : /^hiddenChannels[A-Z]/.test(key) ? "hiddenChannels" : /^customThemes[A-Z]/.test(key) ? "customThemes" : /^messageHighlight[A-Z]/.test(key) ? "messageHighlight" : key;
}
function enabledNew(key) {
    if (!settings[key]) return false;
    var feature = featureTableNew[key] || featureForNew(key);
    return feature === key ? !!features[key] : !!(features[feature] && settings[feature]);
}

var allKeys = Object.keys(settings);
for (var i = 0; i < allKeys.length; i++) {
    var k = allKeys[i];
    if (featureForOld(k) !== featureForNew(k) || enabledOld(k) !== enabledNew(k)) throw new Error("Mismatch on " + k);
}

var sink = 0;
bench("old featureFor + enabled (all 60 settings keys)", function () {
    for (var i = 0; i < allKeys.length; i++) {
        var k = allKeys[i];
        if (features[featureForOld(k)] && enabledOld(k)) sink++;
    }
});
bench("new featureFor + enabled (all 60 settings keys)", function () {
    for (var i = 0; i < allKeys.length; i++) {
        var k = allKeys[i];
        if (features[featureForNew(k)] && enabledNew(k)) sink++;
    }
});
