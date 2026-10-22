// Fix link previews runs on every message you send. Most messages have no link: they must cost no more than one
// indexOf. A message with links pays one regex scan plus one host lookup per link (no per-site regex walk).
// The baseline is a send with the feature not built in.
var settings = {fixEmbedsSites: "", fixEmbedsClean: true, fixEmbeds: true}, features = {fixEmbeds: true};
function later() {} function notify() {} function enabled(k) { return !!settings[k]; } function currentUser() { return {premiumType: 0}; } function setSetting() {}
    // Fix link previews: links to posts on sites whose previews Discord can't build (X, Instagram, TikTok, Reddit...) are
    // sent through an embed service that can: x.com/... becomes fixupx.com/..., and the post shows with its text, picture
    // or video. Only the address changes: Venus fetches nothing, and nothing happens until you send.
    // Each site: [id, name, brand color, icon (module, export) or a letter, hosts, post path (or one per host), services].
    // A service is [id, name, {from host: to host}], or [id, name, "prefix"] for one that takes the whole link.
    // Built only when a link is first sent or the page opens, never while Discord starts.
    function fixSiteRows() {
        return [
            ["x", "X (Twitter)", "#000000", [8128, "XNeutralIcon"], ["x.com", "twitter.com"], /^\/(?:[A-Za-z0-9_]{1,15}|i(?:\/web)?)\/status(?:es)?\/\d+/,
                [["fxtwitter", "FxTwitter", {"x.com":"fixupx.com", "twitter.com":"fxtwitter.com"}], ["vxtwitter", "vxTwitter", {"x.com":"fixvx.com", "twitter.com":"vxtwitter.com"}]]],
            ["instagram", "Instagram", "#e1306c", [8132, "InstagramNeutralIcon"], ["instagram.com"], /^\/(?:[\w.]+\/)?(?:p|reels?|tv|share(?:\/(?:p|reels?))?)\/[\w-]+/,
                [["oginstagram", "OGInstagram", {"instagram.com":"oginstagram.com"}], ["instafix", "InstaFix", {"instagram.com":"eeinstagram.com"}],
                 ["kkinstagram", "KKInstagram", {"instagram.com":"kkinstagram.com"}]]],
            ["tiktok", "TikTok", "#ee1d52", [12055, "TiktokNeutralIcon"], ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com"],
                {"tiktok.com":/^\/(?:@[\w.-]+\/(?:video|photo)\/\d+|t\/\w+)/, "vm.tiktok.com":/^\/\w+/, "vt.tiktok.com":/^\/\w+/},
                [["fxtiktok", "fxTikTok", {"tiktok.com":"tnktok.com", "vm.tiktok.com":"vm.tnktok.com", "vt.tiktok.com":"vt.tnktok.com"}],
                 ["tiktxk", "tiktxk", {"tiktok.com":"tiktxk.com", "vm.tiktok.com":"vm.tiktxk.com", "vt.tiktok.com":"vt.tiktxk.com"}]]],
            ["reddit", "Reddit", "#ff4500", [9105, "RedditNeutralIcon"], ["reddit.com"], /^\/(?:r|u|user)\/[\w-]+\/(?:comments|s)\/\w+/,
                [["vxreddit", "vxReddit", {"reddit.com":"vxreddit.com"}], ["fixreddit", "FixReddit", {"reddit.com":"fxreddit.seria.moe"}], ["rxddit", "rxddit", {"reddit.com":"rxddit.com"}]]],
            ["bluesky", "Bluesky", "#1185fe", [9103, "BlueskyNeutralIcon"], ["bsky.app"], /^\/profile\/[^\/\s]+\/post\/\w+/,
                [["fxbsky", "FxBluesky", {"bsky.app":"fxbsky.app"}], ["vixbluesky", "VixBluesky", {"bsky.app":"bskx.app"}]]],
            ["threads", "Threads", "#101010", "@", ["threads.net", "threads.com"], /^\/@[\w.]+\/post\/[\w-]+/,
                [["fixembed", "FixEmbed", "https://fixembed.app/embed?url="]]],
            ["facebook", "Facebook", "#0866ff", [8130, "FacebookNeutralIcon"], ["facebook.com"],
                /^\/(?:reel\/\d+|watch\/?\?|share\/[rvp]\/\w+|[\w.]+\/(?:videos|posts)\/[\w.-]+|story\.php|permalink\.php)/,
                [["facebed", "facebed", {"facebook.com":"facebed.com"}]]],
            ["pixiv", "pixiv", "#0096fa", "P", ["pixiv.net"], /^\/(?:[a-z]{2}\/)?artworks\/\d+/,
                [["phixiv", "phixiv", {"pixiv.net":"phixiv.net"}], ["ppxiv", "ppxiv", {"pixiv.net":"ppxiv.net"}]]],
            ["bilibili", "Bilibili", "#fb7299", "B", ["bilibili.com"], /^\/video\/\w+/,
                [["bilifix", "BiliFix", {"bilibili.com":"vxbilibili.com"}]]]];
    }
    // Share and tracking parameters each site adds when you copy a link: who shared it, from which app, and when. They're
    // removed from links Venus fixes, so neither the embed service nor anyone who taps the link sees them. utm_*, si and fbclid go everywhere.
    function fixTrackingTable() {
        return {x:/^(?:s|t|ref_src|ref_url)$/, instagram:/^(?:igsh|igshid|img_index)$/,
            tiktok:/^(?:_r|_t|_d|is_from_webapp|sender_device|sender_web_id|web_id|share_app_id|share_link_id|u_code|preview_pb|timestamp|checksum|tt_from|enter_from|source|social_share_type|share_item_id|user_id|sec_user_id)$/,
            reddit:/^(?:share_id|rdt|context|ref|ref_source|ref_campaign)$/, threads:/^(?:xmt|slof)$/, facebook:/^(?:mibextid|rdid|sfnsn|extid|ref|__tn__)$/,
            bilibili:/^(?:spm_id_from|vd_source|share_source|share_medium|share_plat|share_session_id|share_tag|timestamp|unique_k|up_id|bbid|ts)$/};
    }
    const FIX_TRACKING_ANY = /^(?:utm_\w+|si|fbclid|gclid|mc_cid|mc_eid)$/;
    const fixEmbeds = {hosts:null, sites:null, rows:null, tracking:null, parsed:null, parsedFrom:null, count:0};
    // One host lookup per link instead of a regex per site.
    function fixTables() {
        const hosts = Object.create(null), sites = Object.create(null), rows = fixSiteRows();
        rows.forEach(row => {
            const site = {id:row[0], name:row[1], color:row[2], icon:row[3], hosts:row[4], path:row[5], services:row[6].map(s => ({id:s[0], name:s[1], to:s[2]}))};
            sites[site.id] = site;
            site.hosts.forEach(host => { hosts[host] = site; });
        });
        fixEmbeds.hosts = hosts; fixEmbeds.sites = sites; fixEmbeds.rows = rows; fixEmbeds.tracking = fixTrackingTable();
    }
    function fixRows() { if (!fixEmbeds.rows) fixTables(); return fixEmbeds.rows; }
    function fixSite(id) { if (!fixEmbeds.sites) fixTables(); return fixEmbeds.sites[id] || null; }
    // fixEmbedsSites keeps only what differs from the defaults (each site's first service): "x:vxtwitter,threads:off".
    function fixChoices(raw) {
        if (fixEmbeds.parsedFrom === raw && fixEmbeds.parsed) return fixEmbeds.parsed;
        if (!fixEmbeds.sites) fixTables();
        const out = Object.create(null);
        String(raw || "").split(",").forEach(part => {
            const at = part.indexOf(":"), id = part.slice(0, at), choice = part.slice(at + 1), site = at > 0 && fixEmbeds.sites[id];
            if (site && (choice === "off" || site.services.some(s => s.id === choice)) && choice !== site.services[0].id) out[id] = choice;
        });
        fixEmbeds.parsedFrom = raw; fixEmbeds.parsed = out;
        return out;
    }
    function fixChoicesText(choices) { return fixRows().filter(row => choices[row[0]]).map(row => row[0] + ":" + choices[row[0]]).join(","); }
    // The choices written the one way they're saved; unknown sites or services are dropped. Undefined for anything else.
    function fixSitesText(raw) { return typeof raw === "string" && raw.length <= 400 ? fixChoicesText(fixChoices(raw)) : undefined; }
    function fixService(site) {
        const choice = fixChoices(settings.fixEmbedsSites)[site.id];
        return choice === "off" ? null : choice ? site.services.find(s => s.id === choice) || site.services[0] : site.services[0];
    }
    function fixSetChoice(siteId, choice) {
        const site = fixSite(siteId);
        if (!site) return;
        const choices = Object.assign({}, fixChoices(settings.fixEmbedsSites));
        if (choice === site.services[0].id) delete choices[siteId]; else choices[siteId] = choice;
        setSetting("fixEmbedsSites", fixChoicesText(choices));
    }
    function fixClean(site, query) {
        const own = fixEmbeds.tracking[site.id], kept = query.split("&").filter(pair => {
            if (!pair) return false;
            const at = pair.indexOf("="), name = at < 0 ? pair : pair.slice(0, at);
            return !FIX_TRACKING_ANY.test(name) && !(own && own.test(name));
        });
        return kept.length ? "?" + kept.join("&") : "";
    }
    // One link: {site, service, link}, or null when it isn't a post on a site you fix. A closing ")" or "." stays outside it.
    const FIX_TAIL = /[.,!?:;'")\]}*_~]+$/, FIX_SUBDOMAIN = /^(?:www|m|mobile|old|new|web)\./;
    function fixLink(host, rest, clean) {
        if (!fixEmbeds.hosts) fixTables();
        let bare = host.toLowerCase();
        if (FIX_SUBDOMAIN.test(bare)) bare = bare.slice(bare.indexOf(".") + 1);
        const site = fixEmbeds.hosts[bare];
        if (!site) return null;
        const tail = FIX_TAIL.exec(rest), body = tail ? rest.slice(0, tail.index) : rest;
        const path = site.path instanceof RegExp ? site.path : site.path[bare];
        if (!path || !path.test(body)) return null;
        const service = fixService(site);
        if (!service) return null;
        let address = body;
        if (clean !== false && settings.fixEmbedsClean) {
            const hash = address.indexOf("#"), fragment = hash < 0 ? "" : address.slice(hash), noHash = hash < 0 ? address : address.slice(0, hash), q = noHash.indexOf("?");
            if (q >= 0) address = noHash.slice(0, q) + fixClean(site, noHash.slice(q + 1)) + fragment;
        }
        const fixed = typeof service.to === "string" ? service.to + encodeURIComponent("https://" + bare + address) : "https://" + service.to[bare] + address;
        return {site, service, link:fixed + (tail ? tail[0] : "")};
    }
    // Code, escaped text and <links in angle brackets> (Discord's way to send a link without a preview) are left as written.
    const FIX_SCAN = /```[\s\S]*?(?:```|$)|``[^\n]*?(?:``|$)|`[^`\n]*(?:`|$)|\\[\s\S]|<https?:\/\/[^\s>]*>|https?:\/\/([A-Za-z0-9.-]+)([\/?#][^\s<>|]*)/g;
    function fixContent(content) {
        // A message without a link costs one indexOf.
        if (typeof content !== "string" || content.indexOf("://") < 0) return content;
        let changed = 0;
        const out = content.replace(FIX_SCAN, (match, host, rest) => {
            if (!host) return match;
            const fixed = fixLink(host, rest);
            if (!fixed) return match;
            changed++;
            return fixed.link;
        });
        if (!changed) return content;
        fixEmbeds.count += changed;
        later(() => notify("fixEmbeds"), 0);
        return out;
    }
    // Longer links never make a message too long to send: it goes as written instead, unless Send long messages splits it.
    function fixFits(content) {
        if (features.splitMessages && enabled("splitMessages")) return true;
        const user = currentUser();
        return content.length <= (user && user.premiumType === 2 ? 4000 : 2000);
    }
    // MessageActionCreators (7174) sendMessage(channelId, message) and editMessage(channelId, messageId, {content}).
    function fixEmbedsSend(orig, self, args) {
        const message = args[1];
        if (!message || typeof message.content !== "string" || message.content.indexOf("://") < 0 || !enabled("fixEmbeds")) return orig.apply(self, args);
        const content = fixContent(message.content);
        if (content === message.content || !fixFits(content)) return orig.apply(self, args);
        const next = Array.from(args); next[1] = Object.assign({}, message, {content});
        return orig.apply(self, next);
    }
    function fixEmbedsEdit(orig, self, args) {
        const edit = args[2];
        if (!edit || typeof edit.content !== "string" || edit.content.indexOf("://") < 0 || !enabled("fixEmbeds")) return orig.apply(self, args);
        const content = fixContent(edit.content);
        if (content === edit.content || !fixFits(content)) return orig.apply(self, args);
        const next = Array.from(args); next[2] = Object.assign({}, edit, {content});
        return orig.apply(self, next);
    }


function orig(channel, message) { return message; }
var plain = [], links = [];
for (var i = 0; i < 200; i++) plain.push({content: "gg that round was close, rematch at " + i + "?"});
for (var i = 0; i < 200; i++) links.push({content: i % 2 ? "lol look https://x.com/someone/status/18466029268370" + i + "?s=46&t=abc" :
    "https://www.youtube.com/watch?v=" + i + " and https://www.instagram.com/reel/C5nYWo0P" + i + "/?igsh=abc"});
fixContent("https://x.com/a/status/1");
bench("no hook: 200 sends without links", function () { for (var i = 0; i < 200; i++) orig("1", plain[i]); });
bench("fixEmbedsSend: 200 sends without links", function () { for (var i = 0; i < 200; i++) fixEmbedsSend(orig, null, ["1", plain[i]]); });
bench("fixEmbedsSend: 200 sends with 1-2 links", function () { for (var i = 0; i < 200; i++) fixEmbedsSend(orig, null, ["1", links[i]]); });
