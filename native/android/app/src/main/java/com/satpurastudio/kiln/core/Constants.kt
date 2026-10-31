package com.satpurastudio.kiln.core

import java.util.Locale

private const val BASE36 = "abcdefghijklmnopqrstuvwxyz0123456789"
fun uid(): String = (1..7).map { BASE36.random() }.joinToString("") + Clock.ms.toString(36)

val priorityRank = mapOf("high" to 0, "medium" to 1, "low" to 2, "none" to 3)
val PRIORITIES = listOf("high" to "#c43d2b", "medium" to "#d98e32", "low" to "#5f7c8a", "none" to "transparent")
val priorityColors = PRIORITIES.toMap()
val REPEATS = listOf("none", "daily", "weekly", "monthly")
val PROJECT_COLORS = listOf("#d85a30", "#d9a441", "#7c8a4d", "#6f9b7a", "#5f7c8a", "#8a5a7c", "#a03c1c", "#b0a18c")
val PROJECT_ICONS = listOf("✦", "◆", "❋", "●", "▲", "✚", "✳", "✶", "☾", "⬡")
val HABIT_COLORS = listOf("#d85a30", "#d9a441", "#6f9b7a", "#5f7c8a", "#8a5a7c", "#7c8a4d")
/** U+FE0E forces text (non-emoji) presentation of an otherwise ambiguous glyph. */
fun iconGlyph(g: String) = "$g︎"

data class Accent(val id: String, val accent: String, val accent2: String, val deep: String)

val ACCENTS = listOf(
    Accent("terracotta", "#d85a30", "#ea6840", "#c24a24"),
    Accent("ember", "#c43d2b", "#e0553f", "#a8331f"),
    Accent("amber", "#c98a1e", "#dda23a", "#a8720f"),
    Accent("sage", "#6f9b7a", "#84b28f", "#588364"),
    Accent("ocean", "#5f7c8a", "#74929f", "#4c6570"),
    Accent("plum", "#8a5a7c", "#a06f92", "#704764"),
)

fun hexRGB(hex: String): Triple<Int, Int, Int> {
    var h = hex.replace("#", "")
    if (h.length == 3) h = h.map { "$it$it" }.joinToString("")
    fun part(i: Int) = if (i + 2 <= h.length) h.substring(i, i + 2).toIntOrNull(16) ?: 0 else 0
    return Triple(part(0), part(2), part(4))
}

/** amt > 0 lightens toward white, amt < 0 darkens toward black. */
private fun shadeHex(hex: String, amt: Double): String {
    val (r, g, b) = hexRGB(hex)
    val target = if (amt < 0) 0.0 else 255.0
    val p = Math.abs(amt)
    fun mix(c: Int) = Math.round((target - c) * p + c).toInt().coerceIn(0, 255)
    return "#%02x%02x%02x".format(Locale.ROOT, mix(r), mix(g), mix(b))
}

fun deriveAccent(hex: String) = Accent("custom", hex, shadeHex(hex, 0.16), shadeHex(hex, -0.18))

fun resolveAccent(settings: Item): Accent {
    val custom = settings["customAccent"]?.string
    if (settings["accent"]?.string == "custom" && !custom.isNullOrEmpty()) return deriveAccent(custom)
    return ACCENTS.firstOrNull { it.id == settings["accent"]?.string } ?: ACCENTS[0]
}

val DEFAULT_SETTINGS: Item = itemOf(
    "accent" to J.Str("terracotta"),
    "customAccent" to J.Str("#d85a30"),
    "defaultDue" to J.Str("today"),
    "defaultPriority" to J.Str("none"),
    "defaultTime" to J.Str(""),
    "reducedEffects" to J.Bool(false),
    "textScale" to 1.j(),
    "focusWork" to 25.j(),
    "focusBreak" to 5.j(),
    "ambient" to J.Obj(emptyMap()),
)

const val TEXT_SCALE_MIN = 0.9
const val TEXT_SCALE_MAX = 1.4

/** Every ambient-mode knob. Saved settings only hold what the user changed. */
val AMBIENT_DEFAULTS: Item = itemOf(
    "theme" to J.Str("app"), "side" to J.Str("left"), "clockSize" to 480.j(), "clockFace" to J.Str("classic"), "seconds" to J.Str("sweep"),
    "showDigital" to true.j(), "showDate" to true.j(), "showGreeting" to true.j(), "showProgress" to true.j(), "quickAdd" to true.j(),
    "widget1" to J.Str("streak"), "widget2" to J.Str("focus"), "columns" to J.Str("both"), "rowSize" to 22.j(), "maxRows" to 10.j(),
    "padding" to 56.j(), "gap" to 96.j(), "radius" to 18.j(), "glow" to 100.j(), "showEmber" to true.j(), "emberSize" to 128.j(),
    "emberCorner" to J.Str("right"), "emberEyes" to true.j(), "night" to J.Str("off"), "nightStart" to 23.j(), "nightEnd" to 6.j(),
    "nightLevel" to 55.j(), "drift" to 12.j(),
)

data class Purpose(val id: String, val name: String, val color: String, val icon: String)

val PURPOSES = listOf(
    Purpose("work", "Work", "#5f7c8a", "◆"),
    Purpose("study", "Study", "#8a5a7c", "❋"),
    Purpose("personal", "Personal", "#7c8a4d", "●"),
    Purpose("fitness", "Fitness", "#6f9b7a", "▲"),
    Purpose("side", "Side Project", "#d9a441", "✳"),
    Purpose("errands", "Errands", "#b0a18c", "✚"),
)

/** What's new: newest first (src/changelog.js). */
val CHANGELOG = listOf("2026-10-25" to 4, "2026-10-24" to 4)

val SEED_TEXT = mapOf(
    "Getting Started" to "seedFolderStart",
    "Work" to "p_work",
    "Personal" to "p_personal",
    "Study" to "p_study",
    "Fitness" to "p_fitness",
    "Side Project" to "p_side",
    "Errands" to "p_errands",
    "Tap the circle to complete me — watch what happens ✨" to "seedTask1",
    "Drag the ⋮⋮ grip to reorder me" to "seedTask2",
    "Tap me to edit notes, dates, time & priority" to "seedTask3",
    "Everything is editable inline. Try moving me to another folder." to "seedTask3Notes",
    "Add a task using the bar above" to "seedTask4",
    "Explore Calendar, Focus & the ⚙ Settings menu" to "seedTask5",
    "Finish every task in a folder for a surprise 🎉" to "seedTask6",
)

const val TRASH_TTL = 30.0 * 24 * 60 * 60 * 1000
