import Foundation

/// Local time, with a seam so tests run at a fixed moment.
enum Clock {
    nonisolated(unsafe) static var override: Date?
    static var now: Date { override ?? Date() }
    static var ms: Double { (now.timeIntervalSince1970 * 1000).rounded(.down) }
}

let cal: Calendar = {
    var c = Calendar(identifier: .gregorian)
    c.locale = Locale(identifier: "en_US_POSIX")
    return c
}()

/// `new Date(y, m, d, ...)`: month is 0-based and values overflow into the next unit.
func makeDate(_ y: Int, _ m: Int, _ d: Int, _ h: Int = 0, _ min: Int = 0) -> Date {
    cal.date(from: DateComponents(year: y, month: m + 1, day: d, hour: h, minute: min))!
}

extension Date {
    var year: Int { cal.component(.year, from: self) }
    var month0: Int { cal.component(.month, from: self) - 1 }
    var dayOfMonth: Int { cal.component(.day, from: self) }
    var hour: Int { cal.component(.hour, from: self) }
    var minute: Int { cal.component(.minute, from: self) }
    /// 0 = Sunday, as getDay().
    var dow: Int { cal.component(.weekday, from: self) - 1 }
    func addingDays(_ n: Int) -> Date { cal.date(byAdding: .day, value: n, to: self)! }
    var startOfDay: Date { cal.startOfDay(for: self) }
}

func toDateStr(_ d: Date) -> String {
    String(format: "%04d-%02d-%02d", d.year, d.month0 + 1, d.dayOfMonth)
}

func todayStr() -> String { toDateStr(Clock.now) }
func addDaysStr(_ n: Int) -> String { toDateStr(Clock.now.addingDays(n)) }

func parseDateStr(_ s: String) -> Date {
    let p = s.split(separator: "-").map { Int($0) ?? 0 }
    guard p.count == 3 else { return Clock.now.startOfDay }
    return makeDate(p[0], p[1] - 1, p[2])
}

func isOverdue(_ due: String?) -> Bool { due.map { !$0.isEmpty && $0 < todayStr() } ?? false }
func isToday(_ due: String?) -> Bool { due == todayStr() }
func isTomorrow(_ due: String?) -> Bool { due == addDaysStr(1) }
func sameDay(_ ms: Double, _ d: Date) -> Bool { toDateStr(Date(timeIntervalSince1970: ms / 1000)) == toDateStr(d) }

/// Next occurrence of a repeating task. Keeps the original rhythm but never
/// lands in the past — see nextDue in utils.js.
func nextDue(_ due: String?, _ repeatKind: String) -> String {
    let anchor = (due.map(parseDateStr) ?? Clock.now).startOfDay
    let day = anchor.dayOfMonth
    let today = parseDateStr(todayStr())
    func step(_ n: Int) -> Date {
        if repeatKind == "daily" { return makeDate(anchor.year, anchor.month0, anchor.dayOfMonth + n) }
        if repeatKind == "weekly" { return makeDate(anchor.year, anchor.month0, anchor.dayOfMonth + 7 * n) }
        // monthly: clamp so 31 jan → 28/29 feb, not 3 march
        let m = makeDate(anchor.year, anchor.month0 + n, 1)
        let last = makeDate(m.year, m.month0 + 1, 0).dayOfMonth
        return makeDate(m.year, m.month0, min(day, last))
    }
    var n = 1
    var next = step(n)
    while next < today && n < 1000 {
        n += 1
        next = step(n)
    }
    return toDateStr(next)
}
