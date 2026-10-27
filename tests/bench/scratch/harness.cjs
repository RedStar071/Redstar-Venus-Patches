// Scratch (PR-only): boots the compacted runtime against stub Metro modules in Node, for behaviour checks.
const fs = require('fs');
module.exports = function boot(defs, features) {
  const g = globalThis;
  delete g.__venusPatches;
  const src = fs.readFileSync('patches/build/bootstrap.js', 'utf8').replace('/*__FEATURES__*/', features || '{hiddenChannels:true}');
  const reg = {};
  const metroDefine = (factory, id, deps) => { reg[id] = {factory, deps, module:null}; };
  const req = id => {
    const m = reg[id]; if (!m) throw Error('no module ' + id);
    if (m.module) return m.module.exports;
    m.module = {exports:{}};
    const imp = d => req(d);
    m.factory(g, imp, imp, imp, m.module, m.module.exports, m.deps);
    return m.module.exports;
  };
  Object.defineProperty(g, '__d', {configurable:true, writable:true, value:metroDefine});
  g.__r = req;
  (0, eval)(src);
  g.__d(function(G, i, r, d, module, exports){ exports.default = function(){}; }, 120, []);
  for (const [id, f] of Object.entries(defs)) g.__d(f, Number(id), []);
  req(120).default();
  return req;
};
