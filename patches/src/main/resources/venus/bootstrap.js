/* Venus Patches: bundled, offline runtime. No remote code or full client mod required. */
(function (global) {
    "use strict";
    if (global.__venusPatches) return;
    const features = /*__FEATURES__*/;
    // Inspected Metro IDs for the SHA-256-pinned 348.10 bundle; never scan or eagerly require modules.
    const targetModules = new Set([17, 19, 1163, 10874, 14130, 14236]);
    function selectModules(ids) { ids.forEach(id => targetModules.add(id)); }
    if (features.picker) selectModules([414]);
    if (features.voice) selectModules([1283, 5440, 5442]);
    if (features.copyBios) selectModules([10742]);
    if (features.dashless) selectModules([4990]);
    if (features.favouriteAnything) selectModules([12524, 9861, 9864]);
    if (features.freeNitro) selectModules([1378, 2051, 5772, 5815, 4491, 13528, 6756, 6880]);
    if (features.noTyping) selectModules([11348]);
    if (features.quickDelete) selectModules([5205, 1127]);
    if (features.noDelete) selectModules([585, 5057, 5059, 1378, 2051, 6880, 7378]);
    if (features.jumpToTop) selectModules([11642, 11643, 11644, 8838, 9804, 10418, 15746, 6880, 2051]);
    if (features.hiddenChannels) selectModules([1086, 1097, 1113, 2051, 4470, 6952, 4472, 4990, 6880, 585, 1378, 15859, 5410]);
    if (features.pastelize) selectModules([7378, 1252, 2111]);
    if (features.platformIndicators) selectModules([4877, 4855, 1378, 2051, 10603, 10371, 12845, 15667, 9108, 13649, 12602]);
    if (features.reviewDB) selectModules([12627, 13521, 13987, 8510, 5997, 6621, 1378, 585]);
    if (features.readAll) selectModules([15929]);
    if (features.quests) selectModules([585, 7120]);
    if (features.hideGift) selectModules([11609, 11817]);
    if (features.hideQuestDock) selectModules([14608, 14700]);
    if (features.systemEmoji) selectModules([6552]);
    if (features.gestures) selectModules([7414, 11105, 1378, 10905]);
    if (features.hideCall) selectModules([12696]);
    if (features.validUser) selectModules([585, 1378]);
    if (features.youBarSettings) selectModules([16032]);
    if (features.splitMessages) selectModules([1086, 1378, 2051, 6880, 8602]);
    if (features.translate) selectModules([585, 1378, 2115, 7378]);
    const revision = "1.10.0";
    // Module 120 owns setUpDefaltReactNativeEnvironment in this exact asset.
    // Defer every feature hook until that initializer returns successfully.
    let environmentReady = false;
    const deferred = new Map();
    // Every feature starts off: nothing changes in Discord until you turn it on. Options inside a feature keep
    // their own defaults, so turning a feature on does what it says straight away.
    const settings = { picker: false, voice: false, copyBios: false, dashless: false, favouriteAnything: false, freeNitro: false, emojis: true, stickers: true, hyperlinks: true,
        noTyping: false, quickDelete: false, noDelete: false, noDeleteSave: false, noDeleteLimit: 512, noDeleteEdits: true,
        jumpToTop: false, hiddenChannels: false, pastelize:false, pastelAll:false, pastelContent:false, platformIndicators:false, piDmHeader:true, piUserList:true, piProfile:true, piHideMobile:true, reviewDB:false, reviewWarning:true, readAll:false, readAllMode:"guilds",
        quests:false, questsVideo:true, questsPlay:true, questsActivity:true, questsEnroll:true, systemFont:false,
        hideGift:false, hideQuestDock:false, systemEmoji:false, gestures:false, gestureOwn:"edit", gestureTripleDelete:true, hideCall:false,
        validUser:false, youBarSettings:false, splitMessages:false,
        translate:false, translateTarget:"discord", translateNote:true, translateOriginal:false };
    const status = { picker: false, attachment: false, request: false, menu: false, conversion: false, audioError: "", storage: "waiting" };
    const listeners = new Set();
    const dirty = new Set();
    const sizeCache = new Map();
    const sizeQueue = [];
    const pendingVoice = new Map();
    const markedPayloads = new WeakMap();
    const wrapped = new WeakMap();
    // React Native installs Promise during its polyfill phase; no Promise use in this prelude.
    let React, RN, files, activeReads = 0, writePending = false, nextSave;
    const conversions = new WeakMap();
    const readyUploads = new WeakMap();
    const activeJobs = new Map();
    let jobCounter = 0;
    const PREFS = "venus-patches.json";
    const MAX_DELETED = 5000, ARCHIVE_BYTES = 32 * 1024 * 1024;
    // What the Read all button clears: servers, DMs, or both.
    const READ_ALL_MODES = ["guilds", "dms", "both"];
    // What double-tapping your own message does: edit it, or reply like anyone else's.
    const GESTURE_OWN_MODES = ["edit", "reply"];
    // Which language Translate messages translates into: Discord's own language, or the phone's.
    const TRANSLATE_TARGETS = ["discord", "phone"];
    // A sub-option (piProfile, reviewWarning, pastelAll...) must also wake components that
    // subscribed to its plugin: those pages and badges read several of its settings at once.
    const notify = key => {
        const owner = key && key !== "*" ? featureFor(key) : null;
        listeners.forEach(entry => {
            if (!entry.key || key === "*" || entry.key === key || owner && entry.key === owner) entry.fn();
        });
    };
    const data = (obj, key) => {
        const descriptor = obj && Object.getOwnPropertyDescriptor(obj, key);
        return descriptor && "value" in descriptor ? descriptor.value : undefined;
    };
    const owns = (obj, key) => obj != null && Object.prototype.hasOwnProperty.call(obj, key);
    // enabled() runs inside nearly every hook: resolve setting -> feature once, not per call.
    const featureTable = new Map();
    const enabled = key => {
        let feature = featureTable.get(key);
        if (feature === undefined) featureTable.set(key, feature = featureFor(key));
        // An option only counts while its main switch is on too. Only FreeNitro checked that, so
        // "Removing link previews" kept skipping the question after QuickDelete itself was turned off.
        return !!(features[feature] && settings[key] && (feature === key || settings[feature]));
    };

    // The font Discord started with; the native side reads the same saved setting at launch.
    let fontInUse = false;
    // Emojis are the same: the native side reads the saved setting once at launch, and so does this.
    let emojiInUse = false;
    function settingsSnapshot() {
        return JSON.stringify(features.reviewDB && reviewToken && reviewAccount ? Object.assign({}, settings, {reviewAuth:{account:reviewAccount, token:reviewToken}}) : settings);
    }
    function save() {
        if (!files || status.storage === "loading") return;
        // Keep only the newest waiting snapshot, not one Promise/string per toggle.
        nextSave = settingsSnapshot();
        if (writePending) return;
        writePending = true;
        function persist() {
            const snapshot = nextSave;
            nextSave = undefined;
            return Promise.resolve().then(() => files.writeFile("documents", PREFS, snapshot, "utf8")).then(() => {
                status.storage = "saved";
            }, () => { status.storage = "save failed (session only)"; }).then(() => {
                notify();
                if (nextSave !== undefined && nextSave !== snapshot) return persist();
                nextSave = undefined;
                writePending = false;
            });
        }
        Promise.resolve().then(persist);
    }
    // Typing 0 in the maximum box used to jump it to 512; anything below 1 now means the lowest, 1.
    function deleteLimit(value) { const n = Math.floor(Number(value)); return Number.isFinite(n) ? Math.max(1, Math.min(MAX_DELETED, n)) : 512; }
    function setSetting(key, value) {
        if (!owns(settings, key) || !features[featureFor(key)]) return false;
        if (key === "readAllMode") {
            if (!READ_ALL_MODES.includes(value)) return false;
            if (settings.readAllMode === value && status.storage !== "loading" && status.storage !== "waiting") return true;
            settings.readAllMode = value; dirty.add(key); save(); notify(key); return true;
        }
        if (key === "gestureOwn") {
            if (!GESTURE_OWN_MODES.includes(value)) return false;
            if (settings.gestureOwn === value && status.storage !== "loading" && status.storage !== "waiting") return true;
            settings.gestureOwn = value; dirty.add(key); save(); notify(key); return true;
        }
        if (key === "translateTarget") {
            if (!TRANSLATE_TARGETS.includes(value)) return false;
            if (settings.translateTarget === value && status.storage !== "loading" && status.storage !== "waiting") return true;
            settings.translateTarget = value; dirty.add(key); save(); notify(key); translateChanged(); return true;
        }
        if (key === "noDeleteLimit") {
            const limit = deleteLimit(value);
            // Leaving the box without changing it no longer rewrites your settings.
            if (limit === settings.noDeleteLimit && status.storage !== "loading" && status.storage !== "waiting") return true;
            settings.noDeleteLimit = limit; dirty.add(key); trimDeleted(); save(); notify(key); return true;
        }
        if (settings[key] === !!value && status.storage !== "loading" && status.storage !== "waiting") return true;
        value = !!value;
        if (key === "reviewDB" && !value) { reviewAuthAttempt++; reviewCache.clear(); }
        if (key === "voice" && !value) activeJobs.forEach(job => {
            job.cancelled = true;
            nativeVoice("cancel", job.id).catch(() => {});
        });
        // Switching NoDelete off hides kept messages but must not erase the saved archive:
        // it used to write an empty file, so turning it back on lost every saved message.
        if (key === "noDelete" && !value) { clearDeleted(true, settings.noDeleteSave); archiveRestored = false; }
        if (key === "hiddenChannels") {hiddenViews.clear();}
        if (key === "gestures" && !value && features.gestures) gestureCancel();
        if ((key === "noDeleteEdits" || key === "noDelete") && !value && edits.size) { edits.clear(); persistDeleted(); }
        settings[key] = value;
        if (key === "noDeleteSave") { if (value) restoreDeleted(); else archiveRestored = false; persistDeleted(); }
        if (key === "noDelete" && value) restoreDeleted();
        dirty.add(key);
        if (key === "picker" && !value) {
            clearSizes();
        }
        if (features.quests && featureFor(key) === "quests") questsSettingChanged(key, value);
        if (key === "systemFont" && features.systemFont && status.storage !== "loading" && status.storage !== "waiting" && value !== fontInUse) later(() => askRestart("font"), 0);
        if (key === "systemEmoji" && features.systemEmoji && status.storage !== "loading" && status.storage !== "waiting" && value !== emojiInUse) later(() => askRestart("emoji"), 0);
        save();
        notify(key);
        if (features.translate && key === "translate" && value) translateRestore();
        if (features.translate && featureFor(key) === "translate") later(translateChanged, 0);
        return true;
    }
    function initFiles(module) {
        if (files) return;
        files = module;
        status.storage = "loading";
        // Size metadata does not depend on the preferences directory being available.
        drainSizes();
        let constants;
        try { constants = typeof files.getConstants === "function" ? files.getConstants() : files; }
        catch (_) { constants = {}; }
        const directory = constants && constants.DocumentsDirPath;
        if (typeof directory !== "string") { status.storage = "unavailable (session only)"; notify(); return; }
        const path = directory.replace(/\/$/, "") + "/" + PREFS;
        Promise.resolve().then(() => files.fileExists(path)).then(exists =>
            exists ? files.readFile(path, "utf8") : null
        ).then(text => {
            if (text) {
                const loaded = JSON.parse(text);
                if (!loaded || typeof loaded !== "object" || Array.isArray(loaded)) throw new Error("Invalid preferences");
                for (const key of Object.keys(settings))
                    if (!dirty.has(key) && typeof loaded[key] === typeof settings[key] && (key !== "readAllMode" || READ_ALL_MODES.includes(loaded[key])) &&
                        (key !== "gestureOwn" || GESTURE_OWN_MODES.includes(loaded[key])) &&
                        (key !== "translateTarget" || TRANSLATE_TARGETS.includes(loaded[key])))
                        settings[key] = key === "noDeleteLimit" ? deleteLimit(loaded[key]) : loaded[key];
                const auth = loaded.reviewAuth;
                // Restore a saved ReviewDB sign-in (a ReviewDB token, never the Discord token).
                if (features.reviewDB && !reviewToken && auth && typeof auth.token === "string" && auth.token.length <= 8192 &&
                    typeof auth.account === "string" && /^\d{17,20}$/.test(auth.account)) { reviewToken = auth.token; reviewAccount = auth.account; }
            }
            status.storage = "ready";
            fontInUse = settings.systemFont;
            emojiInUse = settings.systemEmoji;
            if (!enabled("picker")) clearSizes();
            // Persist edits made while the asynchronous restore was in flight.
            if (dirty.size) save();
            restoreDeleted();
            if (features.quests) { if (!enabled("quests")) questsStop(); else questsLoaded(); }
            // Saved translations are read as soon as Discord starts, so the first chat you open already has them.
            if (enabled("translate")) translateRestore();
            notify("*");
        }).catch(() => {
            // The native side reads the same file at launch and falls back to Discord's font and emojis when it
            // can't. Assuming the phone's emojis here drew React Native emojis one way and chat the other.
            status.storage = "read failed (defaults)"; fontInUse = false; emojiInUse = false;
            if (dirty.size) save(); notify("*");
        });
    }

    function formatSize(bytes) {
        if (!Number.isFinite(bytes) || bytes < 0) return "";
        if (bytes === 0) return "0 B";
        // Binary units, labelled the way Android and Discord show them. Promote a value that
        // would round to "1024 KB" (log rounding just below a boundary) to "1 MB".
        const units = ["B", "KB", "MB", "GB", "TB"];
        let unit = Math.max(0, Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1));
        let value = Number((bytes / Math.pow(1024, unit)).toFixed(unit ? 2 : 0));
        if (value >= 1024 && unit < units.length - 1) { unit++; value = Number((bytes / Math.pow(1024, unit)).toFixed(2)); }
        return value + " " + units[unit];
    }
    // Hermes's native eval configuration can lower loop-local const/let to var.
    // Give asynchronous callbacks an invocation scope, not a loop capture.
    function readSize(entry) {
        activeReads++;
        Promise.resolve().then(() => files.getSize(entry.uri)).then(value => {
            const bytes = typeof value === "number" || typeof value === "string" && value.trim() ? Number(value) : NaN;
            entry.value = Number.isSafeInteger(bytes) && bytes >= 0 ? bytes : null;
        }, () => { entry.value = null; }).then(() => {
            entry.expires = Date.now() + (entry.value === null ? 30000 : 300000);
            entry.done = true;
            entry.resolve(entry.value);
            activeReads--;
            drainSizes();
        });
    }
    function clearSizes() {
        sizeCache.clear();
        sizeQueue.splice(0).forEach(entry => entry.resolve(null));
    }
    function drainSizes() {
        if (!files || !enabled("picker")) return;
        while (activeReads < 4 && sizeQueue.length) readSize(sizeQueue.shift());
    }
    function getSize(uri) {
        if (!enabled("picker") || typeof uri !== "string" || !/^(content|file):\/\//.test(uri))
            return Promise.resolve(null);
        const existing = sizeCache.get(uri);
        if (existing && (!existing.done || existing.expires > Date.now())) {
            if (existing.done) { sizeCache.delete(uri); sizeCache.set(uri, existing); }
            return existing.promise;
        }
        if (existing) sizeCache.delete(uri);
        if (sizeCache.size >= 256) {
            let removable;
            for (const [key, cached] of sizeCache) if (cached.done) { removable = key; break; }
            if (removable === undefined) return Promise.resolve(null);
            sizeCache.delete(removable);
        }
        const entry = { uri, done: false };
        entry.promise = new Promise(resolve => { entry.resolve = resolve; });
        sizeCache.set(uri, entry);
        sizeQueue.push(entry);
        drainSizes();
        return entry.promise;
    }
    function el() { return React.createElement.apply(React,arguments); }
    function useSettings(key) {
        const [, update] = React.useState(0);
        React.useEffect(() => {
            const entry = {key, fn: () => update(n => n + 1)};
            listeners.add(entry);
            return () => listeners.delete(entry);
        }, [key]);
    }
    // A size already read and still fresh, without starting a read.
    function knownSize(uri) {
        const entry = typeof uri === "string" && sizeCache.get(uri);
        return entry && entry.done && entry.expires > Date.now() ? entry.value : null;
    }
    // One style object for every badge, not two per photo tile per render.
    const BADGE_STYLE = { position: "absolute", top: 3, left: 3, borderRadius: 4, backgroundColor: "#17181ccc", paddingHorizontal: 4, paddingVertical: 2 };
    const BADGE_TEXT = { color: "white", fontSize: 10, fontWeight: "700", includeFontPadding: false };
    const PICKER_WRAP = { position: "relative" };
    function SizeBadge(props) {
        useSettings("picker");
        // The picker recycles tiles while scrolling: a size it already knows shows straight away, with no blank first frame.
        const [state, update] = React.useState(() => ({uri:props.uri, bytes:knownSize(props.uri)}));
        const bytes = state && state.uri === props.uri ? state.bytes : knownSize(props.uri);
        React.useEffect(() => {
            let live = true;
            const uri = props.uri;
            if (enabled("picker")) getSize(uri).then(value => { if (live) update(old => old && old.uri === uri && old.bytes === value ? old : {uri, bytes:value}); });
            return () => { live = false; };
        }, [props.uri, settings.picker]);
        if (!enabled("picker") || bytes === null || !RN) return null;
        return el(RN.View, { pointerEvents: "none", style: BADGE_STYLE }, el(RN.Text, { style: BADGE_TEXT }, formatSize(bytes)));
    }
    function pickerProps(props) {
        if (!enabled("picker") || !React || !RN || !props) return props;
        const first = Array.isArray(props.children) ? props.children[0] : props.children;
        const uri = first && first.props && first.props.localImageSource && first.props.localImageSource.uri;
        if (typeof uri !== "string") return props;
        return Object.assign({}, props, { children: el(RN.View, {
            style: PICKER_WRAP, pointerEvents: "box-none"
        }, props.children, el(SizeBadge, { uri })) });
    }
    function pickerComponent(component) {
        if (!component || wrapped.has(component)) return wrapped.get(component) || component;
        if (typeof component === "function" && (component.displayName || component.name) === "Pressable") {
            const orig = component;
            const result = function () {
                const args = Array.from(arguments);
                args[0] = pickerProps(args[0]);
                return orig.apply(this, args);
            };
            result.displayName = "Pressable";
            wrapped.set(component, result);
            status.picker = true;
            return result;
        }
        if (typeof component === "object") {
            for (const key of ["type", "render"]) {
                const orig = data(component, key);
                if (!orig) continue;
                const patched = pickerComponent(orig);
                if (patched !== orig) {
                    const result = cloneWith(component, key, patched);
                    wrapped.set(component, result);
                    return result;
                }
            }
        }
        return component;
    }

    function nativeVoice(action, id, uri) {
        if (!files) return Promise.reject(new Error("Discord file bridge has not loaded"));
        return files.getSize("venus-voice-v1:" + JSON.stringify({ action, id, uri }));
    }
    // Decoded byte count of a validated base64 string; Discord accepts at most 256 waveform levels.
    function waveformLength(text) { return text.length / 4 * 3 - (text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0); }
    const audioName = /\.(mp3|mp2|mpga|m4a|m4b|aac|wav|wave|flac|ogg|oga|opus|amr|awb|3ga|3gp|3gpp|aif|aiff|aifc|wma|ac3|eac3|caf|weba|alac)$/i;
    // Audio-only extensions: some providers label these voice notes video/mp4, video/3gpp or video/webm.
    const audioOnlyName = /\.(mp3|m4a|m4b|aac|wav|flac|oga|opus|amr|awb|3ga|weba|aif|aiff|aifc|caf)$/i;
    const AUDIO_APPLICATION_TYPES = new Set(["application/ogg","application/x-ogg","application/x-flac","application/x-wav","application/x-opus"]);
    function isAudio(upload) {
        if (!upload || upload.spoiler) return false;
        const item = upload.item || {};
        const mime = String(upload.mimeType || item.mimeType || "").toLowerCase().split(";")[0].trim();
        const name = String(upload.filename || item.filename || "");
        if (mime.startsWith("audio/") || AUDIO_APPLICATION_TYPES.has(mime)) return true;
        if (mime.startsWith("video/")) return audioOnlyName.test(name);
        if (mime && mime !== "application/octet-stream" && mime !== "binary/octet-stream") return false;
        return audioName.test(name);
    }
    function prepareUpload(orig, upload, args) {
        if (!enabled("voice") || !isAudio(upload)) return orig.apply(upload, args);
        const old = conversions.get(upload);
        if (old) return old.promise;
        const item = upload.item || {};
        const uri = item.uri || upload.uri;
        if (typeof uri !== "string" || !/^(content|file):\/\//.test(uri)) return orig.apply(upload, args);
        const job = { id: Date.now().toString(36) + "-" + (++jobCounter), cancelled: false };
        activeJobs.set(upload, job);
        const promise = Promise.resolve().then(() => {
            if (job.cancelled || !enabled("voice") || typeof upload.isCancelled === "function" && upload.isCancelled())
                throw new Error("Audio upload cancelled before conversion");
            return nativeVoice("prepare", job.id, uri);
        }).then(text => {
            const result = JSON.parse(text);
            if (!result || typeof result.uri !== "string" || !result.uri.startsWith("file://") ||
                result.mimeType !== "audio/ogg" || !Number.isFinite(result.durationSecs) || !(result.durationSecs > 0) || result.durationSecs > 1200 ||
                !Number.isSafeInteger(result.size) || !(result.size > 0) || typeof result.waveform !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(result.waveform) || !result.waveform || waveformLength(result.waveform) > 256)
                throw new Error("Native audio conversion returned invalid metadata");
            if (job.cancelled || !enabled("voice") || (typeof upload.isCancelled === "function" && upload.isCancelled())) {
                nativeVoice("release", job.id).catch(() => {});
                if (typeof upload.isCancelled === "function" && upload.isCancelled()) throw new Error("Audio upload cancelled");
                return orig.apply(upload, args);
            }
            // This async pre-upload boundary is awaited by CloudUpload.upload in the inspected build.
            // Both native upload paths consume item.uri; no Blob/base64 full-file buffering in JS.
            upload.item = Object.assign({}, item, result);
            upload.uri = result.uri;
            upload.mimeType = result.mimeType;
            upload.filename = result.filename;
            upload.currentSize = result.size;
            upload.durationSecs = result.durationSecs;
            upload.waveform = result.waveform;
            upload.reactNativeFilePrepped = true;
            readyUploads.set(upload, result);
            status.audioError = "";
            notify();
            return upload;
        }).catch(error => {
            if (typeof upload.isCancelled === "function" && upload.isCancelled()) throw error;
            // Unsupported codecs/devices remain ordinary orig attachments, never spoofed voice files.
            status.audioError = String(error && error.message || error);
            notify();
            if (!job.cancelled && RN && RN.Alert) RN.Alert.alert("Couldn't make a voice message",
                status.audioError + "\n\nIt will be sent as a normal file instead.");
            return orig.apply(upload, args);
        }).finally(() => { activeJobs.delete(upload); });
        job.promise = promise;
        conversions.set(upload, job);
        return promise;
    }
    function instrumentCloudUpload(CloudUpload) {
        if (!features.voice || typeof CloudUpload !== "function" || !CloudUpload.prototype) return;
        const prototype = CloudUpload.prototype;
        const orig = prototype.reactNativeCompressAndExtractData;
        if (typeof orig !== "function" || wrapped.has(orig)) return;
        const patched = function () { return prepareUpload(orig, this, arguments); };
        prototype.reactNativeCompressAndExtractData = patched;
        wrapped.set(orig, patched);
        wrapped.set(patched, patched);
        // One function scope per method: Hermes's native eval can lower loop-local const to var (see readSize),
        // and then both wrappers called the last method, so cancelling an upload deleted it instead.
        function stopFirst(key) {
            const method = prototype[key];
            if (typeof method !== "function") return;
            prototype[key] = function () {
                const job = conversions.get(this);
                if (job) {
                    job.cancelled = true;
                    nativeVoice("cancel", job.id).catch(() => {});
                }
                return method.apply(this, arguments);
            };
        }
        stopFirst("cancel"); stopFirst("delete");
        status.conversion = true;
    }
    function attachmentPayload(orig, self, args) {
        const result = orig.apply(self, args);
        const metadata = readyUploads.get(args[0]);
        if (!enabled("voice") || !metadata || !result || typeof result !== "object") return result;
        const payload = Object.assign({}, result, { duration_secs: metadata.durationSecs, waveform: metadata.waveform });
        // These fields are real, but still belong only to custom voice conversion when the flag is off.
        const marker = { duration: true, waveform: true };
        markedPayloads.set(payload, marker);
        if (typeof payload.uploaded_filename === "string") {
            if (pendingVoice.size >= 128) pendingVoice.delete(pendingVoice.keys().next().value);
            pendingVoice.set(payload.uploaded_filename, marker);
        }
        return payload;
    }
    function postRequest(orig, self, args) {
        const request = args[0];
        // Fast path for all other API traffic; no fetch/XMLHttpRequest interception.
        if (!request || typeof request.url !== "string" || !/^\/channels\/\d+\/messages$/.test(request.url))
            return orig.apply(self, args);
        const body = request.body;
        if (!body || !Array.isArray(body.attachments) || ((Number(body.flags) || 0) & 8192))
            return orig.apply(self, args);
        const markers = body.attachments.map(attachment => attachment &&
            (markedPayloads.get(attachment) || pendingVoice.get(attachment.uploaded_filename)));
        if (!markers.some(Boolean)) return orig.apply(self, args);
        const eligible = enabled("voice") && body.attachments.length === 1 && markers[0] &&
            !body.content && !(body.sticker_ids && body.sticker_ids.length) &&
            !(body.embeds && body.embeds.length) && !body.poll;
        const nextBody = Object.assign({}, body);
        if (eligible) nextBody.flags = ((Number(body.flags) || 0) | 8192) >>> 0;
        else nextBody.attachments = body.attachments.map((attachment, index) => {
            if (!markers[index]) return attachment;
            const clean = Object.assign({}, attachment);
            if (markers[index].duration) delete clean.duration_secs;
            if (markers[index].waveform) delete clean.waveform;
            return clean;
        });
        const nextArgs = Array.from(args);
        nextArgs[0] = Object.assign({}, request, { body: nextBody });
        return orig.apply(self, nextArgs);
    }

    // Native setting nodes use Discord's own themed rows, navigation and back stack.
    let SettingsList;
    const featureFor = key => key === "reviewWarning" ? "reviewDB" : key === "emojis" || key === "stickers" || key === "hyperlinks" ? "freeNitro" : key === "noDeleteSave" || key === "noDeleteLimit" || key === "noDeleteEdits" ? "noDelete" : /^pi[A-Z]/.test(key) ? "platformIndicators" : key === "pastelAll" || key === "pastelContent" ? "pastelize" : key === "readAllMode" ? "readAll" : /^quests[A-Z]/.test(key) ? "quests" : /^gesture[A-Z]/.test(key) ? "gestures" : /^translate[A-Z]/.test(key) ? "translate" : key;
    function section(label, keys) { return { label, settings: keys }; }
    // Plain-language status for General -> About; the raw values stay in status for diagnostics.
    function aboutText() {
        const storage = status.storage;
        const lines = [storage === "ready" || storage === "saved" ? "Your settings are saved on this phone." :
            storage === "waiting" || storage === "loading" ? "Loading your settings..." :
            /^read failed/.test(storage) ? "Your saved settings couldn't be read, so the defaults are in use." :
            "Your settings can't be saved right now. Changes last until Discord restarts."];
        const archive = {"saved locally":"Kept deleted messages are saved on this phone.", "save failed":"Kept deleted messages couldn't be saved.",
            "restore failed":"Saved deleted messages couldn't be loaded."}[status.archive];
        if (archive) lines.push(archive);
        if (status.audioError) lines.push("Last problem: " + status.audioError);
        return lines.join("\n");
    }
    // Discord's own icon for each feature row, from its design system. Resolved when a row first draws, never
    // while Discord builds its settings, and the Account icon stands in if one ever goes missing.
    const FEATURE_ICONS = {noDelete:[4791, "TrashIcon"], translate:[14958, "LanguageIcon"], gestures:[8216, "ReactionIcon"],
        quickDelete:[6026, "CircleXIcon"], jumpToTop:[10827, "ArrowLargeUpIcon"], favouriteAnything:[9716, "StarIcon"],
        freeNitro:[8119, "NitroWheelIcon"], voice:[12236, "WaveformIcon"], splitMessages:[7340, "PaperIcon"], noTyping:[10813, "KeyboardIcon"],
        picker:[10140, "AttachmentIcon"], pastelize:[14795, "PaintPaletteIcon"], platformIndicators:[14470, "LaptopPhoneIcon"],
        validUser:[5405, "AtIcon"], copyBios:[4780, "CopyIcon"], reviewDB:[7358, "ThumbsUpIcon"], readAll:[15161, "DoubleCheckmarkIcon"],
        hiddenChannels:[5410, "LockIcon"], dashless:[15125, "HashmarkIcon"], systemFont:[15207, "LettersIcon"], systemEmoji:[8719, "ChatSmileIcon"],
        hideGift:[10528, "GiftIcon"], hideCall:[7309, "PhoneCallIcon"], youBarSettings:[6799, "SettingsIcon"], quests:[14519, "QuestsIcon"],
        hideQuestDock:[6384, "EyeSlashIcon"]};
    const venusIcons = new Map();
    function venusIcon(id, name, fallback) {
        const slot = id + ":" + name;
        if (venusIcons.has(slot)) return venusIcons.get(slot);
        let found;
        function VenusIcon(props) {
            const Icon = found || (found = inspectedExport(id, name)) || fallback;
            return Icon ? el(Icon, props) : null;
        }
        venusIcons.set(slot, VenusIcon);
        return VenusIcon;
    }
    const REPO = "https://github.com/VenusIsJaded/Venus-Patches";
    function openLink(url) {
        try { if (RN && RN.Linking && typeof RN.Linking.openURL === "function") RN.Linking.openURL(url).catch(() => {}); } catch (_) {}
    }
    // "5 of 26 features on": main switches only, and only the features that were patched in.
    function featureSummary() {
        const keys = Object.keys(FEATURE_ICONS).filter(key => features[key]);
        const on = keys.filter(key => settings[key]).length;
        return keys.length ? on + " of " + keys.length + " features on. Turn them on or off in Features." : "No features were patched in.";
    }
    function settingsPage(sections) {
        const node = { type: "list", sections };
        return function VenusSettingsPage() {
            return React && SettingsList ? el(SettingsList, { node }) : null;
        };
    }
    function settingNode(key, title, description, parent) {
        const node = { type: "toggle", parent, useTitle: () => title,
            useValue: function () { useSettings(key); return settings[key]; },
            onValueChange: value => setSetting(key, value) };
        // No description, no empty second line under the title.
        if (description) node.useDescription = () => description;
        return node;
    }
    // Force system font applies from the next start: React Native measures text once but re-reads the
    // font on every draw, so switching mid-session would draw the new font in space sized for the old one.
    // Force system emojis is the same: Discord's native chat draws each emoji once and keeps it.
    // Each one reopens Discord through its own native method, so no method carries two Venus guards.
    function askRestart(kind) {
        const font = kind === "font";
        if (!features[font ? "systemFont" : "systemEmoji"] || !RN || !RN.Alert) return;
        const on = settings[font ? "systemFont" : "systemEmoji"];
        RN.Alert.alert(font ? (on ? "Use your phone's font" : "Use Discord's font") : (on ? "Use your phone's emojis" : "Use Discord's emojis"),
            "Discord needs to reopen to change the " + (font ? "font" : "emojis") + " everywhere.", [
            {text:"Later", style:"cancel"},
            {text:"Reopen now", onPress:() => {
                // Write the setting first, so the reopened Discord starts with it. If it can't be saved, Discord used to
                // reopen anyway with the old setting; now it stays open and says so.
                if (!files) return;
                Promise.resolve().then(() => files.writeFile("documents", PREFS, settingsSnapshot(), "utf8")).then(
                    () => Promise.resolve(font ? files.fileExists("venus-font-v1:restart") : files.getVideoDimensions("venus-emoji-v1:restart")).catch(() => {}),
                    () => { status.storage = "save failed (session only)"; notify();
                        try { RN.Alert.alert("Couldn't save the setting", "Discord didn't reopen, so nothing changed. Try again in a moment."); } catch (_) {} });
            }}]);
    }
    // A main-list row with its own switch and a separate button that opens more options.
    // Discord's pressable rows render an element from useTrailing; tapping the row also opens the page.
    let rowStyles = null;
    function subpageStyles() {
        if (rowStyles) return rowStyles;
        const ui = reviewUI(), c = ui.colors;
        let hook = null;
        if (typeof ui.createStyles === "function" && c) try {
            hook = ui.createStyles({divider:{width:1, height:24, marginHorizontal:12, backgroundColor:c.BORDER_SUBTLE},
                button:{width:36, height:36, borderRadius:18, alignItems:"center", justifyContent:"center", backgroundColor:c.BACKGROUND_MOD_SUBTLE}});
        } catch (_) { hook = null; }
        rowStyles = hook || (() => ({divider:{width:1, height:24, marginHorizontal:12, backgroundColor:"#ffffff1f"},
            button:{width:36, height:36, borderRadius:18, alignItems:"center", justifyContent:"center", backgroundColor:"#ffffff14"}}));
        return rowStyles;
    }
    let stackNavigation, trailingSwitch, trailingChevron;
    function SubpageTrailing(props) {
        useSettings(props.setting);
        // Discord's own themed colors; the icon takes its themed default color itself.
        let styles; try { styles = subpageStyles()(); } catch (_) { styles = null; }
        styles = styles || {divider:{}, button:{}};
        // Kept once found; a missing one is looked up again next render, in case its module loads later.
        const FormSwitch = trailingSwitch || (trailingSwitch = inspectedExport(6622, "FormSwitch"));
        const Chevron = trailingChevron || (trailingChevron = inspectedExport(6631, "ChevronSmallRightIcon"));
        const Press = RN.Pressable || RN.TouchableOpacity || RN.View;
        const on = !!settings[props.setting];
        return el(RN.View, {style:{flexDirection:"row", alignItems:"center"}},
            FormSwitch ? el(FormSwitch, {value:on, accessibilityLabel:props.label, onValueChange:value => setSetting(props.setting, value)}) : null,
            el(RN.View, {style:styles.divider}),
            el(Press, {style:styles.button, onPress:props.open, accessibilityRole:"button", accessibilityLabel:"More options",
                hitSlop:{top:6, bottom:6, left:6, right:6}},
                Chevron ? el(Chevron, {size:"sm"}) : el(RN.Text, {style:{fontSize:18, color:"#b5bac1"}}, "\u203A")));
    }
    function nativeRegistry(registry) {
        if (!registry || !registry.ACCOUNT || registry.VENUS_GENERAL) return registry;
        const next = Object.assign({}, registry);
        const icon = registry.ACCOUNT.IconComponent;
        function route(key, title, sections, parent, IconComponent) {
            const page = settingsPage(sections);
            next[key] = { type: "route", parent, useTitle: () => title, IconComponent: IconComponent || icon,
                screen: { route: key, getComponent: () => page } };
        }
        // About: the version and how many features are on, whether settings are saved, and where to get help.
        next.VENUS_VERSION = { type: "static", parent: "VENUS_GENERAL", IconComponent: venusIcon(16292, "SparklesIcon", icon),
            useTitle: () => "Venus Patches " + revision, useDescription: function () { useSettings(); return featureSummary(); } };
        next.VENUS_STATUS = { type: "static", parent: "VENUS_GENERAL", IconComponent: venusIcon(4788, "CircleInformationIcon", icon),
            useTitle: () => "Status", useDescription: function () { useSettings(); return aboutText(); } };
        const links = [];
        function link(id, title, hint, url, iconId, iconName) {
            links.push(id);
            next[id] = { type: "pressable", parent: "VENUS_GENERAL", unsearchable: true, withArrow: true, useTitle: () => title,
                useDescription: () => hint, onPress: () => openLink(url), IconComponent: venusIcon(iconId, iconName, icon) };
        }
        link("VENUS_LINK_CHANGES", "What's new", "Changes in each release.", REPO + "/blob/main/CHANGELOG.md", 16292, "SparklesIcon");
        link("VENUS_LINK_ISSUES", "Report a problem", "Opens a new issue on GitHub.", REPO + "/issues/new/choose", 15329, "BugIcon");
        link("VENUS_LINK_SOURCE", "Source code", "Venus Patches on GitHub. Free and open source (GPL-3.0).", REPO, 8041, "LinkExternalSmallIcon");
        route("VENUS_GENERAL", "About", [section("Venus Patches", ["VENUS_VERSION", "VENUS_STATUS"]), section("Links", links)], undefined,
            venusIcon(4788, "CircleInformationIcon", icon));
        // The features list: each row says what it does, grouped by where you'll notice it.
        const P = "VENUS_PLUGINS";
        const groups = {messages:[], sending:[], people:[], servers:[], appearance:[], quests:[]};
        const iconFor = key => { const found = FEATURE_ICONS[key]; return found ? venusIcon(found[0], found[1], icon) : icon; };
        function toggle(group, key, title, hint) {
            if (!features[key]) return;
            const id = "VENUS_" + key.toUpperCase(); groups[group].push(id);
            next[id] = settingNode(key, title, hint, P);
            next[id].IconComponent = iconFor(key);
        }
        // A switch plus a button to its own page. Tapping the row opens the page too; the page keeps
        // a short title in Discord's header, read from its route node like any Discord settings page.
        const navigators = new Map();
        function withOptions(group, key, id, title, hint, pageTitle, page) {
            if (!features[key]) return;
            // Option pages are built only for patched settings, so unpatched ones leave no nodes behind.
            if (typeof page === "function" && !page.prototype) page = page();
            if (Array.isArray(page)) route(id, pageTitle, page, P, iconFor(key));
            else { route(id, pageTitle, [], P, iconFor(key)); next[id].screen.getComponent = () => page; }
            const screen = next[id].screen, rowId = id + "_ROW";
            const open = () => {
                const navigation = navigators.get(rowId);
                if (!navigation) return;
                try { global.__r(14239).onRouteSettingOnPress({navigation, screen}); }
                catch (_) { try { navigation.navigate(screen.route); } catch (__) {} }
            };
            groups[group].push(rowId);
            next[rowId] = { type: "pressable", parent: P, unsearchable: true, useTitle: () => title, onPress: open, IconComponent: iconFor(key),
                useTrailing: function () {
                    // Called as a hook by Discord's row, so it can read the settings stack it's in.
                    // Resolved once, so the row always calls the same number of hooks.
                    if (stackNavigation === undefined) stackNavigation = inspectedExport(1491, "useStackNavigation") || null;
                    navigators.set(rowId, stackNavigation ? stackNavigation() : null);
                    return el(SubpageTrailing, {setting:key, label:title, open});
                } };
            if (hint) next[rowId].useDescription = () => hint;
        }
        // Option IDs are the ones earlier releases used, so nothing that points at them moves.
        const OPTION_IDS = {emojis:"VENUS_EMOJIS", stickers:"VENUS_STICKERS", hyperlinks:"VENUS_HYPERLINKS", pastelAll:"VENUS_PASTELALL", pastelContent:"VENUS_PASTELCONTENT", piDmHeader:"VENUS_PI_DM", piUserList:"VENUS_PI_LIST", piProfile:"VENUS_PI_PROFILE", piHideMobile:"VENUS_PI_MOBILE"};
        const option = (key, title, hint, parent) => {
            const id = OPTION_IDS[key], owner = featureFor(key), node = settingNode(key, title, hint, parent);
            // Greyed out while the main switch on the features list is off.
            node.useIsDisabled = function () { useSettings(owner); return !settings[owner]; };
            next[id] = node; return id;
        };
        // Messages
        withOptions("messages", "noDelete", "VENUS_NODELETE", "Keep deleted messages", "Deleted messages stay in chat, outlined in red. Also shows what edited messages said before.", "Deleted messages", NoDeleteSettings);
        withOptions("messages", "translate", "VENUS_TRANSLATE", "Translate messages", "Messages in other languages show in yours. Their text is sent to Google Translate.", "Translate messages", TranslateSettings);
        withOptions("messages", "gestures", "VENUS_GESTURES", "Double-tap to reply", "Double-tap a message to reply, or your own to edit it, instead of reacting.", "Tap gestures", GestureSettings);
        toggle("messages", "quickDelete", "Skip delete confirmation", "Messages and link previews are removed right away, with no \"Are you sure?\". It can't be undone.");
        toggle("messages", "jumpToTop", "Jump to first message", "A button to go straight to the start of a chat, channel or thread.");
        toggle("messages", "favouriteAnything", "Favourite any image or video", "Star any image or video in the media viewer to keep it in your GIF favourites.");
        // Sending
        withOptions("sending", "freeNitro", "VENUS_FREENITRO", "Send Nitro stickers and emojis as links", "Stickers and emojis you'd need Nitro for are sent as a link, which shows up in chat as the sticker or emoji image.", "Nitro stickers and emojis",
            () => [section("Send as links", [option("emojis", "Emojis", "Emojis from other servers, and animated emojis.", "VENUS_FREENITRO"),
                option("stickers", "Stickers", "Stickers from other servers. Animated ones may not move.", "VENUS_FREENITRO")]),
             section("Link style", [option("hyperlinks", "Short links", "The link shows as the emoji or sticker's name instead of a long web address.", "VENUS_FREENITRO")])]);
        toggle("sending", "voice", "Send audio as voice messages", "An audio file sent on its own becomes a real voice message, with a waveform. Needs Android 10 or newer.");
        toggle("sending", "splitMessages", "Send long messages", "Type past the character limit. Long messages are sent in parts, split between lines or words.");
        toggle("sending", "noTyping", "Hide typing indicator", "Others won't see when you're typing. You still see when they are.");
        toggle("sending", "picker", "Show file sizes when attaching", "Each photo and video in the attachment picker shows its size.");
        // People
        withOptions("people", "pastelize", "VENUS_PASTELIZE", "Pastel name colors", "Names without a role color get a soft pastel color, always the same for each person.", "Pastel names",
            () => [section("Colors", [option("pastelAll", "Replace role colors", "Every name uses its pastel color, even with a role color.", "VENUS_PASTELIZE"),
                option("pastelContent", "Color message text", "What people write is colored too, in a lighter shade of their name.", "VENUS_PASTELIZE")])]);
        withOptions("people", "platformIndicators", "VENUS_PLATFORMINDICATORS", "Show device indicators", "Desktop, mobile, web, console or VR icons next to names, colored by status.", "Device indicators",
            () => [section("Show icons", [option("piDmHeader", "In DMs", "Next to the name at the top of a DM.", "VENUS_PLATFORMINDICATORS"),
                option("piUserList", "In lists", "Member list, friends, DM list and voice channels.", "VENUS_PLATFORMINDICATORS"),
                option("piProfile", "On profiles", "Next to the name on a profile.", "VENUS_PLATFORMINDICATORS")]),
             section("Avatars", [option("piHideMobile", "Hide the phone badge", "Avatars show a plain status dot, since the icons already show mobile.", "VENUS_PLATFORMINDICATORS")])]);
        toggle("people", "validUser", "Fix unknown mentions", "@unknown-user mentions are looked up and show the person's name.");
        toggle("people", "copyBios", "Copy profile bios", "Hold a bio to select and copy its text. Links still work.");
        withOptions("people", "reviewDB", "VENUS_REVIEWDB", "User and server reviews", "Read and write reviews on profiles and servers, from the community ReviewDB service.", "Reviews", ReviewSettings);
        // Servers
        withOptions("servers", "readAll", "VENUS_READALL", "Read all button", "A button under Direct Messages that marks everything as read. Hold it to choose what.", "Read all", ReadAllSettings);
        toggle("servers", "hiddenChannels", "Show hidden channels", "Channels you can't open appear with a lock. Only their name and dates show, not messages.");
        toggle("servers", "dashless", "Spaces in channel names", "Shows \"general chat\" instead of \"general-chat\". Only changes how names look.");
        // Appearance
        toggle("appearance", "systemFont", "Use your phone's font", "Replaces Discord's font everywhere. Discord reopens to apply it. Needs Android 9 or newer.");
        toggle("appearance", "systemEmoji", "Use your phone's emojis", "In chat, reactions and the emoji picker. Discord reopens to apply it.");
        toggle("appearance", "hideGift", "Hide the gift button", "Removes the Nitro gift button from the message bar.");
        toggle("appearance", "hideCall", "Hide the call button", "Removes Call from people's profiles. Message fills the space.");
        toggle("appearance", "youBarSettings", "Venus button on profile bar", "A shortcut to Venus, next to the notifications bell.");
        // Quests
        withOptions("quests", "quests", "VENUS_QUESTS", "Complete Quests automatically", "Finishes video, Play and Activity Quests in the background. You still claim the rewards.", "Quests", QuestSettings);
        toggle("quests", "hideQuestDock", "Hide the Quests banner", "Removes the Quest promotion above your profile bar. Quests still work.");
        const sections = [section("Messages", groups.messages), section("Sending", groups.sending), section("People", groups.people),
            section("Servers", groups.servers), section("Appearance", groups.appearance), section("Quests", groups.quests)].filter(entry => entry.settings.length);
        route(P, "Features", sections, undefined, venusIcon(14478, "PuzzlePieceIcon", icon));
        status.menu = true;
        return next;
    }
    function settingsSections(orig, self, args) {
        const config = args[0];
        if (!status.menu || !config || !Array.isArray(config.sections)) return orig.apply(self, args);
        const index = config.sections.findIndex(s => s && Array.isArray(s.settings) && s.settings.includes("ACCOUNT"));
        if (index < 0 || config.sections.some(s => s && s.label === "Venus")) return orig.apply(self, args);
        const sections = config.sections.slice();
        sections.splice(index + 1, 0, section("Venus", ["VENUS_PLUGINS", "VENUS_GENERAL"]));
        const next = Array.from(args); next[0] = Object.assign({}, config, { sections });
        return orig.apply(self, next);
    }

    function cloneTree(node, change, depth) {
        if (!node || typeof node !== "object" || depth > 24) return node;
        if (Array.isArray(node)) {
            let children = node;
            for (let i = 0; i < node.length; i++) {
                const child = cloneTree(node[i], change, depth + 1);
                if (child !== node[i]) {
                    if (children === node) children = node.slice();
                    children[i] = child;
                }
            }
            return children;
        }
        if (!node.props) return node;
        const children = cloneTree(node.props.children, change, depth + 1);
        let props = children !== node.props.children ? Object.assign({}, node.props, { children }) : node.props;
        props = change(node, props);
        return props === node.props ? node : React.cloneElement(node, props);
    }
    function copyBio(orig, self, args) {
        const result = orig.apply(self, args);
        if (!enabled("copyBios") || !React || !RN) return result;
        return cloneTree(result, function (node, props) {
            // Preserve clickable links and handlers, never mutate React's frozen elements.
            if (node !== result && node.type !== RN.Text && typeof props.children !== "string") return props;
            return props.selectable === true ? props : Object.assign({}, props, { selectable: true });
        }, 0);
    }
    const DASHLESS_TYPES = new Set([0, 5, 15, 16]);
    function channelLabel(orig, self, args) {
        const channel=args[0];
        let next=args;
        if (hiddenMetadata(channel)) {
            // Formatter-only facade avoids Discord's OBFUSCATED label branch while
            // preserving its escaping, category casing and the real model/flags.
            next=Array.from(args);
            next[0]=cloneWith(cloneWith(channel,"name",hiddenName(channel)),"isObfuscated",()=>false);
        }
        const name=orig.apply(self,next);
        return enabled("dashless") && channel && DASHLESS_TYPES.has(channel.type) && typeof name === "string" ? name.replace(/-/g, " ") : name;
    }
    const videoPattern = /\.(mp4|webm|mov|avi|mkv|flv|wmv|m4v|gifv)(?:[?#]|$)/i;
    const video = uri => typeof uri === "string" && videoPattern.test(uri);
    function thumbnail(uri) {
        if (typeof uri !== "string" || !/^https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net|images-ext-\d+\.discordapp\.net)\//i.test(uri)) return uri;
        let result = uri.replace(/^https:\/\/cdn\.discordapp\.com\//i, "https://media.discordapp.net/");
        const hash = result.indexOf("#"), suffix = hash < 0 ? "" : result.slice(hash);
        if (hash >= 0) result = result.slice(0, hash);
        result = /[?&]format=/.test(result) ? result.replace(/([?&])format=[^&]*/g, "$1format=jpeg") : result + (result.includes("?") ? "&" : "?") + "format=jpeg";
        return result + suffix;
    }
    function favouriteButton(orig, self, args) {
        const props = args[0], source = props && props.source;
        if (!enabled("favouriteAnything") || !source || source.isGIFV || typeof source.uri !== "string" || !/^https?:\/\//i.test(source.uri)) return orig.apply(self, args);
        const next = Array.from(args);
        next[0] = Object.assign({}, props, { source: Object.assign({}, source, { isGIFV: true,
            embedURI: source.embedURI || source.sourceURI || source.uri, videoURI: source.videoURI || source.uri,
            embedProviderName: source.embedProviderName || "" }) });
        return orig.apply(self, next);
    }
    function favouriteAdd(orig, self, args) {
        const item = args[0];
        if (!enabled("favouriteAnything") || !item || typeof item !== "object") return orig.apply(self, args);
        const isVideo = video(item.url) || video(item.gifSrc);
        const isImage = typeof item.url === "string" && /\.(png|jpe?g|gif|webp|avif|heic|heif)(?:[?#]|$)/i.test(item.url);
        // Preserve native formats for opaque provider URLs instead of misclassifying videos as images.
        if (!isVideo && !isImage) return orig.apply(self, args);
        const format = isVideo ? 2 : 1;
        if (item.format === format) return orig.apply(self, args);
        const next = Array.from(args); next[0] = Object.assign({}, item, { format });
        return orig.apply(self, next);
    }
    const favouriteViews = new WeakMap();
    function favouriteList(orig, self, args) {
        const result = orig.apply(self, args);
        if (!enabled("favouriteAnything") || !result || !Array.isArray(result.favorites)) return result;
        let favorites = favouriteViews.get(result.favorites);
        if (!favorites) {
            let changed = false;
            favorites = result.favorites.map(item => {
                if (!item || !video(item.url) && !video(item.gifSrc)) return item;
                const src = thumbnail(item.src || item.url);
                if (src === item.src) return item;
                changed = true; return Object.assign({}, item, { src });
            });
            if (!changed) favorites = result.favorites;
            favouriteViews.set(result.favorites, favorites);
        }
        if (favorites === result.favorites) return result;
        const category = result.favoritesCategory && favorites[0] ? Object.assign({}, result.favoritesCategory, { src: favorites[0].src }) : result.favoritesCategory;
        return Object.assign({}, result, { favorites, favoritesCategory: category });
    }

    let userStore, channelStore, emojiStore, stickerStore, stickerRules, emojiCatalog;
    const premiumOriginal = {};
    function currentUser() { return userStore && userStore.getCurrentUser(); }
    let nativeCapabilities = 0;
    function capability(key, user) {
        // The orig capability delegates to canUserUse. Conversion must see real
        // eligibility, not the picker override, or a non-Nitro send stays an invalid token.
        nativeCapabilities++;
        try { return typeof premiumOriginal[key] === "function" && premiumOriginal[key](user); }
        finally { nativeCapabilities--; }
    }
    function catalogEligibility(orig, self, args) {
        const user = currentUser(), feature = args[0];
        if (!nativeCapabilities && enabled("emojis") && user && args[1] && args[1].id === user.id &&
            (feature === emojiCatalog.EMOJIS_EVERYWHERE || feature === emojiCatalog.ANIMATED_EMOJIS)) return true;
        return orig.apply(self, args);
    }
    function premiumOverride(key, setting) {
        return function (orig, self, args) {
            const user = currentUser();
            return enabled(setting) && user && args[0] && args[0].id === user.id ? true : orig.apply(self, args);
        };
    }
    function shareLink(name, uri) {
        // Escape Markdown without permitting forged mentions or link syntax in sticker names.
        // ~ | # too: a sticker called ||surprise|| or ~~old~~ turned the link text into a spoiler or strikethrough.
        return settings.hyperlinks && name ? "[" + String(name).replace(/([\\\[\]()*_`<>@~|#])/g, "\\$1").replace(/[\r\n]/g, " ") + "](" + uri + ")" : uri;
    }
    function emojiMessage(message, channelId) {
        if (!enabled("emojis") || !message || typeof message.content !== "string" || !message.content.includes("<") || !emojiStore || !channelStore) return message;
        const user = currentUser(), channel = channelStore.getChannel(channelId);
        if (!user || !channel) return message;
        const everywhere = capability("canUseEmojisEverywhere", user), animated = capability("canUseAnimatedEmojis", user);
        const converted = new Set();
        // Do not rewrite code blocks, inline code, escaped tokens or Markdown link targets.
        const content = message.content.replace(/```[\s\S]*?(?:```|$)|``[^\n]*?(?:``|$)|`[^`\n]*(?:`|$)|\\[\s\S]|\]\([^\n)]*\)|<(a?):([\w]+):(\d+)>/g, function (match, animation, name, id) {
            if (!id) return match;
            const emoji = emojiStore.getCustomEmojiById(id);
            if (!emoji || emoji.available === false || !emoji.guildId) return match;
            if ((everywhere || emoji.guildId === channel.guild_id) && (!(animation || emoji.animated) || animated)) return match;
            converted.add(id);
            const uri = "https://cdn.discordapp.com/emojis/" + id + (animation || emoji.animated ? ".gif" : ".webp") + "?size=48&quality=lossless";
            return shareLink(name, uri);
        });
        if (!converted.size || content.length > (user.premiumType === 2 ? 4000 : 2000)) return message;
        const next = Object.assign({}, message, { content });
        // Keep unrelated invalid emoji diagnostics intact.
        for (const key of ["invalidEmojis", "validNonShortcutEmojis"]) if (Array.isArray(message[key]))
            next[key] = message[key].filter(item => !converted.has(typeof item === "string" ? item : item && item.id));
        return next;
    }
    function sendMessage(orig, self, args) {
        const message = emojiMessage(args[1], args[0]);
        if (message === args[1]) return orig.apply(self, args);
        const next = Array.from(args); next[1] = message;
        return orig.apply(self, next);
    }
    function stickerLink(sticker) {
        if (!sticker || sticker.available === false || !/^\d+$/.test(sticker.id)) return null;
        if (![1, 2, 4].includes(sticker.format_type)) return null; // No broken Lottie URLs or third-party conversion service.
        return shareLink(sticker.name, "https://media.discordapp.net/stickers/" + sticker.id + (sticker.format_type === 4 ? ".gif" : ".png") + "?size=160");
    }
    function nativeSticker(sticker, channel, user) {
        return sticker && sticker.available !== false &&
            (!sticker.guild_id || sticker.guild_id === channel.guild_id || capability("canUseCustomStickersEverywhere", user));
    }
    function sendStickers(orig, self, args) {
        if (!enabled("stickers") || !Array.isArray(args[1]) || !args[1].length || !stickerStore || !channelStore) return orig.apply(self, args);
        const user = currentUser(), channel = channelStore.getChannel(args[0]);
        if (!user || !channel) return orig.apply(self, args);
        const keep = [], links = [];
        for (const id of args[1]) {
            const sticker = stickerStore.getStickerById(id);
            if (!sticker) return orig.apply(self, args);
            if (nativeSticker(sticker, channel, user)) { keep.push(id); continue; }
            const link = stickerLink(sticker);
            // Fail closed as a whole: never drop an unknown/unsupported sticker from a mixed send.
            if (!link) return orig.apply(self, args);
            links.push(link);
        }
        if (!links.length) return orig.apply(self, args);
        const message = args[2], content = typeof message === "string" ? message : message && message.content || "";
        const combined = (content ? content + "\n" : "") + links.join("\n");
        if (combined.length > (user.premiumType === 2 ? 4000 : 2000)) return orig.apply(self, args);
        const next = Array.from(args); next[1] = keep;
        next[2] = emojiMessage(Object.assign({}, typeof message === "object" ? message : null, { content: combined }), args[0]);
        // Original sendStickers preserves replies, TTS, nonce, permissions and native stickers in one message.
        return orig.apply(self, next);
    }
    function sendability(orig, self, args) {
        const result = orig.apply(self, args), sticker = args[0];
        return enabled("stickers") && stickerRules && result === stickerRules.StickerSendability.SENDABLE_WITH_PREMIUM && stickerLink(sticker) ? stickerRules.StickerSendability.SENDABLE : result;
    }
    function sendableSticker(orig, self, args) {
        const result = orig.apply(self, args);
        if (result || !enabled("stickers") || !stickerRules) return result;
        const code = stickerRules.getStickerSendability.apply(stickerRules, args);
        return code === stickerRules.StickerSendability.SENDABLE;
    }
    let msgStore, msgActions, permissions, viewPermission, locale, dispatcher, messageRecords, chatHeight, jumpPill, jumpIcon;
    let permissionsCanOrig = null;
    let deletedRevision = 0, archiveRestored = false, archiveLoading = false, archiveWriting = false, archivePending;
    const deletedViews = new Map();
    const ARCHIVE = "venus-deleted-messages.json";
    const deleted = new Map(), deletedByChannel = new Map();
    // Edit history: "channel:id" -> {channelId, id, versions:[{content, at}]}, oldest version first.
    const edits = new Map();
    const MAX_EDITED = 2000, MAX_VERSIONS = 10, MAX_VERSION_TEXT = 4000;
    let archiveTimer;
    const hiddenViews = new Map(), hiddenNames = new Map(), hiddenScans = new Map();
    let hiddenAccount;
    function receivedName(channel) {
        if (!channel || typeof channel.name !== "string") return null;
        const trimmed = channel.name.trim();
        if (!trimmed) return null;
        // Server redactions: "hidden", "__hidden__", "_hidden" and underscore variants (HBC string 34016).
        // Strip surrounding underscores and compare case-insensitively so redacted stubs never pollute the cache.
        if (trimmed.replace(/^_+|_+$/g, "").toLowerCase() === "hidden") return null;
        // Never cache our own unavailable facades as if they were real names.
        if (trimmed === "Hidden channel (name unavailable)" || trimmed === "Hidden category (name unavailable)") return null;
        return channel.name;
    }
    // guildId: for gateway channel lists, whose entries don't carry their server. It used to copy every channel
    // of every server on READY just to add guild_id.
    function rememberChannelName(channel, accountId, knownName, guildId) {
        // Directory scans pass the account once; don't ask UserStore again for every channel.
        let owner = accountId;
        if (typeof owner !== "string") { const current = userStore && userStore.getCurrentUser(); owner = current && current.id; }
        if (hiddenAccount !== owner) {hiddenNames.clear();hiddenAccount = owner;}
        if (!channel) return;
        const guild = guildId || channel.guild_id;
        const name = knownName || receivedName(channel);
        if (!guild || !channel.id || !name) return;
        const known = hiddenNames.get(channel.id);
        // READY replays thousands of unchanged names: don't churn the cache for them.
        if (known && known.guild === guild && known.name === name) return;
        if (hiddenNames.size >= 4096 && !known) hiddenNames.delete(hiddenNames.keys().next().value);
        hiddenNames.set(channel.id,{guild,name});
    }
    function hiddenName(channel) {
        // Basic records can retain names absent from full/obfuscated records. Never
        // fetch an inaccessible channel, guess a name, or change its permissions/flags.
        const current = userStore && userStore.getCurrentUser();
        if (hiddenAccount !== (current && current.id)) {hiddenNames.clear();hiddenAccount = current && current.id;}
        const basic = channelStore && typeof channelStore.getBasicChannel === "function" && channelStore.getBasicChannel(channel.id);
        const full = channelStore && typeof channelStore.getChannel === "function" && channelStore.getChannel(channel.id);
        const name = receivedName(channel) || (basic && basic.guild_id === channel.guild_id && receivedName(basic)) ||
            (full && full.guild_id === channel.guild_id && receivedName(full));
        if (name) {rememberChannelName(channel,hiddenAccount,name);return name;}
        const cached = hiddenNames.get(channel.id);
        return cached && cached.guild === channel.guild_id ? cached.name : channel.type === 4 ? "Hidden category (name unavailable)" : "Hidden channel (name unavailable)";
    }
    const CHANNEL_EVENTS = new Set(["CHANNEL_CREATE","CHANNEL_UPDATE"]), GUILD_EVENTS = new Set(["GUILD_CREATE","GUILD_UPDATE"]);
    const READY_EVENTS = new Set(["CONNECTION_OPEN","CONNECTION_OPEN_SUPPLEMENTAL"]), BATCH_EVENTS = new Set(["CHANNEL_UPDATES","THREAD_LIST_SYNC"]);
    const MESSAGE_EVENTS = new Set(["MESSAGE_CREATE","MESSAGE_UPDATE"]), RESTORE_EVENTS = new Set(["CONNECTION_OPEN","CACHE_LOADED"]);
    // Every Flux event passes through here: leave typing, presence, voice and the rest alone.
    const HIDDEN_EVENTS = new Set(["LOGOUT","CHANNEL_DELETE","GUILD_DELETE",...CHANNEL_EVENTS,...GUILD_EVENTS,...READY_EVENTS,...BATCH_EVENTS,...MESSAGE_EVENTS]);
    function channelMetadataEvent(event) {
        if (!HIDDEN_EVENTS.has(event.type)) return;
        // Most messages mention no channels; skip the account lookup for them.
        if (MESSAGE_EVENTS.has(event.type)) {
            const msg = event.message || event;
            if (!msg || !Array.isArray(msg.mention_channels) || !msg.mention_channels.length) return;
        }
        const current = userStore && userStore.getCurrentUser();
        // This hook runs BEFORE UserStore handles READY. Scope its metadata to
        // the incoming user, otherwise the first post-READY lookup erases it.
        const owner = event.type === "CONNECTION_OPEN" && event.user && event.user.id || current && current.id;
        if (event.type === "LOGOUT" || hiddenAccount !== owner) {
            hiddenNames.clear();hiddenViews.clear();hiddenScans.clear();hiddenAccount = owner;
            try { hiddenConfirmed.clear(); hiddenPrompts.clear(); } catch (_) {}
        }
        if (event.type === "CHANNEL_DELETE") hiddenNames.delete(event.channel && event.channel.id || event.channelId || event.id);
        if (event.type === "GUILD_DELETE") {
            const guild = event.guild && event.guild.id || event.guildId;
            for (const [id,entry] of hiddenNames) if (entry.guild === guild) hiddenNames.delete(id);
        }
        if (!features.hiddenChannels) return;
        // Cache even while the toggle is off so enabling later still has READY names.
        if (CHANNEL_EVENTS.has(event.type)) rememberChannelName(event.channel,owner);
        function rememberGuild(guild) {
            if (!guild || !guild.id) return;
            for (const key of ["channels","threads"]) if (Array.isArray(guild[key]))
                guild[key].forEach(channel => rememberChannelName(channel,owner,undefined,channel && channel.guild_id || guild.id));
        }
        if (GUILD_EVENTS.has(event.type)) rememberGuild(event.guild);
        if (READY_EVENTS.has(event.type) && Array.isArray(event.guilds)) event.guilds.forEach(rememberGuild);
        if (BATCH_EVENTS.has(event.type)) {
            for (const key of ["channels","threads"]) if (Array.isArray(event[key]))
                event[key].forEach(channel => rememberChannelName(channel,owner,undefined,channel && channel.guild_id || event.guildId));
        }
        // Real unobfuscated names arrive inside message mention_channels (fn34524/fn35281):
        // harvest them so mentioned hidden channels resolve even when stores are redacted.
        if (MESSAGE_EVENTS.has(event.type)) {
            const msg = event.message || event;
            const mentions = msg && Array.isArray(msg.mention_channels) && msg.mention_channels;
            if (mentions) mentions.forEach(channel => rememberChannelName(channel, owner));
        }
    }
    function typing(orig, self, args) {
        return enabled("noTyping") ? undefined : orig.apply(self, args);
    }
    function quickConfirm(orig, self, args) {
        const popup = args[0];
        if (!popup || typeof popup.onConfirm !== "function" || !locale || !locale.intl || !locale.t)
            return orig.apply(self, args);
        const title = popup.children && popup.children.props && popup.children.props.title;
        const texts = [title, popup.body].filter(text => typeof text === "string");
        // Localized, exact confirmation strings. No generic 'delete' matching, and
        // no interception of leave-server, ban, channel or account confirmations.
        function matches(key) {
            const token = locale.t[key];
            const label = token && locale.intl.string(token);
            return typeof label === "string" && label.length > 3 && texts.some(text => text === label);
        }
        if (enabled("quickDelete") && (matches("AMvpS4") || matches("vXZ+Fo")))
            return popup.onConfirm();
        return orig.apply(self, args);
    }
    function deletedKey(channelId, id) { return channelId + ":" + id; }
    function invalidateDeleted() { deletedRevision++; deletedViews.clear(); }
    function keepDeleted(key, entry) {
        deleted.set(key, entry);
        let bucket = deletedByChannel.get(entry.channelId);
        if (!bucket) deletedByChannel.set(entry.channelId, bucket = new Map());
        bucket.set(key, entry);
    }
    function dropDeleted(key) {
        const entry = deleted.get(key);
        if (!entry) return null;
        deleted.delete(key);
        const bucket = deletedByChannel.get(entry.channelId);
        if (bucket) { bucket.delete(key); if (!bucket.size) deletedByChannel.delete(entry.channelId); }
        return entry;
    }
    function retainable(message, event) {
        // Only messages someone else removed from the server. Your own deletions, unsent or
        // failed local messages and dismissed ephemeral ("Only you can see this") messages
        // must disappear exactly like stock Discord.
        // Your own sent messages are kept too (red outline), as intended: every deletion is kept.
        if (!message) return false;
        if (message.state != null && message.state !== "SENT") return false;
        return !((Number(message.flags) || 0) & 64);
    }
    function persistDeleted() {
        // Coalesce bursts (raids, purges) into one archive write instead of one full
        // serialization per deleted message.
        // Once the archive is erased there is nothing on disk to update: don't rewrite the
        // same empty file for every later deletion while saving is off.
        if (!files || status.storage === "loading" ||
            !(settings.noDeleteSave || archiveRestored || status.archive && status.archive !== "erased")) return;
        if (archiveTimer !== undefined) return;
        archiveTimer = later(() => { archiveTimer = undefined; writeArchive(); }, 750);
    }
    function writeArchive() {
        if (!files || status.storage === "loading") return;
        const user = userStore && userStore.getCurrentUser && userStore.getCurrentUser();
        if (settings.noDeleteSave && (!user || !archiveRestored)) return;
        try {
            // Each kept message is turned into text once and reused, so a new deletion no longer re-serializes
            // up to 5000 others. The same text as JSON.stringify of the whole archive.
            const parts = [];
            if (settings.noDeleteSave) deleted.forEach(entry => { const text = archiveText(entry); if (text) parts.push(text); });
            // Edit history rides in the same file. Older releases ignore the extra key, so nothing breaks either way.
            const history = [];
            if (settings.noDeleteSave && settings.noDeleteEdits) edits.forEach(entry => { const text = editText(entry); if (text) history.push(text); });
            const text = "{\"version\":1,\"accountId\":" + JSON.stringify(settings.noDeleteSave && user ? user.id : null) +
                ",\"messages\":[" + parts.join(",") + "]" + (history.length ? ",\"edits\":[" + history.join(",") + "]" : "") + "}";
            // A file this big can never be read back. It used to stay queued, so a write already in progress
            // saved it anyway right after, and kept up to 32 MB of text in memory until the next deletion.
            if (text.length > ARCHIVE_BYTES) throw new Error("Deleted message archive exceeds 32 MB");
            archivePending = text;
        } catch (_) { status.archive = "save failed"; notify(); return; }
        if (archiveWriting) return;
        archiveWriting = true;
        function write() {
            const snapshot = archivePending; archivePending = undefined;
            return Promise.resolve().then(() => files.writeFile("documents", ARCHIVE, snapshot, "utf8"))
                .then(() => {status.archive = settings.noDeleteSave ? "saved locally" : "erased";}, () => {status.archive = "save failed";})
                .then(() => {notify(); if (archivePending !== undefined) return write(); archiveWriting = false;});
        }
        Promise.resolve().then(write);
    }
    function restoreDeleted() {
        if (!enabled("noDelete") || !enabled("noDeleteSave") || !files || !messageRecords || archiveRestored || archiveLoading || status.storage === "loading") return;
        const user = userStore && userStore.getCurrentUser && userStore.getCurrentUser();
        const constants = files.getConstants && files.getConstants();
        if (!user || !constants || typeof constants.DocumentsDirPath !== "string") return;
        const accountId = user.id, path = constants.DocumentsDirPath.replace(/\/$/, "") + "/" + ARCHIVE;
        archiveLoading = true;
        let readable = false;
        Promise.resolve().then(() => files.fileExists(path)).then(exists => exists ? files.readFile(path,"utf8") : null).then(text => {
            readable = true;
            const current = userStore.getCurrentUser();
            if (!enabled("noDelete") || !enabled("noDeleteSave") || !current || current.id !== accountId) return;
            // Messages kept before the archive loaded, or saved ones that didn't all fit, mean the file needs updating.
            // Otherwise it already says exactly this, and opening Discord no longer rewrites it every time.
            // Edits made before the archive loaded are newer than what's saved, so the file needs updating too.
            let restored = 0, changed = deleted.size > 0 || edits.size > 0 || !text, saved = null;
            if (text) {
                if (text.length > ARCHIVE_BYTES) throw new Error("Archive too large");
                saved = JSON.parse(text);
                if (saved.version !== 1 || !Array.isArray(saved.messages) || saved.messages.length > MAX_DELETED) throw new Error("Invalid archive");
                if (saved.accountId !== accountId) changed = true;
                else saved.messages.forEach(entry => {
                    if (!entry || typeof entry.id !== "string" || typeof entry.channelId !== "string" || !entry.message || entry.message.id !== entry.id || entry.message.channel_id !== entry.channelId || !entry.message.author) { changed = true; return; }
                    const key = deletedKey(entry.channelId,entry.id);
                    if (deleted.size < settings.noDeleteLimit && !deleted.has(key)) {
                        try { entry.message = Object.assign({},entry.message); keepDeleted(key,{type:"MESSAGE_DELETE",channelId:entry.channelId,id:entry.id,raw:entry.message,message:markDeleted(messageRecords.createMessageRecord(entry.message))}); restored++; }
                        catch (_) { changed = true; /* Invalid individual records do not poison the archive. */ }
                    } else changed = true;
                });
            }
            // Another account's file was already marked changed above and is never read from.
            if (saved && saved.accountId === accountId && settings.noDeleteEdits && Array.isArray(saved.edits)) saved.edits.slice(-MAX_EDITED).forEach(entry => {
                if (!entry || typeof entry.id !== "string" || typeof entry.channelId !== "string" || !Array.isArray(entry.versions)) { changed = true; return; }
                const versions = entry.versions.filter(v => v && typeof v.content === "string").slice(-MAX_VERSIONS)
                    .map(v => ({content:v.content.slice(0, MAX_VERSION_TEXT + 1), at:typeof v.at === "string" ? v.at : null}));
                const key = deletedKey(entry.channelId, entry.id);
                if (!versions.length || edits.has(key)) { changed = true; return; }
                edits.set(key, {channelId:entry.channelId, id:entry.id, versions}); restored++;
            });
            archiveRestored = true; invalidateDeleted();
            if (changed) persistDeleted(); else status.archive = "saved locally";
            if (!restored && !changed) return;
            if (msgStore && typeof msgStore.emitChange === "function") msgStore.emitChange();
        }).catch(() => {
            status.archive = "restore failed";
            // A file that was read but is damaged can never load. It used to stop saving until Discord restarted,
            // and was read again on every reconnect. Messages kept from now on replace it. A file that couldn't be
            // read at all is left alone and tried again later, so a passing error never erases it.
            const current = userStore.getCurrentUser();
            if (readable && enabled("noDelete") && enabled("noDeleteSave") && current && current.id === accountId) {
                archiveRestored = true;
                if (deleted.size) persistDeleted();
            }
            notify();
        }).finally(() => {archiveLoading = false;});
    }
    function markDeleted(message) {
        // Identity refresh only. Deletion styling belongs to row presentation, never
        // content: copying, replies, mentions, links and archives retain the original.
        const copy = Object.create(Object.getPrototypeOf(message),Object.getOwnPropertyDescriptors(message));
        // ChatManager.determineChangeType (HBC fn54452) deep-compares old and new records with
        // objEquiv (enumerable keys) and returns NOOP for equal ones, so an identical copy never
        // re-rendered the row until the chat was reopened. One enumerable marker key makes the
        // retained record differ and the red outline appear immediately; content is untouched.
        try { Object.defineProperty(copy,"venusDeleted",{value:true,enumerable:true,configurable:true}); } catch (_) {}
        return copy;
    }
    // Built on first save, not on every deletion: most people never turn saving on.
    function archiveEntry(entry) {
        if (entry.raw === undefined) { try { entry.raw = rawDeleted(entry.message, entry); } catch (_) { entry.raw = null; } }
        return entry.raw ? {channelId:entry.channelId,id:entry.id,message:entry.raw} : null;
    }
    function editText(entry) {
        if (entry.text === undefined) { try { entry.text = JSON.stringify({channelId:entry.channelId, id:entry.id, versions:entry.versions}); } catch (_) { entry.text = null; } }
        return entry.text;
    }
    // A kept message never changes, so its saved form is worked out once.
    function archiveText(entry) {
        if (entry.text === undefined) { const saved = archiveEntry(entry); try { entry.text = saved ? JSON.stringify(saved) : null; } catch (_) { entry.text = null; } }
        return entry.text;
    }
    function rawDeleted(message, event) {
        // Retain content/metadata only; no tokens, downloaded attachments or remote fetches.
        const raw = {id:event.id,channel_id:event.channelId,content:message.content || "",author:message.author,
            timestamp:message.timestamp && typeof message.timestamp.toISOString === "function" ? message.timestamp.toISOString() : message.timestamp,
            type:message.type || 0,flags:message.flags || 0,attachments:message.attachments || [],embeds:message.embeds || [],
            mentions:message.mentions || [],mention_roles:message.mentionRoles || [],referenced_message:null};
        return JSON.parse(JSON.stringify(raw));
    }
    // One Flux removal per channel instead of one dispatch (and store emit) per message.
    function dispatchRemovals(entries) {
        if (!dispatcher || !entries.length) return;
        const byChannel = new Map();
        entries.forEach(entry => { const ids = byChannel.get(entry.channelId); if (ids) ids.push(entry.id); else byChannel.set(entry.channelId, [entry.id]); });
        byChannel.forEach((ids, channelId) => dispatcher(ids.length === 1 ? {type:"MESSAGE_DELETE",channelId,id:ids[0]} : {type:"MESSAGE_DELETE_BULK",channelId,ids}));
    }
    function trimDeleted() {
        // Lowering the maximum from 5000 to 1 used to send up to 4999 separate deletes.
        const removed = [];
        while (deleted.size > settings.noDeleteLimit) {
            const pending = dropDeleted(deleted.keys().next().value);
            if (!pending) break;
            removed.push(pending);
        }
        if (!removed.length) return;
        invalidateDeleted(); persistDeleted(); dispatchRemovals(removed);
    }
    function clearDeleted(remove, keepArchive) {
        const events = Array.from(deleted.values());
        deleted.clear(); deletedByChannel.clear(); invalidateDeleted();
        if (remove) dispatchRemovals(events);
        if (remove && !keepArchive) persistDeleted();
    }
    function retainedMessage(orig, self, args) {
        // Hot path (every row render): skip the key build while nothing is kept in this channel.
        const bucket = deleted.size && enabled("noDelete") && deletedByChannel.get(args[0]);
        const entry = bucket && bucket.get(deletedKey(args[0],args[1]));
        return entry ? entry.message : orig.apply(self,args);
    }
    function retainedMessages(orig, self, args) {
        const result = orig.apply(self,args), channelId = args[0];
        if (!enabled("noDelete") || !result) return result;
        const bucket = deletedByChannel.get(channelId);
        if (!bucket || typeof result.merge !== "function") return result;
        const cached = deletedViews.get(channelId);
        if (cached && cached.orig === result && cached.revision === deletedRevision) return cached.value;
        const array = Array.isArray(result._array) ? result._array : null;
        const first = array && array.length ? String(array[0].id) : null, last = array && array.length ? String(array[array.length - 1].id) : null;
        const older = (a, b) => a.length - b.length || (a === b ? 0 : a < b ? -1 : 1);
        // Whether this window has numeric bounds is the same for every kept message: check it once.
        const bounded = first !== null && /^\d+$/.test(first);
        // Never paste a retained message into a window that doesn't contain its position;
        // that produced out-of-place rows above unloaded history or below an older jump.
        const records = [];
        bucket.forEach(entry => {
            const id = String(entry.id);
            if (bounded && /^\d+$/.test(id)) {
                if (older(id, first) < 0 && result.hasMoreBefore === true) return;
                if (older(id, last) > 0 && result.hasMoreAfter === true) return;
            }
            records.push(entry.message);
        });
        if (!records.length) { deletedViews.set(channelId,{orig:result,revision:deletedRevision,value:result}); return result; }
        // Discord's ChannelMessages has immutable merge()/mutate(), NOT clone().
        // clone() exists only on its internal before/after caches. Never mutate the store.
        let value = typeof result.clone === "function" ? result.clone().merge(records) : result.merge(records);
        // Native merge appends cache-missing records without sorting. Re-sort only
        // our private view's array, via native immutable mutate, never the live store.
        if (typeof value.mutate === "function" && Array.isArray(value._array)) value = value.mutate(copy => {
            // Check each id once instead of running two regexes per comparison.
            const ids = new Map();
            const idOf = message => {
                let id = ids.get(message);
                if (id === undefined) { const text = String(message.id); id = /^\d+$/.test(text) ? text : null; ids.set(message, id); }
                return id;
            };
            copy._array.sort((a,b) => {
                const left = idOf(a), right = idOf(b);
                if (left === null || right === null) return 0;
                return left.length - right.length || (left === right ? 0 : left < right ? -1 : 1);
            });
        },true);
        if (deletedViews.size >= 16) deletedViews.delete(deletedViews.keys().next().value);
        deletedViews.set(channelId,{orig:result,revision:deletedRevision,value});
        return value;
    }
    function rememberDeleted(event, orig, self) {
        const key = deletedKey(event.channelId, event.id);
        if (deleted.has(key)) return true;
        const message = msgStore && msgStore.getMessage(event.channelId,event.id);
        if (!retainable(message, event)) return false;
        while (deleted.size >= settings.noDeleteLimit) {
            const pending = dropDeleted(deleted.keys().next().value);
            if (!pending) break;
            orig.call(self,{type:"MESSAGE_DELETE",channelId:pending.channelId,id:pending.id});
        }
        keepDeleted(key,{type:"MESSAGE_DELETE",channelId:event.channelId,id:event.id,message:markDeleted(message),raw:undefined});
        invalidateDeleted(); persistDeleted();
        // Update the underlying collection too: native row diffing compares record identity.
        // The retained view supplies a new record; do not corrupt content to force a diff.
        // The store's own MESSAGE_UPDATE change re-renders; never emitChange mid-dispatch.
        return orig.call(self,{type:"MESSAGE_UPDATE",message:{id:event.id,channel_id:event.channelId,content:message.content || ""}}) || true;
    }
    // Kept messages and edit history of channels that are gone for good.
    function forgetChannels(ids) {
        let dropped = false;
        ids.forEach(id => {
            const bucket = deletedByChannel.get(id);
            if (bucket) { Array.from(bucket.keys()).forEach(dropDeleted); dropped = true; }
        });
        if (dropped) invalidateDeleted();
        for (const [key, entry] of edits) if (ids.has(entry.channelId)) { edits.delete(key); dropped = true; }
        if (dropped) persistDeleted();
    }
    function dispatchEvent(orig, self, args) {
        const event = args[0];
        if (!event) return orig.apply(self, args);
        if (features.hiddenChannels) channelMetadataEvent(event);
        if (event.type === "LOGOUT") { clearDeleted(false); edits.clear(); archiveRestored = false; clearReviewAuth(); }
        if (features.noDelete && RESTORE_EVENTS.has(event.type)) Promise.resolve().then(restoreDeleted);
        // Views are keyed by the store's own ChannelMessages identity, so unrelated events
        // (typing, presence, reactions) no longer force a re-merge and re-sort of every chat.
        if (event.type === "CHANNEL_DELETE") forgetChannels(new Set([event.channel && event.channel.id || event.channelId || event.id]));
        // Leaving a server (not an outage, which says unavailable) used to keep its kept messages and edit history
        // in memory and in the saved file for good, where nothing could ever show or remove them.
        if (event.type === "GUILD_DELETE" && event.guild && event.guild.id && !event.guild.unavailable && (deleted.size || edits.size)) {
            const ids = new Set(), guild = event.guild.id;
            const inGuild = channelId => { const channel = receivedChannel(channelId); return !!(channel && channel.guild_id === guild); };
            deletedByChannel.forEach((bucket, channelId) => { if (inGuild(channelId)) ids.add(channelId); });
            edits.forEach(entry => { if (!ids.has(entry.channelId) && inGuild(entry.channelId)) ids.add(entry.channelId); });
            if (ids.size) forgetChannels(ids);
        }
        if (!enabled("noDelete")) return orig.apply(self, args);
        if (event.type === "MESSAGE_UPDATE" && settings.noDeleteEdits) rememberEdit(event.message);
        if (event.type === "MESSAGE_DELETE" && event.channelId && event.id) {
            // Your own deletion of a message we were already showing: remove it for real.
            const kept = rememberDeleted(event, orig, self);
            // Discord's deleteMessage chains .then() on dispatch(); always hand back a thenable.
            if (kept) return kept === true ? Promise.resolve() : kept;
        }
        if (event.type === "MESSAGE_DELETE_BULK" && event.channelId && Array.isArray(event.ids)) {
            const remaining = event.ids.filter(id => !rememberDeleted({channelId:event.channelId,id}, orig, self));
            if (!remaining.length) return Promise.resolve();
            const next = Array.from(args); next[0] = Object.assign({}, event, {ids:remaining});
            return orig.apply(self, next);
        }
        return orig.apply(self, args);
    }
    // Only a real edit counts: Discord's own update carries edited_timestamp and new text. Link previews,
    // reactions, pins and the update NoDelete sends for a kept message have no edit time or keep the text.
    function rememberEdit(update) {
        if (!update || typeof update.content !== "string" || !update.edited_timestamp || !update.id || !update.channel_id || !msgStore) return;
        let current;
        try { current = msgStore.getMessage(update.channel_id, update.id); } catch (_) { return; }
        const before = current && current.content;
        if (typeof before !== "string" || before === update.content) return;
        const key = deletedKey(update.channel_id, update.id);
        let entry = edits.get(key);
        if (entry) edits.delete(key);
        else {
            if (edits.size >= MAX_EDITED) edits.delete(edits.keys().next().value);
            entry = {channelId:update.channel_id, id:update.id, versions:[]};
        }
        const at = current.editedTimestamp || current.timestamp;
        entry.versions.push({content:before.length > MAX_VERSION_TEXT ? before.slice(0, MAX_VERSION_TEXT) + "\u2026" : before,
            at:at && typeof at.toISOString === "function" ? at.toISOString() : typeof at === "string" ? at : null});
        if (entry.versions.length > MAX_VERSIONS) entry.versions.splice(0, entry.versions.length - MAX_VERSIONS);
        entry.text = undefined; entry.view = undefined; entry.joined = undefined;
        edits.set(key, entry);
        persistDeleted();
    }
    // Earlier versions sit above the message in one quote bar, each as small grey struck-through text: Discord's
    // own native block quote, subtext and strikethrough nodes, so it follows the theme and font like any message.
    // Plain text only, so an old version can never ping anyone or open a link.
    function editHistoryNodes(entry) {
        if (entry.view) return entry.view;
        const lines = [];
        entry.versions.forEach((version, index) => {
            if (index) lines.push({type:"br"});
            lines.push({type:"subtext", content:[{type:"s", content:[{type:"text", content:version.content || "(empty)"}]}]});
        });
        entry.view = {type:"blockQuote", content:lines};
        return entry.view;
    }
    function withEditHistory(message, channelId, id) {
        if (!edits.size || !settings.noDeleteEdits || !message || !Array.isArray(message.content)) return message;
        const entry = edits.get(deletedKey(channelId, id));
        if (!entry || !entry.versions.length) return message;
        // Rows are generated again for every change in the chat; reuse the joined content while neither side changed.
        const view = editHistoryNodes(entry), joined = entry.joined;
        const content = joined && joined.view === view && joined.source === message.content ? joined.value :
            (entry.joined = {view, source:message.content, value:[view].concat(message.content)}).value;
        return Object.assign({}, message, {content});
    }
    function deleteMessage(orig, self, args) {
        const key = deletedKey(args[0], args[1]), event = deleted.get(key);
        if (event && dispatcher) {
            dropDeleted(key); invalidateDeleted(); persistDeleted(); dispatcher({type:"MESSAGE_DELETE",channelId:event.channelId,id:event.id});
            return Promise.resolve(); // Dismiss locally; never DELETE an already-deleted message on the server.
        }
        // Your own deletions are kept like anyone else's, so there is nothing to track here.
        return orig.apply(self, args);
    }
    function jumpButton(orig, self, args) {
        if (React) useSettings("jumpToTop");
        const props = args[0], screenIndex = props && props.screenIndex;
        // Same native hooks as JumpToPresent; respects composer resizing and suggestion bars.
        const inputHeight = chatHeight && chatHeight.useChatInputContainerHeight(screenIndex);
        const suggestionHeight = chatHeight && chatHeight.useSmallSuggestionBarHeight(screenIndex);
        const result = orig.apply(self, args);
        if (!enabled("jumpToTop") || !React || !RN || !props || !props.channelId || !msgActions) return result;
        const channelId = props.channelId;
        if (hiddenChannel(channelId)) return result;
        const onPress = () => msgActions.jumpToMessage({channelId, messageId:channelId, flash:true, jumpType:"ANIMATED"});
        const child = result && result.props && result.props.children;
        if (child && child.props && typeof child.props.onPress === "function") {
            const top = React.cloneElement(child, {key:"venus-jump-top", onPress, accessibilityLabel:"Jump to top"});
            return React.cloneElement(result, {children:el(RN.View, {style:{gap:8}},
                el(RN.View, {style:{transform:[{scaleY:-1}]}}, top), child)});
        }
        if (result || !jumpPill || !jumpIcon) return result;
        // Never render bare black text over chat/media. Use Discord's themed native pill.
        const bottom = Math.max(0,Number.isFinite(inputHeight) ? inputHeight : 64) + Math.max(0,Number(suggestionHeight) || 0) + 12;
        return el(RN.View, {pointerEvents:"box-none", style:{position:"absolute",bottom,right:16}},
            el(RN.View,{style:{transform:[{scaleY:-1}]}},
                el(jumpPill,{icon:jumpIcon,onPress,accessibilityLabel:"Jump to top"})));
    }
    function hiddenCan(orig, self, args) {
        // One real permission check per call. The old path ran it twice for every visible
        // channel, and re-checked canBasicChannel with the full can(), which reads a
        // different record shape (348.10 PermissionStore: basicPermissions).
        const real = orig.apply(self, args);
        if (real || !enabled("hiddenChannels")) return real;
        const bit = args[0], channel = args[1];
        // Escape hatch: a channel with realCheck asks for the true permission result.
        // Loose equality: VIEW_CHANNEL can be BigInt/object across module copies.
        return !!(channel && !channel.realCheck && viewPermission != null && bit == viewPermission &&
            channel.guild_id && channel.type !== 1 && channel.type !== 3) || real;
    }
    // The mobile list has a second VIEW_CHANNEL filter. Give ONLY that factory a
    // metadata-list facade; the real permission store and all other callers stay stock.
    function listImport(importer) {
        if (typeof importer !== "function") return importer;
        return function () {
            const result = importer.apply(this,arguments);
            if (!result || arguments[0] !== 2051 && arguments[0] !== 4472) return result;
            const real = result.default || result;
            if (arguments[0] === 2051) {
                const methods=new Map();
                const facade=new Proxy(real,{get(target,key) {
                    const value=Reflect.get(target,key,target);
                    if (typeof value!=="function") return value;
                    const old=methods.get(key);
                    if (old && old.original===value) return old.bound;
                    const lookup=["getChannel","getBasicChannel"].includes(key);
                    const bound=function () {
                        const channel=value.apply(real,arguments);
                        return lookup && channel && enabled("hiddenChannels") ? displayChannel(channel) : channel;
                    };
                    methods.set(key,{original:value,bound});return bound;
                }});
                return result.default ? cloneWith(result,"default",facade) : facade;
            }
            if (typeof real.can !== "function") return result;
            const facade = Object.create(real);
            facade.can = function (bit, channel) {
                // Loose equality like hiddenCan: VIEW_CHANNEL can be a BigInt or number across module copies.
                if (viewPermission != null && bit == viewPermission && hiddenMetadata(channel)) return true;
                return real.can.apply(real,arguments);
            };
            return result.default ? cloneWith(result,"default",facade) : facade;
        };
    }
    function receivedChannel(id) {
        if (!channelStore || !id) return null;
        return channelStore.getChannel(id) || typeof channelStore.getBasicChannel === "function" && channelStore.getBasicChannel(id);
    }
    function realCan(bit, channel) {
        // Real permission result, bypassing our own global facade.
        // Honours the realCheck escape hatch.
        if (channel && channel.realCheck) { channel = Object.assign({}, channel); delete channel.realCheck; }
        // permissionsCanOrig is always set before permissions, so no second path is needed.
        try { return !!permissionsCanOrig && permissionsCanOrig(bit, channel); } catch (_) { return false; }
    }
    function hiddenMetadata(value) {
        if (!enabled("hiddenChannels")) return false;
        const channel = typeof value === "string" ? receivedChannel(value) : value;
        return !!(channel && channel.guild_id && channel.type !== 1 && channel.type !== 3 &&
            permissions && viewPermission != null && !realCan(viewPermission, channel));
    }
    function hiddenChannel(value) {
        const channel = typeof value === "string" ? receivedChannel(value) : value;
        return !!(channel && channel.type !== 4 && hiddenMetadata(channel));
    }
    // Channel records are immutable and replaced on change, so one renamed copy per record and name is reused.
    // A new copy on every lookup gave the channel list a different object each render, and copied every property.
    const renamedChannels = new WeakMap();
    function renamedChannel(channel, name) {
        if (name === channel.name) return channel;
        const known = renamedChannels.get(channel);
        if (known && known.name === name) return known.value;
        const value = cloneWith(channel,"name",name);
        renamedChannels.set(channel, {name, value});
        return value;
    }
    function displayChannel(channel) {
        if (!hiddenMetadata(channel)) return channel;
        return renamedChannel(channel, hiddenName(channel));
    }
    function hiddenDirectory(orig, self, args) {
        const result = orig.apply(self, args), guild = args[0];
        // Always cache names from the current store even while the toggle is off,
        // so enabling later still resolves. This read-only scan never changes permissions.
        // One read of both caches per lookup; the remembered names are reused below.
        let full, basic, source;
        // Resolve the account once per lookup, not once per channel, and walk basic then full
        // records: the same final cache as walking the merged map, without visiting basic twice.
        function remember() {
            const current = userStore && userStore.getCurrentUser(), owner = current && current.id;
            // While the switch is off this only backs up the names gateway events already record, and it ran over
            // every channel on every channel-list render. Skip it while the server's records are the same objects.
            const last = hiddenScans.get(guild);
            if (!enabled("hiddenChannels") && last && last.full === full && last.basic === basic && last.owner === owner) return;
            if (hiddenScans.size >= 64 && !last) hiddenScans.delete(hiddenScans.keys().next().value);
            hiddenScans.set(guild, {full, basic, owner});
            const keep = channel => rememberChannelName(channel, owner);
            if (basic) Object.values(basic).forEach(keep);
            Object.values(full).forEach(keep);
        }
        function read() {
            full = channelStore.getMutableGuildChannelsForGuild(guild);
            if (!full) return;
            basic = typeof channelStore.getMutableBasicGuildChannelsForGuild === "function" && channelStore.getMutableBasicGuildChannelsForGuild(guild);
            // Native lazy caching keeps basic metadata for channels with no full record.
            // Merge by ID, with full records retaining their richer native prototype.
            source = basic ? Object.assign({},basic,full) : full;
            remember();
        }
        const readable = guild && channelStore && typeof channelStore.getMutableGuildChannelsForGuild === "function";
        try { if (readable) read(); } catch (_) { source = undefined; }
        if (!enabled("hiddenChannels") || !result || !readable || !permissions) return result;
        // The read above threw part-way: retry once, letting a real error surface as before.
        if (!source) { read(); if (!source) return result; }
        const extra = Object.values(source).filter(channel => hiddenMetadata(channel));
        // Recheck permissions and metadata on each directory lookup; retain stable
        // array identity for unchanged inputs and bound the cache to 16 guilds.
        const names = new Map(extra.map(c => [c, hiddenName(c)]));
        const signature = extra.map(c => [c.id,c.position,c.type,c.parent_id,names.get(c)].join(":")).join("|");
        const references = extra.concat(extra.map(c => source[c.parent_id]).filter(Boolean));
        const cached = hiddenViews.get(guild);
        if (cached && cached.orig === result && cached.source === full && cached.basic === basic && cached.signature === signature &&
            references.length === cached.references.length && references.every((c,i) => c === cached.references[i])) return cached.value;
        let next = result;
        function append(key, channels) {
            if (!Array.isArray(next[key])) return;
            const original = next[key];
            const existing = original.map(entry => {
                if (!entry.channel) return entry;
                const channel = displayChannel(entry.channel);
                return channel === entry.channel ? entry : Object.assign({},entry,{channel});
            });
            const renamed = existing.some((entry,index) => entry !== original[index]);
            const ids = new Set(existing.map(entry => entry.channel && entry.channel.id));
            const added = [];
            channels.forEach(channel => {
                if (ids.has(channel.id)) return;
                ids.add(channel.id);
                const name = names.get(channel);
                // Hidden names were resolved for the signature above; reuse them instead of asking again.
                const shown = name === undefined ? displayChannel(channel) : renamedChannel(channel, name);
                added.push({channel:shown,comparator:channel.position || 0});
            });
            if (!added.length && !renamed) return;
            if (next === result) next = Object.assign({}, result);
            next[key] = existing.concat(added).sort((a,b) => a.comparator - b.comparator);
        }
        for (const type of [0,2,4,5,10,11,12,13,15,16]) append(type, extra.filter(c => c.type === type));
        append("SELECTABLE", extra.filter(c => ![2,4,13].includes(c.type)));
        append("VOCAL", extra.filter(c => [2,13].includes(c.type)));
        append(4, extra.map(c => source[c.parent_id]).filter(c => c && c.type === 4));
        if (hiddenViews.size >= 16 && !hiddenViews.has(guild)) hiddenViews.delete(hiddenViews.keys().next().value);
        hiddenViews.set(guild, {orig:result,source:full,basic,signature,references,value:next});
        return next;
    }
    const hiddenConfirmed = new Set();
    function hiddenFetch(orig, self, args) {
        const channelId = typeof args[0] === "string" ? args[0] : args[0] && args[0].channelId;
        if (!hiddenChannel(channelId) || hiddenConfirmed.has(channelId)) return orig.apply(self, args);
        const channel = receivedChannel(channelId);
        showHidden(channel, () => { hiddenConfirmed.add(channelId); return orig.apply(self, args); });
        return Promise.resolve();
    }
    function preciseAgo(ms) {
        // Precise relative durations:
        // "8 days, 7 hours and 7 minutes ago". Three largest nonzero units.
        if (!Number.isFinite(ms)) return null;
        let diff = Date.now() - ms;
        if (diff < 0) diff = 0;
        const minute = 60000, hour = 60 * minute, day = 24 * hour, month = 30 * day, year = 365 * day;
        const parts = [];
        function take(unit, singular, plural) {
            const value = Math.floor(diff / unit);
            if (value > 0) { parts.push(value + " " + (value === 1 ? singular : plural)); diff -= value * unit; }
        }
        if (diff < 45 * 1000) {
            const secs = Math.floor(diff / 1000);
            return secs <= 5 ? "just now" : secs + " seconds ago";
        }
        take(year, "year", "years"); take(month, "month", "months"); take(day, "day", "days");
        take(hour, "hour", "hours"); take(minute, "minute", "minutes");
        const shown = parts.slice(0, 3);
        if (!shown.length) return "just now";
        if (shown.length === 1) return shown[0] + " ago";
        return shown.slice(0, -1).join(", ") + " and " + shown[shown.length - 1] + " ago";
    }
    function snowflakeMs(id) {
        if (typeof id !== "string" || !/^\d{17,20}$/.test(id)) return NaN;
        try { return Number(BigInt(id) >> BigInt(22)) + 1420070400000; }
        catch (_) { return NaN; }
    }
    function hiddenStamp(value, fallback) {
        // {relative, absolute} for a snowflake, Date or ISO timestamp.
        let ms = NaN;
        if (typeof value === "string" && /^\d{17,20}$/.test(value)) ms = snowflakeMs(value);
        else if (value instanceof Date) ms = value.getTime();
        else if (value != null && value !== "") {
            const parsed = new Date(value);
            if (Number.isFinite(parsed.getTime())) ms = parsed.getTime();
        }
        const relative = preciseAgo(ms);
        if (relative === null) return {relative:fallback, absolute:null};
        let absolute = null;
        try { absolute = new Date(ms).toLocaleString(); } catch (_) {}
        return {relative, absolute};
    }
    function hiddenDetails(channel) {
        const pin = channel.lastPinTimestamp || channel.last_pin_timestamp;
        const last = channel.lastMessageId || channel.last_message_id;
        return [
            ["Created", hiddenStamp(channel.id, "Unavailable")],
            ["Last message", last ? hiddenStamp(last, "No messages yet") : {relative:"No messages yet", absolute:null}],
            ["Last pin", pin ? hiddenStamp(pin, "No pins yet") : {relative:"No pins yet", absolute:null}]
        ];
    }
    function HiddenDetails(props) {
        // Rendered inside Discord's own AlertModal (HBC98 module 5210) as extraContent:
        // native Text tokens follow the active theme; no hardcoded colors or backdrop.
        const Text = props.Text;
        return el(RN.View, {style:{gap:14}}, props.rows.map(([label, stamp]) =>
            el(RN.View, {key:label, style:{gap:2}},
                el(Text, {variant:"text-xs/semibold", color:"text-muted"}, label.toUpperCase()),
                el(Text, {variant:"text-md/medium", color:"text-default", selectable:true}, stamp.relative),
                stamp.absolute ? el(Text, {variant:"text-sm/medium", color:"text-muted", selectable:true}, stamp.absolute) : null)));
    }
    // One prompt per channel at a time: a navigation guard and a fetch guard can
    // fire for the same tap, which used to stack duplicate dialogs. Native
    // backdrop dismissal calls onCancel (HBC98 closure #80886), so every close
    // path releases the guard; 30 s is only a safety net.
    const hiddenPrompts = new Map();
    function showHidden(channel, onViewAnyway) {
        if (!channel || !RN) return;
        const now = Date.now(), open = hiddenPrompts.get(channel.id);
        if (open && now - open.at < 30000) return;
        const prompt = {at:now};
        hiddenPrompts.set(channel.id, prompt);
        const settle = () => { if (hiddenPrompts.get(channel.id) === prompt) hiddenPrompts.delete(channel.id); };
        const confirm = () => { settle(); if (typeof onViewAnyway === "function") onViewAnyway(); };
        const rows = hiddenDetails(channel);
        const title = channel.type === 2 || channel.type === 13 ? "Locked voice channel" : "Locked channel";
        const body = "You don't have permission to view this channel. These details come from what Discord already sent your client.";
        // Discord's native alert (the "Delete Message" dialog): blurred backdrop,
        // themed card, Discord buttons. String title/body/confirmText + children
        // selects the modern AlertModal path in AlertActionCreators.show (module 5205).
        // Demand-loaded at tap time: no extra Metro factories are wrapped at startup.
        const alerts = inspectedExport(5205, "default");
        const Text = inspectedExport(4833, "Text");
        if (React && alerts && typeof alerts.show === "function" && Text) {
            try {
                alerts.show({title, body, children:el(HiddenDetails, {rows, Text}),
                    confirmText:"View Anyway", cancelText:"Cancel", onConfirm:confirm, onCancel:settle});
                return;
            } catch (_) { /* fall through to the platform alert */ }
        }
        if (!RN.Alert) {settle();return;}
        const message = rows.map(([label, stamp]) => label + ": " + stamp.relative + (stamp.absolute ? " (" + stamp.absolute + ")" : "")).join("\n");
        try {
            RN.Alert.alert(title, message, [
                {text:"Cancel", style:"cancel", onPress:settle},
                {text:"View Anyway", onPress:confirm}
            ], {cancelable:true, onDismiss:settle});
        } catch (_) { settle(); }
    }
    function hiddenNavigation(orig, self, args) {
        const route = args[0];
        const match = typeof route === "string" && /^\/channels\/(?:@me|[^/]+)\/([^/?#]+)(?:[/?#]|$)/.exec(route);
        if (!match || !hiddenChannel(match[1]) || hiddenConfirmed.has(match[1])) return orig.apply(self, args);
        const id = match[1];
        showHidden(receivedChannel(id), () => { hiddenConfirmed.add(id); return orig.apply(self, args); });
        return; // Wait for user choice; View Anyway then navigates.
    }
    function hiddenGuildNavigation(orig, self, args) {
        if (!hiddenChannel(args[1]) || hiddenConfirmed.has(args[1])) return orig.apply(self, args);
        const id = args[1];
        showHidden(receivedChannel(id), () => { hiddenConfirmed.add(id); return orig.apply(self, args); });
    }
    // One cached wrapper per sheet component. A new type on every render made React
    // unmount and remount the whole sheet (losing its state) each time it re-rendered.
    // The channel and close handler travel in one private prop, removed before Discord sees it.
    const JUMP_PROP = "__venusJumpSheet";
    const sheetTypes = new WeakMap();
    function sheetComponent(component) {
        if (!component || !React || (typeof component !== "function" && typeof component !== "object")) return component;
        if (sheetTypes.has(component)) return sheetTypes.get(component);
        let result = component;
        if (typeof component === "function") result = function (props) {
            const jump = props && props[JUMP_PROP];
            if (!jump) return component.apply(this, arguments);
            const next = Array.from(arguments), clean = Object.assign({}, props);
            delete clean[JUMP_PROP]; next[0] = clean;
            return addJumpRow(component.apply(this, next), jump.channel, jump.onClose);
        };
        else if (component.$$typeof) {
            const key = component.type ? "type" : "render";
            const child = sheetComponent(component[key]);
            if (child !== component[key]) result = cloneWith(component, key, child);
        }
        sheetTypes.set(component, result);
        return result;
    }
    function addJumpRow(tree, channel, onClose) {
        let added = false;
        return cloneTree(tree, function (node, props) {
            if (added || !Array.isArray(props.children)) return props;
            const template = props.children.find(child => child && child.props && typeof child.props.label === "string" && typeof child.props.onPress === "function");
            if (!template || props.children.some(child => child && child.key === "venus-jump-top")) return props;
            added = true;
            const row = React.cloneElement(template, {key:"venus-jump-top",label:"Jump to top",icon:undefined,
                onPress:function () {
                    if (typeof onClose === "function") onClose();
                    msgActions.jumpToMessage({channelId:channel.id,messageId:channel.id,flash:true,jumpType:"ANIMATED"});
                }});
            return Object.assign({}, props, {children:[row].concat(props.children)});
        }, 0);
    }
    function jumpSheet(orig, self, args) {
        const tree = orig.apply(self, args), props = args[0];
        if (!enabled("jumpToTop") || !React || !tree || !props || !msgActions) return tree;
        const channel = props.thread || props.channel || channelStore && channelStore.getChannel(props.channelId);
        if (!channel || ![0,1,3,5,10,11,12].includes(channel.type) || hiddenChannel(channel)) return tree;
        // ChannelLongPressActionSheet returns a connected component. Preserve its
        // React tags and patch its render, not the exports object or frozen element.
        const transformed = addJumpRow(tree, channel, props.onClose);
        if (transformed !== tree) return transformed;
        const type = sheetComponent(tree.type);
        if (type === tree.type) return tree;
        return el(type, Object.assign({}, tree.props, {key:tree.key, [JUMP_PROP]:{channel, onClose:props.onClose}}));
    }
    let pastelHash, guildMembers, presenceStore, sessionsStore, displayNameType, nativeRowGroup, nativeSwitchRow, nativeLock, oauthModal;
    // The original PlatformIndicators plugin's themable PNG glyphs, tinted by status.
    const platformPngs = {"desktop": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAMAAABiM0N1AAAAVFBMVEUAAACvv7+3u7+5u7+2ub+4u726vL65u765vL65vMG5u723ub23v7+3t7+6vL+4ur+6u765u764vL+4ur23t7+7vb+3ur25ur64ur+7u766ur6vr7/+1nXbAAAAHHRSTlMAEEB/UHDv/99fgIAgQJ+f7++fnyB/YN9vTz8QSaZf3QAAAI1JREFUeAHt1tUBwkAURNEXHZzg1n+d2Fc8u4OTOQXcyKqJ3ARh5C22qiQFYTC0khFIYyuYgDYthGagzQuhDLRFIYS7yBPuakLmSaF2CimkkEIKKfT8I5un0MdCT7v6LUFbFUIhaGsr2IAUWcl2B0K2t6pDVKttGR5P3BJvpxCnfdTMHVo9NaRQ1MpKRC5jHSw3VFQzIwAAAABJRU5ErkJggg==", "web": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAQAAAD/5HvMAAADgklEQVR42u3a32vVdRzH8VdOv2NzGzM7bkp0E9F9RQSbOmK6groQpeugOzXJfnCW3YwgC4IyHCldrBmFELtQRxfK2MHp1sjVZRfBMSJFYu6cMUnOOZPz9Gb45uyc79fv5/tDvDiPv+DJh/fn8+HL56umpqbHFZsZ4hjjzJOnQJkyBfLMM87H7GWzHh16OcoVKgQpM8N79Cht7GaSVcJa5QK7lBZe5SpRzDCgpLGdH6gS3SRPKzm8xTJxFTmgJNDKtyRllFbFQxfTRLVCvSk6FR3b+J3onuRTlllvgUzk1YmVsyJJdPMN1bqkzmizM00cc1rDIP9SawpPrjhFPAf1AN1cotZJ940ezwKb1q33BLX2Kzx2sBwzZ7vWoYXvAVOkV2FxlqjuMMtBNqkBNpIDzI/h7ywnTsfIP5gquxUGV3EiB7zMPcxlPRwDOJITTgNmpx6GyZSDnqKAOa9g9LKKIzniA0yFbQrC+5B6UDf/Y44oCFdwdUPOGMfkgr8kyrg6Lmf0YUq0yw9DuLnBcTw5YwNFzB754RhmkYaUCH7BDMsPZzDDZFMM+gQzJj/8inlTYiS1oNcws/LD35jnJUtKPOgFzHX5YQmzdmCRTSXoGcyi/FDGtEqWlHhQG6YULsjTA4zg5iZf4CkAXrig25gtUowk+FwB2IpZDDfUz8pEWiUF4DnM9XDbfkiKl6QAvB5u248H38KMJBZ0FDMW7uo4qwbIJhQ0gcnKD3sxN3lCirNKgZfrf5hB+aGdEuYVNUQ2dtAuTIk2+WMG87V8MBIzaBQzrdDDVqBDPuIE0cUy5rCC0MMq5lAqQR9hKmRcPoNu0ZF0EN0sYs7JBAyc+UwNsUJYd7nGO2zUGr4CTL9MqMGu8KIaYB43C2yVJPq4h8kpDAaoYv6kS3U4jKvfaGELeUyVfoXDT4C5wAatg8cfuHqbS4A54/K8UgTMd/WnNjuckyqAKdCj8DhArdO0NFilQ8xxhyiq7JMbRqk1GXAEuDshV3hMUesvXkoo6CKe3NHJArUqfEln7KBrdCgaMnVJcIsPa6OcczKKjk6mqFfkFH20RAi6SIfiweMkjS0xwTBvEFaVE3hKAvspEleBfUoOvTGfOH+mJ40X6ctEkaNfaWEn56kQVoVz9CltZDhCjhJBSuR4l4weHdrZwzBjzJFniTJlbpNnljGyDNLW/BmlqelxdR++AoGbDB4jjAAAAABJRU5ErkJggg==", "mobile": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAMAAADVRocKAAAAXVBMVEUAAAAwMDgwMDUwMDUuMDYwMDYvMTcvMTYvMTYwMDYwMDUvMTYwMjUvMTUvMjYvMTUuMDUuMDQvMDUtMTUwMDgvMDUwMDAtMDYuMDYwMDAtMDUvMDYuMDUtMDcpMTo5aAq8AAAAH3RSTlMAIGBvf1C//89fMN9g75+/j3+fP0C/IFBfMGDPb08fcZ9WCgAAAMNJREFUeAHt2YWNxQAMg2EX/fiVud1/zBuhSaRjfwv8UsQx5J9L0iw/VySIyUoaXa7wu93pcE/g9KDTFS4F+amF5Em3ZwK7FwPeMEsYcoNVxZAaViX5uTd6MuQJKwY5A01u9goFWph1fyKggAIKKKCAAgoooIACCiiggAIKKKCAAgoooIACn/l9d/t3gU/fcEqG9LDKGVLB6saQAZ97owZ2w5NuzwEOKd1G4FMLE5wG36Y/w29ZadRviBn2/Nw2HfjTPgD3/UVA1TCAGgAAAABJRU5ErkJggg==", "embedded": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAMAAABiM0N1AAAAk1BMVEUAAAC3u7+4ur+5vL+5u765u7+6vL+2ub+3v7+6u7+5vL66v7+6vL65u761ur+4u765vL+3t7+6u765u7+9vb23t7+7vb+6u766ur+5ur6/v7+vv7+9vcW1tb+5u727u763ur25vL+6vL+3ub24ur+5u7+4vL+5ur66ur64ur25vL+6u764ur24u722uby5u76vr7/eehxsAAAAMXRSTlMAQJ/f/8+fUCC/3zDv7zC/UEDvfx8gf88w3xAQHzCAT2Bfb4Bvj5/PP6+vv59wUM8QEONx+AAAAWZJREFUeAHt1dWa6zAMBOA5PSqzs2Vmhvd/uWWcVFHqr5f+r+3JRqtJ8UhBEAT/Mv8lpWwuD02hKHcpFXBTuSJ3qtZwQ0HPUVULiCuJhzpiGuKlCZaTL3gnxEVPaLWdkAxYJznIdfGmy0k9MEkOivChLQSkbwS18KElZEBBLSMIX4QMuRxaEJ0vCBndCkJMbEZjIRO6MTWCqjWlRjO6MTeCpLoooDWuCFvSjcgK0pYzohsrM0hZzhXdWJtBynJyR4rGv19dzrp3EC3nhoJKZpCynNxalzqIlrPKU7WDlOXUym8H0XIOufy+htxZX9tHBU24/L5mXH5fSy6/r4jL/8sOidYJv2x7fu0k84SgIn/Qmb50dT2oB6YXk+tf4hElWuuPdeaIlCFx/fkLeM+Q1Ferw3RQZ9SmP8jQlR9H/NZ3tKmG08+sW/SMnrxzZ6Qy/TrfBWkdL+Lq0RUptaYHJyU+HwRB4O0FjTMnvIkvoBQAAAAASUVORK5CYII=", "vr": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAMAAABiM0N1AAAANlBMVEVMaXHv7/Hv7/Hv7/Hv7/Hv7/Hv7/Hv7/Hv7/Hs7PTu7vHv7/Hv7/Hv7/Hv7/Hv7/Hv7/Hv7/EEUZf/AAAAEXRSTlMAzGV4UNr78OcJFDufKb6ri3Gd0SEAAAHQSURBVFjD7VbHdsQgDDRNiOby/z+bjY0N2LRk95C8xxwNHo0KkqZpYGBg4PMwbBa4ZYFiZqaPRVGxNSCoavPwJs0ujLbk2K0TtipKz1s3Zl3RE/PILGKmsqbLL8JcwZ5y9LJmi3E+k8Ib1UH8xcI95Utnaeb2TAnmbzLP01NsnilfBEcBCW9FVXWpwzvxrGYiE785ASC1p2DO3M5xlWty5ZREyrEmKlQK0Tedweu1npUdNPxDVBrlHe5bIHQQue1m/YVIEKjIGKmGG7ZbPKYpqnsMnsGqqxUQNSzpP8WdJoSaNUop7nwFInZF600ijT0F3kE06dXS6RNEXfh7ROI/EMG7RPAM2++I8D48wqefZe0cJy74Bo+HaixBJPbRLXX0k5ueDenWgtzVYojLz670edNL55y2wSgPQPOtFhPbirPlKYlDPOyBPwUtjD8auzr6GwYXDKRrA4RAucMFmR0PvuXjeZ3K+wIiT++MD8Wa32n8KSxc67ArSOYcOzln6rTmi5eKhWbMIbMGyV2gkZkjKE4ZVr6cM1Lp6qxslN6ZoDodeLoVi6igTbqlYmOJ0muIBrIku4oFK7Ix9I7atAQ2SWym1F5HEjB3NDAwMPAuvgCPRUw2yKsaYwAAAABJRU5ErkJggg=="};
    function PlatformPng(props) {
        const uri = platformPngs[props.platform];
        if (!uri) return el(RN.View,{style:{width:16,height:16,borderRadius:8,backgroundColor:props.color}});
        return el(RN.Image,{source:{uri,width:16,height:16},style:{width:16,height:16,tintColor:props.color}});
    }
    let reviewToken = "", reviewAccount = null, reviewAuthAttempt = 0, reviewAuthState = "idle", reviewAuthError = "";
    const reviewCache = new Map(), platformWrappers = new WeakMap();
    const REVIEW_API = "https://manti.vendicated.dev/api/reviewdb";
    const pastelCache = new Map();
    let pastelCacheColor, pastelCacheHash;
    function pastelColor(seed, saturation, lightness) {
        if (!pastelHash || !RN || typeof RN.processColor !== "function") return null;
        // Rows re-render constantly; the color only depends on these inputs and the active helpers.
        if (pastelCacheColor !== RN.processColor || pastelCacheHash !== pastelHash) {
            pastelCache.clear(); pastelCacheColor = RN.processColor; pastelCacheHash = pastelHash;
        }
        const cacheKey = saturation + ":" + lightness + ":" + seed;
        const known = pastelCache.get(cacheKey);
        if (known) return known;
        const color = computePastel(seed, saturation, lightness);
        if (pastelCache.size >= 1024) pastelCache.delete(pastelCache.keys().next().value);
        pastelCache.set(cacheKey, color);
        return color;
    }
    function computePastel(seed, saturation, lightness) {
        const hue = ((pastelHash(String(seed)) >>> 0) % 360) / 360;
        function component(offset) {
            const k = (offset + hue * 12) % 12;
            return Math.round(255 * (lightness - saturation * Math.min(lightness,1-lightness) * Math.max(-1,Math.min(k-3,9-k,1))));
        }
        const hex = "#" + [component(0),component(8),component(4)].map(value => value.toString(16).padStart(2,"0")).join("");
        return {hex, value:RN.processColor(hex)};
    }
    // Every chat row runs this: the content array is only copied once a node actually changes.
    function pastelMentions(content, guildId) {
        if (!Array.isArray(content)) return content;
        let next = null;
        for (let i = 0; i < content.length; i++) {
            const node = content[i];
            if (!node || typeof node !== "object") continue;
            let result = node;
            if (node.type === "mention" && node.userId && (!node.colorString || settings.pastelAll) &&
                (!guildId || guildMembers && guildMembers.getMember(guildId,node.userId))) {
                const color = pastelColor(node.userId,0.85,0.75);
                if (color) result = Object.assign({},node,{roleColor:color.value,color:color.value,colorString:color.hex});
            }
            if (Array.isArray(node.content)) {
                const children = pastelMentions(node.content,guildId);
                if (children !== node.content) result = Object.assign({},result,{content:children});
            }
            if (result !== node) { if (!next) next = content.slice(); next[i] = result; }
        }
        return next || content;
    }
    function pastelMessage(message, source) {
        if (!message || !message.authorId) return message;
        if (message.guildId && (!guildMembers || !guildMembers.getMember(message.guildId,message.authorId)) && !(source && source.webhookId)) return message;
        let seed;
        if (source && source.webhookId) seed = message.username || source.webhookId;
        else if (!(source && source.colorString != null ? source.colorString : message.roleColor) || settings.pastelAll) seed = message.authorId;
        const color = seed && pastelColor(seed,0.75,0.6);
        // One copy of the row's message, with every change in it.
        const changes = color ? {roleColor:color.value,usernameColor:color.value,colorString:color.value,shouldShowRoleOnName:true} : {shouldShowRoleOnName:true};
        const content = pastelMentions(message.content,message.guildId);
        if (content !== message.content) changes.content = content;
        // Native MessageView applies Message.textColor via TextView.setTextColor (348.10 bridge field).
        // Never wrap content in a link node: that made the text blue, tappable and show "usernameOnClick".
        if (color && settings.pastelContent) {
            const text = pastelColor(seed,0.85,0.75);
            if (text) changes.textColor = text.value;
        }
        return Object.assign({},message,changes);
    }
    // The replied-to message above a reply. Discord's reply preview never read textColor, so "Color message text"
    // didn't reach replies (#45); the Pastelize patch now has it paint the reply text with it. Discord gives every
    // message a textColor, so the reply's own is dropped unless Pastelize colored it: otherwise the preview keeps
    // Discord's usual reply color, exactly as before, also while Pastelize is switched off.
    function pastelReply(reply) {
        const shown = enabled("pastelize") ? pastelMessage(reply,null) : reply;
        if (enabled("pastelContent") && shown !== reply && shown.textColor != null && shown.textColor !== reply.textColor) return shown;
        if (shown.textColor == null) return shown;
        const plain = Object.assign({},shown);
        delete plain.textColor;
        return plain;
    }
    // Read All: a ReadAllNotificationsButton port for the mobile server bar (GuildsBar 15920,
    // useGuildsBarProps 15929). The button lives in the SEPARATOR row, below the DM button and
    // unread DMs and above the line, so the native FastList's sections, anchors and recycler
    // keys stay stock. Only that row's height grows, through the list's own itemSize.
    const READ_ALL_HEIGHT = 36;
    const readAllViews = new WeakMap(), readAllData = new WeakMap();
    // ReadStateActionCreators (6532) exports ack/bulkAck by name, with no default object.
    function readActionsExport() {
        if (typeof global.__r !== "function") return null;
        try { const m=global.__r(6532); return m && typeof m.bulkAck==="function" ? m : m && m.default; } catch (_) { return null; }
    }
    function readAllExports() {
        const x=(id,key) => inspectedExport(id,key);
        return {sorted:x(5751,"default"), guildReads:x(7054,"default"), markGuilds:x(13507,"default"), sections:x(1086,"AnalyticsSections"),
            privateReads:x(13299,"default"), reads:x(4852,"default"), readActions:readActionsExport(), readTypes:x(5019,"ReadStateTypes"),
            renderSections:x(15919,"FastListRenderSections")};
    }
    function unreadGuildIds(api) {
        if (!api.sorted || typeof api.sorted.getFlattenedGuildIds!=="function" || !api.guildReads) return [];
        return Array.from(api.sorted.getFlattenedGuildIds() || []).filter(id => typeof id==="string" &&
            (api.guildReads.hasUnread(id) || api.guildReads.getMentionCount(id) > 0));
    }
    function unreadDmIds(api) {
        if (!api.privateReads || typeof api.privateReads.getUnreadPrivateChannelIds!=="function") return [];
        return Array.from(api.privateReads.getUnreadPrivateChannelIds() || []).filter(id => typeof id==="string");
    }
    // Same native paths as Discord: the server menu's markGuildsAsRead (13507) with the
    // GUILD_LIST source, and a single BULK_ACK for DMs at each channel's last message.
    function readAll(mode) {
        if (!enabled("readAll") || !READ_ALL_MODES.includes(mode)) return;
        const api=readAllExports(), ui=reviewUI();
        let guilds=0, dms=0;
        // Unread servers or DMs with no way to clear them used to say "Nothing unread".
        const unavailable=() => { throw new Error("Discord's read states haven't loaded yet. Try again in a moment."); };
        try {
            if (mode!=="dms") {
                const ids=unreadGuildIds(api);
                if (ids.length && typeof api.markGuilds!=="function") unavailable();
                if (ids.length) { api.markGuilds(ids, api.sections && api.sections.GUILD_LIST); guilds=ids.length; }
            }
            if (mode!=="guilds") {
                const ids=unreadDmIds(api);
                if (ids.length && !(api.readActions && typeof api.readActions.bulkAck==="function" && api.reads)) unavailable();
                if (ids.length) {
                    const type=api.readTypes && api.readTypes.CHANNEL != null ? api.readTypes.CHANNEL : 0;
                    // A DM without a known last message can't be acknowledged; sending it anyway
                    // made the whole request fail. Discord's own /read-states/ack-bulk takes 100 at a time.
                    const acks=ids.map(channelId => ({channelId, readStateType:type, messageId:api.reads.lastMessageId(channelId)})).filter(ack => ack.messageId);
                    for (let i=0;i<acks.length;i+=100) api.readActions.bulkAck(acks.slice(i,i+100));
                    dms=acks.length;
                }
            }
        } catch (error) {
            // What was already cleared stays cleared; say so instead of only the error.
            const done=guilds ? " ("+guilds+(guilds===1 ? " server was" : " servers were")+" marked as read)" : "";
            reviewToast(ui,"Couldn't mark as read: "+String(error && error.message || error)+done); return;
        }
        const parts=[];
        if (guilds) parts.push(guilds+(guilds===1 ? " server" : " servers"));
        if (dms) parts.push(dms+(dms===1 ? " DM" : " DMs"));
        reviewToast(ui, parts.length ? "Marked "+parts.join(" and ")+" as read" : "Nothing unread");
    }
    // Holding the button: Discord's own action sheet with the three one-time choices.
    function readAllChooser() {
        const ui=reviewUI();
        const options=[["guilds","Mark servers as read"],["dms","Mark DMs as read"],["both","Mark servers and DMs as read"]]
            .map(([mode,label]) => ({label, onPress:() => readAll(mode)}));
        if (typeof ui.simpleSheet==="function") try { ui.simpleSheet({key:"VenusReadAll",header:{title:"Read all"},options}); return; } catch (_) {}
        if (RN && RN.Alert) RN.Alert.alert("Read all",undefined,options.map(option => ({text:option.label,onPress:option.onPress})).concat([{text:"Cancel",style:"cancel"}]));
    }
    let readAllStyleHook, readAllStylesTried=false;
    function ReadAllButton() {
        useSettings("readAll");
        const ui=reviewUI();
        // Discord's semantic tokens, so the pill follows light, dark and custom themes.
        if (!readAllStylesTried) {
            readAllStylesTried=true;
            const c=ui.colors;
            if (typeof ui.createStyles==="function" && c) try {
                readAllStyleHook=ui.createStyles({pill:{backgroundColor:c.BACKGROUND_MOD_NORMAL},pressed:{backgroundColor:c.BACKGROUND_MOD_STRONG},text:{color:c.TEXT_DEFAULT}});
            } catch (_) { readAllStyleHook=null; }
        }
        let styles=null;
        if (readAllStyleHook) try { styles=readAllStyleHook(); } catch (_) {}
        styles=styles || {pill:{backgroundColor:"#4e505899"},pressed:{backgroundColor:"#4e5058"},text:{color:"#dbdee1"}};
        return el(RN.View,{style:{height:READ_ALL_HEIGHT,alignItems:"center",justifyContent:"center"}},
            el(RN.Pressable,{accessibilityRole:"button",accessibilityHint:"Hold to choose",
                hitSlop:6,onPress:() => readAll(settings.readAllMode),onLongPress:readAllChooser,delayLongPress:350,
                style:({pressed}) => [{height:26,minWidth:48,paddingHorizontal:8,borderRadius:13,alignItems:"center",justifyContent:"center"},styles.pill,
                    pressed ? styles.pressed : null,pressed ? {transform:[{scale:0.96}]} : null]},
                el(RN.Text,{numberOfLines:1,allowFontScaling:false,style:[{fontSize:11,fontWeight:"700",includeFontPadding:false},styles.text]},"Read all")));
    }
    function readAllBarProps(orig, self, args) {
        const result=orig.apply(self,args);
        if (React) useSettings("readAll");
        const data=result && result.listDataProps;
        if (!enabled("readAll") || !React || !RN || !data || typeof data.itemSize!=="function" || typeof data.renderItem!=="function") return result;
        // The wrapped list data is shared per native listDataProps, but the returned props are per result:
        // keying the whole view on listDataProps handed back an older result's listProps.
        const known=readAllViews.get(result);
        if (known) return known;
        let listDataProps=readAllData.get(data);
        if (!listDataProps) {
            const enums=readAllExports().renderSections, separator=enums && typeof enums.SEPARATOR==="number" ? enums.SEPARATOR : 6;
            const itemSize=data.itemSize, renderItem=data.renderItem;
            listDataProps=Object.assign({},data,{
                itemSize:function (section) { const size=itemSize.apply(this,arguments); return section===separator && enabled("readAll") ? size+READ_ALL_HEIGHT : size; },
                renderItem:function (section) {
                    const node=renderItem.apply(this,arguments);
                    return section===separator && enabled("readAll") ? el(RN.View,{key:"venus-read-all",style:{width:"100%"}},el(ReadAllButton,null),node) : node;
                }});
            readAllData.set(data, listDataProps);
        }
        const view=Object.assign({},result,{listDataProps});
        readAllViews.set(result, view);
        return view;
    }
    // Message tap gestures (a port of Geastures+ by kmmiio99o): double-tap replies, or edits your own
    // message; tapping a third time deletes your own message. It takes over Discord's double-tap handler
    // (DoubleTapToReactUtils 7414, which every double-tap reaches), so Discord's own "double-tap to
    // react" setting needs nothing changed. Reply and edit go through the same actions as swiping:
    // replyToMessage (11047) and LongPressMessageActionSheetUtils.handleEdit (11032).
    // The third tap is not a second double-tap. Discord's native tap tracker (NestedScrollOnTouchTracker)
    // starts over once a double-tap fires, so the next touch is reported as a single tap
    // (MessagesHandlers.handleTapMessage, 10905), and only after Android's double-tap timeout (300 ms)
    // passes with no fourth tap. Waiting 260 ms for another double-tap meant the editor always opened
    // first. Edit now waits long enough for that single tap: a quick third tap lands 400-550 ms after
    // the double-tap. A second double-tap (tap four) still counts too.
    const GESTURE_TRIPLE_MS = 650, GESTURE_PAIR_MS = 1500, GESTURE_DELETED_MS = 3000;
    const gesture = {timer:undefined, pending:null, channel:null, pendingAt:0, deleted:null, deletedAt:0};
    function gestureCancel() { if (gesture.timer !== undefined && global.clearTimeout) global.clearTimeout(gesture.timer); gesture.timer = undefined; gesture.pending = null; gesture.channel = null; }
    function gestureOwn(message) {
        const user = userStore && userStore.getCurrentUser();
        return !!(user && message && message.author && message.author.id === user.id);
    }
    function gestureReply(message, channel) {
        const reply = inspectedExport(11047, "default");
        if (typeof reply !== "function") return false;
        try { reply({message, channel, chatInputRef:null, actionSource:"message_swipe"}); return true; } catch (_) { return false; }
    }
    function gestureEdit(message, channel) {
        // Only what Discord itself would let you edit (sent, yours, not a system message); otherwise reply.
        const canEdit = inspectedExport(11120, "default"), user = userStore && userStore.getCurrentUser();
        try { if (typeof canEdit === "function" && !canEdit(message, user && user.id)) return false; } catch (_) { return false; }
        const edit = inspectedExport(11032, "handleEdit");
        if (typeof edit !== "function") return false;
        try { edit(message, channel, null, "message_swipe", true); return true; } catch (_) { return false; }
    }
    function gestureDelete(message, channel) {
        const actions = msgActions || inspectedExport(6880, "default");
        if (!actions || typeof actions.deleteMessage !== "function") return false;
        // Discord's own delete, with QuickDelete and NoDelete still applying to it.
        try { const result = actions.deleteMessage(channel && channel.id || message.channel_id, message.id, false);
            if (result && typeof result.catch === "function") result.catch(() => {}); return true; } catch (_) { return false; }
    }
    function gestureDeletePending(now) {
        const message = gesture.pending, channel = gesture.channel;
        gestureCancel();
        gesture.deleted = message.id; gesture.deletedAt = now;
        gestureDelete(message, channel);
    }
    // A single tap on the message that was just double-tapped is the third tap.
    function gestureTap(event) {
        if (!enabled("gestures") || !settings.gestureTripleDelete || !gesture.pending) return false;
        const data = event && event.nativeEvent, id = data && data.messageId, now = Date.now();
        if (id == null || String(id) !== String(gesture.pending.id) || now - gesture.pendingAt >= GESTURE_PAIR_MS) return false;
        gestureDeletePending(now);
        return true;
    }
    // MessagesHandlers defines handleTapMessage on each instance in its constructor, so it's wrapped per instance.
    function hookTapHandlers(exports) {
        const Handlers = exports && exports.MessagesHandlers;
        if (typeof Handlers !== "function" || typeof Reflect === "undefined" || typeof Reflect.construct !== "function") return exports;
        function MessagesHandlers() {
            const handlers = Reflect.construct(Handlers, arguments);
            const tap = handlers && handlers.handleTapMessage;
            if (typeof tap === "function") handlers.handleTapMessage = function (event) {
                try { if (gestureTap(event)) return undefined; } catch (_) {}
                return tap.apply(this, arguments);
            };
            return handlers;
        }
        MessagesHandlers.prototype = Handlers.prototype;
        try { Object.setPrototypeOf(MessagesHandlers, Handlers); } catch (_) {}
        return replaceValue(exports, "MessagesHandlers", MessagesHandlers);
    }
    function gestureAct(message, channel) {
        if (!message || !channel) return;
        const own = gestureOwn(message);
        if (own && settings.gestureOwn === "edit" && gestureEdit(message, channel)) return;
        gestureReply(message, channel);
    }
    function doubleTapMessage(orig, self, args) {
        if (!enabled("gestures")) return orig.apply(self, args);
        const message = args[0], channel = args[1], id = message && message.id;
        if (!id) return orig.apply(self, args);
        const now = Date.now();
        // The taps that just deleted a message can land once more before it disappears: ignore them.
        if (gesture.deleted === id && now - gesture.deletedAt < GESTURE_DELETED_MS) { gestureCancel(); return; }
        if (gesture.pending && gesture.pending.id === id && now - gesture.pendingAt < GESTURE_PAIR_MS) {
            if (settings.gestureTripleDelete && gestureOwn(message)) { gesture.channel = channel; gestureDeletePending(now); return; }
            gestureCancel(); gestureAct(message, channel);
            return;
        }
        gestureCancel();
        // Nothing waits for a third tap when it couldn't delete anything.
        if (!settings.gestureTripleDelete || !gestureOwn(message)) { gestureAct(message, channel); return; }
        gesture.pending = message; gesture.channel = channel; gesture.pendingAt = now;
        gesture.timer = later(() => { gesture.timer = undefined; const waiting = gesture.pending; gesture.pending = null; gesture.channel = null;
            // Switching gestures off while it waited used to still open the editor (or reply) a moment later.
            if (waiting === message && enabled("gestures")) gestureAct(message, channel); }, GESTURE_TRIPLE_MS);
    }
    function GestureSettings() {
        useSettings("gestures");
        const ui = reviewUI();
        if (!RN) return null;
        const on = enabled("gestures");
        const groups = [
            radioGroup(ui, "own", "Double-tap your own message", "gestureOwn", on, [["edit", "Edit it", "Opens it for editing, when Discord lets you."],
                ["reply", "Reply to it", "Same as someone else's message."]]),
            el(ui.TableRowGroup || RN.View, {key:"triple", title:"Triple-tap"},
                switchRow(ui.TableSwitchRow, "gestureTripleDelete", "Triple-tap to delete", "Tap your own message three times to delete it, with no confirmation. Never affects other people's messages.")),
            footnote("note", "Double-tapping no longer adds a reaction. Hold a message to react instead.")];
        return settingsBody(ui, groups);
    }
    // Quest Completer: finds unfinished Quests and completes them in the background, with no screen.
    // Based on the community quest scripts (aamiaa's gist, CompleteDiscordQuest, Questify), rebuilt on
    // 348.10's own modules: QuestStore (7120), fetchCurrentQuests (9765), questUserStatusFromServer (7127)
    // and the HTTP client (1283). Video, Play and Activity tasks are run; stream tasks need a real Go Live.
    const QUEST_VIDEO_TASKS = ["WATCH_VIDEO_ON_MOBILE", "WATCH_VIDEO"], QUEST_ACTIVITY_TASK = "PLAY_ACTIVITY", QUEST_PLAY_TASK = "PLAY_ON_DESKTOP";
    // QuestContent.QUEST_HOME_MOBILE: where Discord's own app says a quest was accepted from.
    const QUEST_HOME_MOBILE = 12;
    // Video progress may run at most ~10 s ahead of the time since accepting; report about every 7 s like the player.
    // Play and Activity heartbeats follow Discord's desktop QuestProgressManager: one a minute, and when less
    // than a minute is left it waits exactly what's left plus one second.
    const QUEST_VIDEO_LEEWAY = 10, QUEST_VIDEO_STEP = 7, QUEST_HEARTBEAT_MS = 60000, QUEST_HEARTBEAT_TAIL_MS = 1000;
    // QuestVariants.MOBILE_ACTIVITY_QUEST: an Activity Quest that Discord's phone app reports itself.
    const QUEST_MOBILE_ACTIVITY = 36;
    // Discord answers 401 when a phone reports play time, so Play and Activity heartbeats are sent as Discord
    // Stable for Windows: host 1.0.9261, web build 634304, updater metadata 93252, Electron 42.11.10.
    const QUEST_DESKTOP = {version:"1.0.9261", build:634304, native:93252, electron:"42.11.10", chrome:"148.0.7778.280",
        osVersion:"10.0.26100", osSdk:"26100"};
    const QUEST_DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/" +
        QUEST_DESKTOP.version + " Chrome/" + QUEST_DESKTOP.chrome + " Electron/" + QUEST_DESKTOP.electron + " Safari/537.36";
    // Bits desktop's launch signature keeps clear when it detects no client mod (docs.discord.food, Launch Signature).
    const QUEST_SIGNATURE_BITS = [119, 108, 100, 91, 84, 75, 61, 55, 48, 38, 24, 11];
    const QUEST_HEARTBEAT_SESSION_MS = 30 * 60 * 1000;
    const QUEST_REFETCH_MS = 30 * 60 * 1000, QUEST_RETRY_MS = 30 * 60 * 1000, QUEST_REFUSED_MS = 6 * 60 * 60 * 1000, QUEST_OFFLINE_MS = 5 * 60 * 1000;
    // Heartbeats in a row that Discord answers without counting any more time before Quest Completer gives up for now.
    const QUEST_STALLED_BEATS = 5;
    const quest = {store:null, dispatcher:null, generation:0, running:null, enrolling:false, skip:new Map(), enrollBlockedUntil:0,
        scanTimer:undefined, refetchTimer:undefined, user:null, completed:0, last:"", error:"", desktop:null, executables:new Map()};
    function questSleep(ms) { return new Promise(resolve => { later(resolve, ms); }); }
    function questStore() {
        if (quest.store) return quest.store;
        const store = inspectedExport(7120, "default");
        if (!store || typeof store.getQuest !== "function") return null;
        questAttach(store);
        return store;
    }
    function questAttach(store) {
        if (quest.store || !store || typeof store.getQuest !== "function") return;
        quest.store = store;
        if (typeof store.addChangeListener === "function") store.addChangeListener(questsChanged);
    }
    // Store updates arrive in bursts (fetch, enroll, progress). One scan per burst is enough.
    function questsChanged() { if (enabled("quests")) questsSchedule(1500); }
    function questsSchedule(ms) {
        if (quest.scanTimer !== undefined || typeof global.setTimeout !== "function") return;
        quest.scanTimer = global.setTimeout(questsScan, ms);
    }
    function questStatus(text, error) {
        if (error) quest.error = text; else { quest.last = text; quest.error = ""; }
        notify("quests");
    }
    // Discord's HTTP client (its auth and headers), with this request's own interceptResponse. Discord asks
    // it before its global handler (captcha, MFA, restricted-hours screens), so taking every failed response
    // here means a challenge just fails the request quietly instead of opening a screen.
    function questIntercept(response, retry, cancel) {
        if (!response || response.ok || typeof cancel !== "function") return false;
        const error = new Error("HTTP " + response.status);
        error.status = response.status; error.body = response.body;
        cancel(error);
        return true;
    }
    // desktop: send this request as the Windows desktop app. Only Play and Activity heartbeats (and the game
    // lookup that names their executable) do; enrolling and video progress stay the phone, which Discord accepts.
    function questRequest(url, body, desktop, method) {
        const http = inspectedExport(1283, "HTTP"), send = http && http[method || "post"];
        if (typeof send !== "function") return Promise.reject(new Error("Discord's network client isn't ready"));
        const request = {url, interceptResponse:questIntercept};
        if (body !== undefined) request.body = body;
        if (desktop) request.onRequestCreated = questDesktopRequest;
        return Promise.resolve().then(() => send.call(http, request));
    }
    function questHex(count) { let hex = ""; for (let i = 0; i < count; i++) hex += Math.floor(Math.random() * 16).toString(16); return hex; }
    function questUuidText(hex) { return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20, 32); }
    // RFC 4122 version 4, like crypto.randomUUID().
    function questUuid() { const hex = questHex(32); return hex.slice(0, 12) + "4" + hex.slice(13, 16) + "89ab"[Math.floor(Math.random() * 4)] + hex.slice(17); }
    // A random UUID with every client-mod bit cleared, the way desktop makes one when it detects no mods.
    function questLaunchSignature() {
        const digits = questUuid().split("").map(c => parseInt(c, 16));
        for (const bit of QUEST_SIGNATURE_BITS) { const i = 31 - Math.floor(bit / 4); digits[i] &= ~(1 << bit % 4); }
        return questUuidText(digits.map(d => d.toString(16)).join(""));
    }
    function questBase64(text) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", bytes = [];
        for (const c of unescape(encodeURIComponent(text))) bytes.push(c.charCodeAt(0));
        let out = "";
        for (let i = 0; i < bytes.length; i += 3) {
            const n = bytes[i] << 16 | (bytes[i + 1] || 0) << 8 | (bytes[i + 2] || 0);
            out += chars[n >> 18 & 63] + chars[n >> 12 & 63] + (i + 1 < bytes.length ? chars[n >> 6 & 63] : "=") + (i + 2 < bytes.length ? chars[n & 63] : "=");
        }
        return out;
    }
    function questLocale() {
        try {
            const read = inspectedExport(1348, "getSuperProperties"), own = typeof read === "function" ? read() : null;
            const locale = own && own.system_locale;
            if (typeof locale === "string" && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(locale)) return locale;
        } catch (_) {}
        return "en-US";
    }
    // One desktop launch per Discord launch: its launch id and signature stay the same, and the analytics
    // heartbeat session id rolls over every 30 minutes like desktop's. The locale is the phone's own.
    function questDesktopProperties() {
        const now = Date.now();
        const identity = quest.desktop || (quest.desktop = {launch:questUuidText(questUuid()), signature:questLaunchSignature(),
            locale:questLocale(), session:"", sessionAt:0});
        if (!identity.session || now - identity.sessionAt >= QUEST_HEARTBEAT_SESSION_MS) { identity.session = questUuidText(questUuid()); identity.sessionAt = now; }
        // Same keys, in the same order, as desktop's getSuperProperties.
        const properties = {os:"Windows", browser:"Discord Client", release_channel:"stable", client_version:QUEST_DESKTOP.version,
            os_version:QUEST_DESKTOP.osVersion, os_arch:"x64", app_arch:"x64", system_locale:identity.locale, has_client_mods:false,
            client_launch_id:identity.launch, browser_user_agent:QUEST_DESKTOP_UA, browser_version:QUEST_DESKTOP.electron,
            os_sdk_version:QUEST_DESKTOP.osSdk, client_build_number:QUEST_DESKTOP.build, native_build_number:QUEST_DESKTOP.native,
            client_event_source:null, launch_signature:identity.signature, client_heartbeat_session_id:identity.session,
            client_app_state:"unfocused"};
        try {
            const encode = inspectedExport(1283, "encodeProperties"), encoded = typeof encode === "function" ? encode(properties) : null;
            if (typeof encoded === "string" && encoded) return encoded;
        } catch (_) {}
        return questBase64(JSON.stringify(properties));
    }
    // Discord's HTTP client hands over the request before its prepareRequest adds the phone's X-Super-Properties,
    // so those headers are swapped as they're set. The native User-Agent interceptor leaves this Windows agent
    // alone (see questCompleter in DiscordPatches.kt); every other request still says Discord-Android.
    function questDesktopRequest(request) {
        if (!request || typeof request.set !== "function") return;
        const properties = questDesktopProperties(), set = request.set;
        const value = (name, original) => {
            const key = String(name).toLowerCase();
            return key === "x-super-properties" ? properties : key === "user-agent" ? QUEST_DESKTOP_UA : original;
        };
        request.set = function (name, original) {
            if (name && typeof name === "object") {
                const copy = {};
                for (const key of Object.keys(name)) copy[key] = value(key, name[key]);
                return set.call(this, copy);
            }
            return set.call(this, name, value(name, original));
        };
        request.set("User-Agent", QUEST_DESKTOP_UA);
        request.set("X-Super-Properties", properties);
    }
    // QuestStore exposes these as getters in 348.10; accept a method too.
    function questFlag(store, key) {
        try { const value = store[key]; return typeof value === "function" ? value.call(store) : value; } catch (_) { return undefined; }
    }
    function questDispatch(action) {
        const dispatcher = quest.dispatcher || inspectedExport(585, "default");
        try {
            if (!dispatcher || typeof dispatcher.dispatch !== "function") return false;
            const result = dispatcher.dispatch(action);
            if (result && typeof result.catch === "function") result.catch(() => {});
            return true;
        } catch (_) { return false; }
    }
    function questUserStatus(body) {
        const convert = inspectedExport(7127, "questUserStatusFromServer");
        try { return body && typeof convert === "function" ? convert(body) : null; } catch (_) { return null; }
    }
    function questRetryAfter(error) {
        const body = error && error.body, value = body && (body.retry_after != null ? body.retry_after : body.retryAfter);
        const seconds = Number(value != null ? value : error && error.retryAfter);
        return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 86400) * 1000 : error && error.status === 429 ? 60000 : 0;
    }
    function questTime(value) {
        if (value == null || value === "") return NaN;
        const time = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(String(value));
        return Number.isFinite(time) ? time : NaN;
    }
    function questName(item) {
        const messages = item && item.config && item.config.messages;
        return messages && typeof messages.questName === "string" && messages.questName ? messages.questName : "a Quest";
    }
    // The game a Play or Activity task counts time for. Since mid-2026 it lives on the task
    // (taskConfigV2.tasks.<TYPE>.applications[0].id); older quests carry it on config.application.
    function questApplication(item, task) {
        const apps = task && task.applications, first = Array.isArray(apps) ? apps.find(app => app && app.id) : null;
        const id = first ? first.id : item && item.config && item.config.application && item.config.application.id;
        return id != null && /^\d{5,25}$/.test(String(id)) ? String(id) : null;
    }
    // The first task this phone can do, in the order the settings allow.
    function questTask(item) {
        const config = item && item.config, tasks = config && (config.taskConfigV2 || config.taskConfig);
        const all = tasks && tasks.tasks;
        if (!all || typeof all !== "object") return null;
        if (settings.questsVideo) for (const type of QUEST_VIDEO_TASKS) {
            const target = Number(all[type] && all[type].target);
            if (target > 0) return {type, target, kind:"video"};
        }
        // "Play <game> for 15 minutes": the same heartbeat Discord's desktop app sends while the game runs.
        const play = all[QUEST_PLAY_TASK], playTarget = Number(play && play.target), playApp = questApplication(item, play);
        if (settings.questsPlay && playTarget > 0 && playApp) return {type:QUEST_PLAY_TASK, target:playTarget, kind:"play", applicationId:playApp};
        const activity = all[QUEST_ACTIVITY_TASK], target = Number(activity && activity.target);
        const activityApp = questApplication(item, activity), features = config.features;
        const mobile = Array.isArray(features) && features.includes(QUEST_MOBILE_ACTIVITY);
        if (settings.questsActivity && target > 0 && activityApp) return {type:QUEST_ACTIVITY_TASK, target, kind:"activity", applicationId:activityApp, mobile};
        return null;
    }
    function questProgress(item, type) {
        const progress = item && item.userStatus && item.userStatus.progress, value = Number(progress && progress[type] && progress[type].value);
        return Number.isFinite(value) && value > 0 ? value : 0;
    }
    function questOpen(item, now) {
        if (!item || typeof item.id !== "string" || !item.config) return false;
        if (item.userStatus && item.userStatus.completedAt) return false;
        const expires = questTime(item.config.expiresAt);
        return !(expires <= now + 60000) && !((quest.skip.get(item.id) || 0) > now);
    }
    function questsScan() {
        quest.scanTimer = undefined;
        if (!enabled("quests")) return;
        const store = questStore();
        if (!store) return;
        if (questFlag(store, "isQuestAccessSuspended") === true) { if (!quest.error) questStatus("Discord has paused Quests on this account.", true); return; }
        let all;
        try { all = store.quests; } catch (_) { return; }
        if (!all || typeof all.values !== "function") return;
        const now = Date.now(), ready = [], waiting = [];
        for (const item of all.values()) {
            if (!questOpen(item, now) || !questTask(item)) continue;
            if (item.userStatus && item.userStatus.enrolledAt) ready.push(item); else if (settings.questsEnroll) waiting.push(item);
        }
        // Soonest-expiring first, so nothing runs out while another quest is going.
        const expiry = item => { const time = questTime(item.config.expiresAt); return Number.isFinite(time) ? time : Infinity; };
        const soonest = (a, b) => expiry(a) - expiry(b);
        ready.sort(soonest); waiting.sort(soonest);
        const blocked = quest.enrollBlockedUntil > now || questTime(questFlag(store, "questEnrollmentBlockedUntil")) > now;
        if (waiting.length && !quest.enrolling && !blocked) questEnroll(waiting[0]);
        if (!quest.running && ready.length) questRun(ready[0]);
    }
    // Accepting one at a time, a few seconds apart. A refusal or captcha leaves that quest alone for hours.
    function questEnroll(item) {
        const generation = quest.generation, id = item.id;
        quest.enrolling = true;
        questRequest("/quests/" + id + "/enroll", {location:QUEST_HOME_MOBILE}).then(response => {
            if (generation !== quest.generation) return;
            const status = questUserStatus(response && response.body);
            if (!status || !questDispatch({type:"QUESTS_ENROLL_SUCCESS", enrolledQuestUserStatus:status})) questsFetch(true);
        }, error => {
            if (generation !== quest.generation) return;
            const wait = questRetryAfter(error);
            if (wait) quest.enrollBlockedUntil = Date.now() + wait;
            // Only a real answer from Discord (refused, captcha) leaves the Quest alone for hours. No connection
            // means Discord never saw the request, so it's tried again sooner.
            const refused = error && Number.isFinite(error.status) && error.status > 0;
            quest.skip.set(id, Date.now() + Math.max(wait, refused ? QUEST_REFUSED_MS : QUEST_OFFLINE_MS));
        }).then(() => {
            if (generation !== quest.generation) return;
            quest.enrolling = false;
            questsSchedule(3000 + Math.floor(Math.random() * 2000));
        });
    }
    function questActive(entry) { return quest.running === entry && entry.generation === quest.generation && enabled("quests"); }
    function questRun(item) {
        const task = questTask(item), entry = {id:item.id, task, generation:quest.generation, name:questName(item)};
        quest.running = entry;
        notify("quests");
        const work = task.kind === "video" ? questVideo(entry, item) : task.kind === "play" ? questPlay(entry) : questActivity(entry);
        work.then(done => {
            if (!done || entry.generation !== quest.generation) return;
            quest.completed++;
            // The store's own update follows; don't pick the same quest again in the meantime.
            quest.skip.set(entry.id, Date.now() + 10 * 60 * 1000);
            questStatus("Completed " + entry.name + ".", false);
        }, error => {
            if (entry.generation !== quest.generation) return;
            const wait = questRetryAfter(error);
            quest.skip.set(entry.id, Date.now() + Math.max(wait, QUEST_RETRY_MS));
            questStatus("Couldn't finish " + entry.name + ": " + String(error && error.message || error), true);
        }).then(() => {
            if (quest.running === entry) { quest.running = null; notify("quests"); }
            if (entry.generation === quest.generation) questsSchedule(2000 + Math.floor(Math.random() * 2000));
        });
    }
    // Mirrors the server's answer into QuestStore, so Discord's own Quest screens stay right.
    function questVideoStatus(response) {
        const body = response && response.body;
        if (body && body.quest_id) questDispatch({type:"QUESTS_USER_STATUS_UPDATE", user_status:body});
        return !!(body && body.completed_at);
    }
    async function questVideo(entry, item) {
        const enrolled = questTime(item.userStatus && item.userStatus.enrolledAt), target = entry.task.target;
        if (!Number.isFinite(enrolled)) throw new Error("no accepted time");
        let done = questProgress(item, entry.task.type), completed = false;
        while (questActive(entry) && done < target) {
            const allowed = (Date.now() - enrolled) / 1000 + QUEST_VIDEO_LEEWAY, next = Math.min(target, done + QUEST_VIDEO_STEP);
            if (allowed < next) { await questSleep(Math.max(1000, Math.ceil((next - allowed) * 1000))); continue; }
            const response = await questRequest("/quests/" + entry.id + "/video-progress", {timestamp:Math.min(target, next + Math.random())});
            if (!questActive(entry)) return false;
            completed = questVideoStatus(response);
            done = next;
            if (completed) break;
            await questSleep(1000 + Math.floor(Math.random() * 500));
        }
        if (!questActive(entry)) return false;
        if (!completed) completed = questVideoStatus(await questRequest("/quests/" + entry.id + "/video-progress", {timestamp:target}));
        return completed;
    }
    // The executable_path desktop reports for a running game: the last two parts of its lowercase path, the way
    // its QuestProgressManager trims exePath (973522 Ic). Discord's own list of the game's Windows executables
    // is read once per game, and a test build, launcher or helper is never the one picked.
    function questExecutableName(app) {
        const all = app && Array.isArray(app.executables) ? app.executables : [];
        const rank = name => (/(^|[\/_.-])(test|launcher|crash|helper|setup|update|install|unins)/i.test(name) ? 2 : 0) + (name.includes("/") ? 1 : 0);
        const names = all.filter(e => e && e.os === "win32" && !e.is_launcher && typeof e.name === "string" && /\.exe$/i.test(e.name))
            .map(e => e.name.replace(/^>/, "").replace(/\\/g, "/").toLowerCase()).filter(name => !/(^|\/)\.\.(\/|$)/.test(name));
        names.sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
        return names[0] || null;
    }
    function questExecutablePath(app, exe) {
        const parts = exe.split("/").filter(Boolean);
        if (parts.length >= 2) return parts.slice(-2).join("/");
        const folder = String(app && app.name || "").toLowerCase().replace(/[<>:"\/\\|?*]/g, "").trim();
        return folder ? folder + "/" + parts[0] : null;
    }
    async function questExecutable(applicationId) {
        if (quest.executables.has(applicationId)) return quest.executables.get(applicationId);
        let path = null;
        try {
            const response = await questRequest("/applications/public?application_ids=" + applicationId, undefined, true, "get");
            const list = response && response.body, app = Array.isArray(list) ? list.find(a => a && String(a.id) === applicationId) : null;
            const exe = questExecutableName(app);
            if (exe) path = questExecutablePath(app, exe);
            // Only Discord's answer is remembered. A dropped connection used to leave the game unnamed until Discord restarted.
            if (quest.executables.size >= 64) quest.executables.delete(quest.executables.keys().next().value);
            quest.executables.set(applicationId, path);
        } catch (_) {}
        // Unknown is fine: desktop sends no path for a game it can't place either.
        return path;
    }
    // Same body as Discord's own sendHeartbeat (9765): application_id names the game or Activity, and a game
    // also says which executable is running. Play and Activity heartbeats go out as Discord for Windows.
    async function questHeartbeat(entry, desktop) {
        const body = {application_id:entry.task.applicationId, terminal:false};
        if (entry.executablePath) body.executable_path = entry.executablePath;
        const response = await questRequest("/quests/" + entry.id + "/heartbeat", body, desktop);
        const reply = response && response.body, status = questUserStatus(reply), type = entry.task.type;
        if (status) questDispatch({type:"QUESTS_SEND_HEARTBEAT_SUCCESS", questId:entry.id, userStatus:status});
        const value = Number(reply && reply.progress && reply.progress[type] && reply.progress[type].value);
        return {value:Number.isFinite(value) ? value : 0, completed:!!(reply && reply.completed_at)};
    }
    // Desktop's pace: a beat right away, then one a minute. With under a minute left it waits what's left plus a
    // second, and stops once Discord says the Quest is done. A finished Quest gets no terminal beat on desktop.
    async function questBeat(entry, desktop) {
        const target = entry.task.target;
        let best = -1, stalled = 0;
        while (questActive(entry)) {
            const beat = await questHeartbeat(entry, desktop);
            if (!questActive(entry)) return false;
            if (beat.completed || beat.value >= target) return true;
            // A Quest Discord stops counting used to get a heartbeat every minute for as long as Discord stayed open.
            if (beat.value > best) { best = beat.value; stalled = 0; }
            else if (++stalled >= QUEST_STALLED_BEATS) throw new Error("Discord stopped counting time");
            const left = Math.max(0, (target - beat.value) * 1000);
            await questSleep(left <= QUEST_HEARTBEAT_MS ? left + QUEST_HEARTBEAT_TAIL_MS : QUEST_HEARTBEAT_MS);
        }
        return false;
    }
    // Activity Quests: Discord counts time in the Activity without it being started. A mobile Activity Quest is
    // one the phone app reports itself, so only the others are sent as desktop.
    function questActivity(entry) { return questBeat(entry, !entry.task.mobile); }
    // Play Quests: Discord counts time for the quest's game without it being installed or started.
    async function questPlay(entry) {
        entry.executablePath = await questExecutable(entry.task.applicationId);
        if (!questActive(entry)) return false;
        return questBeat(entry, true);
    }
    // Mobile only loads Quests when you open them; ask for them once in a while, through Discord's own fetch.
    function questsFetch(force) {
        const store = questStore(), fetch = inspectedExport(9765, "fetchCurrentQuests");
        if (!store || typeof fetch !== "function") return;
        try {
            if (questFlag(store, "isFetchingCurrentQuests") === true) return;
            const last = questTime(questFlag(store, "lastFetchedCurrentQuests")) || 0;
            if (!force && last && Date.now() - last < QUEST_REFETCH_MS) return;
            const result = fetch();
            if (result && typeof result.catch === "function") result.catch(() => {});
        } catch (_) {}
    }
    function questsRefetchLoop() {
        quest.refetchTimer = undefined;
        if (!enabled("quests") || typeof global.setTimeout !== "function") return;
        questsFetch(false); questsSchedule(1000);
        quest.refetchTimer = global.setTimeout(questsRefetchLoop, QUEST_REFETCH_MS);
    }
    function questsStart(delay) {
        if (!enabled("quests") || typeof global.setTimeout !== "function") return;
        if (quest.refetchTimer !== undefined && global.clearTimeout) global.clearTimeout(quest.refetchTimer);
        quest.refetchTimer = global.setTimeout(questsRefetchLoop, delay);
    }
    // Stops everything in flight: switching it off, logging out, or another account signing in.
    function questsStop() {
        quest.generation++;
        quest.running = null; quest.enrolling = false; quest.enrollBlockedUntil = 0; quest.skip.clear();
        if (global.clearTimeout) {
            if (quest.scanTimer !== undefined) global.clearTimeout(quest.scanTimer);
            if (quest.refetchTimer !== undefined) global.clearTimeout(quest.refetchTimer);
        }
        quest.scanTimer = undefined; quest.refetchTimer = undefined;
    }
    function questsReset() { questsStop(); quest.completed = 0; quest.last = ""; quest.error = ""; notify("quests"); }
    function questsConnected(event) {
        const id = event && event.user && event.user.id;
        if (id && quest.user && id !== quest.user) questsReset();
        if (id) quest.user = id;
        // A reconnect keeps the quest that's running; a first connect waits for Discord to settle.
        questsStart(8000);
    }
    function questsInit(dispatcher) {
        if (quest.dispatcher || !dispatcher || typeof dispatcher.subscribe !== "function") return;
        quest.dispatcher = dispatcher;
        dispatcher.subscribe("CONNECTION_OPEN", questsConnected);
        dispatcher.subscribe("LOGOUT", () => { questsReset(); quest.user = null; });
    }
    // Discord can connect before the saved settings finish loading. Quest Completer was still off at that
    // moment, so it never started until the next reconnect. Start it now if Discord is already connected.
    function questsLoaded() {
        if (quest.user && quest.refetchTimer === undefined && !quest.running) questsStart(8000);
    }
    function questsSettingChanged(key, value) {
        if (key === "quests" && !value) { questsStop(); return; }
        if (!enabled("quests")) return;
        if (key === "quests") { questsStart(1000); return; }
        // Turning a quest type off stops that kind if it's the one running.
        const running = quest.running && quest.running.task;
        if (!value && running && (key === "questsVideo" && running.kind === "video" || key === "questsActivity" && running.kind === "activity" ||
            key === "questsPlay" && running.kind === "play")) {
            quest.generation++; quest.running = null; quest.enrolling = false;
            if (quest.scanTimer !== undefined && global.clearTimeout) global.clearTimeout(quest.scanTimer);
            quest.scanTimer = undefined;
        }
        questsSchedule(1000);
    }
    function questStatusText() {
        if (!enabled("quests")) return "Turned off. Switch it on in Features to start.";
        const lines = [quest.completed ? "Completed " + quest.completed + (quest.completed === 1 ? " Quest" : " Quests") + " since Discord opened." : "Waiting for new Quests."];
        if (quest.running) lines.push("Now: " + quest.running.name + ".");
        if (quest.last) lines.push("Last: " + quest.last);
        if (quest.error) lines.push(quest.error);
        return lines.join("\n");
    }
    // Settings page: the Quest types, a status card and what to know.
    const QUEST_NOTE = "You still claim rewards yourself. Stream Quests need a real stream, so they're skipped. Discord may pause Quests on accounts that complete them automatically.";
    function QuestSettings() {
        // Every status change (start, finish, error) already notifies "quests"; no 5-second redraw timer.
        useSettings("quests");
        const ui = reviewUI();
        if (!RN) return null;
        const Group = ui.TableRowGroup || RN.View, Switch = ui.TableSwitchRow;
        const toggle = (key, label, subLabel) => switchRow(Switch, key, label, subLabel);
        const groups = [
            statusCard("status", questStatusText()),
            el(Group, {key:"types", title:"Quests to complete"},
                toggle("questsVideo", "Video Quests", "Reported as watched at normal speed, without playing the video."),
                toggle("questsPlay", "Play Quests", "Play time counts without installing or opening the game."),
                toggle("questsActivity", "Activity Quests", "Activity time counts without starting the Activity.")),
            el(Group, {key:"enroll", title:"New Quests"},
                toggle("questsEnroll", "Accept new Quests", "Accepts Quests you haven't started, one at a time. Off: only Quests you accept yourself.")),
            footnote("note", QUEST_NOTE)];
        return settingsBody(ui, groups);
    }
    // Shared by the Read All, ReviewDB and NoDelete pages: Discord's spacing, scrolling and switch rows.
    function settingsBody(ui,groups,scroll) {
        const body=ui.Stack ? el(ui.Stack,{style:{paddingVertical:24,paddingHorizontal:12},spacing:24},groups) :
            el(RN.View,{style:{paddingVertical:24,paddingHorizontal:12,gap:24}},groups);
        return RN.ScrollView ? el(RN.ScrollView,scroll || null,body) : body;
    }
    // Greyed out while the main switch is off, like the options on the Settings list.
    function switchRow(Switch,key,label,subLabel) {
        const owner=featureFor(key);
        return Switch ? el(Switch,{key,label,subLabel,value:settings[key],disabled:owner!==key && !settings[owner],onValueChange:value=>setSetting(key,value)}) : null;
    }
    // One choice from a few: Discord's radio list (TableRadioGroup 5995 / TableRadioRow 5994), or check-marked rows.
    function radioGroup(ui,key,title,setting,on,choices) {
        const RadioGroup=inspectedExport(5995,"TableRadioGroup"), RadioRow=inspectedExport(5994,"TableRadioRow");
        if (RadioGroup && RadioRow) return el(RadioGroup,{key,title,value:settings[setting],onChange:value => setSetting(setting,value)},
            choices.map(([value,label,subLabel]) => el(RadioRow,{key:value,value,label,subLabel,disabled:!on})));
        return el(ui.TableRowGroup || RN.View,{key,title},choices.map(([value,label,subLabel]) => ui.TableRow &&
            el(ui.TableRow,{key:value,label:(settings[setting]===value ? "\u2713 " : "")+label,subLabel,disabled:!on,onPress:() => setSetting(setting,value)})));
    }
    // Small muted text under a page's groups: what else to know, without a row of its own.
    function footnote(key,text) {
        const Text=inspectedExport(4833,"Text");
        return el(RN.View,{key,style:{paddingHorizontal:16}},
            Text ? el(Text,{variant:"text-xs/medium",color:"text-muted"},text) : el(RN.Text,{style:{color:"#949ba4",fontSize:12}},text));
    }
    // A rounded card with live status, in the theme's card colors.
    function statusCard(key,text) {
        const ui=reviewUI(), Text=inspectedExport(4833,"Text"), c=ui.colors;
        const style={borderRadius:16,paddingHorizontal:16,paddingVertical:14,backgroundColor:c && c.CARD_BACKGROUND_DEFAULT || "#ffffff0f"};
        return el(RN.View,{key,style},
            Text ? el(Text,{variant:"text-sm/medium",color:"text-default"},text) : el(RN.Text,{style:{color:"#dbdee1",fontSize:14}},text));
    }
    // A full-width row that does something once, like clearing what a feature saved.
    function actionRow(ui,key,label,subLabel,onPress,disabled,danger) {
        return ui.TableRow ? el(ui.TableRow,{key,label,subLabel,onPress,disabled:!!disabled,variant:danger ? "danger" : undefined}) : null;
    }
    function confirmAction(title,body,confirmText,onConfirm) {
        const ui=reviewUI();
        if (ui.alerts && typeof ui.alerts.show==="function") try { ui.alerts.show({title,body,confirmText,cancelText:"Cancel",onConfirm}); return; } catch (_) {}
        if (RN && RN.Alert) RN.Alert.alert(title,body,[{text:"Cancel",style:"cancel"},{text:confirmText,style:"destructive",onPress:onConfirm}]);
    }
    function count(n,word) { return n+" "+word+(n===1 ? "" : "s"); }
    // Settings page: Discord's own radio list (TableRadioGroup 5995 / TableRadioRow 5994).
    function ReadAllSettings() {
        useSettings("readAll");
        const ui=reviewUI();
        if (!React || !RN) return null;
        const groups=[
            radioGroup(ui,"mode","When you tap Read all","readAllMode",enabled("readAll"),[["guilds","Servers","Marks every unread server as read."],
                ["dms","Direct messages","Marks every unread DM and group DM as read."],["both","Servers and DMs","Marks everything as read in one tap."]]),
            footnote("note","Hold the button to pick just once, without changing this.")];
        return settingsBody(ui,groups);
    }
    const deletedHighlight = {};
    function messageRow(orig, self, args) {
        const result = orig.apply(self,args), row = args[0];
        if (!result || !row || row.rowType !== 1 || !result.message) return result;
        let message = result.message;
        if (enabled("pastelize")) message = pastelMessage(message,row.message);
        if (features.pastelize && message.referencedMessage && message.referencedMessage.message) {
            const reply = pastelReply(message.referencedMessage.message);
            if (reply !== message.referencedMessage.message) message = Object.assign({},message,{referencedMessage:Object.assign({},message.referencedMessage,{message:reply})});
        }
        let next = message === result.message ? result : Object.assign({},result,{message});
        const source = row.message || message;
        const channelId = source.channel_id || source.channelId || message.channelId;
        const id = source.id || message.id;
        // Before edit history, so the crossed-out old versions above it stay as they were written.
        if (enabled("translate")) {
            const shown = translateRow(next.message, source, channelId, id);
            if (shown !== next.message) next = Object.assign({},next,{message:shown});
        } else if (features.translate) translateSeen(source, channelId, id, null);
        if (edits.size && enabled("noDelete")) {
            const shown = withEditHistory(next.message, channelId, id);
            if (shown !== next.message) next = Object.assign({},next,{message:shown});
        }
        const bucket = deleted.size && enabled("noDelete") && deletedByChannel.get(channelId);
        if (bucket && bucket.has(deletedKey(channelId,id)) && RN && typeof RN.processColor === "function") {
            // Native row highlight schema from RowGeneratorConstants (7379). No injected notice, altered
            // message content, or AutoMod state. Only retained local rows are tinted.
            if (deletedHighlight.owner !== RN.processColor) {
                deletedHighlight.owner = RN.processColor;
                deletedHighlight.gutter = RN.processColor("#f23f43");
                deletedHighlight.background = RN.processColor("#f23f431a");
            }
            next = Object.assign({},next,{backgroundHighlight:{backgroundColor:deletedHighlight.background,gutterColor:deletedHighlight.gutter}});
        }
        return next;
    }
    // Deferred retention bookkeeping; runs immediately where timers are absent.
    function later(fn, ms, immediate) { if (typeof global.setTimeout === "function") return global.setTimeout(fn, ms); if (immediate !== false) fn(); return undefined; }
    function inspectedExport(id, key) {
        // Demand-load only a verified bundled helper at the UI action/render boundary.
        // No module scans, remote scripts, or eager initialization of unrelated screens.
        if (typeof global.__r !== "function") return null;
        try { const exports = global.__r(id); return exports && exports[key]; } catch (_) { return null; }
    }
    const PLATFORM_COLORS = {online:"#23a55a",idle:"#f0b232",dnd:"#f23f43"};
    const PLATFORM_LABELS = {desktop:"Desktop",mobile:"Mobile",web:"Web",embedded:"Console",vr:"VR"};
    // This user's clients as a stable key, so a badge only re-renders when its own presence changes.
    function platformClients(userId) {
        let clients = presenceStore.getClientStatus(userId);
        const current = userStore && userStore.getCurrentUser();
        if (current && current.id === userId && sessionsStore && typeof sessionsStore.getSessions === "function") {
            clients = {};
            Object.values(sessionsStore.getSessions() || {}).forEach(session => {
                const client = session.clientInfo && session.clientInfo.client;
                if (client && client !== "unknown") clients[client] = session.status;
            });
        }
        return clients || null;
    }
    function clientsKey(clients) {
        if (!clients) return "";
        let key = "";
        for (const name in clients) key += name + ":" + clients[name] + ",";
        return key;
    }
    function platformKey(userId) { return clientsKey(presenceStore && platformClients(userId)); }
    // One listener per store for every badge on screen, not two per badge. Each change works
    // out a person's clients once, however many badges show them, and wakes only those badges.
    const platformSubs = new Map(), platformStores = new Set();
    // PresenceStore changes for every presence update of anyone: the key is built without temporary arrays.
    function platformChanged() {
        platformSubs.forEach((entry, userId) => {
            const key = platformKey(userId);
            if (key !== entry.key) { entry.key = key; entry.fns.forEach(fn => fn()); }
        });
    }
    function platformSubscribe(userId, fn) {
        let entry = platformSubs.get(userId);
        if (!entry) platformSubs.set(userId, entry = {key:platformKey(userId), fns:new Set()});
        entry.fns.add(fn);
        [presenceStore,sessionsStore].forEach(store => {
            if (store && !platformStores.has(store) && typeof store.addChangeListener === "function" && typeof store.removeChangeListener === "function") {
                platformStores.add(store); store.addChangeListener(platformChanged);
            }
        });
        return () => {
            entry.fns.delete(fn);
            if (!entry.fns.size && platformSubs.get(userId) === entry) platformSubs.delete(userId);
            if (!platformSubs.size) { platformStores.forEach(store => store.removeChangeListener(platformChanged)); platformStores.clear(); }
        };
    }
    function PlatformBadges(props) {
        useSettings("platformIndicators");
        const [,update] = React.useState(0);
        // SessionsStore is the upstream source for the current user's own clients.
        if (enabled("platformIndicators")) {
            if (!sessionsStore) sessionsStore = inspectedExport(4855,"default");
            if (!presenceStore) presenceStore = inspectedExport(4877,"default");
            if (!userStore) userStore = inspectedExport(1378,"default");
        }
        const userId = props.userId;
        React.useEffect(() => platformSubscribe(userId, () => update(n => n+1)),[presenceStore,sessionsStore,userId]);
        if (!enabled("platformIndicators") || !presenceStore || !RN) return null;
        const clients = platformClients(userId);
        if (!clients) return null;
        const colors = PLATFORM_COLORS, labels = PLATFORM_LABELS;
        // One icon per reported client, in presence order.
        const icons = Object.keys(clients).filter(key => key !== "unknown" && colors[clients[key]]).map(key =>
            el(RN.View,{key,accessible:true,accessibilityRole:"image",accessibilityLabel:(labels[key] || key)+": "+clients[key]},
                el(PlatformPng,{platform:key,color:colors[clients[key]]})));
        return icons.length ? el(RN.View,{key:"venus-platforms",style:{flexDirection:"row",gap:2,alignItems:"center"}},icons) : null;
    }
    function platformName(orig, self, args) {
        if (React) useSettings("platformIndicators");
        const tree = orig.apply(self,args), user = args[0] && args[0].user;
        if (!enabled("platformIndicators") || !settings.piProfile || !React || !RN || !tree || !user) return tree;
        return el(RN.View,{style:{flexDirection:"row",flexWrap:"wrap",gap:6,alignItems:"center"}},tree,el(PlatformBadges,{userId:user.id}));
    }
    // DM header (HBC fn58674 PrivateChannelHeader) renders its name inside a separate
    // ChannelTitle component (fn58681, props title/accessibleTitle/userId), so the badge
    // goes inside ChannelTitle's own output: right after the name, before the arrow.
    // One cached wrapper per component and placement, so React keeps the same element type.
    const platformTypes = {piDmHeader:new WeakMap(), piUserList:new WeakMap()};
    function platformType(target, option) {
        let type = platformTypes[option].get(target);
        if (!type) platformTypes[option].set(target, type = function () { return platformPlacement(target,this,arguments,option); });
        return type;
    }
    function platformHeader(orig,self,args) {
        if (React) useSettings("platformIndicators");
        const tree = orig.apply(self,args);
        if (!enabled("platformIndicators") || !settings.piDmHeader || !React || !RN || !tree) return tree;
        let swapped = false;
        function visit(node,depth) {
            if (!node || depth > 18 || typeof node !== "object") return node;
            if (Array.isArray(node)) { const next = node.map(child => visit(child,depth+1)); return next.some((c,i)=>c!==node[i]) ? next : node; }
            if (!node.props) return node;
            const p = node.props;
            if (!swapped && typeof node.type === "function" && "accessibleTitle" in p && "title" in p && typeof p.userId === "string") {
                swapped = true;
                const type = platformType(node.type,"piDmHeader");
                return el(type,Object.assign({},p,{key:node.key}));
            }
            const child = visit(p.children,depth+1);
            return child === p.children ? node : React.cloneElement(node,{children:child});
        }
        const next = visit(tree,0);
        return swapped ? next : placePlatformTree(tree,args[0] || {},"piDmHeader");
    }
    // DM list rows (MessagesItemChannelContent, fn65485): the name shares its line with the
    // server tag, so icons go in the right-side channelIcons row beside the muted/favorite
    // icon (props muted/selected/blocked), above the timestamp.
    function platformDmRow(orig,self,args) {
        if (React) useSettings("platformIndicators");
        const tree = orig.apply(self,args), channel = args[0] && args[0].channel;
        if (!enabled("platformIndicators") || !settings.piUserList || !React || !RN || !tree || !channel) return tree;
        const userId = channel.type === 1 && Array.isArray(channel.recipients) && channel.recipients.length === 1 && channel.recipients[0];
        if (!userId) return tree;
        const isIcon = child => child && child.props && "muted" in child.props && "selected" in child.props && "blocked" in child.props;
        let added = false;
        const next = cloneTree(tree,(node,p) => {
            if (added || node.type === RN.Text) return p;
            const children = Array.isArray(p.children) ? p.children : [p.children];
            if (!children.some(isIcon)) return p;
            added = true;
            return Object.assign({},p,{children:children.concat(el(RN.View,{key:"venus-platform-dm",style:{marginRight:4}},el(PlatformBadges,{userId})))});
        },0);
        return added ? next : placePlatformTree(tree,args[0] || {},"piUserList");
    }
    function platformPlacement(orig,self,args,option) {
        if (React) useSettings("platformIndicators");
        return placePlatformTree(orig.apply(self,args),args[0] || {},option);
    }
    // Pure tree transform: header/DM fallbacks MUST NOT subscribe a second time.
    // Their chosen placement changes while loading, changing channels or toggling
    // settings; putting hooks here changes the parent fiber's hook count.
    function placePlatformTree(tree,props,option) {
        if (!enabled("platformIndicators") || (option && !settings[option]) || !React || !RN || !tree) return tree;
        const channel = props.channel || channelStore && props.channelId && channelStore.getChannel(props.channelId);
        const userId = props.user && props.user.id || props.userId || channel && channel.type === 1 && channel.recipients && channel.recipients.length === 1 && channel.recipients[0];
        if (!userId) return tree;
        // Verified UserRow exposes label; private headers / DM content expose a
        // channel-title Text; voice MemberRowItem exposes its username Text. Preserve
        // every handler, subtitle, trailing action and frozen child.
        let added = false;
        return cloneTree(tree,(node,p) => {
            if (added) return p;
            if (p.label != null && typeof p.label !== "string" && typeof p.label !== "number") {
                added = true;
                return Object.assign({},p,{label:el(RN.View,{key:"venus-platform-label",style:{flexDirection:"row",alignItems:"center",gap:6,flexShrink:1}},p.label,el(PlatformBadges,{userId}))});
            }
            const children = Array.isArray(p.children) ? p.children : [p.children];
            const title = children.find(child => child && child.props && (child.type === RN.Text && typeof child.props.children === "string" || typeof child.props.variant === "string" && /(?:channel-title|heading|semibold)/.test(child.props.variant) || typeof child.props.userName === "string" && "userId" in child.props));
            // A React Native Text must not contain a View.
            if (!title || node.type === RN.Text) return p;
            added = true;
            return Object.assign({},p,{children:children.map(child => child !== title ? child : el(RN.View,{key:"venus-platform-title",style:{flexDirection:"row",alignItems:"center",gap:6,flexShrink:1}},child,el(PlatformBadges,{userId})))});
        },0);
    }
    const platformRenderers = new WeakMap();
    function platformRow(row) {
        // Swap a list row's private UserRow for a cached wrapper adding badges after its label.
        if (!row || typeof row !== "object" || typeof row.type !== "function" || !React) return row;
        return el(platformType(row.type,"piUserList"),Object.assign({},row.props,{key:row.key}));
    }
    function wrapProfileTree(tree, target, operation, cache) {
        if (!tree || !target || !React) return tree;
        let patched = cache.get(target);
        if (!patched) {
            patched = function () { return operation(target,this,arguments); };
            cache.set(target,patched);
        }
        // cloneTree transforms props, not element types; replace the specific named
        // child without invoking it outside React's hook lifecycle.
        function visit(node,depth) {
            if (!node || depth>18 || typeof node!=="object" || !node.props) return node;
            if (node.type === target) return el(patched,Object.assign({},node.props,{key:node.key}));
            const children=node.props.children;
            if (Array.isArray(children)) {
                const next=children.map(child=>visit(child,depth+1));
                return next.some((child,i)=>child!==children[i]) ? React.cloneElement(node,{children:next}) : node;
            }
            const child=visit(children,depth+1);
            return child===children ? node : React.cloneElement(node,{children:child});
        }
        return visit(tree,0);
    }
    function hiddenInfo(orig,self,args) {
        if (React) useSettings("hiddenChannels");
        const tree = orig.apply(self,args), channel = args[0] && args[0].channel;
        if (!tree || !React || !RN || !hiddenMetadata(channel)) return tree;
        const icon = nativeLock || inspectedExport(5410,"LockIcon");
        if (!icon) return tree;
        // Lock next to hidden names, (20px lock, right margin).
        return el(RN.View,{style:{flexDirection:"row",alignItems:"center"},accessibilityLabel:hiddenName(channel)+", locked"},
            el(icon,{color:"#80848e",style:{width:20,height:20,marginRight:4}}),tree);
    }
    function authorizationUrl(result) {
        // Do not depend on a browser-complete global URL / URLSearchParams in RN.
        // Rebuild ONLY our fixed HTTPS endpoint; untrusted query keys cannot add
        // credentials, change the host, request another client mod or leak a token.
        const location = typeof result === "string" ? result : result && result.location;
        if (typeof location !== "string" || location.length > 8192) throw new Error("Invalid authorization redirect");
        const match = /^https:\/\/manti\.vendicated\.dev\/api\/reviewdb\/auth\?([^#]*)$/.exec(location);
        if (!match) throw new Error("Invalid authorization redirect");
        const values = {};
        match[1].split("&").forEach(part => {
            const index = part.indexOf("="), key = decodeURIComponent(index < 0 ? part : part.slice(0,index));
            if (!["code","error","error_description"].includes(key)) return;
            if (owns(values,key)) throw new Error("Invalid authorization redirect");
            values[key] = decodeURIComponent((index < 0 ? "" : part.slice(index+1)).replace(/\+/g," "));
        });
        if (values.error) throw new Error(values.error === "access_denied" ? "Authorization cancelled" : "Discord did not authorize ReviewDB");
        if (!values.code || values.code.length > 2048 || /[\s\u0000-\u001f]/.test(values.code)) throw new Error("Invalid authorization redirect");
        return REVIEW_API+"/auth?code="+encodeURIComponent(values.code)+"&returnType=json&clientMod=vendetta";
    }
    async function reviewJson(url,options,timeoutMessage) {
        const controller = typeof global.AbortController === "function" ? new global.AbortController() : null;
        let timer;
        const task = Promise.resolve().then(async () => {
            const response = await global.fetch(url,Object.assign({credentials:"omit",headers:{accept:"application/json","content-type":"application/json"}},options,controller ? {signal:controller.signal} : {}));
            let result;
            try {result = await response.json();} catch (_) {throw new Error("ReviewDB returned an unreadable response (HTTP "+response.status+")");}
            if (!response.ok || !result || result.success === false) throw new Error(result && result.message || "ReviewDB HTTP "+response.status);
            return result;
        });
        // Abort alone is insufficient on Android versions without AbortController,
        // or on fetch implementations that don't reject when the signal aborts.
        const timeout = new Promise((resolve,reject) => {
            if (global.setTimeout) timer = global.setTimeout(() => {reject(new Error(timeoutMessage || "ReviewDB took too long to respond. Try again."));if (controller) controller.abort();},15000);
        });
        try {return await Promise.race([task,timeout]);}
        finally {if (timer !== undefined && global.clearTimeout) global.clearTimeout(timer);}
    }
    async function reviewRequest(path, method, body) {
        if (!enabled("reviewDB") || typeof global.fetch !== "function") throw new Error("ReviewDB is disabled or networking is unavailable");
        if (!/^\/(users(?:\/\d{17,20}\/reviews)?|reports)(?:\?|$)/.test(path)) throw new Error("Invalid ReviewDB request");
        // Credentials go in the Authorization header as ReviewDB's API expects, never in
        // JSON bodies (which proxies and error reporters are more likely to log).
        const token = method && method !== "GET" ? reviewAuth() : "";
        const headers = {accept:"application/json","content-type":"application/json",...(token ? {authorization:token} : {})};
        return reviewJson(REVIEW_API+path,{method:method || "GET",headers,...(body ? {body:JSON.stringify(body)} : {})});
    }
    function clearReviewAuth() {
        // Every Discord logout lands here: only rewrite preferences when a sign-in was saved.
        const saved=!!(reviewToken || reviewAccount);
        reviewAuthAttempt++;reviewToken="";reviewAccount=null;reviewAuthState="idle";reviewAuthError="";
        reviewCache.clear();if (saved) save();notify("reviewDB");
    }
    // One UserStore listener for every review view, and it only wakes them when the signed-in
    // account actually changes. Before, each open view re-rendered every review view on any user update.
    let reviewWatchers=0, reviewWatchStore=null, reviewWatchId;
    function reviewUserChanged() {
        const id=currentId();
        if (id===reviewWatchId) return;
        reviewWatchId=id;
        reviewAuth();
        notify("reviewDB");
    }
    function useReviews() {
        useSettings("reviewDB");
        React.useEffect(() => {
            const store=userStore;
            if (!store || typeof store.addChangeListener!=="function") return;
            if (!reviewWatchers++) { reviewWatchStore=store; reviewWatchId=currentId(); store.addChangeListener(reviewUserChanged); }
            return () => {
                if (--reviewWatchers || !reviewWatchStore) return;
                if (typeof reviewWatchStore.removeChangeListener==="function") reviewWatchStore.removeChangeListener(reviewUserChanged);
                reviewWatchStore=null;
            };
        },[userStore]);
    }
    function currentId() { const user=userStore && userStore.getCurrentUser(); return user && user.id; }
    // Discord design-system parts traced in the pinned HBC98 bundle. Demand-loaded at
    // render/action time only; no extra Metro factories are wrapped for them.
    const reviewExports=new Map();
    let reviewParts=null;
    function reviewUI() {
        // Once every part has loaded, reuse the same object: this runs on every render.
        if (reviewParts) return reviewParts;
        // Keep successful exports, never a partially initialized UI snapshot.
        // Missing exports must be retried when Metro finishes initializing them.
        const x=(id,key) => {
            const slot=id+":"+key;
            if (reviewExports.has(slot)) return reviewExports.get(slot);
            const value=inspectedExport(id,key);
            if (value != null) reviewExports.set(slot,value);
            return value;
        };
        let tokens=null;
        try { const t=typeof global.__r==="function" && global.__r(588); tokens=t && (t.default || t); } catch (_) {}
        const parts={TableRow:x(5916,"TableRow"),TableRowGroup:nativeRowGroup || x(5997,"TableRowGroup"),TableSwitchRow:nativeSwitchRow || x(6621,"TableSwitchRow"),
            Stack:x(5280,"Stack"),Card:x(5918,"Card"),FormRow:x(8057,"FormRow"),FormLabel:x(8057,"FormLabel"),FormSubLabel:x(8057,"FormSubLabel"),
            TextInput:x(6021,"TextInput"),Send:x(4778,"SendMessageIcon"),ActionSheet:x(6624,"ActionSheet"),Header:x(6571,"BottomSheetTitleHeader"),
            Close:x(6619,"ActionSheetCloseButton"),sheets:x(4801,"default"),showSheet:x(4801,"showActionSheet"),simpleSheet:x(6616,"showSimpleActionSheet"),clipboard:x(6614,"Clipboard"),
            alerts:x(5205,"default"),toasts:x(4531,"default"),pushModal:x(4694,"pushModal"),popModal:x(4694,"popModal"),OAuth:oauthModal || x(8510,"default"),
            createStyles:x(4837,"createStyles"),theme:x(4551,"useThemeContext"),colors:tokens && tokens.colors};
        if (Object.keys(parts).every(key => parts[key] != null)) reviewParts=parts;
        return parts;
    }
    function reviewToast(ui,content) {
        try { if (ui.toasts && typeof ui.toasts.open==="function") ui.toasts.open({key:"venus-toast",content}); } catch (_) {}
    }
    function hideReviewSheet(ui,key) { try { if (ui.sheets && typeof ui.sheets.hideActionSheet==="function") ui.sheets.hideActionSheet(key); } catch (_) {} }
    // Styles from Discord's createStyles: semantic tokens resolve
    // per theme. Decided once so a mounted card never changes its hook count.
    let reviewStyleHook, reviewStylesTried=false;
    function useReviewStyles(ui) {
        if (!reviewStylesTried) {
            reviewStylesTried=true;
            const c=ui.colors;
            if (typeof ui.createStyles==="function" && c) try {
                reviewStyleHook=ui.createStyles({card:{backgroundColor:c.CARD_BACKGROUND_DEFAULT,borderRadius:16,padding:8},
                    row:{backgroundColor:c.CARD_SECONDARY_BG},text:{color:c.TEXT_DEFAULT},muted:{color:c.TEXT_MUTED},
                    placeholder:{color:c.INPUT_PLACEHOLDER_TEXT_DEFAULT}});
            } catch (_) { reviewStyleHook=null; }
        }
        let styles=null;
        if (reviewStyleHook) try { styles=reviewStyleHook(); } catch (_) {}
        return styles || {card:{borderRadius:16,padding:8},row:{},text:{},muted:{},placeholder:{}};
    }
    function ReviewSettings() {
        useReviews();
        const ui=reviewUI();
        if (!React || !RN || !ui.TableRow) return null;
        const authenticated=!!reviewAuth(), pending=reviewAuthState==="exchanging";
        const Group=ui.TableRowGroup || RN.View, Switch=ui.TableSwitchRow;
        const toggle=(key,label,subLabel) => switchRow(Switch,key,label,subLabel);
        const groups=[
            el(Group,{key:"auth",title:"Account"},
                el(ui.TableRow,{key:"login",label:pending ? "Signing in..." : authenticated ? "Signed in to ReviewDB" : "Sign in to ReviewDB",
                    arrow:true,disabled:!enabled("reviewDB") || authenticated || pending,onPress:authenticateReviews,subLabel:reviewAuthError || (authenticated ? undefined : "Needed to post, delete or report reviews. Never uses your Discord token.")}),
                el(ui.TableRow,{key:"logout",label:"Sign out of ReviewDB",variant:authenticated ? "danger" : undefined,disabled:!authenticated,onPress:clearReviewAuth,
                    subLabel:"ReviewDB stays in Discord's Authorized Apps until you remove it there."})),
            el(Group,{key:"settings",title:"Display"},
                toggle("reviewWarning","Show the be-respectful note","ReviewDB's reminder to be kind, shown above reviews.")),
            footnote("note","Reviews come from manti.vendicated.dev. Opening reviews sends that profile's or server's ID to ReviewDB.")];
        return settingsBody(ui,groups);
    }
    function NoDeleteSettings() {
        useSettings();
        const ui=reviewUI();
        const [draft,setDraft]=React.useState(String(settings.noDeleteLimit));
        // Follow the saved value when preferences finish loading after the page opened.
        React.useEffect(() => { setDraft(String(settings.noDeleteLimit)); },[settings.noDeleteLimit]);
        if (!React || !RN) return null;
        const Group=ui.TableRowGroup || RN.View, Switch=ui.TableSwitchRow;
        const toggle=(key,label,subLabel) => switchRow(Switch,key,label,subLabel);
        // An emptied field keeps the current maximum instead of silently resetting it to 512.
        const commit=() => { if (draft) setSetting("noDeleteLimit",draft); setDraft(String(settings.noDeleteLimit)); };
        const onText=text => setDraft(String(text).replace(/[^0-9]/g,"").slice(0,4));
        const inputProps={value:draft,keyboardType:"number-pad",maxLength:4,placeholder:"512",onBlur:commit,onSubmitEditing:commit,returnKeyType:"done",
            // Read-only while NoDelete is off, like the switches above it.
            editable:!!settings.noDelete,isDisabled:!settings.noDelete};
        // Discord's TextInput reports text via onChange(text); RN's via onChangeText.
        const input=ui.TextInput ? el(ui.TextInput,Object.assign({label:"Keep up to",onChange:onText},inputProps)) :
            el(RN.TextInput,Object.assign({onChangeText:onText,style:{fontSize:16,padding:12}},inputProps));
        const kept=deleted.size, changed=edits.size;
        const summary=!settings.noDelete ? "Turned off. Switch it on in Features to start." :
            kept || changed ? count(kept,"deleted message")+" and "+count(changed,"edited message")+" kept"+(settings.noDeleteSave ? ", saved on this phone." : " until Discord restarts.") :
            "Nothing kept yet. Deleted messages will show here.";
        const groups=[
            statusCard("status",summary),
            el(Group,{key:"edits",title:"Edited messages"},toggle("noDeleteEdits","Show edit history","What a message said before it was edited, faded and crossed out above it. Up to 10 versions each.")),
            el(Group,{key:"save",title:"Storage"},toggle("noDeleteSave","Keep after restarting","Deleted and edited messages survive closing Discord. Saved only on this phone, for this account.")),
            el(Group,{key:"limit",title:"Limit"},el(RN.View,{style:{padding:12,gap:8}},input)),
            footnote("limit-note","From 1 to "+MAX_DELETED+". When full, the oldest is removed first."),
            el(Group,{key:"clear",title:"Manage"},actionRow(ui,"clear","Clear kept messages","Removes every deleted message and edit history Venus kept, from chat and from this phone.",
                () => confirmAction("Clear kept messages?","Every deleted message and edit history Venus kept is removed. This can't be undone.","Clear",forgetKept),!kept && !changed,true)),
            footnote("note","Delete a kept message again to hide just that one.")];
        return settingsBody(ui,groups,{keyboardShouldPersistTaps:"handled"});
    }
    // Clear kept messages: every kept deletion leaves chat and the saved file, and so does edit history.
    // Removals go through Discord's own dispatch, bound before Venus hooked it, so they aren't kept again.
    function forgetKept() {
        const events=Array.from(deleted.values());
        deleted.clear(); deletedByChannel.clear(); edits.clear(); invalidateDeleted();
        dispatchRemovals(events); persistDeleted(); notify("noDelete");
        reviewToast(reviewUI(),"Kept messages cleared");
    }
    function authenticateReviews() {
        if (!enabled("reviewDB") || reviewAuthState==="exchanging") return;
        const ui=reviewUI();
        if (typeof ui.pushModal!=="function" || typeof ui.popModal!=="function" || !ui.OAuth) {RN.Alert.alert("ReviewDB","Discord's authorization screen is unavailable. Reopen this page and try again.");return;}
        const accountId=currentId();
        if (!accountId) {RN.Alert.alert("ReviewDB","Discord account unavailable");return;}
        const attempt=++reviewAuthAttempt, key="oauth2-authorize";
        let closed=false;
        reviewAuthError="";notify("reviewDB");
        const live=() => enabled("reviewDB") && attempt===reviewAuthAttempt && currentId()===accountId;
        const close=() => { if (closed) return; closed=true; try { ui.popModal(key); } catch (_) {} };
        function fail(error) {
            if (!live()) return;
            reviewAuthState="idle";reviewAuthError=String(error && error.message || error);notify("reviewDB");
            reviewToast(ui,"Authorization failed! "+reviewAuthError);
        }
        ui.pushModal({key,modal:{key,modal:ui.OAuth,animation:"slide-up",shouldPersistUnderModals:false,closable:true,props:{
            clientId:"915703782174752809",redirectUri:REVIEW_API+"/auth",scopes:["identify"],responseType:"code",permissions:BigInt(0),cancelCompletesFlow:false,
            // Traced in 347.12 and 348.10 (useOAuth2AuthorizeForm, fn124513): after Authorize the form calls
            // dismissOAuthModal FIRST, waits 100 ms, and only THEN calls callback({location}).
            // Dismissal is never a cancellation; treating it as one discarded every sign-in.
            dismissOAuthModal:close,
            callback:result => {
                close();
                if (!live() || !result || result.canceled===true) return;
                let url;
                try { url=authorizationUrl(result); } catch (error) { fail(error); return; }
                reviewAuthState="exchanging";notify("reviewDB");
                reviewJson(url,{method:"GET"},"ReviewDB took too long to authorize. Try again.").then(auth => {
                    if (!live()) return;
                    if (auth.success!==true || typeof auth.token!=="string" || !auth.token.trim() || auth.token.length>8192) throw new Error(auth.message || "ReviewDB did not return a token");
                    reviewToken=auth.token;reviewAccount=accountId;reviewAuthState="idle";reviewAuthError="";reviewCache.clear();
                    save();notify("reviewDB");reviewToast(ui,"Successfully authenticated with ReviewDB");
                }).catch(fail);
            }}}});
    }
    function reviewsFor(userId, refresh) {
        if (!/^\d{17,20}$/.test(userId)) return Promise.reject(new Error("Invalid profile ID"));
        const cached = reviewCache.get(userId);
        if (!refresh && cached && cached.expires>Date.now()) return cached.promise;
        // Refreshing a cached profile replaces it in place; only a new profile evicts the oldest one.
        if (cached) reviewCache.delete(userId);
        else if (reviewCache.size>=32) reviewCache.delete(reviewCache.keys().next().value);
        const promise=reviewRequest("/users/"+userId+"/reviews").then(result=>{
            if (!Array.isArray(result.reviews)) throw new Error("Invalid review list");
            return result.reviews.slice(0,100).filter(review=>review && review.sender && typeof review.comment==="string");
        }).catch(error=>{
            // A newer request for this profile owns the slot; only drop our own failed entry.
            const current=reviewCache.get(userId);
            if (current && current.promise===promise) reviewCache.delete(userId);
            throw error;
        });
        reviewCache.set(userId,{promise,expires:Date.now()+60000});return promise;
    }
    function reviewAuth() {
        const current=currentId();
        // Only an actual account switch invalidates the token; an unloaded store at startup does not.
        if (reviewToken && reviewAccount && current && current!==reviewAccount) {
            reviewAuthAttempt++;reviewToken="";reviewAccount=null;reviewAuthState="idle";reviewCache.clear();save();
        }
        return reviewToken;
    }
    let reviewAdminsLoaded=false;
    const reviewAdmins=new Set();
    function loadReviewAdmins() {
        if (reviewAdminsLoaded || typeof global.fetch!=="function") return;
        reviewAdminsLoaded=true;
        reviewJson("https://manti.vendicated.dev/admins",{method:"GET"}).then(list => {
            if (Array.isArray(list)) list.forEach(id => { if (typeof id==="string") reviewAdmins.add(id); });
        },() => {reviewAdminsLoaded=false;});
    }
    const reviewImage=uri => typeof uri==="string" && /^https:\/\//.test(uri);
    function reviewActions(review, owner, ui, refetch) {
        const system=review.type===3, me=currentId(), sender=review.sender || {};
        function confirm(title, content, onConfirm) {
            if (ui.alerts && typeof ui.alerts.show==="function") try { ui.alerts.show({title,body:content,confirmText:"Yes",cancelText:"No",onConfirm}); return; } catch (_) {}
            RN.Alert.alert(title,content,[{text:"No",style:"cancel"},{text:"Yes",style:"destructive",onPress:onConfirm}]);
        }
        function mutate(path, method, body, done) {
            reviewRequest(path,method,body).then(result => {reviewCache.delete(owner);refetch();reviewToast(ui,result && result.message || done);},
                error => reviewToast(ui,String(error && error.message || error)));
        }
        const options=[{label:"Copy Text",onPress:() => {
            try { (ui.clipboard || RN.Clipboard).setString(review.comment); } catch (_) {}
            reviewToast(ui,"Copied Review Text");
        }}];
        if (reviewAuth() && !system) {
            if (sender.discordID===me || owner===me || reviewAdmins.has(me)) options.push({label:"Delete Review",isDestructive:true,
                onPress:() => confirm("Delete Review","Are you sure you want to delete this review?",() => mutate("/users/"+owner+"/reviews","DELETE",{reviewid:review.id},"Review deleted"))});
            options.push({label:"Report Review",isDestructive:true,
                onPress:() => confirm("Report Review","Are you sure you want to report this review?",() => mutate("/reports","PUT",{reviewid:review.id},"Review reported"))});
        }
        const title=system ? "ReviewDB System Message" : "Review by "+String(sender.username || "Unknown");
        if (typeof ui.simpleSheet==="function") try {
            ui.simpleSheet({key:"ReviewOverflow",header:{title,onClose:() => hideReviewSheet(ui,"ReviewOverflow")},options});return;
        } catch (_) {}
        RN.Alert.alert(title,undefined,options.map(option => ({text:option.label,style:option.isDestructive ? "destructive" : "default",onPress:option.onPress}))
            .concat([{text:"Cancel",style:"cancel"}]));
    }
    function ReviewRow(props) {
        const review=props.review, ui=props.ui, styles=props.styles, sender=review.sender;
        const timestamp=review.type!==3 && Number.isFinite(review.timestamp) ? new Date(review.timestamp*1000).toLocaleDateString() : "";
        const badges=(Array.isArray(sender.badges) ? sender.badges.slice(0,8) : []).filter(badge => badge && reviewImage(badge.icon));
        const label=el(RN.View,{style:{flexDirection:"row",alignItems:"center"}},
            el(ui.FormLabel,{text:String(sender.username || "Unknown"),style:styles.text}),
            el(RN.View,{style:{flexDirection:"row",alignItems:"center"}},badges.map((badge,index) =>
                el(RN.Pressable,{key:String(index),style:{marginLeft:4},onPress:() => reviewToast(ui,String(badge.name || ""))},
                    el(RN.Image,{source:{uri:badge.icon,width:16,height:16},style:{width:16,height:16}})))),
            el(ui.FormLabel,{text:timestamp,style:[styles.muted,{marginLeft:5}]}));
        return el(ui.TableRowGroup || RN.View,{style:[styles.row]},
            el(ui.FormRow,{style:[styles.row],label,
                subLabel:el(ui.FormSubLabel,{text:review.comment,style:styles.text}),
                leading:reviewImage(sender.profilePhoto) ? el(RN.Image,{style:{height:36,width:36,borderRadius:18},source:{uri:sender.profilePhoto}}) : undefined,
                onLongPress:() => reviewActions(review,props.owner,ui,props.refetch)}));
    }
    let reviewThemeHook, reviewThemeTried=false;
    function ReviewInput(props) {
        const ui=props.ui, styles=props.styles;
        const [text,setText]=React.useState(""), [busy,setBusy]=React.useState(false);
        // Like the style hook, choose once. Retrying missing UI exports must not
        // add a theme hook to an input which already mounted without one.
        if (!reviewThemeTried) {reviewThemeTried=true;reviewThemeHook=typeof ui.theme==="function" ? ui.theme : null;}
        // 348.10 useThemeContext (fn31267) throws outside its Provider. Reviews
        // on a server are not a user profile; keep the hook call but use the
        // standard send color when that optional context is absent.
        let theme=null;
        if (reviewThemeHook) try {theme=reviewThemeHook();} catch (_) {}
        const authenticated=!!reviewAuth(), canSend=authenticated && !busy && text.trim().length>0;
        const placeholder=!authenticated ? "You must be authenticated to add a review." : "Tap to "+(props.shouldEdit ? "edit your" : "add a")+" review";
        function send() {
            if (!canSend || !text.trim()) return;
            setBusy(true);
            reviewRequest("/users/"+props.userId+"/reviews","PUT",{comment:text.trim()}).then(result => {
                setText("");props.refetch();reviewToast(ui,result && result.message || "Review posted");
            },error => reviewToast(ui,String(error && error.message || error))).then(() => setBusy(false));
        }
        const input=ui.TextInput ?
            el(ui.TextInput,{style:[{flex:1,fontSize:16},styles.text],isDisabled:!authenticated,placeholder,placeholderTextColor:styles.placeholder.color,
                value:text,onChange:setText,maxLength:1000}) :
            el(RN.TextInput,{style:[{flex:1,fontSize:16},styles.text],editable:authenticated,placeholder,placeholderTextColor:styles.placeholder.color,
                value:text,onChangeText:setText,maxLength:1000});
        const color=theme && theme.primaryColor || "#5865f2";
        return el(RN.View,{style:{flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:8,paddingVertical:4}},
            el(RN.View,{style:{flex:1}},input),
            el(RN.Pressable,{accessibilityRole:"button",accessibilityLabel:props.shouldEdit ? "Update review" : "Send review",disabled:!canSend,onPress:send,
                style:{minHeight:40,minWidth:40,borderRadius:999,alignItems:"center",justifyContent:"center",backgroundColor:color,opacity:canSend ? 1 : 0.25}},
                ui.Send ? el(ui.Send,{size:"sm",color:"#ffffff"}) : el(RN.Text,{style:{color:"#ffffff",fontWeight:"700"}},">")));
    }
    function ReviewSection(props) {
        useReviews();
        const ui=reviewUI(), styles=useReviewStyles(ui), userId=props.userId;
        const [reviews,setReviews]=React.useState(null), [generation,reload]=React.useState(0), [error,setError]=React.useState("");
        const valid=typeof userId==="string" && /^\d{17,20}$/.test(userId);
        React.useEffect(() => {
            let live=true;
            if (!enabled("reviewDB") || !valid) return;
            setReviews(null);setError("");loadReviewAdmins();
            reviewsFor(userId,generation>0).then(list => {if (live) setReviews(list);},failure => {
                if (live) {setReviews(null);setError(String(failure && failure.message || failure).slice(0,512));}
            });
            return () => {live=false;};
        },[userId,generation,settings.reviewDB]);
        const Card=props.standalone ? RN && RN.View : ui.Card;
        if (!enabled("reviewDB") || !valid || !RN || !Card || !ui.FormRow) return null;
        const list=reviews || [], me=currentId();
        const shown=settings.reviewWarning ? list : list.filter(review => review.type!==3);
        const refetch=() => {reviewCache.delete(userId);reload(n => n+1);};
        const rows=error ? el(RN.View,{style:{gap:8}},
            el(RN.Text,{accessibilityRole:"alert",style:styles.text},"Couldn't load reviews: "+error),
            el(RN.Pressable,{accessibilityRole:"button",accessibilityLabel:"Retry reviews",onPress:refetch,style:{padding:12}},el(RN.Text,{style:styles.text},"Retry"))) :
            reviews===null ? el(RN.Text,{accessibilityLiveRegion:"polite",style:styles.muted},"Loading reviews...") :
            !shown.length ? el(RN.Text,{style:styles.muted},"No reviews yet.") :
            shown.map((review,index) => el(ReviewRow,{key:(review.id==null ? "" : String(review.id))+":"+index,review,owner:userId,ui,styles,refetch}));
        return el(RN.View,{style:[styles.card]},
            el(Card,props.standalone ? {accessibilityLabel:"Reviews"} : {title:"Reviews"},
                el(RN.View,{style:{gap:8}},rows),
                el(ReviewInput,{userId,ui,styles,refetch,shouldEdit:list.some(review => review.type!==3 && review.sender.discordID===me)})));
    }
    function ReviewSheet(props) {
        const ui=reviewUI();
        return el(ui.ActionSheet,{header:ui.Header ? el(ui.Header,{title:"Reviews",trailing:ui.Close ? el(ui.Close,{onPress:() => hideReviewSheet(ui,props.sheetKey)}) : undefined}) : undefined},
            el(RN.View,null,el(RN.ScrollView,{style:{gap:12,marginBottom:12}},el(ReviewSection,{userId:props.userId,standalone:true}))));
    }
    function openReviewSheet(userId) {
        if (!enabled("reviewDB") || !React || !RN || typeof userId!=="string" || !/^\d{17,20}$/.test(userId)) return;
        const ui=reviewUI();
        if (!ui.ActionSheet || typeof ui.showSheet!=="function") { reviewToast(ui,"Reviews are unavailable. Reopen the server menu and try again."); return; }
        // 4801's NAMED showActionSheet (HBC fn32121) takes an already-created
        // element, then schedules SHOW_ACTION_SHEET through Dispatcher.wait.
        // Reviews are bundled, not lazy imports: avoid openLazy's detached Promise
        // chain entirely. The inspected store (fn31181) accepts "stack".
        const key="VenusReviews:"+userId;
        try { ui.showSheet({key,content:el(ReviewSheet,{userId,sheetKey:key}),stackingBehavior:"stack"}); }
        catch (error) { reviewToast(ui,"Couldn't open reviews: "+String(error && error.message || error)); }
    }
    // Profiles: reviews go in as the LAST card of the profile card stack
    // (after the note). In 348.10 UserProfileNote (12627) is that last card in the normal, bot,
    // tabbed and You-screen layouts, so reviews render directly beneath it.
    function reviewNote(orig,self,args) {
        const tree=orig.apply(self,args), userId=args[0] && args[0].userId;
        if (!React || !RN || !features.reviewDB || typeof userId!=="string") return tree;
        return el(React.Fragment,null,tree,el(ReviewSection,{key:"venus-reviews:"+userId,userId}));
    }
    // The server sheet already supplies its native scrolling/presentation context
    // (GuildActionSheet fn60681). Expand content there instead of spawning a second
    // dialog. No detached dispatcher callback, new portal or nested RN ScrollView.
    function ServerReviews(props) {
        useReviews();
        const [open,setOpen]=React.useState(false), ui=reviewUI();
        React.useEffect(() => {setOpen(false);},[props.guildId]);
        if (!enabled("reviewDB") || !RN || !ui.TableRow) return null;
        return el(RN.View,null,
            el(ui.TableRowGroup || RN.View,null,el(ui.TableRow,{label:"Reviews",arrow:!open,
                subLabel:open ? "Tap to close server reviews." : "Read and write community reviews for this server.",
                accessibilityState:{expanded:open},onPress:() => {if (enabled("reviewDB")) setOpen(value => !value);}})),
            open ? el(ReviewSection,{key:props.guildId,userId:props.guildId,standalone:true}) : null);
    }
    function reviewGuild(orig,self,args) {
        if (React) useSettings("reviewDB");
        const props=args[0] || {}, guild=props.guild, ui=reviewUI();
        if (!enabled("reviewDB") || !React || !RN || !guild || !/^\d{17,20}$/.test(guild.id) || !ui.TableRow) return React ? el(orig,props) : orig.apply(self,args);
        return el(ServerReviews,{key:guild.id,guildId:guild.id});
    }
    // User long-press context menu gets a "Reviews" item.
    function reviewMenu(orig,self,args) {
        const props=args[0], menu=props && props.menu, id=menu && menu.key;
        if (!enabled("reviewDB") || !menu || !Array.isArray(menu.items) || menu.items.length!==3 || typeof id!=="string" || !/^\d{17,20}$/.test(id)) return orig.apply(self,args);
        const next=Array.from(args);
        next[0]=Object.assign({},props,{menu:Object.assign({},menu,{items:menu.items.concat([{label:"Reviews",action:() => openReviewSheet(id)}])})});
        return orig.apply(self,next);
    }
    // Rewrites a component's props before Discord's own render, through memo and forwardRef wrappers.
    // The change runs inside the render, so it may use hooks, and it always runs, so the hook count never changes.
    function propsComponent(component, change) {
        if (typeof component === "function") {
            const patched = function (props) {
                const args = Array.from(arguments); args[0] = change(props);
                return component.apply(this, args);
            };
            if (component.displayName) patched.displayName = component.displayName;
            return patched;
        }
        if (component && typeof component === "object" && component.$$typeof) for (const key of ["type", "render"]) {
            const inner = data(component, key);
            if (!inner || typeof inner !== "function" && typeof inner !== "object") continue;
            const patched = propsComponent(inner, change);
            if (patched !== inner) return cloneWith(component, key, patched);
        }
        return component;
    }
    function withoutGift(props) {
        useSettings("hideGift");
        return enabled("hideGift") && props && props.shouldShowGiftButton ? Object.assign({}, props, {shouldShowGiftButton:false}) : props;
    }
    // Hide call button: UserProfileContactButtons (12696) draws Message and Call side by side, each in a
    // flex:1 slot, or as icon buttons next to a friend button. Its disableCalls prop only greys Call out, so
    // the Call button and the slot it sat in are left out of what it renders. Message's slot then takes the
    // whole row, and the change animates when the setting flips while a profile is open.
    // The icon is looked up once per render, not once for every element in the row.
    function withoutCall(node, depth, Phone) {
        if (!node || typeof node !== "object" || depth > 12) return node;
        if (Array.isArray(node)) {
            let changed = false;
            const next = node.map(child => { const value = withoutCall(child, depth + 1, Phone); if (value !== child) changed = true; return value; });
            return changed ? next.filter(child => child !== null) : node;
        }
        if (!node.props) return node;
        const icon = node.props.icon;
        if (icon && icon.type === Phone) return null;
        const children = node.props.children, next = withoutCall(children, depth + 1, Phone);
        if (next === children) return node;
        // A slot that only held the Call button goes too, so nothing keeps half the row.
        if (next === null || Array.isArray(next) && !next.length) return null;
        return React.cloneElement(node, Object.assign({}, node.props, {children:next}));
    }
    function profileButtons(orig, self, args) {
        useSettings("hideCall");
        const hidden = !!enabled("hideCall"), last = React.useRef(hidden);
        if (last.current !== hidden) {
            last.current = hidden;
            const animate = RN && RN.LayoutAnimation;
            try { if (animate && animate.Presets) animate.configureNext(animate.Presets.easeInEaseOut); } catch (_) {}
        }
        const rendered = orig.apply(self, args);
        if (!hidden) return rendered;
        const Phone = inspectedExport(7309, "PhoneCallIcon");
        return Phone ? withoutCall(rendered, 0, Phone) : rendered;
    }
    // Discord's own "no Quest to show" answer, so the dock, the space kept for it and its tracking all go away together.
    let noQuestDock = null;
    function questDockHidden() { useSettings("hideQuestDock"); return enabled("hideQuestDock"); }
    function hideQuestHooks(exports) {
        const types = inspectedExport(5764, "AdCreativeType");
        if (!types || types.NO_FILL === undefined) return exports;
        noQuestDock = Object.freeze({type:types.NO_FILL});
        exports = hookExport(exports, "useMobileQuestDock", (orig, self, args) => { const dock = orig.apply(self, args); return questDockHidden() ? noQuestDock : dock; });
        exports = hookExport(exports, "useMobileQuestDockHeight", (orig, self, args) => { const height = orig.apply(self, args); return questDockHidden() ? 0 : height; });
        for (const key of ["useIsMobileQuestDockRendered", "useIsMobileQuestDockRenderedBase", "useIsMobileQuestDockVisibleToUser"])
            exports = hookExport(exports, key, (orig, self, args) => { const value = orig.apply(self, args); return questDockHidden() ? false : value; });
        return exports;
    }
    // The dock itself sits in its own component, so switching it off unmounts it instead of changing its hooks.
    function hideQuestDock(exports) {
        const Dock = exports && exports.default;
        if (!Dock) return exports;
        const HiddenQuestDock = function (props) { return questDockHidden() ? null : el(Dock, props); };
        HiddenQuestDock.displayName = "QuestDock";
        return replaceValue(exports, "default", HiddenQuestDock);
    }
    // React Native emojis (reaction lists, statuses, the emoji grid) draw a Unicode emoji with the phone's
    // font when forceTextEmoji is set. Only Unicode emojis: custom ones have a CDN picture and a word for a name.
    function systemEmojiProps(props) {
        // A word is a custom emoji's name. Keycaps (#\uFE0F\u20E3, 1\uFE0F\u20E3...) start with a digit or # but
        // are Unicode emojis too, and used to keep Discord's picture.
        if (!emojiInUse || !features.systemEmoji || !props || props.forceTextEmoji || typeof props.name !== "string" || !props.name ||
            /[A-Za-z_:]/.test(props.name) || /[0-9#*]/.test(props.name) && !/^[0-9#*]\uFE0F?\u20E3$/.test(props.name)) return props;
        const src = props.src, uri = src && typeof src === "object" ? src.uri : src;
        if (uri != null && !(typeof uri === "string" && /^asset:/.test(uri))) return props;
        return Object.assign({}, props, {forceTextEmoji:true});
    }
    function cloneWith(object, key, value) {
        // ES module markers, React tags, symbols and lazy getters are not necessarily enumerable.
        // Object.assign loses them and Metro imports the exports object as a component.
        const descriptors = Object.getOwnPropertyDescriptors(object);
        const old = descriptors[key];
        descriptors[key] = { value, writable: true, configurable: true, enumerable: old ? old.enumerable : true };
        return Object.create(Object.getPrototypeOf(object), descriptors);
    }
    function replaceValue(object, key, value) {
        const descriptor = Object.getOwnPropertyDescriptor(object, key);
        // Flux/store methods live on prototypes. Shadow them on the same instance:
        // cloning a live store would split dispatch state, subscriptions or private fields.
        if (!descriptor && Object.isExtensible(object)) {
            Object.defineProperty(object, key, {value, writable:true, configurable:true, enumerable:true});
            return object;
        }
        if (descriptor && descriptor.configurable) {
            Object.defineProperty(object, key, { value, writable: true, configurable: true, enumerable: descriptor.enumerable });
            return object;
        }
        if (descriptor && "value" in descriptor && descriptor.writable) { object[key] = value; return object; }
        return cloneWith(object, key, value);
    }
    function hookExport(exports, key, operation) {
        const orig = exports && exports[key];
        if (typeof orig !== "function") return exports;
        const patched = function () { return operation(orig, this, arguments); };
        return replaceValue(exports, key, patched);
    }
    // Hook a component export (plain function, or memo/forwardRef object) without breaking React tags.
    function hookComponent(exports, operation, key) {
        key = key || "default";
        const component = exports && exports[key];
        if (component && typeof component === "object" && component.$$typeof) {
            const inner = typeof component.type === "function" ? "type" : typeof component.render === "function" ? "render" : null;
            if (!inner) return exports;
            const orig = component[inner];
            return replaceValue(exports, key, cloneWith(component, inner, function () { return operation(orig, this, arguments); }));
        }
        return hookExport(exports, key, operation);
    }
    // Fix unknown mentions (based on ValidUser by fshin, o.oer and kmmiio99o): a mention of someone Discord hasn't
    // loaded shows as @unknown-user. Instead of a "Fix mentions" button on every message, messages are checked as
    // they arrive or load. Unknown IDs are looked up one at a time with Discord's own getUser (GET /users/:id, which
    // adds the user to UserStore), and each affected message is redrawn so the mention shows the name.
    const MENTION_ID = /<@!?(\d{17,20})>/g;
    const VALID_EVENTS = ["MESSAGE_CREATE", "MESSAGE_UPDATE", "LOAD_MESSAGES_SUCCESS", "LOAD_MESSAGES_AROUND_SUCCESS", "LOCAL_MESSAGES_LOADED"];
    const valid = {dispatcher:null, queue:[], queued:new Set(), tried:new Set(), waiting:new Map(), running:false, refreshing:new Set(), generation:0};
    function mentionIds(text, out) {
        // Most text has no mention at all: one indexOf, no regex run.
        if (typeof text !== "string" || text.indexOf("<@") < 0) return;
        MENTION_ID.lastIndex = 0;
        let match;
        while ((match = MENTION_ID.exec(text))) out.add(match[1]);
    }
    function componentIds(components, out, depth) {
        if (!Array.isArray(components) || depth > 6) return;
        for (const component of components) if (component) {
            mentionIds(component.content, out);
            componentIds(component.components, out, depth + 1);
        }
    }
    // Every place a raw (server-shaped) message can mention someone: text, embeds, components and forwards.
    function messageMentionIds(message, out) {
        mentionIds(message.content, out);
        if (Array.isArray(message.embeds)) for (const embed of message.embeds) if (embed) {
            mentionIds(embed.title, out); mentionIds(embed.description, out);
            mentionIds(embed.rawTitle, out); mentionIds(embed.rawDescription, out);
            if (embed.footer) mentionIds(embed.footer.text, out);
            if (Array.isArray(embed.fields)) for (const field of embed.fields) if (field) {
                mentionIds(field.name, out); mentionIds(field.value, out); mentionIds(field.rawName, out); mentionIds(field.rawValue, out);
            }
        }
        componentIds(message.components, out, 0);
        const snapshots = message.message_snapshots || message.messageSnapshots;
        if (Array.isArray(snapshots)) for (const snapshot of snapshots) {
            const inner = snapshot && snapshot.message;
            if (inner) { mentionIds(inner.content, out); componentIds(inner.components, out, 0); }
        }
        return out;
    }
    function knownUser(id) { try { return !!(userStore && userStore.getUser(id)); } catch (_) { return true; } }
    function validInit(dispatcher) {
        if (valid.dispatcher || !dispatcher || typeof dispatcher.subscribe !== "function") return;
        valid.dispatcher = dispatcher;
        VALID_EVENTS.forEach(type => dispatcher.subscribe(type, validEvent));
        dispatcher.subscribe("LOGOUT", validReset);
    }
    function validReset() {
        valid.generation++; valid.queue.length = 0; valid.queued.clear(); valid.tried.clear(); valid.waiting.clear(); valid.running = false;
    }
    // One reused set per check: a channel load hands over 50 messages at once.
    const validScratch = new Set();
    function validEvent(event) {
        if (!enabled("validUser") || !event || !userStore) return;
        const channelId = event.channelId;
        if (event.message) validMessage(event.message, event.message.channel_id || channelId);
        if (Array.isArray(event.messages)) for (const message of event.messages) validMessage(message, message && message.channel_id || channelId);
    }
    function validMessage(message, channelId) {
        if (!message || !message.id || !channelId || valid.refreshing.has(message.id)) return;
        validScratch.clear();
        messageMentionIds(message, validScratch);
        if (!validScratch.size) return;
        const missing = [];
        validScratch.forEach(id => { if (!valid.tried.has(id) && !knownUser(id)) missing.push(id); });
        validScratch.clear();
        if (!missing.length) return;
        // Remember the raw message so it can be redrawn once its people are known.
        const key = channelId + ":" + message.id;
        let entry = valid.waiting.get(key);
        if (!entry) {
            if (valid.waiting.size >= 300) valid.waiting.delete(valid.waiting.keys().next().value);
            valid.waiting.set(key, entry = {channelId, id:message.id, ids:new Set()});
        }
        entry.content = typeof message.content === "string" ? message.content : "";
        entry.embeds = Array.isArray(message.embeds) ? message.embeds : null;
        entry.components = Array.isArray(message.components) ? message.components : null;
        missing.forEach(id => {
            entry.ids.add(id);
            if (!valid.queued.has(id)) { valid.queued.add(id); valid.queue.push(id); }
        });
        // Never dispatch in the middle of Discord's own dispatch.
        if (!valid.running) { valid.running = true; later(validNext, 250); }
    }
    function deletedUser(id) {
        return {id, username:"Deleted User", global_name:null, discriminator:"0000", avatar:null, avatar_decoration_data:null, bot:false, system:false, public_flags:0};
    }
    function validNext() {
        const generation = valid.generation;
        if (!enabled("validUser")) { valid.running = false; return; }
        const id = valid.queue.shift();
        if (id === undefined) { valid.running = false; return; }
        valid.queued.delete(id);
        if (valid.tried.size >= 5000) valid.tried.delete(valid.tried.values().next().value);
        valid.tried.add(id);
        const getUser = inspectedExport(7630, "getUser");
        let wait = 400;
        Promise.resolve().then(() => {
            if (knownUser(id)) return;
            if (typeof getUser !== "function") throw new Error("getUser unavailable");
            return getUser(id);
        }).catch(error => {
            const code = error && (error.status || error.statusCode), body = error && error.body;
            // Only a real "Unknown User" answer means the account is gone; anything else is retried later.
            if (code === 404 || body && body.code === 10013) {
                if (valid.dispatcher) valid.dispatcher.dispatch({type:"USER_UPDATE", user:deletedUser(id)});
            } else {
                valid.tried.delete(id);
                if (code === 429) {
                    const retry = Number(body && body.retry_after);
                    wait = Math.min(60000, Math.max(1000, Number.isFinite(retry) ? retry * 1000 : 5000));
                    if (!valid.queued.has(id)) { valid.queued.add(id); valid.queue.unshift(id); }
                }
            }
        }).then(() => {
            if (generation !== valid.generation) return;
            validRefresh();
            later(validNext, wait);
        });
    }
    // Redraw each waiting message whose people are all known now. Discord keeps a row until its message record
    // changes, so its text is changed for a moment (a zero-width space) and then put back, like ValidUser does.
    function validRefresh() {
        if (!valid.dispatcher) return;
        for (const [key, entry] of Array.from(valid.waiting)) {
            let pending = false;
            entry.ids.forEach(id => { if (!knownUser(id) && (valid.queued.has(id) || !valid.tried.has(id))) pending = true; });
            if (pending) continue;
            valid.waiting.delete(key);
            if (!Array.from(entry.ids).some(knownUser)) continue;
            validRedraw(entry);
        }
    }
    function validRedraw(entry) {
        const dispatch = message => { try { valid.dispatcher.dispatch({type:"MESSAGE_UPDATE", message}); } catch (_) {} };
        const restore = {id:entry.id, channel_id:entry.channelId};
        if (entry.content) restore.content = entry.content;
        else {
            if (entry.embeds && entry.embeds.length) restore.embeds = entry.embeds;
            if (entry.components && entry.components.length) restore.components = entry.components;
        }
        valid.refreshing.add(entry.id);
        if (entry.content) {
            dispatch({id:entry.id, channel_id:entry.channelId, content:entry.content + "\u200b"});
            later(() => { dispatch(restore); valid.refreshing.delete(entry.id); }, 120);
        } else {
            // New embed and component arrays make a new record by themselves.
            if (restore.embeds || restore.components) dispatch(restore);
            valid.refreshing.delete(entry.id);
        }
    }

    // Settings button on the profile bar ("You bar"), next to the notifications bell. Same button Discord uses for
    // its own bar buttons (YouBarButton 16031), with Discord's settings icon, opening Discord's own settings.
    let youBarParts = null;
    function YouBarSettingsButton(props) {
        useSettings("youBarSettings");
        if (!enabled("youBarSettings") || !RN) return null;
        // Looked up once they've all loaded, not on every render of the bar.
        if (!youBarParts) {
            const Button = inspectedExport(16031, "default"), Icon = inspectedExport(6799, "SettingsIcon");
            if (!Button || !Icon) return null;
            const size = inspectedExport(14615, "YOU_BAR_BUTTON_ICON_SIZE") || 20;
            youBarParts = {Button, Icon, style:{width:size, height:size}};
        }
        const nameplate = !!(props && props.hasNameplate);
        return el(youBarParts.Button, {hasNameplate:nameplate, hasBadge:false, accessibilityLabel:"Venus settings", onPress:openSettings,
            icon:el(youBarParts.Icon, {size:"custom", style:youBarParts.style, color:nameplate ? "white" : undefined})});
    }
    // Opens Venus settings, not Discord's. openUserSettings (6801) opens the settings navigator on the screen it's
    // given, and every settings route node, VENUS_PLUGINS too, is one of that navigator's screens (14239
    // getSettingScreens), so Back goes to Discord's settings like when you open Venus from there.
    function openSettings() {
        const screen = status.menu ? "VENUS_PLUGINS" : undefined;
        const open = inspectedExport(6801, "openUserSettings");
        try { if (typeof open === "function") { open(screen ? {screen} : undefined); return; } } catch (_) {}
        try { const ref = inspectedExport(4695, "getRootNavigationRef"); const nav = ref && ref(); if (nav) nav.navigate("settings", screen ? {screen} : undefined); } catch (_) {}
    }
    function youBarButtons(orig, self, args) {
        // Always the same shape, so switching it on or off never remounts the bell.
        return el(React.Fragment, null, orig.apply(self, args), el(YouBarSettingsButton, {hasNameplate:args[0] && args[0].hasNameplate}));
    }

    // Send messages longer than the limit (based on SplitLargeMessages by sunnie): the message box accepts
    // any length, and a long message is sent as several, each within Discord's limit.
    const SPLIT_UNLIMITED = 1 << 30;
    const realLimits = {normal:2000, premium:4000};
    function messageLimit() {
        const user = currentUser();
        if (!user) return realLimits.normal;
        try {
            const premium = inspectedExport(4491, "default");
            const check = premium && premium.canUseIncreasedMessageLength;
            if (typeof check === "function") return check.call(premium, user) ? realLimits.premium : realLimits.normal;
        } catch (_) {}
        return user.premiumType === 2 ? realLimits.premium : realLimits.normal;
    }
    // Splits at the last line break, else the last space, else anywhere. A code block cut in two is closed at
    // the end of one part and opened again, with its language, at the start of the next.
    const FENCE = /```([^\s`]{0,20})/g;
    function splitContent(text, limit) {
        const chunks = [];
        let rest = text, prefix = "";
        while (prefix.length + rest.length > limit) {
            const budget = limit - prefix.length - 4;
            if (budget < 16) return null;
            let cut = rest.lastIndexOf("\n", budget);
            if (cut < budget / 2) { const space = rest.lastIndexOf(" ", budget); if (space > cut) cut = space; }
            if (cut <= 0) cut = budget;
            const code = rest.charCodeAt(cut - 1);
            if (code >= 0xD800 && code <= 0xDBFF) cut--;
            let piece = prefix + rest.slice(0, cut);
            rest = rest.slice(cut);
            if (rest[0] === "\n" || rest[0] === " ") rest = rest.slice(1);
            let open = false, language = "", match;
            FENCE.lastIndex = 0;
            while ((match = FENCE.exec(piece))) { open = !open; if (open) language = match[1]; }
            if (open) { piece += "\n```"; prefix = "```" + language + "\n"; } else prefix = "";
            if (piece.trim()) chunks.push(piece);
        }
        const last = prefix + rest;
        if (last.trim() && last.trim() !== prefix.trim()) chunks.push(last);
        return chunks;
    }
    function splitSend(orig, self, args) {
        const channelId = args[0], message = args[1];
        // Hot path: every send that fits goes straight through after one length check.
        if (!message || typeof message.content !== "string" || message.content.length <= 2000 || !enabled("splitMessages")) return orig.apply(self, args);
        const limit = messageLimit();
        if (message.content.length <= limit) return orig.apply(self, args);
        const chunks = splitContent(message.content, limit);
        if (!chunks || chunks.length < 2) return orig.apply(self, args);
        const first = Array.from(args); first[1] = Object.assign({}, message, {content:chunks[0]});
        const result = orig.apply(self, first);
        const channel = channelStore && channelStore.getChannel(channelId);
        const slowmode = channel && Number(channel.rateLimitPerUser) || 0;
        const gap = Math.max(1000, slowmode * 1000 + 500);
        // The rest follow one at a time, without the reply, after the first one is sent.
        let chain = Promise.resolve(result).catch(() => {});
        chunks.slice(1).forEach(content => {
            chain = chain.then(() => new Promise(resolve => later(resolve, gap))).then(() => {
                if (!enabled("splitMessages")) return;
                return orig.call(self, channelId, {content, tts:false, invalidEmojis:message.invalidEmojis || [],
                    validNonShortcutEmojis:message.validNonShortcutEmojis || []}, undefined, {});
            }).catch(() => {});
        });
        return result;
    }
    // useMessageMaxLength (8602): the message box, its counter and the "too long" check all ask it.
    function maxLengthModule(exports) {
        const big = (orig, self, args) => { const value = orig.apply(self, args); return enabled("splitMessages") ? SPLIT_UNLIMITED : value; };
        exports = hookExport(exports, "getMaxMessageLength", big);
        return hookExport(exports, "default", (orig, self, args) => {
            if (React) useSettings("splitMessages");
            return big(orig, self, args);
        });
    }
    // Constants (1086): DraftStore keeps drafts up to the premium limit + 500. Read live, so it follows the switch.
    function lengthConstants(exports) {
        if (!exports) return exports;
        for (const [key, slot] of [["MAX_MESSAGE_LENGTH", "normal"], ["MAX_MESSAGE_LENGTH_PREMIUM", "premium"]]) {
            const descriptor = Object.getOwnPropertyDescriptor(exports, key);
            if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "number" || !descriptor.configurable) continue;
            realLimits[slot] = descriptor.value;
            const value = descriptor.value;
            Object.defineProperty(exports, key, {configurable:true, enumerable:descriptor.enumerable,
                get:() => enabled("splitMessages") ? SPLIT_UNLIMITED : value, set:() => {}});
        }
        return exports;
    }

    // Translate messages: every message on screen that isn't in your language is shown translated, with a note
    // saying from what. Google Translate's free, keyless endpoint (the one its browser extension uses) translates
    // and detects the language in one go, and takes many messages per request: messages are sent in batches, only
    // once each, and only when they're drawn. Mentions, emojis, links, code and timestamps are never sent as text:
    // they're replaced by numbered tags the translator keeps in place, and put back as they were.
    const TRANSLATE_HOSTS = ["https://translate.googleapis.com", "https://clients5.google.com"];
    const TRANSLATE_PATH = "/translate_a/t?client=dict-chrome-ex&sl=auto&tl=";
    // Per request: Google accepts more, but smaller requests fail less and look like the extension's.
    const TRANSLATE_BATCH = 40, TRANSLATE_BATCH_CHARS = 6000, TRANSLATE_MAX_TEXT = 4500, TRANSLATE_CACHE = 2000;
    // Up to three requests at once, each with its own timeout: one slow answer no longer holds up the rest.
    // Translations are saved on the phone, so a chat opened again after a restart needs no request at all.
    const TRANSLATE_PARALLEL = 3, TRANSLATE_TIMEOUT_MS = 8000, TRANSLATE_FILE = "venus-translations.json", TRANSLATE_SAVED = 1500, TRANSLATE_SAVED_BYTES = 2 * 1024 * 1024;
    // Formatting whose words are translated. Every other node (mentions, emojis, links, code, timestamps) is kept as it is.
    const TRANSLATE_GROUPS = new Set(["strong", "em", "u", "s", "spoiler", "blockQuote", "subtext", "heading", "paragraph", "link"]);
    // Letters of any script, but not digits, punctuation or emojis (surrogates): those need no translating.
    const TRANSLATE_LETTER = /[A-Za-z\u00C0-\u024F\u0370-\u1FFF\u2C00-\uD7FF\uF900-\uFDFF\uFE70-\uFEFF\uFF21-\uFF5A\uFF66-\uFFDC]/g;
    const LANGUAGE_NAMES = {af:"Afrikaans", ar:"Arabic", bg:"Bulgarian", bn:"Bengali", ca:"Catalan", cs:"Czech", cy:"Welsh", da:"Danish", de:"German",
        el:"Greek", en:"English", eo:"Esperanto", es:"Spanish", et:"Estonian", fa:"Persian", fi:"Finnish", fil:"Filipino", tl:"Filipino", fr:"French",
        ga:"Irish", gl:"Galician", gu:"Gujarati", he:"Hebrew", hi:"Hindi", hr:"Croatian", hu:"Hungarian", hy:"Armenian", id:"Indonesian", is:"Icelandic",
        it:"Italian", ja:"Japanese", jv:"Javanese", ka:"Georgian", kk:"Kazakh", km:"Khmer", ko:"Korean", la:"Latin", lt:"Lithuanian", lv:"Latvian",
        mk:"Macedonian", ml:"Malayalam", mn:"Mongolian", mr:"Marathi", ms:"Malay", my:"Burmese", ne:"Nepali", nl:"Dutch", no:"Norwegian", pa:"Punjabi",
        pl:"Polish", pt:"Portuguese", ro:"Romanian", ru:"Russian", sk:"Slovak", sl:"Slovenian", sq:"Albanian", sr:"Serbian", sv:"Swedish", sw:"Swahili",
        ta:"Tamil", te:"Telugu", th:"Thai", tr:"Turkish", uk:"Ukrainian", ur:"Urdu", uz:"Uzbek", vi:"Vietnamese", zh:"Chinese"};
    let localeStore = null;
    const translate = {dispatcher:null, cache:new Map(), queue:[], shown:new Map(), timer:undefined, active:0,
        host:0, pausedUntil:0, failures:0, translated:0, error:"", generation:0, version:0, layouts:new WeakMap(), refreshing:new Set(),
        restored:false, restoring:false, saveTimer:undefined, saving:false};
    function translateInit(dispatcher) {
        if (translate.dispatcher || !dispatcher || typeof dispatcher.dispatch !== "function") return;
        translate.dispatcher = dispatcher;
        if (typeof dispatcher.subscribe === "function") dispatcher.subscribe("LOGOUT", () => {
            translate.generation++; translate.cache.clear(); translate.queue.length = 0; translate.shown.clear();
            // Another account's messages must never be shown from this one's translations.
            if (files) Promise.resolve().then(() => files.writeFile("documents", TRANSLATE_FILE, "{\"version\":1,\"entries\":[]}", "utf8")).catch(() => {});
        });
    }
    // Saved translations: only finished ones, newest last, read once when Discord opens. A damaged file is ignored.
    function translateRestore() {
        if (translate.restored || translate.restoring || !files || !features.translate) return;
        let constants;
        try { constants = typeof files.getConstants === "function" ? files.getConstants() : files; } catch (_) { constants = null; }
        const directory = constants && constants.DocumentsDirPath;
        if (typeof directory !== "string") { translate.restored = true; return; }
        const path = directory.replace(/\/$/, "") + "/" + TRANSLATE_FILE, generation = translate.generation;
        translate.restoring = true;
        Promise.resolve().then(() => files.fileExists(path)).then(exists => exists ? files.readFile(path, "utf8") : null).then(text => {
            if (!text || text.length > TRANSLATE_SAVED_BYTES || generation !== translate.generation) return;
            const saved = JSON.parse(text);
            if (!saved || saved.version !== 1 || !Array.isArray(saved.entries)) return;
            let restored = 0;
            saved.entries.slice(-TRANSLATE_SAVED).forEach(item => {
                if (!Array.isArray(item) || item.length !== 4 || !item.every(part => typeof part === "string")) return;
                const [target, text, translated, language] = item, key = translateKey(target, text), known = translate.cache.get(key);
                if (known && known.state !== "queued") return;
                if (known) { known.state = "done"; known.translated = translated; known.language = language; known.layout = null; known.restored = true; restored++; return; }
                translateRemember(key, {state:"done", text, target, translated, language, layout:null, ids:new Set(), restored:true});
                restored++;
            });
            if (restored) translateChanged();
        }).catch(() => {}).then(() => { translate.restoring = false; translate.restored = true; if (enabled("translate")) translateSchedule(0); });
    }
    function translatePersist() {
        if (!files || translate.saveTimer !== undefined) return;
        translate.saveTimer = later(() => {
            translate.saveTimer = undefined;
            if (translate.saving) { translatePersist(); return; }
            const entries = [];
            translate.cache.forEach(entry => { if (entry.state === "done" && typeof entry.translated === "string") entries.push([entry.target, entry.text, entry.translated, entry.language || ""]); });
            let text = JSON.stringify({version:1, entries:entries.slice(-TRANSLATE_SAVED)});
            // Too big to read back: keep the newest half instead.
            if (text.length > TRANSLATE_SAVED_BYTES) text = JSON.stringify({version:1, entries:entries.slice(-Math.floor(TRANSLATE_SAVED / 2))});
            translate.saving = true;
            Promise.resolve().then(() => files.writeFile("documents", TRANSLATE_FILE, text, "utf8")).catch(() => {}).then(() => { translate.saving = false; });
        }, 3000, false);
    }
    // Discord's language (Settings -> Language) or the phone's, as a Google language code.
    function localeCode(kind) {
        let value = null;
        try { value = localeStore && (kind === "phone" ? localeStore.systemLocale : localeStore.locale); } catch (_) {}
        if (typeof value !== "string" || !/^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})*$/.test(value)) value = kind === "phone" ? localeCode("discord") : "en-US";
        return value.replace("_", "-");
    }
    function translateTarget() {
        const locale = localeCode(settings.translateTarget === "phone" ? "phone" : "discord");
        const parts = locale.split("-"), base = parts[0].toLowerCase();
        if (base === "zh") return /^(TW|HK|MO|Hant)$/i.test(parts[1] || "") ? "zh-TW" : "zh-CN";
        if (base === "nb" || base === "nn") return "no";
        return base;
    }
    // "iw" and "zh-CN" from Google, "he" and "zh-TW" from Discord: the same language either way.
    function languageBase(code) {
        const base = String(code || "").split("-")[0].toLowerCase();
        return ({iw:"he", jw:"jv", nb:"no", nn:"no", tl:"fil"})[base] || base;
    }
    let languageNames;
    function languageName(code) {
        const base = languageBase(code);
        if (languageNames === undefined) {
            languageNames = null;
            try { if (global.Intl && typeof global.Intl.DisplayNames === "function") languageNames = new global.Intl.DisplayNames(["en"], {type:"language"}); } catch (_) {}
        }
        try { const name = languageNames && languageNames.of(code); if (typeof name === "string" && name && name !== code) return name; } catch (_) {}
        return LANGUAGE_NAMES[base] || String(code || "another language");
    }
    function escapeTranslate(text) { return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    // The row's content as text to translate: plain text stays text, formatting becomes <g i=N>...</g> around
    // the words it covers, and everything that must not change (mentions, emojis, code...) becomes <a i=N/>.
    // Worked out once per content array: rows are generated again for every change in the chat.
    function translateLayout(content) {
        let layout = translate.layouts.get(content);
        if (layout !== undefined) return layout;
        const nodes = [];
        let letters = 0, lines = false, failed = false;
        function walk(list, depth) {
            let out = "";
            if (depth > 8) { failed = true; return out; }
            for (const node of list) {
                if (!node || typeof node !== "object") continue;
                if (node.type === "text" && typeof node.content === "string") {
                    // A zero-width space is how a message is redrawn: never let it make a new translation.
                    const text = node.content.replace(/\u200b/g, "");
                    const found = text.match(TRANSLATE_LETTER);
                    if (found) letters += found.length;
                    out += escapeTranslate(text);
                } else if (node.type === "br" || node.type === "newline") { lines = true; out += "\n"; }
                else if (TRANSLATE_GROUPS.has(node.type) && Array.isArray(node.content)) {
                    const index = nodes.push(node) - 1;
                    out += "<g i=" + index + ">" + walk(node.content, depth + 1) + "</g>";
                } else { const index = nodes.push(node) - 1; out += "<a i=" + index + "/>"; }
            }
            return out;
        }
        const text = Array.isArray(content) ? walk(content, 0) : "";
        // Nothing to translate: emojis, links, code or a word or two of letters ("ok", "xd").
        layout = failed || letters < 3 || text.length > TRANSLATE_MAX_TEXT ? null : {text, nodes, lines};
        translate.layouts.set(content, layout);
        return layout;
    }
    function unescapeTranslate(text) { return text.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, "\""); }
    // The translation back as Discord's own nodes. Every tag must come back exactly once and nested the same way,
    // or the original is shown: a mention can never be lost, doubled or turned into text.
    const TRANSLATE_TAG = /<a\s+i\s*=\s*"?(\d+)"?\s*\/>|<g\s+i\s*=\s*"?(\d+)"?\s*>|<\/g\s*>/g;
    function translateNodes(translated, layout) {
        const used = new Set(), root = [], stack = [{children:root, index:-1}];
        const text = value => {
            if (!value) return;
            const children = stack[stack.length - 1].children;
            if (!layout.lines) { children.push({type:"text", content:value}); return; }
            value.split("\n").forEach((part, i) => { if (i) children.push({type:"br"}); if (part) children.push({type:"text", content:part}); });
        };
        TRANSLATE_TAG.lastIndex = 0;
        let last = 0, match;
        while ((match = TRANSLATE_TAG.exec(translated))) {
            text(unescapeTranslate(translated.slice(last, match.index)));
            last = TRANSLATE_TAG.lastIndex;
            if (match[1] !== undefined || match[2] !== undefined) {
                const index = Number(match[1] !== undefined ? match[1] : match[2]), node = layout.nodes[index];
                const group = match[2] !== undefined;
                // A tag must come back as what it was sent as: <g> for formatting around words, <a/> for the rest.
                if (!node || used.has(index) || group !== (TRANSLATE_GROUPS.has(node.type) && Array.isArray(node.content))) return null;
                used.add(index);
                if (group) stack.push({children:[], index});
                else stack[stack.length - 1].children.push(node);
            } else {
                if (stack.length < 2) return null;
                const done = stack.pop();
                stack[stack.length - 1].children.push(Object.assign({}, layout.nodes[done.index], {content:done.children}));
            }
        }
        text(unescapeTranslate(translated.slice(last)));
        if (stack.length !== 1 || used.size !== layout.nodes.length) return null;
        return root;
    }
    function translateKey(target, text) { return target + "\u0000" + text; }
    function translateRemember(key, entry) {
        if (translate.cache.has(key)) translate.cache.delete(key);
        else if (translate.cache.size >= TRANSLATE_CACHE) translate.cache.delete(translate.cache.keys().next().value);
        translate.cache.set(key, entry);
    }
    // MessageRowGenerator hook: a translated message's content, note and (if asked) original, or the message as it is.
    // Translations are kept by text, but drawn per message: "hi @A" and "hi @B" share one translation, not one mention.
    function translateRow(message, source, channelId, id) {
        if (!message || !Array.isArray(message.content) || !source || typeof source.content !== "string" || !channelId || !id) return message;
        const author = source.author && source.author.id || message.authorId, me = currentUser();
        // Your own messages are already in a language you read.
        if (me && author === me.id) return message;
        const layout = translateLayout(message.content);
        if (!layout) return message;
        const target = translateTarget(), key = translateKey(target, layout.text);
        translateSeen(source, channelId, id, key);
        let entry = translate.cache.get(key);
        if (!entry) {
            entry = {state:"queued", text:layout.text, layout, target, ids:new Set()};
            translateRemember(key, entry);
            // Newest first: the message that just arrived, or the bottom of a chat you opened, is what you're reading.
            translate.queue.unshift(key);
            translateSchedule(60);
        }
        if (entry.state === "queued" || entry.state === "sending") { entry.ids.add(id); return message; }
        if (entry.state !== "done") return message;
        if (layout.view === undefined || layout.viewOf !== entry || layout.viewVersion !== translate.version) {
            layout.viewOf = entry; layout.viewVersion = translate.version;
            layout.view = translateView(entry, layout, message.content);
        }
        return layout.view ? Object.assign({}, message, {content:layout.view}) : message;
    }
    // Messages drawn lately, so switching on or changing an option can redraw them. Never while a redraw has
    // its zero-width space in, or that space would be put back for good.
    function translateSeen(source, channelId, id, key) {
        if (!source || typeof source.content !== "string" || !source.content || !channelId || !id || translate.refreshing.has(id)) return;
        let entry = translate.shown.get(id);
        if (entry) translate.shown.delete(id);
        else if (translate.shown.size >= 300) translate.shown.delete(translate.shown.keys().next().value);
        if (!entry) entry = {channelId, id, raw:"", key:null};
        entry.raw = source.content; entry.key = key || entry.key;
        translate.shown.set(id, entry);
    }
    function translateView(entry, layout, original) {
        let view = translateNodes(entry.translated, layout);
        if (!view) return null;
        if (settings.translateNote || settings.translateOriginal) view = view.concat([{type:"br"}, {type:"subtext", content:[{type:"text",
            content:"Translated from " + languageName(entry.language) + (settings.translateOriginal ? ". Original:" : "")}]}]);
        // A quote can't hold a quote or a code block, so those originals just follow on the next line.
        if (settings.translateOriginal) view = view.concat(layout.nodes.some(node => node.type === "blockQuote" || node.type === "codeBlock") ?
            [{type:"br"}].concat(original) : [{type:"blockQuote", content:original}]);
        return view;
    }
    function translateSchedule(ms) {
        if (translate.timer !== undefined || translate.active >= TRANSLATE_PARALLEL || !translate.queue.length) return;
        // The first request waits for the saved translations, so nothing on screen is asked for twice.
        if (!translate.restored) { if (!files) translate.restored = true; else { translateRestore(); if (!translate.restored) return; } }
        const wait = Math.max(ms, translate.pausedUntil - Date.now());
        translate.timer = later(() => { translate.timer = undefined; translateNext(); }, wait, false);
    }
    // Drops what is no longer worth asking for: switched off, target changed, or long gone from the cache.
    function translateBatch() {
        const keys = [], target = translateTarget();
        let chars = 0;
        // After a batch failed more than once, try smaller ones: one bad text can't keep the rest waiting.
        const most = translate.failures > 1 ? Math.max(1, TRANSLATE_BATCH >> Math.min(5, translate.failures - 1)) : TRANSLATE_BATCH;
        while (translate.queue.length && keys.length < most) {
            const key = translate.queue[0], entry = translate.cache.get(key);
            if (!entry || entry.state !== "queued" || entry.target !== target) { translate.queue.shift(); if (entry && entry.state === "queued") translate.cache.delete(key); continue; }
            const size = encodeURIComponent(entry.text).length;
            if (keys.length && chars + size > TRANSLATE_BATCH_CHARS) break;
            translate.queue.shift(); keys.push(key); chars += size;
        }
        return {keys, target};
    }
    async function translateRequest(texts, target, host) {
        if (typeof global.fetch !== "function") throw new Error("networking is unavailable");
        const controller = typeof global.AbortController === "function" ? new global.AbortController() : null;
        let timer;
        const body = texts.map(text => "q=" + encodeURIComponent(text)).join("&");
        const url = TRANSLATE_HOSTS[(host === undefined ? translate.host : host) % TRANSLATE_HOSTS.length] + TRANSLATE_PATH + encodeURIComponent(target);
        const task = Promise.resolve().then(async () => {
            const response = await global.fetch(url, Object.assign({method:"POST", credentials:"omit",
                headers:{accept:"application/json", "content-type":"application/x-www-form-urlencoded;charset=UTF-8"}, body},
                controller ? {signal:controller.signal} : {}));
            if (!response.ok) { const error = new Error("HTTP " + response.status); error.status = response.status; throw error; }
            const result = await response.json();
            if (!Array.isArray(result)) throw new Error("unreadable answer");
            // One text comes back as [text, language] in an array of one; several as one pair each.
            return texts.map((_, i) => {
                const item = result[i];
                if (Array.isArray(item)) return {text:String(item[0] == null ? "" : item[0]), language:typeof item[1] === "string" ? item[1] : ""};
                if (typeof item === "string") return {text:item, language:""};
                return null;
            });
        });
        const timeout = new Promise((resolve, reject) => {
            if (global.setTimeout) timer = global.setTimeout(() => { reject(new Error("no answer")); if (controller) controller.abort(); }, TRANSLATE_TIMEOUT_MS);
        });
        try { return await Promise.race([task, timeout]); }
        finally { if (timer !== undefined && global.clearTimeout) global.clearTimeout(timer); }
    }
    function translateNext() {
        if (!enabled("translate")) return;
        // translateSchedule's timer already waited out any pause.
        while (translate.active < TRANSLATE_PARALLEL && translate.queue.length) {
            const {keys, target} = translateBatch();
            if (!keys.length) break;
            translateSend(keys, target);
        }
        if (translate.queue.length) translateSchedule(0);
    }
    function translateSend(keys, target) {
        const generation = translate.generation, host = translate.host;
        translate.active++;
        keys.forEach(key => { translate.cache.get(key).state = "sending"; });
        translateRequest(keys.map(key => translate.cache.get(key).text), target, host).then(results => {
            if (generation !== translate.generation) return;
            translate.failures = 0; translate.error = "";
            const redraw = new Set();
            keys.forEach((key, i) => {
                const entry = translate.cache.get(key), result = results[i];
                if (!entry) return;
                const ids = entry.ids; entry.ids = new Set();
                // Missing from the answer: asked for again, not given up on.
                if (!result) { entry.state = "queued"; translate.queue.push(key); return; }
                // Already in your language, or given back unchanged: nothing to show, and it's never asked for again.
                if (result.text === entry.text || result.language && languageBase(result.language) === languageBase(target)) { entry.state = "same"; entry.layout = null; return; }
                // A translation that lost, doubled or moved a mention or emoji out of its formatting is never shown.
                if (!translateNodes(result.text, entry.layout)) { entry.state = "failed"; entry.layout = null; return; }
                entry.translated = result.text; entry.language = result.language; entry.state = "done"; entry.layout = null; translate.translated++;
                // Only rows that change are redrawn: one in your language looks the same as before.
                ids.forEach(id => redraw.add(id));
            });
            translateRedraw(redraw);
            translatePersist();
        }, error => {
            if (generation !== translate.generation) return;
            // Back in front, in the same order, and on the other Google server next time.
            keys.slice().reverse().forEach(key => { const entry = translate.cache.get(key); if (entry) { entry.state = "queued"; translate.queue.unshift(key); } });
            translate.failures++;
            if (translate.host === host) translate.host++;
            // Asked to slow down: wait 15 s, longer each time, up to 10 minutes. A timeout or a dropped connection
            // is usually the network: the other server is tried in a moment, and only after a few in a row does it wait.
            const limited = error && error.status === 429;
            const wait = limited ? Math.min(600000, 15000 * Math.pow(2, Math.min(6, translate.failures - 1))) :
                translate.failures < 3 ? 500 * translate.failures : Math.min(120000, 5000 * Math.pow(2, Math.min(5, translate.failures - 3)));
            translate.pausedUntil = Math.max(translate.pausedUntil, Date.now() + wait);
            translate.error = translate.failures < 3 && !limited ? "" : (limited ? "Google Translate asked to slow down" : "Google Translate isn't answering (" + String(error && error.message || error) + ")") +
                ". Trying again in " + Math.max(1, Math.round(wait / 1000)) + " s.";
        }).then(() => {
            translate.active--;
            if (generation === translate.generation && translate.queue.length) translateSchedule(translate.failures ? 0 : 30);
            notify("translate");
        });
    }
    // Discord keeps a row until its message record changes, so its text is changed for a moment (a zero-width
    // space) and then put back, like Fix unknown mentions does. The translation ignores that space.
    function translateRedraw(ids) {
        if (!translate.dispatcher) return;
        const entries = [];
        ids.forEach(id => {
            const entry = translate.shown.get(id);
            if (entry && typeof entry.raw === "string" && entry.raw && !translate.refreshing.has(id)) entries.push(entry);
        });
        if (!entries.length) return;
        const dispatch = message => { try { translate.dispatcher.dispatch({type:"MESSAGE_UPDATE", message}); } catch (_) {} };
        entries.forEach(entry => { translate.refreshing.add(entry.id); dispatch({id:entry.id, channel_id:entry.channelId, content:entry.raw + "\u200b"}); });
        later(() => entries.forEach(entry => { dispatch({id:entry.id, channel_id:entry.channelId, content:entry.raw}); translate.refreshing.delete(entry.id); }), 120);
    }
    // Switched on or off, or a different language or option: redraw what's on screen.
    // Only messages that are (or were) shown translated are redrawn.
    function translateChanged() {
        translate.version++;
        if (enabled("translate")) translateSchedule(0);
        // Messages known to be in your language, or that failed, look the same either way.
        const ids = new Set();
        translate.shown.forEach((entry, id) => { const cached = entry.key && translate.cache.get(entry.key);
            if (!cached || cached.state !== "same" && cached.state !== "failed") ids.add(id); });
        translateRedraw(ids);
    }
    function translateStatus() {
        if (translate.error) return translate.error;
        const waiting = translate.queue.length;
        return (translate.translated ? "Translated " + translate.translated + " message" + (translate.translated === 1 ? "" : "s") + " since Discord opened." : "Nothing translated yet since Discord opened.") +
            (waiting ? " " + waiting + " waiting." : "");
    }
    function TranslateSettings() {
        useSettings("translate");
        const ui = reviewUI();
        if (!React || !RN) return null;
        const Group = ui.TableRowGroup || RN.View, Switch = ui.TableSwitchRow, on = enabled("translate");
        const name = kind => languageName(localeCode(kind));
        let saved = 0; translate.cache.forEach(entry => { if (entry.state === "done") saved++; });
        const groups = [
            statusCard("status", on ? translateStatus() : "Turned off. Switch it on in Features to start."),
            radioGroup(ui, "target", "Translate into", "translateTarget", on, [["discord", "Discord's language", name("discord") + ". Change it in Discord's Language settings."],
                ["phone", "Your phone's language", name("phone") + "."]]),
            el(Group, {key:"show", title:"Display"},
                switchRow(Switch, "translateNote", "Show the original language", "A small \"Translated from Spanish\" line under each translation."),
                switchRow(Switch, "translateOriginal", "Show the original text", "The untranslated message, in a quote under the translation.")),
            el(Group, {key:"clear", title:"Manage"}, actionRow(ui, "clear", "Clear saved translations",
                saved ? count(saved, "translation") + " kept on this phone, so chats you reopen show them at once." : "Nothing saved yet.",
                () => confirmAction("Clear saved translations?", "Messages on screen will be translated again.", "Clear", translateForget), !saved, true)),
            footnote("note", "Only messages on screen are sent to Google Translate, once each, without your Discord account. Your own messages and ones already in your language are left as they are.")];
        return settingsBody(ui, groups);
    }
    // Clear saved translations: forgets every translation, on the phone too, and translates what's on screen again.
    function translateForget() {
        translate.generation++; translate.cache.clear(); translate.queue.length = 0; translate.translated = 0; translate.error = "";
        if (files) Promise.resolve().then(() => files.writeFile("documents", TRANSLATE_FILE, "{\"version\":1,\"entries\":[]}", "utf8")).catch(() => {});
        translateChanged(); notify("translate");
        reviewToast(reviewUI(), "Saved translations cleared");
    }
    function activatePlugins(id, exports) {
        if ((features.validUser || features.splitMessages || features.translate) && id === 1378 && exports && exports.default) userStore = exports.default;
        if (features.translate && id === 2115 && exports && exports.default) localeStore = exports.default;
        if (features.translate && id === 585 && exports && exports.default) translateInit(exports.default);
        if (features.splitMessages && id === 8602) return maxLengthModule(exports);
        if (features.youBarSettings && id === 16032) return hookComponent(exports, youBarButtons);
        if (features.validUser && id === 585 && exports && exports.default) validInit(exports.default);
        // MurmurHashV3 is CommonJS (module.exports=function), not an ES default export.
        if (features.pastelize && id === 1252) pastelHash = typeof exports === "function" ? exports : exports.default;
        if (features.pastelize && id === 2111) guildMembers = exports.default;
        if ((features.pastelize || features.noDelete || features.translate) && id === 7378 && exports.default && exports.default.prototype) hookExport(exports.default.prototype,"generate",messageRow);
        if (features.platformIndicators && id === 4877) presenceStore = exports.default;
        if (features.platformIndicators && id === 4855) sessionsStore = exports.default;
        if (features.platformIndicators && id === 10603) {
            displayNameType=exports.DisplayName;
            exports=hookExport(exports,"DisplayName",platformName);
            return hookComponent(exports,(orig,self,args)=>wrapProfileTree(orig.apply(self,args),displayNameType,platformName,platformWrappers));
        }
        if (features.platformIndicators && id === 12845) return hookComponent(exports,platformHeader);
        if (features.platformIndicators && id === 15667) return hookComponent(exports,platformDmRow);
        // User list rows (UserRow, default export) and voice panel rows (FormComponents' named MemberRowItem).
        if (features.platformIndicators && id === 10371) return hookComponent(exports,(orig,self,args)=>platformPlacement(orig,self,args,"piUserList"));
        if (features.platformIndicators && id === 9108) return hookComponent(exports,(orig,self,args)=>platformPlacement(orig,self,args,"piUserList"),"MemberRowItem");
        // Profile "in voice" users (UserProfileActivityVoiceChannelUsers): private UserRow rows.
        if (features.platformIndicators && id === 12602) return hookComponent(exports,(orig,self,args)=>{
            const tree=orig.apply(self,args);
            if (!enabled("platformIndicators") || !settings.piUserList || !React || !tree) return tree;
            return cloneTree(tree,(node,p)=>{
                if (typeof p.renderItem!=="function" || p.__venusPlatforms) return p;
                const render=p.renderItem;
                // Same wrapper for the same renderItem, so the list doesn't redraw every row.
                let renderItem=platformRenderers.get(render);
                if (!renderItem) platformRenderers.set(render,renderItem=function(){return platformRow(render.apply(this,arguments));});
                return Object.assign({},p,{__venusPlatforms:true,renderItem});
            },0);
        });
        // Plain status dot on avatars: avatar Status (design/void/Status,
        // 13649) draws a phone badge when isMobileOnline; show the plain dot instead.
        if (features.platformIndicators && id === 13649) {
            const plain = (orig,self,args) => {
                const props = args[0];
                if (!enabled("platformIndicators") || !settings.piHideMobile || !props || !props.isMobileOnline) return orig.apply(self,args);
                const next = Array.from(args); next[0] = Object.assign({},props,{isMobileOnline:false}); return orig.apply(self,next);
            };
            return hookExport(hookExport(exports,"default",plain),"StatusWithTyping",plain);
        }
        if (features.readAll && id === 15929) return hookExport(exports,"default",readAllBarProps);
        if (features.reviewDB && id === 8510) oauthModal=exports.default;
        if (features.reviewDB && id === 5997) nativeRowGroup=exports.TableRowGroup;
        if (features.reviewDB && id === 6621) nativeSwitchRow=exports.TableSwitchRow;
        if (features.hiddenChannels && id === 5410) nativeLock=exports.LockIcon;
        if (features.hiddenChannels && id === 15859) {
            // ChannelInfo can be consumed as default export and as named export
            // (GuildRolesAndChannelsRow reads it by name); hook both.
            exports = hookComponent(exports,hiddenInfo);
            return hookExport(exports, "ChannelInfo", hiddenInfo);
        }
        if (features.reviewDB && id === 12627) return hookComponent(exports,reviewNote);
        if (features.reviewDB && id === 13987) return hookExport(exports,"ContextMenuPopout",reviewMenu);

        if (features.reviewDB && id === 13521) return hookComponent(exports,reviewGuild);
        if (features.hideGift && (id === 11609 || id === 11817) && exports && exports.default)
            return replaceValue(exports, "default", propsComponent(exports.default, withoutGift));
        if (features.hideCall && id === 12696) return hookComponent(exports, profileButtons);
        if (features.hideQuestDock && id === 14608) return hideQuestHooks(exports);
        if (features.hideQuestDock && id === 14700) return hideQuestDock(exports);
        if (features.systemEmoji && id === 6552 && exports && exports.default)
            return replaceValue(exports, "default", propsComponent(exports.default, systemEmojiProps));
        if (id === 14130) exports.SETTING_RENDERER_CONFIG = nativeRegistry(exports.SETTING_RENDERER_CONFIG);
        if (id === 10874) return hookExport(exports, "createList", settingsSections);
        if (id === 14236) SettingsList = exports.SettingsList;
        if (features.copyBios && id === 10742) return hookComponent(exports, copyBio);
        if ((features.dashless || features.hiddenChannels) && id === 4990) {
            exports = hookExport(exports,"computeChannelName",channelLabel);
            return hookExport(exports, "default", channelLabel);
        }
        if (features.favouriteAnything && id === 12524) return hookComponent(exports, favouriteButton);
        if (features.favouriteAnything && id === 9861) return hookExport(exports, "addFavoriteGIF", favouriteAdd);
        if (features.favouriteAnything && id === 9864) return hookExport(exports, "useFavoriteGIFsMobile", favouriteList);
        if (id === 2051) channelStore = exports.default;
        if (features.noTyping && id === 11348) return replaceValue(exports, "default",
            hookExport(hookExport(exports.default, "startTyping", typing), "stopTyping", typing));
        if (features.quickDelete && id === 1127) locale = exports;
        if (features.quickDelete && id === 5205) return replaceValue(exports, "default", hookExport(exports.default, "show", quickConfirm));
        if (features.noDelete && id === 5059) {messageRecords = exports; restoreDeleted();}
        if ((features.noDelete || features.reviewDB || features.platformIndicators || features.hiddenChannels) && id === 1378) {userStore = exports.default; restoreDeleted();}
        if (features.noDelete && id === 5057) {
            msgStore = exports.default;
            exports = replaceValue(exports,"default",hookExport(hookExport(msgStore,"getMessage",retainedMessage),"getMessages",retainedMessages));
            restoreDeleted(); return exports;
        }
        if (features.quests && id === 7120) questAttach(exports.default);
        if (features.quests && id === 585) questsInit(exports.default);
        if ((features.noDelete || features.reviewDB || features.hiddenChannels) && id === 585) {
            dispatcher = exports.default.dispatch.bind(exports.default);
            return replaceValue(exports, "default", hookExport(exports.default, "dispatch", dispatchEvent));
        }
        if (features.hiddenChannels && [1086,1097].includes(id) && exports.Permissions) viewPermission = exports.Permissions.VIEW_CHANNEL;
        if (features.hiddenChannels && id === 1113) {
            exports = hookExport(exports, "transitionTo", hiddenNavigation);
            exports = hookExport(exports, "replaceWith", hiddenNavigation);
            return hookExport(exports, "transitionToGuild", hiddenGuildNavigation);
        }
        if (features.hiddenChannels && id === 4472) {
            // Lioncat6 finds permissions via findByProps("getChannelPermissions","can");
            // In 348.10 PermissionStore (4472) is the only module exporting both.
            // Candidate may be default export or the exports object itself.
            const candidate = exports && exports.default && typeof exports.default.can === "function" ? exports.default :
                exports && typeof exports.can === "function" ? exports : null;
            if (candidate) permissions = candidate;
            // Globally reveal VIEW_CHANNEL so Discord builds
            // real channel records (names) instead of obfuscated "hidden" stubs.
            // Message/voice access stays blocked via hiddenFetch/hiddenNavigation guards.
            // Use hookExport so frozen/sealed singletons are still patched via clone.
            try {
                if (candidate && !permissionsCanOrig) {
                    permissionsCanOrig = candidate.can.bind(candidate);
                    permissions = hookExport(hookExport(candidate, "can", hiddenCan), "canBasicChannel", hiddenCan);
                    return candidate === exports ? permissions : replaceValue(exports, "default", permissions);
                }
            } catch (_) {}
        }
        if (features.hiddenChannels && id === 4470) return replaceValue(exports, "default", hookExport(exports.default, "getChannels", hiddenDirectory));
        if (features.jumpToTop && id === 8838) chatHeight = exports;
        if (features.jumpToTop && id === 11643) jumpPill = exports.default;
        // 348.10's arrow is a registered image asset: Metro exports the asset id itself, not a default.
        if (features.jumpToTop && id === 11644) jumpIcon = exports && typeof exports === "object" && "default" in exports ? exports.default : exports;
        if (features.jumpToTop && id === 11642) return hookComponent(exports, jumpButton);
        if (features.jumpToTop && [9804,10418,15746].includes(id)) return hookComponent(exports, jumpSheet);
        if (features.gestures && id === 7414) return hookExport(exports, "handleAddDefaultDoubleTapReaction", doubleTapMessage);
        // Discord's "double-tap to change your reaction" tip would point at a gesture that now replies.
        if (features.gestures && id === 11105) return hookExport(exports, "DoubleTapEmojiEditNudge", (orig, self, args) => enabled("gestures") ? null : orig.apply(self, args));
        if (features.gestures && id === 1378) userStore = exports.default;
        if (features.gestures && id === 10905) return hookTapHandlers(exports);
        if (id === 6880) {
            let actions = exports.default;
            if (!actions) return exports;
            if (features.noDelete) actions = hookExport(actions, "deleteMessage", deleteMessage);
            // Split Large Messages wraps FreeNitro's hook (added below), so every part still gets its emoji links.
            const splitLater = features.splitMessages;
            if (features.hiddenChannels) actions = hookExport(actions, "fetchMessages", hiddenFetch);
            if (features.freeNitro) {
                actions = hookExport(actions, "sendMessage", sendMessage);
                actions = hookExport(actions, "_sendMessage", sendMessage);
                actions = hookExport(actions, "sendStickers", sendStickers);
            }
            if (splitLater) actions = hookExport(actions, "sendMessage", splitSend);
            msgActions = actions;
            return replaceValue(exports, "default", actions);
        }
        if (!features.freeNitro) return exports;
        if (id === 1378) userStore = exports.default;
        if (id === 13528) { emojiCatalog = exports; return hookExport(exports, "canUserUse", catalogEligibility); }
        if (id === 5772) emojiStore = exports.default;
        if (id === 5815) stickerStore = exports.default;
        if (id === 4491) {
            // The pinned build exports the capabilities on a default singleton;
            // named aliases are not used by its picker. Hook the inspected object.
            let capabilities = exports.default || exports;
            function patchCapability(key, setting) {
                premiumOriginal[key] = typeof capabilities[key] === "function" ? capabilities[key].bind(capabilities) : undefined;
                capabilities = hookExport(capabilities, key, premiumOverride(key, setting));
            }
            patchCapability("canUseEmojisEverywhere", "emojis");
            patchCapability("canUseAnimatedEmojis", "emojis");
            // Keep sticker eligibility stock: only the inspected premium-only sendability result is relaxed.
            premiumOriginal.canUseCustomStickersEverywhere = typeof capabilities.canUseCustomStickersEverywhere === "function" ? capabilities.canUseCustomStickersEverywhere.bind(capabilities) : undefined;
            if (exports.default) exports = replaceValue(exports, "default", capabilities);
            else exports = capabilities;
        }
        if (id === 6756) {
            stickerRules = exports;
            exports = hookExport(exports, "getStickerSendability", sendability);
            exports = hookExport(exports, "isSendableSticker", sendableSticker);
            stickerRules = exports;
        }
        return exports;
    }

    function instrument(exports, depth) {
        if (!exports || (typeof exports !== "object" && typeof exports !== "function")) return exports;
        if (owns(exports, "createElement") && owns(exports, "useState")) React = exports;
        if (owns(exports, "View") && owns(exports, "Text") && owns(exports, "Modal")) RN = exports;
        if (typeof data(exports, "getSize") === "function" && typeof data(exports, "readFile") === "function" &&
            typeof data(exports, "writeFile") === "function") initFiles(exports);
        if (features.voice && owns(exports, "CloudUpload")) instrumentCloudUpload(exports.CloudUpload);
        const changes = new Map();
        let proxy = exports;
        if (features.picker) {
            const patched = pickerComponent(exports);
            if (patched !== exports) return patched;
        }
        // Invocation-scoped captures also work when Hermes eval disables block scoping.
        // The binding check fails fast at hook time (caught as "Hook unavailable",
        // leaving the module stock) instead of crashing the app at call time.
        function replacementFor(operation, orig) {
            if (typeof operation !== "function" || typeof orig !== "function")
                throw new Error("Venus: unusable export binding for hook");
            return function () { return operation(orig, this === proxy ? exports : this, arguments); };
        }
        // Only read explicitly identified export keys, never enumerate or invoke unrelated getters.
        for (const key of ["getAttachmentPayload", "post"]) {
            if (!owns(exports, key)) continue;
            if (key === "getAttachmentPayload" && !features.voice) continue;
            if (key === "post" && (!features.voice || !owns(exports, "get") || !owns(exports, "put"))) continue;
            let orig;
            try { orig = exports[key]; } catch (_) { continue; }
            if (typeof orig !== "function") continue;
            const operation = key === "post" ? postRequest : attachmentPayload;
            const patched = replacementFor(operation, orig);
            changes.set(key, patched);
            if (key === "post") status.request = true;
            if (key === "getAttachmentPayload") status.attachment = true;
        }
        if (depth < 2) for (const key of ["default", "HTTP"]) {
            // Data exports only: default getters can be cyclic during module initialization.
            const candidate = data(exports, key);
            if (!candidate || candidate === exports) continue;
            const patched = instrument(candidate, depth + 1);
            if (patched !== candidate) changes.set(key, patched);
        }
        if (!changes.size) return exports;
        // Preserve module identity and cached aliases wherever descriptors allow it.
        for (const [key, patched] of Array.from(changes)) {
            const descriptor = Object.getOwnPropertyDescriptor(exports, key);
            if (descriptor && descriptor.configurable) {
                Object.defineProperty(exports, key, { value: patched, writable: true,
                    configurable: true, enumerable: descriptor.enumerable });
                changes.delete(key);
            } else if (descriptor && "value" in descriptor && descriptor.writable) {
                exports[key] = patched;
                changes.delete(key);
            }
        }
        if (!changes.size) return exports;
        // Only immutable accessor exports need a proxy; never inspect them during RN initialization.
        // Do not violate Proxy invariants on non-writable, non-configurable data properties.
        for (const key of Array.from(changes.keys())) {
            const descriptor = Object.getOwnPropertyDescriptor(exports, key);
            if (descriptor && !descriptor.configurable && "value" in descriptor && !descriptor.writable)
                changes.delete(key);
        }
        proxy = new Proxy(exports, { get(target, key, self) {
            return changes.has(key) ? changes.get(key) : Reflect.get(target, key, self);
        } });
        return changes.size ? proxy : exports;
    }
    function activateModule(id, module) {
        try {
            if (id === 1163) {
                const nativeFiles = module.exports.default;
                if (nativeFiles && typeof nativeFiles.getSize === "function" &&
                    typeof nativeFiles.readFile === "function" && typeof nativeFiles.writeFile === "function")
                    initFiles(nativeFiles);
            }
            module.exports = activatePlugins(id, module.exports);
            if ([17, 19, 414, 1163, 1283, 5440, 5442].includes(id)) module.exports = instrument(module.exports, 0);
        } catch (error) {
            status.audioError = "Hook unavailable: " + String(error);
            if (global.console && typeof global.console.warn === "function")
                global.console.warn("[Venus] Hook unavailable", String(error));
        }
    }
    function decorateDefine(define) {
        if (typeof define !== "function") return define;
        return function (factory, id, dependencies) {
            if ((id !== 120 && !targetModules.has(id)) || typeof factory !== "function") return define.apply(this, arguments);
            const args = Array.from(arguments);
            args[0] = function () {
                const factoryArgs = Array.from(arguments);
                if (features.hiddenChannels && id === 6952) {
                    factoryArgs[1] = listImport(factoryArgs[1]);
                    factoryArgs[2] = listImport(factoryArgs[2]);
                    factoryArgs[3] = listImport(factoryArgs[3]);
                }
                const result = factory.apply(this, factoryArgs);
                const module = arguments[4]; // Verified Metro factory ABI in Discord 348.10.
                if (module && module.exports) {
                    // Before anything reads them: DraftStore keeps its length cap from the moment it loads.
                    if (features.splitMessages && id === 1086) { try { lengthConstants(module.exports); } catch (_) {} }
                    if (id === 120) {
                        const initialize = module.exports.default;
                        let initializing = false;
                        if (typeof initialize === "function") module.exports.default = function () {
                            // Original errors propagate unchanged; only the outer successful init is ready.
                            if (initializing) return initialize.apply(this, arguments);
                            initializing = true;
                            let value;
                            try { value = initialize.apply(this, arguments); }
                            finally { initializing = false; }
                            environmentReady = true;
                            for (const [pendingId, pending] of deferred) activateModule(pendingId, pending);
                            deferred.clear();
                            return value;
                        };
                    } else if (!environmentReady) deferred.set(id, module);
                    else activateModule(id, module);
                }
                return result;
            };
            return define.apply(this, args);
        };
    }
    const existing = global.__d;
    let define = decorateDefine(existing);
    Object.defineProperty(global, "__d", { configurable: true, enumerable: true,
        get: () => define, set: value => { define = decorateDefine(value); } });
    // Local diagnostics/test API; not a network endpoint and no client-mod globals.
    global.__venusPatches = Object.freeze({ revision, settings, features, status, setSetting, formatSize, getSize });
})(globalThis);
