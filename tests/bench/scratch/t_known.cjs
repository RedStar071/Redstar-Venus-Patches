// Scratch: hiddenMetadata answers follow PermissionStore.getChannelsVersion; threads always ask.
const boot = require('./harness.cjs');
let version = 1, calls = 0; const lockedIds = new Set(['11', '21']);
const ch = {id:'11', guild_id:'1', type:0, name:'staff', position:0}, th = {id:'21', guild_id:'1', type:11, name:'t'};
const table = {'11':ch, '21':th};
const req = boot({
  1085: (G,i,r,d,m,e) => { e.Permissions = {VIEW_CHANNEL:1024n}; },
  1390: (G,i,r,d,m,e) => { e.default = {getCurrentUser:()=>({id:'u'})}; },
  2065: (G,i,r,d,m,e) => { e.default = {getChannel:id=>table[id], getBasicChannel:id=>table[id], getMutableGuildChannelsForGuild:()=>table, getGuildChannelsVersion:()=>1}; },
  4750: (G,i,r,d,m,e) => { e.default = {getChannelsVersion:()=>version, can:(b,c)=>{calls++; return !lockedIds.has(c.id);}, canBasicChannel:()=>true}; },
  5421: (G,i,r,d,m,e) => { e.computeChannelName = c => c.name; },
});
globalThis.__venusPatches.setSetting('hiddenChannels', true);
req(1085); req(1390); req(2065); const P = req(4750).default; const N = req(5421);
const look = () => { calls = 0; N.computeChannelName(ch); N.computeChannelName(ch); N.computeChannelName(th); N.computeChannelName(th); return calls; };
const out = {first:look(), again:look()};
lockedIds.delete('11'); out.staleUntilBump = P.can(1024n, ch); version++; out.afterBump = look();
console.log(JSON.stringify(out));
