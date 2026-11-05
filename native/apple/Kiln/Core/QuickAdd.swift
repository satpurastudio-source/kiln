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

// MARK: - Hinglish and Hindi (a port of hinglishTime and hinglishDate in utils.js)

private let H_NUM = "([0-9\\u0966-\\u096f]{1,2})"
private let H_END = ",?(?=\\s)"
private let H_BAJE = "(?:baje|bje|bajay|bajey|bajhe|baaje|बजे)"
private let H_KO = "(?:\\s+(?:ko|को))?"
private let H_PART_HI = "subah|subha|subh|suba|savere|sawere|savera|sawera|dopahar|dopehar|dupahar|dopaher|dophar|dopahr|duphar|sham|shaam|raat|raath|सुबह|सवेरे|सवेरा|दोपहर|शाम|रात"
// Only safe right next to "baje": "9 baje night", but not "rat poison 9" or "10 morning pages"
private let H_PART_ANY = "\(H_PART_HI)|morning|mrng|evening|eve|night|nite|afternoon|noon|rat"
private let H_LINK_BEFORE = "(?:ko|ke|ki|mein|me|mai|main|को|के|की|में)"
private let H_LINK_AFTER = "(?:\\s+(?:ko|mein|me|mai|main|को|में))?"
private let H_MINUTES = "(?:[:.](?<min>[0-5][0-9]))?"
// "din mein 2 baje" is daytime, but "2 din mein" means in two days
private let H_BEFORE_BAJE = "(?:(?<pb>\(H_PART_ANY))(?:\\s+\\k<pb>)?\\s*(?:\(H_LINK_BEFORE)\\s+)?|(?<![0-9\\u0966-\\u096f]\\s)(?<db>din|दिन)\\s+(?:mein|me|ke|में|के)\\s+)?"
private let H_AFTER_BAJE = "(?:\\s+(?<pa>\(H_PART_ANY))\(H_LINK_AFTER)|\\s+(?<da>din|दिन)\\s+(?:mein|me|में))?"
private let H_HALF = "\\u0922\\u093c|\\u095d" // ढ़ arrives in either of two Unicode spellings
private let H_QUARTERS = "(saade|sade|saadhe|sadhe|सा(?:\(H_HALF))े|sawa|sava|सवा|paune|pone|पौने)"
private let H_WHOLE_HALF = "(dedh|deadh|डे(?:\(H_HALF))|dhai|dhaai|ढाई)"
private let H_PART_KIND: [String: String] = [
    "subah": "am", "subha": "am", "subh": "am", "suba": "am", "savere": "am", "sawere": "am", "savera": "am", "sawera": "am",
    "सुबह": "am", "सवेरे": "am", "सवेरा": "am", "morning": "am", "mrng": "am", "breakfast": "am", "nashta": "am", "नाश्ता": "am",
    "dopahar": "noon", "dopehar": "noon", "dupahar": "noon", "dopaher": "noon", "dophar": "noon", "dopahr": "noon", "duphar": "noon",
    "दोपहर": "noon", "din": "noon", "दिन": "noon", "afternoon": "noon", "noon": "noon", "lunch": "noon",
    "sham": "pm", "shaam": "pm", "शाम": "pm", "evening": "pm", "eve": "pm", "dinner": "pm",
    "raat": "night", "raath": "night", "rat": "night", "रात": "night", "night": "night", "nite": "night",
]
// Order matters: it is the regex alternation order, the same as the web app's
private let H_DOW_KEYS: [(String, Int)] = [
    ("somvar", 1), ("somwar", 1), ("सोमवार", 1),
    ("mangalvar", 2), ("mangalwar", 2), ("मंगलवार", 2),
    ("budhvar", 3), ("budhwar", 3), ("बुधवार", 3),
    ("guruvar", 4), ("guruwar", 4), ("veervar", 4), ("brihaspativar", 4), ("गुरुवार", 4), ("वीरवार", 4), ("बृहस्पतिवार", 4),
    ("shukravar", 5), ("shukrawar", 5), ("शुक्रवार", 5),
    ("shanivar", 6), ("shaniwar", 6), ("शनिवार", 6),
    ("ravivar", 0), ("raviwar", 0), ("itwar", 0), ("itvar", 0), ("रविवार", 0), ("इतवार", 0),
]
private let H_DOW = Dictionary(uniqueKeysWithValues: H_DOW_KEYS)
private let H_DOW_RE = "(" + H_DOW_KEYS.map { $0.0 }.joined(separator: "|") + ")"
private let H_EN_DOW_FULL = "(monday|tuesday|wednesday|thursday|friday|saturday|sunday)"
private let H_AFTER_DAY = "(?:\\s+(?:ko|tak|ka|ki|को|तक|का|की))?"
private let H_NEXT_WORD = "(?:agle|agla|next|अगले|अगला)"
private let H_WEEK_WORDS = "hafte|hafta|week|हफ्ते|हफ़्ते|हफ्ता|हफ़्ता"
private let H_WEEK_WORD = "(?:\(H_WEEK_WORDS))"

/// A match with named groups. Case-insensitive, like the web app's /…/i.
private struct HMatch {
    let r: NSTextCheckingResult
    let s: NSString
    var range: NSRange { r.range }
    func g(_ name: String) -> String? {
        let x = r.range(withName: name)
        return x.location == NSNotFound ? nil : s.substring(with: x)
    }
    func g(_ i: Int) -> String? {
        guard i < r.numberOfRanges else { return nil }
        let x = r.range(at: i)
        return x.location == NSNotFound ? nil : s.substring(with: x)
    }
}

private final class HRx: @unchecked Sendable {
    static let shared = HRx()
    private var cache: [String: NSRegularExpression] = [:]
    private let lock = NSLock()
    func match(_ pattern: String, _ s: NSString) -> HMatch? {
        lock.lock()
        let re: NSRegularExpression
        if let hit = cache[pattern] { re = hit } else {
            re = try! NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
            cache[pattern] = re
        }
        lock.unlock()
        guard let m = re.firstMatch(in: s as String, range: NSRange(location: 0, length: s.length)) else { return nil }
        return HMatch(r: m, s: s)
    }
}

private func hFind(_ p: String, _ s: NSString) -> HMatch? { HRx.shared.match(p, s) }
private func hTest(_ p: String, _ s: String) -> Bool { HRx.shared.match(p, s as NSString) != nil }

private func toNum(_ x: String) -> Int {
    var out = ""
    for u in x.unicodeScalars {
        if (0x0966...0x096F).contains(u.value) { out += String(u.value - 0x0966) } else { out.unicodeScalars.append(u) }
    }
    return Int(out) ?? 0
}

/// With no part of the day, the hour people usually mean: 1 to 6 is the
/// afternoon or evening, 7 to 11 the morning.
private func spokenHour(_ h: Int, _ kind: String?) -> Int {
    if h == 0 || h > 12 { return h }
    switch kind {
    case "am": return h
    case "pm": return h == 12 ? 12 : h + 12
    case "noon": return h == 12 ? 12 : h <= 5 ? h + 12 : h
    case "night": return h == 12 ? 0 : h <= 4 ? h : h + 12
    default: return h == 12 ? 12 : h <= 6 ? h + 12 : h
    }
}

private func clock(_ h: Int, _ m: Int) -> String { String(format: "%02d:%02d", h, m) }
private func cut(_ s: NSString, _ r: NSRange) -> NSString { s.replacingCharacters(in: r, with: " ") as NSString }

/// Reads the time out of s. Returns the text with it removed, and the time.
private func hinglishTime(_ s: NSString) -> (rest: NSString, time: String)? {
    func kindOf(_ p: String?) -> String? { H_PART_KIND[(p ?? "").lowercased()] }
    func done(_ m: HMatch, _ hour: Int, _ minute: Int, _ kindIn: String?, _ meridiem: String?) -> (rest: NSString, time: String) {
        var rest = cut(s, m.range)
        var kind = kindIn
        if kind == nil && meridiem == nil && hour >= 1 && hour <= 12 {
            // The part of the day can be further away: "raat ko mummy ko 9 baje call".
            // It leaves the title only if it's plainly about the time, so "raat ka khana" stays.
            let far = hFind("\\s(\(H_PART_HI))(\\s+(?:ko|mein|me|mai|main|को|में))?(?=\\s)", rest)
            let hint = hFind("\\s(morning|evening|night|afternoon|breakfast|nashta|नाश्ता|lunch|dinner)(?=\\s)", rest)
            if let far {
                kind = kindOf(far.g(1))
                let end = far.range.location + far.range.length
                let after = rest.substring(from: end)
                if far.g(2) != nil || after.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    rest = (rest.substring(to: far.range.location) + " " + after) as NSString
                }
            } else if let hint { kind = kindOf(hint.g(1)) }
        }
        let h = meridiem.map { (hour % 12) + ($0.lowercased() == "pm" ? 12 : 0) } ?? spokenHour(hour, kind)
        return (rest, clock(h, minute))
    }

    // 9 baje raat · raat ke 9 baje · sham saade 6 baje · 9.30 baje raat ko · din mein 2 baje · 14 baje
    if let m = hFind("\\s(?:at\\s+)?\(H_BEFORE_BAJE)(?:(?<q>\(H_QUARTERS))\\s+)?(?<n>\(H_NUM))\(H_MINUTES)\\s*\(H_BAJE)(?:\\s*(?<mer>am|pm))?\(H_KO)\(H_AFTER_BAJE)\(H_END)", s) {
        let n = toNum(m.g("n")!)
        let q = (m.g("q") ?? "").lowercased()
        if n <= 23 && (q.isEmpty || (n >= 1 && n <= 12)) {
            let kind = kindOf(m.g("pb") ?? m.g("db") ?? m.g("pa") ?? m.g("da"))
            let mer = m.g("mer")
            if hTest("^(sawa|sava|सवा)", q) { return done(m, n, 15, kind, mer) }
            if hTest("^(sa|सा)", q) { return done(m, n, 30, kind, mer) }
            if !q.isEmpty { return done(m, n == 1 ? 12 : n - 1, 45, kind, mer) }
            return done(m, n, m.g("min").flatMap { Int($0) } ?? 0, kind, mer)
        }
    }
    // dedh baje raat (1:30) · sham dhai baje (2:30)
    if let m = hFind("\\s(?:at\\s+)?\(H_BEFORE_BAJE)(?<half>\(H_WHOLE_HALF))\\s*\(H_BAJE)\(H_KO)\(H_AFTER_BAJE)\(H_END)", s) {
        let one = hTest("^(de|डे)", m.g("half")!)
        return done(m, one ? 1 : 2, 30, kindOf(m.g("pb") ?? m.g("db") ?? m.g("pa") ?? m.g("da")), nil)
    }
    // With a part of the day, "baje" is optional: subah 7 · raat ko 9 · sham 6.30 · raat 9pm
    if let m = hFind("\\s(?<pb>\(H_PART_HI))(?:\\s+\\k<pb>)?\\s+(?:\(H_LINK_BEFORE)\\s+)?(?<n>\(H_NUM))\(H_MINUTES)\\s*(?<mer>am|pm)?\(H_END)", s),
       (1...12).contains(toNum(m.g("n")!)) {
        return done(m, toNum(m.g("n")!), m.g("min").flatMap { Int($0) } ?? 0, kindOf(m.g("pb")), m.g("mer"))
    }
    // ...and it can come after: 9 raat ko · 6:30 sham · 9pm raat
    if let m = hFind("\\s(?<n>\(H_NUM))\(H_MINUTES)\\s*(?<mer>am|pm)?\\s+(?<pa>\(H_PART_HI))\(H_LINK_AFTER)\(H_END)", s),
       (1...12).contains(toNum(m.g("n")!)) {
        return done(m, toNum(m.g("n")!), m.g("min").flatMap { Int($0) } ?? 0, kindOf(m.g("pa")), m.g("mer"))
    }
    return nil
}

private func nextMonthStr() -> String {
    let d = Clock.now
    let first = makeDate(d.year, d.month0 + 1, 1)
    let last = makeDate(first.year, first.month0 + 1, 0).dayOfMonth
    return toDateStr(makeDate(first.year, first.month0, min(d.dayOfMonth, last)))
}

private func upcomingWeekday(_ target: Int, _ next: Bool) -> String {
    var off = (target - Clock.now.dow + 7) % 7
    if off == 0 { off = 7 } // a weekday name means the upcoming one, not today
    if next && off < 7 { off += 7 } // "next monday" → a full week out
    return addDaysStr(off)
}

private func hinglishDate(_ s: NSString) -> (range: NSRange, due: String)? {
    let f = { (p: String) in hFind(p, s) }
    // aaj · aaj raat · aaj tak · aaj ki
    if let m = f("\\s(?:aaj|आज)(?:\\s+(?:raat|रात)\(H_KO))?\(H_AFTER_DAY)\(H_END)") { return (m.range, todayStr()) }
    // kal · kal tak · kal ki (but "kal wala" points back at yesterday)
    if let m = f("\\s(?:kal|कल)(?!\\s+(?:wala|wali|wale|वाला|वाली|वाले)\\s)\(H_AFTER_DAY)\(H_END)") { return (m.range, addDaysStr(1)) }
    if let m = f("\\s(?:parso|parson|परसों|परसो)\(H_AFTER_DAY)\(H_END)") { return (m.range, addDaysStr(2)) }
    if let m = f("\\s(?:narso|narson|नरसों|नरसो)\(H_AFTER_DAY)\(H_END)") { return (m.range, addDaysStr(3)) }
    // agle hafte · agle week · next hafte
    if let m = f("\\s\(H_NEXT_WORD)\\s+\(H_WEEK_WORD)(?:\\s+(?:ko|tak|mein|me|को|तक|में))?\(H_END)") { return (m.range, addDaysStr(7)) }
    // agle mahine · agle month · next mahine
    if let m = f("\\s\(H_NEXT_WORD)\\s+(?:mahine|mahina|month|महीने|महीना)(?:\\s+(?:ko|tak|mein|me|को|तक|में))?\(H_END)") { return (m.range, nextMonthStr()) }
    // 3 din baad · 2 din mein · 2 hafte baad
    if let m = f("\\s\(H_NUM)\\s+(din|dino|dinon|\(H_WEEK_WORDS)|weeks|hafton|दिन|दिनों|हफ्तों)\\s+(?:baad|bad|mein|me|mai|बाद|में)\(H_END)") {
        let weeks = hTest("^(h|w|ह)", m.g(2)!)
        return (m.range, addDaysStr(min(365, toNum(m.g(1)!) * (weeks ? 7 : 1))))
    }
    // is weekend · weekend pe
    if let m = f("\\sis\\s+weekend\(H_AFTER_DAY)\(H_END)") ?? f("\\sweekend\\s+(?:ko|par|pe|tak)\(H_END)") {
        return (m.range, addDaysStr((6 - Clock.now.dow + 7) % 7))
    }
    // agle shukravar · is friday · agle friday ko
    if let m = f("\\s(\(H_NEXT_WORD)|is|इस)\\s+(?:\(H_EN_DOW_FULL)|\(H_DOW_RE))\(H_AFTER_DAY)\(H_END)") {
        let target = m.g(2).map { DOW[String($0.prefix(3)).lowercased()]! } ?? H_DOW[m.g(3)!.lowercased()]!
        return (m.range, upcomingWeekday(target, !hTest("^(is|इस)$", m.g(1)!)))
    }
    // shukravar anywhere (the word can't be anything else) · friday ko anywhere
    if let m = f("\\s\(H_DOW_RE)\(H_AFTER_DAY)\(H_END)") { return (m.range, upcomingWeekday(H_DOW[m.g(1)!.lowercased()]!, false)) }
    if let m = f("\\s\(H_EN_DOW_FULL)\\s+(?:ko|tak|को|तक)\(H_END)") { return (m.range, upcomingWeekday(DOW[String(m.g(1)!.prefix(3)).lowercased()]!, false)) }
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

    // time: 6 baje, sham 5 baje, 5pm, 7:30 am, at 14:00, noon, midnight
    if let spoken = hinglishTime(s) {
        res.time = spoken.time
        s = spoken.rest
    } else if let m = find("\\s(?:at\\s+)?(1[0-2]|0?[1-9])(?::([0-5]\\d))?\\s*(am|pm)\\b") {
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
        if let spoken = hinglishDate(s) { res.due = spoken.due; s = cut(s, spoken.range); return }
        if let m = find("\\s(today|tonight)\\b") { res.due = todayStr(); remove(m); return }
        if let m = find("\\s(?:the\\s+)?(day after tomorrow|overmorrow)\\b") { res.due = addDaysStr(2); remove(m); return }
        if let m = find("\\s(tomorrow|tmrw|tmr)\\b") { res.due = addDaysStr(1); remove(m); return }
        if let m = find("\\snext week\\b") { res.due = addDaysStr(7); remove(m); return }
        if let m = find("\\snext month\\b") { res.due = nextMonthStr(); remove(m); return }
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
            res.due = upcomingWeekday(DOW[String(m[2]!.prefix(3)).lowercased()]!, (m[1] ?? "").lowercased().contains("next"))
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
