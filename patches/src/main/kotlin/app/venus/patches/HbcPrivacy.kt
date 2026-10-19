package app.venus.patches

import java.io.File
import java.io.RandomAccessFile
import java.security.MessageDigest
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** Exact, inspected HBC98 functions. No eval, runtime hook, remote loader or settings dependency. */
internal object HbcPrivacy {
    const val ORIGINAL_SHA256 = "eae2c936fd3012ddf29bc3fd8369f9eb44e56e5421df899bf272b14fa3b8ded5"
    data class Target(val id: Int, val name: String, val offset: Int, val size: Int,
                      val header: String, val sha256: String, val promise: Boolean, val expandedHeaderHash: String)
    private fun toHex(bytes: ByteArray): String {
        val hex = "0123456789abcdef"
        val out = CharArray(bytes.size * 2)
        for (i in 0 until bytes.size) {
            val v = bytes[i].toInt() and 255
            out[i * 2] = hex[v ushr 4]
            out[i * 2 + 1] = hex[v and 15]
        }
        return String(out)
    }
    fun digest(bytes: ByteArray, algorithm: String = "SHA-256") =
        toHex(MessageDigest.getInstance(algorithm).digest(bytes))
    fun hex(value: String): ByteArray {
        val len = value.length / 2
        val out = ByteArray(len)
        for (i in 0 until len) {
            val hi = Character.digit(value[i * 2], 16)
            val lo = Character.digit(value[i * 2 + 1], 16)
            out[i] = ((hi shl 4) or lo).toByte()
        }
        return out
    }
    fun verifyOriginal(bytes: ByteArray) {
        require(digest(bytes) == ORIGINAL_SHA256) {
            "Unsupported Discord JavaScript bundle; use the original 349.9 - Stable APKM"
        }
    }
    /** Same check, streamed: never holds the 55 MB bundle in memory on the patching device. */
    fun verifyOriginal(file: File) {
        require(streamDigest(file, "SHA-256", file.length()) == ORIGINAL_SHA256) {
            "Unsupported Discord JavaScript bundle; use the original 349.9 - Stable APKM"
        }
    }
    private fun streamDigest(file: File, algorithm: String, length: Long): String =
        toHex(streamDigestBytes(file, algorithm, length))
    private fun streamDigestBytes(file: File, algorithm: String, length: Long): ByteArray {
        val digest = MessageDigest.getInstance(algorithm)
        file.inputStream().use { input ->
            val buffer = ByteArray(1 shl 20)
            var left = length
            while (left > 0) {
                val read = input.read(buffer, 0, minOf(buffer.size.toLong(), left).toInt())
                if (read < 0) break
                digest.update(buffer, 0, read)
                left -= read
            }
        }
        return digest.digest()
    }

    // HBC98 opcodes (Hermes 250829098 BytecodeList.def) and the pinned bundle's string IDs.
    const val OP_NEW_OBJECT = 4; const val OP_GET_GLOBAL = 61; const val OP_GET_BY_ID = 69; const val OP_TRY_GET_BY_ID = 72
    const val OP_CALL1 = 108; const val OP_CALL2 = 110; const val OP_RET = 118
    const val OP_LOAD_PARAM = 137; const val OP_LOAD_CONST_STRING = 144; const val OP_LOAD_UNDEFINED = 147; const val OP_LOAD_FALSE = 150
    /** String table IDs of "Promise", "resolve" and "" in the pinned 349.9 bundle. */
    const val PROMISE_ID = 30; const val RESOLVE_ID = 34182; const val EMPTY_STRING_ID = 255
    private fun bytes(vararg values: Int) = ByteArray(values.size) { values[it].toByte() }
    // GetGlobalObject r6; TryGetById r7,r6,cache0,Promise; GetById r8,r7,cache1,resolve; Call1 r6,r8,r7; Ret r6.
    // r6+ are GC-visible pointer-capable registers in all inspected Promise targets;
    // r0..r5 can be reserved number/non-pointer registers in Hermes V1.
    // Keep the Promise contract of track()/drain()/send(); do not return undefined to .then() callers.
    val resolvedPromise = bytes(OP_GET_GLOBAL, 6, OP_TRY_GET_BY_ID, 7, 6, 0, PROMISE_ID and 255, PROMISE_ID ushr 8,
        OP_GET_BY_ID, 8, 7, 1, RESOLVE_ID and 255, RESOLVE_ID ushr 8, OP_CALL1, 6, 8, 7, OP_RET, 6)
    // Match Sentry's own empty-envelope branch: Promise.resolve({}), not an undefined response.
    // NewObject is opcode 4. 1.3.6 and earlier wrote 9 (NewFastArray), which made the rest of the stub misdecode.
    val resolvedEmptyObject = bytes(OP_GET_GLOBAL, 6, OP_TRY_GET_BY_ID, 7, 6, 0, PROMISE_ID and 255, PROMISE_ID ushr 8,
        OP_GET_BY_ID, 8, 7, 1, RESOLVE_ID and 255, RESOLVE_ID ushr 8, OP_NEW_OBJECT, 9, OP_CALL2, 6, 8, 7, 9, OP_RET, 6)
    val returnFalse = bytes(OP_LOAD_FALSE, 6, OP_RET, 6)
    val returnEmptyObject = bytes(OP_NEW_OBJECT, 6, OP_RET, 6)
    val returnEmptyString = bytes(OP_LOAD_CONST_STRING, 6, EMPTY_STRING_ID and 255, EMPTY_STRING_ID ushr 8, OP_RET, 6)
    // LoadConstUndefined r6; LoadParam r7, 2; Call1 r6, r7, r6; Ret r6 (invokes callback parameter directly).
    val callParam2 = bytes(OP_LOAD_UNDEFINED, 6, OP_LOAD_PARAM, 7, 2, OP_CALL1, 6, 7, 6, OP_RET, 6)
    val returnUndefined = bytes(OP_LOAD_UNDEFINED, 6, OP_RET, 6) // LoadConstUndefined r6; Ret r6.
    private val falseTargets = setOf("shouldCollectMetrics", "isTracing", "shouldRun", "isZoomedExperimentEnabled",
        "isJankScreenReportingEnabled", "isNavigationTTIEnabled", "recordComponentSpan")
    private val emptyObjectTargets = setOf("expandEventProperties", "getLocation", "getReadyPayloadByteSizeAnalytics")
    private val emptyStringTargets = setOf("captureException", "captureCrash")
    fun stub(target: Target) = when {
        target.name in falseTargets -> returnFalse
        target.name in emptyObjectTargets -> returnEmptyObject
        target.name in emptyStringTargets -> returnEmptyString
        target.name == "timeRequire" -> callParam2
        !target.promise -> when (target.name) {
            "startRecordingAnalyticsEvents" -> bytes(OP_LOAD_UNDEFINED, 1, OP_RET, 1)
            "trackCrash" -> bytes(OP_LOAD_UNDEFINED, 8, OP_RET, 8)
            "scheduleHeartbeatTracking" -> bytes(OP_LOAD_UNDEFINED, 7, OP_RET, 7)
            "recordLateComponentLayout" -> bytes(OP_LOAD_FALSE, 7, OP_RET, 7)
            else -> returnUndefined
        }
        target.name == "send" -> resolvedEmptyObject
        else -> resolvedPromise
    }
    val analytics = listOf(
        Target(34891, "increment", 29689287, 96, "ec5e110000c0000000000020", "1e25406dc16c0a3d5c64ac0062efe9c81bac8f30c324328eb56280be537fb611", false, "25a21b8047d30a6d5b9ec1bb151515d5cdc064ad324f145b8ef5f4f573d0389e"),
        Target(34892, "distribution", 29689383, 114, "185f110000c0000000000020", "e3dbc57028eec0e597e9735f5fbfc449cd60c20ec2764e7ed8321dd470182326", false, "ff9c429aa3de77c96ce74f143eb0d7aaeb5eb71164892402b7eefb69814564be"),
        Target(34893, "_flush", 29689497, 183, "445f110000c0000000000020", "717060a7ba074b3ef6074712284d422786a5dded45261bac4b03315b588fa0d8", false, "c1e91544add7523d6ca089fc16482df5dd26865fb994438fde3744539af74a6c"),
        Target(23516, "track", 28402483, 288, "58c4090000c0000000000020", "c599c4e9a0a166853bd9e3d95db1e115e1461d77ac94dc111cb94b114e848eb0", true, "1c6140f62c0da78268467079ef89856bf2f1a903dde807c654fbb3a6dcd08fb9"),
        Target(83725, "track", 42739443, 544, "7022320000c0000000000020", "60b9bec8a68f800be21eb8231e26da8965678b20ec4313940dac2b3f8632ad85", true, "c8a227e5d774f3d36abbd291464ac6c6f7f9255333ca93a447b41ad212b6ea97"),
        Target(83729, "drainEventsQueue", 42740139, 249, "1c23320000c0000000000020", "a8bdb09d67530df8831d9039eae071a33e1ec91e51c1a6af40ebcb897770bce6", true, "4cbdc91ef734bd818a949b6eaa5add651ef4933ca5f340a52d4ec64ccbb029b3"),
        Target(83730, "submitEventsImmediately", 42740388, 251, "4823320000c0000000000020", "99aac224b96d0bd10c34f435e7c5b826798a69119d2b80db9242ab48eeaf7794", true, "ee98830074be11a437302d457d1746bc158416c30a57577adcc1586f3c858b32"),
        Target(83731, "flushQueuedEvents", 42740639, 267, "7423320000c0000000000020", "40300418ec73fe3ef7ec560dc7f208aa6e87ee3473ef75f461b049285d47b4b2", true, "77be7d04a5068cda99cbb1e8024f3ce538006d562e2cab1459dd4836bce0ac4f"),
        Target(83732, "sendTelemetryEvent", 42740906, 347, "a023320000c0000000000020", "5a0c17d58df89257071ff642105d6dfe0fe9647488010fa7fa3d94d9578646d9", true, "bb5d70ea405723f5b6ea9bbe7857b87b25ba3f317ad1706e6575e2128e141e6c"),
        Target(83728, "scheduleDrain", 42739987, 152, "f022320000c0000000000020", "cd9345fd5fb847433f51b8474cf6aef45d1e84932884f90112ec92744c5276c9", false, "0d33f046f700c9570a0dac72feffcf413271772f7071e061e8bfa4d1fd71b3a6"),
        Target(23519, "startRecordingAnalyticsEvents", 28402807, 13, "d8c4090000c0000000000020", "645fedb3791434b0327d0906ba36e9092b6011627c08db439b28a0b7415f2037", false, "53b8ba7dc6f3883a48fc22b8790398664ba632b48bae1f2c3c9fb20507f5f114"),
        Target(23451, "addBreadcrumb", 28400720, 84, "70b9090000c0000000000020", "767ad172ca48aa39e8e7d017e66c7f2179a04999d7711da4ab21b3409319f14a", false, "bed10171f7f1d8960463eb0936145bf6f6ec8102cde02df609d551edc88711ec"),
        Target(23452, "expandEventProperties", 28400804, 712, "9cb9090000c0000000000020", "8701f636f7b39b17697dc9ec1edaeb4a00198ad53d3e68ed2438b4b03e715ebb", false, "35b5963754ce974738f5819cc9d44ec06d7c2b191594852ece10f6eb3c916d5e"),
        Target(23453, "debugLogEvent", 28401516, 79, "c8b9090000c0000000000020", "cf50b5442afa004767991d1723e7d66350c6cb38aab97606ebd67d365ee5692e", false, "4845c34f92575472cbff7514dc45b63ad0a0f38f1b92fca5f58e7b622226f2b4"),
        Target(23524, "trackNetworkAction", 28402914, 135, "a8c5090000c0000000000020", "2872e724c1af8091ab9f4dfacb2f7a07e4f2f024f426ab631800c01e99da03ec", false, "05fd1679b30726d2837ea8f287191ab2dcc8856f1583341fb682157d81feebe0"),
        Target(23527, "setCurrentImpression", 28403083, 52, "00c6090000c0000000000020", "493f7cb25e1d454138338ae1744d771ef05da76f083ec62cb8e4a73d32124b02", false, "598434da94ba27b6196e2ae2003645a4bd7c9d9e7d26168c6b27c262b60813a4"),
        Target(23528, "cleanupImpression", 28403135, 52, "2cc6090000c0000000000020", "ada879ae54d61bd8673f9b1c62d19cadcc27142bc9eee0b18c0a77ddedd20fa6", false, "34cb19a9322484e8f49affce63446a13400b884609b8d54fe93dc5b2d822e435"),
        Target(23529, "setDebugTrackedData", 28403187, 59, "58c6090000c0000000000020", "1c0892c211dee44c0c5fda0601841aeb22b881b6de2bd25c791568ae5bdd7989", false, "c00833bac06cb655c5a7b3b9d765ba70cf5af99a3adc06f617e88c073317d38c"),
        Target(23530, "getLocation", 28403246, 51, "84c6090000c0000000000020", "cfdec6a64503d8407cd750dfa20417bb2c5e9f53e8cc1adc3fa6b8613c735359", false, "f9cffc0dec885a16fcbb473d68ff03a884f6bcaa697f935b77ea76e2b0ad85e3"),
        Target(40463, "trackHeartbeat", 30620118, 43, "e41f150000c0000000000020", "b44d28a1b2a61a06e4da43236ee20e892021eafd2bae2f348cf703c7179684d9", false, "5b1013b73c9f78363ef050fec744e99aa79c40bd31f0066966d372c37cd46e23"),
        Target(40466, "scheduleHeartbeatTracking", 30620319, 650, "6820150000c0000000000020", "9c6825b5d978799e216302919a445086a005eb208d2e69749c43327c18b5dde5", false, "6a597c43e4c3b3325c3f4e07d887cd6b2b88349375d21163d8b0d98eeeffdab6"),
        Target(40478, "initSessionHeartbeatScheduler", 30621769, 292, "7822150000c0000000000020", "729b0192579d6b948a3c530ee7cd69c1aef9fbdcf1e6c2fc4fa271ec55e47376", false, "5ff500981cac4ea24c988efc7c62f5c299e5b9f80773d45a42caac2fe42bdbb3"),
        Target(47146, "trackImpression", 31762891, 398, "209a190000c0000000000020", "f7c64fc61529d866e0bdab28fa0b4c3adfaac4c689eccd496d0262c7a3e57c49", false, "36fa24352aa56ebd4705f596c001247262772604bde93459b0ad4fc02c91c48c"),
        Target(47147, "", 31763289, 382, "4c9a190000c0000000000020", "b1f24cc105807af98838cd33cfd127909b10eafbb68d40f6cda5649e51061bb1", false, "e58f0b9683aa3b2b8dd5451783c3d93ce144136652ff5d1aeabf6b35f652419a"),
        Target(47148, "", 31763671, 131, "789a190000c0000000000020", "5e8922233e90b2ce244bc981a413b69c1f8da649e3c4be20bc5d7531d2538b24", false, "9e824c448a0c9f5966d515f671b14cdcdaf439cd32cc6ba24efdc8bb5d845a7b"),
        Target(59695, "trackSearchOpened", 35257493, 206, "ec06220000c0000000000020", "2c5a0acd1d2432103c198c32e1cb5f138697f7d3c0f0e587b82c9345f806e595", false, "b5e87c260f1501e8d9023a77f0f86511668747b72ad1fe1b4a53439204f6c289"),
        Target(59696, "trackSearchStarted", 35257699, 324, "1807220000c0000000000020", "9f8ceb066c03f22f1f3c1d8808e41a09780b6cc314db519f2eb068063c44bb27", false, "177fbdac0994ce02be07492e579bf1a5f9f5acaeb161d09128982bea42781816"),
        Target(59697, "trackSearchResultClicked", 35258023, 431, "4407220000c0000000000020", "178507a274408aec453aa930abef983e123b62cb33afbe7efc987655d53afc0a", false, "4932cfe96a5d7a8eae357f085c8d6d1bdbcaae057211ab4a7e3e75a56e786baf"),
        Target(59698, "trackSearchResultReturned", 35258454, 415, "7007220000c0000000000020", "65fa9d609deda9030e1aa4e66530a0bd303f94beefb9c1f4033d43c63ff3c06d", false, "5b56842bfec1a987647eb641bb56d551701f48caae75fc44e88dd96215b86baf"),
        Target(59699, "trackSearchEmptyResult", 35258869, 302, "9c07220000c0000000000020", "b690e4b76f31d58d0aafe1cbffe2a064038e362ed69bbdbe8a4a9ecc0a744527", false, "de5868cd504042d37275958e6924ea6b6ba298d3ffdb57dfeadde431a0e475d8"),
        Target(59700, "trackSearchEmptyMessageResult", 35259171, 302, "c807220000c0000000000020", "030cce30bffde4cf551fc056968b5d7c5f22e2b039a42795e5c8328f03d10fd1", false, "d78ed7f57068cfebfb3e07ea7829ddc0cb60518607fb7fc8145aa85d8e82e995"),
        Target(59701, "trackSearchClosed", 35259473, 44, "f407220000c0000000000020", "b5f3869a357132049e5f86fd2ad31ce090ef4badc938be6b6f645e67877dd221", false, "d0da73ff169364a5c3c3873b047d6c8a8a4006cd184d7159deb400026f8007a5"),
        Target(59702, "trackSearchIndexing", 35259517, 181, "2008220000c0000000000020", "fc795f3b63226128f79ace5301ad2c800bd9c4a03854d88044bca69f228b6670", false, "af2daef87f3adb71e56383f99a05f2fdb611871a0d7cdaeda3e812c035883d9f"),
        Target(59703, "trackSearchHistoryClicked", 35259698, 194, "4c08220000c0000000000020", "b4fc5efafd01f88162da979ee3aefb855ef7c957386995215bd14a7563e16141", false, "b21e91882dc2ae21660e70e050cb2ee806063647aafa2b84158ac405f835ff8a"),
        Target(59704, "trackSuggestedSearchClicked", 35259892, 176, "7808220000c0000000000020", "ca490e4e50731b75e8a6ad1f66d2435ff46e273c3fef97899e4319a1e3163b4d", false, "54a3b39eda77f3831587ac36eb6defffdb7909ad71e233c947a09243fec67735"),
        Target(59705, "trackSearchFilterAdd", 35260068, 298, "a408220000c0000000000020", "809e09a7ff6a5ff0761799f9007119237490b55feaf805198f3f17931b539dd5", false, "a206f2cda73c984e7d836cb203564421b619dec22df45507943f3825a6787fb5"),
        Target(59706, "trackSearchFilterRemove", 35260366, 299, "d008220000c0000000000020", "7e2e440950f67cb1b9ef5035072cf60110bbb408bc8d12570ba9e98de1aaaa08", false, "7f4ee4a6e32ba53282a9c14c8aeb5335d6e6a983b01082c28689a8ede2f99cbe"),
        Target(59707, "trackSearchTabSelected", 35260665, 161, "fc08220000c0000000000020", "16075c7edab0987ad45fe750d2dfbea1e5e738123f466bb416b98ee1c2f10ee6", false, "14a3f6f40c0a35380188c2ae49d4fe0f46a1108d2e55c5d0151e32f56b2f56c4"),
        Target(64068, "logReadyPayloadReceived", 36817306, 509, "d0fd240000c0000000000020", "a694e27ab7a96d38b28652880ea1c65c8990c4c5ec0efb2f6c84f200bdeb8b7c", false, "cf90d2b03fe194db1dacd073a262c8956a7cf92af1aa12768af760440981acec"),
        Target(64070, "getReadyPayloadByteSizeAnalytics", 36817916, 892, "38fe240000c0000000000020", "4374843b5f239213e34e423d8d300686d83d7bd47d660e69b219ab508451e31b", false, "178f81154bac2282093bd349e96a642de79662f032b60ea479fb5cd9617de2a8"),
        Target(64071, "logGatewayConnected", 36818808, 184, "64fe240000c0000000000020", "9a51faac2ff58488fd581318ef1c5e52ea26a9a31a767ee7657ffc9e2f16d0bf", false, "19cf3076f1e00adfb7a57ef21a26169534d918734548729fcfac6ec03bf8a5c1"),
        Target(64073, "logResumeAnalytics", 36819059, 323, "bcfe240000c0000000000020", "7e10402c65fc25c714adea66e5d0c15e3fa719a61c08fd737b362738d54846dd", false, "3bce8df9eb697bfc2f7591ee7391ae7e41535fcda775fbb19a01b0424ee54e07"),
        Target(75652, "componentDidMount", 40721287, 405, "98cc2c0000c0000000000020", "63bc80382aefb474ee21bb77ddf475544db3bc2447e2a20d2ad30ecbae2f8ffd", false, "bc58fbcdd68bebdaf5f4e6993d86a4308ec3ff2e6e618373878110d3a0a1d3e6"),
        Target(75653, "componentDidUpdate", 40721692, 1503, "c4cc2c0000c0000000000020", "a4f1b4c02f871f240e455db31620e78c1f2eeec0c35ac405c7f340147aa57a5d", false, "29798355cef7acaf55638ba23b5c13b2576dc8f509979f69dc47c4c22079038a"),
        Target(75655, "_trackWithMetadata", 40723245, 163, "1ccd2c0000c0000000000020", "56d5a912205cc0a35e54da0f1e83382ea114dbd21ea1db22ba8d02f0693eac6e", false, "0a11c22111a4476ce93699a54df56b051a7d83a739ea7ab0021d057a094f7d13"),
        Target(77602, "_initialize", 41582491, 103, "c81c2e0000c0000000000020", "891f8138941d2b684bb3e83e3b9a1983de0374aad26e054cd790f1a79ef24d95", false, "0ef5be0230a05813a514bfa823b71eabced5a8f9588f5de25020bc386f46c23f"),
        Target(77604, "_trackStartSpeaking", 41582649, 238, "201d2e0000c0000000000020", "5c8a620f01ae51a6701ab50f28158373aaefd6ebafaf69ae5a3f8a6bb3de913c", false, "4be00d93e30d77683f58e0fca23199f17ef8553c83ca2de247fe5027d4e9aa26"),
        Target(77605, "_trackStartListening", 41582887, 237, "4c1d2e0000c0000000000020", "bac9eafa5ffc01933a0b9e4a361cf1a20324d6fbe1db910ce1001fa0ab70b50e", false, "eb90161179485d9d50174eea52d05c43057f0752e87345fcf18fe031a9b35329"),
    )
    val telemetry = listOf(
        Target(19961, "shouldCollectMetrics", 27935181, 86, "2852070000c0000000000020", "32c03ccea5180dd4ae345aae6a8c1154fa424eb258ee639f3bcab81476a00db2", false, "15e3f6d2befa897bcbce94ef1650fe62896e5b5f4de02f410439516c0e9e62de"),
        Target(79635, "installWebsocketTelemetryHook", 42260058, 183, "407b2f0000c0000000000020", "08df586ef1daa2d3988d8211fdca35d156aaf251b191afe872435d57ca872d4d", false, "d69f20e36053d11d037720437cd31eee8c30eb239b7facba02ec9e77c3d1ae22"),
        Target(25490, "append", 28733512, 88, "68170b0000c0000000000020", "3c9a6e00b538b9560de405bfd65fb823a2ec69e3d70ccc787aae1beb36568614", false, "2b79ec34e2656eae64f97803a1c8003e2452a30484aa8b31be03637c554c4236"),
        Target(25493, "append", 28733662, 52, "ec170b0000c0000000000020", "556e5a8ab684e4411f453f72e3875a3527036a6e72b38a6d1e0a0d1ffac4efb9", false, "a8ba6166a1e89526fd3f53a7f1d2fff7f5abf7537439fd74fa4369cdcfc9946e"),
        Target(18182, "fileFinishedImporting", 27674580, 24, "681e060000c0000000000020", "dafddb86c3b8c6cae923208bbff8617bc7b3a213333e42fd609fe61262b8b87c", false, "9e79105baeed2bc630fbb1097029da7175d4d62373582768012cecca7fd18976"),
        Target(18264, "isTracing", 27688297, 79, "2c2c060000c0000000000020", "7921c823b8e8308d70f6efba657195cc11561caa70ebde7c4e6f509d646d1b1e", false, "dfdca7920729e801ffcb701e09ba2c60cfdd0202577fba51cd7f18546098d8e4"),
        Target(18142, "", 27672463, 19, "a017060000c0000000000020", "657e48193e5ccd34aa17f779e76216ecc1ac7ccd883d1a5f743ab17633656c37", false, "8e534566b131800b422b0e2bdc983dfac55e320c80a09edd5fa8366bc298d180"),
        Target(23397, "_initialize", 28395179, 183, "e8af090000c0000000000020", "ea1c14265d5279a51c841842cd79554c559fd00032b4e0052051eca53a6b4eaf", false, "ce66a61ff8998c487102fc2763015c9a159a3a674015c5896a125ec83f8eed8b"),
        Target(25468, "shouldRun", 28732431, 34, "b4130b0000c0000000000020", "4a501b99c8cbd193a14854b90af6d9c679f3dbebaaafa8b5ac5d5261fa13287d", false, "db7c9e49e77ce899bd64fd1b2aeaf8ad9251d0c41bb267be66f3a4c14a0f9a61"),
        Target(25473, "isZoomedExperimentEnabled", 28732550, 35, "84140b0000c0000000000020", "e57d7d92d496cc029c3c5fdb1a215d1963c991191791f841544927b28d18a913", false, "17f7c677d3c148814f45bc74c3d1db7d62867c2a5c2253e243c6eb51d27843b3"),
        Target(25479, "start", 28732811, 102, "84150b0000c0000000000020", "c4dc3e0885d295daba65f56ad37ae10a72ec5eda369b249b3b0b507af0e91845", false, "182a7776167860900080095ce6e07b12a13a68a705e7111c8ec1a917b47ca586"),
        Target(25485, "_kick", 28733208, 119, "8c160b0000c0000000000020", "c9ea144400db3c1c0c17a6324e43b66677535ecf30886ba3148e2dfcbff337ad", true, "dc796dfe05a37f2bdf2fe0d0e6b89af716b7941a3c1b63799ae9c1f7d49b25f0"),
        Target(40506, "trackAppUIViewed2", 30625007, 43, "4427150000c0000000000020", "5a4d0c8114a669f761bf6ae9e8c83da672f6cef7f0db657dcecabcbfc5973ef8", false, "35aa8239f099254f45186641c908a738562d8b7c43798aabf9b71d43eaa9ff36"),
        Target(40511, "trackAppOpened", 30625294, 184, "2c28150000c0000000000020", "791d215bb4d45540585a71ce4ddbda1f66448294637211cb108ee10c0ee8fd0d", false, "e66f1ef1e912d924449e09ade03b740118a41a50e6c14348df312f85e2b67768"),
        Target(40512, "trackAppUIViewed", 30625478, 106, "5828150000c0000000000020", "c128dbf7da90ebdb7b258e68e60ad3cb62cd7fba6d7cd1b25ed358531ca38e42", false, "8132b12acfdb70a59864e4a876897326611af3253372fdee4338d88e217c703d"),
        Target(40514, "trackAppLaunchCompleted", 30625584, 120, "ac28150000c0000000000020", "2ef4d3dcf1cf3421a59771314ea150c6059d1da0b192ade65477d5bc9cea0a6a", false, "bb9f899ededd9499e068d40db44ae2ddda8ab557f8e0b9f78e2423740788e2b4"),
        Target(40654, "timeRequire", 30636994, 274, "b841150000c0000000000020", "dc532e1310887e3642c7a81d3ff4bf9172bac710ca2cbebf756f56c5e2d91ea0", false, "8c8278801fbae426e5e2368b35f0feb5a599b632d2da3359a60a7a38471d1206"),
        Target(42122, "ttiRecorded", 30794302, 51, "8440160000c0000000000020", "f1cd0a6f99396e442230c7068a3be21a6e1bc9d3453aa62f8bcaa3e600b22ec2", false, "503090129377ad4ec0bcdee01347f4c71d8d5f7180b405a6de0e0dabebc15168"),
        Target(42124, "trackAndroidArtProfileSnapshot", 30794414, 44, "dc40160000c0000000000020", "b926b1f96f287929881cb7c63587d943fd7d8bc891981dc25e093cbeddd76d18", false, "e56d2f1424f26b7a3758bbacd981c93a710385028874884ea44feb1a0e2b161e"),
        Target(67297, "_initialize", 37552177, 30, "ac2c270000c0000000000020", "56ef043699efe2694812baa76be4689a43d7b0f6db3ffdf4508d228fb26f8e3c", false, "cb36e96414e3307f966b06d7a3b1fbcdf0cbe7364a0dac7636da86e8c12a3da1"),
        Target(72113, "isJankScreenReportingEnabled", 39139788, 62, "ac682a0000c0000000000020", "d71e2f823f1a42f60bb43b6a36b215097d7aa552cce3ee389bb9c58d14448c9e", false, "ff50b57850f0932ab7af42fc84a5fa7bff91552e4e742f120504b8b893df4864"),
        Target(74070, "isNavigationTTIEnabled", 39969262, 76, "00ba2b0000c0000000000020", "7a15d1aa86a3987be75bf03bd655b38a18f41816add721ff4d68794de89733d7", false, "0ac62bc3a99a71371b8348163a1d39dd32e34d842e984155dc350cfc46836cf4"),
        Target(74099, "beginNavigation", 39983296, 352, "fcbe2b0000c0000000000020", "387330b542ede45d8ae7b9a8e6ad446f1ea4c8db8e281e427eaac5cc05eecba2", false, "ea32ae56ee8294dc564507db95c59cc5bcb86370212c23d92e86bdb8501c4778"),
        Target(74100, "recordComponentSpan", 39983648, 464, "28bf2b0000c0000000000020", "7c72857e4c8dff5d9488d695ec936fb26e748b8acc93bd509b7b038eac8adf2a", false, "839e6439e0cccf9c37af69bc70b72ddca31a374c83e33fd24abf4246038e7855"),
        Target(74101, "recordLateComponentLayout", 39984112, 246, "54bf2b0000c0000000000020", "1528a91c683df566df9b2fbf91a424ee410b732b39813c9372808d165745f6dc", false, "1b95d52532215ea495be9d15fcc551c3a21429cc67cfbd08349d66b08435949b"),
        Target(74105, "flush", 39984700, 230, "04c02b0000c0000000000020", "f8371a5a0ddb04f59973501daf8e8a963b11bf49dfc03996aa929e7366cdbcb9", false, "c57b709460958936f7301d660767c47776921ddc018acc2f8a80e9436779a612"),
        Target(77403, "trackHttpRequest", 41555811, 220, "8cfa2d0000c0000000000020", "5f9db9cfe1e6f5702e37efea5586cd276633b694dc99c86722c3231f4a490c7e", false, "041cc2967036d5e3b236ed1c40ed15bdd1a994cea0a8b57be892f13daaef8433"),
        Target(77847, "_initialize", 41633753, 71, "0c472e0000c0000000000020", "b338dd97c21aed14279f8f9cc85288aa2ed739c626e64c7f61cfe8982fc6f25b", false, "fff261a2f13345637698360bf0586761c063d10fc42b91487402ce9c2d4f3351"),
        Target(77850, "deliverPendingSessions", 41633972, 122, "90472e0000c0000000000020", "7bdb0d8b1271cf5152cab64504cd4a19b4a95cdd8351c54cf76ceaa5eb78f8cb", false, "0758f7036e7905639898bac65ee2eeb283381d41363c26056744f57e6cb4c748"),
        Target(77852, "attach", 41634114, 120, "e8472e0000c0000000000020", "83c8fde4048c7b2a5636f9dee911bf884440cdbeffde0c27d4be8124ede59bdd", false, "117d942195d67e6ab333591d675ea1db221d784adf930e07977edbac1c83dbd7"),
        Target(77853, "handleDispatch", 41634234, 124, "14482e0000c0000000000020", "49c03e0208ab689d5670cea568918598174c15295ec13178b643bc44663040d5", false, "94f7017cb34812561dac7f1dcfdaf0e4eda42e10023e2e08dc8f5bebeea63da9"),
        Target(77854, "handleStateSettled", 41634358, 160, "40482e0000c0000000000020", "e76fb03ebede972f37e5059f44478974303f5ce729c606c8bf060db4bede9a5e", false, "7db0b7b10a8da2f9d5bcc2621ab1fbc6bcc45dfe16c2843171a6a67944b4ab33"),
        Target(77861, "handleAppStateUpdate", 41635445, 119, "74492e0000c0000000000020", "d623c703714b0a87bc571f5dad1256883eec463f079ea8e3f9cc7620c8b1aa5d", false, "463986f3078fe149200e8b92014a0d854f8867a1e33a07a80e5b171a0680f8d5"),
        Target(77862, "handleConnectionOpenSupplemental", 41635564, 37, "a0492e0000c0000000000020", "e70d038413f959cec5c8fb807fcd490f9ebe16cf8300ab144c4f5b94891829df", false, "9f0fd6b3a51f76d5b52f9290cb00b295554da89ac3620bb7566d618a16fc2a88"),
        Target(77863, "scheduleReport", 41635601, 69, "cc492e0000c0000000000020", "e0e4453fdbb3988566d74ba05b7c106031c49adf522aa6b56fd87545a368ad1d", false, "83002e0e4b099b27aa9fbc580b12e0a5d7391ca2ff486b183dfe7161a83c0481"),
        Target(77864, "sendReport", 41635670, 232, "f8492e0000c0000000000020", "bd376b19ae11946a30e9e1e82e3ff855fd8716222c54dba2e0a75026e417a047", false, "84accb5728b28c12ce436e8752dc9976eb43e1a36ec4366dc8f56e7edbc64127"),
        Target(79535, "handleChannelSelect", 42223748, 322, "48692f0000c0000000000020", "abe3d603878b9304f7e8e2f3e195d9f606d1b65ea2367e7da0556f4b028092de", false, "4064a58f2ad83d4033ca15373f7cf13a14734d151a184a4ebdedb731a7ea1aa8"),
        Target(79675, "flushDelayLogs", 42266469, 164, "5c822f0000c0000000000020", "0cf0bbfad8f7104cd81b0a5536b5070b76c566a6a8ab38918719592229405e8f", false, "0fe5588291be6a40ac406e3563e10e3e95048dc90ea933ea8547b8f38c9debee"),
        Target(79676, "onTimersDelayCallback", 42266633, 247, "88822f0000c0000000000020", "e2e4a592e9e5c02047ffeb6a5493bdf703f42ad9f4b0d0fe366750c69c901a68", false, "0e65bb6719d5a8d727483bc31d1236872dd52dab3b3d634e317c67db5f47f66c"),
        Target(79677, "setupLibdiscoreTimersMonitor", 42266880, 39, "b4822f0000c0000000000020", "b2b044cb6f2a919f6b50369d5998fd494aa98c301f2a765b5c3c6601e8ed553c", false, "9f96eca3e59313684fe42f9ec016f9f19ef651010123ccd114570200d4dae751"),
    )
    val crash = listOf(
        Target(81910, "send", 42535132, 180, "e4f6300000c0000000000020", "836e557192f35129d00fae6f91c66b241a903c5432cd4a2e543946545f27284a", true, "337522bcfb2e337d17d17055d63e4386fb9a2b89e3a77f399e078bb675041fd6"),
        Target(112524, "send", 44834602, 181, "0c02450000c0000000000020", "71e39c284d7d994c4da70e6c83b3d07bd29876a3014ae4fa4bed4f58da6dbdd5", true, "21a578390b9d31b5e013d310c306f0856b4f14accbc1ccd60593b0f4dbf24b70"),
        Target(23394, "initSentry", 28394914, 43, "64af090000c0000000000020", "58b52acc8504bd61efe543ae7149fa5de1fe8d95321785e8773a78cece8c83d9", false, "4c9653875ab2c2392310d1fd6d722c2d8475cb99f06e673dd819625a663c6eaf"),
        Target(20422, "addSentryBreadcrumb", 27972774, 97, "48a9070000c0000000000020", "bcf11046c55e7ecf47bf4df6346d8ea17c33f34d13f05e5c841c44fa8d8ed38d", false, "84416483c0e7f7b4fbaa22f03f59c24f0ef32b7b62199164df148401b4f76c51"),
        Target(23375, "setUser", 28391583, 104, "10ac090000c0000000000020", "cc2e362a5eb645fef2caf405938d374214e3a71d476ed8f0581ba81dc335cf68", false, "15ad06170795ffe442df606f1077154bce522da568cbe0aeb24af109b2751fb2"),
        Target(23376, "clearUser", 28391687, 78, "3cac090000c0000000000020", "05079bed2e6f75cd8e2c625619ae0f69f97e3829264299d76d01b267d05b3ba7", false, "06efcf20b951ff54a4439c7be93f5a869565ce9a7af65f453c56dcb6635655ec"),
        Target(23377, "setTags", 28391765, 48, "68ac090000c0000000000020", "44fd2159c59c80fa3d6a1510f28f129b8fea75a6dac114dfb307c209c34b1e38", false, "8cc0e03205bbf2f54e42bf9136f16a83a611449b2d0ae4e64bdb205b013415db"),
        Target(23378, "setExtra", 28391813, 48, "94ac090000c0000000000020", "fcf3a81576668e3cb0bfc44165a9852da10047d16ef74f0d012718598b65ceb1", false, "ab2a84a9e993e9439733722a5b6961c84ec977abaf226e5079f2666be5eb0acc"),
        Target(23379, "captureException", 28391861, 87, "c0ac090000c0000000000020", "f545bf42a5daf9f40596119758061c5b765da8e17457764442c6eb5adda0fed7", false, "5f0e9d2cc1fa539dcab634e1b860435e80988d9e61cfc1756c56c7c516698033"),
        Target(23380, "captureCrash", 28391948, 162, "ecac090000c0000000000020", "7e69df9aa659de0d8f2c34a1944252a5ee282c4251acf3b7657281215b0d5ead", false, "6b351bb8aeffe444962e271f1a50eefcf410b7449a0d7b55e610b7cd0f3da1a9"),
        Target(23381, "captureMessage", 28392110, 90, "18ad090000c0000000000020", "78de1a1a4dc8afdd66de30aeab20b0fc211dd15d3a20a10656cee4366761dce6", false, "d14da7175cc4bb1068d8422fc76e26045c79a18c8d05768e3ed7225056cba62a"),
        Target(23382, "addFeatureFlag", 28392200, 106, "44ad090000c0000000000020", "9c44b7f91901f14f99ff7d164f2137e2cdab124e39585b1b441d02d5076e3f82", false, "23d431805b400a5876a78295ed2f5cf75a2a1f9ea5f5ce17df1234a8ac71bd29"),
        Target(23383, "addBreadcrumb", 28392306, 54, "70ad090000c0000000000020", "526b823a4a27bdddc47b073f41bac9af61e877e59c50c6042d056f9eade1c940", false, "155603ff5c3050559ba06fa9dae733501d87feb61a7e5fb6c954ab8ee4aea985"),
        Target(23388, "getLastCrashReport", 28392575, 35, "5cae090000c0000000000020", "f81127e750a76dfb3f097512b65701cdfc7ef7b3299909125e0230ce9bab4571", true, "1eef3131261721e4134d75b3050bb28f53aa7227d8b2a198ebac25ef640398ad"),
        Target(23393, "trackCrash", 28393643, 1271, "38af090000c0000000000020", "ac4cbcc16ec5343362e7bad971870a25c599a2d00b6053f3fb2c84ea97f5c633", false, "5b8ed3110cc784c7e2857ff3ee122a293dd64873e22cad346c3d09820aaf7ee5"),
        Target(79678, "init", 42266919, 23, "e0822f0000c0000000000020", "75035a19a7a2a29c1647003aa609d69a5dd3baf9f63c1b45bbc40d206a707b9e", false, "6351724f09d94187b87fa0240e1ad2443cf027d954fd98b7c21131878684f3f3"),
    )

    fun rewrite(bytes: ByteArray, targets: List<Target>): ByteArray {
        require(bytes.size >= 148) { "Truncated Hermes asset" }
        val header = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
        require(header.getInt(8) == 98 && header.getInt(32) == bytes.size) { "Invalid HBC98 file header" }
        val inputFooter = MessageDigest.getInstance("SHA-1").apply { update(bytes, 0, bytes.size - 20) }.digest()
        require(inputFooter.contentEquals(bytes.copyOfRange(bytes.size - 20, bytes.size))) { "Invalid HBC footer" }
        // Validate all targets before changing anything; allow previously selected *other* privacy groups.
        for (target in targets) {
            require(bytes.copyOfRange(128 + target.id * 12, 140 + target.id * 12)
                .contentEquals(hex(target.header))) { "HBC header changed: ${target.name} #${target.id}" }
            val small = 128 + target.id * 12
            val expanded = (((header.getInt(small + 4) ushr 14) and 255) shl 24) or (header.getInt(small) and 0x1ffffff)
            require(digest(bytes.copyOfRange(expanded, expanded + 40)) == target.expandedHeaderHash) {
                "HBC expanded header changed: ${target.name} #${target.id}"
            }
            require(digest(bytes.copyOfRange(target.offset, target.offset + target.size)) == target.sha256) {
                "HBC body changed: ${target.name} #${target.id}"
            }
        }
        val result = bytes.copyOf()
        for (target in targets) {
            val stub = stub(target)
            require(stub.size <= target.size)
            // Unreachable (opcode 0) padding removes the old body and leaves valid instruction boundaries.
            result.fill(0, target.offset, target.offset + target.size)
            stub.copyInto(result, target.offset)
        }
        // Same length/tables/debug maps; only selected function bodies and the mandatory footer change.
        val footer = MessageDigest.getInstance("SHA-1").apply { update(result, 0, result.size - 20) }.digest()
        footer.copyInto(result, result.size - 20)
        return result
    }
    /**
     * Identical result to [rewrite], applied in place: validates every target first, then only
     * the selected function bodies and the SHA-1 footer are written. Streams the footer hashes
     * instead of loading and copying the whole bundle once per selected privacy group.
     */
    fun apply(file: File, targets: List<Target>) {
        RandomAccessFile(file, "rw").use { raf ->
            val length = raf.length()
            require(length >= 148) { "Truncated Hermes asset" }
            fun read(offset: Long, size: Int) = ByteArray(size).also { raf.seek(offset); raf.readFully(it) }
            val header = ByteBuffer.wrap(read(0, 128)).order(ByteOrder.LITTLE_ENDIAN)
            require(header.getInt(8) == 98 && header.getInt(32).toLong() == length) { "Invalid HBC98 file header" }
            require(streamDigestBytes(file, "SHA-1", length - 20).contentEquals(read(length - 20, 20))) {
                "Invalid HBC footer"
            }
            for (target in targets) {
                val compact = read(128L + target.id * 12L, 12)
                require(compact.contentEquals(hex(target.header))) { "HBC header changed: ${target.name} #${target.id}" }
                val words = ByteBuffer.wrap(compact).order(ByteOrder.LITTLE_ENDIAN)
                val expanded = (((words.getInt(4) ushr 14) and 255) shl 24) or (words.getInt(0) and 0x1ffffff)
                require(digest(read(expanded.toLong(), 40)) == target.expandedHeaderHash) {
                    "HBC expanded header changed: ${target.name} #${target.id}"
                }
                require(digest(read(target.offset.toLong(), target.size)) == target.sha256) {
                    "HBC body changed: ${target.name} #${target.id}"
                }
            }
            for (target in targets) {
                val stub = stub(target)
                require(stub.size <= target.size)
                val body = ByteArray(target.size)
                stub.copyInto(body)
                raf.seek(target.offset.toLong())
                raf.write(body)
            }
            // Same-process writes are visible to the streamed read; no flush to disk needed.
            val footer = streamDigestBytes(file, "SHA-1", length - 20)
            raf.seek(length - 20)
            raf.write(footer)
        }
    }
}
