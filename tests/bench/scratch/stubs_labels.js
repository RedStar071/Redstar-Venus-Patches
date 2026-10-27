// Stubs for gen_runtime_bench.cjs: 60 locked, redacted channels whose real names came from CONNECTION_OPEN;
// one render pass asks ChannelNameUtils.computeChannelName for each row (what the channel list does).
var VIEW = 1024, recs = [], table = {}, items = [];
for (var i = 0; i < 60; i++) { var c = {id: String(2000 + i), guild_id: "1", type: 0, name: "hidden", position: i, isObfuscated: function () { return true; }}; recs.push(c); table[c.id] = c; items.push({id: c.id, type: 0, name: "staff-" + i}); }
function makeDefs() { return {
  584: function (G, i, r, d, m, e) { e.default = {dispatch: function () {}}; },
  1085: function (G, i, r, d, m, e) { e.Permissions = {VIEW_CHANNEL: VIEW}; },
  1390: function (G, i, r, d, m, e) { e.default = {getCurrentUser: function () { return {id: "u"}; }}; },
  2065: function (G, i, r, d, m, e) { e.default = {getChannel: function (id) { return table[id]; }, getBasicChannel: function (id) { return table[id]; }, getMutableGuildChannelsForGuild: function () { return table; }, getGuildChannelsVersion: function () { return 1; }}; },
  4750: function (G, i, r, d, m, e) { e.default = {getChannelsVersion: function () { return 1; }, can: function () { return false; }, canBasicChannel: function () { return true; }}; },
  5421: function (G, i, r, d, m, e) { e.computeChannelName = function (ch) { return ch.isObfuscated() ? "OBF" : ch.name; }; e.default = e.computeChannelName; }
}; }
function scenario(req) {
  req(1085); req(1390); req(2065); req(4750);
  req(584).default.dispatch({type: "CONNECTION_OPEN", user: {id: "u"}, guilds: [{id: "1", channels: {op: "full_sync", items: items}}]});
  var N = req(5421);
  if (N.computeChannelName(recs[5]) !== "staff-5") throw Error("name not resolved: " + N.computeChannelName(recs[5]));
  return function () { var s = 0; for (var i = 0; i < recs.length; i++) s += N.computeChannelName(recs[i]).length; return s; };
}
