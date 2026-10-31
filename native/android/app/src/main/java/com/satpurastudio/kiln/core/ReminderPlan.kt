package com.satpurastudio.kiln.core

/**
 * What the OS should be holding: one alert at each timed task's due time, plus a morning
 * digest of what's due that day. Same plan as reminders.js.
 */
data class PlannedReminder(val id: Int, val title: String, val body: String, val atMs: Long)

const val DIGEST_HOUR = 9
const val DIGEST_DAYS = 7
const val DIGEST_ID = 1000
const val TEST_REMINDER_ID = 999
const val MAX_TASK_ALERTS = 50

fun reminderId(taskId: String): Int {
    var h = 0
    var i = 0
    while (i < taskId.length) {
        // one step per code point, using its first UTF-16 unit, as for…of with charCodeAt(0)
        val cp = taskId.codePointAt(i)
        h = h * 31 + taskId[i].code
        i += Character.charCount(cp)
    }
    return (10000 + (Math.abs(h.toLong()) % 2_000_000_000L)).toInt()
}

private fun atTime(due: String, hh: Int, mm: Int): D {
    val d = parseDateStr(due)
    return D.make(d.year, d.month0, d.day, hh, mm)
}

fun planReminders(tasks: List<KTask>, now: D = D.now): List<PlannedReminder> {
    val open = tasks.filter { !it.done && !it.archived && it.due != null }
    val out = ArrayList<PlannedReminder>()
    open.mapNotNull { task ->
        val time = task.time ?: return@mapNotNull null
        val p = time.split(":").map { it.toIntOrNull() ?: 0 }
        val at = atTime(task.due!!, p.getOrElse(0) { 0 }, p.getOrElse(1) { 0 })
        if (at > now) task to at else null
    }.sortedBy { it.second.ms }.take(MAX_TASK_ALERTS).forEach { (task, at) ->
        out.add(PlannedReminder(reminderId(task.id), task.title, t("dueNow"), at.ms))
    }
    for (i in 0 until DIGEST_DAYS) {
        val day = toDateStr(now.addDays(i))
        val at = atTime(day, DIGEST_HOUR, 0)
        if (at <= now) continue
        // overdue work rolls into today's count, as it does on the Today view
        val n = open.count { it.due == day || (i == 0 && (it.due ?: "") < day) }
        if (n == 0) continue
        out.add(PlannedReminder(DIGEST_ID + i, "kiln", tn("digestBody", n), at.ms))
    }
    return out
}
