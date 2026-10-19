// Venus' __d wrapper over Discord's 17.7k-module define storm (decorateDefine in bootstrap.js).
var targetModules = new Set([17, 19, 1162, 11129, 14409, 14500, 414, 1282, 7268, 7243, 584, 5110, 5112, 1377, 2051, 6965, 7591,
    1085, 1096, 1112, 2103, 4507, 7039, 4509, 5043, 16157, 5879, 4930, 4908, 10843, 10602, 13107, 15962, 9334, 13920, 12849,
    7187, 7252, 13439, 13477, 5638, 5687, 4528, 13797, 6840, 589, 590, 591, 1193, 4593, 9758, 9769, 11281, 2116]);
var ids = []; for (var i = 0; i < 17700; i++) ids.push(i * 7 % 18000);
var sink = 0;
function metroDefine(factory, id, deps) { sink += id; }
function factory() {}
// Current code (1.16.x): Set lookup, arguments.length check, define.call for the 17.6k untouched modules.
function decorateSet(define) {
    return function (factory, id, dependencies) {
        if ((id !== 120 && !targetModules.has(id)) || typeof factory !== "function")
            return arguments.length === 3 ? define.call(this, factory, id, dependencies) : define.apply(this, arguments);
        return define.call(this, factory, id, dependencies);
    };
}
// Candidate: dense Uint8Array membership instead of a Set hash lookup.
var targetTable = new Uint8Array(32768);
targetModules.forEach(function (id) { targetTable[id] = 1; }); targetTable[120] = 1;
function decorateTable(define) {
    return function (factory, id, dependencies) {
        if (targetTable[id] !== 1 || typeof factory !== "function")
            return arguments.length === 3 ? define.call(this, factory, id, dependencies) : define.apply(this, arguments);
        return define.call(this, factory, id, dependencies);
    };
}
var dSet = decorateSet(metroDefine), dTable = decorateTable(metroDefine);
bench("no wrapper (Discord alone)", function () { for (var i = 0; i < ids.length; i++) metroDefine(factory, ids[i], null); });
bench("Set lookup (ships)", function () { for (var i = 0; i < ids.length; i++) dSet(factory, ids[i], null); });
bench("Uint8Array table", function () { for (var i = 0; i < ids.length; i++) dTable(factory, ids[i], null); });
// Candidate: same table, and Metro's 3-argument call goes straight to define.call without the arguments check.
function decorateTableDirect(define) {
    return function (factory, id, dependencies) {
        if (targetTable[id] !== 1 || typeof factory !== "function") {
            if (arguments.length === 3) return define.call(this, factory, id, dependencies);
            return define.apply(this, arguments);
        }
        return define.call(this, factory, id, dependencies);
    };
}
var plainTable = []; for (var i = 0; i < 32768; i++) plainTable.push(0); targetModules.forEach(function (id) { plainTable[id] = 1; }); plainTable[120] = 1;
function decoratePlain(define) {
    return function (factory, id, dependencies) {
        if (plainTable[id] !== 1 || typeof factory !== "function")
            return arguments.length === 3 ? define.call(this, factory, id, dependencies) : define.apply(this, arguments);
        return define.call(this, factory, id, dependencies);
    };
}
var dDirect = decorateTableDirect(metroDefine), dPlain = decoratePlain(metroDefine);
bench("Uint8Array, if/else", function () { for (var i = 0; i < ids.length; i++) dDirect(factory, ids[i], null); });
bench("plain Array table", function () { for (var i = 0; i < ids.length; i++) dPlain(factory, ids[i], null); });
