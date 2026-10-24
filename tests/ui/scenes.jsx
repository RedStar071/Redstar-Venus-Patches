// Discord screens with what Venus adds to them, for ?scene= (see entry.jsx). Discord's own parts are stand-ins drawn from
// made-up data (a server called Game Night, three friends); Venus's parts are the real runtime, hooked into the stand-in
// modules exactly as it hooks Discord's. Sheets Venus opens (showActionSheet / showSimpleActionSheet) slide up over the
// screen the way Discord's do.
//   scene=serverMenu   the server list with Game Night held: Discord's hold menu plus Venus's Server info row
//   scene=serverInfo   the Server info sheet (Server info tapped in that menu)
//   scene=readAll      the server list with the Read all pill above the servers
//   scene=readAllHold  Read all held: the one-time choices sheet
// Edge cases: friends=0 (none of your friends are in Game Night), owner=me (you own it), desc=0 (no description).
import * as React from "react";
import * as RN from "react-native-web";
import * as D from "./discord.jsx";

const q = new URLSearchParams(location.search);
const DAY = 86400000, now = Date.now();
const GUILD = "1100000000000000001";
// Snowflakes that decode to real dates, so "Created" and "You joined" read like a real server.
const snowflake = ms => String((BigInt(ms - 1420070400000) << 22n) + 1n);
const allPeople = [
  { id: "1200000000000000001", username: "alex", globalName: "Alex", avatar: null, status: "online", nick: null },
  { id: "1200000000000000002", username: "sam_", globalName: "Sam", avatar: null, status: "idle", nick: "Sammy" },
  { id: "1200000000000000003", username: "jordan", globalName: "Jordan", avatar: null, status: "dnd", nick: null },
];
const people = q.get("friends") === "0" ? [] : allPeople;
const guild = { id: snowflake(now - 3.2 * 365 * DAY), name: "Game Night", icon: null, banner: null, splash: null,
  description: q.get("desc") === "0" ? "" : "Weekly game nights, clips and memes. Be nice.",
  memberCount: 1284, premiumSubscriberCount: 9, premiumTier: 2, ownerId: q.get("owner") === "me" ? "123456789012345678" : allPeople[0].id, vanityURLCode: "gamenight",
  verificationLevel: 2, preferredLocale: "en-US", features: new Set(["COMMUNITY"]) };
const guilds = [guild, { id: "1100000000000000002", name: "Art Room", icon: null }, { id: "1100000000000000003", name: "Work Devs", icon: null }];
const chan = n => Array.from({ length: n }, (_, i) => ({ channel: { id: String(i) } }));

// The stand-in modules: Discord's stores the sheet reads, its sheets, and the two guild-bar modules Venus hooks.
export const hooked = [1390, 5108, 16748, 16754];
let host = null; // the Scene, once drawn: shows and hides sheets
export function modules(store, me) {
  const user = id => id === me.id ? me : allPeople.find(p => p.id === id) || null;
  return {
    1390: { default: store({ getCurrentUser: () => me, getUser: user }) },
    4760: { default: store({ getFriendIDs: () => people.map(p => p.id), getRelationships: () => ({}) }) },
    5108: { default: store({ getStatus: id => (allPeople.find(p => p.id === id) || {}).status || "offline" }) },
    2087: { default: store({ getGuild: id => guilds.find(g => g.id === id) || null, getGuilds: () => Object.fromEntries(guilds.map(g => [g.id, g])) }) },
    5020: { default: store({ getMemberCount: () => 1284, getOnlineCount: () => 312 }) },
    2125: { default: store({ getMember: (g, id) => { const p = allPeople.find(x => x.id === id); return p && id !== allPeople[2].id ? { nick: p.nick } : null; },
      getSelfMemberJoinedAt: () => new Date(now - 400 * DAY) }) },
    2119: { default: store({ getNumRoles: () => 10 }) },
    4748: { default: store({ getChannels: () => ({ SELECTABLE: chan(12), VOCAL: chan(3) }) }) },
    6054: { default: store({ getGuildScheduledEventsForGuild: () => [{}] }) },
    5989: { default: store({ getGuildEmojis: () => new Array(24).fill({}) }) },
    6031: { default: store({ getStickersByGuildId: () => new Array(3).fill({}) }) },
    6098: { default: { requestMembersById() {} } },
    8301: { getUser: () => Promise.resolve() }, 8299: { default: o => console.log("TOAST open profile " + o.userId) },
    1415: { default: { getUserAvatarURL: () => null } },
    6899: { ActionSheet }, 6839: { BottomSheetTitleHeader: SheetHeader }, 6894: { ActionSheetCloseButton: SheetClose },
    5056: { default: { hideActionSheet: key => host && host.hide(key) }, showActionSheet: o => host && host.show(o.key, o.content) },
    6891: { showSimpleActionSheet: o => host && host.show(o.key, <SimpleSheet {...o} />) },
    6307: { BottomSheetScrollView: p => <RN.View>{p.children}</RN.View> },
    16744: { FastListRenderSections: SECTIONS },
    // getGuildsBarGuildMenuItems: Discord's own rows in the server icon's hold menu.
    16748: { default: () => [{ IconComponent: D.makeIcon("EnvelopeIcon"), label: "Invite", action() {} },
      { IconComponent: D.makeIcon("BellIcon"), label: "Mute Server", action() {} }, { IconComponent: D.makeIcon("SettingsIcon"), label: "Settings", action() {} }] },
    // useGuildsBarProps: the server list's sections (DMs, a separator, then servers), drawn one by one.
    16754: { default: () => ({ listDataProps: { itemSize: s => s === SECTIONS.SEPARATOR ? 12 : 56, renderItem: guildBarItem } }) },
  };
}
const SECTIONS = { MESSAGES: 0, SEPARATOR: 6, GUILD: 7 };

// Discord's sheet: a rounded card at the bottom with a grabber, an optional header, and its content.
function ActionSheet(props) {
  return <RN.View style={{ backgroundColor: D.tok("MOBILE_ACTIONSHEET_BACKGROUND"), borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, maxHeight: "100%" }}>
    <RN.View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: D.tok("BACKGROUND_MOD_STRONG"), marginBottom: 8 }} />
    {props.header || null}
    {props.children}
  </RN.View>;
}
function SheetHeader(props) {
  return <RN.View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, minHeight: 40 }}>
    <RN.View style={{ flex: 1 }}><D.Text variant="heading-lg/bold" color="text-strong">{props.title}</D.Text></RN.View>
    {props.trailing || null}
  </RN.View>;
}
const X = D.makeIcon("XSmallIcon");
function SheetClose(props) {
  return <RN.Pressable onPress={props.onPress} accessibilityLabel="Close" style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
    backgroundColor: D.tok("BACKGROUND_MOD_SUBTLE") }}><X size="sm" /></RN.Pressable>;
}
function SimpleSheet(props) {
  return <ActionSheet header={props.header ? <SheetHeader title={props.header.title} /> : null}>
    <RN.View style={{ paddingHorizontal: 12, paddingBottom: 24 }}><D.TableRowGroup>
      {props.options.map(o => <D.TableRow key={o.label} label={o.label} subLabel={o.subtitle} icon={o.icon ? <D.TableRowIcon IconComponent={o.icon} /> : null}
        onPress={() => { host && host.hide(props.key); o.onPress && o.onPress(); }} />)}
    </D.TableRowGroup></RN.View>
  </ActionSheet>;
}

// The server list, Discord's 72 dp column: a DM button, the separator (where Venus puts Read all), then server icons.
function guildBarItem(section, index) {
  if (section === SECTIONS.SEPARATOR) return <RN.View key="sep" style={{ alignSelf: "center", width: 32, height: 2, borderRadius: 1, marginVertical: 5, backgroundColor: D.tok("BACKGROUND_MOD_STRONG") }} />;
  if (section === SECTIONS.MESSAGES) return <RN.View key="dm" style={iconBox(D.tok("BACKGROUND_BRAND"), 16)}>{React.createElement(D.makeIcon("ChatIcon"), { size: "md", color: "#fff" })}</RN.View>;
  const g = guilds[index];
  return <RN.View key={g.id} style={[iconBox(D.tok("BACKGROUND_SURFACE_HIGH"), 16), { position: "relative" }]}>
    <D.Text variant="text-md/semibold" color="text-strong">{g.name.split(" ").map(w => w[0]).join("")}</D.Text>
    {index !== 1 ? <RN.View style={{ position: "absolute", left: -12, width: 4, height: 8, borderRadius: 2, backgroundColor: D.tok("TEXT_STRONG") }} /> : null}
  </RN.View>;
}
const iconBox = (bg, r) => ({ alignSelf: "center", width: 48, height: 48, borderRadius: r, backgroundColor: bg, alignItems: "center", justifyContent: "center", marginVertical: 4 });
function GuildBar({ defined }) {
  const props = defined[16754].exports.default(), data = props.listDataProps;
  const items = [[SECTIONS.MESSAGES, 0], [SECTIONS.SEPARATOR, 0], [SECTIONS.GUILD, 0], [SECTIONS.GUILD, 1], [SECTIONS.GUILD, 2]];
  return <RN.View style={{ width: 72, paddingTop: 8, backgroundColor: D.tok("BACKGROUND_BASE_LOWEST") }}>
    {items.map(([s, i], n) => <RN.View key={n} style={{ height: data.itemSize(s), justifyContent: "center" }}>{data.renderItem(s, i)}</RN.View>)}
  </RN.View>;
}
// The channel list next to it, so the bar sits in context.
function Channels() {
  return <RN.View style={{ flex: 1, backgroundColor: D.tok("BACKGROUND_BASE_LOWER"), borderTopLeftRadius: 16, padding: 16, gap: 10 }}>
    <D.Text variant="heading-md/bold" color="text-strong">Game Night</D.Text>
    {["general", "clips", "memes", "lfg"].map(c => <RN.View key={c} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
      {React.createElement(D.makeIcon("HashmarkIcon"), { size: "sm", color: D.tok("CHANNEL_ICON") })}<D.Text variant="text-md/medium" color="text-muted">{c}</D.Text></RN.View>)}
  </RN.View>;
}
// Discord's hold menu for a server: a floating card of rows next to the icon.
function GuildMenu({ defined }) {
  const items = defined[16748].exports.default(GUILD === guild.id ? GUILD : guild.id);
  return <RN.View style={{ position: "absolute", left: 76, top: 120, width: 240, borderRadius: 16, overflow: "hidden", backgroundColor: D.tok("BACKGROUND_SURFACE_HIGHEST"),
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 16 }}>
    {items.map((it, i) => <RN.Pressable key={i} onPress={it.action} accessibilityLabel={it.label}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: D.tok("BORDER_SUBTLE") }}>
      {React.createElement(it.IconComponent, { size: "sm", color: D.tok("INTERACTIVE_ICON_DEFAULT") })}
      <D.Text variant="text-md/semibold" color="text-strong">{it.label}</D.Text></RN.Pressable>)}
  </RN.View>;
}

export function Scene({ name, defined }) {
  const [sheets, setSheets] = React.useState([]);
  host = { show: (key, content) => setSheets(list => list.filter(s => s.key !== key).concat([{ key, content }])), hide: key => setSheets(list => list.filter(s => s.key !== key)) };
  React.useEffect(() => {
    if (name === "serverInfo") { const row = defined[16748].exports.default(guild.id).find(it => it.label === "Server info"); if (row) row.action(); else console.warn("No Server info row"); }
    // A hold: the pill's own onLongPress, found through React's props on the element (a browser has no long press).
    if (name === "readAllHold") setTimeout(() => {
      const pill = document.querySelector('[aria-label="Read all"]'), key = pill && Object.keys(pill).find(k => k.startsWith("__reactFiber"));
      let fiber = key && pill[key];
      while (fiber && !(fiber.memoizedProps && fiber.memoizedProps.onLongPress)) fiber = fiber.return;
      if (fiber) fiber.memoizedProps.onLongPress({}); else console.warn("No Read all hold");
    }, 50);
  }, []);
  const top = sheets[sheets.length - 1];
  // With a sheet open, the screen behind is dimmed and the sheet is laid out in full below a strip of it, so the
  // screenshot shows the whole sheet the way you'd scroll through it.
  if (top) return <RN.View style={{ width: 412, minHeight: "100vh", backgroundColor: D.tok("BACKGROUND_SCRIM") }}>
    <RN.View style={{ height: 72 }} />
    {top.content}
  </RN.View>;
  return <RN.View style={{ width: 412, minHeight: "100vh", backgroundColor: D.tok("BACKGROUND_BASE_LOWEST") }}>
    <RN.View style={{ flexDirection: "row", height: 520 }}>
      <GuildBar defined={defined} />
      <Channels />
      {name === "serverMenu" ? <GuildMenu defined={defined} /> : null}
    </RN.View>
  </RN.View>;
}
