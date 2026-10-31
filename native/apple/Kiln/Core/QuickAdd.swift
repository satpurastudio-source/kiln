import Foundation

/// Natural-language add: "gym tomorrow 7am !high #fitness" → fields, with the
/// recognized tokens taken out of the title. A line-for-line port of
/// parseQuickAdd in utils.js; Tests/parse.json holds what the JS produces.
struct Parsed: Equatable {
    var title: String
    var projectId: String?
    var newFolder: String?
    var priority: String?
    var time: String?
    var due: String?

    var detected: Bool { due != nil || time != nil || priority != nil || projectId != nil || newFolder != nil }
}

private let DOW = ["sun": 0, "mon": 1, "tue": 2, "wed": 3, "thu": 4, "fri": 5, "sat": 6]
private let MON = ["jan": 0, "feb": 1, "mar": 2, "apr": 3, "may": 4, "jun": 5, "jul": 6, "aug": 7, "sep": 8, "oct": 9, "nov": 10, "dec": 11]
private let MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
private let WEEKDAY_RE = "(monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun)"
private let LEAD = "(?:on\\s+|by\\s+|due\\s+)?"
private let ORD = "(?:st|nd|rd|th)?"

private struct Match {
    let range: NSRange
    let groups: [String?]
    subscript(i: Int) -> String? { i < groups.count ? groups[i] : nil }
}

private final class Rx: @unchecked Sendable {
    static let shared = Rx()
    private var cache: [String: NSRegularExpression] = [:]
    private let lock = NSLock()

    func match(_ pattern: String, _ s: NSString, ci: Bool = true) -> Match? {
        let key = (ci ? "i:" : "c:") + pattern
        lock.lock()
        let re: NSRegularExpression
        if let hit = cache[key] { re = hit } else {
            re = try! NSRegularExpression(pattern: pattern, options: ci ? [.caseInsensitive] : [])
            cache[key] = re
        }
        lock.unlock()
        guard let m = re.firstMatch(in: s as String, range: NSRange(location: 0, length: s.length)) else { return nil }
        let groups: [String?] = (0..<m.numberOfRanges).map {
            let r = m.range(at: $0)
            return r.location == NSNotFound ? nil : s.substring(with: r)
        }
        return Match(range: m.range, groups: groups)
    }
}

/// A calendar date. With no year it means the next time that date comes round.
private func calendarDate(_ month: Int, _ day: Int, _ year: Int?) -> String? {
    let today = Clock.now.startOfDay
    let y = year == nil ? today.year : (year! < 100 ? 2000 + year! : year!)
    var d = makeDate(y, month, day)
    if d.month0 != month { return nil }
    if year == nil && d < today {
        d = makeDate(y + 1, month, day)
        if d.month0 != month { return nil }
    }
    return toDateStr(d)
}

/// "the 30th" → the next 30th: this month if it hasn't passed, else next month.
private func nextDayOfMonth(_ day: Int) -> String? {
    let now = Clock.now
    for i in 0..<3 {
        let d = makeDate(now.year, now.month0 + i, day)
        if d.dayOfMonth != day { continue }
        if i == 0 && day < now.dayOfMonth { continue }
        return toDateStr(d)
    }
    return nil
}

func parseQuickAdd(_ raw: String, projects: [(id: String, name: String)]) -> Parsed {
    let original = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    if original.isEmpty { return Parsed(title: original) }
    var res = Parsed(title: original)
    var s = " \(raw) " as NSString
    func remove(_ m: Match) { s = s.replacingCharacters(in: m.range, with: " ") as NSString }
    func find(_ p: String, ci: Bool = true) -> Match? { Rx.shared.match(p, s, ci: ci) }

    // folder: #name → the matching folder, or flag a new one to create
    if let m = find("\\s#([\\p{L}\\p{N}_][\\p{L}\\p{N}_-]*)", ci: false), let tag = m[1] {
        let q = tag.lowercased()
        let norm = { (name: String) in name.lowercased().filter { !$0.isWhitespace } }
        let p = projects.first { norm($0.name) == q }
            ?? projects.first { norm($0.name).hasPrefix(q) || $0.name.lowercased().hasPrefix(q) }
            ?? projects.first { $0.name.lowercased().contains(q) }
        if let p {
            res.projectId = p.id
            remove(m)
        } else if let c = tag.unicodeScalars.first?.properties.generalCategory,
                  [.uppercaseLetter, .lowercaseLetter, .titlecaseLetter, .modifierLetter, .otherLetter].contains(c) {
            // "#12" in "fix bug #12" is an issue number, not a new folder
            res.newFolder = tag.prefix(1).uppercased() + tag.dropFirst()
            remove(m)
        }
    }

    // priority: p1..p3, !1..!3, !high/!med/!low
    if let m = find("\\s(p1|!1|!high|!hi|p2|!2|!medium|!med|p3|!3|!low)\\b"), let raw = m[1]?.lowercased() {
        res.priority = (raw.contains("1") || raw.contains("hi")) ? "high" : (raw.contains("2") || raw.contains("med")) ? "medium" : "low"
        remove(m)
    }

    // time: 5pm, 7:30 am, at 14:00, noon, midnight
    if let m = find("\\s(?:at\\s+)?(1[0-2]|0?[1-9])(?::([0-5]\\d))?\\s*(am|pm)\\b") {
        var h = Int(m[1]!)! % 12
        if m[3]!.lowercased() == "pm" { h += 12 }
        res.time = String(format: "%02d:", h) + (m[2] ?? "00")
        remove(m)
    } else if let m = find("\\s(?:at\\s+)?noon\\b") {
        res.time = "12:00"
        remove(m)
    } else if let m = find("\\s(?:at\\s+)?midnight\\b") {
        res.time = "00:00"
        remove(m)
    } else if let m = find("\\s(?:at\\s+)?([01]?\\d|2[0-3]):([0-5]\\d)\\b", ci: false) {
        res.time = String(format: "%02d:", Int(m[1]!)!) + m[2]!
        remove(m)
    }

    // date: relative words, then calendar dates, then weekdays. Bare numeric and
    // weekday forms only count at the end of the phrase (or after on/by/due), so
    // "read 1/2 of the book" or "sat exam prep" stay as titles.
    func parseDate() {
        if let m = find("\\s(today|tonight)\\b") { res.due = todayStr(); remove(m); return }
        if let m = find("\\s(?:the\\s+)?(day after tomorrow|overmorrow)\\b") { res.due = addDaysStr(2); remove(m); return }
        if let m = find("\\s(tomorrow|tmrw|tmr)\\b") { res.due = addDaysStr(1); remove(m); return }
        if let m = find("\\snext week\\b") { res.due = addDaysStr(7); remove(m); return }
        if let m = find("\\snext month\\b") {
            let d = Clock.now
            let first = makeDate(d.year, d.month0 + 1, 1)
            let last = makeDate(first.year, first.month0 + 1, 0).dayOfMonth
            res.due = toDateStr(makeDate(first.year, first.month0, min(d.dayOfMonth, last)))
            remove(m)
            return
        }
        if let m = find("\\s(?:this\\s+)?weekend\\b") {
            res.due = addDaysStr((6 - Clock.now.dow + 7) % 7)
            remove(m)
            return
        }
        if let m = find("\\sin (\\d{1,3}) (days?|weeks?|wks?)\\b") {
            let n = Int(m[1]!)! * (m[2]!.lowercased().hasPrefix("w") ? 7 : 1)
            res.due = addDaysStr(min(365, n))
            remove(m)
            return
        }
        // 26 oct · 26th october · 26 of oct · 26 oct 2027
        if let m = find("\\s\(LEAD)(?:the\\s+)?(\\d{1,2})\(ORD)\\s+(?:of\\s+)?\(MONTH_RE)(?:,?\\s+(\\d{4}))?\\b"),
           let dm = calendarDate(MON[String(m[2]!.prefix(3)).lowercased()]!, Int(m[1]!)!, m[3].flatMap { Int($0) }) {
            res.due = dm; remove(m); return
        }
        // oct 26 · october 26th · oct 26, 2027
        if let m = find("\\s\(LEAD)\(MONTH_RE)\\s+(\\d{1,2})\(ORD)(?:,?\\s+(\\d{4}))?\\b"),
           let dm = calendarDate(MON[String(m[1]!.prefix(3)).lowercased()]!, Int(m[2]!)!, m[3].flatMap { Int($0) }) {
            res.due = dm; remove(m); return
        }
        // 26/10 · 26-10-2026 — day first (Indian/UK order)
        if let m = find("\\s(?:on|by|due)\\s+(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{2}|\\d{4}))?\\b")
            ?? find("\\s(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{2}|\\d{4}))?\\s*$", ci: false),
           let mo = Int(m[2]!), mo >= 1, mo <= 12,
           let dm = calendarDate(mo - 1, Int(m[1]!)!, m[3].flatMap { Int($0) }) {
            res.due = dm; remove(m); return
        }
        // the 30th · on the 30th · by the 5th · 30th (at the end)
        if let m = find("\\s(?:on\\s+|by\\s+)?the\\s+(\\d{1,2})(?:st|nd|rd|th)\\b")
            ?? find("\\s(?:on\\s+|by\\s+)?(\\d{1,2})(?:st|nd|rd|th)\\s*$"),
           let dm = nextDayOfMonth(Int(m[1]!)!) {
            res.due = dm; remove(m); return
        }
        // "on friday …" anywhere; a bare weekday only at the end
        if let m = find("\\s(next\\s+|this\\s+|on\\s+|by\\s+)\(WEEKDAY_RE)\\b") ?? find("\\s()\(WEEKDAY_RE)\\s*$") {
            let target = DOW[String(m[2]!.prefix(3)).lowercased()]!
            var off = (target - Clock.now.dow + 7) % 7
            if off == 0 { off = 7 } // a weekday name means the upcoming one, not today
            if (m[1] ?? "").lowercased().contains("next") && off < 7 { off += 7 }
            res.due = addDaysStr(off)
            remove(m)
        }
    }
    parseDate()

    let title = (s as String)
        .components(separatedBy: .whitespacesAndNewlines)
        .filter { !$0.isEmpty }
        .joined(separator: " ")
    // if the tokens ate the whole title, treat the text as literal instead
    if title.isEmpty { return Parsed(title: original) }
    res.title = title
    return res
}
