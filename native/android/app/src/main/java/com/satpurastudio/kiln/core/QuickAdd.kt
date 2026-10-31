package com.satpurastudio.kiln.core

import java.util.concurrent.ConcurrentHashMap

/**
 * Natural-language add: "gym tomorrow 7am !high #fitness" → fields, with the recognized
 * tokens taken out of the title. A line-for-line port of parseQuickAdd in utils.js;
 * shared/fixtures/parse.json holds what the JS produces.
 */
data class Parsed(
    val title: String,
    val projectId: String? = null,
    val newFolder: String? = null,
    val priority: String? = null,
    val time: String? = null,
    val due: String? = null,
) {
    val detected get() = due != null || time != null || priority != null || projectId != null || newFolder != null
}

private val DOW = mapOf("sun" to 0, "mon" to 1, "tue" to 2, "wed" to 3, "thu" to 4, "fri" to 5, "sat" to 6)
private val MON = listOf("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec").withIndex().associate { it.value to it.index }
private const val MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
private const val WEEKDAY_RE = "(monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun)"
private const val LEAD = "(?:on\\s+|by\\s+|due\\s+)?"
private const val ORD = "(?:st|nd|rd|th)?"

private val cache = ConcurrentHashMap<String, Regex>()
private fun rx(p: String, ci: Boolean) = cache.getOrPut((if (ci) "i:" else "c:") + p) {
    if (ci) Regex(p, RegexOption.IGNORE_CASE) else Regex(p)
}

/** A calendar date. With no year it means the next time that date comes round. */
private fun calendarDate(month: Int, day: Int, year: Int?): String? {
    val today = D.now.startOfDay
    val y = when {
        year == null -> today.year
        year < 100 -> 2000 + year
        else -> year
    }
    var d = D.make(y, month, day)
    if (d.month0 != month) return null
    if (year == null && d < today) {
        d = D.make(y + 1, month, day)
        if (d.month0 != month) return null
    }
    return toDateStr(d)
}

/** "the 30th" → the next 30th: this month if it hasn't passed, else next month. */
private fun nextDayOfMonth(day: Int): String? {
    val now = D.now
    for (i in 0 until 3) {
        val d = D.make(now.year, now.month0 + i, day)
        if (d.day != day) continue
        if (i == 0 && day < now.day) continue
        return toDateStr(d)
    }
    return null
}

fun parseQuickAdd(raw: String, projects: List<Pair<String, String>>): Parsed {
    val original = raw.trim()
    if (original.isEmpty()) return Parsed(original)
    var res = Parsed(original)
    var s = " $raw "
    fun find(p: String, ci: Boolean = true) = rx(p, ci).find(s)
    fun remove(m: MatchResult) {
        s = s.substring(0, m.range.first) + " " + s.substring(m.range.last + 1)
    }
    fun MatchResult.g(i: Int): String? = groups[i]?.value

    // folder: #name → the matching folder, or flag a new one to create
    find("\\s#([\\p{L}\\p{N}_][\\p{L}\\p{N}_-]*)", ci = false)?.let { m ->
        val tag = m.g(1)!!
        val q = tag.lowercase()
        fun norm(n: String) = n.lowercase().filterNot { it.isWhitespace() }
        val p = projects.firstOrNull { norm(it.second) == q }
            ?: projects.firstOrNull { norm(it.second).startsWith(q) || it.second.lowercase().startsWith(q) }
            ?: projects.firstOrNull { it.second.lowercase().contains(q) }
        if (p != null) {
            res = res.copy(projectId = p.first)
            remove(m)
        } else if (Character.isLetter(tag.codePointAt(0))) {
            // "#12" in "fix bug #12" is an issue number, not a new folder
            res = res.copy(newFolder = tag.substring(0, 1).uppercase() + tag.substring(1))
            remove(m)
        }
    }

    // priority: p1..p3, !1..!3, !high/!med/!low
    find("\\s(p1|!1|!high|!hi|p2|!2|!medium|!med|p3|!3|!low)\\b")?.let { m ->
        val v = m.g(1)!!.lowercase()
        res = res.copy(priority = if ("1" in v || "hi" in v) "high" else if ("2" in v || "med" in v) "medium" else "low")
        remove(m)
    }

    // time: 5pm, 7:30 am, at 14:00, noon, midnight
    run {
        find("\\s(?:at\\s+)?(1[0-2]|0?[1-9])(?::([0-5]\\d))?\\s*(am|pm)\\b")?.let { m ->
            var h = m.g(1)!!.toInt() % 12
            if (m.g(3)!!.lowercase() == "pm") h += 12
            res = res.copy(time = h.toString().padStart(2, '0') + ":" + (m.g(2) ?: "00"))
            remove(m)
            return@run
        }
        find("\\s(?:at\\s+)?noon\\b")?.let { m ->
            res = res.copy(time = "12:00")
            remove(m)
            return@run
        }
        find("\\s(?:at\\s+)?midnight\\b")?.let { m ->
            res = res.copy(time = "00:00")
            remove(m)
            return@run
        }
        find("\\s(?:at\\s+)?([01]?\\d|2[0-3]):([0-5]\\d)\\b", ci = false)?.let { m ->
            res = res.copy(time = m.g(1)!!.toInt().toString().padStart(2, '0') + ":" + m.g(2))
            remove(m)
        }
    }

    // date: relative words, then calendar dates, then weekdays. Bare numeric and weekday forms
    // only count at the end of the phrase (or after on/by/due), so "read 1/2 of the book" or
    // "sat exam prep" stay as titles.
    run {
        fun set(due: String, m: MatchResult) {
            res = res.copy(due = due)
            remove(m)
        }
        find("\\s(today|tonight)\\b")?.let { set(todayStr(), it); return@run }
        find("\\s(?:the\\s+)?(day after tomorrow|overmorrow)\\b")?.let { set(addDaysStr(2), it); return@run }
        find("\\s(tomorrow|tmrw|tmr)\\b")?.let { set(addDaysStr(1), it); return@run }
        find("\\snext week\\b")?.let { set(addDaysStr(7), it); return@run }
        find("\\snext month\\b")?.let {
            val d = D.now
            val first = D.make(d.year, d.month0 + 1, 1)
            val last = D.make(first.year, first.month0 + 1, 0).day
            set(toDateStr(D.make(first.year, first.month0, minOf(d.day, last))), it)
            return@run
        }
        find("\\s(?:this\\s+)?weekend\\b")?.let { set(addDaysStr((6 - D.now.dow + 7) % 7), it); return@run }
        find("\\sin (\\d{1,3}) (days?|weeks?|wks?)\\b")?.let {
            val n = it.g(1)!!.toInt() * (if (it.g(2)!!.lowercase().startsWith("w")) 7 else 1)
            set(addDaysStr(minOf(365, n)), it)
            return@run
        }
        // 26 oct · 26th october · 26 of oct · 26 oct 2027
        find("\\s$LEAD(?:the\\s+)?(\\d{1,2})$ORD\\s+(?:of\\s+)?$MONTH_RE(?:,?\\s+(\\d{4}))?\\b")?.let { m ->
            calendarDate(MON.getValue(m.g(2)!!.take(3).lowercase()), m.g(1)!!.toInt(), m.g(3)?.toInt())?.let { set(it, m); return@run }
        }
        // oct 26 · october 26th · oct 26, 2027
        find("\\s$LEAD$MONTH_RE\\s+(\\d{1,2})$ORD(?:,?\\s+(\\d{4}))?\\b")?.let { m ->
            calendarDate(MON.getValue(m.g(1)!!.take(3).lowercase()), m.g(2)!!.toInt(), m.g(3)?.toInt())?.let { set(it, m); return@run }
        }
        // 26/10 · 26-10-2026 — day first (Indian/UK order)
        (find("\\s(?:on|by|due)\\s+(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{2}|\\d{4}))?\\b")
            ?: find("\\s(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{2}|\\d{4}))?\\s*$", ci = false))?.let { m ->
            val mo = m.g(2)!!.toInt()
            if (mo in 1..12) calendarDate(mo - 1, m.g(1)!!.toInt(), m.g(3)?.toInt())?.let { set(it, m); return@run }
        }
        // the 30th · on the 30th · by the 5th · 30th (at the end)
        (find("\\s(?:on\\s+|by\\s+)?the\\s+(\\d{1,2})(?:st|nd|rd|th)\\b")
            ?: find("\\s(?:on\\s+|by\\s+)?(\\d{1,2})(?:st|nd|rd|th)\\s*$"))?.let { m ->
            nextDayOfMonth(m.g(1)!!.toInt())?.let { set(it, m); return@run }
        }
        // "on friday …" anywhere; a bare weekday only at the end
        (find("\\s(next\\s+|this\\s+|on\\s+|by\\s+)$WEEKDAY_RE\\b") ?: find("\\s()$WEEKDAY_RE\\s*$"))?.let { m ->
            val target = DOW.getValue(m.g(2)!!.take(3).lowercase())
            var off = (target - D.now.dow + 7) % 7
            if (off == 0) off = 7 // a weekday name means the upcoming one, not today
            if ((m.g(1) ?: "").lowercase().contains("next") && off < 7) off += 7
            set(addDaysStr(off), m)
        }
    }

    val title = s.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.joinToString(" ")
    // if the tokens ate the whole title, treat the text as literal instead
    if (title.isEmpty()) return Parsed(original)
    return res.copy(title = title)
}
