import SwiftUI

@main
struct KilnApp: App {
    @State private var store: Store
    @Environment(\.scenePhase) private var phase

    init() {
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
