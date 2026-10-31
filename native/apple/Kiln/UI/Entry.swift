import SwiftUI

/// Fixed-width card on big screens, full width on phones.
private struct EntryCard<Content: View>: View {
    @Environment(\.tok) private var tok
    @ViewBuilder var content: () -> Content
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 13) { content() }
                .padding(24)
                .frame(maxWidth: 460)
                .background(tok.panelStrong, in: RoundedRectangle(cornerRadius: 20))
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(tok.border))
                .shadow(color: .black.opacity(tok.dark ? 0.4 : 0.1), radius: 24, y: 12)
                .padding(16)
                .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
        .defaultScrollAnchor(.center)
    }
}

struct LoginView: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    @State private var mode = Prefs.string("kiln-auth-intent") == "signup" ? "signup" : "signin"
    @State private var name = Prefs.string("kiln-pending-name") ?? ""
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error = ""
    @State private var code = ""
    @State private var resendIn = 0
    @Environment(\.scenePhase) private var phase
    private let resendWait = 60 // Supabase sends at most one email a minute

    var body: some View {
        EntryCard {
            BrandMark(size: 46)
            (Text("kiln").foregroundStyle(tok.text) + Text(".").foregroundStyle(tok.accent)).font(tok.display(54)).tracking(1.2)
            Text(t("loginTagline")).font(tok.ui(14.5)).foregroundStyle(tok.text2).fixedSize(horizontal: false, vertical: true)
            switch mode {
            case "sent": sent
            case "sent-reset": sentReset
            case "guest": guest
            default: form
            }
            HStack(spacing: 8) {
                Button(t("privacy")) { openURL(Backend.webURL + "privacy.html") }
                Text("·")
                Button(t("terms")) { openURL(Backend.webURL + "terms.html") }
            }
            .buttonStyle(.plain)
            .font(tok.ui(12))
            .foregroundStyle(tok.text3)
            .frame(maxWidth: .infinity)
            .padding(.top, 6)
        }
        .onAppear {
            // the one-time handoff from onboarding doesn't stick around
            Prefs.remove("kiln-pending-name")
            Prefs.remove("kiln-auth-intent")
        }
        .task(id: resendIn) {
            guard resendIn > 0 else { return }
            try? await Task.sleep(for: .seconds(1))
            if !Task.isCancelled { resendIn -= 1 }
        }
        .onChange(of: phase) { _, p in
            // back from the mail app after tapping the button: let them straight in
            if p == .active, mode == "sent", !password.isEmpty { Task { _ = await trySignIn() } }
        }
    }

    @ViewBuilder private var errorLine: some View {
        if !error.isEmpty { Text(error).font(tok.ui(13)).foregroundStyle(tok.danger).fixedSize(horizontal: false, vertical: true) }
    }

    private func link(_ s: Text, _ action: @escaping () -> Void) -> some View {
        Button(action: action) { s.font(tok.ui(13.5)).foregroundStyle(tok.text2) }.buttonStyle(.plain)
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 10) {
            if mode == "signup" { KField(placeholder: t("yourName"), text: $name, limit: 40, submit: submit) }
            #if os(iOS)
            KField(placeholder: "you@email.com", text: $email, submit: submit, keyboard: .emailAddress).textContentType(.emailAddress)
            #else
            KField(placeholder: "you@email.com", text: $email, submit: submit)
            #endif
            KField(placeholder: mode == "signup" ? t("choosePassword") : t("password"), text: $password, secure: true, submit: submit)
                .textContentType(mode == "signup" ? .newPassword : .password)
            errorLine
            PrimaryButton(title: busy ? t("oneMoment") : mode == "signin" ? t("signInArrow") : t("createAccountArrow"), wide: true, busy: busy, action: submit)
            VStack(alignment: .leading, spacing: 8) {
                if mode == "signin" {
                    link(Text(t("newHere") + " ") + Text(t("createAnAccount")).fontWeight(.semibold)) { switchMode("signup") }
                    link(Text(t("forgotPassword")), forgot)
                    link(Text(t("continueNoAccount"))) { switchMode("guest") }
                } else {
                    link(Text(t("haveAccount") + " ") + Text(t("signIn")).fontWeight(.semibold)) { switchMode("signin") }
                }
            }
            .padding(.top, 4)
        }
    }

    private var sent: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("✉").font(.system(size: 30)).foregroundStyle(tok.accent)
            Text(t("checkInbox")).font(tok.ui(17, .semibold)).foregroundStyle(tok.text)
            (Text(t("codeSentTo") + " ") + Text(email).fontWeight(.semibold) + Text("\n" + t("codeSentHint"))).font(tok.ui(13.5)).foregroundStyle(tok.text2)
            #if os(iOS)
            KField(placeholder: "••••••", text: $code, limit: 10, submit: verify, keyboard: .numberPad).textContentType(.oneTimeCode)
                .accessibilityLabel(t("verificationCode"))
            #else
            KField(placeholder: "••••••", text: $code, limit: 10, submit: verify).accessibilityLabel(t("verificationCode"))
            #endif
            errorLine
            PrimaryButton(title: busy ? t("oneMoment") : t("verifyEnter"), wide: true, busy: busy, action: verify)
            link(Text(resendIn > 0 ? t("resendIn", ["n": String(resendIn)]) : t("resendCode"))) { Task { await resend() } }.disabled(resendIn > 0)
            link(Text("← " + t("backToSignIn"))) { switchMode("signin") }
        }
    }

    private var sentReset: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("✉").font(.system(size: 30)).foregroundStyle(tok.accent)
            Text(t("checkInbox")).font(tok.ui(17, .semibold)).foregroundStyle(tok.text)
            (Text(t("resetSentTo") + " ") + Text(email).fontWeight(.semibold) + Text("\n" + t("resetSentHint"))).font(tok.ui(13.5)).foregroundStyle(tok.text2)
            link(Text("← " + t("backToSignIn"))) { switchMode("signin") }
        }
    }

    private var guest: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(t("whatCallYou")).font(tok.ui(13.5, .medium)).foregroundStyle(tok.text2)
            KField(placeholder: t("yourName"), text: $name, limit: 40, submit: guestStart)
            errorLine
            PrimaryButton(title: "\(t("continueDevice")) →", wide: true, action: guestStart)
            Hint(text: t("guestNote"))
            link(Text("← " + t("backToSignIn"))) { switchMode("signin") }
        }
    }

    private func switchMode(_ m: String) {
        withAnimation(.easeOut(duration: 0.2)) { mode = m }
        error = ""
    }

    private func submit() {
        if busy { return }
        if mode == "signin" { signIn() } else if mode == "signup" { signUp() } else { guestStart() }
    }

    /// Supabase's commonest messages, in the reader's language; anything else as-is.
    private func authError(_ m: String) -> String {
        ["Invalid login credentials": t("errBadCredentials"), "User already registered": t("errUserExists")][m] ?? m
    }

    private func message(_ e: Error) -> String { (e as? CloudError)?.message ?? e.localizedDescription }

    private func signIn() {
        guard email.contains("@"), !password.isEmpty else { error = t("errEnterEmailPw"); return }
        busy = true
        error = ""
        Task {
            defer { busy = false }
            do {
                try await store.cloud.signIn(email: clean(email), password: password)
            } catch {
                let m = message(error)
                if m == "Email not confirmed" {
                    // straight to the code screen, with a fresh code on its way
                    mode = "sent"
                    code = ""
                    await resend(justFailed: true)
                } else {
                    self.error = authError(m)
                }
            }
        }
    }

    private func clean(_ s: String) -> String { s.trimmingCharacters(in: .whitespacesAndNewlines) }

    private func signUp() {
        guard !clean(name).isEmpty else { error = t("errTellName"); return }
        guard email.contains("@") else { error = t("errEmailWrong"); return }
        guard password.count >= 6 else { error = t("errPwShort"); return }
        busy = true
        error = ""
        Task {
            defer { busy = false }
            do {
                if try await store.cloud.signUp(email: clean(email), password: password, name: clean(name)) { return }
                code = ""
                resendIn = resendWait
                mode = "sent"
            } catch {
                self.error = authError(message(error))
            }
        }
    }

    /// The button in the email and the code are the same one-time token, so
    /// whoever taps the button finds the code "expired" when they come back.
    /// Their email is verified by then: the password they just typed gets them in.
    private func trySignIn() async -> Bool {
        guard !password.isEmpty else { return false }
        do {
            try await store.cloud.signIn(email: clean(email), password: password)
            store.toast(t("emailVerified"), "✓")
            return true
        } catch {
            return false
        }
    }

    private func verify() {
        let token = code.filter(\.isNumber)
        guard token.count >= 6 else { error = t("errEnterCode"); return }
        busy = true
        error = ""
        Task {
            defer { busy = false }
            do {
                try await store.cloud.verifySignup(email: clean(email), code: token)
                store.toast(t("emailVerified"), "✓")
            } catch {
                if await trySignIn() { return }
                let m = message(error)
                self.error = m.range(of: "expired|invalid", options: [.regularExpression, .caseInsensitive]) != nil ? t("errCodeBad") : authError(m)
            }
        }
    }

    private func resend(justFailed: Bool = false) async {
        error = ""
        resendIn = resendWait
        // already verified through the button? Then a resend would send nothing
        if !justFailed, await trySignIn() { return }
        do {
            try await store.cloud.resendSignup(email: clean(email))
            // a resend retires the previous code, so don't leave it in the box
            code = ""
            store.toast(t("newCodeSent"), "✉")
        } catch {
            let m = message(error)
            // "For security purposes, you can only request this after 42 seconds."
            let wait = m.range(of: "after \\d+ seconds", options: .regularExpression).flatMap { Int(m[$0].filter(\.isNumber)) }
            resendIn = wait ?? 0
            self.error = wait != nil ? t("errCodeRecent") : m.range(of: "rate limit", options: [.regularExpression, .caseInsensitive]) != nil ? t("errRateLimit") : m
        }
    }

    private func forgot() {
        guard email.contains("@") else { error = t("errEnterEmailFirst"); return }
        busy = true
        error = ""
        Task {
            defer { busy = false }
            do {
                try await store.cloud.recover(email: clean(email))
                mode = "sent-reset"
            } catch {
                self.error = authError(message(error))
            }
        }
    }

    private func guestStart() {
        let c = clean(name)
        guard !c.isEmpty else { error = t("errTellName"); return }
        store.dispatch { $0.profile = ["name": .str(c), "createdAt": .num(Clock.ms)] }
        store.toast(t("welcomeToast", ["name": String(c.split(whereSeparator: \.isWhitespace)[0])]), "🔥")
    }
}

/// First-run flow: personalize first, ask to sign in last. Also reopened as a quick tour.
struct OnboardingView: View {
    @Environment(Store.self) private var store
    @Environment(\.tok) private var tok
    @State private var step = 0
    @State private var name = ""
    @State private var picked: Set<String> = []
    @State private var firstTask = ""
    @State private var demo = 0

    private var firstRun: Bool { !store.state.replayTour && store.state.profile == nil }
    private var steps: [String] { firstRun ? ["lang", "welcome", "look", "purpose", "capture", "complete", "account"] : ["welcome", "look", "capture", "complete", "done"] }

    var body: some View {
        let key = steps[min(step, steps.count - 1)]
        let last = step == steps.count - 1
        let onAccount = firstRun && last
        let canNext = key != "welcome" || !name.trimmingCharacters(in: .whitespaces).isEmpty
        EntryCard {
            if firstRun {
                HStack {
                    Spacer()
                    Button(t("skip")) {
                        localizeSeed(store.state.projects)
                        store.dispatch { $0.onboarded = true }
                    }
                    .buttonStyle(.plain).font(tok.ui(13)).foregroundStyle(tok.text3)
                }
            }
            Group {
                switch key {
                case "lang": title(t("langTitle"), t("langSub")); LanguagePicker()
                case "welcome": welcome
                case "look": look
                case "purpose": purpose
                case "capture": capture
                case "complete": complete
                case "account": account
                default:
                    BrandMark(size: 48)
                    title(t("allSet") + ".", t("tourDone"))
                }
            }
            .id(key)
            .transition(.asymmetric(insertion: .opacity, removal: .identity))
            HStack {
                HStack(spacing: 6) {
                    ForEach(steps.indices, id: \.self) { i in
                        Circle().fill(i == step ? tok.accent : tok.borderStrong).frame(width: 6, height: 6)
                    }
                }
                Spacer()
                if !onAccount {
                    if step > 0 { GhostButton(title: t("back")) { go(-1) } }
                    PrimaryButton(title: last ? t("done") : t("next")) { next(canNext, last) }.opacity(canNext ? 1 : 0.5)
                }
            }
            .padding(.top, 8)
        }
        .onAppear { name = store.state.profile?["name"]?.string ?? "" }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(1700))
                demo += 1
            }
        }
    }

    private func go(_ d: Int) {
        hideKeyboard()
        withAnimation(.easeOut(duration: 0.25)) { step = max(0, step + d) }
    }

    private func next(_ can: Bool, _ last: Bool) {
        guard can else { return }
        if last {
            if !firstRun {
                applyPersonalization()
                store.dispatch {
                    $0.onboarded = true
                    $0.replayTour = false
                }
            }
            return
        }
        go(1)
    }

    private func title(_ a: String, _ b: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(a).font(tok.display(36)).tracking(0.7).foregroundStyle(tok.text).fixedSize(horizontal: false, vertical: true)
            Text(b).font(tok.ui(14.5)).foregroundStyle(tok.text2).fixedSize(horizontal: false, vertical: true)
        }
    }

    private var welcome: some View {
        VStack(alignment: .leading, spacing: 13) {
            BrandMark(size: 48)
            title(t("welcomeTitle", ["app": "kiln"]) + ".", t("welcomeSub"))
            KField(placeholder: t("yourName"), text: $name, limit: 40) { if !name.trimmingCharacters(in: .whitespaces).isEmpty { go(1) } }
        }
    }

    private var look: some View {
        VStack(alignment: .leading, spacing: 13) {
            title(t("lookTitle"), t("lookSub"))
            Text(t("accent")).font(tok.ui(13, .medium)).foregroundStyle(tok.text2)
            AccentPicker()
            Text(t("theme")).font(tok.ui(13, .medium)).foregroundStyle(tok.text2)
            Seg(value: store.state.theme, options: [("light", t("light")), ("dark", t("dark"))]) { v in store.dispatch { $0.theme = v } }
        }
    }

    private var purpose: some View {
        VStack(alignment: .leading, spacing: 13) {
            title(t("purposeTitle"), t("purposeSub"))
            Flow(spacing: 8) {
                ForEach(PURPOSES, id: \.id) { p in
                    let on = picked.contains(p.id)
                    Button {
                        if on { picked.remove(p.id) } else { picked.insert(p.id) }
                    } label: {
                        HStack(spacing: 8) {
                            Text(iconGlyph(p.icon)).font(.system(size: 11)).foregroundStyle(.white).frame(width: 22, height: 22).background(Color(hex: p.color), in: Circle())
                            Text(t("p_\(p.id)")).font(tok.ui(14, .medium)).foregroundStyle(tok.text)
                        }
                        .padding(.horizontal, 11)
                        .frame(minHeight: 40)
                        .background(on ? tok.accent.opacity(0.12) : tok.panel, in: Capsule())
                        .overlay(Capsule().stroke(on ? tok.accent.opacity(0.6) : tok.border))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var capture: some View {
        VStack(alignment: .leading, spacing: 13) {
            title(t("captureTitle"), t("captureSub"))
            let ex = [
                ("gym tomorrow 7am !high #fitness", ["📅 \(t("tomorrow"))", "🕖 \(fmtTime("07:00"))", "⚑ \(t("prio_high"))", "● \(t("p_fitness"))"]),
                ("pay rent 26 oct 6pm #home", ["📅 \(fmtDate(makeDate(2026, 9, 26), "MMMd"))", "🕕 \(fmtTime("18:00"))", "● \(t("home"))"]),
            ][demo / 3 % 2]
            VStack(alignment: .leading, spacing: 8) {
                Text(ex.0).font(tok.mono(13)).foregroundStyle(tok.text)
                Flow(spacing: 6) {
                    ForEach(ex.1, id: \.self) { p in
                        Text(p).font(tok.ui(12, .medium)).foregroundStyle(tok.accent).padding(.horizontal, 9).padding(.vertical, 4).background(tok.accent.opacity(0.1), in: Capsule())
                    }
                }
            }
            .padding(13)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(tok.panel, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(tok.border))
            .animation(.easeOut(duration: 0.3), value: demo / 3 % 2)
            if firstRun {
                Text(t("yourTurn")).font(tok.ui(13, .medium)).foregroundStyle(tok.text2)
                KField(placeholder: t("firstTaskPh"), text: $firstTask, limit: 140) { go(1) }
                Hint(text: t("firstTaskHint"))
            }
        }
    }

    private var complete: some View {
        VStack(alignment: .leading, spacing: 13) {
            title(t("completeTitle"), t("completeSub"))
            HStack(spacing: 8) {
                CheckCircle(checked: demo % 2 == 1, color: tok.accent) {}
                Text(t("seedTask4")).font(tok.ui(15, .medium)).foregroundStyle(demo % 2 == 1 ? tok.text3 : tok.text).strikethrough(demo % 2 == 1).lineLimit(1)
                Spacer()
            }
            .padding(8)
            .background(tok.panel, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(tok.border))
            .allowsHitTesting(false)
        }
    }

    private var account: some View {
        let first = name.split(whereSeparator: \.isWhitespace).first.map(String.init)
        return VStack(alignment: .leading, spacing: 11) {
            BrandMark(size: 48)
            title((first.map { t("allSetName", ["name": $0]) } ?? t("allSet")) + ".", t("accountSub"))
            PrimaryButton(title: t("createAccount"), wide: true) { finishToAuth("signup") }
            GhostButton(title: t("continueDevice"), wide: true, action: finishGuest)
            Button { finishToAuth("signin") } label: {
                (Text(t("haveAccount") + " ") + Text(t("signIn")).fontWeight(.semibold)).font(tok.ui(13.5)).foregroundStyle(tok.text2)
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity)
        }
    }

    /// The seed was built before anyone picked a language; rewrite it in the chosen one.
    private func localizeSeed(_ projects: [Project]) {
        func tr(_ s: String) -> String { SEED_TEXT[s].map { t($0) } ?? s }
        store.dispatch { st in
            st.setProjects(projects.map { p in
                var p = p
                p.j["name"] = .str(tr(p.name))
                return p
            })
            for task in st.tasks where SEED_TEXT[task.title] != nil {
                st.updateTask(task.id, ["title": .str(tr(task.title)), "notes": .str(tr(task.notes))])
            }
        }
    }

    private func applyPersonalization() {
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if !firstRun, !clean.isEmpty { store.dispatch { $0.profile?["name"] = .str(clean) } }
        guard firstRun, let keep = store.state.projects.first else { return }
        let folders = PURPOSES.filter { picked.contains($0.id) && $0.name != keep.name }.map {
            Project(["id": .str(uid()), "name": .str($0.name), "color": .str($0.color), "icon": .str($0.icon)])
        }
        localizeSeed(picked.isEmpty ? store.state.projects : [keep] + folders)
        let text = firstTask.trimmingCharacters(in: .whitespacesAndNewlines)
        if !text.isEmpty {
            // read it the way the quick-add bar does; a #new-folder tag just files it under Getting Started
            let p = store.parse(firstTask)
            let title = p.title.trimmingCharacters(in: .whitespacesAndNewlines)
            store.dispatch { $0.addTask(title: title.isEmpty ? text : title, projectId: p.projectId ?? keep.id, due: p.due ?? todayStr(), time: p.time, priority: p.priority ?? "none") }
        }
    }

    private func finishGuest() {
        applyPersonalization()
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let shown = clean.isEmpty ? t("friend") : clean
        store.dispatch {
            $0.profile = ["name": .str(shown), "createdAt": .num(Clock.ms)]
            $0.onboarded = true
        }
        store.toast(t("welcomeToast", ["name": String(shown.split(whereSeparator: \.isWhitespace)[0])]), "🔥")
    }

    private func finishToAuth(_ intent: String) {
        applyPersonalization()
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if !clean.isEmpty { Prefs.set("kiln-pending-name", clean) }
        Prefs.set("kiln-auth-intent", intent)
        store.dispatch { $0.onboarded = true }
    }
}
