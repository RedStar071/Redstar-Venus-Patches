// Scratch: a locked voice channel's panel asks first (or does nothing with the menu off); open ones pass through.
const boot = require('./harness.cjs');
const locked = {id:'31', guild_id:'1', type:2, name:'vc-staff'}, open = {id:'32', guild_id:'1', type:2, name:'vc'};
const table = {'31':locked, '32':open}; const opened = []; const alerts = [];
const req = boot({
  1085: (G,i,r,d,m,e) => { e.Permissions = {VIEW_CHANNEL:1024n}; },
  1390: (G,i,r,d,m,e) => { e.default = {getCurrentUser:()=>({id:'u'})}; },
  2065: (G,i,r,d,m,e) => { e.default = {getChannel:id=>table[id], getBasicChannel:id=>table[id], getMutableGuildChannelsForGuild:()=>table, getGuildChannelsVersion:()=>1}; },
  4750: (G,i,r,d,m,e) => { e.default = {getChannelsVersion:()=>1, can:(b,c)=>c.id!=='31', canBasicChannel:()=>true}; },
  7477: (G,i,r,d,m,e) => { const f = (ch) => opened.push(ch.id); e.openGuildVoiceModal = f; e.navigateToVoiceChannel = f; },
});
globalThis.__venusPatches.setSetting('hiddenChannels', true);
req(1085); req(1390); req(2065); req(4750);
const U = req(7477);
U.openGuildVoiceModal(open, undefined, 'Channel List');
U.openGuildVoiceModal(locked, undefined, 'Channel List');
console.log(JSON.stringify({openedBeforeChoice: opened}));
globalThis.__venusPatches.setSetting('hiddenChannelsMenu', false);
U.navigateToVoiceChannel(locked);
console.log(JSON.stringify({menuOff: opened}));
