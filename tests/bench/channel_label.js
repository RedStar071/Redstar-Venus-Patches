// Benchmark channelLabel (Module 5043 computeChannelName) & useChannelLabel (Module 5043 default) on Hermes HBC98:
// Old:
//  - channelLabel & useChannelLabel have no call1/call2 fast path, so hookExport always reifies `arguments` and calls `orig.apply(self, next)`
//  - dashlessFormat calls `name.includes("-") ? name.replace(/-/g, " ") : name` on every channel label render
// New:
//  - Add call1 and call2 fast paths to channelLabel and useChannelLabel, and cache dashlessFormat results in a bounded Map so `name.replace(/-/g, " ")` runs once per hyphenated channel name instead of on every channel list / header / mention render!

const DASHLESS_TYPES = new Set([0, 5, 6, 14, 15, 16, 21]);
const settings = { dashless: true, hiddenChannels: false };
const features = { dashless: true, hiddenChannels: true };
function enabled(key) { return !!(features[key] && settings[key]); }
function hiddenMetadata() { return false; }

function dashlessFormatOld(channel, name) {
    return enabled("dashless") && channel && DASHLESS_TYPES.has(channel.type) && typeof name === "string" && name.includes("-") ? name.replace(/-/g, " ") : name;
}

const dashlessNames = new Map();
function dashlessFormatNew(channel, name) {
    if (!enabled("dashless") || !channel || !DASHLESS_TYPES.has(channel.type) || typeof name !== "string" || name.indexOf("-") < 0) return name;
    const cached = dashlessNames.get(name);
    if (cached !== undefined) return cached;
    const formatted = name.replace(/-/g, " ");
    if (dashlessNames.size >= 512) dashlessNames.delete(dashlessNames.keys().next().value);
    dashlessNames.set(name, formatted);
    return formatted;
}

function hookExportOld(exports, key, operation) {
    const orig = exports && exports[key];
    const call2 = operation.call2, call1 = operation.call1;
    const patched = typeof call2 === "function" ?
        function (a, b) { return arguments.length === 2 ? call2(orig, this, a, b) : operation(orig, this, arguments); } :
        typeof call1 === "function" ?
        function (a) { return arguments.length === 1 ? call1(orig, this, a) : operation(orig, this, arguments); } :
        function () { return operation(orig, this, arguments); };
    return Object.assign({}, exports, { [key]: patched });
}

function channelLabelOld(orig, self, args) {
    const channel = args[0];
    return dashlessFormatOld(channel, orig.apply(self, args));
}

function channelLabelNew(orig, self, args) {
    const channel = args[0];
    return dashlessFormatNew(channel, orig.apply(self, args));
}
channelLabelNew.call1 = (orig, self, channel) =>
    hiddenMetadata(channel) ? channelLabelNew(orig, self, [channel]) : dashlessFormatNew(channel, orig.call(self, channel));
channelLabelNew.call2 = (orig, self, channel, b) =>
    hiddenMetadata(channel) ? channelLabelNew(orig, self, [channel, b]) : dashlessFormatNew(channel, orig.call(self, channel, b));

function hookExportNew(exports, key, operation) {
    const orig = exports && exports[key];
    const call2 = operation.call2, call1 = operation.call1;
    const patched = typeof call2 === "function" && typeof call1 === "function" ?
        function (a, b) {
            const n = arguments.length;
            return n === 1 ? call1(orig, this, a) : n === 2 ? call2(orig, this, a, b) : operation(orig, this, arguments);
        } :
        typeof call2 === "function" ?
        function (a, b) { return arguments.length === 2 ? call2(orig, this, a, b) : operation(orig, this, arguments); } :
        typeof call1 === "function" ?
        function (a) { return arguments.length === 1 ? call1(orig, this, a) : operation(orig, this, arguments); } :
        function () { return operation(orig, this, arguments); };
    return Object.assign({}, exports, { [key]: patched });
}

const modBase = {
    computeChannelName(ch) { return ch.name; },
    default(ch) { return ch.name; }
};

const oldMod = hookExportOld(hookExportOld(modBase, "computeChannelName", channelLabelOld), "default", channelLabelOld);
const newMod = hookExportNew(hookExportNew(modBase, "computeChannelName", channelLabelNew), "default", channelLabelNew);

const sampleChannels = [];
for (let i = 0; i < 32; i++) {
    sampleChannels.push({
        id: String(100 + i),
        type: i % 4 === 0 ? 2 : 0,
        name: i % 2 === 0 ? "general-chat-room-" + i : "announcements"
    });
}
// Warm up cache
for (let i = 0; i < 32; i++) newMod.computeChannelName(sampleChannels[i]);

bench("channelLabel: arguments + apply + replace per call (old, 32 channels)", function () {
    let total = 0;
    for (let i = 0; i < 32; i++) {
        total += oldMod.computeChannelName(sampleChannels[i]).length;
    }
    return total;
});

bench("channelLabel: call1/call2 + cached dashlessFormat (new, 32 channels)", function () {
    let total = 0;
    for (let i = 0; i < 32; i++) {
        total += newMod.computeChannelName(sampleChannels[i]).length;
    }
    return total;
});
