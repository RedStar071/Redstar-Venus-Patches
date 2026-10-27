package app.venus.chat

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import android.widget.ImageView
import android.widget.LinearLayout
import com.facebook.react.bridge.Promise
import org.json.JSONArray
import org.json.JSONObject
import java.lang.reflect.Constructor
import java.lang.reflect.Field
import java.lang.reflect.Method
import java.util.WeakHashMap
import java.util.concurrent.locks.ReentrantLock

/**
 * Who reacted (#100), native side: up to three small avatars of people who reacted, inside each reaction pill in chat.
 * Based on Who Reacted by Palm (revenge-community-plugins, GPL-3.0), reworked for Venus.
 *
 * Discord draws chat in native Android views, so the pills are ReactionViews inside a ShortcutsFlexbox. After Discord
 * binds a message's reactions ([bound], called right after ReactionsViewHolder.bind in MessageAccessoriesAdapter), each
 * pill gets the avatars JS has for "messageId:emojiId-or-name:burst". JS asks Discord's API who reacted, a few at a time
 * and only for pills on screen ([shownKeys]), then sends the avatar links here ([put]).
 *
 * Reached through FileModule.removeFile's Promise with a private storageDir prefix: Venus never removes files, and a
 * TurboModule can't gain new methods. Only Java/Android APIs and reflection on names Discord keeps (interfaces and
 * public methods of its reactions module): the host's Kotlin helpers are obfuscated.
 */
object WhoReacted {
    private const val PREFIX = "venus-react-v1:"
    private const val MAX_AVATARS = 3
    private const val CACHE = 2000
    private const val DRAWEE = "com.facebook.drawee.view.SimpleDraweeView"
    private const val CHAT_LIST = "com.discord.chat.presentation.list.ChatListView"

    /** Key -> avatar links, oldest dropped first. Written from the bridge thread, read on the main thread. */
    private val avatars = object : java.util.LinkedHashMap<String, Array<String>>(256, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Array<String>>?): Boolean = size > CACHE
    }
    /** Pill -> the reaction it shows right now. Main thread writes, the bridge thread reads for [shownKeys]. */
    private val bound = WeakHashMap<LinearLayout, String>()
    private val stacks = WeakHashMap<LinearLayout, AvatarStack>()
    // Explicit locks: Kotlin's synchronized {} links kotlin.Unit, which Discord's build doesn't keep.
    private val avatarsLock = ReentrantLock()
    private val boundLock = ReentrantLock()
    private val main = Handler(Looper.getMainLooper())
    @Volatile private var on = false

    private var reflected = false
    private var itemView: Field? = null
    private var messageId: Method? = null
    private var reactions: Method? = null
    private var shortcuts: Field? = null
    private var separate: Method? = null
    private var companion: Any? = null
    private var isBurst: Method? = null
    private var count: Method? = null
    private var burstCount: Method? = null
    private var emoji: Method? = null
    private var emojiId: Method? = null
    private var drawee: Constructor<*>? = null

    @JvmStatic
    fun dispatch(request: String, payload: String?, promise: Promise): Boolean {
        if (request.length < PREFIX.length || request.substring(0, PREFIX.length) != PREFIX) return false
        try {
            when (request.substring(PREFIX.length)) {
                "put" -> { put(payload ?: "{}"); promise.resolve("ok") }
                // View state is only read on the main thread.
                "shown" -> main.post(object : Runnable { override fun run() { try { promise.resolve(shownKeys()) } catch (_: Throwable) { promise.resolve("[]") } } })
                "on" -> { on = true; promise.resolve("on") }
                "off" -> { on = false; clear(); promise.resolve("off") }
                else -> promise.reject("VENUS_REACT", "Unknown request")
            }
        } catch (_: Throwable) {
            promise.resolve("")
        }
        return true
    }

    /** Right after Discord bound a message's reaction pills. holder: ReactionsViewHolder, accessory: ReactionsMessageAccessory. */
    @JvmStatic
    fun bound(holder: Any?, accessory: Any?) {
        if (holder == null || accessory == null) return
        try {
            if (!reflected) reflect(holder, accessory)
            val root = itemView?.get(holder) as? ViewGroup ?: return
            val row = (shortcuts?.get(root) as? ViewGroup) ?: root
            if (!on) { hideAll(row); return }
            val id = messageId?.invoke(accessory) as? String ?: return
            val list = reactions?.invoke(accessory) as? List<*> ?: return
            val pills = separate?.invoke(companion, list) as? List<*> ?: list
            var i = 0
            val n = row.childCount
            boundLock.lock()
            try {
                while (i < n) {
                    val view = row.getChildAt(i) as? LinearLayout
                    val pill = if (i < pills.size) pills[i] else null
                    if (view != null) {
                        if (pill == null || view.visibility != View.VISIBLE) { bound.remove(view); render(view, null) }
                        else {
                            val key = keyOf(id, pill)
                            if (key == null) { bound.remove(view); render(view, null) }
                            else { bound[view] = key; render(view, cached(key)) }
                        }
                    }
                    i++
                }
            } finally {
                boundLock.unlock()
            }
        } catch (_: Throwable) { }
    }

    private fun cached(key: String): Array<String>? {
        avatarsLock.lock()
        try { return avatars[key] } finally { avatarsLock.unlock() }
    }

    private fun keyOf(messageId: String, pill: Any): String? {
        val burst = isBurst?.invoke(pill) as? Boolean ?: false
        val n = (if (burst) burstCount else count)?.invoke(pill) as? Int ?: 0
        if (n <= 0) return null
        val e = emoji?.invoke(pill) ?: return null
        val key = emojiId?.invoke(e) as? String ?: return null
        return StringBuilder(messageId.length + key.length + 4).append(messageId).append(':').append(key).append(':').append(if (burst) '1' else '0').toString()
    }

    private fun reflect(holder: Any, accessory: Any) {
        reflected = true
        val loader = holder.javaClass.classLoader
        var type: Class<*>? = holder.javaClass
        while (type != null && itemView == null) {
            try { itemView = type.getDeclaredField("itemView").also { it.isAccessible = true } } catch (_: Throwable) { }
            type = type.superclass
        }
        for (m in accessory.javaClass.methods) {
            if (m.parameterTypes.size != 0) continue
            val name = m.name
            if (name.length >= 12 && name.substring(0, 12) == "getMessageId" && m.returnType == String::class.java) messageId = m
            if (m.name == "getReactions" && List::class.java.isAssignableFrom(m.returnType)) reactions = m
        }
        try {
            val flexbox = Class.forName("com.discord.reactions.ShortcutsFlexbox", false, loader)
            shortcuts = flexbox.getDeclaredField("shortcutsView").also { it.isAccessible = true }
            val companionField = flexbox.getDeclaredField("Companion").also { it.isAccessible = true }
            companion = companionField.get(null)
            separate = companion!!.javaClass.getMethod("separateAndSortDuplicateReactions", List::class.java)
        } catch (_: Throwable) { separate = null; companion = null }
        val reaction = Class.forName("com.discord.reactions.ReactionView\$Reaction", false, loader)
        isBurst = reaction.getMethod("isBurstReaction")
        count = reaction.getMethod("getCount")
        burstCount = reaction.getMethod("getBurstCount")
        emoji = reaction.getMethod("getEmoji")
        emojiId = Class.forName("com.discord.reactions.ReactionView\$Emoji", false, loader).getMethod("getEmojiId")
        try { drawee = Class.forName(DRAWEE, false, loader).getConstructor(Context::class.java) } catch (_: Throwable) { }
    }

    /** {"key":["https://...", ...]} from JS; pills on screen showing those reactions update at once. */
    private fun put(json: String) {
        val obj = JSONObject(json)
        val updates = java.util.HashMap<String, Array<String>>()
        val names = obj.keys()
        while (names.hasNext()) {
            val key = names.next()
            val list = obj.optJSONArray(key) ?: continue
            val n = if (list.length() < MAX_AVATARS) list.length() else MAX_AVATARS
            updates[key] = Array(n) { list.optString(it) }
        }
        avatarsLock.lock()
        try { avatars.putAll(updates) } finally { avatarsLock.unlock() }
        main.post(object : Runnable {
            override fun run() {
                val changed = java.util.ArrayList<View>()
                boundLock.lock()
                try {
                    for (entry in bound.entries) {
                        val urls = updates[entry.value] ?: continue
                        render(entry.key, urls)
                        changed.add(entry.key)
                    }
                } finally {
                    boundLock.unlock()
                }
                relayout(changed)
            }
        })
    }

    /** Keys of the pills on screen, as a JSON array; JS asks about these first. */
    private fun shownKeys(): String {
        val out = JSONArray()
        val seen = java.util.HashSet<String>()
        boundLock.lock()
        try {
            for (entry in bound.entries) if (entry.key.isAttachedToWindow && entry.key.isShown && seen.add(entry.value)) out.put(entry.value)
        } finally {
            boundLock.unlock()
        }
        return out.toString()
    }

    private fun clear() {
        avatarsLock.lock()
        try { avatars.clear() } finally { avatarsLock.unlock() }
        main.post(object : Runnable {
            override fun run() {
                val changed = java.util.ArrayList<View>()
                boundLock.lock()
                try {
                    for (view in bound.keys) { render(view, null); changed.add(view) }
                } finally {
                    boundLock.unlock()
                }
                relayout(changed)
            }
        })
    }

    private fun hideAll(row: ViewGroup) {
        var i = 0
        while (i < row.childCount) {
            val view = row.getChildAt(i) as? LinearLayout
            if (view != null) { val stack = stacks[view]; if (stack != null) stack.visibility = View.GONE }
            i++
        }
    }

    private fun render(view: LinearLayout, urls: Array<String>?) {
        val existing = stacks[view]
        if (urls == null || urls.size == 0 || !on) {
            if (existing != null) existing.visibility = View.GONE
            return
        }
        val maker = drawee ?: return
        var stack = existing
        if (stack == null) {
            stack = AvatarStack(view.context, maker)
            val params = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            params.marginStart = (5 * view.resources.displayMetrics.density).toInt()
            view.addView(stack, params)
            stacks[view] = stack
        }
        stack.visibility = View.VISIBLE
        stack.show(urls)
    }

    /**
     * React Native ignores layout requests from native views inside it, so a pill that grew wouldn't be measured again
     * until Discord's next update. Lay out the chat lists of [views] at their size, the way Discord does after its own changes.
     */
    private fun relayout(views: java.util.ArrayList<View>) {
        val lists = java.util.HashSet<View>()
        for (view in views) {
            var parent = view.parent
            while (parent is View) {
                if (parent.javaClass.name == CHAT_LIST) { lists.add(parent); break }
                parent = parent.parent
            }
        }
        for (list in lists) {
            list.measure(View.MeasureSpec.makeMeasureSpec(list.width, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(list.height, View.MeasureSpec.EXACTLY))
            list.layout(list.left, list.top, list.right, list.bottom)
        }
    }

    /** Overlapping round avatars, each cut out of the one under it, drawn with Discord's own image loader (Fresco). */
    private class AvatarStack(context: Context, private val maker: Constructor<*>) : ViewGroup(context) {
        private val density = context.resources.displayMetrics.density
        private val size = (16 * density).toInt()
        private val step = (11 * density).toInt()
        private val ring = 1.5f * density
        private val clear = Paint(Paint.ANTI_ALIAS_FLAG).apply { xfermode = PorterDuffXfermode(PorterDuff.Mode.CLEAR) }
        private val faces = java.util.ArrayList<ImageView>()

        init {
            isClickable = false
            isFocusable = false
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
            setWillNotDraw(false)
        }

        fun show(urls: Array<String>) {
            while (faces.size > urls.size) removeView(faces.removeAt(faces.size - 1))
            while (faces.size < urls.size) {
                val face = maker.newInstance(context) as ImageView
                face.background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(0x33808080) }
                face.outlineProvider = ViewOutlineProvider.BACKGROUND
                face.clipToOutline = true
                faces.add(face)
                addView(face)
            }
            var i = 0
            while (i < urls.size) {
                val face = faces[i]
                if (face.tag != urls[i]) { face.tag = urls[i]; face.setImageURI(Uri.parse(urls[i])) }
                i++
            }
            requestLayout()
            invalidate()
        }

        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
            val exact = MeasureSpec.makeMeasureSpec(size, MeasureSpec.EXACTLY)
            for (face in faces) face.measure(exact, exact)
            setMeasuredDimension(if (faces.isEmpty()) 0 else step * (faces.size - 1) + size, size)
        }

        override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
            val rtl = layoutDirection == View.LAYOUT_DIRECTION_RTL
            var i = 0
            while (i < faces.size) {
                val left = if (rtl) width - i * step - size else i * step
                faces[i].layout(left, 0, left + size, size)
                i++
            }
        }

        override fun dispatchDraw(canvas: Canvas) {
            // The rings are cleared on a layer of their own, never through to the pill behind them.
            val layer = canvas.saveLayer(0f, 0f, width.toFloat(), height.toFloat(), null)
            super.dispatchDraw(canvas)
            canvas.restoreToCount(layer)
        }

        override fun drawChild(canvas: Canvas, child: View, drawingTime: Long): Boolean {
            if (faces.size > 0 && child !== faces[0]) {
                val radius = size / 2f + ring
                canvas.drawRoundRect(child.left - ring, child.top - ring, child.right + ring, child.bottom + ring, radius, radius, clear)
            }
            return super.drawChild(canvas, child, drawingTime)
        }
    }
}
