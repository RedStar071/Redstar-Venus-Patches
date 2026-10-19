// Benchmark questsScan on Hermes HBC98:
// Old:
//  - calls questTask(item) twice per enrolled quest
//  - calls questTime(item.config.expiresAt) inside questOpen AND again O(N log N) times inside Array.prototype.sort comparator
//  - questApplication runs regex /^\d{5,25}$/.test(String(id)) and Array.prototype.find closure on every scan, even when playTarget/activityTarget <= 0
// New:
//  - calls questTask(item) once per quest
//  - caches expiry timestamp during the single loop (no Date.parse inside sort comparator)
//  - checks playTarget/activityTarget > 0 before calling questApplication, and avoids .find() closure allocation

const QUEST_VIDEO_TASKS = ["WATCH_VIDEO", "WATCH_VIDEO_ON_MOBILE"];
const QUEST_PLAY_TASK = "PLAY_ON_DESKTOP";
const QUEST_ACTIVITY_TASK = "PLAY_ACTIVITY";
const QUEST_MOBILE_ACTIVITY = 24;

const settings = { questsVideo: true, questsPlay: true, questsActivity: true, questsEnroll: true };
const quest = { skip: new Map() };

function questTime(value) {
    if (value == null || value === "") return NaN;
    const time = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(String(value));
    return Number.isFinite(time) ? time : NaN;
}

function questApplicationOld(item, task) {
    const apps = task && task.applications, first = Array.isArray(apps) ? apps.find(app => app && app.id) : null;
    const id = first ? first.id : item && item.config && item.config.application && item.config.application.id;
    return id != null && /^\d{5,25}$/.test(String(id)) ? String(id) : null;
}

function questTaskOld(item) {
    const config = item && item.config, tasks = config && (config.taskConfigV2 || config.taskConfig);
    const all = tasks && tasks.tasks;
    if (!all || typeof all !== "object") return null;
    if (settings.questsVideo) for (const type of QUEST_VIDEO_TASKS) {
        const target = Number(all[type] && all[type].target);
        if (target > 0) return { type, target, kind: "video" };
    }
    const play = all[QUEST_PLAY_TASK], playTarget = Number(play && play.target), playApp = questApplicationOld(item, play);
    if (settings.questsPlay && playTarget > 0 && playApp) return { type: QUEST_PLAY_TASK, target: playTarget, kind: "play", applicationId: playApp };
    const activity = all[QUEST_ACTIVITY_TASK], target = Number(activity && activity.target);
    const activityApp = questApplicationOld(item, activity), features = config.features;
    const mobile = Array.isArray(features) && features.includes(QUEST_MOBILE_ACTIVITY);
    if (settings.questsActivity && target > 0 && activityApp) return { type: QUEST_ACTIVITY_TASK, target, kind: "activity", applicationId: activityApp, mobile };
    return null;
}

function questOpenOld(item, now) {
    if (!item || typeof item.id !== "string" || !item.config) return false;
    if (item.userStatus && item.userStatus.completedAt) return false;
    const expires = questTime(item.config.expiresAt);
    return !(expires <= now + 60000) && !((quest.skip.get(item.id) || 0) > now);
}

function questApplicationNew(item, task) {
    const apps = task && task.applications;
    let id = null;
    if (Array.isArray(apps)) {
        for (let i = 0; i < apps.length; i++) {
            if (apps[i] && apps[i].id) { id = apps[i].id; break; }
        }
    }
    if (!id) id = item && item.config && item.config.application && item.config.application.id;
    if (id == null) return null;
    const str = typeof id === "string" ? id : String(id);
    return /^\d{5,25}$/.test(str) ? str : null;
}

function questTaskNew(item) {
    const config = item && item.config, tasks = config && (config.taskConfigV2 || config.taskConfig);
    const all = tasks && tasks.tasks;
    if (!all || typeof all !== "object") return null;
    if (settings.questsVideo) for (let i = 0; i < QUEST_VIDEO_TASKS.length; i++) {
        const type = QUEST_VIDEO_TASKS[i], entry = all[type], target = entry && Number(entry.target);
        if (target > 0) return { type, target, kind: "video" };
    }
    if (settings.questsPlay) {
        const play = all[QUEST_PLAY_TASK], playTarget = play && Number(play.target);
        if (playTarget > 0) {
            const playApp = questApplicationNew(item, play);
            if (playApp) return { type: QUEST_PLAY_TASK, target: playTarget, kind: "play", applicationId: playApp };
        }
    }
    if (settings.questsActivity) {
        const activity = all[QUEST_ACTIVITY_TASK], target = activity && Number(activity.target);
        if (target > 0) {
            const activityApp = questApplicationNew(item, activity);
            if (activityApp) {
                const features = config.features, mobile = Array.isArray(features) && features.includes(QUEST_MOBILE_ACTIVITY);
                return { type: QUEST_ACTIVITY_TASK, target, kind: "activity", applicationId: activityApp, mobile };
            }
        }
    }
    return null;
}

const nowBase = Date.parse("2026-10-19T12:00:00Z");
const sampleQuests = new Map();
for (let i = 0; i < 16; i++) {
    const id = String(100000000000000000 + i);
    const enrolled = i % 2 === 0;
    const kind = i % 3;
    sampleQuests.set(id, {
        id,
        config: {
            expiresAt: new Date(nowBase + (20 - i) * 3600000).toISOString(),
            taskConfigV2: {
                tasks: kind === 0
                    ? { PLAY_ON_DESKTOP: { target: 900, applications: [{ id: "356875221078245376" }] } }
                    : kind === 1
                    ? { PLAY_ACTIVITY: { target: 900, applications: [{ id: "456875221078245376" }] } }
                    : { WATCH_VIDEO_ON_MOBILE: { target: 60 } }
            }
        },
        userStatus: enrolled ? { enrolledAt: "2026-10-19T10:00:00Z", completedAt: null } : null
    });
}

function scanOld(all, now, onScreen) {
    const ready = [], waiting = [];
    for (const item of all.values()) {
        if (!questOpenOld(item, now) || !questTaskOld(item)) continue;
        if (item.userStatus && item.userStatus.enrolledAt) { if (onScreen || questTaskOld(item).kind !== "video") ready.push(item); }
        else if (settings.questsEnroll) waiting.push(item);
    }
    const expiry = item => { const time = questTime(item.config.expiresAt); return Number.isFinite(time) ? time : Infinity; };
    const soonest = (a, b) => expiry(a) - expiry(b);
    ready.sort(soonest); waiting.sort(soonest);
    return ready.length + waiting.length;
}

function scanNew(all, now, onScreen) {
    const ready = [], waiting = [], expMap = new Map();
    for (const item of all.values()) {
        if (!item || typeof item.id !== "string" || !item.config) continue;
        if (item.userStatus && item.userStatus.completedAt) continue;
        const expires = questTime(item.config.expiresAt);
        if (expires <= now + 60000 || (quest.skip.get(item.id) || 0) > now) continue;
        const task = questTaskNew(item);
        if (!task) continue;
        expMap.set(item, Number.isFinite(expires) ? expires : Infinity);
        if (item.userStatus && item.userStatus.enrolledAt) { if (onScreen || task.kind !== "video") ready.push(item); }
        else if (settings.questsEnroll) waiting.push(item);
    }
    const soonest = (a, b) => expMap.get(a) - expMap.get(b);
    if (ready.length > 1) ready.sort(soonest);
    if (waiting.length > 1) waiting.sort(soonest);
    return ready.length + waiting.length;
}

bench("questsScan: duplicate questTask + eager questApplication + Date.parse in sort (old, 4 scans)", function () {
    let total = 0;
    for (let i = 0; i < 4; i++) total += scanOld(sampleQuests, nowBase, false);
    return total;
});

bench("questsScan: single questTask + lazy questApplication + cached expiry (new, 4 scans)", function () {
    let total = 0;
    for (let i = 0; i < 4; i++) total += scanNew(sampleQuests, nowBase, false);
    return total;
});
