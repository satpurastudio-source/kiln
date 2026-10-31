import Foundation

/// What the OS should be holding: one alert at each timed task's due time, plus
/// a morning digest of what's due that day. Same plan as reminders.js.
struct PlannedReminder: Equatable {
    let id: Int32
    let title: String
    let body: String
    let at: Date
}

let DIGEST_HOUR = 9, DIGEST_DAYS = 7, DIGEST_ID: Int32 = 1000, TEST_REMINDER_ID: Int32 = 999
let MAX_TASK_ALERTS = 50 // iOS keeps at most 64 pending per app

func reminderId(_ taskId: String) -> Int32 {
    var h: Int32 = 0
    for c in taskId.unicodeScalars {
        let unit = String(c).utf16.first ?? 0
        h = h &* 31 &+ Int32(unit)
    }
    return Int32(10000 + (abs(Int64(h)) % 2_000_000_000))
}

private func atTime(_ due: String, _ hh: Int, _ mm: Int) -> Date {
    let d = parseDateStr(due)
    return makeDate(d.year, d.month0, d.dayOfMonth, hh, mm)
}

func planReminders(_ tasks: [KTask], now: Date = Clock.now) -> [PlannedReminder] {
    let open = tasks.filter { !$0.done && !$0.archived && $0.due != nil }
    var out: [PlannedReminder] = []
    let timed = open.compactMap { task -> (KTask, Date)? in
        guard let time = task.time, let due = task.due else { return nil }
        let p = time.split(separator: ":").map { Int($0) ?? 0 }
        let at = atTime(due, p.first ?? 0, p.count > 1 ? p[1] : 0)
        return at > now ? (task, at) : nil
    }.sorted { $0.1 < $1.1 }.prefix(MAX_TASK_ALERTS)
    for (task, at) in timed {
        out.append(PlannedReminder(id: reminderId(task.id), title: task.title, body: t("dueNow"), at: at))
    }
    for i in 0..<DIGEST_DAYS {
        let day = toDateStr(now.addingDays(i))
        let at = atTime(day, DIGEST_HOUR, 0)
        if at <= now { continue }
        // overdue work rolls into today's count, as it does on the Today view
        let n = open.filter { $0.due == day || (i == 0 && ($0.due ?? "") < day) }.count
        if n == 0 { continue }
        out.append(PlannedReminder(id: DIGEST_ID + Int32(i), title: "kiln", body: tn("digestBody", n), at: at))
    }
    return out
}
