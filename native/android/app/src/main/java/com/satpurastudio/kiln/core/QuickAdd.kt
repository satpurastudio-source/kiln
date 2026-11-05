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

// ---- Hinglish and Hindi (a port of hinglishTime and hinglishDate in utils.js) ----

private const val H_NUM = "([0-9\\u0966-\\u096f]{1,2})"
private const val H_END = ",?(?=\\s)"
private const val H_BAJE = "(?:baje|bje|bajay|bajey|bajhe|baaje|बजे)"
private const val H_KO = "(?:\\s+(?:ko|को))?"
private const val H_PART_HI = "subah|subha|subh|suba|savere|sawere|savera|sawera|dopahar|dopehar|dupahar|dopaher|dophar|dopahr|duphar|sham|shaam|raat|raath|सुबह|सवेरे|सवेरा|दोपहर|शाम|रात"
// Only safe right next to "baje": "9 baje night", but not "rat poison 9" or "10 morning pages"
private const val H_PART_ANY = "$H_PART_HI|morning|mrng|evening|eve|night|nite|afternoon|noon|rat"
private const val H_LINK_BEFORE = "(?:ko|ke|ki|mein|me|mai|main|को|के|की|में)"
private const val H_LINK_AFTER = "(?:\\s+(?:ko|mein|me|mai|main|को|में))?"
private const val H_MINUTES = "(?:[:.](?<min>[0-5][0-9]))?"
// "din mein 2 baje" is daytime, but "2 din mein" means in two days
private const val H_BEFORE_BAJE = "(?:(?<pb>$H_PART_ANY)(?:\\s+\\k<pb>)?\\s*(?:$H_LINK_BEFORE\\s+)?|(?<![0-9\\u0966-\\u096f]\\s)(?<db>din|दिन)\\s+(?:mein|me|ke|में|के)\\s+)?"
private const val H_AFTER_BAJE = "(?:\\s+(?<pa>$H_PART_ANY)$H_LINK_AFTER|\\s+(?<da>din|दिन)\\s+(?:mein|me|में))?"
private const val H_HALF = "\\u0922\\u093c|\\u095d" // ढ़ arrives in either of two Unicode spellings
private const val H_QUARTERS = "(saade|sade|saadhe|sadhe|सा(?:$H_HALF)े|sawa|sava|सवा|paune|pone|पौने)"
private const val H_WHOLE_HALF = "(dedh|deadh|डे(?:$H_HALF)|dhai|dhaai|ढाई)"
private val H_PART_KIND = mapOf(
    "subah" to "am", "subha" to "am", "subh" to "am", "suba" to "am", "savere" to "am", "sawere" to "am", "savera" to "am", "sawera" to "am",
    "सुबह" to "am", "सवेरे" to "am", "सवेरा" to "am", "morning" to "am", "mrng" to "am", "breakfast" to "am", "nashta" to "am", "नाश्ता" to "am",
    "dopahar" to "noon", "dopehar" to "noon", "dupahar" to "noon", "dopaher" to "noon", "dophar" to "noon", "dopahr" to "noon", "duphar" to "noon",
    "दोपहर" to "noon", "din" to "noon", "दिन" to "noon", "afternoon" to "noon", "noon" to "noon", "lunch" to "noon",
    "sham" to "pm", "shaam" to "pm", "शाम" to "pm", "evening" to "pm", "eve" to "pm", "dinner" to "pm",
    "raat" to "night", "raath" to "night", "rat" to "night", "रात" to "night", "night" to "night", "nite" to "night",
)
// Order matters: it is the regex alternation order, the same as the web app's
private val H_DOW_KEYS = listOf(
    "somvar" to 1, "somwar" to 1, "सोमवार" to 1,
    "mangalvar" to 2, "mangalwar" to 2, "मंगलवार" to 2,
    "budhvar" to 3, "budhwar" to 3, "बुधवार" to 3,
    "guruvar" to 4, "guruwar" to 4, "veervar" to 4, "brihaspativar" to 4, "गुरुवार" to 4, "वीरवार" to 4, "बृहस्पतिवार" to 4,
    "shukravar" to 5, "shukrawar" to 5, "शुक्रवार" to 5,
    "shanivar" to 6, "shaniwar" to 6, "शनिवार" to 6,
    "ravivar" to 0, "raviwar" to 0, "itwar" to 0, "itvar" to 0, "रविवार" to 0, "इतवार" to 0,
)
private val H_DOW = H_DOW_KEYS.toMap()
private val H_DOW_RE = "(" + H_DOW_KEYS.joinToString("|") { it.first } + ")"
private const val H_EN_DOW_FULL = "(monday|tuesday|wednesday|thursday|friday|saturday|sunday)"
private const val H_AFTER_DAY = "(?:\\s+(?:ko|tak|ka|ki|को|तक|का|की))?"
private const val H_NEXT_WORD = "(?:agle|agla|next|अगले|अगला)"
private const val H_WEEK_WORDS = "hafte|hafta|week|हफ्ते|हफ़्ते|हफ्ता|हफ़्ता"
private const val H_WEEK_WORD = "(?:$H_WEEK_WORDS)"

private fun hFind(p: String, s: String) = rx(p, true).find(s)
private fun hTest(p: String, s: String) = rx(p, true).containsMatchIn(s)
private fun MatchResult.n(name: String): String? = (groups as? MatchNamedGroupCollection)?.get(name)?.value
private fun MatchResult.i(index: Int): String? = groups[index]?.value
private fun cut(s: String, r: IntRange) = s.substring(0, r.first) + " " + s.substring(r.last + 1)

private fun toNum(x: String): Int =
    x.map { if (it in '०'..'९') ('0' + (it - '०')) else it }.joinToString("").toIntOrNull() ?: 0

/** With no part of the day, the hour people usually mean: 1 to 6 is the afternoon or evening, 7 to 11 the morning. */
private fun spokenHour(h: Int, kind: String?): Int {
    if (h == 0 || h > 12) return h
    return when (kind) {
        "am" -> h
        "pm" -> if (h == 12) 12 else h + 12
        "noon" -> if (h == 12) 12 else if (h <= 5) h + 12 else h
        "night" -> if (h == 12) 0 else if (h <= 4) h else h + 12
        else -> if (h == 12) 12 else if (h <= 6) h + 12 else h
    }
}

private fun clock(h: Int, m: Int) = h.toString().padStart(2, '0') + ":" + m.toString().padStart(2, '0')

/** Reads the time out of s. Returns the text with it removed, and the time. */
private fun hinglishTime(s: String): Pair<String, String>? {
    fun kindOf(p: String?) = H_PART_KIND[(p ?: "").lowercase()]
    fun done(m: MatchResult, hour: Int, minute: Int, kindIn: String?, meridiem: String?): Pair<String, String> {
        var rest = cut(s, m.range)
        var kind = kindIn
        if (kind == null && meridiem == null && hour in 1..12) {
            // The part of the day can be further away: "raat ko mummy ko 9 baje call".
            // It leaves the title only if it's plainly about the time, so "raat ka khana" stays.
            val far = hFind("\\s($H_PART_HI)(\\s+(?:ko|mein|me|mai|main|को|में))?(?=\\s)", rest)
            val hint = hFind("\\s(morning|evening|night|afternoon|breakfast|nashta|नाश्ता|lunch|dinner)(?=\\s)", rest)
            if (far != null) {
                kind = kindOf(far.i(1))
                val after = rest.substring(far.range.last + 1)
                if (far.i(2) != null || after.isBlank()) rest = rest.substring(0, far.range.first) + " " + after
            } else if (hint != null) kind = kindOf(hint.i(1))
        }
        val h = if (meridiem != null) (hour % 12) + (if (meridiem.lowercase() == "pm") 12 else 0) else spokenHour(hour, kind)
        return rest to clock(h, minute)
    }

    // 9 baje raat · raat ke 9 baje · sham saade 6 baje · 9.30 baje raat ko · din mein 2 baje · 14 baje
    hFind("\\s(?:at\\s+)?$H_BEFORE_BAJE(?:(?<q>$H_QUARTERS)\\s+)?(?<n>$H_NUM)$H_MINUTES\\s*$H_BAJE(?:\\s*(?<mer>am|pm))?$H_KO$H_AFTER_BAJE$H_END", s)?.let { m ->
        val n = toNum(m.n("n")!!)
        val q = (m.n("q") ?: "").lowercase()
        if (n <= 23 && (q.isEmpty() || n in 1..12)) {
            val kind = kindOf(m.n("pb") ?: m.n("db") ?: m.n("pa") ?: m.n("da"))
            val mer = m.n("mer")
            return when {
                hTest("^(sawa|sava|सवा)", q) -> done(m, n, 15, kind, mer)
                hTest("^(sa|सा)", q) -> done(m, n, 30, kind, mer)
                q.isNotEmpty() -> done(m, if (n == 1) 12 else n - 1, 45, kind, mer)
                else -> done(m, n, m.n("min")?.toInt() ?: 0, kind, mer)
            }
        }
    }
    // dedh baje raat (1:30) · sham dhai baje (2:30)
    hFind("\\s(?:at\\s+)?$H_BEFORE_BAJE(?<half>$H_WHOLE_HALF)\\s*$H_BAJE$H_KO$H_AFTER_BAJE$H_END", s)?.let { m ->
        return done(m, if (hTest("^(de|डे)", m.n("half")!!)) 1 else 2, 30, kindOf(m.n("pb") ?: m.n("db") ?: m.n("pa") ?: m.n("da")), null)
    }
    // With a part of the day, "baje" is optional: subah 7 · raat ko 9 · sham 6.30 · raat 9pm
    hFind("\\s(?<pb>$H_PART_HI)(?:\\s+\\k<pb>)?\\s+(?:$H_LINK_BEFORE\\s+)?(?<n>$H_NUM)$H_MINUTES\\s*(?<mer>am|pm)?$H_END", s)?.let { m ->
        val n = toNum(m.n("n")!!)
        if (n in 1..12) return done(m, n, m.n("min")?.toInt() ?: 0, kindOf(m.n("pb")), m.n("mer"))
    }
    // ...and it can come after: 9 raat ko · 6:30 sham · 9pm raat
    hFind("\\s(?<n>$H_NUM)$H_MINUTES\\s*(?<mer>am|pm)?\\s+(?<pa>$H_PART_HI)$H_LINK_AFTER$H_END", s)?.let { m ->
        val n = toNum(m.n("n")!!)
        if (n in 1..12) return done(m, n, m.n("min")?.toInt() ?: 0, kindOf(m.n("pa")), m.n("mer"))
    }
    return null
}

private fun nextMonthStr(): String {
    val d = D.now
    val first = D.make(d.year, d.month0 + 1, 1)
    val last = D.make(first.year, first.month0 + 1, 0).day
    return toDateStr(D.make(first.year, first.month0, minOf(d.day, last)))
}

private fun upcomingWeekday(target: Int, next: Boolean): String {
    var off = (target - D.now.dow + 7) % 7
    if (off == 0) off = 7 // a weekday name means the upcoming one, not today
    if (next && off < 7) off += 7 // "next monday" → a full week out
    return addDaysStr(off)
}

private fun hinglishDate(s: String): Pair<IntRange, String>? {
    fun f(p: String) = hFind(p, s)
    // aaj · aaj raat · aaj tak · aaj ki
    f("\\s(?:aaj|आज)(?:\\s+(?:raat|रात)$H_KO)?$H_AFTER_DAY$H_END")?.let { return it.range to todayStr() }
    // kal · kal tak · kal ki (but "kal wala" points back at yesterday)
    f("\\s(?:kal|कल)(?!\\s+(?:wala|wali|wale|वाला|वाली|वाले)\\s)$H_AFTER_DAY$H_END")?.let { return it.range to addDaysStr(1) }
    f("\\s(?:parso|parson|परसों|परसो)$H_AFTER_DAY$H_END")?.let { return it.range to addDaysStr(2) }
    f("\\s(?:narso|narson|नरसों|नरसो)$H_AFTER_DAY$H_END")?.let { return it.range to addDaysStr(3) }
    // agle hafte · agle week · next hafte
    f("\\s$H_NEXT_WORD\\s+$H_WEEK_WORD(?:\\s+(?:ko|tak|mein|me|को|तक|में))?$H_END")?.let { return it.range to addDaysStr(7) }
    // agle mahine · agle month · next mahine
    f("\\s$H_NEXT_WORD\\s+(?:mahine|mahina|month|महीने|महीना)(?:\\s+(?:ko|tak|mein|me|को|तक|में))?$H_END")?.let { return it.range to nextMonthStr() }
    // 3 din baad · 2 din mein · 2 hafte baad
    f("\\s$H_NUM\\s+(din|dino|dinon|$H_WEEK_WORDS|weeks|hafton|दिन|दिनों|हफ्तों)\\s+(?:baad|bad|mein|me|mai|बाद|में)$H_END")?.let {
        val weeks = hTest("^(h|w|ह)", it.i(2)!!)
        return it.range to addDaysStr(minOf(365, toNum(it.i(1)!!) * (if (weeks) 7 else 1)))
    }
    // is weekend · weekend pe
    (f("\\sis\\s+weekend$H_AFTER_DAY$H_END") ?: f("\\sweekend\\s+(?:ko|par|pe|tak)$H_END"))?.let {
        return it.range to addDaysStr((6 - D.now.dow + 7) % 7)
    }
    // agle shukravar · is friday · agle friday ko
    f("\\s($H_NEXT_WORD|is|इस)\\s+(?:$H_EN_DOW_FULL|$H_DOW_RE)$H_AFTER_DAY$H_END")?.let {
        val target = it.i(2)?.let { d -> DOW.getValue(d.take(3).lowercase()) } ?: H_DOW.getValue(it.i(3)!!.lowercase())
        return it.range to upcomingWeekday(target, !hTest("^(is|इस)$", it.i(1)!!))
    }
    // shukravar anywhere (the word can't be anything else) · friday ko anywhere
    f("\\s$H_DOW_RE$H_AFTER_DAY$H_END")?.let { return it.range to upcomingWeekday(H_DOW.getValue(it.i(1)!!.lowercase()), false) }
    f("\\s$H_EN_DOW_FULL\\s+(?:ko|tak|को|तक)$H_END")?.let { return it.range to upcomingWeekday(DOW.getValue(it.i(1)!!.take(3).lowercase()), false) }
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

    // time: 6 baje, sham 5 baje, 5pm, 7:30 am, at 14:00, noon, midnight
    run {
        hinglishTime(s)?.let { (rest, time) ->
            res = res.copy(time = time)
            s = rest
            return@run
        }
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
        hinglishDate(s)?.let { (range, due) -> res = res.copy(due = due); s = cut(s, range); return@run }
        find("\\s(today|tonight)\\b")?.let { set(todayStr(), it); return@run }
        find("\\s(?:the\\s+)?(day after tomorrow|overmorrow)\\b")?.let { set(addDaysStr(2), it); return@run }
        find("\\s(tomorrow|tmrw|tmr)\\b")?.let { set(addDaysStr(1), it); return@run }
        find("\\snext week\\b")?.let { set(addDaysStr(7), it); return@run }
        find("\\snext month\\b")?.let { set(nextMonthStr(), it); return@run }
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
            set(upcomingWeekday(DOW.getValue(m.g(2)!!.take(3).lowercase()), (m.g(1) ?: "").lowercase().contains("next")), m)
        }
    }

    val title = s.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.joinToString(" ")
    // if the tokens ate the whole title, treat the text as literal instead
    if (title.isEmpty()) return Parsed(original)
    return res.copy(title = title)
}
