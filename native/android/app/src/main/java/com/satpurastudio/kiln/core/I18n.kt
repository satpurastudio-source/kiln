package com.satpurastudio.kiln.core

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale

data class Language(val code: String, val name: String, val native: String)

val LANGUAGES = listOf(
    Language("en", "English", "English"),
    Language("hi", "Hindi", "हिन्दी"),
    Language("mr", "Marathi", "मराठी"),
    Language("gu", "Gujarati", "ગુજરાતી"),
    Language("bn", "Bengali", "বাংলা"),
    Language("ta", "Tamil", "தமிழ்"),
    Language("te", "Telugu", "తెలుగు"),
    Language("kn", "Kannada", "ಕನ್ನಡ"),
    Language("pa", "Punjabi", "ਪੰਜਾਬੀ"),
    Language("ml", "Malayalam", "മലയാളം"),
    Language("or", "Odia", "ଓଡ଼ିଆ"),
    Language("ur", "Urdu", "اردو"),
)

/** Same words as the web app: shared/locales/\*.json is generated from src/locales. */
object I18n {
    /** Observed: anything showing words redraws in place when this changes. */
    var lang by mutableStateOf("en")
    /** Reads a locale file; set at startup. Only the languages in use are ever parsed. */
    var loader: (String) -> String? = { null }
    /** Turns a CLDR skeleton into a pattern; set at startup to the platform's. */
    var bestPattern: (Locale, String) -> String = { _, s -> s }
    private val dicts = HashMap<String, Map<String, String>>()

    private fun dict(code: String): Map<String, String> = dicts.getOrPut(code) {
        loader(code)?.let { J.parse(it)?.obj?.mapValues { e -> e.value.string ?: "" } } ?: emptyMap()
    }

    /** Nothing picked yet → the phone's language if we speak it, else English. */
    fun resolve(picked: String?, preferred: List<String> = listOf(Locale.getDefault().language)): String {
        val known = LANGUAGES.map { it.code }
        if (picked in known) return picked!!
        return preferred.map { it.take(2).lowercase() }.firstOrNull { it in known } ?: "en"
    }

    fun t(key: String, vars: Map<String, String> = emptyMap()): String {
        var s = dict(lang)[key] ?: dict("en")[key] ?: key
        for ((k, v) in vars) s = s.replace("{$k}", v)
        return s
    }

    /** English stays en-US; the rest use the Indian locale of that language. */
    val locale: Locale get() = if (lang == "en") Locale.US else Locale(lang, "IN")
}

fun t(key: String, vararg vars: Pair<String, String>) = I18n.t(key, vars.toMap())
fun tn(key: String, n: Int, vararg vars: Pair<String, String>) =
    I18n.t(if (n == 1) "${key}_one" else "${key}_other", vars.toMap() + ("n" to fmtNum(n)))

fun fmtNum(n: Int): String = if (I18n.lang == "en") n.toString() else NumberFormat.getInstance(I18n.locale).format(n.toLong())

/** `skeleton` is a CLDR skeleton: "EEEE", "MMMd", "EEEEMMMMd", "EEEMMMd", "MMMM", "EEEEE". */
fun fmtDate(d: D, skeleton: String): String =
    SimpleDateFormat(I18n.bestPattern(I18n.locale, skeleton), I18n.locale).format(d.date)

fun fmtDue(due: String?): String {
    if (due.isNullOrEmpty()) return ""
    if (isToday(due)) return t("today")
    if (isTomorrow(due)) return t("tomorrow")
    val d = parseDateStr(due)
    // within the next 6 days → weekday name
    if (!isOverdue(due) && (2..6).any { due == addDaysStr(it) }) return fmtDate(d, "EEEE")
    return fmtDate(d, "MMMd")
}

fun fmtLongDate(d: D = D.now) = fmtDate(d, "EEEEMMMMd")

fun greeting(): String {
    val h = D.now.hour
    return t(
        when {
            h < 5 -> "greetLate"
            h < 12 -> "greetMorning"
            h < 17 -> "greetAfternoon"
            h < 22 -> "greetEvening"
            else -> "greetWinding"
        }
    )
}

private val TIME_RE = Regex("^\\d{1,2}:\\d{2}$")

/** 'HH:MM' (24h) → friendly 12h label, e.g. '14:30' → '2:30 PM'. */
fun fmtTime(hhmm: String?): String {
    if (hhmm == null || !TIME_RE.matches(hhmm)) return ""
    val (h, m) = hhmm.split(":").map { it.toInt() }
    if (I18n.lang != "en") return fmtDate(D.make(2000, 0, 1, h, m), "jmm")
    return "${if (h % 12 == 0) 12 else h % 12}:${m.toString().padStart(2, '0')} ${if (h < 12) "AM" else "PM"}"
}

fun fmtHour(h: Int) = fmtDate(D.make(2000, 0, 1, h), "j")
