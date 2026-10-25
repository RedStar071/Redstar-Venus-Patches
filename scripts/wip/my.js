    // Material You colors (#90): Discord in your phone's wallpaper palette, or in one color you pick, the way Android 12+
    // colors its own apps. It builds Material 3 tonal palettes (HCT, above) and hands them to Custom themes' compiler, so
    // a change is one table write and turning it off restores Discord exactly:
    // - every gray ramp Discord draws with (NEUTRAL, PRIMARY, PLUM and the translucent grays) is redrawn in the neutral
    //   palette at the same tone, so each of Discord's appearances keeps its contrast (Light stays light, Darker dark,
    //   Midnight black) and only gains the tint;
    // - Blurple becomes the accent palette at the same tone, so every brand-colored detail follows it;
    // - controls get Material 3's pairs: buttons, switches and checkboxes in primary with on-primary text and icons, the
    //   chosen channel and segmented pill in secondary container, links and brand text in primary.
    // Status colors (online, idle, Do Not Disturb, danger) stay Discord's, so they keep meaning what they mean.
    const MY_PRESETS = [["blue", "Blue", "#4a6fd8"], ["teal", "Teal", "#00877a"], ["green", "Green", "#4b7d2b"],
        ["pink", "Pink", "#c2407e"], ["orange", "Orange", "#c0631f"]];
    const MY_TINTS = ["subtle", "balanced", "rich"];
    const MY_TINT_SCALE = {subtle:0.45, balanced:1, rich:2.4};
    const MY_BRIDGE = "venus-monet-v1:";
    const materialYou = {system:null, asked:false, asking:false, spec:null, specKey:"", appState:null};
    function myIsColor(value) { return value === "wallpaper" || MY_PRESETS.some(p => p[0] === value) || typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value); }
    function myRgb(hex) { const n = hexInt(hex); return n == null ? [88, 101, 242] : [n >> 16 & 255, n >> 8 & 255, n & 255]; }
    function myHex(rgb) { return "#" + rgb.map(v => v.toString(16).padStart(2, "0")).join(""); }
    // Android's own palettes (system_accent1..3 and system_neutral1..2), read by the Material You extension. Their
    // 500 shade (index 6) carries each palette's hue and chroma, so every tone Discord needs comes out as Android's.
    function mySystemSource() {
        const sys = materialYou.system;
        if (!sys || !sys.accent1) return null;
        const pick = name => { const list = sys[name], hex = Array.isArray(list) ? list[6] : null; return /^#[0-9a-f]{6}$/i.test(hex || "") ? hctFromRgb(myRgb(hex)) : null; };
        const a1 = pick("accent1"), a2 = pick("accent2"), a3 = pick("accent3"), n1 = pick("neutral1"), n2 = pick("neutral2");
        if (!a1 || !a2 || !n1 || !n2) return null;
        return {a1, a2, a3:a3 || a2, n1, n2};
    }
    // Material 3's tonal spot scheme from one color: the style Android itself uses by default.
    function mySeedSource(hex) {
        const seed = hctFromRgb(myRgb(hex));
        return {a1:{hue:seed.hue, chroma:Math.max(seed.chroma, 36)}, a2:{hue:seed.hue, chroma:16}, a3:{hue:(seed.hue + 60) % 360, chroma:24},
            n1:{hue:seed.hue, chroma:6}, n2:{hue:seed.hue, chroma:8}};
    }
    function myWallpaperReady() { return !!mySystemSource(); }
    // What's used: the wallpaper while the phone shares it, else the color you picked, else Blue.
    function mySource() {
        const choice = settings.materialYouColor;
        if (choice === "wallpaper") { const sys = mySystemSource(); if (sys) return {src:sys, key:"w:" + JSON.stringify(materialYou.system)}; }
        const preset = MY_PRESETS.find(p => p[0] === choice);
        const hex = preset ? preset[2] : /^#[0-9a-f]{6}$/i.test(choice || "") ? choice.toLowerCase() : MY_PRESETS[0][2];
        return {src:mySeedSource(hex), key:"s:" + hex};
    }
    function myTone(p, tone) { return myHex(hctToRgb(p.hue, p.chroma, tone)); }
    // Background tint scales how much color the grays take; accents stay as Android draws them.
    function myScheme(src) {
        const scale = MY_TINT_SCALE[settings.materialYouTint] || 1;
        return {a1:src.a1, a2:src.a2, a3:src.a3, n1:{hue:src.n1.hue, chroma:Math.min(24, src.n1.chroma * scale)}, n2:{hue:src.n2.hue, chroma:Math.min(28, src.n2.chroma * scale)}};
    }
    const MY_NEUTRAL_RAW = /^(NEUTRAL|PRIMARY|PLUM)_\d+$|^OPACITY_\d+$/, MY_ACCENT_RAW = /^(BLURPLE|BRAND)_\d+$|^OPACITY_BLURPLE_\d+$/;
    // Material 3 roles as [palette, tone] per Discord appearance: [dark, light, midnight, darker].
    const MY_ROLES = {
        primary:[["a1", 80], ["a1", 40], ["a1", 80], ["a1", 80]], onPrimary:[["a1", 20], ["a1", 100], ["a1", 20], ["a1", 20]],
        pressed:[["a1", 70], ["a1", 30], ["a1", 70], ["a1", 70]], brandText:[["a1", 80], ["a1", 40], ["a1", 80], ["a1", 80]],
        mention:[["a1", 90], ["a1", 30], ["a1", 90], ["a1", 90]], secondary:[["a2", 30], ["a2", 90], ["a2", 25], ["a2", 30]]
    };
    const MY_SEMANTIC = {
        primary:["BACKGROUND_BRAND", "CONTROL_PRIMARY_BACKGROUND_DEFAULT", "SWITCH_BACKGROUND_SELECTED_DEFAULT", "CHECKBOX_BACKGROUND_SELECTED_DEFAULT",
            "CHAT_INPUT_SEND_BUTTON_ACTIVE_BACKGROUND", "INTERACTIVE_ACCENT_BACKGROUND_SELECTED", "PROGRESSBAR_INDICATOR_BACKGROUND", "INPUT_BORDER_ACTIVE",
            "TOGGLEBUTTON_BORDER_SELECTED", "REACTION_BORDER_REACTED_DEFAULT", "BADGE_BACKGROUND_BRAND", "ACTIVITY_TIMEBAR_PROGRESS_BACKGROUND",
            "REDESIGN_INPUT_CONTROL_SELECTED", "MOBILE_VOICE_MESSAGE_RECORDING_LOCK_BACKGROUND_ACTIVE", "BUTTON_OUTLINE_BRAND_BACKGROUND_HOVER",
            "BUTTON_OUTLINE_BRAND_BORDER_ACTIVE", "POLLS_VOTED_FILL", "SWITCH_THUMB_ICON_ACTIVE"],
        onPrimary:["CONTROL_PRIMARY_TEXT_DEFAULT", "CHAT_INPUT_SEND_BUTTON_ICON_ACTIVE_TINT", "CHECKBOX_ICON_ACTIVE", "BADGE_TEXT_BRAND"],
        pressed:["CONTROL_PRIMARY_BACKGROUND_ACTIVE", "INTERACTIVE_ACCENT_BACKGROUND_ACTIVE"],
        brandText:["TEXT_BRAND", "ICON_BRAND", "CONTROL_BRAND_FOREGROUND", "CONTROL_BRAND_FOREGROUND_NEW", "TEXT_LINK"],
        mention:["MENTION_FOREGROUND", "REACTION_TEXT_REACTED_DEFAULT"],
        secondary:["MOBILE_CHANNEL_ITEM_BACKGROUND_SELECTED", "MOBILE_SEGMENTED_CONTROL_INDICATOR_BACKGROUND"]
    };
    // The theme Custom themes' compiler applies, built once per palette, color and tint.
    function myThemeSpec() {
        if (!enabled("materialYou") || !customThemes.origRaw) return null;
        const source = mySource(), specKey = source.key + "|" + settings.materialYouTint;
        if (materialYou.spec && materialYou.specKey === specKey) return materialYou.spec;
        const p = myScheme(source.src), rawColors = {}, semanticColors = {}, orig = customThemes.origRaw;
        for (const name in orig) {
            if (!owns(orig, name)) continue;
            const neutral = MY_NEUTRAL_RAW.test(name), accent = !neutral && MY_ACCENT_RAW.test(name);
            const value = orig[name];
            if (!neutral && !accent || typeof value !== "string" || !/^#[0-9a-f]{6}/i.test(value)) continue;
            // Translucent grays draw muted text, borders and pressed states: the neutral variant palette, as in Material 3.
            const palette = accent ? p.a1 : /^OPACITY_/.test(name) ? p.n2 : p.n1;
            rawColors[name] = myTone(palette, hctToneOf(myRgb(value.slice(0, 7))));
        }
        for (const role in MY_SEMANTIC) {
            const slots = MY_ROLES[role].map(pair => myTone(p[pair[0]], pair[1]));
            MY_SEMANTIC[role].forEach(token => { semanticColors[token] = slots; });
        }
        materialYou.spec = {id:"venus:materialYou", name:"Material You", rawColors, semanticColors};
        materialYou.specKey = specKey;
        return materialYou.spec;
    }
    // A small palette for the preview tiles, as Discord's Light or Dark would look.
    function myPalette(light) {
        const p = myScheme(mySource().src);
        return light ? {bg:myTone(p.n1, 98), card:myTone(p.n1, 92), accent:myTone(p.a1, 40), text:myTone(p.n2, 30), strong:myTone(p.n1, 10)} :
            {bg:myTone(p.n1, 20), card:myTone(p.n1, 28), accent:myTone(p.a1, 80), text:myTone(p.n2, 80), strong:myTone(p.n1, 95)};
    }
    // Asks the extension for the phone's palettes: at start, on this page, and whenever Discord comes back to the front
    // (the wallpaper may have changed meanwhile). Nothing is redrawn when they're the same.
    function myReadSystem() {
        if (!features.materialYou || !files || typeof files.getFileHash !== "function" || materialYou.asking) return;
        materialYou.asking = true;
        Promise.resolve().then(() => files.getFileHash(MY_BRIDGE + "colors", "", 0)).then(text => {
            const parsed = typeof text === "string" && text ? JSON.parse(text) : null;
            const next = parsed && Array.isArray(parsed.accent1) ? {accent1:parsed.accent1, accent2:parsed.accent2, accent3:parsed.accent3, neutral1:parsed.neutral1, neutral2:parsed.neutral2} : null;
            const changed = JSON.stringify(next) !== JSON.stringify(materialYou.system);
            materialYou.system = next;
            if (changed && enabled("materialYou")) customThemesApply();
        }).catch(() => {}).then(() => { materialYou.asking = false; materialYou.asked = true; notify("materialYou"); });
    }
    function myStart() {
        if (!features.materialYou) return;
        if (!materialYou.appState && RN && RN.AppState && typeof RN.AppState.addEventListener === "function")
            try { materialYou.appState = RN.AppState.addEventListener("change", state => { if (state === "active" && enabled("materialYou")) myReadSystem(); }); } catch (_) {}
        myReadSystem();
    }
