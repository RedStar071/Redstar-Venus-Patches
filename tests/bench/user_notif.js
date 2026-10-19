// Benchmark userNotifWatched on Hermes HBC98:
// Old: regex test + currentUser() store lookup BEFORE checking userNotif.ids.has(id)
// New: check userNotif.ids.has(id) / friend check FIRST, skipping regex + store lookup on the 99.9% unwatched case

const userNotif = {
    ids: new Set(["111111111111111111", "222222222222222222"]),
    relationships: {
        getFriendIDs() { return ["333333333333333333", "444444444444444444"]; }
    }
};
const settings = { userNotifFriends: false };
const userStore = {
    getCurrentUser() { return { id: "999999999999999999" }; }
};
function currentUser() {
    try { return userStore && userStore.getCurrentUser(); } catch (_) { return null; }
}
function userNotifIsFriend(id) {
    const store = userNotif.relationships;
    try {
        if (store && typeof store.getFriendIDs === "function") {
            const list = store.getFriendIDs();
            return Array.isArray(list) && list.includes(id);
        }
    } catch (_) {}
    return false;
}

function userNotifWatchedOld(id) {
    if (typeof id !== "string" || !/^\d{17,20}$/.test(id)) return false;
    const me = currentUser();
    if (me && me.id === id) return false;
    return userNotif.ids.has(id) || !!(settings.userNotifFriends && userNotifIsFriend(id));
}

function userNotifWatchedNew(id) {
    if (typeof id !== "string") return false;
    if (!userNotif.ids.has(id) && !(settings.userNotifFriends && userNotifIsFriend(id))) return false;
    if (!/^\d{17,20}$/.test(id)) return false;
    const me = currentUser();
    return !(me && me.id === id);
}

const sampleIds = [];
for (let i = 0; i < 64; i++) {
    sampleIds.push(i === 31 ? "111111111111111111" : String(500000000000000000 + i));
}

bench("userNotifWatched: regex + currentUser before Set.has (old, 64 events)", function () {
    let hits = 0;
    for (let j = 0; j < 64; j++) {
        if (userNotifWatchedOld(sampleIds[j])) hits++;
    }
    return hits;
});

bench("userNotifWatched: Set.has before regex + currentUser (new, 64 events)", function () {
    let hits = 0;
    for (let j = 0; j < 64; j++) {
        if (userNotifWatchedNew(sampleIds[j])) hits++;
    }
    return hits;
});
