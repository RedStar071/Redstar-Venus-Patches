    // Material You page: what Discord will look like (Light and Dark side by side in the palette), where the colors come
    // from, and how strongly backgrounds take the tint.
    function MaterialYouSettings() {
        useSettings("materialYou");
        if (features.customThemes) useSettings("customThemes");
        React.useEffect(() => { if (features.materialYou) myReadSystem(); }, []);
        if (!React || !RN) return null;
        const ui = reviewUI(), s = useThemeTileStyles(), card = highlightCardStyle();
        const sw = useThemed("myPicker", c => ({ring:{borderColor:c.TEXT_STRONG}, dashed:{borderColor:c.TEXT_MUTED}}), {ring:{borderColor:"#f2f3f5"}, dashed:{borderColor:"#949ba4"}});
        const Text = inspectedExport(5088, "Text"), Press = RN.Pressable || RN.View, Check = venusIcon(6823, "CheckmarkSmallIcon"), Dropper = venusIcon(15652, "EyeDropperIcon");
        const Wall = venusIcon(8210, "ImageIcon");
        const on = enabled("materialYou"), choice = settings.materialYouColor, sys = mySystemSource();
        const overridden = on && !!customThemesActiveEntry();
        const text = (value, variant, color, fallback) => Text ? el(Text, {variant, color}, value) : el(RN.Text, {style:fallback}, value);
        // The preview: Discord's Light and Dark looks side by side, in the colors you'd get.
        const tile = (key, label, light) => el(RN.View, {key, style:s.tile, accessible:true, accessibilityLabel:tr(label)},
            themeMiniChat(myPalette(light)),
            el(RN.View, {style:{paddingHorizontal:8, paddingTop:8, paddingBottom:6}}, text(tr(label), "text-sm/semibold", "text-strong", {color:"#f2f3f5", fontSize:14, fontWeight:"600"})));
        const preview = el(RN.View, {key:"preview", style:{gap:8}}, groupTitle("previewTitle", "Preview"),
            el(RN.View, {style:{flexDirection:"row", justifyContent:"space-between", opacity:on ? 1 : 0.6}}, tile("light", "Light", true), tile("dark", "Dark", false)));
        // Colors: your wallpaper first, five Material colors, then any color from Discord's own picker.
        const pick = value => { if (on && value !== choice) { haptic("SELECTION"); setSetting("materialYouColor", value); } };
        const pickAny = () => {
            if (!on) return;
            const current = /^#/.test(choice) ? choice : (MY_PRESETS.find(p => p[0] === choice) || MY_PRESETS[0])[2];
            highlightPickColor(current, MY_PRESETS, hex => setSetting("materialYouColor", hex));
        };
        const tick = (key, hex) => popIn("tick:" + key, el(Check, {size:"sm", color:isLightHex(hex) ? "#000000" : "#ffffff"}));
        const swatch = (key, label, fill, selected, onPress, disabled) => el(RN.View, {key, style:{flex:1, alignItems:"center"}},
            el(Press, {accessible:true, accessibilityRole:"radio", accessibilityLabel:label, accessibilityState:{selected, disabled:!on || !!disabled}, disabled:!on || !!disabled, onPress,
                hitSlop:{top:4, bottom:4, left:2, right:2},
                style:[{width:40, height:40, borderRadius:20, alignItems:"center", justifyContent:"center", borderWidth:2, borderColor:"transparent"}, selected ? sw.ring : null, {opacity:on && !disabled ? 1 : 0.4}]},
                fill));
        const dot = (hex, inner) => el(RN.View, {style:[{width:30, height:30, borderRadius:15, alignItems:"center", justifyContent:"center", backgroundColor:hex || "transparent"},
            hex ? null : [{borderWidth:2, borderStyle:"dashed"}, sw.dashed]]}, inner);
        // The wallpaper swatch is split like Android's own wallpaper colors: the accent on top, the two softer ones below.
        const wallTop = sys ? myTone(sys.a1, 70) : null;
        const wallFill = sys ? el(RN.View, {style:{width:30, height:30, borderRadius:15, overflow:"hidden"}},
            el(RN.View, {style:{height:15, backgroundColor:wallTop}}),
            el(RN.View, {style:{flexDirection:"row", height:15}}, el(RN.View, {style:{flex:1, backgroundColor:myTone(sys.a2, 80)}}), el(RN.View, {style:{flex:1, backgroundColor:myTone(sys.a3, 70)}})),
            choice === "wallpaper" ? el(RN.View, {style:{position:"absolute", left:0, right:0, top:0, bottom:0, alignItems:"center", justifyContent:"center"}}, tick("wallpaper", wallTop)) : null) :
            dot(null, el(Wall, {size:"xs"}));
        const custom = /^#/.test(choice || "");
        const swatches = [swatch("wallpaper", tr("Wallpaper"), wallFill, choice === "wallpaper", () => pick("wallpaper"), !sys)]
            .concat(MY_PRESETS.map(([value, label, hex]) => swatch(value, tr(label), dot(hex, choice === value ? tick(value, hex) : null), choice === value, () => pick(value))))
            .concat([swatch("custom", tr("Any color"), dot(custom ? choice : null, custom ? tick(choice, choice) : el(Dropper, {size:"xs"})), custom, pickAny)]);
        const fallback = choice === "wallpaper" && !sys;
        const named = fallback ? tr("Blue") : choice === "wallpaper" ? tr("Wallpaper") : custom ? choice.toUpperCase() : tr((MY_PRESETS.find(p => p[0] === choice) || MY_PRESETS[0])[1]);
        const colors = el(RN.View, {key:"colors", style:{gap:8}}, groupTitle("colorsTitle", "Colors"),
            el(RN.View, {style:card},
                el(RN.View, {style:{flexDirection:"row", alignItems:"center", gap:8}},
                    el(RN.View, {style:{flex:1}}, text(tr("Based on"), "text-md/semibold", "text-strong", {color:"#f2f3f5", fontSize:16, fontWeight:"600"})),
                    text(named, "text-sm/medium", "text-muted", {color:"#949ba4", fontSize:13})),
                el(RN.View, {style:{flexDirection:"row", alignItems:"center"}, accessibilityRole:"radiogroup"}, swatches),
                fallback && materialYou.asked ? text(tr("Your phone doesn't share its wallpaper colors (that needs Android 12 or newer), so Blue is used."),
                    "text-xs/medium", "text-muted", {color:"#949ba4", fontSize:12}) : null));
        const tint = el(RN.View, {key:"tint", style:{gap:8}}, groupTitle("tintTitle", "Background tint"),
            venusSegmented({key:"tintSeg", value:settings.materialYouTint, disabled:!on, onChange:value => setSetting("materialYouTint", value),
                items:[{value:"subtle", label:tr("Subtle")}, {value:"balanced", label:tr("Balanced")}, {value:"rich", label:tr("Rich")}]}));
        const groups = [
            on ? null : offCard("status", venusIcon(15560, "PaintPaletteIcon"), "materialYou"),
            overridden ? statusCard("override", "Your custom theme's colors show instead. Pick Discord's colors in Custom themes to see these.",
                {title:tr("A custom theme is in use"), IconComponent:venusIcon(15652, "EyeDropperIcon")}) : null,
            preview, colors, tint,
            footnote("note", "Light, Dark and Midnight follow Discord's own Appearance setting.")];
        return settingsBody(ui, groups);
    }
