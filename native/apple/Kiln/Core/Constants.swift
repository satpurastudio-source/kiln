import Foundation

func uid() -> String {
    let chars = Array("abcdefghijklmnopqrstuvwxyz0123456789")
    let head = String((0..<7).map { _ in chars.randomElement()! })
    return head + String(Int(Clock.ms), radix: 36)
}

let priorityRank = ["high": 0, "medium": 1, "low": 2, "none": 3]
let PRIORITIES: [(id: String, color: String)] = [("high", "#c43d2b"), ("medium", "#d98e32"), ("low", "#5f7c8a"), ("none", "transparent")]
let priorityColors = Dictionary(uniqueKeysWithValues: PRIORITIES.map { ($0.id, $0.color) })
let REPEATS = ["none", "daily", "weekly", "monthly"]
let PROJECT_COLORS = ["#d85a30", "#d9a441", "#7c8a4d", "#6f9b7a", "#5f7c8a", "#8a5a7c", "#a03c1c", "#b0a18c"]
let PROJECT_ICONS = ["✦", "◆", "❋", "●", "▲", "✚", "✳", "✶", "☾", "⬡"]
let HABIT_COLORS = ["#d85a30", "#d9a441", "#6f9b7a", "#5f7c8a", "#8a5a7c", "#7c8a4d"]
/// U+FE0E forces text (non-emoji) presentation of an otherwise ambiguous glyph.
func iconGlyph(_ g: String) -> String { g + "\u{FE0E}" }

struct Accent { let id: String, accent: String, accent2: String, deep: String }

let ACCENTS = [
    Accent(id: "terracotta", accent: "#d85a30", accent2: "#ea6840", deep: "#c24a24"),
    Accent(id: "ember", accent: "#c43d2b", accent2: "#e0553f", deep: "#a8331f"),
    Accent(id: "amber", accent: "#c98a1e", accent2: "#dda23a", deep: "#a8720f"),
    Accent(id: "sage", accent: "#6f9b7a", accent2: "#84b28f", deep: "#588364"),
    Accent(id: "ocean", accent: "#5f7c8a", accent2: "#74929f", deep: "#4c6570"),
    Accent(id: "plum", accent: "#8a5a7c", accent2: "#a06f92", deep: "#704764"),
]

func hexRGB(_ hex: String) -> (Int, Int, Int) {
    var h = hex.replacingOccurrences(of: "#", with: "")
    if h.count == 3 { h = h.map { "\($0)\($0)" }.joined() }
    let c = Array(h)
    func part(_ i: Int) -> Int { i + 2 <= c.count ? Int(String(c[i..<i + 2]), radix: 16) ?? 0 : 0 }
    return (part(0), part(2), part(4))
}

/// amt > 0 lightens toward white, amt < 0 darkens toward black.
private func shadeHex(_ hex: String, _ amt: Double) -> String {
    let (r, g, b) = hexRGB(hex)
    let target = amt < 0 ? 0.0 : 255.0
    let p = abs(amt)
    func mix(_ c: Int) -> Int { max(0, min(255, Int(((target - Double(c)) * p + Double(c)).rounded(.toNearestOrAwayFromZero)))) }
    return String(format: "#%02x%02x%02x", mix(r), mix(g), mix(b))
}

func deriveAccent(_ hex: String) -> Accent {
    Accent(id: "custom", accent: hex, accent2: shadeHex(hex, 0.16), deep: shadeHex(hex, -0.18))
}

func resolveAccent(_ settings: Item) -> Accent {
    if settings["accent"]?.string == "custom", let c = settings["customAccent"]?.string, !c.isEmpty { return deriveAccent(c) }
    return ACCENTS.first { $0.id == settings["accent"]?.string } ?? ACCENTS[0]
}

let DEFAULT_SETTINGS: Item = [
    "accent": "terracotta",
    "customAccent": "#d85a30",
    "defaultDue": "today",
    "defaultPriority": "none",
    "defaultTime": "",
    "reducedEffects": false,
    "textScale": 1,
    "focusWork": 25,
    "focusBreak": 5,
    "ambient": .obj([:]),
]

let TEXT_SCALE = (min: 0.9, max: 1.4, step: 0.05)

/// Every ambient-mode knob. Saved settings only hold what the user changed.
let AMBIENT_DEFAULTS: Item = [
    "theme": "app", "side": "left", "clockSize": 480, "clockFace": "classic", "seconds": "sweep",
    "showDigital": true, "showDate": true, "showGreeting": true, "showProgress": true, "quickAdd": true,
    "widget1": "streak", "widget2": "focus", "columns": "both", "rowSize": 22, "maxRows": 10,
    "padding": 56, "gap": 96, "radius": 18, "glow": 100, "showEmber": true, "emberSize": 128,
    "emberCorner": "right", "emberEyes": true, "night": "off", "nightStart": 23, "nightEnd": 6,
    "nightLevel": 55, "drift": 12,
]

struct Purpose { let id: String, name: String, color: String, icon: String }
let PURPOSES = [
    Purpose(id: "work", name: "Work", color: "#5f7c8a", icon: "◆"),
    Purpose(id: "study", name: "Study", color: "#8a5a7c", icon: "❋"),
    Purpose(id: "personal", name: "Personal", color: "#7c8a4d", icon: "●"),
    Purpose(id: "fitness", name: "Fitness", color: "#6f9b7a", icon: "▲"),
    Purpose(id: "side", name: "Side Project", color: "#d9a441", icon: "✳"),
    Purpose(id: "errands", name: "Errands", color: "#b0a18c", icon: "✚"),
]

/// What's new: newest first (src/changelog.js).
let CHANGELOG: [(id: String, items: Int)] = [("2026-10-25", 4), ("2026-10-24", 4)]

let SEED_TEXT: [String: String] = [
    "Getting Started": "seedFolderStart",
    "Work": "p_work",
    "Personal": "p_personal",
    "Study": "p_study",
    "Fitness": "p_fitness",
    "Side Project": "p_side",
    "Errands": "p_errands",
    "Tap the circle to complete me — watch what happens ✨": "seedTask1",
    "Drag the ⋮⋮ grip to reorder me": "seedTask2",
    "Tap me to edit notes, dates, time & priority": "seedTask3",
    "Everything is editable inline. Try moving me to another folder.": "seedTask3Notes",
    "Add a task using the bar above": "seedTask4",
    "Explore Calendar, Focus & the ⚙ Settings menu": "seedTask5",
    "Finish every task in a folder for a surprise 🎉": "seedTask6",
]

let TRASH_TTL = 30.0 * 24 * 60 * 60 * 1000
