// Runs the real Complete badges automatically engine from bootstrap.js against a fake Discord with a fake clock:
// games at once, switching, heartbeats, stopping, the top tier, and every limit of Add hours now.
//   node tests/badge_engine.cjs
const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '../patches/src/main/resources/venus/bootstrap.js'), 'utf8');
const cut = (from, to) => {
    const a = src.indexOf(from), b = src.indexOf(to, a);
    if (a < 0 || b < 0) throw new Error('bootstrap.js moved: ' + from);
    return src.slice(a, b);
};
const engine = cut('    // Badge Completer (#81): Game Time', "    // A badge's progress from Discord's Badge Directory");
const limits = cut('    const BADGE_CYCLE_MIN', '    function badgeCycleMinutes') +
    src.slice(src.indexOf('    function badgeCycleMinutes'), src.indexOf('\n', src.indexOf('    function badgeCycleMinutes')) + 1);

let failures = 0, checks = 0;
function ok(cond, name) { checks++; if (!cond) failures++; console.log(cond ? 'ok  ' : 'FAIL', name); }

function world(opts = {}) {
    let now = Date.UTC(2026, 9, 23, 12);
    const timers = [], sent = [], activities = [], dispatched = [];
    const env = {
        settings: Object.assign({badges: true, badgesGameTime: true, badgesUniqueGames: true, badgesCycleMinutes: 15, badgesGamesAtOnce: 2}, opts.settings),
        progress: Object.assign({GAME_TIME: 0, GAME_VARIETY: 0}, opts.progress),
        failScience: false,
    };
    const later = (fn, ms) => { const t = {at: now + ms, fn, id: timers.length + 1}; timers.push(t); return t.id; };
    const clearTimeout = id => { const t = timers.find(x => x.id === id); if (t) t.dead = true; };
    const http = {
        post: async req => {
            if (req.url === '/science') {
                if (env.failScience) { const e = new Error('HTTP 500'); e.status = 500; throw e; }
                sent.push({at: now, events: req.body.events}); return {body: null};
            }
            // Discord answers 404 here for many games; the engine must carry on.
            if (req.url === '/activities') { activities.push(req.body); const e = new Error('HTTP 404'); e.status = 404; throw e; }
            throw new Error('unexpected POST ' + req.url);
        },
        get: async req => {
            if (req.url === '/games/detectable') return {body: []};
            if (req.url.startsWith('/users/@me')) return {body: {analytics_token: 'AT'}};
            throw new Error('unexpected GET ' + req.url);
        },
    };
    const factory = new Function('env', 'later', 'clearTimeout', 'http', 'nowFn', 'dispatched', `
        const Date = (() => { const R = globalThis.Date; function D(...a) { return a.length ? new R(...a) : new R(nowFn()); } D.now = nowFn; D.UTC = R.UTC; return D; })();
        const settings = env.settings, global = {clearTimeout}, features = {badges:true};
        function enabled(k) { return !!settings[k]; }
        function notify() {} function save() {} function backgroundSync() {}
        function currentId() { return "111111111111111111"; }
        function inspectedExport(id) { return id === 502 ? {getAnalyticsToken: () => "AT", getSessionId: () => "S"} : null; }
        function questDesktopProperties() {} const quest = {desktop:{session:"hs", signature:"ls"}};
        function questRequest(url, body, desktop, method, active) {
            const request = {url}; if (body !== undefined) request.body = body;
            return Promise.resolve().then(() => active && !active() ? null : http[method || "post"](request));
        }
        function questHex(n) { let h = ""; for (let i = 0; i < n; i++) h += Math.floor(Math.random() * 16).toString(16); return h; }
        function questUuidText(hex) { return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20, 32); }
        function questUuid() { return questHex(32); }
        function questDispatch(a) { dispatched.push(a); }
        function questSleep(ms) { return new Promise(r => later(r, ms)); }
        function hookExport() {} function replaceValue() {}
        function badgeInfo(key) { const v = env.progress[key]; return v == null ? null : {current:v, goal:100}; }
        ${limits}
        ${engine}
        return {badges, badgeStartGame, badgesStop, badgesSettingChanged, badgeGrantHours, badgeGrantLimit, badgeGrantWait,
            badgeGrantRecord, badgeGrantsLoad, badgeGrantPlan, badgeEntries, BADGE_FALLBACK_GAMES, BADGE_GAME_TIME_START};
    `);
    const api = factory(env, later, clearTimeout, http, () => now, dispatched);
    api.badges.user = '111111111111111111';
    const flush = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
    const advance = async ms => {
        const end = now + ms;
        for (;;) {
            await flush();
            const next = timers.filter(t => !t.dead && t.at <= end).sort((x, y) => x.at - y.at)[0];
            if (!next) break;
            next.dead = true; now = next.at; next.fn(); await flush();
        }
        now = end; await flush();
    };
    return {api, env, sent, activities, dispatched, advance, flush, now: () => now, setNow: t => { now = t; }};
}
const events = (w, type) => w.sent.flatMap(s => s.events).filter(e => e.type === type);
const heartbeats = w => events(w, 'running_game_heartbeat');

(async () => {
    {
        const w = world();
        await w.api.badgeStartGame(null); await w.flush();
        ok(w.api.badges.current && w.api.badges.extra.length === 1, 'plays 2 games at once by default');
        const ids = w.api.badgeEntries().map(e => e.game.id);
        ok(new Set(ids).size === ids.length, 'the games playing at once are all different');
        ok(events(w, 'launch_game').length === 2 && heartbeats(w).filter(e => e.properties.initial_heartbeat).length === 2, 'each game sends launch_game and an initial heartbeat');
        ok(w.api.badges.played.size === 2, 'both games count as played as soon as they start');
        const sockets = w.dispatched.filter(d => d.type === 'LOCAL_ACTIVITY_UPDATE' && d.activity).map(d => d.socketId);
        ok(sockets.includes('venus-badges') && sockets.includes('venus-badges-1'), 'each game shows on the profile under its own socket');
        const before = w.sent.length;
        await w.advance(5 * 60000);
        const batch = w.sent.slice(before).find(s => s.events.every(e => e.type === 'running_game_heartbeat'));
        ok(batch && batch.events.length === 2 && batch.events.every(e => Math.abs(e.properties.duration_tracked_ms - 300000) < 2000), 'one 5 minute heartbeat batch covers both games');
        const extraId = w.api.badges.extra[0].game.id, firstId = w.api.badges.current.game.id;
        await w.advance(10 * 60000 + 1000);
        ok(w.api.badges.current && w.api.badges.current.game.id !== firstId, 'the rotating game switches after 15 minutes');
        ok(w.api.badges.extra[0] && w.api.badges.extra[0].game.id === extraId, 'the extra game keeps playing through the switch');
        const finals = heartbeats(w).filter(e => e.properties.final_heartbeat);
        ok(finals.length === 1 && finals[0].properties.game_id === firstId, 'the game switched out sends a final heartbeat');
        ok(w.activities.length > 0 && !w.api.badges.error, 'a 404 from /activities is neither fatal nor shown as a problem');
        w.env.settings.badgesGamesAtOnce = 1; w.api.badgesSettingChanged('badgesGamesAtOnce', 1); await w.advance(1000);
        ok(w.api.badges.extra.length === 0, 'Games at once 1 stops the extra game');
        w.env.settings.badgesGamesAtOnce = 3; w.api.badgesSettingChanged('badgesGamesAtOnce', 3); await w.advance(1000);
        ok(w.api.badges.extra.length === 2, 'Games at once 3 plays 3 games');
        w.api.badgesStop(); await w.flush();
        ok(!w.api.badges.current && w.api.badges.extra.length === 0, 'turning the feature off stops every game');
        ok(w.dispatched.filter(d => d.type === 'LOCAL_ACTIVITY_UPDATE' && !d.activity).length >= 3, 'turning it off clears every game from the profile');
    }
    {
        const w = world({settings: {badgesGameTime: false}});
        await w.api.badgeStartGame(null); await w.flush();
        ok(w.api.badges.extra.length === 0, 'without Game time only one game plays');
    }
    {
        const w = world({progress: {GAME_VARIETY: 100}});
        await w.api.badgeStartGame(null); await w.flush();
        const id = w.api.badges.current.game.id;
        await w.advance(60 * 60000);
        ok(w.api.badges.current.game.id === id, 'games stop switching once the 100 game top tier is reached');
    }
    {
        const w = world({progress: {GAME_TIME: 10, GAME_VARIETY: 3}});
        w.api.BADGE_FALLBACK_GAMES.slice(0, 6).forEach(g => w.api.badges.played.add(g.id));
        ok(w.api.badgeGrantLimit() === 1000, 'Add hours now allows up to 1,000 hours a day');
        const p = w.api.badgeGrantHours(300);
        await w.advance(5 * 60000);
        ok(await p === true, 'adding 300 hours finishes');
        const finals = heartbeats(w).filter(e => e.properties.final_heartbeat);
        const total = finals.reduce((s, e) => s + e.properties.duration_tracked_ms, 0);
        ok(Math.abs(total - 300 * 3600000) < 1000, 'exactly 300 hours are sent');
        ok(finals.every(e => e.properties.duration_tracked_ms <= 8 * 3600000 + 1), 'no session is longer than 8 hours');
        ok(w.sent.every(s => s.events.length <= 24), 'at most 8 sessions go in one request');
        const sessions = finals.map(e => ({id: e.properties.game_id, end: e.properties.client_track_timestamp,
            start: e.properties.client_track_timestamp - e.properties.duration_tracked_ms}));
        ok(sessions.every(x => x.end <= w.now()), 'no session ends in the future');
        ok(sessions.every(x => x.start >= w.api.BADGE_GAME_TIME_START), 'no session starts before Game Time began counting');
        let most = 0, running = 0;
        for (const [, d] of sessions.flatMap(x => [[x.start, 1], [x.end, -1]]).sort((p, q) => p[0] - q[0] || p[1] - q[1])) { running += d; most = Math.max(most, running); }
        ok(most <= 3, 'never more than 3 games at the same moment (' + most + ')');
        ok(!sessions.some(x => sessions.some(y => y !== x && y.id === x.id && y.start < x.end && y.end > x.start)), 'the same game never overlaps itself');
        ok(sessions.every(x => w.api.badges.played.has(x.id)), 'only games already played are used');
        const inits = heartbeats(w).filter(e => e.properties.initial_heartbeat);
        ok(inits.every(e => finals.some(f => f.properties.game_session_id === e.properties.game_session_id)), 'every session opens and closes with the same session ID');
        ok(w.api.badgeGrantWait() > 23 * 3600000, 'then there is a 24 hour wait');
        ok(await w.api.badgeGrantHours(10) === false, 'a second grant inside 24 hours is refused');
        ok(w.api.badgeGrantRecord().hours === 300, 'the account remembers its 300 added hours');
        w.setNow(w.now() + 25 * 3600000);
        w.env.progress.GAME_TIME = 4500;
        ok(w.api.badgeGrantLimit() === 200, "hours Discord hasn't shown yet count toward 5,000 (" + w.api.badgeGrantLimit() + ')');
        const oldest = Math.min(...sessions.map(x => x.start)), before = w.sent.length;
        const p2 = w.api.badgeGrantHours(25); await w.advance(60000); await p2;
        const second = w.sent.slice(before).flatMap(s => s.events).filter(e => e.properties.final_heartbeat);
        ok(second.length && second.every(e => e.properties.client_track_timestamp <= oldest), 'the next grant goes further back instead of overlapping the last one');
        w.api.badges.user = '222222222222222222';
        ok(w.api.badgeGrantWait() === 0 && w.api.badgeGrantRecord().hours === 0, 'another account has its own cooldown and total');
    }
    {
        const w = world();
        w.env.failScience = true;
        const p = w.api.badgeGrantHours(100); await w.advance(60000);
        ok(await p === false && !w.api.badges.granting, 'a failed grant stops and clears its progress');
        ok(w.api.badgeGrantWait() === 0 && w.api.badgeGrantRecord().hours === 0, 'nothing sent means no cooldown and nothing counted');
        ok(String(w.api.badges.error) === '500', 'the failure is shown');
    }
    {
        const w = world();
        const g = w.api.badgeGrantsLoad({'111111111111111111': {at: 1, hours: 99999, from: 5, recent: [[1, 2], 'x']}, bad: {at: 1, hours: 1}, '3': null});
        const r = g['111111111111111111'];
        ok(Object.keys(g).length === 1 && r.hours === 5000 && r.from === w.api.BADGE_GAME_TIME_START && r.recent.length === 1, 'saved grants are checked when loaded');
    }
    {
        // Five 1,000 hour grants in a row (the whole 5,000) must fit after December 8, 2025.
        const w = world(), games = Array.from({length: 6}, (_, i) => ({id: 'g' + i}));
        let from = w.now() - 3600000, total = 0;
        for (let k = 0; k < 5; k++) {
            const p = w.api.badgeGrantPlan(1000, games, from);
            total += p.sessions.reduce((a, x) => a + x.ms, 0);
            from = Math.min(...p.sessions.map(x => x.start)) - 3600000;
        }
        ok(Math.round(total / 3600000) === 5000 && from > w.api.BADGE_GAME_TIME_START, 'all 5,000 hours fit after December 8, 2025');
    }
    console.log(`\n${checks - failures}/${checks} passed`);
    process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
