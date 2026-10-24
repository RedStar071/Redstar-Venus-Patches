// Boots the real Venus runtime (patches/src/main/resources/venus/bootstrap.js, every feature patched in) on a tiny
// stand-in for Metro, then draws one Venus settings page in a 412 dp wide phone frame. Driven by the URL:
//   page=VENUS_PLUGINS        the route to draw (VENUS_PLUGINS, VENUS_GENERAL, VENUS_BACKUP, VENUS_LANGUAGE, VENUS_<FEATURE>)
//   on=noDelete,quests        features (or any boolean settings) turned on
//   set={"readAllMode":"dms"} any other saved settings, as JSON
//   fresh=1                   a fresh install: nothing saved yet (shows Start with the essentials)
//   theme=dark|light|midnight|darker   lang=de   search=pin   (search: typed into the Features search bar)
//   tap=Custom                 taps the element with that accessibility label or text once the page is drawn
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import * as RNW from "react-native-web";
import * as D from "./discord.jsx";

const q = new URLSearchParams(location.search);
// Every feature patched in, like selecting every patch in Morphe.
window.__FEATURES = new Proxy({}, { get: (_, k) => typeof k === "string" && k !== "then" });

// Screenshots show the finished state: animations jump to where they end (Venus never depends on them finishing).
const jump = (value, cfg) => ({ start(cb) { try { value.setValue(cfg.toValue); } catch (_) {} if (cb) cb({ finished: true }); }, stop() {} });
const Animated = Object.assign({}, RNW.Animated, { timing: jump, spring: jump,
  sequence: list => ({ start(cb) { list.forEach(a => a.start()); if (cb) cb({ finished: true }); }, stop() {} }) });
const RN = Object.assign({}, RNW, { Animated, Modal: RNW.Modal || (() => null),
  Alert: { alert: (title, body) => console.log("ALERT " + title + " | " + body) },
  LayoutAnimation: { configureNext() {}, create() {}, Presets: {} },
  AccessibilityInfo: { isReduceMotionEnabled: () => ({ then: f => { f(false); return { then() {}, catch() {} }; } }), addEventListener() {} } });

// Discord's file module: the saved settings file comes from the URL, language packs from the repo.
const on = (q.get("on") || "").split(",").filter(Boolean);
const saved = Object.assign({ language: q.get("lang") || "en", setupDone: true }, Object.fromEntries(on.map(k => [k, true])), JSON.parse(q.get("set") || "{}"));
const settingsText = q.get("fresh") === "1" ? null : JSON.stringify(saved);
const files = { getConstants: () => ({ DocumentsDirPath: "/docs", CacheDirPath: "/cache" }), getSize() {},
  fileExists: path => Promise.resolve(/venus-patches\.json$/.test(path) && !!settingsText),
  readFile: path => /venus-patches\.json$/.test(path) ? Promise.resolve(settingsText) : Promise.reject(new Error("none")),
  writeFile: () => Promise.resolve(), getVideoDimensions: () => Promise.resolve(),
  readAsset: name => fetch("i18n/" + name.split(":").pop() + ".json").then(r => r.text()) };

const me = { id: "123456789012345678", username: "venus", globalName: "Venus", avatar: null };
const store = extra => Object.assign({ addChangeListener() {}, removeChangeListener() {} }, extra);
const go = route => { const next = new URLSearchParams(location.search); next.set("page", route); location.search = next.toString(); };
const modules = {
  17: React, 19: RN, 1162: { default: files },
  5088: { Text: D.Text }, 5379: { Button: D.Button }, 6897: { FormSwitch: D.FormSwitch }, 6188: { TableRowIcon: D.TableRowIcon },
  6180: { TableRow: D.TableRow }, 6265: { TableRowGroup: D.TableRowGroup, TableRowGroupTitle: D.TableRowGroupTitle }, 6896: { TableSwitchRow: D.TableSwitchRow },
  6263: { TableRadioGroup: D.TableRadioGroup }, 6262: { TableRadioRow: D.TableRadioRow }, 6177: { TableCheckboxRow: D.TableCheckboxRow },
  6739: { SearchField: D.SearchField }, 6286: { TextInput: D.TextInput }, 5377: { Stack: D.Stack }, 5092: { createStyles: D.createStyles },
  587: { default: { colors: D.colors } }, 4831: { useThemeContext: () => ({ theme: D.themeName }) },
  1390: { default: store({ getCurrentUser: () => me, getUser: id => id === me.id ? me : null }) },
  4760: { default: store({ getFriendIDs: () => [], getRelationships: () => ({}) }) },
  1503: { useStackNavigation: () => ({ navigate: go }) }, 14974: { onRouteSettingOnPress: ({ screen }) => go(screen.route) },
  5300: { default: { show: o => console.log("DIALOG " + o.title + " | " + o.body) } },
  4809: { default: { open: (key, o) => console.log("TOAST " + (o && o.text)) } },
  6889: { Clipboard: { setString() {}, getString: () => Promise.resolve("") } },
};
const icons = {};
const fallback = new Proxy({}, { get: (_, k) => typeof k === "string" && /Icon$/.test(k) ? icons[k] || (icons[k] = D.makeIcon(k)) : undefined });

// Metro, minimally: __d runs a factory once and keeps its module; __r reads what Venus left in module.exports.
const defined = {};
global.__r = id => defined[id] ? defined[id].exports : id in modules ? modules[id] : fallback;
global.__d = (factory, id) => { const module = { exports: {} }; defined[id] = module; factory(global, global.__r, null, null, module); };

let registry = null;
function boot() {
  modules[14839] = { SETTING_RENDERER_CONFIG: { ACCOUNT: { type: "route", IconComponent: D.makeIcon("UserCircleIcon") } } };
  modules[14971] = { SettingsList: D.makeSettingsList(() => registry) };
  modules[10664] = { createList: x => x };
  const define = (id, exports) => global.__d((g, r, i, a, module) => { module.exports = exports; }, id, []);
  define(120, { default: () => {} });
  [17, 19, 1162, 6265, 6896, 14971, 10664, 14839].forEach(id => define(id, modules[id]));
  defined[120].exports.default();
  registry = defined[14839].exports.SETTING_RENDERER_CONFIG;
}

window.__venusStart = function () {
  boot();
  const page = q.get("page") || "VENUS_PLUGINS", node = registry[page];
  const Page = node && node.screen && node.screen.getComponent();
  if (q.get("search")) setTimeout(() => { const input = document.querySelector("input"); if (input) { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(input, q.get("search")); input.dispatchEvent(new Event("input", { bubbles: true })); } }, 300);
  function Frame() {
    const title = node && node.useTitle ? node.useTitle() : page;
    return <RNW.View style={{ width: 412, minHeight: "100vh", backgroundColor: D.tok("BACKGROUND_BASE_LOW") }}>
      <RNW.View style={{ height: 56, flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16 }}>
        {React.createElement(D.makeIcon("ArrowLargeLeftIcon"), { size: "md", color: D.tok("INTERACTIVE_ICON_DEFAULT") })}
        <D.Text variant="heading-lg/bold" color="text-strong">{title}</D.Text>
      </RNW.View>
      {Page ? <Page /> : <D.Text color="text-feedback-critical">No page called {page}</D.Text>}
    </RNW.View>;
  }
  ReactDOM.createRoot(document.getElementById("root")).render(<Frame />);
  window.__venus = global.__venusPatches;
};

// tap=<text>: taps the first element whose accessibility label or text is exactly that, after the page draws.
if (q.get("tap")) setTimeout(() => {
  const want = q.get("tap"), all = Array.from(document.querySelectorAll("#root [aria-label], #root div[tabindex], #root [role]"));
  const hit = all.find(e => e.getAttribute("aria-label") === want) || all.find(e => (e.innerText || "").trim() === want);
  if (hit) hit.click(); else console.warn("tap: nothing labelled " + want);
}, 400);
