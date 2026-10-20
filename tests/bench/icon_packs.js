// Icon pack lookup benchmark (see iconPacks in bootstrap.js).
// Compares stock Themes+ per-render path building + tree.includes() against Venus's O(1) precompiled asset-ID table.
var assets = [];
var treeArr = [];
var RED = "design/components/Icon/native/redesign/generated/images";
for (var id = 1; id <= 3280; id++) {
    var isIcon = id >= 1400 && id <= 1800;
    var name = "IconAsset_" + id;
    var loc = isIcon ? "/assets/" + RED : "/assets/.cache/intl/aW50bA==";
    var type = isIcon ? "png" : "jsona";
    assets[id] = {httpServerLocation: loc, name: name, type: type, width: 24, height: 24};
    if (isIcon && id % 2 === 0) treeArr.push(RED + "/" + name + ".png");
}
function getAssetByID(id) { return assets[id]; }
var packLoad = "https://raw.githubusercontent.com/Rairof/discord-iconpacks/main/Packs/Plumpy/";

// 1. Stock Themes+ per-render resolution: getAssetByID + string split/slice/join/replace + Array.prototype.includes.
function stockResolve(sourceId) {
    var asset = getAssetByID(sourceId);
    if (!asset || asset.type !== "png") return sourceId;
    var loc = asset.httpServerLocation.split("/").slice(2).join("/").replace(/^\.\.\//, "_/") + "/" + asset.name + "." + asset.type;
    if (treeArr.indexOf(loc) !== -1) {
        return {uri: packLoad + loc, width: asset.width, height: asset.height};
    }
    return sourceId;
}

// 2. Precompiled Map(assetId -> entry).
var mapTable = new Map();
var treeSet = new Set(treeArr);
for (var j = 1400; j <= 1800; j++) {
    var a = assets[j];
    var rel = a.httpServerLocation.split("/").slice(2).join("/") + "/" + a.name + "." + a.type;
    if (treeSet.has(rel)) {
        mapTable.set(j, Object.freeze({source: Object.freeze({uri: packLoad + rel, width: a.width, height: a.height}), tint: "", noTint: false}));
    }
}
function mapResolve(sourceId) {
    var entry = mapTable.get(sourceId);
    return entry && entry.source ? entry.source : sourceId;
}

// 3. Venus precompiled dense Array table indexed by numeric assetId (iconPacks.table[srcId]).
var denseTable = [];
for (var k = 1400; k <= 1800; k++) {
    var ak = assets[k];
    var relk = ak.httpServerLocation.split("/").slice(2).join("/") + "/" + ak.name + "." + ak.type;
    if (treeSet.has(relk)) {
        denseTable[k] = Object.freeze({source: Object.freeze({uri: packLoad + relk, width: ak.width, height: ak.height}), tint: "", noTint: false});
    }
}
var hasActive = true;
function venusResolve(sourceId) {
    if (!hasActive || typeof sourceId !== "number") return sourceId;
    var entry = denseTable[sourceId];
    return entry && entry.source ? entry.source : sourceId;
}

var sampleIds = [];
for (var s = 0; s < 256; s++) sampleIds.push(1400 + (s * 7) % 400);
var sink = null;

bench("Themes+ per-render path + tree.includes (baseline)", function () {
    for (var i = 0; i < sampleIds.length; i++) sink = stockResolve(sampleIds[i]);
});
bench("Precompiled Map.get(assetId)", function () {
    for (var i = 0; i < sampleIds.length; i++) sink = mapResolve(sampleIds[i]);
});
bench("Venus precompiled dense Array table[assetId] (ships)", function () {
    for (var i = 0; i < sampleIds.length; i++) sink = venusResolve(sampleIds[i]);
});
