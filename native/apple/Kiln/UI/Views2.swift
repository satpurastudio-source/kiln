import SwiftUI

private func weekdays(_ template: String) -> [String] {
    (0..<7).map { fmtDate(makeDate(2024, 0, 1 + $0), template) } // 1 Jan 2024 was a Monday
}

private func monthCells(_ y: Int, _ m: Int) -> [Date?] {
    let start = (makeDate(y, m, 1).dow + 6) % 7
    let days = makeDate(y, m + 1, 0).dayOfMonth
    var out = [Date?](repeating: nil, count: start)
    for d in 1...days { out.append(makeDate(y, m, d)) }
    while out.count % 7 != 0 { out.append(nil) }
    return out
}

struct CalendarView: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    @State private var y = Clock.now.year
    @State private var m = Clock.now.month0
    @State private var selected = todayStr()
    @State private var title = ""
    @State private var projectId: String?

    var body: some View {
        let s = store.state
        let byDue = Dictionary(grouping: s.tasks.filter { $0.due != nil && !$0.archived }) { $0.due! }
        let today = todayStr()
        let dayTasks = (byDue[selected] ?? []).stableSorted { !$0.done && $1.done }
        let selLabel = fmtDate(parseDateStr(selected), "EEEMMMd")
        let colors = Dictionary(uniqueKeysWithValues: s.projects.map { ($0.id, $0.color) })
        VStack(alignment: .leading, spacing: 0) {
            Tip(id: "calendar", text: t("tipCalendar"))
            HStack {
                (Text(fmtDate(makeDate(y, m, 1), "MMMM")).foregroundStyle(tok.text) + Text(" \(String(y))").foregroundStyle(tok.text3)).font(tok.display(30)).tracking(0.7)
                Spacer()
                IconButton(symbol: "chevron.left", size: 12, label: t("prevMonth")) { move(-1) }
                Chip(action: goToday) { Text(t("today")) }
                IconButton(symbol: "chevron.right", size: 12, label: t("nextMonth")) { move(1) }
            }
            .padding(.top, 16)
            .padding(.bottom, 10)
            let grid = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)
            LazyVGrid(columns: grid, spacing: 4) {
                ForEach(Array(weekdays("EEE").enumerated()), id: \.offset) { _, d in
                    Text(d).font(tok.mono(11)).foregroundStyle(tok.text3).lineLimit(1).minimumScaleFactor(0.7)
                }
                ForEach(Array(monthCells(y, m).enumerated()), id: \.offset) { _, date in
                    if let date {
                        let ds = toDateStr(date)
                        let list = byDue[ds] ?? []
                        let open = list.filter { !$0.done }
                        let past = ds < today
                        Button { selected = ds } label: {
                            VStack(spacing: 3) {
                                Text(fmtNum(date.dayOfMonth)).font(tok.ui(13.5, ds == today ? .bold : .medium))
                                    .foregroundStyle(ds == today ? tok.accent : past ? tok.text3 : tok.text)
                                HStack(spacing: 2) {
                                    if !list.isEmpty && open.isEmpty {
                                        Text("✓").font(.system(size: 9)).foregroundStyle(tok.text3)
                                    } else {
                                        ForEach(open.prefix(3)) { x in
                                            Circle().fill(past ? tok.danger : Color(hex: colors[x.projectId] ?? tok.accentHex)).frame(width: 5, height: 5)
                                        }
                                        if open.count > 3 { Text("+\(open.count - 3)").font(.system(size: 8)).foregroundStyle(tok.text3) }
                                    }
                                }
                                .frame(height: 9)
                            }
                            .frame(maxWidth: .infinity, minHeight: 50)
                            .background(ds == selected ? tok.accent.opacity(0.14) : tok.panel, in: RoundedRectangle(cornerRadius: 9))
                            .overlay(RoundedRectangle(cornerRadius: 9).stroke(ds == selected ? tok.accent.opacity(0.6) : tok.border))
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(Press())
                    } else {
                        Color.clear.frame(height: 50)
                    }
                }
            }
            .gesture(DragGesture(minimumDistance: 40).onEnded { v in
                if abs(v.translation.width) > abs(v.translation.height) { move(v.translation.width < 0 ? 1 : -1) }
            })
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(selLabel).font(tok.ui(13.25, .semibold)).foregroundStyle(tok.text2)
                if selected == today { Text(t("todayLower")).font(tok.mono(11.5)).foregroundStyle(tok.text3) }
                Text(dayTasks.isEmpty ? t("nothingScheduled") : t("nOpen", ["n": fmtNum(dayTasks.filter { !$0.done }.count)])).font(tok.mono(11.5)).foregroundStyle(tok.text3)
            }
            .padding(.top, 22)
            .padding(.bottom, 8)
            HStack(spacing: 8) {
                Image(systemName: "plus").font(.system(size: 11, weight: .bold)).foregroundStyle(tok.accent)
                TextField(t("addTaskFor", ["date": selLabel]), text: $title)
                    .textFieldStyle(.plain).font(tok.ui(14)).submitLabel(.done).onSubmit(add)
                    .onChange(of: title) { _, v in if v.count > 120 { title = String(v.prefix(120)) } }
                FolderMenu(projectId: projectId ?? s.projects.first?.id) { projectId = $0 }
            }
            .padding(.horizontal, 12)
            .frame(minHeight: 44)
            .background(tok.panel, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(tok.border))
            LazyVStack(spacing: 8) {
                ForEach(dayTasks) { x in TaskRow(task: x, showProject: true) }
            }
            .padding(.top, 10)
        }
        .onAppear {
            // the mini calendar can deep-link a date via view.date
            if let d = s.view.date {
                selected = d
                let x = parseDateStr(d)
                y = x.year
                m = x.month0
            }
        }
        .onChange(of: s.view.date) { _, d in
            guard let d else { return }
            selected = d
            let x = parseDateStr(d)
            y = x.year
            m = x.month0
        }
    }

    private func move(_ delta: Int) {
        let d = makeDate(y, m + delta, 1)
        y = d.year
        m = d.month0
    }

    private func goToday() {
        y = Clock.now.year
        m = Clock.now.month0
        selected = todayStr()
    }

    /// Same parsing as the main bar; the date is the selected day unless one is typed.
    private func add() {
        let s = store.state
        let p = store.parse(title)
        let clean = p.title.trimmingCharacters(in: .whitespacesAndNewlines)
        if clean.isEmpty { return }
        let due = p.due ?? selected
        let time = p.time ?? s.settings["defaultTime"]?.string.flatMap { $0.isEmpty ? nil : $0 }
        let prio = p.priority ?? s.settings["defaultPriority"]?.string
        store.dispatch { $0.addTask(title: clean, projectId: p.projectId ?? projectId, due: due, time: time, priority: prio, newFolder: p.newFolder) }
        if due != selected {
            // jump to where it went so it doesn't look lost
            let d = parseDateStr(due)
            y = d.year
            m = d.month0
            selected = due
        }
        title = ""
        Sound.add()
    }
}

/// Floating peek calendar, bottom-right. Click a day → full calendar view.
struct MiniCalendarLauncher: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    @State private var open = false
    @State private var y = Clock.now.year
    @State private var m = Clock.now.month0

    var body: some View {
        let dueDays = Set(store.state.tasks.filter { !$0.done }.compactMap(\.due))
        ZStack(alignment: .bottomTrailing) {
            if open {
                Color.black.opacity(0.001).ignoresSafeArea().onTapGesture { open = false }
                VStack(spacing: 8) {
                    HStack {
                        IconButton(symbol: "chevron.left", size: 10, label: t("prevMonth")) { step(-1) }
                        Spacer()
                        Text("\(fmtDate(makeDate(y, m, 1), "MMM")) \(String(y))").font(tok.ui(13, .semibold)).foregroundStyle(tok.text)
                        Spacer()
                        IconButton(symbol: "chevron.right", size: 10, label: t("nextMonth")) { step(1) }
                    }
                    LazyVGrid(columns: Array(repeating: GridItem(.fixed(30), spacing: 2), count: 7), spacing: 2) {
                        ForEach(Array(weekdays("EEEEE").enumerated()), id: \.offset) { _, d in
                            Text(d).font(tok.mono(10)).foregroundStyle(tok.text3)
                        }
                        ForEach(Array(monthCells(y, m).enumerated()), id: \.offset) { _, date in
                            if let date {
                                let ds = toDateStr(date)
                                Button { pick(ds) } label: {
                                    Text(String(date.dayOfMonth)).font(tok.ui(12, ds == todayStr() ? .bold : .regular))
                                        .foregroundStyle(ds == todayStr() ? .white : dueDays.contains(ds) ? tok.accent : tok.text2)
                                        .frame(width: 30, height: 28)
                                        .background(ds == todayStr() ? tok.accent : .clear, in: RoundedRectangle(cornerRadius: 7))
                                        .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                            } else {
                                Color.clear.frame(width: 30, height: 28)
                            }
                        }
                    }
                    Button(t("openFullCalendar")) { pick(todayStr()) }
                        .buttonStyle(.plain).font(tok.ui(12.5, .medium)).foregroundStyle(tok.accent).padding(.top, 2)
                }
                .padding(12)
                .background(tok.raise, in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(tok.border))
                .shadow(color: .black.opacity(0.2), radius: 20, y: 10)
                .padding(.trailing, 18)
                .padding(.bottom, 76)
                .transition(.scale(scale: 0.9, anchor: .bottomTrailing).combined(with: .opacity))
            }
            Button {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) { open.toggle() }
            } label: {
                ZStack {
                    Image(systemName: "calendar").font(.system(size: 18)).foregroundStyle(tok.text2)
                    Text(String(Clock.now.dayOfMonth)).font(.system(size: 8, weight: .bold)).foregroundStyle(tok.accent).offset(y: 3)
                }
                .frame(width: 46, height: 46)
                .background(tok.raise, in: Circle())
                .overlay(Circle().stroke(tok.border))
                .shadow(color: .black.opacity(0.14), radius: 10, y: 5)
            }
            .buttonStyle(Press())
            .accessibilityLabel(t("openMiniCalendar"))
            .padding(18)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
    }

    private func step(_ d: Int) {
        let x = makeDate(y, m + d, 1)
        y = x.year
        m = x.month0
    }

    private func pick(_ ds: String) {
        store.dispatch { $0.view = Screen(type: "calendar", date: ds) }
        open = false
    }
}

struct InsightsView: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    @State private var name = ""
    @State private var color = HABIT_COLORS[0]

    var body: some View {
        let s = store.state, stats = s.insights
        let days14 = (0..<14).reversed().map { addDaysStr(-$0) }
        VStack(alignment: .leading, spacing: 14) {
            Tip(id: "insights", text: t("tipInsights"))
            title("target", t("habits"))
            VStack(alignment: .leading, spacing: 10) {
                KField(placeholder: t("newHabitPh"), text: $name, limit: 40, submit: addHabit)
                HStack {
                    ForEach(HABIT_COLORS, id: \.self) { c in
                        Button { color = c } label: {
                            Circle().fill(Color(hex: c)).frame(width: 24, height: 24)
                                .overlay(Circle().stroke(tok.text, lineWidth: color == c ? 2 : 0).padding(-3))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(t("useColor", ["color": c]))
                    }
                    Spacer()
                    PrimaryButton(title: "＋ \(t("add"))", action: addHabit)
                }
            }
            if s.habits.isEmpty { BareEmpty(symbol: "target", text: t("habitsEmpty")) }
            else {
                ForEach(s.habits) { h in habitRow(h, days14) }
            }
            title("chart.bar", t("thisWeek")).padding(.top, 16)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                stat(t("doneThisWeek"), fmtNum(stats.totalWeek))
                stat(t("dayStreak"), fmtNum(stats.streak), flame: stats.streak > 0)
                stat(t("focusSessions"), fmtNum(stats.totalPomos))
                stat(t("bestDay"), stats.bestDay.count > 0 ? stats.bestDay.label : "—")
            }
            HStack(alignment: .bottom, spacing: 10) {
                ForEach(stats.days) { d in
                    VStack(spacing: 5) {
                        if d.count > 0 { Text(fmtNum(d.count)).font(tok.mono(11)).foregroundStyle(tok.text2) }
                        RoundedRectangle(cornerRadius: 5)
                            .fill(LinearGradient(colors: [tok.accent2, tok.accent], startPoint: .top, endPoint: .bottom))
                            .frame(height: max(3, 110 * CGFloat(d.count) / CGFloat(stats.maxDay)))
                        Text(d.label).font(tok.mono(10.5)).foregroundStyle(tok.text3).lineLimit(1).minimumScaleFactor(0.6)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 160, alignment: .bottom)
            .padding(14)
            .background(tok.panel, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(tok.border))
            if let top = stats.byFolder.first {
                VStack(alignment: .leading, spacing: 9) {
                    Text(t("byFolder")).font(tok.ui(12.5, .semibold)).foregroundStyle(tok.text2)
                    ForEach(stats.byFolder, id: \.name) { f in
                        HStack(spacing: 9) {
                            Text(f.name).font(tok.ui(12.5)).foregroundStyle(tok.text2).frame(width: 96, alignment: .leading).lineLimit(1)
                            GeometryReader { g in
                                ZStack(alignment: .leading) {
                                    Capsule().fill(tok.border)
                                    Capsule().fill(Color(hex: f.color)).frame(width: g.size.width * CGFloat(f.count) / CGFloat(top.count))
                                }
                            }
                            .frame(height: 6)
                            Text(fmtNum(f.count)).font(tok.mono(11.5)).foregroundStyle(tok.text3)
                        }
                    }
                }
            }
            if let h = stats.bestHour {
                HStack(spacing: 5) {
                    Image(systemName: "clock").font(.system(size: 11))
                    Text(t("bestHour"))
                    Text(fmtHour(h)).fontWeight(.semibold)
                }
                .font(tok.ui(13)).foregroundStyle(tok.text2)
            }
        }
        .padding(.top, 14)
    }

    private func title(_ symbol: String, _ s: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: symbol).font(.system(size: 14)).foregroundStyle(tok.accent)
            Text(s).font(tok.ui(15, .semibold)).foregroundStyle(tok.text)
        }
    }

    private func stat(_ label: String, _ value: String, flame: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 5) {
                if flame { FlameShape().stroke(tok.accent, lineWidth: 1.5).frame(width: 15, height: 15) }
                Text(value).font(tok.display(30)).foregroundStyle(tok.text).lineLimit(1).minimumScaleFactor(0.5)
            }
            Text(label).font(tok.ui(12)).foregroundStyle(tok.text3).lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(tok.panel, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(tok.border))
    }

    private func habitRow(_ h: Habit, _ days: [String]) -> some View {
        let today = todayStr(), done = h.done(on: today), c = Color(hex: h.color), streak = h.streak
        return HStack(spacing: 11) {
            Button { store.dispatch { $0.toggleHabit(h.id) } } label: {
                ZStack {
                    Circle().fill(done ? c : .clear)
                    Circle().stroke(c, lineWidth: 1.6)
                    if done { Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(.white) }
                }
                .frame(width: 26, height: 26)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(done ? t("markNotDoneToday") : t("markDoneToday"))
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 7) {
                    Text(h.name).font(tok.ui(14, .medium)).foregroundStyle(tok.text).lineLimit(1)
                    if streak > 0 {
                        HStack(spacing: 3) {
                            FlameShape().stroke(c, lineWidth: 1).frame(width: 11, height: 11)
                            Text(fmtNum(streak)).font(tok.mono(11.5))
                        }
                        .foregroundStyle(c)
                    }
                }
                HStack(spacing: 3) {
                    ForEach(days, id: \.self) { d in
                        RoundedRectangle(cornerRadius: 2).fill(h.done(on: d) ? c : tok.border).frame(width: 12, height: 12)
                    }
                }
            }
            Spacer(minLength: 0)
            IconButton(symbol: "xmark", size: 10, color: tok.text3, label: t("removeHabit")) {
                store.dispatch { $0.habits.removeAll { $0.id == h.id } }
                store.toast(t("habitRemoved"), "🗑")
            }
        }
        .padding(11)
        .background(tok.panel, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(tok.border))
    }

    private func addHabit() {
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if n.isEmpty { return }
        store.dispatch { $0.addHabit(name: n, color: color) }
        name = ""
        store.toast(t("habitAdded"), "✦")
    }
}

/// The pomodoro overlay and its pill. The clock runs from TimelineView, so nothing ticks while it's closed.
struct FocusLayer: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok

    var body: some View {
        if let f = store.focus {
            ZStack(alignment: .bottomLeading) {
                if store.focusOpen {
                    tok.scrim.ignoresSafeArea().transition(.opacity)
                    FocusCard(session: f).frame(maxWidth: .infinity, maxHeight: .infinity).transition(.scale(scale: 0.94).combined(with: .opacity))
                } else {
                    Button { withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { store.focusOpen = true } } label: {
                        HStack(spacing: 8) {
                            Circle().fill(f.phase == "work" ? tok.accent : Color(hex: "#7c8a4d")).frame(width: 8, height: 8)
                            TimelineView(.periodic(from: .now, by: 1)) { _ in
                                Text(fmtClock(store.focusSecondsLeft)).font(tok.mono(13, medium: true)).foregroundStyle(tok.text).monospacedDigit()
                            }
                            Text(f.phase == "work" ? t("focusLower") : t("breakLower")).font(tok.ui(12.5)).foregroundStyle(tok.text2)
                        }
                        .padding(.horizontal, 14)
                        .frame(height: 42)
                        .background(tok.raise, in: Capsule())
                        .overlay(Capsule().stroke(tok.border))
                        .shadow(color: .black.opacity(0.14), radius: 10, y: 5)
                    }
                    .buttonStyle(Press())
                    .accessibilityLabel(t("openFocus"))
                    .padding(18)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.spring(response: 0.3, dampingFraction: 0.85), value: store.focusOpen)
        }
    }
}

func fmtClock(_ secs: Double) -> String {
    let s = max(0, Int(secs.rounded(.up)))
    return "\(s / 60):\(String(format: "%02d", s % 60))"
}

private struct FocusCard: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    let session: FocusSession

    var body: some View {
        let s = store.state
        let task = s.tasks.first { $0.id == session.taskId }
        let mode = focusDurations(session.mode, s.settings)
        let isWork = session.phase == "work"
        let duration = Double(isWork ? mode.work : (session.count % 4 == 0 && session.count > 0 ? mode.brk * 3 : mode.brk))
        let running = session.remaining == nil
        VStack(spacing: 16) {
            Tip(id: "focus", text: t("tipFocus"))
            HStack(spacing: 6) {
                Text(isWork ? "⚒ \(t("focusLower"))" : "☕ \(t("breakLower"))").font(tok.mono(12.5, medium: true)).foregroundStyle(isWork ? tok.accent : Color(hex: "#7c8a4d"))
                Spacer(minLength: 2)
                Chip(on: session.mode == "classic", action: { setMode("classic") }) { Text("25 · 5") }
                Chip(on: session.mode == "deep", action: { setMode("deep") }) { Text("50 · 10") }
                Chip(on: session.mode == "custom", action: { setMode("custom") }) { Text(t("accentCustom")) }
                IconButton(symbol: "minus", size: 12, label: t("minimize")) { withAnimation { store.focusOpen = false } }
            }
            if session.mode == "custom" {
                HStack(spacing: 16) {
                    stepper(t("widget_focus"), "focusWork", 180)
                    stepper(t("break"), "focusBreak", 60)
                }
            }
            TimelineView(.periodic(from: .now, by: 0.5)) { _ in
                let left = store.focusSecondsLeft
                ZStack {
                    Circle().stroke(tok.border, lineWidth: 6)
                    Circle().trim(from: 0, to: min(1, max(0, left / duration)))
                        .stroke(isWork ? tok.accent : Color(hex: "#7c8a4d"), style: StrokeStyle(lineWidth: 6, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .animation(.linear(duration: 0.5), value: left)
                    VStack(spacing: 6) {
                        Text(fmtClock(left)).font(tok.mono(46, medium: true)).foregroundStyle(tok.text).monospacedDigit()
                        Text(task?.title ?? t("focusSession")).font(tok.ui(13)).foregroundStyle(tok.text2).lineLimit(2).multilineTextAlignment(.center).frame(maxWidth: 170)
                    }
                }
                .frame(width: 230, height: 230)
            }
            HStack(spacing: 5) {
                ForEach(0..<4, id: \.self) { i in
                    let lit = i < session.count % 4 || (session.count > 0 && session.count % 4 == 0)
                    FlameShape().stroke(lit ? tok.accent : tok.borderStrong, lineWidth: 1.2).frame(width: 13, height: 13)
                }
                if session.count > 0 { Text(t("nDone", ["n": fmtNum(session.count)])).font(tok.mono(11.5)).foregroundStyle(tok.text3) }
            }
            HStack(spacing: 16) {
                IconButton(symbol: "forward.end", size: 15, label: t("skipPhase"), action: skip)
                Button(action: running ? pause : resume) {
                    Image(systemName: running ? "pause.fill" : "play.fill").font(.system(size: 20)).foregroundStyle(.white)
                        .frame(width: 60, height: 60)
                        .background(tok.accent, in: Circle())
                }
                .buttonStyle(Press())
                IconButton(symbol: "xmark", size: 15, label: t("endSession"), action: end)
            }
            if let task, !task.done {
                Button("✓ \(t("completeNamed", ["title": task.title.count > 34 ? task.title.prefix(34) + "…" : task.title]))") {
                    let id = task.id
                    store.dispatch { $0.toggleTask(id) }
                    Sound.fanfare()
                    store.toast(t("taskForged"), "✓")
                    end()
                }
                .buttonStyle(.plain)
                .font(tok.ui(13, .medium))
                .foregroundStyle(tok.text2)
            }
        }
        .padding(20)
        .frame(maxWidth: 430)
        .background(tok.raise, in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(tok.border))
        .padding(16)
    }

    private func stepper(_ label: String, _ key: String, _ hi: Int) -> some View {
        let v = max(1, min(hi, Int(store.state.settings[key]?.number ?? 1)))
        return Stepper(value: Binding(get: { v }, set: { setCustom(key, $0) }), in: 1...hi) {
            Text("\(label) \(fmtNum(v)) \(t("minUnit"))").font(tok.ui(12.5)).foregroundStyle(tok.text2)
        }
    }

    private var secsLeft: Double { store.focusSecondsLeft }
    private func pause() {
        var f = session
        f.remaining = secsLeft
        store.setFocus(f)
    }
    private func resume() {
        var f = session
        f.endsAt = Clock.ms + secsLeft * 1000
        f.remaining = nil
        store.setFocus(f)
    }
    private func skip() {
        var f = session
        let m = focusDurations(f.mode, store.state.settings)
        if f.phase == "work" {
            f.phase = "break"
            f.endsAt = Clock.ms + Double(m.brk) * 1000
        } else {
            f.phase = "work"
            f.endsAt = Clock.ms + Double(m.work) * 1000
        }
        f.remaining = nil
        store.setFocus(f)
        Sound.pop()
    }
    private func end() {
        store.setFocus(nil)
        store.focusOpen = false
        Sound.pop()
    }
    private func setMode(_ id: String) {
        var f = session
        let m = focusDurations(id, store.state.settings)
        let dur = Double(f.phase == "work" ? m.work : m.brk)
        f.mode = id
        f.endsAt = Clock.ms + dur * 1000
        if f.remaining != nil { f.remaining = dur }
        store.setFocus(f)
    }
    private func setCustom(_ key: String, _ v: Int) {
        store.dispatch { $0.setSettings([key: .num(Double(v))]) }
        if session.mode == "custom" { setMode("custom") }
    }
}
