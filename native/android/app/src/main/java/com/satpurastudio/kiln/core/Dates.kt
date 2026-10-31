package com.satpurastudio.kiln.core

import java.util.Calendar
import java.util.Date
import java.util.GregorianCalendar

/** Local time, with a seam so tests run at a fixed moment. */
object Clock {
    var override: Long? = null
    val ms: Long get() = override ?: System.currentTimeMillis()
}

/** A local date-time, built with `new Date(y, m, d, ...)` semantics: 0-based month, overflow rolls over. */
class D(val ms: Long) : Comparable<D> {
    private val c: Calendar by lazy { GregorianCalendar().apply { timeInMillis = ms } }
    val year get() = c.get(Calendar.YEAR)
    val month0 get() = c.get(Calendar.MONTH)
    val day get() = c.get(Calendar.DAY_OF_MONTH)
    val hour get() = c.get(Calendar.HOUR_OF_DAY)
    val minute get() = c.get(Calendar.MINUTE)
    val second get() = c.get(Calendar.SECOND)
    /** 0 = Sunday, as getDay(). */
    val dow get() = c.get(Calendar.DAY_OF_WEEK) - 1
    val date get() = Date(ms)
    fun addDays(n: Int) = make(year, month0, day + n, hour, minute)
    val startOfDay get() = make(year, month0, day)
    override fun compareTo(other: D) = ms.compareTo(other.ms)

    companion object {
        val now get() = D(Clock.ms)
        fun make(y: Int, m: Int, d: Int, h: Int = 0, min: Int = 0): D {
            val c = GregorianCalendar(y, 0, 1, 0, 0, 0)
            c.isLenient = true
            c.set(Calendar.MILLISECOND, 0)
            c.set(y, m, d, h, min, 0)
            return D(c.timeInMillis)
        }
    }
}

fun toDateStr(d: D) = "%04d-%02d-%02d".format(java.util.Locale.ROOT, d.year, d.month0 + 1, d.day)
fun todayStr() = toDateStr(D.now)
fun addDaysStr(n: Int) = toDateStr(D.now.addDays(n))

fun parseDateStr(s: String): D {
    val p = s.split("-").map { it.toIntOrNull() ?: 0 }
    if (p.size != 3) return D.now.startOfDay
    return D.make(p[0], p[1] - 1, p[2])
}

fun isOverdue(due: String?) = !due.isNullOrEmpty() && due < todayStr()
fun isToday(due: String?) = due == todayStr()
fun isTomorrow(due: String?) = due == addDaysStr(1)
fun sameDay(ms: Double, d: D) = toDateStr(D(ms.toLong())) == toDateStr(d)

/** Next occurrence of a repeating task: keeps the rhythm, never lands in the past (utils.js nextDue). */
fun nextDue(due: String?, repeat: String): String {
    val anchor = (due?.let(::parseDateStr) ?: D.now).startOfDay
    val day = anchor.day
    val today = parseDateStr(todayStr())
    fun step(n: Int): D {
        if (repeat == "daily") return D.make(anchor.year, anchor.month0, anchor.day + n)
        if (repeat == "weekly") return D.make(anchor.year, anchor.month0, anchor.day + 7 * n)
        // monthly: clamp so 31 jan → 28/29 feb, not 3 march
        val m = D.make(anchor.year, anchor.month0 + n, 1)
        val last = D.make(m.year, m.month0 + 1, 0).day
        return D.make(m.year, m.month0, minOf(day, last))
    }
    var n = 1
    var next = step(n)
    while (next < today && n < 1000) next = step(++n)
    return toDateStr(next)
}
