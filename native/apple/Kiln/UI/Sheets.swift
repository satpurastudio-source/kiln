import SwiftUI
import UniformTypeIdentifiers

enum WhatsNew {
    private static let latest = CHANGELOG[0].id
    /// Once, to people who were here before them; brand-new people are quietly marked up to date.
    static func shouldShow(_ tasks: [KTask]) -> Bool {
        let seen = Prefs.string("kiln-whatsnew-seen")
        if seen == latest { return false }
        let returning = seen != nil || tasks.contains { $0.createdAt > 0 && Clock.ms - $0.createdAt > 864e5 }
        if !returning { markSeen() }
        return returning
    }
    static func markSeen() { Prefs.set("kiln-whatsnew-seen", latest) }
}

/// A title, a scrolling body and a Done button — shared by every sheet.
struct SheetShell<Content: View>: View {
    @Environment(\.tok) private var tok
    @Environment(\.dismiss) private var dismiss
    var title: String
    var onDone: (() -> Void)?
    @ViewBuilder var content: () -> Content
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(title).font(tok.display(30)).tracking(0.6).foregroundStyle(tok.text)
                Spacer()
                Button(t("done")) {
                    onDone?()
                    dismiss()
                }
                .buttonStyle(.plain)
                .font(tok.ui(14.5, .semibold))
                .foregroundStyle(tok.accent)
                .keyboardShortcut(.cancelAction)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            ScrollView {
                VStack(alignment: .leading, spacing: 26) { content() }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 30)
            }
        }
        .background(tok.bg)
        #if os(macOS)
        .frame(width: 520, height: 640)
        #endif
    }
}

struct SetSection<Content: View>: View {
    @Environment(\.tok) private var tok
    var symbol: String?
    var title: String?
    @ViewBuilder var content: () -> Content
    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            if let title {
                HStack(spacing: 6) {
                    if let symbol { Image(systemName: symbol).font(.system(size: 11)) }
                    Text(title.uppercased()).font(tok.mono(11.5, medium: true)).tracking(1.4)
                }
                .foregroundStyle(tok.text3)
            }
            content()
        }
    }
}

struct SetAction: View {
    @Environment(\.tok) private var tok
    var symbol: String?
    var title: String
    var danger = false
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if let symbol { Image(systemName: symbol).font(.system(size: 13)).frame(width: 18) }
                Text(title).font(tok.ui(14, .medium))
                Spacer()
            }
            .foregroundStyle(danger ? tok.danger : tok.text)
            .padding(.horizontal, 13)
            .frame(minHeight: 44)
            .background(tok.panel, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(tok.border))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct Hint: View {
    @Environment(\.tok) private var tok
    var text: String
    var body: some View { Text(text).font(tok.ui(12.5)).foregroundStyle(tok.text3).fixedSize(horizontal: false, vertical: true) }
}

struct SetRow<Trailing: View>: View {
    @Environment(\.tok) private var tok
    var title: String
    var sub: String?
    @ViewBuilder var trailing: () -> Trailing
    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(tok.ui(14)).foregroundStyle(tok.text)
                if let sub { Text(sub).font(tok.ui(12)).foregroundStyle(tok.text3) }
            }
            Spacer(minLength: 8)
            trailing()
        }
    }
}

struct Seg<T: Hashable>: View {
    @Environment(\.tok) private var tok
    var value: T
    var options: [(id: T, label: String)]
    var pick: (T) -> Void
    var body: some View {
        HStack(spacing: 2) {
            ForEach(options, id: \.id) { o in
                Button { pick(o.id) } label: {
                    Text(o.label).font(tok.ui(12.5, .medium)).lineLimit(1).minimumScaleFactor(0.8)
                        .foregroundStyle(value == o.id ? tok.text : tok.text3)
                        .padding(.horizontal, 10)
                        .frame(minHeight: 30)
                        .background(value == o.id ? tok.panelHover : .clear, in: RoundedRectangle(cornerRadius: 7))
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(2)
        .background(tok.border.opacity(0.5), in: RoundedRectangle(cornerRadius: 9))
    }
}

struct LanguagePicker: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    var body: some View {
        let current = store.state.language
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 7) {
            ForEach(LANGUAGES) { l in
                Button { store.dispatch { $0.setSettings(["language": .str(l.code)]) } } label: {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(l.native).font(tok.ui(14, .medium)).foregroundStyle(tok.text)
                        Text(l.name).font(tok.ui(11.5)).foregroundStyle(tok.text3)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(current == l.code ? tok.accent.opacity(0.12) : tok.panel, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(current == l.code ? tok.accent.opacity(0.6) : tok.border))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct AccentPicker: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    @State private var custom = Color(hex: "#d85a30")
    private var isCustom: Bool { store.state.settings["accent"]?.string == "custom" }
    var body: some View {
        let picked = store.state.settings["accent"]?.string
        HStack(spacing: 11) {
            ForEach(ACCENTS, id: \.id) { a in
                Button { store.dispatch { $0.setSettings(["accent": .str(a.id)]) } } label: {
                    Circle().fill(Color(hex: a.accent)).frame(width: 30, height: 30)
                        .overlay(Circle().stroke(tok.text, lineWidth: picked == a.id ? 2 : 0).padding(-3))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(t("accent_\(a.id)"))
            }
            ColorPicker(t("pickCustomColor"), selection: Binding(get: {
                Color(hex: store.state.settings["customAccent"]?.string ?? "#d85a30")
            }, set: { c in
                if let hex = c.hexString { store.dispatch { $0.setSettings(["accent": "custom", "customAccent": .str(hex)]) } }
            }), supportsOpacity: false)
            .labelsHidden()
            .overlay(Circle().stroke(tok.text, lineWidth: isCustom ? 2 : 0).padding(-3).allowsHitTesting(false))
        }
    }
}

extension Color {
    var hexString: String? {
        #if os(iOS)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        guard UIColor(self).getRed(&r, green: &g, blue: &b, alpha: &a) else { return nil }
        #else
        guard let c = NSColor(self).usingColorSpace(.sRGB) else { return nil }
        let (r, g, b) = (c.redComponent, c.greenComponent, c.blueComponent)
        #endif
        func v(_ x: CGFloat) -> Int { max(0, min(255, Int((x * 255).rounded()))) }
        return String(format: "#%02x%02x%02x", v(r), v(g), v(b))
    }
}

struct JSONFile: FileDocument {
    static let readableContentTypes = [UTType.json]
    var data: Data
    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws { data = configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}

struct SettingsView: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    @Environment(\.dismiss) private var dismiss
    var openSheet: (SheetKind) -> Void
    var openAmbient: (Bool) -> Void
    @State private var name = ""
    @State private var confirmDelete = false
    @State private var busy = false
    @State private var signOutStuck = false
    @State private var restore: Snapshot?
    @State private var exporting = false
    @State private var importing = false

    var body: some View {
        let s = store.state, settings = s.settings
        let cloud = s.profile?["cloud"]?.boolean == true
        let email = s.profile?["email"]?.string
        SheetShell(title: t("settings"), onDone: commitName) {
            SetSection(symbol: "person", title: t("you")) {
                KField(placeholder: t("yourName"), text: $name, limit: 40, submit: commitName)
                Hint(text: t("displayNameHint"))
                if cloud {
                    HStack(spacing: 7) {
                        Circle().fill(store.syncStatus == .synced ? Color(hex: "#6f9b7a") : store.syncStatus == .syncing ? tok.accent : Color(hex: "#d98e32")).frame(width: 7, height: 7)
                        Text((email.map { "\($0) · " } ?? "") + syncLabel).font(tok.ui(12.5)).foregroundStyle(tok.text3)
                    }
                    AccountView(email: email)
                }
            }
            SetSection(symbol: "globe", title: t("language") == "Language" ? "Language" : "Language · \(t("language"))") { LanguagePicker() }
            SetSection(symbol: "sparkle", title: t("accentColor")) { AccentPicker() }
            SetSection(symbol: "sun.max", title: t("appearance")) {
                SetRow(title: t("theme")) {
                    Seg(value: s.theme, options: [("light", t("light")), ("dark", t("dark"))]) { v in store.dispatch { $0.theme = v } }
                }
                SetRow(title: t("textSize"), sub: t("textSizeSub")) {
                    Button("\(Int((s.textScale * 100).rounded()))%") { store.dispatch { $0.setSettings(["textScale": 1]) } }
                        .buttonStyle(.plain).font(tok.mono(12.5)).foregroundStyle(tok.text2)
                }
                HStack {
                    Text("A").font(.system(size: 12)).foregroundStyle(tok.text3)
                    Slider(value: Binding(get: { s.textScale }, set: { v in store.dispatch { $0.setSettings(["textScale": .num((v * 20).rounded() / 20)]) } }), in: TEXT_SCALE.min...TEXT_SCALE.max, step: TEXT_SCALE.step)
                    Text("A").font(.system(size: 18)).foregroundStyle(tok.text3)
                }
                SetRow(title: t("soundEffects")) {
                    Toggle("", isOn: Binding(get: { s.sound }, set: { v in store.dispatch { $0.sound = v } })).labelsHidden()
                }
                SetRow(title: t("reducedVisuals"), sub: t("reducedVisualsSub")) {
                    Toggle("", isOn: Binding(get: { s.reducedEffects }, set: { v in store.dispatch { $0.setSettings(["reducedEffects": .bool(v)]) } })).labelsHidden()
                }
            }
            SetSection(symbol: "flag", title: t("newTaskDefaults")) {
                SetRow(title: t("dueDate")) {
                    Seg(value: settings["defaultDue"]?.string ?? "today", options: [("none", t("noDate")), ("today", t("today")), ("tomorrow", t("tomorrow"))]) { v in store.dispatch { $0.setSettings(["defaultDue": .str(v)]) } }
                }
                VStack(alignment: .leading, spacing: 8) {
                    Text(t("priority")).font(tok.ui(14)).foregroundStyle(tok.text)
                    Flow {
                        ForEach(PRIORITIES, id: \.id) { p in
                            Chip(on: settings["defaultPriority"]?.string == p.id, action: { store.dispatch { $0.setSettings(["defaultPriority": .str(p.id)]) } }) {
                                if p.id != "none" { Image(systemName: "flag.fill").font(.system(size: 10)).foregroundStyle(Color(hex: p.color)) }
                                Text(t("prio_\(p.id)"))
                            }
                        }
                    }
                }
                SetRow(title: t("defaultTime")) {
                    TimeField(time: Binding(get: { settings["defaultTime"]?.string ?? "" }, set: { v in store.dispatch { $0.setSettings(["defaultTime": .str(v)]) } }))
                }
            }
            SetSection(symbol: "bell", title: t("notifications")) {
                SetRow(title: t("taskReminders")) {
                    Toggle("", isOn: Binding(get: { store.remindersOn }, set: { _ in toggleReminders() })).labelsHidden()
                }
                if store.remindersOn {
                    Hint(text: t("remindersHint"))
                    SetRow(title: t("checkItWorks")) {
                        MiniButton(title: t("sendTest")) {
                            Task {
                                if await Reminders.shared.sendTest() { store.toast(t("testOnWay"), "🔔") }
                                else { store.remindersOn = await Reminders.shared.turnOn(store: store) }
                            }
                        }
                    }
                }
            }
            SetSection(symbol: "flame", title: t("ambient")) {
                Hint(text: t("ambientHint"))
                SetAction(symbol: "flame", title: t("openAmbient")) { openAmbient(false) }
                SetAction(symbol: "sparkle", title: t("customizeAmbient")) { openAmbient(true) }
                if !(settings["ambient"]?.object ?? [:]).isEmpty {
                    SetAction(title: t("resetAmbient")) { store.dispatch { $0.setSettings(["ambient": .obj([:])]) } }
                }
            }
            SetSection(symbol: "info.circle", title: t("helpFeedback")) {
                SetAction(symbol: "keyboard", title: t("helpShortcuts")) { openSheet(.help) }
                SetAction(symbol: "envelope", title: t("sendFeedback")) { openSheet(.feedback) }
                SetAction(symbol: "gift", title: t("whatsNew")) { openSheet(.whatsnew) }
            }
            SetSection {
                SetAction(symbol: "info.circle", title: t("replayTour")) {
                    commitName()
                    store.dispatch {
                        $0.onboarded = false
                        $0.replayTour = true
                    }
                    dismiss()
                }
                SetAction(symbol: "arrow.down.circle", title: t("downloadBackup")) { exporting = true }
                SetAction(symbol: "arrow.up.circle", title: t("restoreBackup")) { importing = true }
                if let r = restore {
                    ConfirmBox(text: t("restoreConfirm", ["folders": tn("folders", r.projects.count), "tasks": tn("tasks", r.tasks.count)])) {
                        MiniButton(title: t("cancel")) { restore = nil }
                        MiniButton(title: t("restoreBackupBtn"), danger: true) { applyRestore(r) }
                    }
                }
                if cloud && !signOutStuck {
                    SetAction(title: busy ? t("savingChanges") : t("signOut"), danger: true) { signOut() }.disabled(busy)
                }
                if signOutStuck {
                    ConfirmBox(text: t("signOutStuck")) {
                        MiniButton(title: t("staySignedIn")) { signOutStuck = false }
                        MiniButton(title: t("downloadBackupShort")) { exporting = true }
                        MiniButton(title: t("signOutAnyway"), danger: true) { signOut(force: true) }
                    }
                }
            }
            SetSection(title: t("dangerZone")) {
                if !confirmDelete {
                    SetAction(title: t("deleteAccount"), danger: true) { confirmDelete = true }
                } else {
                    ConfirmBox(text: cloud ? t("deleteConfirmCloud") : t("deleteConfirmLocal")) {
                        MiniButton(title: t("cancel")) { confirmDelete = false }
                        MiniButton(title: busy ? t("deleting") : t("yesDeleteAll"), danger: true) { deleteAccount() }.disabled(busy)
                    }
                }
                Hint(text: t("exportFirst"))
                HStack(spacing: 8) {
                    Button(t("privacy")) { openURL(Backend.webURL + "privacy.html") }
                    Text("·")
                    Button(t("terms")) { openURL(Backend.webURL + "terms.html") }
                }
                .buttonStyle(.plain)
                .font(tok.ui(12.5))
                .foregroundStyle(tok.text2)
            }
        }
        .onAppear { name = s.profile?["name"]?.string ?? "" }
        .fileExporter(isPresented: $exporting, document: JSONFile(data: backupFile(s)), contentType: .json, defaultFilename: "kiln-backup-\(todayStr()).json") { result in
            if case .success = result { store.toast(t("backupDownloaded"), "⬇") }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
            guard case .success(let url) = result else { return }
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            do {
                restore = try parseBackup(try Data(contentsOf: url))
            } catch let e as BackupError {
                store.toast(e.message, "⚠")
            } catch {
                store.toast(t("backupNotJson"), "⚠")
            }
        }
    }

    private var syncLabel: String {
        switch store.syncStatus {
        case .synced: return t("syncSynced")
        case .syncing: return t("syncSyncing")
        case .offline: return t("syncOffline")
        case .error: return t("syncError")
        case .idle: return t("connecting")
        }
    }

    private func commitName() {
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let current = store.state.profile?["name"]?.string ?? ""
        if !clean.isEmpty && clean != current {
            store.dispatch { $0.profile?["name"] = .str(clean) }
            store.toast(t("nameUpdated"), "✓")
        } else {
            name = current
        }
    }

    private func toggleReminders() {
        if store.remindersOn {
            Reminders.shared.disable()
            store.remindersOn = false
            store.toast(t("remindersOff"), "🔕")
        } else {
            Task { store.remindersOn = await Reminders.shared.turnOn(store: store) }
        }
    }

    /// Current tasks are swapped out, not destroyed — they go to the trash.
    private func applyRestore(_ r: Snapshot) {
        let incoming = Set(r.tasks.compactMap { $0["id"]?.string })
        store.dispatch { st in
            st.deleteTasks(st.tasks.filter { !incoming.contains($0.id) }.map(\.id))
            st.hydrate(r)
        }
        store.toast(tn("restoredTasks", r.tasks.count), "↩")
        restore = nil
        dismiss()
    }

    private func signOut(force: Bool = false) {
        busy = true
        Task {
            let ok = await store.signOut(force: force)
            busy = false
            if ok { dismiss() } else { signOutStuck = true }
        }
    }

    private func deleteAccount() {
        busy = true
        Task {
            let ok = await store.deleteAccount()
            busy = false
            if ok { dismiss() } else {
                confirmDelete = false
                store.toast(t("deleteFailed"), "⚠")
            }
        }
    }
}

struct ConfirmBox<Buttons: View>: View {
    @Environment(\.tok) private var tok
    var text: String
    @ViewBuilder var buttons: () -> Buttons
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(text).font(tok.ui(13.5)).foregroundStyle(tok.text).fixedSize(horizontal: false, vertical: true)
            Flow { buttons() }
        }
        .padding(13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tok.danger.opacity(0.07), in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(tok.danger.opacity(0.25)))
    }
}

/// Change the sign-in email or password. Email changes are confirmed from the inbox.
struct AccountView: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    var email: String?
    @State private var open: String?
    @State private var value = ""
    @State private var confirm = ""
    @State private var error = ""
    @State private var busy = false

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            SetAction(symbol: "envelope", title: t("changeEmail")) { toggle("email") }
            if open == "email" {
                #if os(iOS)
                KField(placeholder: t("newEmail"), text: $value, keyboard: .emailAddress)
                #else
                KField(placeholder: t("newEmail"), text: $value)
                #endif
                Hint(text: t("newEmailHint"))
                errorLine
                HStack {
                    MiniButton(title: t("cancel")) { toggle(nil) }
                    MiniButton(title: busy ? t("sending") : t("sendLink"), primary: true, action: save).disabled(busy)
                }
            }
            SetAction(symbol: "lock", title: t("changePassword")) { toggle("password") }
            if open == "password" {
                KField(placeholder: t("newPassword"), text: $value, secure: true)
                KField(placeholder: t("typeAgain"), text: $confirm, secure: true)
                errorLine
                HStack {
                    MiniButton(title: t("cancel")) { toggle(nil) }
                    MiniButton(title: busy ? t("saving") : t("changePassword"), primary: true, action: save).disabled(busy)
                }
            }
        }
    }

    @ViewBuilder private var errorLine: some View {
        if !error.isEmpty { Text(error).font(tok.ui(12.5)).foregroundStyle(tok.danger) }
    }

    private func toggle(_ which: String?) {
        open = open == which ? nil : which
        value = ""
        confirm = ""
        error = ""
    }

    private func save() {
        error = ""
        if open == "email" {
            let next = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if next.range(of: "^\\S+@\\S+\\.\\S+$", options: .regularExpression) == nil { error = t("errEmailInvalid"); return }
            if next == email?.lowercased() { error = t("errSameEmail"); return }
            busy = true
            Task {
                defer { busy = false }
                do {
                    try await store.cloud.changeEmail(next)
                    store.toast(t("checkInboxNewEmail"), "✉")
                    toggle(nil)
                } catch { self.error = (error as? CloudError)?.message ?? error.localizedDescription }
            }
        } else {
            if value.count < 6 { error = t("errPwShort"); return }
            if value != confirm { error = t("errPwMismatch"); return }
            busy = true
            let pw = value
            Task {
                defer { busy = false }
                do {
                    try await store.cloud.changePassword(pw)
                    store.toast(t("passwordChanged"), "✓")
                    toggle(nil)
                } catch {
                    let m = (error as? CloudError)?.message ?? error.localizedDescription
                    // projects with "secure password change" want a recent sign-in first
                    self.error = m.range(of: "reauth|recent", options: [.regularExpression, .caseInsensitive]) != nil ? t("errReauth") : m
                }
            }
        }
    }
}

struct HelpView: View {
    @Environment(\.tok) private var tok
    var body: some View {
        SheetShell(title: t("help")) {
            SetSection(symbol: "sparkle", title: t("quickAddUnderstands")) {
                (Text(t("typeLikeSay") + " ") + Text("pay rent friday 5pm !high #home").fontWeight(.semibold)).font(tok.ui(13.5)).foregroundStyle(tok.text2)
                ForEach([("tomorrow · friday · next week", "sayDue"), ("26 oct · 12/11", "sayDate"), ("5pm · 6:30pm · noon", "sayTime"), ("!high · !med · !low", "priority"), ("#home", "sayFolder")], id: \.0) { k, v in
                    row(k, t(v), code: true)
                }
            }
            #if os(iOS)
            SetSection(symbol: "line.3.horizontal", title: t("gestures")) {
                ForEach([("gSwipeRight", "gSwipeRightDo"), ("gSwipeLeft", "gSwipeLeftDo"), ("gPull", "gPullDo")], id: \.0) { k, v in row(t(k), t(v)) }
            }
            #endif
            SetSection(symbol: "keyboard", title: t("keyboard")) {
                ForEach([("N", "keyNewTask"), ("/", "keySearch"), ("⌘ K", "keyPalette"), ("?", "keyHelp"), ("Enter", "keyEnter"), ("Esc", "keyEsc")], id: \.0) { k, v in row(k, t(v), code: true) }
            }
        }
    }
    private func row(_ k: String, _ v: String, code: Bool = false) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(k).font(code ? tok.mono(12.5) : tok.ui(13.5, .medium)).foregroundStyle(tok.text)
            Spacer(minLength: 6)
            Text(v).font(tok.ui(13)).foregroundStyle(tok.text2).multilineTextAlignment(.trailing)
        }
    }
}

struct FeedbackView: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    @State private var kind = "bug"
    @State private var text = ""
    @State private var withDevice = true
    private let email = "satpurastudio@gmail.com"
    private let kinds = [("bug", "Something’s broken", "fbBug"), ("idea", "An idea", "fbIdea"), ("other", "Something else", "fbOther")]

    var body: some View {
        SheetShell(title: t("sendFeedbackTitle")) {
            SetSection {
                Text(t("fbWhatAbout")).font(tok.ui(13.5, .medium)).foregroundStyle(tok.text)
                Seg(value: kind, options: kinds.map { ($0.0, t($0.2)) }) { kind = $0 }
                Text(kind == "bug" ? t("fbWhatHappened") : t("fbTellUs")).font(tok.ui(13.5, .medium)).foregroundStyle(tok.text)
                TextField(kind == "bug" ? t("fbBugPh") : t("fbIdeaPh"), text: $text, axis: .vertical)
                    .textFieldStyle(.plain).font(tok.ui(14)).lineLimit(4...10)
                    .padding(11).background(tok.panel, in: RoundedRectangle(cornerRadius: 11)).overlay(RoundedRectangle(cornerRadius: 11).stroke(tok.border))
                SetRow(title: t("fbDevice"), sub: t("fbDeviceSub")) { Toggle("", isOn: $withDevice).labelsHidden() }
                PrimaryButton(title: t("send"), wide: true, action: send)
                Hint(text: t("fbOpensMail"))
                Button(email) {
                    copyToClipboard(email)
                    store.toast(t("emailCopied"), "✓")
                }
                .buttonStyle(.plain).font(tok.mono(12.5)).foregroundStyle(tok.accent)
            }
        }
    }

    private func send() {
        let label = kinds.first { $0.0 == kind }!.1
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        #if os(iOS)
        let os = "ios \(UIDevice.current.systemVersion), \(UIDevice.current.model)"
        #else
        let os = "macos \(ProcessInfo.processInfo.operatingSystemVersionString)"
        #endif
        let device = withDevice ? "---\nkiln \(version) (\(os))\n" : ""
        let body = "\(text.trimmingCharacters(in: .whitespacesAndNewlines))\n\n\(device)"
        var c = URLComponents(string: "mailto:\(email)")!
        c.queryItems = [URLQueryItem(name: "subject", value: "[kiln] \(label)"), URLQueryItem(name: "body", value: body)]
        if let u = c.url?.absoluteString { openURL(u) }
        store.toast(t("openingMail"), "✉")
    }
}

struct WhatsNewView: View {
    @Environment(\.tok) private var tok
    var body: some View {
        SheetShell(title: t("whatsNew"), onDone: WhatsNew.markSeen) {
            ForEach(CHANGELOG, id: \.id) { r in
                SetSection(title: fmtDate(parseDateStr(r.id), "MMMMd")) {
                    Text(t("cl_\(r.id)_title")).font(tok.ui(15, .semibold)).foregroundStyle(tok.text)
                    ForEach(0..<r.items, id: \.self) { i in
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text("✦").font(.system(size: 9)).foregroundStyle(tok.accent)
                            Text(t("cl_\(r.id)_\(i)")).font(tok.ui(13.5)).foregroundStyle(tok.text2).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
        }
        .onDisappear(perform: WhatsNew.markSeen)
    }
}

struct ProjectEditor: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    @Environment(\.dismiss) private var dismiss
    let project: Project?
    @State private var name = ""
    @State private var color = PROJECT_COLORS[0]
    @State private var icon = PROJECT_ICONS[0]
    @State private var confirmDelete = false
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(project == nil ? t("newFolder") : t("editFolder")).font(tok.display(30)).foregroundStyle(tok.text)
            label(t("name"))
            KField(placeholder: t("folderNamePh"), text: $name, limit: 40, submit: submit).focused($focused)
            label(t("color"))
            Flow(spacing: 10) {
                ForEach(PROJECT_COLORS, id: \.self) { c in
                    Button { color = c } label: {
                        Circle().fill(Color(hex: c)).frame(width: 28, height: 28).overlay(Circle().stroke(tok.text, lineWidth: color == c ? 2 : 0).padding(-3))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(t("useColor", ["color": c]))
                }
                ColorPicker(t("pickCustomColor"), selection: Binding(get: { Color(hex: color) }, set: { if let h = $0.hexString { color = h } }), supportsOpacity: false).labelsHidden()
            }
            label(t("icon"))
            Flow(spacing: 8) {
                ForEach(PROJECT_ICONS, id: \.self) { i in
                    Button { icon = i } label: {
                        Text(iconGlyph(i)).font(.system(size: 16)).foregroundStyle(icon == i ? Color(hex: color) : tok.text2)
                            .frame(width: 36, height: 36)
                            .background(icon == i ? tok.panelHover : .clear, in: RoundedRectangle(cornerRadius: 9))
                            .overlay(RoundedRectangle(cornerRadius: 9).stroke(icon == i ? Color(hex: color).opacity(0.7) : tok.border))
                    }
                    .buttonStyle(.plain)
                }
            }
            Spacer(minLength: 6)
            HStack(spacing: 9) {
                if project != nil {
                    MiniButton(title: confirmDelete ? t("deleteFolderConfirm") : t("delete"), danger: true, action: remove)
                }
                Spacer()
                GhostButton(title: t("cancel")) { dismiss() }.keyboardShortcut(.cancelAction)
                PrimaryButton(title: project == nil ? t("createFolder") : t("save"), action: submit)
            }
        }
        .padding(22)
        .background(tok.bg)
        #if os(macOS)
        .frame(width: 460)
        #else
        .presentationDetents([.medium, .large])
        #endif
        .onAppear {
            if let project {
                name = project.name
                color = project.color
                icon = project.icon
            }
            focused = true
        }
    }

    private func label(_ s: String) -> some View { Text(s).font(tok.ui(13, .medium)).foregroundStyle(tok.text2) }

    private func submit() {
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if clean.isEmpty {
            focused = true
            return
        }
        if let project {
            store.dispatch { $0.updateProject(project.id, ["name": .str(clean), "color": .str(color), "icon": .str(icon)]) }
            store.toast(t("folderUpdated"), "✓")
        } else {
            store.dispatch { $0.addProject(name: clean, color: color, icon: icon) }
            store.toast(t("folderCreated", ["name": clean]), iconGlyph(icon))
        }
        dismiss()
    }

    private func remove() {
        guard let project else { return }
        if !confirmDelete {
            confirmDelete = true
            return
        }
        let s = store.state
        let index = s.projects.firstIndex { $0.id == project.id } ?? 0
        let ids = s.tasks.filter { $0.projectId == project.id }.map(\.id)
        store.dispatch { $0.deleteProject(project.id) }
        store.toast(ids.isEmpty ? t("folderDeleted") : tn("folderDeletedTasks", ids.count), "🗑", action: (t("undo"), {
            store.dispatch { $0.restoreProject(project, index: index, taskIds: ids) }
        }))
        dismiss()
    }
}

struct PaletteView: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    var close: () -> Void
    @Binding var sheet: SheetKind?
    var newFolder: () -> Void
    var openAmbient: () -> Void
    var openTask: (KTask) -> Void
    @State private var q = ""
    @State private var sel = 0
    @FocusState private var focused: Bool
    @State private var exporting = false

    private struct Row: Identifiable {
        let id: String
        var symbol: String? = nil
        var glyph: (String, String)? = nil
        let label: String
        let hint: String
        let fn: () -> Void
    }

    private var rows: [Row] {
        let s = store.state
        func go(_ type: String, _ sym: String, _ key: String) -> Row {
            Row(id: "go-\(type)", symbol: sym, label: t("goTo", ["name": t(key)]), hint: t("hintView")) { store.dispatch { $0.view = Screen(type: type) } }
        }
        var base = [go("today", "sun.max", "nav_today"), go("upcoming", "clock", "nav_upcoming"), go("calendar", "calendar", "nav_calendar"), go("all", "square.3.layers.3d", "nav_all"), go("insights", "chart.bar", "nav_insights"), go("archive", "archivebox", "nav_archive"), go("trash", "trash", "nav_trash")]
        base += s.projects.map { p in
            Row(id: "folder-\(p.id)", glyph: (iconGlyph(p.icon), p.color), label: t("goTo", ["name": p.name]), hint: t("folder")) { store.dispatch { $0.view = Screen(type: "project", projectId: p.id) } }
        }
        let action = t("hintAction")
        base += [
            Row(id: "ambient", symbol: "flame", label: t("openAmbient"), hint: action, fn: openAmbient),
            Row(id: "newfolder", symbol: "plus", label: t("newFolder"), hint: action, fn: newFolder),
            Row(id: "settings", symbol: "gearshape", label: t("openSettings"), hint: action) { sheet = .settings },
            Row(id: "help", symbol: "keyboard", label: t("helpKeyboard"), hint: "?") { sheet = .help },
            Row(id: "feedback", symbol: "envelope", label: t("sendFeedback"), hint: action) { sheet = .feedback },
            Row(id: "whatsnew", symbol: "gift", label: t("whatsNew"), hint: action) { sheet = .whatsnew },
            Row(id: "tour", symbol: "info.circle", label: t("replayTour"), hint: action) { store.dispatch { $0.onboarded = false; $0.replayTour = true } },
            Row(id: "theme", symbol: s.theme == "dark" ? "sun.max" : "moon", label: s.theme == "dark" ? t("switchToLight") : t("switchToDark"), hint: action) { store.dispatch { $0.theme = $0.theme == "dark" ? "light" : "dark" } },
            Row(id: "sound", symbol: s.sound ? "bell.slash" : "bell", label: s.sound ? t("muteSounds") : t("unmuteSounds"), hint: action) { store.dispatch { $0.sound.toggle() } },
            Row(id: "clear", symbol: "paintbrush", label: t("clearAllCompleted"), hint: action) {
                let ids = store.state.tasks.filter { $0.done && !$0.archived }.map(\.id)
                if ids.isEmpty {
                    store.toast(t("nothingToClear"), "🧹")
                    return
                }
                store.dispatch { $0.deleteTasks(ids) }
                store.toast(tn("clearedCompletedTasks", ids.count), "🧹", action: (t("undo"), { store.dispatch { $0.restoreTasks(ids) } }))
            },
            Row(id: "backup", symbol: "arrow.down.circle", label: t("downloadBackup"), hint: t("hintAccount")) { sheet = .settings },
            Row(id: "reminders", symbol: "bell", label: store.remindersOn ? t("disableReminders") : t("enableReminders"), hint: action) {
                if store.remindersOn {
                    Reminders.shared.disable()
                    store.remindersOn = false
                    store.toast(t("remindersOff"), "🔕")
                } else {
                    Task { store.remindersOn = await Reminders.shared.turnOn(store: store) }
                }
            },
            Row(id: "signout", symbol: "xmark", label: t("signOut"), hint: t("hintAccount")) {
                if store.state.profile?["cloud"]?.boolean != true {
                    store.dispatch { $0.profile = nil }
                    return
                }
                Task {
                    // couldn't sync first — Settings explains and offers the choices
                    if await !store.signOut() {
                        store.toast(t("signOutFromSettings"), "⚠")
                        sheet = .settings
                    }
                }
            },
        ]
        let ql = q.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if ql.isEmpty { return base }
        let commands = base.filter { $0.label.lowercased().contains(ql) }
        let colors = Dictionary(uniqueKeysWithValues: s.projects.map { ($0.id, ($0.color, $0.name)) })
        let tasks = s.tasks.filter { !$0.archived && ($0.title.lowercased().contains(ql) || $0.notes.lowercased().contains(ql)) }
            .stableSorted { !$0.done && $1.done }.prefix(6).map { x in
                let p = colors[x.projectId]
                let hint = [p?.1, x.due != nil && !x.done ? fmtDue(x.due) : nil, x.done ? t("doneLower") : nil].compactMap { $0 }.joined(separator: " · ")
                return Row(id: "task-\(x.id)", glyph: (x.done ? "✓" : "○", p?.0 ?? tok.accentHex), label: x.title, hint: hint) { openTask(x) }
            }
        // nothing typed matches exactly? one Enter turns it into a task
        var add: [Row] = []
        let parsed = store.parse(q)
        let title = parsed.title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !title.isEmpty {
            add = [Row(id: "add", symbol: "plus", label: t("addTaskNamed", ["title": title]), hint: parsed.due != nil ? fmtDue(parsed.due) : t("task")) {
                let st = store.state
                let pid = parsed.projectId ?? (st.view.type == "project" ? st.view.projectId : st.projects.first?.id)
                let due = parsed.due ?? store.newTaskDue(for: st.view)
                let time = parsed.time ?? st.settings["defaultTime"]?.string.flatMap { $0.isEmpty ? nil : $0 }
                let prio = parsed.priority ?? st.settings["defaultPriority"]?.string
                store.dispatch { $0.addTask(title: title, projectId: pid, due: due, time: time, priority: prio, newFolder: parsed.newFolder) }
                Sound.add()
                let folder = parsed.newFolder ?? st.projects.first { $0.id == pid }?.name ?? t("inbox")
                store.toast(parsed.due != nil ? t("addedTo", ["folder": folder, "when": fmtDue(parsed.due)]) : t("addedToFolder", ["folder": folder]), "✓")
            }]
        }
        return Array(tasks) + commands + add
    }

    var body: some View {
        let list = rows
        ZStack(alignment: .top) {
            tok.scrim.ignoresSafeArea().onTapGesture(perform: close)
            VStack(spacing: 0) {
                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass").font(.system(size: 14)).foregroundStyle(tok.text3)
                    TextField(t("paletteSearchPh"), text: $q)
                        .textFieldStyle(.plain)
                        .font(tok.ui(15.5))
                        .focused($focused)
                        .submitLabel(.go)
                        .onSubmit { if list.indices.contains(sel) { run(list[sel]) } }
                        .onChange(of: q) { sel = 0 }
                        .onKeyPress(.downArrow) {
                            sel = min(sel + 1, list.count - 1)
                            return .handled
                        }
                        .onKeyPress(.upArrow) {
                            sel = max(sel - 1, 0)
                            return .handled
                        }
                }
                .padding(.horizontal, 15)
                .frame(height: 52)
                Rectangle().fill(tok.border).frame(height: 1)
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 1) {
                            if list.isEmpty { Text(t("nothingMatches")).font(tok.ui(14)).foregroundStyle(tok.text3).padding(24) }
                            ForEach(Array(list.enumerated()), id: \.element.id) { i, r in
                                Button { run(r) } label: {
                                    HStack(spacing: 11) {
                                        Group {
                                            if let g = r.glyph { Text(g.0).foregroundStyle(Color(hex: g.1)) }
                                            else if let s = r.symbol { Image(systemName: s).foregroundStyle(tok.text2) }
                                        }
                                        .font(.system(size: 13)).frame(width: 18)
                                        Text(r.label).font(tok.ui(14)).foregroundStyle(tok.text).lineLimit(1)
                                        Spacer(minLength: 8)
                                        Text(r.hint).font(tok.mono(11)).foregroundStyle(tok.text3).lineLimit(1)
                                    }
                                    .padding(.horizontal, 12)
                                    .frame(minHeight: 40)
                                    .background(i == sel ? tok.accent.opacity(0.12) : .clear, in: RoundedRectangle(cornerRadius: 9))
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .id(r.id)
                            }
                        }
                        .padding(6)
                    }
                    .onChange(of: sel) { _, i in if list.indices.contains(i) { proxy.scrollTo(list[i].id) } }
                }
            }
            .frame(maxWidth: 560, maxHeight: 440)
            .background(tok.raise, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(tok.border))
            .shadow(color: .black.opacity(0.3), radius: 30, y: 16)
            .padding(.horizontal, 14)
            .padding(.top, 60)
        }
        .onAppear { focused = true }
    }

    private func run(_ r: Row) {
        r.fn()
        close()
    }
}
