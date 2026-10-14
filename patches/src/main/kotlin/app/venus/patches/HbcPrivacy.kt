package app.venus.patches

import java.io.File
import java.io.RandomAccessFile
import java.security.MessageDigest
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** Exact, inspected HBC98 functions. No eval, runtime hook, remote loader or settings dependency. */
internal object HbcPrivacy {
    const val ORIGINAL_SHA256 = "bf13d2dfd752b7802d7edd9e4c8b0d950f20bde5a98634c5256cc6ff42b02d90"
    data class Target(val id: Int, val name: String, val offset: Int, val size: Int,
                      val header: String, val sha256: String, val promise: Boolean, val expandedHeaderHash: String)
    fun digest(bytes: ByteArray, algorithm: String = "SHA-256") =
        MessageDigest.getInstance(algorithm).digest(bytes).joinToString("") { "%02x".format(it) }
    fun hex(value: String) = value.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
    fun verifyOriginal(bytes: ByteArray) {
        require(digest(bytes) == ORIGINAL_SHA256) {
            "Unsupported Discord JavaScript bundle; use the original 348.10 - Stable APKM"
        }
    }
    /** Same check, streamed: never holds the 55 MB bundle in memory on the patching device. */
    fun verifyOriginal(file: File) {
        require(streamDigest(file, "SHA-256", file.length()) == ORIGINAL_SHA256) {
            "Unsupported Discord JavaScript bundle; use the original 348.10 - Stable APKM"
        }
    }
    private fun streamDigest(file: File, algorithm: String, length: Long): String {
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
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    // HBC98 opcodes (Hermes 250829098 BytecodeList.def) and the pinned bundle's string IDs.
    const val OP_NEW_OBJECT = 4; const val OP_GET_GLOBAL = 61; const val OP_GET_BY_ID = 69; const val OP_TRY_GET_BY_ID = 72
    const val OP_CALL1 = 108; const val OP_CALL2 = 110; const val OP_RET = 118
    const val OP_LOAD_PARAM = 137; const val OP_LOAD_CONST_STRING = 144; const val OP_LOAD_UNDEFINED = 147; const val OP_LOAD_FALSE = 150
    /** String table IDs of "Promise", "resolve" and "" in the pinned 348.10 bundle. */
    const val PROMISE_ID = 30; const val RESOLVE_ID = 34208; const val EMPTY_STRING_ID = 255
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
        Target(34538, "increment", 29512836, 96, "b8f60b0000c0000000000020", "cd9704862684ca16d09d926f5509b43cdffebb26be1255a4e4f4f185103bf4c3", false, "38266003196ff693d96b3f785ba4b59565d83db194b3998bf8a18488b188ef8a"),
        Target(34539, "distribution", 29512932, 114, "e4f60b0000c0000000000020", "dc444ea70a2ea6173d69f86147fd8df3d6ed6d0cb5ad2099f1fe25f0c97f823a", false, "f56ab0d287b3fb40a4c1f128ee1dd361c310e2858ea7cbcb73642fff8aad3fda"),
        Target(34540, "_flush", 29513046, 183, "10f70b0000c0000000000020", "fc89cd95532940cebef4c4dc8bb4154dc60a01a80734316d6c6345e8a6e1f335", false, "5987e7ea557c2424dcd66b2b998c6a488563c27085bdedd1268b5f4e8cbd7570"),
        Target(23150, "track", 28215915, 288, "d459040000c0000000000020", "451a7cb11d18cb6efef048b7f19f64567ef263b8a66f1ddc3ea45508d4bd0986", true, "ea2f2efff586f65c269b92d2f94b55a6a211f578f87d46ec114a3393b806bffc"),
        Target(82662, "track", 42435219, 544, "30402c0000c0000000000020", "b31cabeef5d72dc04157eb6e52f34c4d9187660433a6de8199c32f635fd442f4", true, "be54d0db7af9c03aa36468444ba42f22a7418eb3a10ed9f18d9f3119a5b039dd"),
        Target(82666, "drainEventsQueue", 42435919, 249, "dc402c0000c0000000000020", "e0db703ba3d77ee37f81f6bdba380a209ed43ce3e01fa5510848a0d6df752f8d", true, "f30ab74fe812b5e9dabd6c1b3f2729d241eb0e8ae6d851a8d822c0f47e281d38"),
        Target(82667, "submitEventsImmediately", 42436168, 251, "08412c0000c0000000000020", "12080c495df0902b5c8eb286c1e5d5330e7aa84674f5ba2ef62e264350d04bae", true, "8ac5a5ccd08c5d49251be4391b6da32b339533874bade997fc2dc6d16bc2d518"),
        Target(82668, "flushQueuedEvents", 42436419, 267, "34412c0000c0000000000020", "affb23bf3145a6b7604370b7d71f521726fda62fae3319271c05f8a4c0621b59", true, "a2cbe15880dd0e45b6547eea0652759fda9b845d1f4be96c88920d5fdfc82a4f"),
        Target(82669, "sendTelemetryEvent", 42436686, 347, "60412c0000c0000000000020", "0e72d1011e06dfd9f2c28c21b0acc735bbc683812494951fd9d2f8375587ade2", true, "8c58cfd90c11e0dc6aed1828d6dd858dec15a0d950b6d26036a252f92ff2f1d9"),
        Target(82665, "scheduleDrain", 42435763, 156, "b0402c0000c0000000000020", "3bc990ea806d7a0ff5d6e28fcbdc65f831b39c656a163cc98ed63683e479c551", false, "1111b69d32ee2232d81feaa45176381ae20e3fefb160f96601a78c17d67eabdf"),
        Target(23153, "startRecordingAnalyticsEvents", 28216239, 13, "545a040000c0000000000020", "645fedb3791434b0327d0906ba36e9092b6011627c08db439b28a0b7415f2037", false, "c3ccf2cac54d5a8008257f1bd1f14bd42bb345fd425836633eee0155ea271bf2"),
        Target(23085, "addBreadcrumb", 28214144, 84, "ec4e040000c0000000000020", "888b12fe5670ab194b7cd17a5b56a680ea18656afbbaf94594241ddac24cc06e", false, "9c9651f31a37e5165153587ebaf4bff6c310fe99a8d86ea69e9a919dfbd2b989"),
        Target(23086, "expandEventProperties", 28214228, 720, "184f040000c0000000000020", "ec3c8361bed6753e25f5df8d6f71b12aff393a44940308995179332c093eb22d", false, "9a61a5902655b6cb069620e492700fd35903c422bf7ca8afdbec89a8d0226b21"),
        Target(23087, "debugLogEvent", 28214948, 79, "444f040000c0000000000020", "0198a87b0fed0e7b07344332351caf090bbd959550d998b76032c49c2301b7a2", false, "06c83f38b1f19991a9b8a163b401ae3d7b5255df1560cab22c4049aa23dd396b"),
        Target(23158, "trackNetworkAction", 28216346, 139, "245b040000c0000000000020", "0c4871b38690362f88b202b446f5dad0fc88a46674ccb988aade28472977c154", false, "81d915ba70e5fe9ac91b9fa89bda2d611389606e9739a4d98e2062ef862b28d7"),
        Target(23161, "setCurrentImpression", 28216519, 52, "7c5b040000c0000000000020", "6aea001eeed42b7f11a3a657fb1f79cda07dcdaf5213a2168741bda7b77ce445", false, "b6b726814310254698df7bfd397e93712b5bc09322abb81855d8e6d6066c9277"),
        Target(23162, "cleanupImpression", 28216571, 52, "a85b040000c0000000000020", "7eb0a9d93022188276744f1f5a36a81ec98e5af8d8ddd5d2860b1fa9af75aad8", false, "2bee5a0c2c0933aa1e0ac3c9a897ec541c9e608c06c6ac7f80537317b71b5bef"),
        Target(23163, "setDebugTrackedData", 28216623, 59, "d45b040000c0000000000020", "8f2dfe68f4906783babb1ac03a916b12fc3399dad43d7934d96d729eb100eb45", false, "524c22ee1d2cbc6333f178061bfe91baeea98ec6404b0ff43fb24d45eea54e4b"),
        Target(23164, "getLocation", 28216682, 51, "005c040000c0000000000020", "675cbc0e94206228914af58284bb0538630c3d16904a0bf4a3efd7cdcbeaa463", false, "4982ca56d478ae811ae58bb5065a7e7c63f6535715b15b90e5a1449abb60f2c0"),
        Target(40779, "trackHeartbeat", 30532952, 43, "b828100000c0000000000020", "b44d28a1b2a61a06e4da43236ee20e892021eafd2bae2f348cf703c7179684d9", false, "822917ac56afb66aac0263836fe793cc56f092ac9bdd253e8cde2d89400c7954"),
        Target(40782, "scheduleHeartbeatTracking", 30533153, 658, "3c29100000c0000000000020", "5545d0dbb40427b3b5bff602f7dfe216f39cf6d09071cf6bf2ece2909cd94e38", false, "2d3d94ccffc701108b7e9ae46cf4dde680564fbc3772bf889ecc926f8a4827b8"),
        Target(40794, "initSessionHeartbeatScheduler", 30534611, 292, "4c2b100000c0000000000020", "ddde4eea38150aa1b8285a0b3e796578b3cd1d20ce52fd6231c44565528b149f", false, "842db3bdfa55e0d81ecd92ffab8e0a3565b594511c980eed43a9d57465339add"),
        Target(46836, "trackImpression", 31621130, 398, "e838140000c0000000000020", "ae093c0770ed0cb8f3d78ad05b1c2801f503e33b0e982eaf1f78d81caeb6aaca", false, "404c341b5c7d0107eda79e0de7f67324086ac4fad288236769c0fdfcffd1b8cb"),
        Target(46837, "", 31621528, 382, "1439140000c0000000000020", "ba38ca677d83a154bda997145ba949c3d28f9df66e5cd7e65b53915892693800", false, "bb5c3e7bee2a4dacf962caa1581035c8dd95e211de0224f5966ed2eb5180f8ff"),
        Target(46838, "", 31621910, 131, "4039140000c0000000000020", "d9319ebd8688a196d9f1beba2b5040c3369e99871b36d965739eab1522f75430", false, "2728196c5f7c90cd63307253b7b60861cc13ff14855c830629fe96918c6777aa"),
        Target(59166, "trackSearchOpened", 35062146, 206, "3c811c0000c0000000000020", "3c52d924bfad5f91e3093fd54c06558551038f003756aaea137d4747796c73bf", false, "f59b71a32b99e214faa0151ac16b410fb7ba4a9fb76925b65cc03b8885913299"),
        Target(59167, "trackSearchStarted", 35062352, 324, "68811c0000c0000000000020", "f12a08435e1f46a6f028cd4c536e11f3d163d8a3da8b21745bb6bfffb400d1d9", false, "23c1ec70932935b48ee4f82f21f04e857de7d7eafcf6b1677d8f4b3c5c268001"),
        Target(59168, "trackSearchResultClicked", 35062676, 431, "94811c0000c0000000000020", "5949f2b17f89671f78a2aa17b41add91968118366da0c6411470e2e2b01d8767", false, "42648a6985c64cafe0f0ebb54224c0823bf1a63c53e727a88d0d945f42fcc7b3"),
        Target(59169, "trackSearchResultReturned", 35063107, 415, "c0811c0000c0000000000020", "9344bed2ec5aaabbcaa3a31bbf8d3552faa41cae35640b7fb6c3f9523a5ce638", false, "c88b935c5e4b47d912eb5c2c5ab385c1430fdb59eafe1a0f65921e4feea16d42"),
        Target(59170, "trackSearchEmptyResult", 35063522, 302, "ec811c0000c0000000000020", "c97286fcd98423bfaa885e6e47494f3fa85e4c20d5fb1bbdbc37465f462d9763", false, "f7e4545b4b8973d5b40be19cb21066ffe5257c5f5dd98ed08b2dea2429933fdf"),
        Target(59171, "trackSearchEmptyMessageResult", 35063824, 302, "18821c0000c0000000000020", "aec7bc94f3d07f689e4c6b129d3ec2d9eb7f45de1154822d63d9248b9211e732", false, "4a4a18bf17d75aba392a3a82ae7765d7918bb4db1a1fdb38085246553291f10e"),
        Target(59172, "trackSearchClosed", 35064126, 44, "44821c0000c0000000000020", "764f25f28e37e1885331960e38847c6292689e1a2b31faefae36fd9a60b24b5b", false, "931954417668e08149de35b01639556477a8e012f3aa23ccbe5effad4151e094"),
        Target(59173, "trackSearchIndexing", 35064170, 181, "70821c0000c0000000000020", "b8a547e9a8e2280329421f9b00516b4195c2981306c64d03c89271f3e5d2651f", false, "e605dbd3ff9d0426445b03afa2a39d3fc78f851b5821b98121090c947f5e1dd3"),
        Target(59174, "trackSearchHistoryClicked", 35064351, 194, "9c821c0000c0000000000020", "2e81756e6821fab4869e1e582ae67e396afb0bbb6a1bc22c648600860e9bbe3a", false, "54f09eacaa504375ae54fff9e20a1eeb3ffe487c2b9db911ff18fabd156f86ef"),
        Target(59175, "trackSuggestedSearchClicked", 35064545, 176, "c8821c0000c0000000000020", "db0f9a4ad0784b6cbc49bb75f982a6e7814677d3fc2c79ed62d4c9b0e5f82456", false, "aa4a8e1312b0832a9fd5524241cda00833b4c3324960e0d62ce5303a09671c11"),
        Target(59176, "trackSearchFilterAdd", 35064721, 298, "f4821c0000c0000000000020", "71d2cd6a13afcccd4dac056ff2efb3fa7a2d3f42e1549e24f2f9ff4509962514", false, "622bc5ca7ae24b8a23cbebffc3b29eb81eb45d2de0699cb1d7a384180b7f6b18"),
        Target(59177, "trackSearchFilterRemove", 35065019, 299, "20831c0000c0000000000020", "b56373b0cf571052653e71e762ea138949e2deb2c9a86bf6b63c3b257ee8417f", false, "37f565c1e9843219d36ab8acdbe3c56e015da428c726c466363ca35197d0657a"),
        Target(59178, "trackSearchTabSelected", 35065318, 161, "4c831c0000c0000000000020", "f7ca4439b3a9f4fbb6af6cc7b9dcb43449325370f5570abe8571a020055c9d63", false, "6838078729a3a448f3ec9efc11d5e5aa6929ab5bb851d9229691bdc9fa3a28a5"),
        Target(63488, "logReadyPayloadReceived", 36620887, 509, "386f1f0000c0000000000020", "61e50d7a7e563496405d5083bc4abe3af09b5cb9cb841a3c1e672116e82b809b", false, "5e53f1967801afc1ba168503b60fde15651dfe62290460a9b549c14b1adc461d"),
        Target(63490, "getReadyPayloadByteSizeAnalytics", 36621497, 892, "a06f1f0000c0000000000020", "7e6583e8fb3fec4aa2749b8099a0993ad3bff61dcb347d0f1fd0feb6326ba0c2", false, "d62bbc150f156ff818e9ce766cd06619e8ba6f7c5a609b43f0b8a214566cea26"),
        Target(63491, "logGatewayConnected", 36622389, 184, "cc6f1f0000c0000000000020", "3c49065fb89ac1811a5839a143f6c29d2a25c5a8578730c657a54ffad94abc6e", false, "458a1a9b575da21f7129b370f7d9eb2616730204a979774085e09cc15e3b0127"),
        Target(63493, "logResumeAnalytics", 36622640, 323, "24701f0000c0000000000020", "810da55ee2c82f1b6bbc51a5f330e8a68808deb594d1d4f75955f5aa749e2152", false, "7d650b9aecad1a0577fadde85cc3d7044f0957b617a27d131cf63bec3fd53a8e"),
        Target(74671, "componentDidMount", 40430638, 417, "98f8260000c0000000000020", "c393f5de3c9286406966b0083833d08709b159c2847f9a8f0629a39e3ea0826f", false, "fcfac5139a3f25a860341702197fa0a690c95d43558e40e96699eaaf158d4894"),
        Target(74672, "componentDidUpdate", 40431055, 1519, "c4f8260000c0000000000020", "07683350cd3fcd9368a65ce2c16c24ba71c8481d3fe7a499f58c692c6d492f4a", false, "04faea3a7fde7644269b746e109a770d3fc39cf1cf12ba12ab8a2a5ee6692cf8"),
        Target(74674, "_trackWithMetadata", 40432624, 163, "1cf9260000c0000000000020", "9f6f9553d21ef3b229050339b5aec65be85fbb73e8c74001ca3c3fa3e87870f6", false, "5cdea783cd0da6e3a339c70809002f61571bc05e2a582b7995fc4eb2850b52d3"),
        Target(76582, "_initialize", 41279267, 103, "c841280000c0000000000020", "7bec14ae78a2684d5bc5538e3c840942144c96052443274ad8069b4bdfa8aeeb", false, "6f7c3488e8321b5c07adb34e0625b14d5a40e8abd96976883325237d8f5cb13f"),
        Target(76584, "_trackStartSpeaking", 41279425, 238, "2042280000c0000000000020", "53d8336b962166df736cb0b963e739d47659fd1917bdee07835b6eda05f5da2b", false, "de63fb8718b118c6f23e25a334c6ab5405c6a92d7f6db8506c3ba0d645cad49c"),
        Target(76585, "_trackStartListening", 41279663, 237, "4c42280000c0000000000020", "16da2d13d856a870044c51930937ac09709907e64878e8a1adc9b068fcd76801", false, "8756523c46ab32d1e956a666a3d6f507adf7dd0a0da76b213383c3862fb18cea"),
    )
    val telemetry = listOf(
        Target(19593, "shouldCollectMetrics", 27748438, 86, "40e7010000c0000000000020", "459f168035d1e23d3855acfb74e6c29853452e00b09a6b8e4b2df77bc07abee5", false, "3be2051df9658ef026e58cf783164590526e7ccb847ad6cb18ef620ca80471af"),
        Target(78572, "installWebsocketTelemetryHook", 41954992, 183, "e098290000c0000000000020", "3f1cdb8080c8b0259347e412d215b4e537eef1d2ae9d4c8b5d00b7e776224ba7", false, "c582d19a8321db3cde4ee2bf4bd7a6f8479215bc68755586bebfa23d7d2966d4"),
        Target(25121, "append", 28547339, 88, "60ac050000c0000000000020", "f7fe93698371e95e5cc721b4c480113b2337672e7d6f7405d52e268525989190", false, "4175511b62b31f1d2839b05202ec7bb4201a8aefd0ba086dbf41b9d09e98762a"),
        Target(25124, "append", 28547489, 52, "e4ac050000c0000000000020", "9a62a2e29a189159da35896e07cafa5f3f0147e3b06806ab93b09b1484b0c041", false, "c378c90a6b5e84242dec790c77048ead0c1fd52011e5a1eedc6120dcb3723d8a"),
        // Module 2's fileFinishedImporting adds the module's path string to a Set on every single module import
        // (~10,330 calls) solely so TTITracker can count imports for analytics.
        Target(17816, "fileFinishedImporting", 27487873, 24, "04b4000000c0000000000020", "dafddb86c3b8c6cae923208bbff8617bc7b3a213333e42fd609fe61262b8b87c", false, "330cf3a6278c966e6db7ea6fd991fb4e542e0bd8a1e38327e6db061124cc8bde"),
        // AppStartPerformance.isTracing gates mark(), markAt() and addDetail() startup log arrays during the first 15s.
        Target(17898, "isTracing", 27501589, 79, "c8c1000000c0000000000020", "c7e36c7e219e08096ef9c7b56a61f7094fcb1bdf60e666e011529d5770b2c49f", false, "38f9f3e0180fa74c4023983bc0f6a92a7781589ded5e98465f73d75f72444038"),
        // Metro prelude's __timingFunction runs Date.now() twice on every top-level module require (~10,330 calls).
        Target(17776, "", 27485752, 19, "3cad000000c0000000000020", "657e48193e5ccd34aa17f779e76216ecc1ac7ccd883d1a5f743ab17633656c37", false, "292e6c2a31dd539e0df4f6c195706603c5322e487e7894e4f38209b5fd725f43"),
        Target(23031, "_initialize", 28208595, 183, "6445040000c0000000000020", "95822c7809b07fe5d3bb6d079f7aa4e1b600d1e11dab527ec587c291fb595621", false, "cf5cd2612e12bad505b5ce6022fd2da6e8dd42c681935195083e976c9f58ac07"),
        Target(25099, "shouldRun", 28546258, 34, "aca8050000c0000000000020", "24732e9dab137c6581c2e25bb11294c58b665b16040e29bf43f7a7ed9df037ba", false, "f39d0d095334699ed4a25da8ff050edb2e36e76a655f19323022de9b88cd196e"),
        Target(25104, "isZoomedExperimentEnabled", 28546377, 35, "7ca9050000c0000000000020", "70faa3e71d24cb882b219f5b5fa5514b9e3d8ee479a6afb458a1a026a5217381", false, "9b179727655c9224441ed4166075f87b2140bff28b645f64ab596a162923a277"),
        Target(25110, "start", 28546638, 102, "7caa050000c0000000000020", "7ed968707b57017860a58d2c30dba5c8b453f0dd18517c344eb0b02e60894df3", false, "ec542647a8797402a795fdf6742a56c0a7addfaf17217a03d1fc2bccf51aab6e"),
        Target(25116, "_kick", 28547035, 119, "84ab050000c0000000000020", "750d222647f045be032e0d64bdf55f683f6e3e9a4da7f9ca5cbbdf63205d9d51", true, "5f8e90fe5e81c48bd18c19de874da2379eb5b3b28f3d7cab882c446c9bb8128a"),
        Target(40822, "trackAppUIViewed2", 30537849, 43, "1830100000c0000000000020", "5a4d0c8114a669f761bf6ae9e8c83da672f6cef7f0db657dcecabcbfc5973ef8", false, "53ebfb443c1fcb6a41645618b4efa71dc6b81b6e945dcbfdb8440ce9189a21e7"),
        Target(40827, "trackAppOpened", 30538136, 188, "0031100000c0000000000020", "7f5dc04afca0bb55ec4395e060b594412f2d9f6b79f026063f971b25df153a09", false, "7faab555c7a78bc21f26deba801b27a660ecec02c6d2b57a41c17be67852ea39"),
        Target(40828, "trackAppUIViewed", 30538324, 106, "2c31100000c0000000000020", "9b814e64ca326fefe4cd380805f9422b8c4a4eaadcd52840497da7557fa9d2e7", false, "8260608648a688adaa2a53153dc0cb5c80e1166aea5bf9aa2b6a5d8acae12f85"),
        Target(40830, "trackAppLaunchCompleted", 30538430, 120, "8031100000c0000000000020", "1473d1494da424d5556f92ff5019bb2e9e5cf55a042649e79b88e6fed8b3726c", false, "25045e178bd29d4923a22e0bfcbe23886c39f913a3ab2a41120e95b3594eeb5b"),
        Target(40970, "timeRequire", 30549840, 274, "8c4a100000c0000000000020", "1154ce4b7a942f9c6a46124348ad8aec5a3cd7683c44f2bdbe1a294c898205e7", false, "fad2bdaf40a68665ffe46fa9f4dd1c6d027a96aa80959a935a470880909d9fad"),
        Target(42536, "ttiRecorded", 30719630, 51, "245a110000c0000000000020", "05e50678e1d636e0ffee1700dbbe6ef9b3563459abc8fda37fc2917247931d2b", false, "02254f04b022b152881aa84d30c09e90f10e0351e59e04d96aa9a462f5e421ba"),
        Target(42538, "trackAndroidArtProfileSnapshot", 30719742, 44, "7c5a110000c0000000000020", "02f2be841140f751299019b8c3852c137690966b653d0ee9983e2281012b6bbc", false, "717d355e94a401bbb53c95ab441702aa3095098be7b68fc543bc8cdee88631e0"),
        Target(66635, "_initialize", 37338741, 30, "f48f210000c0000000000020", "38e317bbf6d5c5e48d219dc32a281fcbca0ce8b2733738e9306103c54fe223fa", false, "0cfee4d74c2316bb05e777755d4104a1e73aac0ba2a1eafce77c9ecc7dbf0515"),
        Target(71400, "isJankScreenReportingEnabled", 38915423, 62, "44c3240000c0000000000020", "4903714c1808148e639c6c086c12d011ab49587fef24a00ce75d8e375a3e12df", false, "aa5fdb8a61b3e0c6f222e930567ed0ca17a3091a291abf38d9075642b4517d1e"),
        Target(73327, "isNavigationTTIEnabled", 39747430, 30, "540f260000c0000000000020", "c1d1644b154059ed1c73b0e3f9c3f4221442aa9ddc441b66d29e90a5c708f7ed", false, "761def2df8e3060c52ec81b42b623762b06dd3508fffbffdf52f8342c96fd9d9"),
        Target(73356, "beginNavigation", 39761673, 352, "5014260000c0000000000020", "6ccbbd2386869a5e7af323910164482ff107957daf28172e26cf46f8a21dffab", false, "b327650257d20ebd67ab29330fb6a240ffef7bd0488a294de2363e87e47734fa"),
        Target(73357, "recordComponentSpan", 39762025, 464, "7c14260000c0000000000020", "186ed5489eed60605ef67ba5e5717b1e61ec6c466ca54cf6623f65ca8be03afd", false, "163cfc76842493e7c5c8d07f9fbcb489e4452ef68bc37f8b515dbbb6bb4722a8"),
        Target(73358, "recordLateComponentLayout", 39762489, 246, "a814260000c0000000000020", "be847b8fe5f69abad19c1ae55503ccdbe27e871ab3077be1d29a1b6ef693ee6e", false, "468bfdbbe28d09a7e557ac1ac8bad57e41f4916b5c64012bce59b4f7b9ba7a5c"),
        Target(73362, "flush", 39763077, 330, "5815260000c0000000000020", "b295bffa043c2d6adfaf35ccef1d0a682ea48a879fac4b7da432227e8a6d77d4", false, "34ffe4262c18fa3e2117883426cf4e9fab22a5d01c17ed5731244016fd13e5d6"),
        Target(76375, "trackHttpRequest", 41252892, 220, "2c1e280000c0000000000020", "96c92f670474836b2e4c41d959d2eb1f610bb51682f1316ea1afae2065e79e0c", false, "d38ddd0dcf9f9ff9b3035692685bcde843cc97be689376619f29d28550cb2b88"),
        Target(76815, "_initialize", 41329056, 71, "f869280000c0000000000020", "7931db0b79db9e56fb9b38e8ef8ccf8eadf804faeec318c9fc2d448475a14ff1", false, "d91fca573d6e578812c02878a9c38b5b3ceded41fcecffc2bea4477a1864e5be"),
        Target(76818, "deliverPendingSessions", 41329241, 122, "7c6a280000c0000000000020", "e4cf3c0e0fd2dedbea37e29f639d93c5c0ec7ec764f287d8775f8a06e3d9ed65", false, "ac2b6c9d841caf7f9dcb559756c031bbbe2c6e76020536f85b9e8325830a7eac"),
        Target(76820, "attach", 41329383, 120, "d46a280000c0000000000020", "f41290497dccbbe7194aa7e24673495e5e9ce3374a50f5430f0aa2dc0b7112a2", false, "f55b4c15741504857d80331b1df4e6e98cfbc36f4f80cdb9baa66731a6233b65"),
        Target(76821, "handleDispatch", 41329503, 124, "006b280000c0000000000020", "45b7760fea2e0ddce2c11f8c8dde4692d79712e5a23582459df64322c1a80049", false, "90e3e5ec65b43dff99e393ed1d72cc941b0ebc0e93778b40864696c9267d37f9"),
        Target(76822, "handleStateSettled", 41329627, 160, "2c6b280000c0000000000020", "ee6d8db5ba77187ded9c8fd220b55a2375e12640bd021131af4e5daa67c7b975", false, "acab425261727f58aa4554c4ede228ced6ed5911e08ba0de21bec1274a8c7541"),
        Target(76825, "handleAppStateUpdate", 41330016, 119, "b06b280000c0000000000020", "29df8b087d29c650e768f489f9badfaefe1d718a87a6313dd355f469f9ea2fb9", false, "a3268f54350d3d194f25e2e8d4a20d337962ca70d22c9a72d23864df15491543"),
        Target(76826, "handleConnectionOpenSupplemental", 41330135, 37, "dc6b280000c0000000000020", "4e3647be300888a51c19e52803fb4e9d5c7563ddcae837e7ee7a7bba843d8f2a", false, "201bbbfd707c348aa10d241ba66747d8d961eb24e76d12b0869580f71d99ed14"),
        Target(76827, "scheduleReport", 41330172, 69, "086c280000c0000000000020", "43fa97d412709000413a68268ef2e6c359ea3554b89a343310d61350dd942820", false, "f6a5ae3e774bf2fac95f0d06a7d7ffbec43df567bc5786cb243c40697ce02e9a"),
        Target(76828, "sendReport", 41330241, 232, "346c280000c0000000000020", "a2730968de406eb34af03a760312e8cef1fbad69b5efa9d3bf7c4ed0d6d18bc5", false, "8def504a597ae9183b3e33985ca5e2ded56a919cd7214e109757fb61c2031f1c"),
        Target(78481, "handleChannelSelect", 41919903, 322, "7488290000c0000000000020", "6d9dc207b0d422d69fbf72c464ecd0a693503cfab5d946d627a95b6e4bc36e6d", false, "93c2c3e991864f0af78bdc80516cfe6b2a7b844785274a9c876a0e0658b2da34"),
        Target(78612, "flushDelayLogs", 41961365, 168, "fc9f290000c0000000000020", "c20ea9eabcfaceff7bbb1f19bf5afc4a76b380b87b019acd6d974882efde3d58", false, "e0149ef1cb957c7be1333d034de7ec78ce709e9954b6d00dd5c52eed68090312"),
        Target(78613, "onTimersDelayCallback", 41961533, 251, "28a0290000c0000000000020", "61fe39210f2f5f3611908b37179b3c003649d1e17ff3c7c673c9defea5fdf8bb", false, "d290890f8f5b8ad6ff919be280617a923dad40d2ce9d06d97265f5a4a8147296"),
        Target(78614, "setupLibdiscoreTimersMonitor", 41961784, 39, "54a0290000c0000000000020", "113bf66c8581a6e55df05f71193c7f6533ddc98ebce7afbbb077c3bb4e1f899a", false, "041acb6527b7249fefd603769a14910e447bfaccbd366f900b67be53f8787b5b"),
    )
    val crash = listOf(
        Target(80849, "send", 42230438, 180, "cc142b0000c0000000000020", "e0850de5dce10088b3cd01f78249a8cd0314ec9c63c23b9b6364353f174ccbdc", true, "0caaa867dd1ae4d866279411f921afe4db5ac6d79cdd88f1017bb2539f0d60f8"),
        Target(111344, "send", 44533008, 181, "240c3f0000c0000000000020", "26eee6da7104655803cc039e945019112f253f50a30978fa591cc4c531ac0cd9", true, "bd3e709dc7aaecc9e1775437b3f223881a553a0a2d132ea433504eb1c776c18f"),
        // The whole Sentry JS SDK setup at launch (integrations, scopes, transport, tags, crash report read).
        // Native Sentry is already off and every send is stubbed, so this was startup work for nothing.
        Target(23028, "initSentry", 28208330, 43, "e044040000c0000000000020", "c7436ac48ad7fe13964ac5c66ae5eca969616da809c3434377cb86913c0cfa4d", false, "0e41bcc3150bb9e12b0d7aa746fb78882d272f82b2f79247be16cd1ced9c0b04"),
        Target(20069, "addSentryBreadcrumb", 27787418, 97, "1041020000c0000000000020", "33e1f8af060dc8be033623bae3e09093ce8f773e597dbfd4cc1da06d85331804", false, "3e30d099d0600352947f04c60a98b6884cf6a6cbf18e018681f19faca184fbb5"),
        Target(23009, "setUser", 28204999, 104, "8c41040000c0000000000020", "35a25125f3b563358909f5e6f42cfe04ad5b4f39797e6f1a4d0f71f71bffa912", false, "5bd795c6101467d67ea7abe6cbd7a168f33ce885e88eaca35bbe3313233895bc"),
        Target(23010, "clearUser", 28205103, 78, "b841040000c0000000000020", "e680f73c7805955e2221ddaba2b39eb6d449f5092ad689622ef907d4e42469e1", false, "c93c83a143161d5581748f9db80f2ca56c0e850720d7fdc338e999d0fcc92a0a"),
        Target(23011, "setTags", 28205181, 48, "e441040000c0000000000020", "e4d1d9801af20772b48d5c1e3d793bbf6206a5417c0daef911be8e3080fb8154", false, "3e9975a011701c935a455819331d7f732dbaf720e7bfdba991293f1743981b22"),
        Target(23012, "setExtra", 28205229, 48, "1042040000c0000000000020", "3d3e3552529406f9bd0aba8d2ded75085968b587bdd22a1e5b932f650b351b1b", false, "b0240904555f1c65dc2ff04fe261e7ecd43ad9aaf78832f535c96862a5a4db4f"),
        Target(23013, "captureException", 28205277, 87, "3c42040000c0000000000020", "66d10f8e3ee62184186df000634eac40c21b050778e2a422b12db5f70e46ec39", false, "4553f06b9d0676a1a72a0a0790c6cfb2187c696326bf6c35ea10895c3ef631b9"),
        Target(23014, "captureCrash", 28205364, 162, "6842040000c0000000000020", "d66ef72415697383737ebe781abb74c1a834e143643d58c0ef6f28e39c5e2b4e", false, "5b2c27fbb32e8a0063a4b0345e93537e338418c8f60b186ea6d6fccbc029e8f5"),
        Target(23015, "captureMessage", 28205526, 90, "9442040000c0000000000020", "4af310c5a21087c4ca4e226165d51676863a34c4de2dd418d733abb34f0340fe", false, "0c7f571ee97eede91117ef840694162de8c61d05c384341bff6861db541cc831"),
        Target(23016, "addFeatureFlag", 28205616, 106, "c042040000c0000000000020", "fadec22f1307a5d77f06f0b7e5525af8ae3dc80f55ec382de643a18d8c345c52", false, "b4a425e0af84610d77222079ffd9955701e001d6f78a4b8600157a422170244d"),
        Target(23017, "addBreadcrumb", 28205722, 54, "ec42040000c0000000000020", "6f5970b99ef95850f2052fc2d2ac609b596a138778726ca38cf23acc8e1a768d", false, "5a45f8492f4058162958768dc84c0f9d4954a1afd7bbfb2a79484290aa6f3f9d"),
        Target(23022, "getLastCrashReport", 28205991, 35, "d843040000c0000000000020", "ae24f9be0e6c0ab9cc84cf439825a8fbca19aeadbf7ff2a9ad01b14295c08c2d", true, "3a09dcbb9e34f885a1f8c961d3c02a7ab92caf13b520fad0ed559239773aee26"),
        Target(23027, "trackCrash", 28207059, 1271, "b444040000c0000000000020", "f6dadd809250c2018543313da3122b2e27ebcf2cb6fb80417b64aa273ba703fd", false, "29647977689b11f57377f9fceedb598540280ba868cbd958e2f8c3185a23d122"),
        Target(78615, "init", 41961823, 23, "80a0290000c0000000000020", "3b648076ec9e42d58eaec2119215f2fd619ab6ebc7ed8fe361cdd327bbbca3dc", false, "72e230448fa779ab792ae2086080ad8dfc9ddbb28c9f705cae5c5ba80cb27801"),
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
            require(streamDigest(file, "SHA-1", length - 20) == read(length - 20, 20).joinToString("") { "%02x".format(it) }) {
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
            val footer = hex(streamDigest(file, "SHA-1", length - 20))
            raf.seek(length - 20)
            raf.write(footer)
        }
    }
}
