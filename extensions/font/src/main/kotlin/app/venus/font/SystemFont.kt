package app.venus.font

import android.content.Context
import android.graphics.Typeface
import android.os.Build
import com.facebook.react.bridge.Promise
import org.json.JSONObject
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.regex.Pattern

/**
 * Force system font: Discord's own fonts (gg sans, Noto Sans, Ginto, gg mono) become the phone's
 * sans-serif or monospace font, keeping each weight and italic. Every Discord text, React Native or
 * native chat, asks ReactFontManager.getTypeface(String, TypefaceStyle, AssetManager) first.
 *
 * Read from the saved Venus setting before Discord draws anything, so every screen is measured and
 * drawn with one font. Only Java/Android APIs: the host's Kotlin helpers are obfuscated.
 */
object SystemFont {
    private const val PREFS = "venus-patches.json"
    private const val MAX_PREFS = 4 * 1024 * 1024
    // First name in a family list such as "ggsans-Bold, NotoSans-Bold". Names a user picks for a
    // display-name style (8Bit, Sakura, ...) never match, so those keep their own font.
    private val discordFamily = Pattern.compile("^\\s*(ggsans|gg sans|NotoSans|ABCGinto[A-Za-z]*|ggmono|SourceCodePro)([^,]*)")
    private val monospace = Pattern.compile("^(ggmono|SourceCodePro)$")
    private val extraBold = Pattern.compile("ExtraBold")
    private val black = Pattern.compile("Black")
    private val semibold = Pattern.compile("Semi[Bb]old")
    private val bold = Pattern.compile("Bold")
    private val medium = Pattern.compile("Medium")
    private val italicName = Pattern.compile("Italic")
    private val skip = Any()
    private val cache = ConcurrentHashMap<String, Any>()

    /** Read by the patched font lookup first, so it costs one field read while the setting is off. */
    @JvmField
    @Volatile
    var enabled = false
    @Volatile
    private var appContext: Context? = null

    /** Reads the saved setting once, before any text is drawn. Any problem leaves Discord's fonts alone. */
    @JvmStatic
    fun init(context: Context?) {
        appContext = context?.applicationContext ?: context
        enabled = try {
            val file = File(context!!.filesDir, PREFS)
            if (Build.VERSION.SDK_INT < 28 || !file.isFile || file.length() > MAX_PREFS) false
            else JSONObject(String(java.nio.file.Files.readAllBytes(file.toPath()), java.nio.charset.StandardCharsets.UTF_8))
                .optBoolean("systemFont", false)
        } catch (_: Throwable) { false }
    }

    private const val PREFIX = "venus-font-v1:"

    /**
     * Reopens Discord so a changed font setting applies everywhere at once. Text in React Native is
     * measured once but re-reads its font on every draw, so switching fonts mid-session would draw the
     * new font in space measured for the old one. Called through FileModule.fileExists'
     * Promise after the setting is written; ordinary fileExists calls fall through. (Not getSize: voice
     * messages already guard that method, and two guards in one method broke Discord's startup.)
     */
    @JvmStatic
    fun dispatch(request: String, promise: Promise): Boolean {
        if (request.length < PREFIX.length || request.substring(0, PREFIX.length) != PREFIX) return false
        if (request.substring(PREFIX.length) != "restart") { promise.reject("VENUS_FONT", "Unknown font request"); return true }
        val context = appContext
        val launch = context?.packageManager?.getLaunchIntentForPackage(context.packageName)?.component
        if (context == null || launch == null) { promise.reject("VENUS_FONT", "Discord's start screen is unavailable"); return true }
        promise.resolve("restarting")
        // After the reply reaches JS: start a fresh task, then end this process so the old one can't linger.
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            try {
                context.startActivity(android.content.Intent.makeRestartActivityTask(launch))
            } catch (_: Throwable) { }
            Runtime.getRuntime().exit(0)
        }, 250)
        return true
    }

    /** The system typeface for one of Discord's families, or null to let Discord load its own. */
    @JvmStatic
    fun typeface(family: String?, nearestStyle: Int): Typeface? {
        if (!enabled || family == null || nearestStyle < 0 || nearestStyle > 3) return null
        // One small array per family name, so a lookup allocates nothing once it has been seen.
        @Suppress("UNCHECKED_CAST")
        var slots = cache[family] as Array<Any?>?
        if (slots == null) {
            val made = arrayOfNulls<Any>(4)
            // Bounded by Discord's own family names; a full cache just stops remembering.
            // Two threads can see the same new family: both use the array that went in first.
            @Suppress("UNCHECKED_CAST")
            slots = (if (cache.size < 256) cache.putIfAbsent(family, made) as Array<Any?>? else null) ?: made
        }
        val cached = slots[nearestStyle]
        if (cached != null) return if (cached === skip) null else cached as Typeface
        val made = make(family, nearestStyle)
        slots[nearestStyle] = made ?: skip
        return made
    }

    private fun make(family: String, nearestStyle: Int): Typeface? {
        val match = discordFamily.matcher(family)
        if (!match.lookingAt()) return null
        val suffix = match.group(2) ?: ""
        var weight = when {
            extraBold.matcher(suffix).find() -> 800
            black.matcher(suffix).find() -> 900
            semibold.matcher(suffix).find() -> 600
            bold.matcher(suffix).find() -> 700
            medium.matcher(suffix).find() -> 500
            else -> 400
        }
        val family0 = match.group(1) ?: ""
        // Discord names the weight in the family; a bold/italic style on top of it still applies.
        // ReactFontManager's nearest style: 1 bold, 2 italic, 3 bold italic.
        if ((nearestStyle and 1) != 0 && weight < 700) weight = 700
        val italic = italicName.matcher(suffix).find() || (nearestStyle and 2) != 0
        val base = if (monospace.matcher(family0).matches()) Typeface.MONOSPACE else Typeface.SANS_SERIF
        if (Build.VERSION.SDK_INT < 28) return null
        var made: Typeface = Typeface.create(base, weight, italic)
        // Discord's chat font loader throws "Cannot find typeface" for anything equal to Typeface.DEFAULT,
        // and on many phones plain sans-serif is exactly that. One weight unit more is the same font
        // when drawn, but its own typeface, so the loader accepts it.
        if (made == Typeface.DEFAULT) made = Typeface.create(base, weight + 1, italic)
        return if (made == Typeface.DEFAULT) null else made
    }
}
