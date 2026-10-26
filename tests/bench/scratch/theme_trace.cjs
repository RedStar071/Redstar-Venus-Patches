// Prints which raw color (and hex) each semantic token resolves to once a published theme is installed in the UI preview.
//   node tests/bench/scratch/theme_trace.cjs <file in work/themes> [dark|light|darker|midnight] TOKEN...
// Needs a built preview (node tests/ui/shot.cjs x scene=settings). RAW=<regex> also prints matching raw colors.
const { chromium } = require("../../../work/ui/node_modules/playwright-core");
const http = require("http"), fs = require("fs"), path = require("path");
const UI = path.resolve(__dirname, "../../../work/ui");
const [file, ...rest] = process.argv.slice(2);
const slot = ["dark", "light", "midnight", "darker"].includes(rest[0]) ? rest.shift() : "dark";
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]), f = path.join(UI, url === "/" ? "index.html" : url);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.end(d); });
}).listen(0);
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] }), p = await b.newPage();
  await p.goto(`http://127.0.0.1:${server.address().port}/?scene=settings&on=customThemes&theme=${slot}&installed=${file}`);
  await p.waitForTimeout(1500);
  if (process.env.RAW) console.log(await p.evaluate(re => Object.entries(window.__tables.raw).filter(([k]) => new RegExp(re).test(k))
    .map(([k, v]) => k + "=" + v).join(" "), process.env.RAW));
  console.log((await p.evaluate(([names, slot]) => names.map(n => { const e = window.__tables.sem[n] && window.__tables.sem[n][slot];
    return n.padEnd(40) + (e ? e.raw + " " + window.__tables.raw[e.raw] + " @" + (+e.opacity).toFixed(2) : "-"); }), [rest, slot])).join("\n"));
  await b.close(); server.close();
})();
