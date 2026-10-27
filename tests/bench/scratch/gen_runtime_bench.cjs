// Scratch (PR-only): build a Hermes bench that boots two compacted runtimes (old, new) against stub Metro modules
// and times one scenario on each.  node tests/bench/scratch/gen_runtime_bench.cjs old.js new.js stubs.js out.js
// stubs.js defines makeDefs() -> {id: factory} and scenario(req) -> function to bench.
const fs = require('fs');
const [oldRt, newRt, stubs, out] = process.argv.slice(2);
const FEATURES = process.env.FEATURES || '{hiddenChannels:true}';
const rt = f => JSON.stringify(fs.readFileSync(f, 'utf8').replace('/*__FEATURES__*/', FEATURES));
fs.writeFileSync(out, `
var G_ = (typeof globalThis !== "undefined") ? globalThis : this;
${fs.readFileSync(stubs, 'utf8')}
function boot(source) {
  delete G_.__venusPatches;
  var reg = {};
  var metroDefine = function (factory, id, deps) { reg[id] = {factory: factory, deps: deps, module: null}; };
  var req = function (id) {
    var m = reg[id]; if (!m) throw Error("no module " + id);
    if (m.module) return m.module.exports;
    m.module = {exports: {}};
    m.factory(G_, req, req, req, m.module, m.module.exports, m.deps);
    return m.module.exports;
  };
  Object.defineProperty(G_, "__d", {configurable: true, writable: true, value: metroDefine});
  G_.__r = req;
  (0, eval)(source);
  G_.__d(function (G, i, r, d, module, exports) { exports.default = function () {}; }, 120, []);
  var defs = makeDefs();
  for (var k in defs) G_.__d(defs[k], Number(k), []);
  req(120).default();
  G_.__venusPatches.setSetting("hiddenChannels", true);
  return req;
}
var oldFn = scenario(boot(${rt(oldRt)}));
var newFn = scenario(boot(${rt(newRt)}));
bench("old", oldFn);
bench("new", newFn);
`);
