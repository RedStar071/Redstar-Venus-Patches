// Scratch: the remembered name follows new names, a language switch and a table change.
const boot = require('./harness.cjs');
let tables = 1; const rec = {id:'41', guild_id:'1', type:0, name:'hidden', isObfuscated(){return true;}};
const table = {'41':rec};
const req = boot({
  584: (G,i,r,d,m,e) => { e.default = {dispatch(){}}; },
  1085: (G,i,r,d,m,e) => { e.Permissions = {VIEW_CHANNEL:1024n}; },
  1390: (G,i,r,d,m,e) => { e.default = {getCurrentUser:()=>({id:'u'})}; },
  2065: (G,i,r,d,m,e) => { e.default = {getChannel:id=>table[id], getBasicChannel:id=>table[id], getMutableGuildChannelsForGuild:()=>table, getGuildChannelsVersion:()=>tables}; },
  4750: (G,i,r,d,m,e) => { e.default = {getChannelsVersion:()=>1, can:()=>false, canBasicChannel:()=>true}; },
  5421: (G,i,r,d,m,e) => { e.computeChannelName = c => c.isObfuscated() ? 'OBF' : c.name; },
});
globalThis.__venusPatches.setSetting('hiddenChannels', true);
req(1085); req(1390); req(2065); req(4750); const N = req(5421), D = req(584).default;
const out = {before: N.computeChannelName(rec)};
D.dispatch({type:'CHANNEL_UPDATE', channel:{id:'41', guild_id:'1', type:0, name:'mods'}});
out.afterNameEvent = N.computeChannelName(rec);
D.dispatch({type:'CHANNEL_UPDATE', channel:{id:'41', guild_id:'1', type:0, name:'mods-2'}});
out.afterRename = N.computeChannelName(rec);
console.log(JSON.stringify(out));
