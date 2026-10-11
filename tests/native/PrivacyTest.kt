package app.venus.patches

import app.morphe.patcher.util.proxy.mutableTypes.MutableMethod
import com.android.tools.smali.dexlib2.DexFileFactory
import com.android.tools.smali.dexlib2.Opcodes
import com.android.tools.smali.dexlib2.Opcode
import com.android.tools.smali.dexlib2.iface.instruction.*
import com.android.tools.smali.dexlib2.iface.reference.MethodReference
import com.android.tools.smali.dexlib2.iface.reference.StringReference
import com.android.tools.smali.dexlib2.iface.reference.FieldReference
import app.morphe.patcher.patch.Patch
import java.security.MessageDigest
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.ZipFile

/** Detached method assembly and in-memory HBC fixtures only. Never runs Patcher or writes an APK. */
private data class Quad<A, B, C, D>(val a: A, val b: B, val c: C, val d: D)

fun main(args: Array<String>) {
    val groups = listOf(HbcPrivacy.analytics, HbcPrivacy.telemetry, HbcPrivacy.crash)
    val natives = NativePrivacy.crash + NativePrivacy.telemetry + NativePrivacy.attribution + NativePrivacy.advertising
    check(natives.size == 80 && natives.distinct().size == natives.size)
    check(groups.flatten().size == 17 && groups.flatten().map { it.offset }.distinct().size == 17)
    check(HbcPrivacy.resolvedPromise.last() == 6.toByte())
    // Every stub must decode into whole HBC98 instructions (1.3.6 used NewFastArray by mistake and misdecoded).
    fun hbcLength(op: Int) = when (op) {
        HbcPrivacy.OP_GET_GLOBAL, HbcPrivacy.OP_NEW_OBJECT, HbcPrivacy.OP_RET, HbcPrivacy.OP_LOAD_UNDEFINED, HbcPrivacy.OP_LOAD_FALSE -> 2
        HbcPrivacy.OP_CALL1 -> 4; HbcPrivacy.OP_CALL2 -> 5; HbcPrivacy.OP_GET_BY_ID, HbcPrivacy.OP_TRY_GET_BY_ID -> 6
        else -> error("Unexpected opcode $op in privacy stub")
    }
    for (stub in listOf(HbcPrivacy.resolvedPromise, HbcPrivacy.resolvedEmptyObject, HbcPrivacy.returnUndefined)) {
        var pc = 0; var last = -1
        while (pc < stub.size) { last = stub[pc].toInt() and 255; pc += hbcLength(last) }
        check(pc == stub.size && last == HbcPrivacy.OP_RET) { "Privacy stub does not decode to whole instructions" }
    }
    check(HbcPrivacy.resolvedEmptyObject.size == 23 && HbcPrivacy.resolvedEmptyObject[14].toInt() == HbcPrivacy.OP_NEW_OBJECT)
    check(HbcPrivacy.returnUndefined.contentEquals(byteArrayOf(147.toByte(), 6, 118, 6)))
    val privacy = listOf(disableAnalytics, disableCrashReporting, disableTelemetry, disableAttribution, disableAdvertisingIdentifiers)
    fun graph(selected: List<Patch<*>>): List<Patch<*>> {
        val visited = linkedSetOf<Patch<*>>()
        val active = mutableSetOf<Patch<*>>()
        fun visit(patch: Patch<*>) {
            if (patch in visited) return
            check(active.add(patch)) { "Dependency cycle" }
            patch.dependencies.forEach { visit(it) }
            active.remove(patch)
            visited.add(patch)
        }
        selected.forEach { visit(it) }
        return visited.toList()
    }
    for (selection in 0..31) for (withSettings in listOf(false, true)) {
        val selected = privacy.filterIndexed { i, _ -> selection and (1 shl i) != 0 }
        val ordered = graph(selected + if (withSettings) listOf(venusSettings) else emptyList())
        val needsLoader = withSettings || selected.any { it in privacy.take(3) }
        check(ordered.count { it === packagedDiscordBundle } == if (needsLoader) 1 else 0)
        if (!withSettings) check(venusSettings !in ordered)
        check(ordered.count { it === discordBundleGuard } == if (selected.isNotEmpty() || withSettings) 1 else 0)
        for ((i, patch) in ordered.withIndex()) check(patch.dependencies.all { ordered.indexOf(it) < i })
    }
    check(privacy.all { it.default && it.options.values.isEmpty() })
    if (args.isEmpty()) {
        // CI can validate output against the same digests without distributing proprietary APK content.
        println("PASS: privacy target/stub definitions; set VENUS_ORIGINAL_APK for read-only APK ABI validation")
        return
    }
    val apk = File(args[0])
    val original = ZipFile(apk).use { zip -> zip.getInputStream(zip.getEntry("assets/index.android.bundle")).readBytes() }
    HbcPrivacy.verifyOriginal(original)
    checkHermesSelections(original, groups)
    for (case in 0..3) checkHermesCorruption(original, case)
    checkHermesComposition(original, groups, args.getOrNull(1))
    val dex = DexFileFactory.loadDexContainer(apk, Opcodes.getDefault())
    val methods = dex.dexEntryNames.flatMap { dex.getEntry(it)!!.dexFile.classes.flatMap { it.methods } }
    // Assemble the shared loader in isolation and verify that it cannot select a file/OTA loader.
    val loader = MutableMethod(methods.single { it.definingClass == "Lcom/facebook/react/runtime/ReactInstance;" && it.name == "loadJSBundle" })
    pinPackagedDiscordBundle(loader)
    val loaderPrefix = loader.implementation!!.instructions.take(5)
    check(loaderPrefix.mapNotNull { ((it as? ReferenceInstruction)?.reference as? StringReference)?.string } == listOf("assets://index.android.bundle"))
    check(loaderPrefix.mapNotNull { ((it as? ReferenceInstruction)?.reference as? MethodReference)?.name } == listOf("createAssetLoader"))
    // Quest Completer's User-Agent guard, assembled on Discord's real interceptor (a detached fixture, not a Patcher run).
    val interceptorMethod = methods.single { it.definingClass == USER_AGENT_INTERCEPTOR && it.name == "intercept" }
    val untouched = interceptorMethod.implementation!!.instructions.map { it.opcode }
    val interceptor = MutableMethod(interceptorMethod)
    keepDesktopQuestAgent(interceptor)
    val guarded = interceptor.implementation!!.instructions.toList()
    check(interceptor.implementation!!.registerCount == interceptorMethod.implementation!!.registerCount) { "Guard changed the register count" }
    check(guarded.size == untouched.size + QUEST_AGENT_GUARD_SIZE) { "Guard is ${guarded.size - untouched.size} instructions, expected $QUEST_AGENT_GUARD_SIZE" }
    check(guarded.drop(QUEST_AGENT_GUARD_SIZE).map { it.opcode } == untouched) { "Discord's own User-Agent code changed" }
    // The last added instruction is the nop both branches land on; the 13 before it are the guard itself.
    check(guarded[QUEST_AGENT_GUARD_SIZE - 1].opcode == Opcode.NOP)
    val guard = guarded.take(QUEST_AGENT_GUARD_SIZE - 1)
    check(guard.map { it.opcode } == listOf(Opcode.INVOKE_INTERFACE, Opcode.MOVE_RESULT_OBJECT, Opcode.CONST_STRING, Opcode.INVOKE_VIRTUAL,
        Opcode.MOVE_RESULT_OBJECT, Opcode.IF_EQZ, Opcode.CONST_STRING, Opcode.INVOKE_VIRTUAL, Opcode.MOVE_RESULT, Opcode.IF_EQZ,
        Opcode.INVOKE_INTERFACE, Opcode.MOVE_RESULT_OBJECT, Opcode.RETURN_OBJECT)) { "Guard opcodes: ${guard.map { it.opcode }}" }
    check(guard.mapNotNull { ((it as? ReferenceInstruction)?.reference as? StringReference)?.string } == listOf("User-Agent", QUEST_DESKTOP_AGENT))
    // Both if-eqz jump past the guard to the label's nop, just before Discord's own first instruction.
    val guardUnits = guard.sumOf { it.codeUnits }
    for (index in listOf(5, 9)) {
        val at = guard.take(index).sumOf { it.codeUnits }
        check(at + (guard[index] as OffsetInstruction).codeOffset == guardUnits) { "Guard branch $index lands at the wrong place" }
        check((guard[index] as OneRegisterInstruction).registerA == 1)
    }
    // Only v0-v2 and the Chain parameter (p1 = v4 of 5) are touched.
    val parameter = interceptor.implementation!!.registerCount - 1
    for (instruction in guard) {
        val regs = when (instruction) {
            is FiveRegisterInstruction -> listOf(instruction.registerC, instruction.registerD, instruction.registerE,
                instruction.registerF, instruction.registerG).take(instruction.registerCount)
            is OneRegisterInstruction -> listOf(instruction.registerA)
            else -> emptyList()
        }
        check(regs.all { it in 0..2 || it == parameter }) { "Guard touches register outside v0-v2/p1: $regs" }
    }
    val calls = guard.mapNotNull { ((it as? ReferenceInstruction)?.reference as? MethodReference) }
    check(calls.map { it.definingClass + "->" + it.name } == listOf("Lokhttp3/Interceptor\$Chain;->i", "Lokhttp3/Request;->a",
        "Ljava/lang/String;->startsWith", "Lokhttp3/Interceptor\$Chain;->a"))
    for (call in calls.filter { it.definingClass != "Ljava/lang/String;" })
        check(methods.any { it.definingClass == call.definingClass && it.name == call.name && it.returnType == call.returnType &&
            it.parameterTypes.map { p -> p.toString() } == call.parameterTypes.map { p -> p.toString() } }) { "Unresolved host call $call" }
    check((guard[10] as FiveRegisterInstruction).let { it.registerC == parameter && it.registerD == 0 }) { "Guard must proceed with the original request" }
    // Force system font: assembled on Discord's real font lookup and Application.onCreate (detached fixtures).
    val fontMethod = methods.single { it.definingClass == FONT_MANAGER && it.name == "getTypeface" &&
        it.parameterTypes.map { p -> p.toString() } == listOf("Ljava/lang/String;", FONT_STYLE, "Landroid/content/res/AssetManager;") }
    val fontOriginal = fontMethod.implementation!!.instructions.map { it.opcode }
    val font = MutableMethod(fontMethod)
    useSystemFont(font)
    val fontGuarded = font.implementation!!.instructions.toList()
    check(font.implementation!!.registerCount == fontMethod.implementation!!.registerCount) { "Font guard changed the register count" }
    check(fontGuarded.size == fontOriginal.size + SYSTEM_FONT_GUARD_SIZE) { "Font guard is ${fontGuarded.size - fontOriginal.size} instructions" }
    check(fontGuarded.drop(SYSTEM_FONT_GUARD_SIZE).map { it.opcode } == fontOriginal) { "Discord's own font lookup changed" }
    val fontGuard = fontGuarded.take(SYSTEM_FONT_GUARD_SIZE - 1)
    check(fontGuard.map { it.opcode } == listOf(Opcode.SGET_BOOLEAN, Opcode.IF_EQZ, Opcode.INVOKE_VIRTUAL, Opcode.MOVE_RESULT,
        Opcode.INVOKE_STATIC, Opcode.MOVE_RESULT_OBJECT, Opcode.IF_EQZ, Opcode.RETURN_OBJECT)) { "Font guard opcodes: ${fontGuard.map { it.opcode }}" }
    check(fontGuarded[SYSTEM_FONT_GUARD_SIZE - 1].opcode == Opcode.NOP)
    val fontUnits = fontGuard.sumOf { it.codeUnits }
    for (index in listOf(1, 6)) {
        val at = fontGuard.take(index).sumOf { it.codeUnits }
        check(at + (fontGuard[index] as OffsetInstruction).codeOffset == fontUnits) { "Font guard branch $index lands at the wrong place" }
    }
    // p1 = family name, p2 = TypefaceStyle: only v0 is written.
    val fontRegs = font.implementation!!.registerCount
    check(fontRegs == 6) { "Font lookup has $fontRegs registers, expected 6" }
    check((fontGuard[2] as FiveRegisterInstruction).registerC == fontRegs - 2) { "getNearestStyle must run on the TypefaceStyle parameter" }
    check((fontGuard[4] as FiveRegisterInstruction).let { it.registerC == fontRegs - 3 && it.registerD == 0 }) { "Font guard passes the wrong family" }
    for (instruction in fontGuard) if (instruction is OneRegisterInstruction) check(instruction.registerA == 0) { "Font guard writes outside v0" }
    check(((fontGuard[0] as ReferenceInstruction).reference as FieldReference).let { it.definingClass == SYSTEM_FONT && it.name == "enabled" && it.type == "Z" })
    check(((fontGuard[2] as ReferenceInstruction).reference as MethodReference).let { ref -> methods.any { it.definingClass == ref.definingClass &&
        it.name == "getNearestStyle" && it.returnType == "I" && it.parameterTypes.isEmpty() && it.accessFlags and 1 != 0 } }) { "getNearestStyle is gone" }
    val appCreate = methods.single { it.definingClass == "Lcom/discord/MainApplication;" && it.name == "onCreate" && it.parameterTypes.isEmpty() }
    val app = MutableMethod(appCreate)
    readSystemFontSetting(app)
    val appCode = app.implementation!!.instructions.toList()
    check(appCode.size == appCreate.implementation!!.instructions.count() + 1 && appCode[0].opcode == Opcode.INVOKE_SUPER &&
        appCode[1].opcode == Opcode.INVOKE_STATIC && (appCode[1] as FiveRegisterInstruction).registerC == app.implementation!!.registerCount - 1 &&
        ((appCode[1] as ReferenceInstruction).reference as MethodReference).let { it.definingClass == SYSTEM_FONT && it.name == "init" }) { "Font setting must load right after super.onCreate()" }
    // Every branch and try range must land on an instruction start. 1.5.0's first build put two guards in getSize,
    // Morphe re-encoded the first one's branches into the middle of an instruction, and Android froze Discord at boot.
    fun checkBranches(method: MutableMethod, label: String) {
        val code = method.implementation!!.instructions.toList()
        val starts = HashSet<Int>(); val at = IntArray(code.size); var pc = 0
        for ((i, instruction) in code.withIndex()) { at[i] = pc; starts += pc; pc += instruction.codeUnits }
        for ((i, instruction) in code.withIndex()) if (instruction is OffsetInstruction)
            check(at[i] + instruction.codeOffset in starts) { "$label: branch at ${at[i]} lands inside an instruction" }
        for (block in method.implementation!!.tryBlocks) {
            check(block.startCodeAddress in starts) { "$label: try block starts inside an instruction" }
            block.exceptionHandlers.forEach { check(it.handlerCodeAddress in starts) { "$label: handler inside an instruction" } }
        }
    }
    checkBranches(font, "Font guard"); checkBranches(interceptor, "User-Agent guard")
    // Force system emojis: the one native emoji picture lookup, its reopen bridge and the launch-time setting read.
    val emojiMethod = methods.single { it.definingClass == SURROGATES && it.name == "toAssetUrl-impl" &&
        it.parameterTypes.map { p -> p.toString() } == listOf("Ljava/lang/String;") && it.returnType == "Ljava/lang/String;" }
    check(emojiMethod.accessFlags and 8 != 0) { "toAssetUrl-impl is no longer static" }
    val emojiOriginal = emojiMethod.implementation!!.instructions.map { it.opcode }
    val emoji = MutableMethod(emojiMethod)
    useSystemEmoji(emoji)
    val emojiCode = emoji.implementation!!.instructions.toList()
    check(emoji.implementation!!.registerCount == 3 && emojiMethod.implementation!!.registerCount == 3) { "Emoji lookup register count changed" }
    check(emojiCode.size == emojiOriginal.size + SYSTEM_EMOJI_GUARD_SIZE && emojiCode.drop(SYSTEM_EMOJI_GUARD_SIZE).map { it.opcode } == emojiOriginal) { "Discord's own emoji lookup changed" }
    val emojiGuard = emojiCode.take(SYSTEM_EMOJI_GUARD_SIZE - 1)
    check(emojiGuard.map { it.opcode } == listOf(Opcode.SGET_BOOLEAN, Opcode.IF_EQZ, Opcode.INVOKE_STATIC, Opcode.MOVE_RESULT_OBJECT,
        Opcode.IF_EQZ, Opcode.RETURN_OBJECT) && emojiCode[SYSTEM_EMOJI_GUARD_SIZE - 1].opcode == Opcode.NOP) { "Emoji guard opcodes: ${emojiGuard.map { it.opcode }}" }
    for (instruction in emojiGuard) if (instruction is OneRegisterInstruction) check(instruction.registerA == 0) { "Emoji guard writes outside v0" }
    check((emojiGuard[2] as FiveRegisterInstruction).let { it.registerCount == 1 && it.registerC == 2 }) { "Emoji guard must pass the surrogates parameter" }
    check(((emojiGuard[2] as ReferenceInstruction).reference as MethodReference).let { it.definingClass == SYSTEM_EMOJI && it.name == "url" })
    checkBranches(emoji, "Emoji guard")
    // No caller depends on Discord's asset URL beyond loading it as a picture.
    val emojiCallers = methods.filter { m -> m.implementation?.instructions?.any { ((it as? ReferenceInstruction)?.reference as? MethodReference)?.let { r ->
        r.definingClass == SURROGATES && r.name == "toAssetUrl-impl" } == true } == true }.map { it.definingClass + "->" + it.name }.sorted()
    check(emojiCallers == listOf("Lcom/discord/emoji/RenderableEmoji\$Unicode;->getUrl", "Lcom/discord/emoji_picker/EmojiPickerItem\$Emoji;->getUnicodeUrl")) { "Emoji lookup callers changed: $emojiCallers" }
    val videoOriginal = methods.single { it.definingClass == FILE_MODULE && it.name == "getVideoDimensions" }
    check(videoOriginal.implementation!!.instructions.any { ((it as? ReferenceInstruction)?.reference as? StringReference)?.string == "getVideoDimensions is only supported on iOS" }) { "getVideoDimensions now does real work on Android" }
    val video = MutableMethod(videoOriginal)
    systemEmojiBridge(video)
    val videoCode = video.implementation!!.instructions.toList()
    check(videoCode.size == videoOriginal.implementation!!.instructions.count() + SYSTEM_EMOJI_BRIDGE_SIZE &&
        videoCode.drop(SYSTEM_EMOJI_BRIDGE_SIZE).map { it.opcode } == videoOriginal.implementation!!.instructions.map { it.opcode }) { "Discord's own getVideoDimensions changed" }
    check(((videoCode[0] as ReferenceInstruction).reference as StringReference).string == "venus-emoji-v1:")
    check(videoCode[SYSTEM_EMOJI_BRIDGE_SIZE - 2].opcode == Opcode.RETURN_VOID && videoCode[SYSTEM_EMOJI_BRIDGE_SIZE - 1].opcode == Opcode.NOP)
    for (instruction in videoCode.take(SYSTEM_EMOJI_BRIDGE_SIZE)) if (instruction is OneRegisterInstruction) check(instruction.registerA == 0) { "Emoji bridge writes outside v0" }
    checkBranches(video, "Emoji bridge")
    check(try { systemEmojiBridge(video); false } catch (_: app.morphe.patcher.patch.PatchException) { true }) { "A second guard in getVideoDimensions was accepted" }
    // Font and emoji settings both load right after super.onCreate(), in either order, with nothing else moved.
    val both = MutableMethod(appCreate)
    readSystemFontSetting(both); readSystemEmojiSetting(both)
    val bothCode = both.implementation!!.instructions.toList()
    check(bothCode.size == appCreate.implementation!!.instructions.count() + 2 && bothCode[0].opcode == Opcode.INVOKE_SUPER &&
        bothCode.drop(3).map { it.opcode } == appCreate.implementation!!.instructions.drop(1).map { it.opcode } &&
        bothCode.subList(1, 3).map { ((it as ReferenceInstruction).reference as MethodReference).definingClass }.toSet() == setOf(SYSTEM_FONT, SYSTEM_EMOJI)) { "Setting reads must sit right after super.onCreate()" }
    checkBranches(both, "MainApplication.onCreate")
    // The voice and font bridges each own one FileModule method, never the same one.
    fun fileMethod(name: String) = methods.single { it.definingClass == FILE_MODULE && it.name == name &&
        it.parameterTypes.map { p -> p.toString() } == listOf("Ljava/lang/String;", PROMISE) && it.returnType == "V" }
    for ((name, install, size, prefix) in listOf(
        Quad("getSize", ::voiceBridge, VOICE_BRIDGE_SIZE, "venus-voice-v1:"),
        Quad("fileExists", ::systemFontBridge, SYSTEM_FONT_BRIDGE_SIZE, "venus-font-v1:"))) {
        val original = fileMethod(name)
        val bridge = MutableMethod(original)
        install(bridge)
        val code = bridge.implementation!!.instructions.toList()
        check(bridge.implementation!!.registerCount == original.implementation!!.registerCount) { "$name bridge changed the register count" }
        check(code.size == original.implementation!!.instructions.count() + size) { "$name bridge is ${code.size - original.implementation!!.instructions.count()} instructions" }
        check(code.drop(size).map { it.opcode } == original.implementation!!.instructions.map { it.opcode }) { "Discord's own $name changed" }
        check(code[size - 2].opcode == Opcode.RETURN_VOID && code[size - 1].opcode == Opcode.NOP)
        check(((code[0] as ReferenceInstruction).reference as StringReference).string == prefix)
        val parameters = bridge.implementation!!.registerCount - 3
        for (instruction in code.take(size)) if (instruction is OneRegisterInstruction) check(instruction.registerA in 0..1) { "$name bridge writes outside v0-v1" }
        check(code.take(size).filterIsInstance<FiveRegisterInstruction>().all { ins ->
            listOf(ins.registerC, ins.registerD, ins.registerE).take(ins.registerCount).all { it == 0 || it >= parameters } }) { "$name bridge reads a clobbered local" }
        checkBranches(bridge, "$name bridge")
        // A second Venus guard in the same method is refused at patch time instead of shipping broken branches.
        val refused = try { voiceBridge(bridge); false } catch (_: app.morphe.patcher.patch.PatchException) { true }
        check(refused) { "A second guard in $name was accepted" }
    }
    fun resolveHost(ref: MethodReference): Boolean = methods.any {
        it.definingClass == ref.definingClass && it.name == ref.name && it.returnType == ref.returnType &&
            it.parameterTypes.map { parameter -> parameter.toString() } == ref.parameterTypes.map { parameter -> parameter.toString() } && it.accessFlags and 1 != 0
    }
    for (target in natives) {
        val originalMethod = methods.single { target.matches(it) }
        check(originalMethod.name != "<init>" && originalMethod.name != "<clinit>")
        val fixture = MutableMethod(originalMethod)
        target.install(fixture) // Detached assembler fixture, not a Patcher invocation.
        val instructions = fixture.implementation!!.instructions
        check(fixture.implementation!!.registerCount == originalMethod.implementation!!.registerCount)
        val firstReturn = instructions.indexOfFirst { it.opcode in listOf(Opcode.RETURN_VOID, Opcode.RETURN, Opcode.RETURN_OBJECT) }
        check(firstReturn in 0..15)
        val prefix = instructions.take(firstReturn + 1)
        for (instruction in prefix) {
            val regs = when (instruction) {
                is FiveRegisterInstruction -> listOf(instruction.registerC, instruction.registerD,
                    instruction.registerE, instruction.registerF, instruction.registerG).take(instruction.registerCount)
                is ThreeRegisterInstruction -> listOf(instruction.registerA, instruction.registerB, instruction.registerC)
                is TwoRegisterInstruction -> listOf(instruction.registerA, instruction.registerB)
                is OneRegisterInstruction -> listOf(instruction.registerA)
                else -> emptyList()
            }
            check(regs.all { it in 0 until fixture.implementation!!.registerCount })
        }
        val calls = prefix.mapNotNull { ((it as? ReferenceInstruction)?.reference as? MethodReference) }
        if (target.result.name.startsWith("PROMISE")) {
            check(calls.single().definingClass == "Lcom/facebook/react/bridge/Promise;" && calls.single().name == "resolve")
            val move = prefix.first() as TwoRegisterInstruction
            check(move.registerB == originalMethod.implementation!!.registerCount - 1)
        } else if (target.result == NativePrivacy.Result.AF_SUCCESS) {
            check(calls.single().name == "onSuccess" && prefix.any { it.opcode == Opcode.IF_EQZ })
        } else if (target.result in listOf(NativePrivacy.Result.EMPTY_MAP, NativePrivacy.Result.PROFILE_START, NativePrivacy.Result.AD_ID_MAP)) {
            check(calls.all { resolveHost(it) }) { "Missing public map ABI" }
            check(calls.first().definingClass == "Lcom/facebook/react/bridge/Arguments;" && calls.first().name == "createMap")
            // Symbolically execute only the detached stub: catches result-shape and borrowed-register bugs.
            val regs = arrayOfNulls<Any>(fixture.implementation!!.registerCount)
            val promise = Any()
            regs[regs.size - 1] = promise
            var lastResult: Any? = null
            var returned: Any? = null
            var resolved: Any? = null
            var resolveCount = 0
            for (i in prefix) {
                val reg = i as? OneRegisterInstruction
                val ref = (i as? ReferenceInstruction)?.reference
                when (i.opcode) {
                    Opcode.MOVE_OBJECT_FROM16 -> { val move = i as TwoRegisterInstruction; regs[move.registerA] = regs[move.registerB] }
                    Opcode.CONST_STRING -> regs[reg!!.registerA] = (ref as StringReference).string
                    Opcode.CONST_4 -> regs[reg!!.registerA] = (i as WideLiteralInstruction).wideLiteral.toInt()
                    Opcode.MOVE_RESULT_OBJECT -> regs[reg!!.registerA] = lastResult
                    Opcode.RETURN_OBJECT -> returned = regs[reg!!.registerA]
                    Opcode.RETURN_VOID -> Unit
                    Opcode.INVOKE_STATIC, Opcode.INVOKE_INTERFACE -> {
                        val method = ref as MethodReference
                        val r = i as FiveRegisterInstruction
                        when (method.name) {
                            "createMap" -> lastResult = linkedMapOf<String, Any?>()
                            "putNull" -> (regs[r.registerC] as MutableMap<String, Any?>)[regs[r.registerD] as String] = null
                            "putBoolean" -> (regs[r.registerC] as MutableMap<String, Any?>)[regs[r.registerD] as String] = regs[r.registerE] == 1
                            "resolve" -> { check(regs[r.registerC] === promise); resolved = regs[r.registerD]; resolveCount++ }
                            else -> error("Unexpected map-stub call")
                        }
                    }
                    else -> error("Unexpected map-stub opcode ${i.opcode}")
                }
            }
            when (target.result) {
                NativePrivacy.Result.EMPTY_MAP -> check(returned is Map<*, *> && (returned as Map<*, *>).isEmpty())
                NativePrivacy.Result.PROFILE_START -> check(returned == mapOf("started" to false))
                NativePrivacy.Result.AD_ID_MAP -> check(resolveCount == 1 && resolved == mapOf("googleAdvertisingId" to null, "isLimitAdTrackingEnabled" to true))
                else -> error("Unexpected result")
            }
        } else if (target.result.name.startsWith("CALLBACK")) {
            check(calls.single().definingClass == "Lcom/facebook/react/bridge/Callback;" && calls.single().name == "invoke")
            check(resolveHost(calls.single())) { "Unresolved callback ABI: ${calls.single()}" }
            val registers = arrayOfNulls<Any>(fixture.implementation!!.registerCount)
            val callback = Any()
            registers[registers.size - 1] = callback
            var pending: Any? = null
            var invocations = 0
            var values: List<Any?>? = null
            for (instruction in prefix) {
                val one = instruction as? OneRegisterInstruction
                when (instruction.opcode) {
                    Opcode.MOVE_OBJECT_FROM16 -> {
                        val move = instruction as TwoRegisterInstruction
                        registers[move.registerA] = registers[move.registerB]
                    }
                    Opcode.CONST_4 -> registers[one!!.registerA] = null
                    Opcode.CONST_STRING -> registers[one!!.registerA] =
                        (((instruction as ReferenceInstruction).reference) as StringReference).string
                    Opcode.SGET_OBJECT -> {
                        val field = ((instruction as ReferenceInstruction).reference) as FieldReference
                        check(field.definingClass == "Ljava/lang/Boolean;" && field.name == "FALSE")
                        registers[one!!.registerA] = false
                    }
                    Opcode.FILLED_NEW_ARRAY -> {
                        val filled = instruction as FiveRegisterInstruction
                        check(filled.registerCount == 1)
                        pending = listOf(registers[filled.registerC])
                    }
                    Opcode.MOVE_RESULT_OBJECT -> registers[one!!.registerA] = pending
                    Opcode.INVOKE_INTERFACE -> {
                        val invoke = instruction as FiveRegisterInstruction
                        check(registers[invoke.registerC] === callback)
                        values = registers[invoke.registerD] as List<Any?>
                        invocations++
                    }
                    Opcode.RETURN_VOID -> Unit
                    else -> error("Unexpected callback guard opcode")
                }
            }
            check(invocations == 1 && values?.size == 1)
            val expected: Any? = when (target.result) {
                NativePrivacy.Result.CALLBACK_FALSE -> false
                NativePrivacy.Result.CALLBACK_EMPTY_STRING -> ""
                else -> null
            }
            check(values == listOf(expected)) { "Disabled callback contract changed" }
        } else if (target.result == NativePrivacy.Result.THROWABLE_STRING) {
            check(calls.single().definingClass == "Ljava/lang/Throwable;" && calls.single().name == "toString")
        } else check(calls.isEmpty())
    }
    println("PASS: 17 pinned HBC targets, all 7 HBC selection combinations, valid footers, unchanged unrelated bytes, rejection of changed inputs, 80 exact native ABIs and assembled register-safe early-return/Promise/callback guards, native result shapes, 64 dependency selections, cached-bundle pinning, corrupt-header/footer rejection combined prelude compatibility the Quest Completer desktop User-Agent guard, the Force system font guards and one branch-safe guard per FileModule bridge; no APK patched")
}


// Separate JVM frames release large fixtures between phases; keep validation within the 384 MiB heap.
private fun checkHermesSelections(original: ByteArray, groups: List<List<HbcPrivacy.Target>>) {
    val header = ByteBuffer.wrap(original).order(ByteOrder.LITTLE_ENDIAN)
    for (target in groups.flatten()) {
        val small = 128 + target.id * 12
        check(original[small + 11].toInt() and 32 != 0)
        val large = (((header.getInt(small + 4) ushr 14) and 255) shl 24) or (header.getInt(small) and 0x1ffffff)
        check(header.getInt(large) == target.offset && header.getInt(large + 12) == target.size)
        check(original[large + 36].toInt() and 0xc8 == 0) // Normal, no exception handler.
        val firstPointerRegister = header.getInt(large + 20) + header.getInt(large + 24)
        val lowestUsedRegister = if (target.name == "startRecordingAnalyticsEvents") 1 else 6
        check(firstPointerRegister <= lowestUsedRegister) { "Stub uses a non-GC-visible register" }
        check(header.getInt(large + 28) >= if (target.name == "send") 10 else if (target.promise) 9 else lowestUsedRegister + 1)
        if (target.promise) check(original[large + 32].toInt() and 255 >= 2)
    }
    for (selection in 1..7) {
        var changed = original
        val targets = groups.filterIndexed { i, _ -> selection and (1 shl i) != 0 }.flatten()
        for ((i, group) in groups.withIndex()) if (selection and (1 shl i) != 0) changed = HbcPrivacy.rewrite(changed, group)
        check(changed.contentEquals(HbcPrivacy.rewrite(original, targets))) // Selection order independence.
        check(changed.size == original.size)
        check(HbcPrivacy.digest(changed.copyOf(changed.size - 20), "SHA-1") ==
            changed.takeLast(20).joinToString("") { "%02x".format(it) })
        val restored = changed.copyOf()
        for (target in targets) {
            val stub = HbcPrivacy.stub(target)
            check(changed.copyOfRange(target.offset, target.offset + stub.size).contentEquals(stub))
            check(changed.copyOfRange(target.offset + stub.size, target.offset + target.size).all { it == 0.toByte() })
            original.copyInto(restored, target.offset, target.offset, target.offset + target.size)
        }
        original.copyInto(restored, restored.size - 20, original.size - 20)
        check(restored.contentEquals(original)) { "Unrelated HBC bytes changed" }
    }
}

private fun checkHermesCorruption(original: ByteArray, case: Int) {
    val bytes = original.copyOf()
    fun footer() = MessageDigest.getInstance("SHA-1").apply { update(bytes, 0, bytes.size - 20) }
        .digest().copyInto(bytes, bytes.size - 20)
    when (case) {
        0 -> {
            bytes[HbcPrivacy.analytics.first().offset] = 0
            check(runCatching { HbcPrivacy.verifyOriginal(bytes) }.isFailure)
            footer() // Test the body digest with a valid footer.
        }
        1 -> bytes[bytes.size - 1] = (bytes[bytes.size - 1].toInt() xor 1).toByte()
        2 -> {
            val header = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
            val small = 128 + HbcPrivacy.analytics.first().id * 12
            val large = (((header.getInt(small + 4) ushr 14) and 255) shl 24) or (header.getInt(small) and 0x1ffffff)
            bytes[large + 28] = 0
            footer()
        }
        3 -> { bytes[8] = 97; footer() }
    }
    val before = HbcPrivacy.digest(bytes)
    check(runCatching { HbcPrivacy.rewrite(bytes, HbcPrivacy.analytics) }.isFailure)
    check(HbcPrivacy.digest(bytes) == before) { "Rejected fixture was partially changed" }
    // The in-place patch path must reject the same input without touching the file.
    val file = File.createTempFile("venus-corrupt", ".hbc").apply { deleteOnExit(); writeBytes(bytes) }
    try {
        check(runCatching { HbcPrivacy.apply(file, HbcPrivacy.analytics) }.isFailure)
        check(HbcPrivacy.digest(file.readBytes()) == before) { "Rejected file was partially changed" }
        if (case == 0) check(runCatching { HbcPrivacy.verifyOriginal(file) }.isFailure)
    } finally { file.delete() }
}

private fun checkHermesComposition(original: ByteArray, groups: List<List<HbcPrivacy.Target>>, fixtureDirectory: String?) {
    // The streamed in-place path used while patching must equal the in-memory reference rewrite.
    val streamed = File.createTempFile("venus-streamed", ".hbc").apply { deleteOnExit() }
    try {
        streamed.writeBytes(original)
        HbcPrivacy.verifyOriginal(streamed)
        for (group in groups) HbcPrivacy.apply(streamed, group)
        check(streamed.readBytes().contentEquals(HbcPrivacy.rewrite(original, groups.flatten()))) {
            "In-place privacy rewrite differs from the reference rewrite"
        }
        check(runCatching { HbcPrivacy.verifyOriginal(streamed) }.isFailure)
    } finally { streamed.delete() }
    // Optional combined prelude fixture is written only within the build directory, never as an APK.
    if (fixtureDirectory != null) {
        val fixture = File(fixtureDirectory, "privacy-prelude.hbc").apply { parentFile.mkdirs() }
        fixture.writeBytes(HbcPrivacy.rewrite(original, groups.flatten()))
        HbcPrelude.inject(fixture, "void 0;")
        val combined = fixture.readBytes()
        for (t in groups.flatten()) check(combined.copyOfRange(t.offset, t.offset + HbcPrivacy.stub(t).size)
            .contentEquals(HbcPrivacy.stub(t)))
        check(HbcPrivacy.digest(combined.copyOf(combined.size - 20), "SHA-1") ==
            combined.takeLast(20).joinToString("") { "%02x".format(it) })
        fixture.delete()
    }
}
