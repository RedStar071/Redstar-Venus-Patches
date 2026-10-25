p='patches/src/main/resources/venus/bootstrap.js'
s=open(p).read()
def rep(old,new):
    global s
    assert old in s, old[:90]
    s=s.replace(old,new,1)
rep('    if (features.customThemes) selectModules([589, 590, 591, 1205, 4831, 11191, 10368]);\n',
    '    if (features.customThemes) selectModules([589, 590, 591, 1205, 4831, 11191, 10368]);\n    if (features.materialYou) selectModules([589, 590, 591, 1205, 4831, 11191]);\n')
rep('nitroThemes:false, customThemes:false, customThemesBackground:true,','nitroThemes:false, customThemes:false, customThemesBackground:true, materialYou:false, materialYouColor:"wallpaper", materialYouTint:"balanced",')
rep('nitroThemes: false, customThemes: false, customThemesBackground: true,','nitroThemes: false, customThemes: false, customThemesBackground: true, materialYou: false, materialYouColor: "wallpaper", materialYouTint: "balanced",')
rep('        if (key === "fixEmbedsSites") return fixSitesText(value);\n        return typeof value',
    '        if (key === "fixEmbedsSites") return fixSitesText(value);\n        if (key === "materialYouColor") return myIsColor(value) ? value.toLowerCase() : undefined;\n        if (key === "materialYouTint") return MY_TINTS.includes(value) ? value : undefined;\n        return typeof value')
rep('''        if (key === "noDeleteLimit") {
            const limit''','''        if (key === "materialYouColor" || key === "materialYouTint") {
            if (key === "materialYouColor" ? !myIsColor(value) : !MY_TINTS.includes(value)) return false;
            const clean = key === "materialYouColor" ? value.toLowerCase() : value;
            if (settings[key] === clean && status.storage !== "loading" && status.storage !== "waiting") return true;
            settings[key] = clean; dirty.add(key); save(); notify(key); notify("materialYou");
            if (clean === "wallpaper") myReadSystem();
            customThemesApply(); return true;
        }
        if (key === "noDeleteLimit") {
            const limit''')
rep('        if (features.nitroThemes && key === "nitroThemes" && !value) nitroThemeTurnedOff();\n',
    '        if (features.nitroThemes && key === "nitroThemes" && !value) nitroThemeTurnedOff();\n        if (features.materialYou && key === "materialYou") { if (value) myStart(); customThemesApply(); if (features.iconPacks) iconPacksApply(); }\n')
rep('            if (features.customThemes && enabled("customThemes")) customThemesRestore();\n            if (features.iconPacks',
    '            if (features.customThemes && enabled("customThemes")) customThemesRestore();\n            if (features.materialYou) { myStart(); if (enabled("materialYou")) customThemesApply(); }\n            if (features.iconPacks')
rep('/^customThemes[A-Z]/.test(key) ? "customThemes" :','/^customThemes[A-Z]/.test(key) ? "customThemes" : /^materialYou[A-Z]/.test(key) ? "materialYou" :')
rep('nitroThemes:[17143, "SparklesIcon"]};','nitroThemes:[17143, "SparklesIcon"], materialYou:[15560, "PaintPaletteIcon"]};')
rep('        withOptions("appearance", "customThemes",',
    '        withOptions("appearance", "materialYou", "VENUS_MATERIALYOU", "Material You colors", "Colors Discord to match your wallpaper, in light and dark.", "Material You", MaterialYouSettings);\n        withOptions("appearance", "customThemes",')
rep('''    function customThemesActiveEntry() {
        if (!enabled("customThemes") || !customThemes.active) return null;''','''    // The theme the color tables follow: an installed custom theme wins (you picked it on purpose), then Material You.
    function colorThemeEntry() {
        return customThemesActiveEntry() || (features.materialYou ? myThemeSpec() : null);
    }
    function customThemesActiveEntry() {
        if (!features.customThemes || !enabled("customThemes") || !customThemes.active) return null;''')
rep('''        const active = customThemesActiveEntry();
        const nextKey = active ? active.id + ":" + customThemes.editCounter + ":" + (settings.customThemesBackground ? "1" : "0") : "";''',
'''        snapshotColorTables();
        const active = colorThemeEntry();
        const nextKey = active ? active.id + ":" + customThemes.editCounter + ":" + (settings.customThemesBackground ? "1" : "0") + ":" + (active === materialYou.spec ? materialYou.specKey : "") : "";''')
rep('''            if (customThemes.semTable && enabled("customThemes")) customThemesApply();''','''            if (customThemes.semTable && (enabled("customThemes") || enabled("materialYou"))) customThemesApply();''')
rep('''            if (customThemes.rawTable && enabled("customThemes")) customThemesApply();''','''            if (customThemes.rawTable && (enabled("customThemes") || enabled("materialYou"))) customThemesApply();''')
rep('''                if (enabled("customThemes")) { customThemes.appliedKey = null; customThemesApply(); }''','''                if (enabled("customThemes") || enabled("materialYou")) { customThemes.appliedKey = null; customThemesApply(); }''')
rep('''        if (features.customThemes) useSettings("customThemes");
        if (features.iconPacks) useSettings("iconPacks");
        const tree = orig.apply(self, args);''','''        if (features.customThemes) useSettings("customThemes");
        if (features.materialYou) useSettings("materialYou");
        if (features.iconPacks) useSettings("iconPacks");
        const tree = orig.apply(self, args);''')
rep('''            case 589: return features.customThemes ? hookSemanticColorsModule(exports) : exports;
            case 591: return features.customThemes ? hookRawColorsModule(exports) : exports;
            case 590: return features.customThemes ? hookExperimentColorsModule(exports) : exports;
            case 11191: return (features.customThemes || features.iconPacks) ?''','''            case 589: return features.customThemes || features.materialYou ? hookSemanticColorsModule(exports) : exports;
            case 591: return features.customThemes || features.materialYou ? hookRawColorsModule(exports) : exports;
            case 590: return features.customThemes || features.materialYou ? hookExperimentColorsModule(exports) : exports;
            case 11191: return (features.customThemes || features.materialYou || features.iconPacks) ?''')
rep('''            case 1205: if ((features.customThemes || features.iconPacks)''','''            case 1205: if ((features.customThemes || features.materialYou || features.iconPacks)''')
rep('''            case 4831: return (features.customThemes || features.iconPacks)''','''            case 4831: return (features.customThemes || features.materialYou || features.iconPacks)''')
d='scripts/wip/'
rep('    // Icon packs (#61): replaces', open(d+'hct.js').read()+open(d+'my.js').read()+open(d+'page.js').read()+'    // Icon packs (#61): replaces')
open(p,'w').write(s); print('wired')
