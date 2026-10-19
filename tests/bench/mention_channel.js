// Benchmark Dashless hot paths on Hermes HBC98:
// 1. mentionChannelInfo (Module 5796 getChannel):
//    Old: arguments + apply + fresh Object.assign on every lookup
//    New: 1-arg call1 fast path + WeakMap cache of formatted mention channel objects
// 2. questsScan (Quests scanner):
//    Old: calls questTask(item) twice per enrolled quest and questTime(item.config.expiresAt) inside questOpen AND again O(N log N) times inside Array.prototype.sort comparator
//    New: calls questTask(item) once and caches expiry timestamp during the single loop

const DASHLESS_TYPES = new Set([0, 5, 6, 14, 15, 16, 21]);
const settings = { dashless: true, hiddenChannels: false, questsVideo: true, questsPlay: true, questsActivity: true, questsEnroll: true };
const features = { dashless: true, hiddenChannels: true, quests: true };
function enabled(key) { return !!(features[key] && settings[key]); }

function dashlessFormat(channel, name) {
    return enabled("dashless") && channel && DASHLESS_TYPES.has(channel.type) && typeof name === "string" && name.indexOf("-") >= 0 ? name.replace(/-/g, " ") : name;
}

function hookExport(exports, key, operation) {
    const orig = exports[key], call1 = operation.call1, call2 = operation.call2;
    const patched = typeof call2 === "function" ?
        function (a, b) { return arguments.length === 2 ? call2(orig, this, a, b) : operation(orig, this, arguments); } :
        typeof call1 === "function" ?
        function (a) { return arguments.length === 1 ? call1(orig, this, a) : operation(orig, this, arguments); } :
        function () { return operation(orig, this, arguments); };
    return Object.assign({}, exports, { [key]: patched });
}

const channels = new Map([
    ["1", { id: "1", type: 0, name: "general-chat-discussion", guild_id: "100" }],
    ["2", { id: "2", type: 0, name: "announcements-and-news", guild_id: "100" }],
    ["3", { id: "3", type: 2, name: "voice-lobby", guild_id: "100" }],
    ["4", { id: "4", type: 0, name: "general", guild_id: "100" }]
]);

const storeBase = {
    getChannel(id) { return channels.get(id); }
};

function mentionChannelInfoOld(orig, self, args) {
    const result = orig.apply(self, args);
    if (!result || typeof result.name !== "string") return result;
    const formatted = dashlessFormat(result, result.name);
    return formatted === result.name ? result : Object.assign({}, result, { name: formatted });
}

const mentionChannelCache = new WeakMap();
function mentionChannelFormat(result) {
    if (!result || typeof result.name !== "string") return result;
    const formatted = dashlessFormat(result, result.name);
    if (formatted === result.name) return result;
    const cached = mentionChannelCache.get(result);
    if (cached && cached.name === formatted) return cached.value;
    const value = Object.assign({}, result, { name: formatted });
    mentionChannelCache.set(result, { name: formatted, value });
    return value;
}
function mentionChannelInfoNew(orig, self, args) {
    return mentionChannelFormat(orig.apply(self, args));
}
mentionChannelInfoNew.call1 = (orig, self, id) => mentionChannelFormat(orig.call(self, id));

const oldStore = hookExport(storeBase, "getChannel", mentionChannelInfoOld);
const newStore = hookExport(storeBase, "getChannel", mentionChannelInfoNew);
const ids = ["1", "2", "3", "4", "1", "2", "1", "2"];

bench("mentionChannelInfo: arguments+apply + fresh Object.assign (old, 8 lookups)", function () {
    let len = 0;
    for (let i = 0; i < 8; i++) {
        const ch = oldStore.getChannel(ids[i]);
        len += ch.name.length;
    }
    return len;
});

bench("mentionChannelInfo: call1 + WeakMap formatted cache (new, 8 lookups)", function () {
    let len = 0;
    for (let i = 0; i < 8; i++) {
        const ch = newStore.getChannel(ids[i]);
        len += ch.name.length;
    }
    return len;
});
