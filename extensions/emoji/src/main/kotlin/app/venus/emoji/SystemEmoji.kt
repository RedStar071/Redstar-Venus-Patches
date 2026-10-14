package app.venus.emoji

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import com.facebook.react.bridge.Promise
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.ConcurrentHashMap

/**
 * Force system emojis: Discord's native chat, reactions and emoji picker get every Unicode emoji's
 * picture from Surrogates.toAssetUrl, which points at Discord's bundled Twemoji PNGs. While this is
 * on, the emoji is drawn once with the phone's own emoji font into a small PNG in Discord's cache,
 * and that file is used instead, so sizes, spoilers and taps keep working as before.
 *
 * Read from the saved Venus setting once at launch, so one session never mixes the two styles.
 * Only Java/Android APIs: the host's Kotlin helpers are obfuscated.
 */
object SystemEmoji {
    private const val PREFS = "venus-patches.json"
    private const val MAX_PREFS = 4 * 1024 * 1024
    private const val SIZE = 128
    private const val PREFIX = "venus-emoji-v1:"
    // Changed whenever the drawing changes, so files drawn by an older release are never reused. Inside it, one
    // folder per emoji font (see fontStamp), so a font update draws every emoji again.
    private const val FOLDER = "venus-emoji-v1"
    private val urls = ConcurrentHashMap<String, String>()
    private val unsupported = ConcurrentHashMap<String, Boolean>()

    /** Read by the patched lookup first, so it costs one field read while the setting is off. */
    @JvmField
    @Volatile
    var enabled = false
    @Volatile
    private var directory: File? = null
    @Volatile
    private var appContext: Context? = null

    /** Reads the saved setting once, before any emoji is drawn. Any problem leaves Discord's emojis alone. */
    @JvmStatic
    fun init(context: Context?) {
        appContext = context?.applicationContext ?: context
        enabled = try {
            val file = File(context!!.filesDir, PREFS)
            // Starts off, like every Venus setting: no saved settings yet, or none for this switch, means off.
            val on = file.isFile && file.length() <= MAX_PREFS &&
                savedOn(file)
            if (!on) false else {
                // One folder per emoji font: after a system or emoji font update the old drawings were shown forever.
                // Folders for an older font are removed, so the cache never holds two sets.
                val root = File(context.cacheDir, FOLDER)
                val folder = File(root, fontStamp())
                if (folder.isDirectory || folder.mkdirs()) {
                    directory = folder
                    // Off the launch path: there can be thousands of old drawings.
                    val cleanup = Thread({
                        try {
                            val old = root.listFiles()
                            // Releases up to 1.7.0 drew straight into this folder: those loose files go too.
                            if (old != null) for (stale in old) if (stale.name != folder.name) { if (stale.isDirectory) removeFolder(stale) else stale.delete() }
                        } catch (_: Throwable) { }
                    }, "Venus-Emoji-Cleanup")
                    cleanup.isDaemon = true
                    cleanup.priority = Thread.MIN_PRIORITY
                    cleanup.start()
                    true
                } else false
            }
        } catch (_: Throwable) { false }
    }

    /** The phone's emoji font, by file size and date, plus the Android build. Changes whenever either is updated. */
    private fun fontStamp(): String {
        var stamp = android.os.Build.FINGERPRINT.hashCode().toLong()
        for (path in EMOJI_FONTS) {
            val file = File(path)
            if (file.exists()) stamp = stamp * 31 + (if (file.isFile) file.length() * 17 else 0L) + file.lastModified()
        }
        return "f" + java.lang.Long.toHexString(stamp)
    }
    private val EMOJI_FONTS = arrayOf("/system/fonts/NotoColorEmoji.ttf", "/system/fonts/NotoColorEmojiFlags.ttf",
        "/system/fonts/SamsungColorEmoji.ttf", "/data/fonts/files")

    private fun removeFolder(folder: File) {
        val files = folder.listFiles()
        if (files != null) for (file in files) file.delete()
        folder.delete()
    }

    /**
     * Reopens Discord so a changed emoji setting applies everywhere at once. Called through
     * FileModule.getVideoDimensions' Promise: Discord for Android never uses that method (it only
     * answers "only supported on iOS"), so no other Venus guard shares it.
     */
    @JvmStatic
    fun dispatch(request: String, promise: Promise) {
        if (request != PREFIX + "restart") { promise.reject("VENUS_EMOJI", "Unknown emoji request"); return }
        val context = appContext
        val launch = context?.packageManager?.getLaunchIntentForPackage(context.packageName)?.component
        if (context == null || launch == null) { promise.reject("VENUS_EMOJI", "Discord's start screen is unavailable"); return }
        promise.resolve("restarting")
        // After the reply reaches JS: start a fresh task, then end this process so the old one can't linger.
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            try {
                context.startActivity(android.content.Intent.makeRestartActivityTask(launch))
            } catch (_: Throwable) { }
            Runtime.getRuntime().exit(0)
        }, 250)
    }

    /** A file URL for the phone's drawing of this emoji, or null to let Discord use its own picture. */
    @JvmStatic
    fun url(surrogates: String?): String? {
        if (!enabled || surrogates == null || surrogates.length == 0 || surrogates.length > 64) return null
        val known = urls.get(surrogates)
        if (known != null) return known
        if (unsupported.containsKey(surrogates)) return null
        val made = try { draw(surrogates) } catch (_: Throwable) { null }
        // Both maps are bounded by the number of emojis; a full map only stops remembering.
        if (made == null) {
            if (unsupported.size < 4096) unsupported.put(surrogates, true)
        } else if (urls.size < 8192) urls.put(surrogates, made)
        return made
    }

    private fun fileName(surrogates: String): String {
        val out = StringBuilder()
        var i = 0
        while (i < surrogates.length) {
            val point = Character.codePointAt(surrogates, i)
            if (out.length > 0) out.append('-')
            out.append(Integer.toHexString(point))
            i += Character.charCount(point)
        }
        return out.append(".png").toString()
    }

    private fun draw(surrogates: String): String? {
        val folder = directory ?: return null
        val file = File(folder, fileName(surrogates))
        if (file.isFile && file.length() > 0) return "file://" + file.absolutePath
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        paint.typeface = Typeface.DEFAULT
        paint.textSize = SIZE * 0.8f
        paint.textAlign = Paint.Align.CENTER
        // An emoji newer than the phone's font keeps Discord's picture, not an empty box.
        if (!paint.hasGlyph(surrogates)) return null
        val width = paint.measureText(surrogates)
        if (width > SIZE) paint.textSize = paint.textSize * SIZE / width
        val metrics = paint.fontMetrics
        val bitmap = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888)
        try {
            Canvas(bitmap).drawText(surrogates, SIZE / 2f, SIZE / 2f - (metrics.ascent + metrics.descent) / 2f, paint)
            // Written beside the final name and then renamed, so a half-written file is never shown.
            val temporary = File(folder, file.name + "." + Thread.currentThread().id + ".tmp")
            try {
                val out = FileOutputStream(temporary)
                try { if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)) return null } finally { out.close() }
                if (!temporary.renameTo(file) && !file.isFile) return null
            } finally {
                temporary.delete()
            }
        } finally {
            bitmap.recycle()
        }
        return "file://" + file.absolutePath
    }

    /**
     * Whether the saved settings turn this on. Runs on Discord's main thread before the first screen:
     * Venus writes them with JSON.stringify, so a file without `"systemEmoji":true` (the switch off, the
     * common case) needs no JSON parsing. Anything else is parsed exactly as before.
     */
    private fun savedOn(file: File): Boolean {
        val text = String(java.nio.file.Files.readAllBytes(file.toPath()), java.nio.charset.StandardCharsets.UTF_8)
        // java.lang.String.indexOf: the host has no usable Kotlin text helpers.
        val raw = text as java.lang.String
        if (raw.indexOf("\"systemEmoji\":true") < 0 && raw.indexOf("\"systemEmoji\":\"") < 0) return false
        return JSONObject(text).optBoolean("systemEmoji", false)
    }
}
