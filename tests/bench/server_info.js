// Server info sheet redraw on Hermes HBC98: what one presence tick (up to ~3/s while the sheet is open) costs.
// 300 friends, 60 of them in a 5,000-member server. Store calls go through serverCall (try/catch + typeof) like the sheet.
var GUILD = "613425648685547541", friendIds = [], members = {}, users = {}, statuses = {};
for (var i = 0; i < 300; i++) {
    var id = String(300000000000000000 + i * 7919);
    friendIds.push(id);
    users[id] = {id: id, username: "user" + i, globalName: i % 3 ? "Friend " + i : null};
    if (i % 5 === 0) members[id] = {nick: i % 4 ? null : "Nick " + i};
    statuses[id] = ["online", "idle", "dnd", "offline", "offline", "streaming"][i % 6];
}
var relationships = {getFriendIDs: function () { return friendIds; }};
var memberStore = {getMember: function (g, u) { return members[u] || null; }};
var presence = {getStatus: function (u) { return statuses[u] || "offline"; }};
var userStore = {getUser: function (u) { return users[u] || null; }};
var SERVER_STATUS_RANK = {online:0, streaming:0, dnd:1, idle:2};
function serverCall(store, name, a, b) {
    if (!store || typeof store[name] !== "function") return undefined;
    try { return store[name](a, b); } catch (_) { return undefined; }
}
function serverRank(status) { var rank = SERVER_STATUS_RANK[status]; return rank == null ? 3 : rank; }

// Old: every redraw walks all 300 friends through getMember, then getUser/getStatus for members, then sorts with localeCompare.
function serverFriendsOld(guildId) {
    var ids = serverCall(relationships, "getFriendIDs") || [];
    if (!ids.length) return [];
    var out = [];
    for (var i = 0; i < ids.length; i++) {
        var id = ids[i], member = serverCall(memberStore, "getMember", guildId, id);
        if (!member) continue;
        var user = serverCall(userStore, "getUser", id) || {id: id};
        out.push({id: id, user: user, status: serverCall(presence, "getStatus", id) || "offline",
            name: member.nick || user.globalName || user.global_name || user.username || id});
    }
    return out.sort(function (a, b) { return serverRank(a.status) - serverRank(b.status) || String(a.name).localeCompare(String(b.name)); });
}

// New: membership (who's here, their name) only changes when the member or user stores change; a presence tick only
// re-reads 60 statuses. Names are compared with a cached Intl.Collator-free key, ranks precomputed before the sort.
var cache = {key: null, list: null};
function serverFriendsNew(guildId, membersVersion) {
    var ids = serverCall(relationships, "getFriendIDs") || [];
    if (!ids.length) return [];
    var key = guildId + ":" + ids.length + ":" + membersVersion, list = cache.list;
    if (cache.key !== key) {
        list = [];
        for (var i = 0; i < ids.length; i++) {
            var id = ids[i], member = serverCall(memberStore, "getMember", guildId, id);
            if (!member) continue;
            var user = serverCall(userStore, "getUser", id) || {id: id};
            var name = member.nick || user.globalName || user.global_name || user.username || id;
            list.push({id: id, user: user, name: name, fold: String(name).toLowerCase(), status: "offline", rank: 3});
        }
        cache.key = key; cache.list = list;
    }
    var out = new Array(list.length);
    for (var j = 0; j < list.length; j++) {
        var f = list[j], status = serverCall(presence, "getStatus", f.id) || "offline";
        out[j] = {id: f.id, user: f.user, name: f.name, fold: f.fold, status: status, rank: serverRank(status)};
    }
    return out.sort(function (a, b) { return a.rank - b.rank || (a.fold < b.fold ? -1 : a.fold > b.fold ? 1 : 0); });
}
// Same cache, but keeps localeCompare so accented and non-Latin names still sort the way the language expects.
var cache2 = {key: null, list: null};
function serverFriendsCached(guildId, membersVersion) {
    var ids = serverCall(relationships, "getFriendIDs") || [];
    if (!ids.length) return [];
    var key = guildId + ":" + ids.length + ":" + membersVersion, list = cache2.list;
    if (cache2.key !== key) {
        list = [];
        for (var i = 0; i < ids.length; i++) {
            var id = ids[i], member = serverCall(memberStore, "getMember", guildId, id);
            if (!member) continue;
            var user = serverCall(userStore, "getUser", id) || {id: id};
            list.push({id: id, user: user, name: String(member.nick || user.globalName || user.global_name || user.username || id)});
        }
        list.sort(function (a, b) { return a.name.localeCompare(b.name); });   // by name once, per membership change
        cache2.key = key; cache2.list = list;
    }
    // A presence tick: read each status, then a stable sort by rank keeps the name order inside each rank.
    var out = new Array(list.length);
    for (var j = 0; j < list.length; j++) {
        var f = list[j], status = serverCall(presence, "getStatus", f.id) || "offline";
        out[j] = {id: f.id, user: f.user, name: f.name, status: status, rank: serverRank(status), at: j};
    }
    return out.sort(function (a, b) { return a.rank - b.rank || a.at - b.at; });
}
var sink;
bench("serverFriends: 300 friends -> getMember x300 + localeCompare sort (old)", function () { sink = serverFriendsOld(GUILD); });
bench("serverFriends: cached membership + lowercase sort (rejected: wrong order for accents)", function () { sink = serverFriendsNew(GUILD, 1); });
bench("serverFriends: cached membership sorted once by localeCompare, 60 status reads (ships)", function () { sink = serverFriendsCached(GUILD, 1); });
