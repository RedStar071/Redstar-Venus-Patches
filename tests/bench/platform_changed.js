// Benchmark platformChanged + platformClients on Hermes HBC98.
var presenceMap = {
    "1001": {desktop: "online", mobile: "online"},
    "1002": {web: "idle"},
    "1003": {mobile: "dnd"},
    "1004": {desktop: "online"},
    "1005": null,
    "1006": {desktop: "idle", web: "idle"},
    "1007": {mobile: "online"},
    "1008": {embedded: "online"},
    "9999": {desktop: "online"}
};
var presenceStore = {getClientStatus: function (id) { return presenceMap[id]; }};
var meUser = {id: "9999"};
var userStore = {getCurrentUser: function () { return meUser; }};
var sessionsObj = {
    s1: {clientInfo: {client: "desktop"}, status: "online"},
    s2: {clientInfo: {client: "mobile"}, status: "online"}
};
var sessionsStore = {getSessions: function () { return sessionsObj; }};

function platformClientsOld(userId) {
    var clients = presenceStore.getClientStatus(userId);
    var current = userStore && userStore.getCurrentUser();
    if (current && current.id === userId && sessionsStore && typeof sessionsStore.getSessions === "function") {
        clients = {};
        Object.values(sessionsStore.getSessions() || {}).forEach(function (session) {
            var client = session.clientInfo && session.clientInfo.client;
            if (client && client !== "unknown") clients[client] = session.status;
        });
    }
    return clients || null;
}
function clientsKey(clients) {
    if (!clients) return "";
    var key = "";
    for (var name in clients) key += name + ":" + clients[name] + ",";
    return key;
}
function platformKeyOld(userId) { return clientsKey(presenceStore && platformClientsOld(userId)); }

function platformClientsNew(userId, myId) {
    var clients = presenceStore.getClientStatus(userId);
    if (myId === undefined) {
        var current = userStore && userStore.getCurrentUser();
        myId = current && current.id;
    }
    if (myId && myId === userId && sessionsStore && typeof sessionsStore.getSessions === "function") {
        clients = {};
        var sessions = sessionsStore.getSessions();
        if (sessions) for (var k in sessions) {
            if (Object.prototype.hasOwnProperty.call(sessions, k)) {
                var session = sessions[k];
                var client = session && session.clientInfo && session.clientInfo.client;
                if (client && client !== "unknown") clients[client] = session.status;
            }
        }
    }
    return clients || null;
}
function platformKeyNew(userId, myId) { return clientsKey(presenceStore && platformClientsNew(userId, myId)); }

var platformSubs = new Map();
var subIds = ["1001", "1002", "1003", "1004", "1005", "1006", "1007", "1008", "9999"];
for (var i = 0; i < subIds.length; i++) {
    platformSubs.set(subIds[i], {key: platformKeyOld(subIds[i]), fns: new Set()});
}

function platformChangedOld() {
    platformSubs.forEach(function (entry, userId) {
        var key = platformKeyOld(userId);
        if (key !== entry.key) { entry.key = key; entry.fns.forEach(function (fn) { fn(); }); }
    });
}
function platformChangedNew() {
    if (!platformSubs.size) return;
    var current = userStore && userStore.getCurrentUser();
    var myId = current && current.id || null;
    platformSubs.forEach(function (entry, userId) {
        var key = platformKeyNew(userId, myId);
        if (key !== entry.key) { entry.key = key; entry.fns.forEach(function (fn) { fn(); }); }
    });
}

bench("old platformChanged (9 subscribed badges)", function () {
    platformChangedOld();
});
bench("new platformChanged (9 subscribed badges)", function () {
    platformChangedNew();
});
