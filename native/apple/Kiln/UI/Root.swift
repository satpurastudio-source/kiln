import SwiftUI

enum SheetKind: String, Identifiable { case settings, help, feedback, whatsnew; var id: String { rawValue } }
struct ProjectEdit: Identifiable { let id = uid(); var project: Project? }

struct RootView: View {
    @Environment(Store.self) private var store
    @State private var ambient = false
    @State private var ambientCustomize = false
    var body: some View {
        let s = store.state
        let tok = Tok(s)
        ZStack {
            Backdrop()
            if !s.onboarded { OnboardingView() }
            else if s.profile == nil { LoginView() }
            else if ambient { AmbientView(customize: ambientCustomize) { ambient = false } }
            else { MainView { c in ambientCustomize = c; ambient = true } }
            Confetti(trigger: store.confetti, colors: [tok.accent, Color(hex: "#d85a30"), Color(hex: "#d9a441"), Color(hex: "#f4efe4")])
            ToastStack()
        }
        .environment(\.tok, tok)
        .environment(\.layoutDirection, s.language == "ur" ? .rightToLeft : .leftToRight)
        .preferredColorScheme(s.theme == "dark" ? .dark : .light)
        .tint(tok.accent)
        .animation(.easeOut(duration: 0.3), value: s.theme)
        .background { GeometryReader { g in Color.clear.onAppear { store.windowHeight = g.size.height }.onChange(of: g.size.height) { _, h in store.windowHeight = h } } }
        #if os(macOS)
        .frame(minWidth: 720, minHeight: 520)
        #endif
    }
}

struct MainView: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    var openAmbient: (Bool) -> Void
    @State private var drawer = false
    @State private var palette = false
    @State private var sheet: SheetKind?
    @State private var projectEdit: ProjectEdit?
    @State private var query = ""
    @State private var pendingQuery = ""
    @State private var focusAdd = 0
    @State private var focusSearch = 0
    private let drawerWidth: CGFloat = 288

    var body: some View {
        GeometryReader { g in
            let wide = g.size.width >= 860
            ZStack(alignment: .topLeading) {
                HStack(spacing: 0) {
                    if wide {
                        SidebarView(onNewFolder: { projectEdit = ProjectEdit() }, onEdit: { projectEdit = ProjectEdit(project: $0) }, onSettings: { sheet = .settings }, close: {})
                            .frame(width: drawerWidth)
                        Rectangle().fill(tok.border).frame(width: 1).ignoresSafeArea()
                    }
                    content(wide: wide)
                }
                if !wide { drawerLayer(height: g.size.height) }
                FocusLayer()
                MiniCalendarLauncher()
                CompleteZone()
                if palette {
                    PaletteView(close: { palette = false }, sheet: $sheet, newFolder: { projectEdit = ProjectEdit() }, openAmbient: { openAmbient(false) }, openTask: openTask)
                        .transition(.opacity)
                }
                shortcuts
            }
        }
        .sheet(item: $sheet) { kind in
            Group {
                switch kind {
                case .settings: SettingsView(openSheet: { next in
                    sheet = nil
                    Task { try? await Task.sleep(for: .milliseconds(350)); sheet = next }
                }, openAmbient: { c in sheet = nil; openAmbient(c) })
                case .help: HelpView()
                case .feedback: FeedbackView()
                case .whatsnew: WhatsNewView()
                }
            }
            .environment(\.tok, tok)
            .environment(store)
        }
        .sheet(item: $projectEdit) { edit in
            ProjectEditor(project: edit.project).environment(\.tok, tok).environment(store)
        }
        .onChange(of: store.state.view.key) {
            query = pendingQuery
            pendingQuery = ""
        }
        .task {
            await Reminders.shared.askOnFirstLaunch()
            store.remindersOn = Reminders.shared.optedIn
            try? await Task.sleep(for: .milliseconds(1200))
            if WhatsNew.shouldShow(store.state.tasks) { sheet = sheet ?? .whatsnew }
        }
    }

    private func openTask(_ task: KTask) {
        let v = Screen(type: "project", projectId: task.projectId)
        if v.key == store.state.view.key { query = task.title }
        else {
            pendingQuery = task.title
            store.dispatch { $0.view = v }
        }
    }

    @ViewBuilder private func content(wide: Bool) -> some View {
        let v = store.state.view
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 8) {
                if !wide {
                    IconButton(symbol: "line.3.horizontal", size: 16, label: t("openMenu")) {
                        hideKeyboard()
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { drawer = true }
                    }
                        .padding(.top, 4)
                }
                HeaderView(query: $query, focusSearch: focusSearch, openPalette: { palette = true })
            }
            .padding(.horizontal, wide ? 34 : 14)
            .padding(.top, wide ? 28 : 8)
            ScrollViewReader { _ in
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        switch v.type {
                        case "calendar": CalendarView()
                        case "insights": InsightsView()
                        case "archive": ArchiveView()
                        case "trash": TrashView()
                        default:
                            GestureTips(wide: wide)
                            QuickAddView(focusTick: focusAdd)
                            TaskListView(query: query)
                        }
                    }
                    .frame(maxWidth: 820, alignment: .leading)
                    .padding(.horizontal, wide ? 34 : 14)
                    .padding(.bottom, 110)
                    .id(v.key)
                    .transition(.opacity)
                }
                .scrollDismissesKeyboard(.interactively)
                .refreshable { palette = true }
            }
        }
    }

    @ViewBuilder private func drawerLayer(height: CGFloat) -> some View {
        if drawer {
            tok.scrim.ignoresSafeArea()
                .transition(.opacity)
                .onTapGesture { withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { drawer = false } }
        }
        if drawer {
            SidebarView(onNewFolder: { drawer = false; projectEdit = ProjectEdit() }, onEdit: { p in drawer = false; projectEdit = ProjectEdit(project: p) }, onSettings: { drawer = false; sheet = .settings }, close: { withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { drawer = false } })
                .frame(width: drawerWidth)
                .background(tok.bg.ignoresSafeArea())
                .transition(.move(edge: .leading))
                .gesture(DragGesture(minimumDistance: 24).onEnded { v in
                    if v.translation.width < -50 { withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { drawer = false } }
                })
        } else {
            #if os(iOS)
            Color.clear.frame(width: 22, height: height)
                .contentShape(Rectangle())
                .gesture(DragGesture(minimumDistance: 14).onEnded { v in
                    if v.translation.width > 40 {
                        Tips.markSeen("swipe-nav")
                        hideKeyboard()
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { drawer = true }
                    }
                })
            #endif
        }
    }

    /// Hardware keyboards: the same keys as the web app. A focused text field gets typed keys first.
    private var shortcuts: some View {
        ZStack {
            Button("") { palette.toggle() }.keyboardShortcut("k", modifiers: .command)
            if !palette && sheet == nil && projectEdit == nil {
                Button("") { focusAdd += 1 }.keyboardShortcut("n", modifiers: [])
                Button("") { focusSearch += 1 }.keyboardShortcut("/", modifiers: [])
                Button("") { sheet = .help }.keyboardShortcut("?", modifiers: [])
            }
            if palette { Button("") { palette = false }.keyboardShortcut(.cancelAction) }
        }
        .opacity(0)
        .frame(width: 0, height: 0)
        .accessibilityHidden(true)
    }
}

struct ToastStack: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    var body: some View {
        VStack(spacing: 8) {
            Spacer()
            ForEach(store.toasts) { x in
                HStack(spacing: 8) {
                    Text(x.icon).font(.system(size: 14))
                    Text(x.message).font(tok.ui(13.25, .medium)).foregroundStyle(tok.text).lineLimit(2)
                    if let label = x.actionLabel {
                        Button(label) {
                            x.action?()
                            store.dismiss(x.id)
                        }
                        .buttonStyle(.plain)
                        .font(tok.ui(13.25, .semibold))
                        .foregroundStyle(tok.accent)
                        .padding(.leading, 4)
                    }
                }
                .padding(.horizontal, 15)
                .padding(.vertical, 11)
                .background(tok.dark ? tok.raise : .white, in: Capsule())
                .overlay(Capsule().stroke(tok.border))
                .shadow(color: .black.opacity(tok.dark ? 0.5 : 0.14), radius: 16, y: 8)
                .onTapGesture { if x.sticky && x.action == nil { store.dismiss(x.id) } }
                .allowsHitTesting(x.action != nil || x.sticky)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .padding(.bottom, 26)
        .padding(.horizontal, 16)
        .allowsHitTesting(store.toasts.contains { $0.action != nil || $0.sticky })
    }
}

/// One-time coaching hints. Dismissed tips are remembered and never nag again.
enum Tips {
    private static func read() -> [String] {
        (Prefs.string("kiln-tips").flatMap { JSON.parse($0) }?.array ?? []).compactMap(\.string)
    }
    static func seen(_ id: String) -> Bool { read().contains(id) }
    static func markSeen(_ id: String) {
        var r = read()
        guard !r.contains(id) else { return }
        r.append(id)
        Prefs.set("kiln-tips", JSON.arr(r.map(JSON.str)).stable)
    }
}

struct Tip: View {
    @Environment(\.tok) private var tok
    let id: String
    let text: String
    @State private var gone = false
    var body: some View {
        if !gone && !Tips.seen(id) {
            HStack(alignment: .top, spacing: 9) {
                Image(systemName: "sparkles").font(.system(size: 12)).foregroundStyle(tok.accent).padding(.top, 2)
                Text(text).font(tok.ui(13)).foregroundStyle(tok.text2).frame(maxWidth: .infinity, alignment: .leading)
                Button {
                    Tips.markSeen(id)
                    withAnimation { gone = true }
                } label: {
                    Image(systemName: "xmark").font(.system(size: 10, weight: .semibold)).foregroundStyle(tok.text3).padding(4)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(t("close"))
            }
            .padding(12)
            .background(tok.accent.opacity(0.07), in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(tok.accent.opacity(0.2)))
            .padding(.top, 12)
        }
    }
}

struct GestureTips: View {
    var wide: Bool
    var body: some View {
        #if os(iOS)
        if !wide {
            if !Tips.seen("swipe-nav") { Tip(id: "swipe-nav", text: t("tipSwipe")) }
            else if !Tips.seen("pull-search") { Tip(id: "pull-search", text: t("tipPull")) }
        }
        #endif
    }
}

struct SidebarView: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    var onNewFolder: () -> Void
    var onEdit: (Project) -> Void
    var onSettings: () -> Void
    var close: () -> Void

    var body: some View {
        let s = store.state
        let active = s.tasks.filter { !$0.done && !$0.archived }
        let today = active.filter { isToday($0.due) || isOverdue($0.due) }.count
        let tp = s.todayProgress
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 11) {
                BrandMark(size: 34)
                VStack(alignment: .leading, spacing: 1) {
                    (Text("kiln").foregroundStyle(tok.text) + Text(".").foregroundStyle(tok.accent)).font(tok.ui(16, .medium)).tracking(0.6)
                    Text(t("brandTag")).font(tok.mono(10.5)).foregroundStyle(tok.text3)
                }
            }
            .padding(.bottom, 14)
            nav("today", "sun.max", t("nav_today"), count: today)
            nav("upcoming", "clock", t("nav_upcoming"), count: active.filter { $0.due != nil }.count)
            nav("calendar", "calendar", t("nav_calendar"))
            nav("all", "square.3.layers.3d", t("nav_all"), count: active.count)
            nav("insights", "chart.bar", t("nav_insights"))
            HStack {
                Text(t("folders").uppercased()).font(tok.mono(11.5, medium: true)).tracking(1.8).foregroundStyle(tok.text3)
                Spacer()
                IconButton(symbol: "plus", size: 12, color: tok.text3, label: t("newFolder"), action: onNewFolder)
            }
            .padding(.leading, 12)
            .padding(.top, 12)
            ScrollView {
                VStack(spacing: 3) {
                    ForEach(s.projects) { p in folder(p) }
                }
            }
            .scrollIndicators(.never)
            VStack(spacing: 3) {
                nav("archive", "archivebox", t("nav_archive"), count: s.tasks.filter(\.archived).count)
                nav("trash", "trash", t("nav_trash"), count: s.trash.count)
            }
            .padding(.top, 6)
            if s.profile?["cloud"]?.boolean == true, store.syncStatus == .offline || store.syncStatus == .error {
                HStack(spacing: 7) {
                    Circle().fill(Color(hex: "#d98e32")).frame(width: 7, height: 7)
                    Text(store.syncStatus == .offline ? t("offlineSaved") : t("notSyncedRetrying")).font(tok.ui(12)).foregroundStyle(tok.text2)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
            }
            HStack(spacing: 10) {
                ProgressRing(size: 34, stroke: 3.4, pct: Double(tp.pct))
                (Text(fmtNum(tp.done)).fontWeight(.semibold).foregroundColor(tok.text) + Text(" \(t("doneToday"))\n") + Text(fmtNum(tp.active)).fontWeight(.semibold).foregroundColor(tok.text) + Text(" \(t("toGo"))"))
                    .font(tok.ui(11.5)).foregroundStyle(tok.text2).lineLimit(2).minimumScaleFactor(0.8)
                Spacer(minLength: 0)
                IconButton(symbol: s.sound ? "bell" : "bell.slash", size: 13, label: s.sound ? t("muteSounds") : t("unmuteSounds")) { store.dispatch { $0.sound.toggle() } }
                IconButton(symbol: s.theme == "dark" ? "moon" : "sun.max", size: 13, label: t("toggleTheme")) { store.dispatch { $0.theme = $0.theme == "dark" ? "light" : "dark" } }
                IconButton(symbol: "gearshape", size: 13, label: t("settings"), action: onSettings)
            }
            .padding(.top, 10)
        }
        .padding(EdgeInsets(top: 20, leading: 16, bottom: 14, trailing: 14))
        .background(tok.panel.ignoresSafeArea())
    }

    private func nav(_ type: String, _ symbol: String, _ label: String, count: Int = 0) -> some View {
        let on = store.state.view.type == type
        return Button {
            store.dispatch { $0.view = Screen(type: type) }
            close()
        } label: {
            HStack(spacing: 11) {
                Image(systemName: on && UIImageFill.has(symbol) ? symbol + ".fill" : symbol).font(.system(size: 14)).frame(width: 18).foregroundStyle(on ? tok.accent : tok.text2)
                Text(label).lineLimit(1)
                Spacer(minLength: 0)
                if count > 0 { Text(fmtNum(count)).font(tok.mono(11.5)).foregroundStyle(tok.text3) }
            }
            .font(tok.ui(13.5, .medium))
            .foregroundStyle(on ? tok.text : tok.text2)
            .padding(.horizontal, 12)
            .frame(minHeight: 38)
            .background(on ? tok.accent.opacity(0.12) : .clear, in: RoundedRectangle(cornerRadius: 9))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func folder(_ p: Project) -> some View {
        let on = store.state.view.type == "project" && store.state.view.projectId == p.id
        let prog = store.state.projectProgress(p.id)
        return HStack(spacing: 0) {
            Button {
                store.dispatch { $0.view = Screen(type: "project", projectId: p.id) }
                close()
            } label: {
                HStack(spacing: 11) {
                    Circle().fill(Color(hex: p.color)).frame(width: 9, height: 9).frame(width: 18)
                    Text(p.name).lineLimit(1)
                    Spacer(minLength: 0)
                    if prog.total > 0 { ProgressRing(size: 17, stroke: 2.4, pct: Double(prog.pct)) }
                }
                .font(tok.ui(13.5, .medium))
                .foregroundStyle(on ? tok.text : tok.text2)
                .padding(.leading, 12)
                .padding(.trailing, 4)
                .frame(minHeight: 38)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("folder-\(p.name)")
            IconButton(symbol: "pencil", size: 11, color: tok.text3, label: t("editFolder")) { onEdit(p) }
        }
        .background(on ? tok.accent.opacity(0.12) : .clear, in: RoundedRectangle(cornerRadius: 9))
    }
}

private enum UIImageFill {
    static func has(_ s: String) -> Bool { ["sun.max", "clock", "calendar", "chart.bar", "archivebox"].contains(s) && s != "calendar" }
}

struct CompleteZone: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    var body: some View {
        VStack {
            Spacer()
            if store.dragging {
                HStack(spacing: 9) {
                    FlameShape().stroke(store.dragHot ? .white : tok.accent, lineWidth: 1.6).frame(width: 20, height: 20)
                    Text(store.dragHot ? t("releaseToComplete") : t("dropToComplete")).font(tok.ui(14, .semibold))
                }
                .foregroundStyle(store.dragHot ? .white : tok.text)
                .padding(.horizontal, 22)
                .padding(.vertical, 14)
                .background(store.dragHot ? tok.accent : tok.raise, in: Capsule())
                .overlay(Capsule().stroke(tok.accent.opacity(0.5)))
                .scaleEffect(store.dragHot ? 1.04 : 1)
                .padding(.bottom, 34)
                .transition(.move(edge: .bottom))
            }
        }
        .frame(maxWidth: .infinity)
        .allowsHitTesting(false)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: store.dragging)
        .animation(.spring(response: 0.25, dampingFraction: 0.6), value: store.dragHot)
    }
}
