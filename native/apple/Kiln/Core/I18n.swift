import Foundation
import Observation

struct Language: Identifiable { let code: String, name: String, native: String; var id: String { code } }

let LANGUAGES = [
    Language(code: "en", name: "English", native: "English"),
    Language(code: "hi", name: "Hindi", native: "हिन्दी"),
    Language(code: "mr", name: "Marathi", native: "मराठी"),
    Language(code: "gu", name: "Gujarati", native: "ગુજરાતી"),
    Language(code: "bn", name: "Bengali", native: "বাংলা"),
    Language(code: "ta", name: "Tamil", native: "தமிழ்"),
    Language(code: "te", name: "Telugu", native: "తెలుగు"),
    Language(code: "kn", name: "Kannada", native: "ಕನ್ನಡ"),
    Language(code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ"),
    Language(code: "ml", name: "Malayalam", native: "മലയാളം"),
    Language(code: "or", name: "Odia", native: "ଓଡ଼ିଆ"),
    Language(code: "ur", name: "Urdu", native: "اردو"),
]

/// Same words as the web app: Resources/locales/*.json is generated from src/locales.
/// Observed: anything showing words redraws in place when this changes.
@Observable
final class LanguageState: @unchecked Sendable {
    var lang = "en"
}

enum I18n {
    private static let state = LanguageState()
    nonisolated(unsafe) private static var dicts: [String: [String: String]] = [:]
    static var lang: String {
        get { state.lang }
        set { state.lang = newValue }
    }
    nonisolated(unsafe) static var bundle: Bundle = .main

    private static func dict(_ code: String) -> [String: String] {
        if let d = dicts[code] { return d }
        let url = bundle.url(forResource: code, withExtension: "json", subdirectory: "locales")
            ?? bundle.url(forResource: code, withExtension: "json")
        let d = url.flatMap { try? Data(contentsOf: $0) }
            .flatMap { try? JSONDecoder().decode([String: String].self, from: $0) } ?? [:]
        dicts[code] = d
        return d
    }

    /// Nothing picked yet → the phone's language if we speak it, else English.
    static func resolve(_ picked: String?, preferred: [String] = Locale.preferredLanguages) -> String {
        let known = Set(LANGUAGES.map(\.code))
        if let picked, known.contains(picked) { return picked }
        for tag in preferred {
            let c = String(tag.prefix(2)).lowercased()
            if known.contains(c) { return c }
        }
        return "en"
    }

    static func t(_ key: String, _ vars: [String: String] = [:]) -> String {
        var s = dict(lang)[key] ?? dict("en")[key] ?? key
        for (k, v) in vars { s = s.replacingOccurrences(of: "{\(k)}", with: v) }
        return s
    }

    static func tn(_ key: String, _ n: Int, _ vars: [String: String] = [:]) -> String {
        var v = vars
        v["n"] = fmtNum(n)
        return t(n == 1 ? "\(key)_one" : "\(key)_other", v)
    }

    /// English stays en-US; the rest use the Indian locale of that language.
    static var locale: Locale { Locale(identifier: lang == "en" ? "en_US" : "\(lang)_IN") }
}

func t(_ key: String, _ vars: [String: String] = [:]) -> String { I18n.t(key, vars) }
func tn(_ key: String, _ n: Int, _ vars: [String: String] = [:]) -> String { I18n.tn(key, n, vars) }

func fmtNum(_ n: Int) -> String {
    if I18n.lang == "en" { return String(n) }
    let f = NumberFormatter()
    f.locale = I18n.locale
    return f.string(from: NSNumber(value: n)) ?? String(n)
}

/// `template` is a CLDR skeleton: "EEEE", "MMMd", "EEEEMMMMd", "EEEMMMd", "MMMM", "EEEEE".
func fmtDate(_ d: Date, _ template: String) -> String {
    let f = DateFormatter()
    f.locale = I18n.locale
    f.setLocalizedDateFormatFromTemplate(template)
    return f.string(from: d)
}

func fmtDue(_ due: String?) -> String {
    guard let due, !due.isEmpty else { return "" }
    if isToday(due) { return t("today") }
    if isTomorrow(due) { return t("tomorrow") }
    let d = parseDateStr(due)
    // within the next 6 days → weekday name
    if !isOverdue(due), (2...6).contains(where: { due == addDaysStr($0) }) { return fmtDate(d, "EEEE") }
    return fmtDate(d, "MMMd")
}

func fmtLongDate(_ d: Date = Clock.now) -> String { fmtDate(d, "EEEEMMMMd") }

func greeting() -> String {
    let h = Clock.now.hour
    if h < 5 { return t("greetLate") }
    if h < 12 { return t("greetMorning") }
    if h < 17 { return t("greetAfternoon") }
    if h < 22 { return t("greetEvening") }
    return t("greetWinding")
}

/// 'HH:MM' (24h) → friendly 12h label, e.g. '14:30' → '2:30 PM'.
func fmtTime(_ hhmm: String?) -> String {
    guard let hhmm, hhmm.range(of: "^\\d{1,2}:\\d{2}$", options: .regularExpression) != nil else { return "" }
    let p = hhmm.split(separator: ":").map { Int($0)! }
    let (h, m) = (p[0], p[1])
    if I18n.lang != "en" {
        let f = DateFormatter()
        f.locale = I18n.locale
        f.setLocalizedDateFormatFromTemplate("jmm")
        return f.string(from: makeDate(2000, 0, 1, h, m))
    }
    return "\(h % 12 == 0 ? 12 : h % 12):\(String(format: "%02d", m)) \(h < 12 ? "AM" : "PM")"
}

func fmtHour(_ h: Int) -> String {
    let f = DateFormatter()
    f.locale = I18n.locale
    f.setLocalizedDateFormatFromTemplate("j")
    return f.string(from: makeDate(2000, 0, 1, h))
}
