import SwiftUI
#if os(iOS)
import UIKit
#endif

private extension Item {
    func num(_ k: String) -> Double { self[k]?.number ?? 0 }
    func int(_ k: String) -> Int { Int(num(k)) }
    func str(_ k: String) -> String { self[k]?.string ?? "" }
    func flag(_ k: String) -> Bool { self[k]?.boolean ?? false }
}

/// A calm always-on screen: clock, today's board, and Ember.
struct AmbientView: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var baseTok
    @Environment(\.colorScheme) private var scheme
    var customize: Bool
    var onExit: () -> Void
    @State private var editing = false
    @State private var adding = false
    @State private var controls = false
    @State private var hideTask: Task<Void, Never>?
    @State private var tab = "todo"
    @State private var drift = CGSize.zero
    @State private var now = Clock.now
    @State private var pointer = CGPoint.zero
    #if os(macOS)
    @State private var activity: NSObjectProtocol?
    #endif

    var body: some View {
        let s = store.state, cfg = s.ambient
        let night = cfg.str("night") != "off" && isNightHour(now, cfg.int("nightStart"), cfg.int("nightEnd"))
        let forced = night && cfg.str("night") == "dark" ? "dark" : cfg.str("theme") == "app" ? nil : cfg.str("theme")
        var tok = baseTok
        if let forced { tok.dark = forced == "dark" }
        return GeometryReader { g in
            let compact = g.size.width <= 700 || g.size.height <= 500
            let landscape = g.size.width > g.size.height
            ZStack {
                tok.bg.ignoresSafeArea()
                RadialGradient(colors: [tok.accent.opacity(0.14 * cfg.num("glow") / 100), .clear], center: cfg.str("side") == "left" ? .init(x: 0.2, y: 0.5) : .init(x: 0.8, y: 0.5), startRadius: 0, endRadius: max(g.size.width, g.size.height) * 0.6)
                    .ignoresSafeArea()
                Group {
                    if compact { compactLayout(cfg, landscape: landscape, size: g.size) } else { wideLayout(cfg, size: g.size) }
                }
                .offset(drift)
                if !compact && cfg.flag("showEmber") {
                    emberView(cfg, size: cfg.num("emberSize"))
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: cfg.str("emberCorner") == "left" ? .bottomLeading : .bottomTrailing)
                        .padding(20)
                        .offset(drift)
                }
                if night && cfg.str("night") != "off" {
                    Color.black.opacity(1 - cfg.num("nightLevel") / 100).ignoresSafeArea().allowsHitTesting(false)
                }
                if controls || editing { controlsBar(cfg).transition(.opacity) }
                if adding { AmbientQuickAdd { adding = false }.transition(.move(edge: .top).combined(with: .opacity)) }
                if editing {
                    HStack(spacing: 0) {
                        Spacer(minLength: 0)
                        AmbientEditor(cfg: cfg) { editing = false }.frame(maxWidth: min(g.size.width, 400))
                    }
                    .transition(.move(edge: .trailing))
                }
            }
            .environment(\.tok, tok)
            .preferredColorScheme(tok.dark ? .dark : .light)
            .contentShape(Rectangle())
            .onTapGesture { poke() }
            .onContinuousHover { phase in
                poke()
                if case .active(let at) = phase {
                    pointer = CGPoint(x: at.x / max(1, g.size.width) * 2 - 1, y: at.y / max(1, g.size.height) * 2 - 1)
                }
            }
        }
        .animation(.easeOut(duration: 0.2), value: controls)
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: editing)
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: adding)
        .animation(.easeInOut(duration: 3), value: drift)
        .onAppear {
            editing = customize
            setAwake(true)
        }
        .onDisappear {
            setAwake(false)
            hideTask?.cancel()
        }
        .task {
            // the board and Ember's mood only need the minute
            while !Task.isCancelled {
                let ms = 60000 - Double(Int(Clock.ms) % 60000) + 20
                try? await Task.sleep(for: .milliseconds(Int(ms)))
                now = Clock.now
            }
        }
        .task(id: cfg.int("drift")) {
            let amount = store.state.ambient.num("drift")
            guard amount > 0 else {
                drift = .zero
                return
            }
            // burn-in protection: nudge the whole layout a little every 3 minutes
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(180))
                drift = CGSize(width: Double.random(in: 0...amount), height: Double.random(in: 0...amount))
            }
        }
        .background { shortcuts(cfg) }
    }

    private func shortcuts(_ cfg: Item) -> some View {
        ZStack {
            Button("") {
                if adding { adding = false } else if editing { editing = false } else { onExit() }
            }
            .keyboardShortcut(.cancelAction)
            if cfg.flag("quickAdd") && !adding { Button("") { adding = true }.keyboardShortcut("n", modifiers: []) }
        }
        .opacity(0)
        .accessibilityHidden(true)
    }

    private func setAwake(_ on: Bool) {
        #if os(iOS)
        UIApplication.shared.isIdleTimerDisabled = on
        #else
        if on { activity = ProcessInfo.processInfo.beginActivity(options: [.idleDisplaySleepDisabled], reason: "Ambient mode") }
        else if let a = activity { ProcessInfo.processInfo.endActivity(a) }
        #endif
    }

    private func poke() {
        controls = true
        hideTask?.cancel()
        hideTask = Task {
            try? await Task.sleep(for: .milliseconds(2600))
            if !Task.isCancelled { controls = false }
        }
    }

    private func controlsBar(_ cfg: Item) -> some View {
        let tok = effectiveTok(cfg)
        return HStack(spacing: 6) {
            if cfg.flag("quickAdd") { ctl("plus", t("addTask"), on: adding, tok) { adding.toggle() } }
            ctl("gearshape", t("customizeAmbient"), on: editing, tok) { editing.toggle() }
            ctl("xmark", t("exitAmbient"), on: false, tok, onExit)
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
    }

    private func effectiveTok(_ cfg: Item) -> Tok {
        var tok = baseTok
        if cfg.str("theme") != "app" { tok.dark = cfg.str("theme") == "dark" }
        return tok
    }

    private func ctl(_ symbol: String, _ label: String, on: Bool, _ tok: Tok, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 14, weight: .medium)).foregroundStyle(on ? .white : tok.text2)
                .frame(width: 38, height: 38)
                .background(on ? tok.accent : tok.raise.opacity(0.85), in: Circle())
                .overlay(Circle().stroke(tok.border))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private func emberView(_ cfg: Item, size: Double) -> some View {
        let s = store.state
        let overdue = s.tasks.filter { !$0.done && !$0.archived && isOverdue($0.due) }.count
        return EmberView(mood: s.emberMood(focus: store.focus, now: now), streak: s.insights.streak, overdue: overdue, reduced: s.reducedEffects, size: size, look: cfg.flag("emberEyes") && !s.reducedEffects ? pointer : .zero)
    }

    private func wideLayout(_ cfg: Item, size: CGSize) -> some View {
        let pad = cfg.num("padding"), gap = cfg.num("gap")
        let clock = min(cfg.num("clockSize"), min(size.width * 0.42, size.height - pad * 2 - 170))
        // too narrow to sit side by side without squeezing the tasks (a tablet held upright)
        if size.width < 1000 {
            return AnyView(VStack(spacing: min(gap, 40)) {
                left(cfg, clock: max(160, min(cfg.num("clockSize"), min(size.width * 0.5, size.height * 0.36))))
                right(cfg, compact: false, rows: cfg.int("maxRows"))
                Spacer(minLength: 0)
            }
            .padding(pad)
            .frame(maxWidth: .infinity, maxHeight: .infinity))
        }
        return AnyView(HStack(alignment: .center, spacing: gap) {
            if cfg.str("side") == "left" {
                left(cfg, clock: max(160, clock))
                right(cfg, compact: false, rows: cfg.int("maxRows"))
            } else {
                right(cfg, compact: false, rows: cfg.int("maxRows"))
                left(cfg, clock: max(160, clock))
            }
        }
        .padding(pad)
        .frame(maxWidth: .infinity, maxHeight: .infinity))
    }

    private func compactLayout(_ cfg: Item, landscape: Bool, size: CGSize) -> some View {
        let rowH = cfg.num("rowSize") + 24
        if landscape {
            let clock = max(120, min(size.height - 90, size.width * 0.34))
            let fit = max(1, Int((size.height - 150) / rowH))
            return AnyView(HStack(spacing: 18) {
                left(cfg, clock: clock, widgets: false)
                right(cfg, compact: true, rows: min(cfg.int("maxRows"), fit))
            }.padding(14))
        }
        let clock = min(size.width - 110, size.height * 0.28)
        let fit = max(1, Int((size.height - clock - 300) / rowH))
        return AnyView(VStack(spacing: 14) {
            left(cfg, clock: max(120, clock), widgets: true)
            right(cfg, compact: true, rows: min(cfg.int("maxRows"), fit))
        }.padding(16))
    }

    private func left(_ cfg: Item, clock: Double, widgets: Bool = true) -> some View {
        let tok = effectiveTok(cfg)
        return VStack(spacing: 14) {
            AnalogClock(face: cfg.str("clockFace"), seconds: cfg.str("seconds"), still: store.state.reducedEffects, tok: tok).frame(width: clock, height: clock)
            if cfg.flag("showDate") || cfg.flag("showDigital") {
                HStack(spacing: 10) {
                    if cfg.flag("showDate") { Text(dateLabel(now)).font(tok.mono(14, medium: true)).foregroundStyle(tok.text2) }
                    if cfg.flag("showDigital") { Text(String(format: "%02d:%02d", now.hour, now.minute)).font(tok.mono(14)).foregroundStyle(tok.accent) }
                }
            }
            if widgets {
                HStack(spacing: 10) {
                    widget(cfg.str("widget1"), tok)
                    widget(cfg.str("widget2"), tok)
                }
            }
        }
    }

    private func dateLabel(_ d: Date) -> String {
        if I18n.lang != "en" { return fmtDate(d, "EEEdMMM") }
        let wd = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"], mo = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
        return "\(wd[d.dow]) \(String(format: "%02d", d.dayOfMonth)) \(mo[d.month0])"
    }

    /// A widget with nothing worth showing stays hidden: an idle box is just noise.
    @ViewBuilder private func widget(_ kind: String, _ tok: Tok) -> some View {
        let s = store.state
        switch kind {
        case "streak":
            let streak = s.insights.streak
            if streak > 0 {
                card(t("ambStreak"), tok) {
                    FlameShape().stroke(tok.accent, lineWidth: 1.8).frame(width: 22, height: 22)
                    Text(tn("days", streak)).font(tok.ui(16, .semibold)).foregroundStyle(tok.text)
                }
            }
        case "progress":
            card(t("ambToday"), tok) {
                ProgressRing(size: 34, stroke: 4, pct: Double(s.todayProgress.pct))
                Text("\(s.todayProgress.pct)%").font(tok.ui(16, .semibold)).foregroundStyle(tok.text)
            }
        case "focus":
            if let f = store.focus {
                let work = f.phase == "work"
                let m = focusDurations(f.mode, s.settings)
                let dur = Double(work ? m.work : (f.count % 4 == 0 && f.count > 0 ? m.brk * 3 : m.brk))
                card(work ? t("ambFocus") : t("ambBreak"), tok) {
                    TimelineView(.periodic(from: .now, by: 1)) { _ in
                        HStack(spacing: 8) {
                            ProgressRing(size: 34, stroke: 4, pct: min(100, max(0, store.focusSecondsLeft / dur * 100)), color: work ? tok.accent : Color(hex: "#7c8a4d"))
                            VStack(alignment: .leading, spacing: 0) {
                                Text(fmtClock(store.focusSecondsLeft)).font(tok.mono(15, medium: true)).foregroundStyle(tok.text).monospacedDigit()
                                Text(s.tasks.first { $0.id == f.taskId }?.title ?? t("focusSession")).font(tok.ui(11.5)).foregroundStyle(tok.text3).lineLimit(1)
                            }
                        }
                    }
                }
            }
        default: EmptyView()
        }
    }

    private func card<Content: View>(_ label: String, _ tok: Tok, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased()).font(tok.mono(10.5, medium: true)).tracking(1.2).foregroundStyle(tok.text3)
            HStack(spacing: 8) { content() }
        }
        .padding(12)
        .background(tok.panel, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(tok.border))
    }

    private func right(_ cfg: Item, compact: Bool, rows: Int) -> some View {
        let s = store.state, tok = effectiveTok(cfg)
        let active = s.tasks.filter { !$0.done && !$0.archived && (isToday($0.due) || isOverdue($0.due)) }.stableSorted(todaySort)
        let done = s.tasks.filter { $0.done && !$0.archived && ($0.doneAt.map { sameDay($0, now) } ?? false) }.sorted { ($0.doneAt ?? 0) > ($1.doneAt ?? 0) }
        let p = s.todayProgress
        let first = s.profile?["name"]?.string?.split(whereSeparator: \.isWhitespace).first.map(String.init)
        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 9) {
                    if cfg.flag("showGreeting") {
                        (Text(greeting() + (first.map { ", \($0)" } ?? "")).foregroundStyle(tok.text) + Text(".").foregroundStyle(tok.accent)).font(tok.display(compact ? 32 : 44)).tracking(0.8).lineLimit(2).minimumScaleFactor(0.7)
                    }
                    if cfg.flag("showProgress") {
                        HStack(spacing: 10) {
                            GeometryReader { g in
                                ZStack(alignment: .leading) {
                                    Capsule().fill(tok.border)
                                    Capsule().fill(tok.accent).frame(width: g.size.width * Double(p.pct) / 100).animation(.spring(response: 0.9, dampingFraction: 0.8), value: p.pct)
                                }
                            }
                            .frame(height: 5)
                            Text("\(p.done)/\(p.total) · \(p.pct)%").font(tok.mono(12)).foregroundStyle(tok.text3).fixedSize()
                        }
                    }
                }
                if compact && cfg.flag("showEmber") { emberView(cfg, size: min(cfg.num("emberSize"), 52)) }
            }
            if compact {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        tabButton("todo", t("colTodo"), active.count, tok, cfg)
                        if cfg.str("columns") != "todo" { tabButton("done", t("colDone"), done.count, tok, cfg) }
                    }
                    let list = tab == "done" && cfg.str("columns") != "todo" ? done : active
                    column(list, rows: rows, done: tab == "done" && cfg.str("columns") != "todo", cfg: cfg, tok: tok)
                    Spacer(minLength: 0)
                }
            } else {
                HStack(alignment: .top, spacing: 20) {
                    VStack(alignment: .leading, spacing: 8) {
                        colHead(t("colTodo"), active.count, tok.accent, tok)
                        column(active, rows: rows, done: false, cfg: cfg, tok: tok)
                    }
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                    if cfg.str("columns") != "todo" {
                        VStack(alignment: .leading, spacing: 8) {
                            colHead(t("colDone"), done.count, Color(hex: "#6f9b7a"), tok)
                            column(done, rows: rows, done: true, cfg: cfg, tok: tok)
                        }
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func todaySort(_ a: KTask, _ b: KTask) -> Bool {
        let ao = isOverdue(a.due) ? 0 : 1, bo = isOverdue(b.due) ? 0 : 1
        if ao != bo { return ao < bo }
        let at = a.time ?? "99:99", bt = b.time ?? "99:99"
        if at != bt { return at < bt }
        return (priorityRank[a.priority] ?? 3) < (priorityRank[b.priority] ?? 3)
    }

    private func colHead(_ label: String, _ n: Int, _ dot: Color, _ tok: Tok) -> some View {
        HStack(spacing: 7) {
            Circle().fill(dot).frame(width: 7, height: 7)
            Text(label).font(tok.mono(12, medium: true)).foregroundStyle(tok.text2)
            Text(fmtNum(n)).font(tok.mono(12)).foregroundStyle(tok.text3)
        }
    }

    private func tabButton(_ id: String, _ label: String, _ n: Int, _ tok: Tok, _ cfg: Item) -> some View {
        let on = (cfg.str("columns") == "todo" ? "todo" : tab) == id
        return Button { tab = id } label: {
            colHead(label, n, id == "todo" ? tok.accent : Color(hex: "#6f9b7a"), tok)
                .padding(.horizontal, 10)
                .frame(minHeight: 30)
                .background(on ? tok.panelHover : .clear, in: Capsule())
                .overlay(Capsule().stroke(on ? tok.border : .clear))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder private func column(_ list: [KTask], rows: Int, done: Bool, cfg: Item, tok: Tok) -> some View {
        if list.isEmpty {
            Text(done ? t("nothingFinished") : t("ember_sleepy_0")).font(tok.ui(14)).foregroundStyle(tok.text3).padding(.vertical, 10)
        } else {
            ForEach(list.prefix(max(1, rows))) { x in
                HStack(spacing: 6) {
                    CheckCircle(checked: done, color: tok.accent) { store.dispatch { $0.toggleTask(x.id) } }
                    if !done && isOverdue(x.due) { Circle().fill(tok.danger).frame(width: 6, height: 6) }
                    Text(x.title).font(tok.ui(cfg.num("rowSize") * 0.72 / tok.scale, .medium)).foregroundStyle(done ? tok.text3 : tok.text).strikethrough(done).lineLimit(1)
                    Spacer(minLength: 4)
                    if !done, let time = x.time { Text(fmtTime(time)).font(tok.mono(11.5)).foregroundStyle(tok.text3).fixedSize() }
                    if !done && x.priority != "none" {
                        Text(t("prio_\(x.priority)")).font(tok.ui(11, .medium)).foregroundStyle(Color(hex: priorityColors[x.priority] ?? "#5f7c8a")).fixedSize()
                    }
                }
                .padding(.trailing, 10)
                .background(tok.panel, in: RoundedRectangle(cornerRadius: cfg.num("radius")))
                .overlay(RoundedRectangle(cornerRadius: cfg.num("radius")).stroke(tok.border))
            }
            if list.count > rows { Text(t("nMore", ["n": fmtNum(list.count - max(1, rows))])).font(tok.mono(12)).foregroundStyle(tok.text3) }
        }
    }
}

struct AnalogClock: View {
    var face: String
    var seconds: String
    var still: Bool
    var tok: Tok

    var body: some View {
        // sweep draws smoothly but only as often as it shows; tick and off wake once a second or less
        let interval: Double = still ? 60 : seconds == "sweep" ? 1.0 / 30 : seconds == "tick" ? 1 : 15
        TimelineView(.periodic(from: .now, by: interval)) { tl in
            Canvas { ctx, size in
                draw(&ctx, size: size, date: tl.date)
            }
        }
    }

    private func draw(_ ctx: inout GraphicsContext, size: CGSize, date: Date) {
        let k = min(size.width, size.height) / 200
        ctx.scaleBy(x: k, y: k)
        let c = CGPoint(x: 100, y: 100)
        let dial = Path(ellipseIn: CGRect(x: 3, y: 3, width: 194, height: 194))
        ctx.fill(dial, with: .color(tok.dark ? Color.white.opacity(0.03) : Color.white.opacity(0.75)))
        ctx.stroke(dial, with: .color(tok.borderStrong), lineWidth: 1.2)
        for i in 0..<60 {
            let hour = i % 5 == 0, quarter = i % 15 == 0
            if face == "minimal" && !hour { continue }
            if face == "numerals" && quarter { continue }
            var p = Path()
            p.move(to: CGPoint(x: 100, y: quarter ? 10 : hour ? 12 : 14))
            p.addLine(to: CGPoint(x: 100, y: quarter ? 26 : hour ? 23 : 18))
            let rot = CGAffineTransform(translationX: 100, y: 100).rotated(by: Double(i) * .pi / 30).translatedBy(x: -100, y: -100)
            ctx.stroke(p.applying(rot), with: .color(hour ? tok.text2 : tok.text3), style: StrokeStyle(lineWidth: quarter ? 2.4 : hour ? 1.6 : 0.8, lineCap: .round))
        }
        if face == "numerals" {
            for (n, x, y) in [("12", 100.0, 34.0), ("3", 166.0, 100.0), ("6", 100.0, 166.0), ("9", 34.0, 100.0)] {
                ctx.draw(Text(n).font(.custom("BebasNeue-Regular", size: 20)).foregroundColor(tok.text2), at: CGPoint(x: x, y: y))
            }
        }
        let comps = cal.dateComponents([.hour, .minute, .second, .nanosecond], from: date)
        let sec = Double(comps.second ?? 0) + (still ? 0 : Double(comps.nanosecond ?? 0) / 1e9)
        let min = Double(comps.minute ?? 0) + (still ? 0 : sec / 60)
        let hr = Double((comps.hour ?? 0) % 12) + Double(comps.minute ?? 0) / 60
        func hand(_ deg: Double, from: Double, to: Double, width: Double, color: Color) {
            var p = Path()
            p.move(to: CGPoint(x: 100, y: from))
            p.addLine(to: CGPoint(x: 100, y: to))
            let rot = CGAffineTransform(translationX: 100, y: 100).rotated(by: deg * .pi / 180).translatedBy(x: -100, y: -100)
            ctx.stroke(p.applying(rot), with: .color(color), style: StrokeStyle(lineWidth: width, lineCap: .round))
        }
        hand(hr * 30, from: 112, to: 56, width: 6, color: tok.text)
        hand(min * 6, from: 114, to: 28, width: 4, color: tok.text)
        if seconds != "off" {
            let s = seconds == "tick" ? floor(sec) : sec
            hand(s * 6, from: 124, to: 20, width: 1.4, color: tok.accent)
        }
        ctx.fill(Path(ellipseIn: CGRect(x: c.x - 5.5, y: c.y - 5.5, width: 11, height: 11)), with: .color(tok.text))
        ctx.fill(Path(ellipseIn: CGRect(x: c.x - 2, y: c.y - 2, width: 4, height: 4)), with: .color(tok.accent))
    }
}

/// kiln's flame, brought to life. Mood comes from the app's state.
struct EmberView: View {
    @Environment(\.tok) private var tok
    var mood: String
    var streak: Int
    var overdue: Int
    var reduced: Bool
    var size: Double
    /// Where the pointer is, from -1 to 1 on each axis. Only a Mac has one.
    var look: CGPoint = .zero
    @State private var sparkAt: Date?
    @State private var line = ""
    @State private var squash = false
    @State private var blink = false
    @State private var bob = false

    private var scale: Double { 0.85 + Double(min(streak, 14)) * 0.02 }

    var body: some View {
        VStack(spacing: 6) {
            if !line.isEmpty {
                Text(line).font(tok.ui(12.5)).foregroundStyle(tok.text).padding(.horizontal, 11).padding(.vertical, 7)
                    .background(tok.raise, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(tok.border))
                    .frame(maxWidth: 220)
                    .fixedSize(horizontal: false, vertical: true)
                    .transition(.opacity.combined(with: .scale(scale: 0.95, anchor: .bottom)))
            }
            Canvas { ctx, s in draw(&ctx, s) }
                .frame(width: size, height: size)
                .overlay { sparks }
                .scaleEffect(x: (squash ? 1.12 : 1) * scale, y: (squash ? 0.84 : 1) * scale, anchor: .bottom)
                .offset(y: bob && !reduced ? -size * 0.02 : 0)
                .animation(.spring(response: 0.25, dampingFraction: 0.45), value: squash)
                .onTapGesture(perform: poke)
                .accessibilityLabel("Ember")
        }
        .animation(.easeOut(duration: 0.2), value: line)
        .onAppear {
            guard !reduced else { return }
            withAnimation(.easeInOut(duration: 2.6).repeatForever(autoreverses: true)) { bob = true }
        }
        .task(id: mood) {
            guard mood == "idle", !reduced else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(Double.random(in: 5...9)))
                blink = true
                try? await Task.sleep(for: .milliseconds(140))
                blink = false
            }
        }
    }

    /// A short burst when you poke Ember; nothing runs the rest of the time.
    @ViewBuilder private var sparks: some View {
        if let sparkAt, !reduced {
            TimelineView(.animation) { tl in
                Canvas { ctx, s in
                    let p = tl.date.timeIntervalSince(sparkAt) / 0.55
                    guard p < 1 else { return }
                    ctx.opacity = 1 - p
                    let c = CGPoint(x: s.width / 2, y: s.height * 0.55)
                    for i in 0..<7 {
                        let a = Double(i) / 7 * 2 * .pi - .pi / 2
                        let r = s.width * 0.55 * p
                        let d = s.width * 0.05 * (1 - 0.7 * p)
                        ctx.fill(Path(ellipseIn: CGRect(x: c.x + cos(a) * r - d / 2, y: c.y + sin(a) * r - s.height * 0.1 * p - d / 2, width: d, height: d)), with: .color(tok.accent2))
                    }
                }
            }
            .allowsHitTesting(false)
        }
    }

    private func poke() {
        squash = true
        if !reduced {
            sparkAt = Date()
            Task {
                try? await Task.sleep(for: .milliseconds(600))
                sparkAt = nil
            }
        }
        var pool = (0...2).map { t("ember_\(mood)_\($0)") }
        if mood == "worried", overdue > 0 { pool[0] = tn("emberOverdue", overdue) }
        line = pool.randomElement() ?? ""
        Task {
            try? await Task.sleep(for: .milliseconds(180))
            squash = false
            try? await Task.sleep(for: .seconds(3))
            line = ""
        }
    }

    private func draw(_ ctx: inout GraphicsContext, _ s: CGSize) {
        let k = min(s.width, s.height) / 24
        let flame = FlameShape().path(in: CGRect(origin: .zero, size: s))
        ctx.fill(flame, with: .linearGradient(Gradient(colors: [tok.accent2, tok.deep]), startPoint: .zero, endPoint: CGPoint(x: s.width, y: s.height)))
        func ellipse(_ cx: Double, _ cy: Double, _ rx: Double, _ ry: Double) -> Path {
            Path(ellipseIn: CGRect(x: (cx - rx) * k, y: (cy - ry) * k, width: rx * 2 * k, height: ry * 2 * k))
        }
        ctx.fill(ellipse(11, 17.2, 3.4, 2.6), with: .color(.white.opacity(mood == "celebrate" ? 0.32 : 0.14)))
        let eye = Color(hex: "#1d1612")
        let closed = mood == "proud" || mood == "sleepy" || blink
        let shift = mood == "worried" ? 0.4 : look.x * 0.55
        let lift = mood == "worried" ? 0 : look.y * 0.55
        if closed {
            for x in [7.6, 11.2] {
                var p = Path()
                p.move(to: CGPoint(x: x * k, y: 15.3 * k))
                p.addQuadCurve(to: CGPoint(x: (x + 2.2) * k, y: 15.3 * k), control: CGPoint(x: (x + 1.1) * k, y: 16.3 * k))
                ctx.stroke(p, with: .color(eye), style: StrokeStyle(lineWidth: 0.55 * k, lineCap: .round))
            }
        } else {
            let ry = mood == "focus" ? 0.45 : 1.1
            ctx.fill(ellipse(8.7 + shift, 15.6 + lift, 1, ry), with: .color(eye))
            ctx.fill(ellipse(12.3 + shift, 15.6 + lift, 1, ry), with: .color(eye))
            if mood != "focus" {
                ctx.fill(ellipse(9 + shift, 15.2 + lift, 0.28, 0.28), with: .color(.white.opacity(0.85)))
                ctx.fill(ellipse(12.6 + shift, 15.2 + lift, 0.28, 0.28), with: .color(.white.opacity(0.85)))
            }
        }
        if mood == "proud" || mood == "celebrate" {
            ctx.fill(ellipse(7.4, 17.3, 0.9, 0.5), with: .color(Color(hex: "#ff8a7a", opacity: 0.55)))
            ctx.fill(ellipse(13.6, 17.3, 0.9, 0.5), with: .color(Color(hex: "#ff8a7a", opacity: 0.55)))
        }
    }
}

/// Add without leaving ambient. With no date typed it defaults to today; stays
/// open after Enter so several tasks can go in back to back.
struct AmbientQuickAdd: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    var close: () -> Void
    @State private var title = ""
    @State private var note: String?
    @FocusState private var focused: Bool

    var body: some View {
        let parsed = store.parse(title)
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 10) {
                Image(systemName: "plus").font(.system(size: 13, weight: .bold)).foregroundStyle(tok.accent)
                TextField(t("ambQuickAddPh"), text: $title)
                    .textFieldStyle(.plain).font(tok.ui(15.5)).focused($focused).submitLabel(.done).onSubmit(submit)
                    .onChange(of: title) { _, v in if v.count > 140 { title = String(v.prefix(140)) } }
                if title.trimmingCharacters(in: .whitespaces).isEmpty {
                    IconButton(symbol: "xmark", size: 12, label: t("close"), action: close)
                } else {
                    MiniButton(title: "Add", primary: true, action: submit)
                }
            }
            if parsed.detected { ParsePills(parsed: parsed) }
            else if let note { Text("✓ \(note) · \(t("ambEnterEsc"))").font(tok.ui(12.5)).foregroundStyle(tok.text3) }
            else { Text(t("ambHint")).font(tok.ui(12.5)).foregroundStyle(tok.text3) }
        }
        .padding(14)
        .frame(maxWidth: 540)
        .background(tok.raise, in: RoundedRectangle(cornerRadius: 15))
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(tok.border))
        .shadow(color: .black.opacity(0.22), radius: 22, y: 11)
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .onAppear { focused = true }
    }

    private func submit() {
        let s = store.state
        let p = store.parse(title)
        let clean = p.title.trimmingCharacters(in: .whitespacesAndNewlines)
        if clean.isEmpty { return }
        let due = p.due ?? todayStr()
        let time = p.time ?? s.settings["defaultTime"]?.string.flatMap { $0.isEmpty ? nil : $0 }
        let prio = p.priority ?? s.settings["defaultPriority"]?.string
        guard p.newFolder != nil || p.projectId != nil || s.projects.first != nil else { return }
        store.dispatch { $0.addTask(title: clean, projectId: p.projectId ?? s.projects.first?.id, due: due, time: time, priority: prio, newFolder: p.newFolder) }
        Sound.add()
        title = ""
        // say where it went — a future-dated task won't appear on this board
        note = isToday(due) || isOverdue(due) ? t("ambAddedTodo") : t("ambAddedFor", ["date": fmtDue(due)])
    }
}

struct AmbientEditor: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    var cfg: Item
    var close: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    Text(t("ame_ambient_mode")).font(tok.mono(11)).foregroundStyle(tok.text3)
                    Text(t("ame_customize")).font(tok.display(26)).foregroundStyle(tok.text)
                }
                Spacer()
                IconButton(symbol: "xmark", label: t("ame_close_customization"), action: close)
            }
            .padding(16)
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    section(t("ame_look")) {
                        seg("ame_theme", "theme", [("app", "ame_match_app"), ("light", "ame_light"), ("dark", "ame_dark")])
                        slider("ame_background_glow", "glow", 0, 200, "%")
                        slider("ame_card_corners", "radius", 0, 40)
                    }
                    section(t("ame_clock")) {
                        slider("ame_size", "clockSize", 160, 900)
                        seg("ame_dial", "clockFace", [("minimal", "ame_minimal"), ("classic", "ame_classic"), ("numerals", "ame_numerals")])
                        seg("ame_second_hand", "seconds", [("sweep", "ame_sweep"), ("tick", "ame_tick"), ("off", "ame_off")])
                        toggle("ame_date", "showDate")
                        toggle("ame_digital_time", "showDigital")
                    }
                    section(t("ame_layout")) {
                        seg("ame_clock_side", "side", [("left", "ame_left"), ("right", "ame_right")])
                        seg("ame_columns", "columns", [("both", "ame_todo_done"), ("todo", "ame_todo_only")])
                        slider("ame_edge_padding", "padding", 0, 200)
                        slider("ame_clock_tasks_gap", "gap", 0, 300)
                        slider("ame_task_text", "rowSize", 12, 48)
                        slider("ame_max_rows", "maxRows", 3, 25, "")
                        toggle("ame_quick_add_n", "quickAdd")
                        toggle("ame_greeting", "showGreeting")
                        toggle("ame_progress_bar", "showProgress")
                    }
                    section(t("ame_widgets")) {
                        let widgets = [("none", "widget_none"), ("streak", "widget_streak"), ("progress", "widget_progress"), ("focus", "widget_focus")]
                        seg("ame_slot_1", "widget1", widgets)
                        seg("ame_slot_2", "widget2", widgets)
                        Hint(text: t("ame_a_widget_with_nothing_to_show_no_focus_running_no_streak_yet_stays_hidden"))
                    }
                    section(t("ame_ember")) {
                        toggle("ame_show_ember", "showEmber")
                        slider("ame_size", "emberSize", 48, 320)
                        seg("ame_corner", "emberCorner", [("left", "ame_bottom_left"), ("right", "ame_bottom_right")])
                        #if os(macOS)
                        toggle("ame_eyes_follow_cursor", "emberEyes")
                        #endif
                    }
                    section(t("ame_night")) {
                        seg("ame_night_mode", "night", [("off", "ame_off"), ("dim", "ame_dim"), ("dark", "ame_dim_dark")])
                        HStack {
                            Text(t("ame_from_to")).font(tok.ui(13)).foregroundStyle(tok.text2)
                            Spacer()
                            hourMenu("nightStart")
                            Text("→").foregroundStyle(tok.text3)
                            hourMenu("nightEnd")
                        }
                        slider("ame_dim_brightness", "nightLevel", 15, 100, "%")
                    }
                    section(t("ame_screen_care")) {
                        slider("ame_burn_in_drift", "drift", 0, 40)
                        Hint(text: t("ame_nudges_everything_by_up_to_this_many_pixels_every_3_minutes_0_turns_it_off"))
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
            }
            HStack {
                MiniButton(title: t("ame_reset_to_defaults")) { store.dispatch { $0.setSettings(["ambient": .obj([:])]) } }
                Spacer()
                Text(t("ame_saved_automatically")).font(tok.ui(12)).foregroundStyle(tok.text3)
            }
            .padding(14)
        }
        .background(tok.raise.ignoresSafeArea())
        .overlay(alignment: .leading) { Rectangle().fill(tok.border).frame(width: 1).ignoresSafeArea() }
    }

    private func set(_ k: String, _ v: JSON) { store.dispatch { $0.setAmbient([k: v]) } }

    private func section<C: View>(_ title: String, @ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            Text(title.uppercased()).font(tok.mono(11, medium: true)).tracking(1.3).foregroundStyle(tok.text3)
            c()
        }
    }

    private func seg(_ label: String, _ key: String, _ opts: [(String, String)]) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(t(label)).font(tok.ui(13)).foregroundStyle(tok.text2)
            Seg(value: cfg[key]?.string ?? "", options: opts.map { ($0.0, t($0.1)) }) { set(key, .str($0)) }
        }
    }

    private func toggle(_ label: String, _ key: String) -> some View {
        SetRow(title: t(label)) {
            Toggle("", isOn: Binding(get: { cfg[key]?.boolean ?? false }, set: { set(key, .bool($0)) })).labelsHidden()
        }
    }

    private func slider(_ label: String, _ key: String, _ lo: Double, _ hi: Double, _ unit: String = "px") -> some View {
        let v = cfg[key]?.number ?? lo
        return VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(t(label)).font(tok.ui(13)).foregroundStyle(tok.text2)
                Spacer()
                Text("\(Int(v))\(unit)").font(tok.mono(12)).foregroundStyle(tok.text3)
            }
            Slider(value: Binding(get: { v }, set: { set(key, .num($0.rounded())) }), in: lo...hi)
        }
    }

    private func hourMenu(_ key: String) -> some View {
        Menu(String(format: "%02d:00", Int(cfg[key]?.number ?? 0))) {
            ForEach(0..<24, id: \.self) { h in Button(String(format: "%02d:00", h)) { set(key, .num(Double(h))) } }
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
    }
}
