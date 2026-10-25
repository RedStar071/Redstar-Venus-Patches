package app.venus.monet

import android.content.Context
import android.os.Build
import com.facebook.react.bridge.Promise

/**
 * Material You colors: hands Venus the phone's wallpaper palettes (Android 12+ system_accent1..3 and
 * system_neutral1..2, 13 shades each) as JSON. Venus builds Discord's colors from them in JavaScript; this only reads.
 *
 * Reached through FileModule.getFileHash's Promise with a private URI prefix: Discord never calls getFileHash, and a
 * TurboModule can't gain new methods. Anything else falls through to Discord's own code. Only Java/Android APIs: the
 * host's Kotlin helpers are obfuscated.
 */
object SystemColors {
    private const val PREFIX = "venus-monet-v1:"
    private val palettes = arrayOf("accent1", "accent2", "accent3", "neutral1", "neutral2")
    private val shades = intArrayOf(0, 10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000)

    @JvmStatic
    fun dispatch(request: String, context: Context?, promise: Promise): Boolean {
        if (request.length < PREFIX.length || request.substring(0, PREFIX.length) != PREFIX) return false
        if (request.substring(PREFIX.length) != "colors") { promise.reject("VENUS_MONET", "Unknown request"); return true }
        try { promise.resolve(read(context)) } catch (_: Throwable) { promise.resolve("") }
        return true
    }

    /** The palettes as {"accent1":["#rrggbb", ...13], ...}, or "" before Android 12. */
    private fun read(context: Context?): String {
        if (Build.VERSION.SDK_INT < 31 || context == null) return ""
        val res = context.resources
        val out = StringBuilder(1024).append('{')
        for (p in palettes.indices) {
            if (p > 0) out.append(',')
            out.append('"').append(palettes[p]).append("\":[")
            for (s in shades.indices) {
                val id = res.getIdentifier("system_" + palettes[p] + "_" + shades[s], "color", "android")
                if (id == 0) return ""
                val color = res.getColor(id, null) and 0xffffff
                if (s > 0) out.append(',')
                out.append("\"#").append(String.format("%06x", color)).append('"')
            }
            out.append(']')
        }
        return out.append('}').toString()
    }
}
