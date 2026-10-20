// Icon packs' RN.Image (328) hook on Hermes HBC98: every <Image> in Discord (avatars, attachments, emoji, icons) renders
// through it while a pack is on. Most sources are {uri} objects or assets the pack doesn't replace, so the miss path
// is what matters. The hook ran as operation(orig, self, arguments) and copied args with Array.from on a hit.
// Image is a plain function component in 349.9 (length 1); React calls those as Component(props, secondArg), so the
// wrapper sees 2 arguments and hookExport's call2 fast path applies.
var MISS = Object.freeze({source: null, tint: ""}), table = [];
for (var i = 1; i <= 1400; i++) table[i] = i % 3 ? MISS : Object.freeze({source: Object.freeze({uri: "https://x/" + i + ".png", width: 24, height: 24}), tint: ""});
function entryOf(id) { if (typeof id !== "number") return MISS; var hit = table[id]; return hit !== undefined ? hit : MISS; }
function Image(props, ref) { return props.source; }
var hasActive = true;
function opOld(orig, self, args) {
    if (!hasActive) return orig.apply(self, args);
    var props = args[0];
    if (!props) return orig.apply(self, args);
    var entry = entryOf(props.source);
    if (!entry.source) return orig.apply(self, args);
    var next = Object.assign({}, props, {source: entry.source});
    if (entry.tint) next.style = next.style ? [next.style, {tintColor: entry.tint}] : {tintColor: entry.tint};
    var nextArgs = Array.from(args); nextArgs[0] = next;
    return orig.apply(self, nextArgs);
}
// hookComponent's generic wrapper (no call1/call2 on the op).
var wrappedOld = function () { return opOld(Image, this, arguments); };
// New: call2 fast path for (props, secondArg) and no args copy.
function opNew2(orig, self, props, ref) {
    if (!hasActive || !props) return orig.call(self, props, ref);
    var entry = entryOf(props.source);
    if (!entry.source) return orig.call(self, props, ref);
    var next = Object.assign({}, props, {source: entry.source});
    if (entry.tint) next.style = next.style ? [next.style, {tintColor: entry.tint}] : {tintColor: entry.tint};
    return orig.call(self, next, ref);
}
function opNew1(orig, self, props) { return opNew2(orig, self, props, undefined); }
var wrappedNew = function (a, b) { var n = arguments.length; return n === 2 ? opNew2(Image, this, a, b) : n === 1 ? opNew1(Image, this, a) : opOld(Image, this, arguments); };
var props = [];
for (var j = 0; j < 256; j++) props.push(j % 4 === 0 ? {source: {uri: "https://cdn/avatar" + j}, style: {width: 32}} : {source: 1 + (j * 7) % 1400, style: {width: 24}});
var sink, ref = null;
bench("Image hook: arguments + apply, Array.from on hit (old)", function () { for (var i = 0; i < props.length; i++) sink = wrappedOld(props[i], ref); });
bench("Image hook: call2 fast path, no args copy (new)", function () { for (var i = 0; i < props.length; i++) sink = wrappedNew(props[i], ref); });
