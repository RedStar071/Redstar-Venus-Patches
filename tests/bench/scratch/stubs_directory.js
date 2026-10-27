// Stubs for gen_runtime_bench.cjs: a 300-channel server (every 7th locked, every 10th a category), repeated
// GuildChannelStore.getChannels with nothing changed in between (what each channel-list render does).
var VIEW = 1024;
var table = {}, list = [];
for (var i = 0; i < 300; i++) { var c = {id: String(1000 + i), guild_id: "1", type: i % 10 === 0 ? 4 : 0, name: i % 7 === 0 ? "hidden" : "ch" + i, position: i, parent_id: i % 10 === 0 ? null : String(1000 + i - i % 10)}; table[c.id] = c; list.push(c); }
function locked(id) { return Number(id) % 7 === 0; }
var result = {SELECTABLE: [], VOCAL: [], 4: [], 0: [], count: 300};
for (var j = 0; j < list.length; j++) { var ch = list[j]; if (locked(ch.id)) continue; var e = {channel: ch, comparator: ch.position}; if (ch.type === 4) result[4].push(e); else { result.SELECTABLE.push(e); result[0].push(e); } }
function makeDefs() { return {
  1085: function (G, i, r, d, m, e) { e.Permissions = {VIEW_CHANNEL: VIEW}; },
  1390: function (G, i, r, d, m, e) { e.default = {getCurrentUser: function () { return {id: "u"}; }}; },
  2065: function (G, i, r, d, m, e) { e.default = {getChannel: function (id) { return table[id]; }, getBasicChannel: function (id) { return table[id]; }, getMutableGuildChannelsForGuild: function () { return table; }, getMutableBasicGuildChannelsForGuild: function () { return table; }, getGuildChannelsVersion: function () { return 1; }}; },
  4750: function (G, i, r, d, m, e) { e.default = {getChannelsVersion: function () { return 1; }, can: function (b, c) { return !locked(c.id); }, canBasicChannel: function () { return true; }}; },
  4748: function (G, i, r, d, m, e) { e.default = {getChannels: function () { return result; }, getFirstChannel: function () {}, getDefaultChannel: function () {}}; }
}; }
function scenario(req) {
  req(1085); req(1390); req(2065); req(4750);
  var S = req(4748).default;
  var first = S.getChannels("1");
  if (first.SELECTABLE.length !== 270) throw Error("unexpected selectable " + first.SELECTABLE.length);
  return function () { if (S.getChannels("1") !== first) throw Error("lost identity"); };
}
