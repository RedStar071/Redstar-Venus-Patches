// Scratch: how many real permission checks one hiddenDirectory lookup costs on a 300-channel server.
const boot = require('./harness.cjs');
const VIEW = 1024n; let calls = 0;
const table = {}, list = [];
for (let i = 0; i < 300; i++) { const c = {id:String(1000+i), guild_id:'1', type:i%10===0?4:0, name:'ch'+i, position:i, parent_id:null}; table[c.id]=c; list.push(c); }
const locked = id => Number(id) % 7 === 0;
const result = {SELECTABLE:list.filter(c=>c.type!==4&&!locked(c.id)).map(c=>({channel:c,comparator:c.position})), VOCAL:[], 4:list.filter(c=>c.type===4&&!locked(c.id)).map(c=>({channel:c,comparator:c.position})), 0:[], count:300};
const req = boot({
  1085: (G,i,r,d,m,e) => { e.Permissions = {VIEW_CHANNEL:VIEW}; },
  1390: (G,i,r,d,m,e) => { e.default = {getCurrentUser:()=>({id:'u'})}; },
  2065: (G,i,r,d,m,e) => { e.default = {getChannel:id=>table[id], getBasicChannel:id=>table[id], getMutableGuildChannelsForGuild:g=>table, getMutableBasicGuildChannelsForGuild:g=>table, getGuildChannelsVersion:()=>1}; },
  4750: (G,i,r,d,m,e) => { e.default = {getChannelsVersion:()=>1, can:(bit,ch)=>{calls++; return !locked(ch.id);}, canBasicChannel:()=>true}; },
  4748: (G,i,r,d,m,e) => { e.default = {getChannels:()=>result, getFirstChannel(){}, getDefaultChannel(){}}; },
});
globalThis.__venusPatches.setSetting('hiddenChannels', true);
req(1085); req(1390); req(2065); req(4750);
const S = req(4748).default;
calls = 0; const a = S.getChannels('1'); const first = calls;
calls = 0; const b = S.getChannels('1'); const second = calls;
console.log(JSON.stringify({firstLookup:first, cachedLookup:second, same:a===b, selectable:a.SELECTABLE.length}));
