import SwiftUI

struct HeaderView: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    @Binding var query: String
    var focusSearch: Int
    var openPalette: () -> Void
    @FocusState private var searching: Bool
    @State private var showSearch = false

    var body: some View {
        let s = store.state, v = s.view
        let project = v.type == "project" ? s.projects.first { $0.id == v.projectId } : nil
        let activeCount = s.active().count
        let prog = project.map { s.projectProgress($0.id) }
        let today = s.todayProgress
        let bar: (pct: Int, done: Int, total: Int)? = {
            if let prog, prog.total > 0 { return (prog.pct, prog.done, prog.total) }
            if v.type == "today", today.total > 0 { return (today.pct, today.done, today.total) }
            return nil
        }()
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        if let project { Text(iconGlyph(project.icon)).font(.system(size: 28)).foregroundStyle(Color(hex: project.color)) }
                        (Text(title(v, project)).foregroundStyle(tok.text) + Text(".").foregroundStyle(tok.accent))
                            .font(tok.display(44)).tracking(1).lineLimit(2).minimumScaleFactor(0.6)
                    }
                    HStack(spacing: 7) {
                        if v.type == "today" { Circle().fill(tok.accent).frame(width: 6, height: 6) }
                        Text(subtitle(v, activeCount, prog)).font(tok.ui(13.5)).foregroundStyle(tok.text2).lineLimit(2)
                    }
                }
                Spacer(minLength: 6)
                HStack(spacing: 0) {
                    IconButton(symbol: "magnifyingglass", label: t("searchPh")) {
                        withAnimation(.easeOut(duration: 0.18)) { showSearch.toggle() }
                        if showSearch { searching = true } else { query = "" }
                    }
                    IconButton(symbol: "command", label: t("commandPaletteTitle"), action: openPalette)
                }
            }
            if showSearch || !query.isEmpty {
                TextField(t("searchPh"), text: $query)
                    .textFieldStyle(.plain)
                    .font(tok.ui(14))
                    .padding(.horizontal, 12)
                    .frame(height: 36)
                    .background(tok.panel, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(tok.border))
                    .focused($searching)
            }
            if let bar { GoalBar(pct: bar.pct, done: bar.done, total: bar.total) }
        }
        .onChange(of: focusSearch) {
            withAnimation(.easeOut(duration: 0.18)) { showSearch = true }
            searching = true
        }
    }

    private func title(_ v: Screen, _ project: Project?) -> String {
        switch v.type {
        case "today":
            let first = store.state.profile?["name"]?.string?.split(whereSeparator: \.isWhitespace).first.map(String.init) ?? t("friendShort")
            return "\(greeting()), \(first)"
        case "upcoming", "calendar", "insights", "archive", "trash", "all": return t("nav_\(v.type)")
        default: return project?.name ?? t("folder")
        }
    }

    private func subtitle(_ v: Screen, _ activeCount: Int, _ prog: (total: Int, done: Int, pct: Int)?) -> String {
        switch v.type {
        case "today": return "\(fmtLongDate()) — \(activeCount == 0 ? t("allClearLower") : tn("tasksToGo", activeCount))"
        case "project": return prog.map { t("doneOfTotal", ["done": fmtNum($0.done), "total": fmtNum($0.total)]) } ?? ""
        case "calendar": return tn("scheduledTasks", activeCount)
        case "insights": return t("subInsights")
        case "archive": return t("subArchive")
        case "trash": return t("subTrash")
        default: return tn("openTasks", activeCount)
        }
    }
}

struct GoalBar: View {
    @Environment(\.tok) private var tok
    var pct: Int, done: Int, total: Int
    var body: some View {
        let milestone = pct >= 100 ? t("msCleared") : pct >= 80 ? t("msClose") : pct >= 50 ? t("msHalfway") : nil
        VStack(spacing: 5) {
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(tok.border)
                    Capsule().fill(LinearGradient(colors: [tok.accent, tok.accent2], startPoint: .leading, endPoint: .trailing))
                        .frame(width: g.size.width * Double(pct) / 100)
                        .shadow(color: tok.accent.opacity(0.5), radius: 4 + Double(pct) * 0.05)
                        .animation(.spring(response: 0.8, dampingFraction: 0.75), value: pct)
                }
            }
            .frame(height: 5)
            HStack {
                if let milestone { Text(milestone).font(tok.ui(12, .medium)).foregroundStyle(tok.accent) }
                Spacer()
                Text("\(done)/\(total) · \(pct)%").font(tok.mono(11.5)).foregroundStyle(tok.text3)
            }
        }
    }
}

struct QuickAddView: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    var focusTick: Int
    @State private var title = ""
    @State private var due: String?
    @State private var time = ""
    @State private var priority = "none"
    @State private var projectId: String?
    @FocusState private var focused: Bool

    var body: some View {
        let s = store.state
        let parsed = store.parse(title)
        let expanded = focused || !title.isEmpty
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 11) {
                Image(systemName: "plus").font(.system(size: 13, weight: .bold)).foregroundStyle(tok.accent)
                    .rotationEffect(.degrees(expanded ? 45 : 0))
                    .animation(.spring(response: 0.3, dampingFraction: 0.55), value: expanded)
                TextField(t("quickAddPh"), text: $title)
                    .textFieldStyle(.plain)
                    .font(tok.ui(15))
                    .focused($focused)
                    .onSubmit(submit)
                    .onChange(of: title) { _, v in if v.count > 140 { title = String(v.prefix(140)) } }
                    .submitLabel(.done)
                    .accessibilityIdentifier("quickadd")
                #if os(iOS)
                Button {
                    if title.trimmingCharacters(in: .whitespaces).isEmpty { focused = true } else { submit() }
                } label: {
                    Image(systemName: "plus").font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
                        .frame(width: 30, height: 30).background(tok.accent, in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(t("addTask"))
                #else
                Text("N").font(tok.mono(11)).foregroundStyle(tok.text3).padding(.horizontal, 7).padding(.vertical, 2)
                    .overlay(RoundedRectangle(cornerRadius: 5).stroke(tok.border))
                #endif
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 50)
            if expanded {
                VStack(alignment: .leading, spacing: 10) {
                    if parsed.detected { ParsePills(parsed: parsed).transition(.opacity) }
                    Flow {
                        Chip(on: due == todayStr(), action: { due = due == todayStr() ? nil : todayStr() }) {
                            Image(systemName: "sun.max").font(.system(size: 11))
                            Text(t("today"))
                        }
                        Chip(on: due == addDaysStr(1), action: { due = due == addDaysStr(1) ? nil : addDaysStr(1) }) {
                            Text("→ \(t("tomorrow"))")
                        }
                        DueField(due: $due)
                        TimeField(time: $time)
                        ForEach(PRIORITIES.filter { $0.id != "none" }, id: \.id) { p in
                            Chip(on: priority == p.id, action: { priority = priority == p.id ? "none" : p.id }) {
                                Image(systemName: "flag.fill").font(.system(size: 10)).foregroundStyle(Color(hex: p.color))
                                Text(t("prio_\(p.id)"))
                            }
                        }
                        FolderMenu(projectId: projectId ?? s.projects.first?.id) { projectId = $0 }
                    }
                }
                .padding(.horizontal, 14)
                .padding(.bottom, 12)
                .transition(.opacity)
            }
        }
        .background(tok.panelStrong, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(focused ? tok.accent.opacity(0.5) : tok.border))
        .shadow(color: .black.opacity(tok.dark ? 0.4 : 0.1), radius: 14, y: 8)
        .padding(.top, 16)
        .padding(.bottom, 22)
        .animation(.easeOut(duration: 0.22), value: expanded)
        .onAppear(perform: resetDefaults)
        .onChange(of: focusTick) { focused = true }
        .onChange(of: s.view.key) { resetDefaults() }
        .onChange(of: s.projects.map(\.id)) { _, ids in
            // the picked folder was deleted (here or on another device) → fall back
            if let p = projectId, !ids.contains(p) { projectId = defaultProject() }
        }
    }

    private func defaultProject() -> String? {
        let s = store.state
        return s.view.type == "project" ? s.view.projectId : s.projects.first?.id
    }

    private func resetDefaults() {
        let s = store.state
        due = store.newTaskDue(for: s.view)
        projectId = defaultProject()
        time = s.settings["defaultTime"]?.string ?? ""
        priority = s.settings["defaultPriority"]?.string ?? "none"
    }

    private func submit() {
        let s = store.state
        let p = store.parse(title)
        let final = p.title.trimmingCharacters(in: .whitespacesAndNewlines)
        if final.isEmpty { return }
        let dueValue = p.due ?? due
        let timeValue = p.time ?? (time.isEmpty ? nil : time)
        let prio = p.priority ?? priority
        if let nf = p.newFolder {
            // "#name" for a folder that doesn't exist → create it and file the task
            store.dispatch { $0.addTask(title: final, projectId: nil, due: dueValue, time: timeValue, priority: prio, newFolder: nf) }
            store.toast(t("createdFolder", ["name": nf]), "📁")
        } else {
            let pid = p.projectId ?? projectId
            store.dispatch { $0.addTask(title: final, projectId: pid, due: dueValue, time: timeValue, priority: prio) }
            // the task went somewhere this view doesn't show — say where
            if !AppState.inView(due: dueValue, projectId: pid ?? "", view: s.view) {
                let folder = s.projects.first { $0.id == pid }?.name ?? t("inbox")
                store.toast(t("addedTo", ["folder": folder, "when": dueValue != nil ? fmtDue(dueValue) : t("noDateLower")]), "✓")
            }
        }
        title = ""
        priority = s.settings["defaultPriority"]?.string ?? "none"
        Sound.add()
        if timeValue != nil { Reminders.shared.offer(store: store) }
    }
}

struct ParsePills: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    var parsed: Parsed
    var body: some View {
        let project = parsed.projectId.flatMap { id in store.state.projects.first { $0.id == id } }
        Flow(spacing: 6) {
            Text("reading:").font(tok.mono(11)).foregroundStyle(tok.text3).padding(.vertical, 4)
            if let d = parsed.due { pill("calendar", fmtDue(d)) }
            if let x = parsed.time { pill("clock", fmtTime(x)) }
            if let x = parsed.priority { pill("flag.fill", t("prio_\(x)")) }
            if let project {
                HStack(spacing: 5) {
                    Circle().fill(Color(hex: project.color)).frame(width: 7, height: 7)
                    Text(project.name)
                }
                .pillStyle(tok)
            }
            if let nf = parsed.newFolder { pill("plus", "\(t("newFolder")) · \(nf)") }
        }
    }
    private func pill(_ symbol: String, _ text: String) -> some View {
        HStack(spacing: 5) {
            Image(systemName: symbol).font(.system(size: 10))
            Text(text)
        }
        .pillStyle(tok)
    }
}

private extension View {
    func pillStyle(_ tok: Tok) -> some View {
        font(tok.ui(12, .medium)).foregroundStyle(tok.accent).padding(.horizontal, 9).padding(.vertical, 4)
            .background(tok.accent.opacity(0.1), in: Capsule())
    }
}

struct DueField: View {
    @Environment(\.tok) private var tok
    @Binding var due: String?
    var body: some View {
        if let d = due {
            HStack(spacing: 2) {
                DatePicker("", selection: Binding(get: { parseDateStr(d) }, set: { due = toDateStr($0) }), displayedComponents: .date)
                    .labelsHidden().scaleEffect(0.85).frame(height: 27)
                Button { due = nil } label: { Image(systemName: "xmark").font(.system(size: 9, weight: .bold)).foregroundStyle(tok.text3).padding(4) }
                    .buttonStyle(.plain).accessibilityLabel(t("clear"))
            }
        } else {
            Chip(action: { due = todayStr() }) {
                Image(systemName: "calendar").font(.system(size: 11))
                Text(t("pickDate"))
            }
        }
    }
}

struct TimeField: View {
    @Environment(\.tok) private var tok
    @Binding var time: String
    var body: some View {
        if time.isEmpty {
            Chip(action: { time = "09:00" }) {
                Image(systemName: "clock").font(.system(size: 11))
                Text(t("setTime"))
            }
        } else {
            HStack(spacing: 2) {
                DatePicker("", selection: Binding(get: {
                    let p = time.split(separator: ":").map { Int($0) ?? 0 }
                    return makeDate(2000, 0, 1, p.first ?? 0, p.count > 1 ? p[1] : 0)
                }, set: { time = String(format: "%02d:%02d", $0.hour, $0.minute) }), displayedComponents: .hourAndMinute)
                    .labelsHidden().scaleEffect(0.85).frame(height: 27)
                Button { time = "" } label: { Image(systemName: "xmark").font(.system(size: 9, weight: .bold)).foregroundStyle(tok.text3).padding(4) }
                    .buttonStyle(.plain).accessibilityLabel(t("clear"))
            }
        }
    }
}

struct FolderMenu: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    var projectId: String?
    var pick: (String) -> Void
    var body: some View {
        let list = store.state.projects
        Menu {
            ForEach(list) { p in Button("\(iconGlyph(p.icon)) \(p.name)") { pick(p.id) } }
        } label: {
            let p = list.first { $0.id == projectId }
            HStack(spacing: 6) {
                Circle().fill(Color(hex: p?.color ?? tok.accentHex)).frame(width: 8, height: 8)
                Text(p?.name ?? t("folder")).lineLimit(1)
                Image(systemName: "chevron.up.chevron.down").font(.system(size: 8))
            }
            .font(tok.ui(13, .medium))
            .foregroundStyle(tok.text2)
            .padding(.horizontal, 11)
            .frame(height: 27)
            .overlay(Capsule().stroke(tok.border))
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
        .fixedSize()
    }
}

struct TaskListView: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    var query: String
    @State private var showCompleted = false

    var body: some View {
        let s = store.state, v = s.view
        let active = s.active(query: query)
        let completed = s.completed(query: query)
        let reorderable = (v.type == "all" || v.type == "project") && query.isEmpty
        let showProject = v.type != "project"
        let byPrio: (KTask, KTask) -> Bool = { (priorityRank[$0.priority] ?? 3) < (priorityRank[$1.priority] ?? 3) }
        LazyVStack(alignment: .leading, spacing: 8) {
            if active.isEmpty {
                EmptyStateView(kind: query.isEmpty ? v.type : "search")
            } else if v.type == "today" {
                group(t("overdue"), active.filter { isOverdue($0.due) }.stableSorted(byPrio), overdue: true, showProject)
                group(t("today"), active.filter { !isOverdue($0.due) }.stableSorted(byPrio), overdue: false, showProject)
            } else if v.type == "upcoming" {
                ForEach(s.groupUpcoming(active), id: \.id) { g in
                    group(g.label, g.tasks, overdue: g.id == "overdue", showProject)
                }
            } else {
                ReorderableList(tasks: active, reorderable: reorderable, showProject: showProject)
            }
            if !completed.isEmpty {
                HStack {
                    Button {
                        withAnimation(.easeOut(duration: 0.25)) { showCompleted.toggle() }
                    } label: {
                        HStack(spacing: 7) {
                            Image(systemName: "chevron.right").font(.system(size: 10, weight: .semibold)).rotationEffect(.degrees(showCompleted ? 90 : 0))
                            Text("\(v.type == "today" ? t("completedToday") : t("completed")) · \(fmtNum(completed.count))")
                        }
                        .font(tok.ui(13.25, .semibold))
                        .foregroundStyle(tok.text2)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    Spacer()
                    Button(t("clear")) {
                        let ids = completed.map(\.id)
                        store.dispatch { $0.deleteTasks(ids) }
                        store.toast(t("clearedCompleted", ["n": fmtNum(ids.count)]), "🧹", action: (t("undo"), { store.dispatch { $0.restoreTasks(ids) } }))
                    }
                    .buttonStyle(.plain)
                    .font(tok.ui(12.5, .medium))
                    .foregroundStyle(tok.text3)
                }
                .padding(.top, 18)
                .padding(.horizontal, 4)
                if showCompleted {
                    ForEach(completed) { x in TaskRow(task: x, showProject: showProject) }
                }
            }
        }
    }

    @ViewBuilder private func group(_ label: String, _ list: [KTask], overdue: Bool, _ showProject: Bool) -> some View {
        if !list.isEmpty {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(label).font(tok.ui(13.25, .semibold)).foregroundStyle(overdue ? tok.danger : tok.text2)
                Text(fmtNum(list.count)).font(tok.mono(11.5)).foregroundStyle(tok.text3)
            }
            .padding(.horizontal, 4)
            .padding(.top, 12)
            .padding(.bottom, 2)
            ForEach(list) { x in TaskRow(task: x, showProject: showProject) }
        }
    }
}

extension Array {
    /// Array.sort isn't stable; JS's is, and equal priorities must keep their order.
    func stableSorted(_ by: (Element, Element) -> Bool) -> [Element] {
        enumerated().sorted { a, b in
            if by(a.element, b.element) { return true }
            if by(b.element, a.element) { return false }
            return a.offset < b.offset
        }.map(\.element)
    }
}

/// Lets rows be dragged by their grip. Heights are measured, so rows of any
/// height swap at the right moment; a drop in the bottom zone completes the task.
struct ReorderableList: View {
    @Environment(Store.self) private var store
    var tasks: [KTask]
    var reorderable: Bool
    var showProject: Bool
    @State private var draggingId: String?
    @State private var offset: CGFloat = 0
    @State private var heights: [String: CGFloat] = [:]
    private let gap: CGFloat = 8

    var body: some View {
        ForEach(tasks) { x in
            TaskRow(task: x, showProject: showProject, grip: reorderable ? AnyGesture(drag(x).map { _ in () }) : nil)
                .background { GeometryReader { g in Color.clear.onAppear { heights[x.id] = g.size.height }.onChange(of: g.size.height) { _, h in heights[x.id] = h } } }
                .offset(y: draggingId == x.id ? offset : 0)
                .zIndex(draggingId == x.id ? 2 : 0)
                .scaleEffect(draggingId == x.id ? 1.03 : 1)
                .shadow(color: .black.opacity(draggingId == x.id ? 0.2 : 0), radius: 14, y: 8)
                .animation(draggingId == x.id ? nil : .spring(response: 0.3, dampingFraction: 0.82), value: tasks.map(\.id))
        }
    }

    private func drag(_ x: KTask) -> some Gesture {
        DragGesture(minimumDistance: 2, coordinateSpace: .global)
            .onChanged { g in
                if draggingId != x.id {
                    draggingId = x.id
                    store.dragging = true
                    tick()
                }
                if draggingOffsetBase == nil { draggingOffsetBase = 0 }
                offset = g.translation.height + (draggingOffsetBase ?? 0)
                store.dragHot = g.location.y > store.windowHeight - 130
                swapIfNeeded(x)
            }
            .onEnded { _ in
                let hot = store.dragHot
                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                    draggingId = nil
                    offset = 0
                }
                draggingOffsetBase = nil
                store.dragging = false
                store.dragHot = false
                if hot {
                    Sound.complete()
                    store.completeWithFlourish(x)
                }
            }
    }

    @State private var draggingOffsetBase: CGFloat?

    private func swapIfNeeded(_ x: KTask) {
        var ids = tasks.map(\.id)
        guard let i = ids.firstIndex(of: x.id) else { return }
        if offset > 0, i + 1 < ids.count {
            let h = (heights[ids[i + 1]] ?? 60) + gap
            if offset > h * 0.55 {
                ids.swapAt(i, i + 1)
                draggingOffsetBase = (draggingOffsetBase ?? 0) - h
                offset -= h
                store.dispatch { $0.reorderTasks(ids) }
                tick()
            }
        } else if offset < 0, i > 0 {
            let h = (heights[ids[i - 1]] ?? 60) + gap
            if -offset > h * 0.55 {
                ids.swapAt(i, i - 1)
                draggingOffsetBase = (draggingOffsetBase ?? 0) + h
                offset += h
                store.dispatch { $0.reorderTasks(ids) }
                tick()
            }
        }
    }
}

struct TaskRow: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    let task: KTask
    var showProject = true
    var grip: AnyGesture<Void>?
    @State private var open = false
    @State private var checking = false

    var body: some View {
        let project = store.state.projects.first { $0.id == task.projectId }
        let done = task.done || checking
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center, spacing: 6) {
                if let grip {
                    Image(systemName: "line.3.horizontal").font(.system(size: 12)).foregroundStyle(tok.text3)
                        .frame(width: 24, height: 40).contentShape(Rectangle())
                        .gesture(grip)
                        .accessibilityLabel(t("dragToReorder"))
                }
                CheckCircle(checked: done, color: Color(hex: project?.color ?? tok.accentHex), action: toggle)
                VStack(alignment: .leading, spacing: 4) {
                    Text(task.title)
                        .font(tok.ui(15, .medium))
                        .foregroundStyle(done ? tok.text3 : tok.text)
                        .strikethrough(done, color: tok.text3)
                        .lineLimit(open ? nil : 1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    meta(project)
                }
                if !task.done {
                    IconButton(symbol: "play.fill", size: 10, color: tok.text3, label: t("focusOnTask")) { store.startFocus(task.id) }
                }
                IconButton(symbol: "xmark", size: 10, color: tok.text3, label: t("deleteTask")) { store.remove(task) }
            }
            .padding(.leading, grip == nil ? 6 : 2)
            .padding(.trailing, 4)
            .padding(.vertical, 5)
            .contentShape(Rectangle())
            .onTapGesture { withAnimation(.easeOut(duration: 0.24)) { open.toggle() } }
            if open {
                TaskEditor(task: task)
                    .transition(.opacity)
            }
        }
        .background(tok.panel, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(tok.border))
        .opacity(done && !open ? 0.75 : 1)
        .animation(.easeOut(duration: 0.3), value: done)
        .transition(.asymmetric(insertion: .opacity, removal: .opacity.combined(with: .offset(x: 50))))
    }

    /// A tap on the checkbox is never dropped, even if the row goes away mid-animation.
    private func toggle() {
        if task.done {
            let id = task.id
            store.dispatch { $0.toggleTask(id) }
            Sound.pop()
            return
        }
        if checking { return }
        checking = true
        Sound.complete()
        let snapshot = task
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(620))
            guard store.state.tasks.contains(where: { $0.id == snapshot.id && !$0.done }) else { return }
            withAnimation(.easeOut(duration: 0.25)) { store.completeWithFlourish(snapshot) }
            checking = false
        }
    }

    @ViewBuilder private func meta(_ project: Project?) -> some View {
        let due = task.due, time = task.time
        let hasRepeat = task.repeats, subs = task.subs
        if due != nil || time != nil || !task.notes.isEmpty || (showProject && project != nil) || task.priority != "none" || task.pomos > 0 || hasRepeat || !subs.isEmpty {
            Flow(spacing: 8) {
                if task.priority != "none" {
                    Circle().fill(Color(hex: priorityColors[task.priority] ?? "#5f7c8a")).frame(width: 7, height: 7).padding(.vertical, 4)
                }
                if let due, !task.done {
                    let late = isOverdue(due)
                    Text((late ? t("overdueDate", ["date": fmtDue(due)]) : fmtDue(due)) + (time.map { " · \(fmtTime($0))" } ?? ""))
                        .foregroundStyle(late ? tok.danger : isToday(due) ? tok.accent : tok.text2)
                }
                if let time, due == nil, !task.done { hint("clock", fmtTime(time)) }
                if hasRepeat { hint("repeat", t("repeat_\(task.repeatKind)")) }
                if !subs.isEmpty { hint("checklist", "\(subs.filter(\.done).count)/\(subs.count)") }
                if !task.notes.isEmpty { hint("note.text", t("note")) }
                if task.pomos > 0 {
                    HStack(spacing: 3) {
                        FlameShape().stroke(tok.accent, lineWidth: 1).frame(width: 10, height: 10)
                        Text("×\(task.pomos)")
                    }
                }
                if showProject, let project {
                    HStack(spacing: 5) {
                        Circle().fill(Color(hex: project.color)).frame(width: 6, height: 6)
                        Text(project.name).lineLimit(1)
                    }
                }
            }
            .font(tok.ui(12))
            .foregroundStyle(tok.text3)
        }
    }

    private func hint(_ symbol: String, _ text: String) -> some View {
        HStack(spacing: 3) {
            Image(systemName: symbol).font(.system(size: 9))
            Text(text)
        }
    }
}

struct TaskEditor: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    let task: KTask
    @State private var title = ""
    @State private var notes = ""
    @State private var subText = ""
    @State private var saveTask: Task<Void, Never>?
    @FocusState private var subFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            TextField("", text: $title, axis: .vertical)
                .textFieldStyle(.plain)
                .font(tok.display(26))
                .tracking(0.6)
                .onChange(of: title) { scheduleSave() }
            ForEach(task.subs) { s in
                HStack(spacing: 8) {
                    Button {
                        patchSubs(task.subs.map { x in
                            guard x.id == s.id else { return x }
                            var x = x
                            x.j["done"] = .bool(!s.done)
                            return x
                        })
                    } label: {
                        ZStack {
                            RoundedRectangle(cornerRadius: 5).stroke(s.done ? tok.accent : tok.borderStrong)
                            if s.done { Image(systemName: "checkmark").font(.system(size: 10, weight: .bold)).foregroundStyle(tok.accent) }
                        }
                        .frame(width: 18, height: 18)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(s.done ? t("markStepNotDone") : t("markStepDone"))
                    Text(s.text).font(tok.ui(13.5)).foregroundStyle(s.done ? tok.text3 : tok.text).strikethrough(s.done)
                    Spacer()
                    IconButton(symbol: "xmark", size: 9, color: tok.text3, label: t("removeStep")) { patchSubs(task.subs.filter { $0.id != s.id }) }
                }
            }
            HStack(spacing: 8) {
                Image(systemName: "plus").font(.system(size: 10, weight: .semibold)).foregroundStyle(tok.text3)
                TextField(t("addStepPh"), text: $subText)
                    .textFieldStyle(.plain)
                    .font(tok.ui(13.5))
                    .focused($subFocused)
                    .submitLabel(.done)
                    .onSubmit(addSub)
                    .onChange(of: subFocused) { _, f in if !f { addSub() } }
                    .onChange(of: subText) { _, v in if v.count > 80 { subText = String(v.prefix(80)) } }
            }
            TextField(t("addNotePh"), text: $notes, axis: .vertical)
                .textFieldStyle(.plain)
                .font(tok.ui(13.5))
                .lineLimit(2...8)
                .padding(10)
                .background(tok.panel, in: RoundedRectangle(cornerRadius: 9))
                .overlay(RoundedRectangle(cornerRadius: 9).stroke(tok.border))
                .onChange(of: notes) { scheduleSave() }
            Flow {
                DueField(due: Binding(get: { task.due }, set: { v in patch(["due": v.json]) }))
                TimeField(time: Binding(get: { task.time ?? "" }, set: { v in patch(["time": (v.isEmpty ? nil : v).json]) }))
                Menu {
                    ForEach(REPEATS, id: \.self) { r in Button(t("repeat_\(r)")) { patch(["repeat": .str(r)]) } }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "repeat").font(.system(size: 10))
                        Text(t("repeat_\(task.repeatKind)"))
                    }
                    .font(tok.ui(13, .medium)).foregroundStyle(tok.text2)
                    .padding(.horizontal, 11).frame(height: 27).overlay(Capsule().stroke(tok.border))
                }
                .menuStyle(.borderlessButton).menuIndicator(.hidden).fixedSize()
                ForEach(PRIORITIES, id: \.id) { p in
                    Chip(on: task.priority == p.id, action: { patch(["priority": .str(p.id)]) }) {
                        if p.id != "none" { Image(systemName: "flag.fill").font(.system(size: 10)).foregroundStyle(Color(hex: p.color)) }
                        Text(t("prio_\(p.id)"))
                    }
                }
                FolderMenu(projectId: task.projectId) { pid in patch(["projectId": .str(pid)]) }
                MiniButton(title: t("archive")) {
                    saveDrafts()
                    let id = task.id
                    store.dispatch { $0.updateTask(id, ["archived": true]) }
                    store.toast(t("archived"), "🗄", action: (t("undo"), { store.dispatch { $0.updateTask(id, ["archived": false]) } }))
                }
                MiniButton(title: t("delete"), danger: true) {
                    saveDrafts()
                    store.remove(task)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.bottom, 14)
        .padding(.top, 2)
        .onAppear {
            title = task.title
            notes = task.notes
        }
        .onDisappear(perform: saveDrafts) // collapsing the editor commits whatever was typed
    }

    private func patch(_ p: Item) {
        let id = task.id
        store.dispatch { $0.updateTask(id, p) }
    }

    private func patchSubs(_ list: [Sub]) { patch(["subs": .arr(list.map { .obj($0.j) })]) }

    private func addSub() {
        let v = subText.trimmingCharacters(in: .whitespacesAndNewlines)
        if v.isEmpty { return }
        patchSubs(task.subs + [Sub(text: v)])
        subText = ""
    }

    private func scheduleSave() {
        saveTask?.cancel()
        saveTask = Task {
            try? await Task.sleep(for: .milliseconds(500))
            if !Task.isCancelled { saveDrafts() }
        }
    }

    private func saveDrafts() {
        saveTask?.cancel()
        guard let cur = store.state.tasks.first(where: { $0.id == task.id }) else { return }
        var p: Item = [:]
        let clean = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !clean.isEmpty && clean != cur.title { p["title"] = .str(clean) }
        if notes != cur.notes { p["notes"] = .str(notes) }
        if !p.isEmpty { patch(p) }
    }
}

struct EmptyStateView: View {
    @Environment(\.tok) private var tok
    var kind: String
    var body: some View {
        let icons = ["search": "🔍", "today": "✨", "upcoming": "🌅", "all": "🪐", "project": "🎯"]
        let k = icons[kind] != nil ? kind : "all"
        VStack(spacing: 8) {
            Text(icons[k]!).font(.system(size: 40))
            Text(t("empty_\(k)_title")).font(tok.ui(16, .semibold)).foregroundStyle(tok.text)
            Text(t("empty_\(k)_body")).font(tok.ui(14)).foregroundStyle(tok.text2).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 56)
    }
}

struct ArchiveView: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    var body: some View {
        let items = store.state.tasks.filter(\.archived).sorted { $0.createdAt > $1.createdAt }
        if items.isEmpty {
            BareEmpty(symbol: "archivebox", text: t("archiveEmpty"))
        } else {
            LazyVStack(spacing: 8) {
                ForEach(items) { x in
                    ListRow(task: x, done: x.done) {
                        MiniButton(title: t("restore")) {
                            store.dispatch { $0.updateTask(x.id, ["archived": false]) }
                            store.toast(t("restoredFromArchive"), "↩")
                        }
                        MiniButton(title: t("delete"), danger: true) {
                            store.dispatch { $0.deleteTask(x.id) }
                            store.toast(t("movedToTrash"), "🗑")
                        }
                    }
                }
            }
            .padding(.top, 18)
        }
    }
}

struct TrashView: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    var body: some View {
        let items = store.state.trash.sorted { $0.deletedAt > $1.deletedAt }
        if items.isEmpty {
            BareEmpty(symbol: "trash", text: t("trashEmpty"))
        } else {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text(t("trashHead")).font(tok.ui(13)).foregroundStyle(tok.text2)
                    Spacer()
                    MiniButton(title: t("emptyNow"), danger: true) {
                        let was = store.state.trash
                        store.dispatch { $0.trash = [] }
                        store.toast(tn("erasedTasks", was.count), "🗑", action: (t("undo"), { store.dispatch { $0.restoreTrash(was) } }))
                    }
                }
                LazyVStack(spacing: 8) {
                    ForEach(items) { x in
                        ListRow(task: x, done: true) {
                            Text(timeLeft(max(0, x.deletedAt + TRASH_TTL - Clock.ms))).font(tok.mono(11.5)).foregroundStyle(tok.text3)
                            MiniButton(title: t("restore")) {
                                store.dispatch { $0.restoreTasks([x.id]) }
                                store.toast(t("restored"), "↩")
                            }
                            MiniButton(title: t("deleteNow"), danger: true) { store.dispatch { $0.purgeTrash(x.id) } }
                        }
                    }
                }
            }
            .padding(.top, 18)
        }
    }

    private func timeLeft(_ ms: Double) -> String {
        if ms <= 0 { return t("now") }
        let days = Int(ms / 86_400_000)
        if days >= 1 { return t("daysShort", ["n": String(days)]) }
        let hours = Int(ms / 3_600_000)
        if hours >= 1 { return t("hoursShort", ["n": String(hours)]) }
        return t("minutesShort", ["n": String(max(1, Int(ms / 60000)))])
    }
}

struct ListRow<Actions: View>: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    let task: KTask
    var done: Bool
    @ViewBuilder var actions: () -> Actions
    var body: some View {
        let p = store.state.projects.first { $0.id == task.projectId }
        VStack(alignment: .leading, spacing: 8) {
            Text(task.title).font(tok.ui(14.5, .medium)).foregroundStyle(done ? tok.text3 : tok.text).strikethrough(done).frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 8) {
                if let p {
                    Circle().fill(Color(hex: p.color)).frame(width: 6, height: 6)
                    Text(p.name).font(tok.ui(12)).foregroundStyle(tok.text3).lineLimit(1)
                }
                Spacer(minLength: 4)
                actions()
            }
        }
        .padding(12)
        .background(tok.panel, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(tok.border))
    }
}

struct BareEmpty: View {
    @Environment(\.tok) private var tok
    var symbol: String
    var text: String
    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: symbol).font(.system(size: 22)).foregroundStyle(tok.text3)
            Text(text).font(tok.ui(14)).foregroundStyle(tok.text2).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 64)
    }
}
