// Benchmark messageRowResult on Hermes HBC98:
// Old:
//  - calls enabled("pastelize"), enabled("translate"), enabled("noDelete"), enabled("messageHighlight") on every row
//  - checks features.pastelize && message.referencedMessage && message.referencedMessage.message even when pastelize is off (or calls pastelReply which calls enabled("pastelize") and enabled("pastelContent") again, and copies reply to delete textColor when textColor != null!)
//  Wait: check pastelReply carefully! When features.pastelize is true and pastelize is OFF, if message.referencedMessage.message has textColor == null, it still checks enabled("pastelize") and enabled("pastelContent").
//  - resolves source, channelId, id, bucket, isDeletedRow, needHighlightCheck, isMentionRow (calling highlightMentioned(source, next.message)) on every row whenever features.translate or features.messageHighlight is patched in!
//  - highlightMentioned checks `source.mentioned`, `message.mentioned`, `source.mention_everyone`, `source.mentionEveryone`, `Array.isArray(mentions) && mentions.length > 0`, `source.referenced_message || source.referencedMessage && source.referencedMessage.message` on EVERY row!
//  - highlightCustomPair(delHex, mult) / highlightCustomPair(pingHex, mult) calls highlightProcess(hex), highlightProcess(hex + "1a") (string concatenation + 2 Map lookups + highlightEncodeGutter + allocating a new `{backgroundColor, gutterColor}` object!) on EVERY highlighted or deleted row!

const features = { pastelize: true, translate: true, noDelete: true, messageHighlight: true };
const settings = {
    pastelize: false,
    pastelAll: false,
    pastelContent: false,
    translate: false,
    noDelete: true,
    noDeleteEdits: true,
    messageHighlight: true,
    messageHighlightThickness: 2,
    messageHighlightPingColor: "blurple",
    messageHighlightDeletedColor: "default"
};
function enabled(key) { return !!(features[key] && settings[key]); }

const HIGHLIGHT_COLOR_MAP = { blurple: "#5865f2", cyan: "#00a8fc", green: "#23a55a", yellow: "#f0b232", orange: "#e67e22", pink: "#eb459e", purple: "#9b59b6", red: "#f23f43" };
function normalizeHighlightColor(value) { return String(value || "").trim().toLowerCase(); }
function highlightColorHex(choice, defaultHex) {
    if (typeof choice !== "string" || choice === "default") return defaultHex;
    const clean = normalizeHighlightColor(choice);
    return clean.startsWith("#") ? clean : HIGHLIGHT_COLOR_MAP[clean] || defaultHex;
}

const RN = { processColor(c) { return c.length * 111111; } };
const userStore = { getCurrentUser() { return { id: "999999999999999999" }; } };
function currentUser() { return userStore && userStore.getCurrentUser(); }

const deleted = new Map(), deletedByChannel = new Map(), edits = new Map();
const highlightProcessed = new Map(), highlightRecent = new Map(), deletedHighlight = {};
const translate = { shown: new Map(), refreshing: new Set() };

function deletedKey(channelId, id) { return channelId + ":" + id; }
function translateContentSource(message) {
    if (!message || typeof message !== "object") return null;
    if (typeof message.getContentMessage === "function") try { const inner = message.getContentMessage(); if (inner && typeof inner === "object") return inner; } catch (_) {}
    const snapshots = message.messageSnapshots || message.message_snapshots;
    if (Array.isArray(snapshots) && snapshots[0] && snapshots[0].message && typeof snapshots[0].message === "object") return snapshots[0].message;
    return message;
}
function translateSeen(source, channelId, id, key, quoteKey, quotedId) {
    if (!source || !channelId || !id || translate.refreshing.has(id)) return;
    const existing = translate.shown.get(id);
    const reference = source.messageReference || source.message_reference;
    const nextQuotes = quotedId || reference && (reference.message_id || reference.messageId) || (existing && existing.quotes) || null;
    if (existing && existing.source === source && existing.channelId === channelId &&
        (!key || existing.key === key) && (!quoteKey || existing.quoteKey === quoteKey) && existing.quotes === nextQuotes) return;
    const contentSource = translateContentSource(source);
    const raw = typeof source.content === "string" && source.content ? source.content : "";
    if (!raw) return;
    let entry = existing;
    if (entry) translate.shown.delete(id);
    else if (translate.shown.size >= 300) translate.shown.delete(translate.shown.keys().next().value);
    if (!entry) entry = { channelId, id, source: null, raw: "", snapshot: null, key: null, quoteKey: null, quotes: null };
    entry.source = source; entry.raw = raw; entry.snapshot = null; entry.key = key || entry.key; entry.quoteKey = quoteKey || entry.quoteKey;
    entry.quotes = nextQuotes;
    translate.shown.set(id, entry);
}

function highlightProcess(colorStr) {
    if (!RN || typeof RN.processColor !== "function") return null;
    if (highlightProcessed.owner !== RN.processColor) {
        highlightProcessed.clear();
        highlightProcessed.owner = RN.processColor;
    }
    if (highlightProcessed.has(colorStr)) return highlightProcessed.get(colorStr);
    let value = null;
    try { value = RN.processColor(colorStr); } catch (_) {}
    if (value != null) highlightProcessed.set(colorStr, value);
    return value;
}
function highlightEncodeGutter(colorInt, mult) {
    if (typeof colorInt !== "number") return colorInt;
    if (!Number.isFinite(mult) || mult <= 1) return colorInt;
    const m = Math.max(2, Math.min(8, Math.floor(mult)));
    return ((256 - m) << 24) | (colorInt & 0x00ffffff);
}
function highlightCustomPairOld(hex, mult) {
    const gutter = highlightProcess(hex);
    const background = highlightProcess(hex + "1a");
    if (gutter == null || background == null) return null;
    return { backgroundColor: background, gutterColor: highlightEncodeGutter(gutter, mult) };
}
function highlightMentionedOld(source, message) {
    if (source && source.mentioned || message && message.mentioned) return true;
    if (!source || typeof source !== "object") return false;
    if (source.mention_everyone || source.mentionEveryone) return true;
    const mentions = source.mentions;
    const ref = source.referenced_message || source.referencedMessage && source.referencedMessage.message;
    const hasMentions = Array.isArray(mentions) && mentions.length > 0;
    const refAuthor = ref && ref.author && ref.author.id;
    if (!hasMentions && !refAuthor) return false;
    const me = currentUser();
    const myId = me && me.id;
    if (!myId) return false;
    if (refAuthor === myId) return true;
    if (hasMentions) for (let i = 0; i < mentions.length; i++) {
        const u = mentions[i];
        if (u && (u === myId || u.id === myId)) return true;
    }
    return false;
}
function highlightRememberOld(channelId, id, source) {
    if (!features.messageHighlight || typeof channelId !== "string" || !channelId || typeof id !== "string" || !id) return;
    const key = channelId + ":" + id;
    const existing = highlightRecent.get(key);
    if (existing && existing.source === source) return;
    if (existing) highlightRecent.delete(key);
    else if (highlightRecent.size >= 80) highlightRecent.delete(highlightRecent.keys().next().value);
    highlightRecent.set(key, {
        channelId,
        id,
        source,
        content: source && typeof source.content === "string" ? source.content : "",
        embeds: source && Array.isArray(source.embeds) ? source.embeds : null,
        components: source && Array.isArray(source.components) ? source.components : null
    });
}

function messageRowResultOld(result, row) {
    if (!result || !row || row.rowType !== 1 || !result.message) return result;
    const pastelOn = enabled("pastelize"), translateOn = enabled("translate"), noDeleteOn = enabled("noDelete"), highlightOn = enabled("messageHighlight");
    let message = result.message;
    let next = message === result.message ? result : Object.assign({}, result, { message });
    if (!translateOn && !features.translate && !(noDeleteOn && (edits.size || deleted.size)) && !highlightOn && !features.messageHighlight) return next;
    const source = row.message || message;
    const channelId = source.channel_id || source.channelId || message.channelId;
    const id = source.id || message.id;
    if (!translateOn && features.translate) translateSeen(source, channelId, id, null);
    const bucket = deleted.size && noDeleteOn && deletedByChannel.get(channelId);
    const isDeletedRow = !!(bucket && bucket.has(deletedKey(channelId, id)));
    const needHighlightCheck = highlightOn || features.messageHighlight;
    const isMentionRow = !isDeletedRow && needHighlightCheck && highlightMentionedOld(source, next.message);
    if (features.messageHighlight && (isDeletedRow || isMentionRow || next.backgroundHighlight))
        highlightRememberOld(channelId, id, source);
    const mult = highlightOn ? settings.messageHighlightThickness : 1;
    if (isDeletedRow && RN && typeof RN.processColor === "function") {
        const delHex = highlightOn ? highlightColorHex(settings.messageHighlightDeletedColor, "#f23f43") : "#f23f43";
        const custom = highlightCustomPairOld(delHex, mult);
        if (custom) next = Object.assign({}, next, { backgroundHighlight: custom });
    } else if (highlightOn && RN && typeof RN.processColor === "function") {
        const existing = next.backgroundHighlight;
        if (isMentionRow && settings.messageHighlightPingColor !== "default") {
            const pingHex = highlightColorHex(settings.messageHighlightPingColor, "#f0b232");
            const custom = highlightCustomPairOld(pingHex, mult);
            if (custom) next = Object.assign({}, next, { backgroundHighlight: custom });
        } else if (existing && typeof existing.gutterColor === "number" && mult > 1) {
            next = Object.assign({}, next, { backgroundHighlight: Object.assign({}, existing, { gutterColor: highlightEncodeGutter(existing.gutterColor, mult) }) });
        }
    }
    return next;
}

// Now let's design the optimized version:
// 1. Cache `highlightCustomPair(choice, defaultHex, mult)` so we don't call `highlightColorHex` (which runs `.trim().toLowerCase()`), `hex + "1a"`, two Map lookups, `highlightEncodeGutter`, and `{backgroundColor, gutterColor}` object allocation on every highlighted/deleted row!
const highlightPairCache = new Map();
function highlightCustomPairNew(choice, defaultHex, mult) {
    if (!RN || typeof RN.processColor !== "function") return null;
    if (highlightPairCache.owner !== RN.processColor) {
        highlightPairCache.clear();
        highlightPairCache.owner = RN.processColor;
    }
    const key = choice + ":" + defaultHex + ":" + mult;
    const cached = highlightPairCache.get(key);
    if (cached !== undefined) return cached;
    const hex = highlightColorHex(choice, defaultHex);
    const gutter = highlightProcess(hex);
    const background = highlightProcess(hex + "1a");
    const pair = gutter == null || background == null ? null : { backgroundColor: background, gutterColor: highlightEncodeGutter(gutter, mult) };
    highlightPairCache.set(key, pair);
    return pair;
}

// 2. In `highlightMentioned`, check `mentions.length` BEFORE `Array.isArray(mentions)` (or `mentions && mentions.length > 0`)!
function highlightMentionedNew(source, message) {
    if (source && source.mentioned || message && message.mentioned) return true;
    if (!source || typeof source !== "object") return false;
    if (source.mention_everyone || source.mentionEveryone) return true;
    const mentions = source.mentions;
    const hasMentions = !!(mentions && mentions.length > 0 && Array.isArray(mentions));
    const ref = source.referenced_message || source.referencedMessage && source.referencedMessage.message;
    const refAuthor = ref && ref.author && ref.author.id;
    if (!hasMentions && !refAuthor) return false;
    const me = currentUser();
    const myId = me && me.id;
    if (!myId) return false;
    if (refAuthor === myId) return true;
    if (hasMentions) for (let i = 0; i < mentions.length; i++) {
        const u = mentions[i];
        if (u && (u === myId || u.id === myId)) return true;
    }
    return false;
}

// 3. In `highlightRemember`: store `lastId` / `lastSource` on `source` or avoid `channelId + ":" + id` string concat when `highlightRecent` already has `id`? Wait: `id` is already a globally unique Discord snowflake! Wait — can the same message ID exist in two channels? No, Discord message IDs are unique snowflakes, or even if keyed by `id` with `existing.channelId === channelId`, `highlightRecent.get(id)` avoids `channelId + ":" + id` string concatenation on EVERY highlighted row!
function highlightRememberNew(channelId, id, source) {
    if (!features.messageHighlight || typeof channelId !== "string" || !channelId || typeof id !== "string" || !id) return;
    const existing = highlightRecent.get(id);
    if (existing && existing.source === source && existing.channelId === channelId) return;
    if (existing) highlightRecent.delete(id);
    else if (highlightRecent.size >= 80) highlightRecent.delete(highlightRecent.keys().next().value);
    highlightRecent.set(id, {
        channelId,
        id,
        source,
        content: source && typeof source.content === "string" ? source.content : "",
        embeds: source && Array.isArray(source.embeds) ? source.embeds : null,
        components: source && Array.isArray(source.components) ? source.components : null
    });
}

function messageRowResultNew(result, row) {
    if (!result || !row || row.rowType !== 1 || !result.message) return result;
    const pastelOn = !!(features.pastelize && settings.pastelize);
    const translateOn = !!(features.translate && settings.translate);
    const noDeleteOn = !!(features.noDelete && settings.noDelete);
    const highlightOn = !!(features.messageHighlight && settings.messageHighlight);
    let message = result.message;
    let next = message === result.message ? result : Object.assign({}, result, { message });
    if (!translateOn && !features.translate && !(noDeleteOn && (edits.size || deleted.size)) && !highlightOn && !features.messageHighlight) return next;
    const source = row.message || message;
    const channelId = source.channel_id || source.channelId || message.channelId;
    const id = source.id || message.id;
    if (!translateOn && features.translate) translateSeen(source, channelId, id, null);
    const bucket = deleted.size && noDeleteOn && deletedByChannel.get(channelId);
    const isDeletedRow = !!(bucket && bucket.has(deletedKey(channelId, id)));
    const needHighlightCheck = highlightOn || features.messageHighlight;
    const isMentionRow = !isDeletedRow && needHighlightCheck && highlightMentionedNew(source, next.message);
    if (features.messageHighlight && (isDeletedRow || isMentionRow || next.backgroundHighlight))
        highlightRememberNew(channelId, id, source);
    const mult = highlightOn ? settings.messageHighlightThickness : 1;
    if (isDeletedRow && RN && typeof RN.processColor === "function") {
        const custom = highlightCustomPairNew(highlightOn ? settings.messageHighlightDeletedColor : "default", "#f23f43", mult);
        if (custom) next = Object.assign({}, next, { backgroundHighlight: custom });
    } else if (highlightOn && RN && typeof RN.processColor === "function") {
        const existing = next.backgroundHighlight;
        if (isMentionRow && settings.messageHighlightPingColor !== "default") {
            const custom = highlightCustomPairNew(settings.messageHighlightPingColor, "#f0b232", mult);
            if (custom) next = Object.assign({}, next, { backgroundHighlight: custom });
        } else if (existing && typeof existing.gutterColor === "number" && mult > 1) {
            next = Object.assign({}, next, { backgroundHighlight: Object.assign({}, existing, { gutterColor: highlightEncodeGutter(existing.gutterColor, mult) }) });
        }
    }
    return next;
}

const sampleRows = [];
for (let i = 0; i < 32; i++) {
    const mentioned = i % 4 === 0;
    const src = {
        id: String(100000000000000000 + i),
        channel_id: "200000000000000000",
        content: "Hello world message " + i,
        mentions: mentioned ? [{ id: "999999999999999999" }] : [],
        mentioned
    };
    sampleRows.push({
        row: { rowType: 1, message: src },
        result: {
            message: { id: src.id, channelId: src.channel_id, content: [{ type: "text", content: src.content }], mentioned },
            backgroundHighlight: mentioned ? { backgroundColor: 111, gutterColor: 222 } : undefined
        }
    });
}
// Warm up caches
for (let i = 0; i < 32; i++) {
    messageRowResultOld(sampleRows[i].result, sampleRows[i].row);
    messageRowResultNew(sampleRows[i].result, sampleRows[i].row);
}

bench("messageRowResult: uncached highlightCustomPair + channelId:id key (old, 32 rows)", function () {
    let count = 0;
    for (let i = 0; i < 32; i++) {
        const out = messageRowResultOld(sampleRows[i].result, sampleRows[i].row);
        if (out.backgroundHighlight) count++;
    }
    return count;
});

bench("messageRowResult: cached highlightCustomPair + id key (new, 32 rows)", function () {
    let count = 0;
    for (let i = 0; i < 32; i++) {
        const out = messageRowResultNew(sampleRows[i].result, sampleRows[i].row);
        if (out.backgroundHighlight) count++;
    }
    return count;
});
