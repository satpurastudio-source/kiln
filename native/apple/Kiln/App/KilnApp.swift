import SwiftUI

@main
struct KilnApp: App {
    @State private var store: Store
    @Environment(\.scenePhase) private var phase

    init() {
        #if DEBUG
        // Store screenshots run at a set local time, e.g. KILN_CLOCK=2026-11-06T10:20
        if let at = ProcessInfo.processInfo.environment["KILN_CLOCK"] {
            let f = DateFormatter()
            f.locale = Locale(identifier: "en_US_POSIX")
            f.dateFormat = "yyyy-MM-dd'T'HH:mm"
            if let d = f.date(from: at) { Clock.offset = d.timeIntervalSinceNow }
        }
        #endif
        Fonts.register()
        _store = State(initialValue: Store())
    }

    var body: some Scene {
        #if os(macOS)
        Window("kiln", id: "main") { root }
            .defaultSize(width: 1180, height: 780)
            .windowStyle(.hiddenTitleBar)
            .commands { CommandGroup(replacing: .newItem) {} }
        #else
        WindowGroup { root }
        #endif
    }

    private var root: some View {
        RootView()
            .environment(store)
            .onChange(of: phase) { _, p in store.scenePhase(p) }
    }
}
