// Benchmark Metro module definition interception on Hermes HBC98 (17.7k-module define storm):
// 1. Pre-1.16 Set-based __d wrapper
// 2. Current Uint8Array __d wrapper (with arguments.length + define.call)
// 3. Uint8Array __d wrapper with direct define(factory, id, dependencies) call
// 4. Stock Discord __d (with Map.prototype.set wrapped once — zero __d wrapper!)

var targetModules = new Set([17, 19, 1162, 11129, 14409, 14500, 414, 1282, 7268, 7243, 584, 5110, 5112, 1377, 2051, 6965, 7591,
    1085, 1096, 1112, 2103, 4507, 7039, 4509, 5043, 16157, 5879, 4930, 4908, 10843, 10602, 13107, 15962, 9334, 13920, 12849,
    7187, 7252, 13439, 13477, 5638, 5687, 4528, 13797, 6840, 589, 590, 591, 1193, 4593, 9758, 9769, 11281, 2116]);
var targetTable = new Uint8Array(32768);
targetModules.forEach(function (id) { targetTable[id] = 1; }); targetTable[120] = 1;

var ids = []; for (var i = 0; i < 17700; i++) ids.push(i * 7 % 18000);
var sink = 0;
function metroDefine(factory, id, deps) { sink += id; }
function factory() {}

// 1. Pre-1.16 Set lookup + arguments.length + define.call
function decorateSet(define) {
    return function (factory, id, dependencies) {
        if ((id !== 120 && !targetModules.has(id)) || typeof factory !== "function")
            return arguments.length === 3 ? define.call(this, factory, id, dependencies) : define.apply(this, arguments);
        return define.call(this, factory, id, dependencies);
    };
}

// 2. Current Uint8Array + arguments.length + define.call
function decorateTable(define) {
    return function (factory, id, dependencies) {
        if (targetTable[id] !== 1 || typeof factory !== "function")
            return arguments.length === 3 ? define.call(this, factory, id, dependencies) : define.apply(this, arguments);
        return define.call(this, factory, id, dependencies);
    };
}

// 3. Direct define(factory, id, dependencies)
function decorateDirect(define) {
    return function (factory, id, dependencies) {
        if (targetTable[id] !== 1 || typeof factory !== "function")
            return define(factory, id, dependencies);
        return define(factory, id, dependencies);
    };
}

var dSet = decorateSet(metroDefine), dTable = decorateTable(metroDefine), dDirect = decorateDirect(metroDefine);
bench("1. Set lookup + arguments.length + define.call (old Venus)", function () { for (var i = 0; i < ids.length; i++) dSet(factory, ids[i], null); });
bench("2. Uint8Array + arguments.length + define.call (current)", function () { for (var i = 0; i < ids.length; i++) dTable(factory, ids[i], null); });
bench("3. Uint8Array + direct define(factory, id, deps)", function () { for (var i = 0; i < ids.length; i++) dDirect(factory, ids[i], null); });
bench("4. Stock Discord __d (no JS __d wrapper)", function () { for (var i = 0; i < ids.length; i++) metroDefine(factory, ids[i], null); });
