// Benchmark instrument() on Hermes HBC98:
// Old: allocates `changes = new Map()`, uses `for..of` on literal arrays, and calls `Array.from(changes)` on every instrumented module.
// New: checks keys directly without allocating a Map or Array.from when descriptors are configurable/writable (the 100% normal case).

var features = { voice: true, picker: true };
var status = { request: false, attachment: false, picker: false, conversion: false };
var React = null, RN = null;
var owns = Object.prototype.hasOwnProperty.bind(Object.prototype);
function data(object, key) {
    if (!object || (typeof object !== "object" && typeof object !== "function") || !owns(object, key)) return undefined;
    var descriptor = Object.getOwnPropertyDescriptor(object, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
}
function initFiles() {}
function instrumentCloudUpload() {}
function pickerComponent(e) { return e; }
function postRequest(orig, self, args) { return orig.apply(self, args); }
function attachmentPayload(orig, self, args) { return orig.apply(self, args); }

function instrumentOld(exports, depth) {
    if (!exports || (typeof exports !== "object" && typeof exports !== "function")) return exports;
    if (owns(exports, "createElement") && owns(exports, "useState")) React = exports;
    if (owns(exports, "View") && owns(exports, "Text") && owns(exports, "Modal")) RN = exports;
    if (typeof data(exports, "getSize") === "function" && typeof data(exports, "readFile") === "function" &&
        typeof data(exports, "writeFile") === "function") initFiles(exports);
    if (features.voice && owns(exports, "CloudUpload")) instrumentCloudUpload(exports.CloudUpload);
    const changes = new Map();
    let proxy = exports;
    if (features.picker) {
        const patched = pickerComponent(exports);
        if (patched !== exports) return patched;
    }
    function replacementFor(operation, orig) {
        if (typeof operation !== "function" || typeof orig !== "function")
            throw new Error("Venus: unusable export binding for hook");
        return function () { return operation(orig, this === proxy ? exports : this, arguments); };
    }
    for (const key of ["getAttachmentPayload", "post"]) {
        if (!owns(exports, key)) continue;
        if (key === "getAttachmentPayload" && !features.voice) continue;
        if (key === "post" && (!features.voice || !owns(exports, "get") || !owns(exports, "put"))) continue;
        let orig;
        try { orig = exports[key]; } catch (_) { continue; }
        if (typeof orig !== "function") continue;
        const operation = key === "post" ? postRequest : attachmentPayload;
        const patched = replacementFor(operation, orig);
        changes.set(key, patched);
        if (key === "post") status.request = true;
        if (key === "getAttachmentPayload") status.attachment = true;
    }
    if (depth < 2) for (const key of ["default", "HTTP"]) {
        const candidate = data(exports, key);
        if (!candidate || candidate === exports) continue;
        const patched = instrumentOld(candidate, depth + 1);
        if (patched !== candidate) changes.set(key, patched);
    }
    if (!changes.size) return exports;
    for (const [key, patched] of Array.from(changes)) {
        const descriptor = Object.getOwnPropertyDescriptor(exports, key);
        if (descriptor && descriptor.configurable) {
            Object.defineProperty(exports, key, { value: patched, writable: true,
                configurable: true, enumerable: descriptor.enumerable });
            changes.delete(key);
        } else if (descriptor && "value" in descriptor && descriptor.writable) {
            exports[key] = patched;
            changes.delete(key);
        }
    }
    if (!changes.size) return exports;
    for (const key of Array.from(changes.keys())) {
        const descriptor = Object.getOwnPropertyDescriptor(exports, key);
        if (descriptor && !descriptor.configurable && "value" in descriptor && !descriptor.writable)
            changes.delete(key);
    }
    proxy = new Proxy(exports, { get(target, key, self) {
        return changes.has(key) ? changes.get(key) : Reflect.get(target, key, self);
    } });
    return changes.size ? proxy : exports;
}

const INSTRUMENT_HOOK_KEYS = ["getAttachmentPayload", "post"];
const INSTRUMENT_SUB_KEYS = ["default", "HTTP"];
function instrumentNew(exports, depth) {
    if (!exports || (typeof exports !== "object" && typeof exports !== "function")) return exports;
    if (owns(exports, "createElement") && owns(exports, "useState")) React = exports;
    if (owns(exports, "View") && owns(exports, "Text") && owns(exports, "Modal")) RN = exports;
    if (typeof data(exports, "getSize") === "function" && typeof data(exports, "readFile") === "function" &&
        typeof data(exports, "writeFile") === "function") initFiles(exports);
    if (features.voice && owns(exports, "CloudUpload")) instrumentCloudUpload(exports.CloudUpload);
    if (features.picker) {
        const patched = pickerComponent(exports);
        if (patched !== exports) return patched;
    }
    let changes = null;
    let proxy = exports;
    function applyOrDefer(key, patched) {
        const descriptor = Object.getOwnPropertyDescriptor(exports, key);
        if (descriptor && descriptor.configurable) {
            Object.defineProperty(exports, key, { value: patched, writable: true,
                configurable: true, enumerable: descriptor.enumerable });
        } else if (descriptor && "value" in descriptor && descriptor.writable) {
            exports[key] = patched;
        } else if (!descriptor || descriptor.configurable || !("value" in descriptor) || descriptor.writable) {
            if (!changes) changes = new Map();
            changes.set(key, patched);
        }
    }
    function replacementFor(operation, orig) {
        if (typeof operation !== "function" || typeof orig !== "function")
            throw new Error("Venus: unusable export binding for hook");
        return function () { return operation(orig, this === proxy ? exports : this, arguments); };
    }
    if (features.voice) {
        for (let i = 0; i < INSTRUMENT_HOOK_KEYS.length; i++) {
            const key = INSTRUMENT_HOOK_KEYS[i];
            if (!owns(exports, key)) continue;
            if (key === "post" && (!owns(exports, "get") || !owns(exports, "put"))) continue;
            let orig;
            try { orig = exports[key]; } catch (_) { continue; }
            if (typeof orig !== "function") continue;
            const operation = key === "post" ? postRequest : attachmentPayload;
            const patched = replacementFor(operation, orig);
            applyOrDefer(key, patched);
            if (key === "post") status.request = true;
            else status.attachment = true;
        }
    }
    if (depth < 2) {
        for (let i = 0; i < INSTRUMENT_SUB_KEYS.length; i++) {
            const key = INSTRUMENT_SUB_KEYS[i];
            const candidate = data(exports, key);
            if (!candidate || candidate === exports) continue;
            const patched = instrumentNew(candidate, depth + 1);
            if (patched !== candidate) applyOrDefer(key, patched);
        }
    }
    if (!changes || !changes.size) return exports;
    proxy = new Proxy(exports, { get(target, key, self) {
        return changes.has(key) ? changes.get(key) : Reflect.get(target, key, self);
    } });
    return proxy;
}

function makeModules() {
    return [
        { createElement: function () {}, useState: function () {} },
        { View: {}, Text: {}, Modal: {} },
        { default: { getSize: function () {}, readFile: function () {}, writeFile: function () {} } },
        { HTTP: { get: function () {}, put: function () {}, post: function () {} } },
        { default: { getAttachmentPayload: function () {} } },
        { CloudUpload: function () {} },
        { displayName: "OtherComponent" }
    ];
}

bench("instrument: old Map + Array.from per module (7 modules)", function () {
    const mods = makeModules();
    for (let i = 0; i < mods.length; i++) instrumentOld(mods[i], 0);
    return mods.length;
});

bench("instrument: new direct descriptor write without Map/Array.from (7 modules)", function () {
    const mods = makeModules();
    for (let i = 0; i < mods.length; i++) instrumentNew(mods[i], 0);
    return mods.length;
});
