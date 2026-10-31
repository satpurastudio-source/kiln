import AVFoundation
import Foundation
import SwiftUI
import UserNotifications
#if os(iOS)
import UIKit
#else
import AppKit
#endif

/// Small device-local values, under the same keys the web app used.
enum Prefs {
    static func string(_ k: String) -> String? { UserDefaults.standard.string(forKey: k) }
    static func set(_ k: String, _ v: String) { UserDefaults.standard.set(v, forKey: k) }
    static func remove(_ k: String) { UserDefaults.standard.removeObject(forKey: k) }
    static let localKeys = ["kiln-focus", "kiln-tips", "kiln-reminders", "kiln-whatsnew-seen", "kiln-pending-name", "kiln-auth-intent"]
}

/// One JSON file for the state (the web app's `zenith-v1` shape), written atomically off the main thread.
enum Disk {
    private static let dir: URL = {
        let d = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("kiln", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }()
    private static let stateURL = dir.appendingPathComponent("state.json")
    private static let baseURL = dir.appendingPathComponent("sync-base.json")
    private static let queue = DispatchQueue(label: "kiln.disk", qos: .utility)

    static func loadState() -> AppState {
        guard let data = try? Data(contentsOf: stateURL) else { return .seed() }
        if let json = JSON.parse(data), let s = AppState.decode(json) { return s }
        // Never silently replace unreadable data — park a copy so it can be recovered by hand.
        try? data.write(to: dir.appendingPathComponent("state-unreadable-\(Int(Clock.ms)).json"))
        return .seed()
    }

    static func saveState(_ s: AppState) {
        queue.async { try? s.encoded.data.write(to: stateURL, options: .atomic) }
    }

    static func clearBase() { queue.async { try? FileManager.default.removeItem(at: baseURL) } }

    static func wipe() {
        queue.sync {
            try? FileManager.default.removeItem(at: stateURL)
            try? FileManager.default.removeItem(at: baseURL)
        }
        Prefs.localKeys.forEach(Prefs.remove)
    }

    struct BaseFile: BaseStore {
        func read(userId: String) -> (at: String?, data: Snapshot)? {
            guard let d = try? Data(contentsOf: baseURL), let b = JSON.parse(d), b["userId"]?.string == userId, let data = b["data"] else { return nil }
            return (b["at"]?.string, Snapshot(json: data))
        }
        func write(userId: String, at: String?, data: Snapshot) {
            let file = JSON.obj(["userId": .str(userId), "at": at.json, "data": data.json])
            Disk.queue.async { try? file.data.write(to: baseURL, options: .atomic) }
        }
    }
}

/// The web app's little synth, rendered once to WAV in memory. No audio assets.
enum Sound {
    nonisolated(unsafe) static var enabled = true
    nonisolated(unsafe) private static var players: [String: AVAudioPlayer] = [:]

    private struct Tone { var freq: Double, to: Double? = nil, time: Double, triangle = false, gain: Double, delay = 0.0 }

    private static func wav(_ tones: [Tone]) -> Data {
        let rate = 44100.0
        let total = tones.map { $0.delay + $0.time + 0.05 }.max() ?? 0.2
        var pcm = [Double](repeating: 0, count: Int(total * rate))
        for t in tones {
            var phase = 0.0
            let start = Int(t.delay * rate), n = Int(t.time * rate)
            for i in 0..<n where start + i < pcm.count {
                let p = Double(i) / Double(n), sec = Double(i) / rate
                let f = t.to.map { t.freq * pow($0 / t.freq, p) } ?? t.freq
                phase += 2 * .pi * f / rate
                let wave = t.triangle ? 2 / .pi * asin(sin(phase)) : sin(phase)
                let env = sec < 0.008 ? t.gain * sec / 0.008 : t.gain * pow(0.0001 / t.gain, (sec - 0.008) / max(0.001, t.time - 0.008))
                pcm[start + i] += wave * env
            }
        }
        var d = Data()
        func put<T>(_ v: T) { withUnsafeBytes(of: v) { d.append(contentsOf: $0) } }
        let size = UInt32(pcm.count * 2)
        d.append(contentsOf: Array("RIFF".utf8)); put(UInt32(36) + size); d.append(contentsOf: Array("WAVEfmt ".utf8))
        put(UInt32(16)); put(UInt16(1)); put(UInt16(1)); put(UInt32(44100)); put(UInt32(88200)); put(UInt16(2)); put(UInt16(16))
        d.append(contentsOf: Array("data".utf8)); put(size)
        for s in pcm { put(Int16(max(-1, min(1, s)) * 32767).littleEndian) }
        return d
    }

    private static func play(_ key: String, _ tones: @autoclosure () -> [Tone]) {
        guard enabled else { return }
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setCategory(.ambient) // mixes with music, respects the silent switch
        #endif
        if players[key] == nil { players[key] = try? AVAudioPlayer(data: wav(tones())) }
        players[key]?.currentTime = 0
        players[key]?.play()
    }

    static func complete() { play("complete", [Tone(freq: 587, to: 880, time: 0.1, gain: 0.06), Tone(freq: 880, to: 1175, time: 0.16, gain: 0.05, delay: 0.07)]) }
    static func add() { play("add", [Tone(freq: 440, to: 660, time: 0.08, gain: 0.045)]) }
    static func pop() { play("pop", [Tone(freq: 320, to: 180, time: 0.09, triangle: true, gain: 0.05)]) }
    static func fanfare() {
        play("fanfare", [Tone(freq: 523, time: 0.14, gain: 0.05), Tone(freq: 659, time: 0.14, gain: 0.05, delay: 0.09), Tone(freq: 784, time: 0.2, gain: 0.055, delay: 0.18), Tone(freq: 1046, time: 0.3, gain: 0.05, delay: 0.27)])
    }
}

func tick() {
    #if os(iOS)
    UIImpactFeedbackGenerator(style: .light).impactOccurred()
    #endif
}

func hideKeyboard() {
    #if os(iOS)
    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    #endif
}

func openURL(_ s: String) {
    guard let u = URL(string: s) else { return }
    #if os(iOS)
    UIApplication.shared.open(u)
    #else
    NSWorkspace.shared.open(u)
    #endif
}

func copyToClipboard(_ s: String) {
    #if os(iOS)
    UIPasteboard.general.string = s
    #else
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(s, forType: .string)
    #endif
}

/// Real OS notifications that fire with the app closed; the schedule is rebuilt
/// shortly after the last task change.
@MainActor
final class Reminders {
    static let shared = Reminders()
    private let center = UNUserNotificationCenter.current()
    private var latest: [KTask] = []
    private var timer: Task<Void, Never>?
    private var awaitingSettings = false
    private var offered = false

    var optedIn: Bool { Prefs.string("kiln-reminders") == "1" }

    func granted() async -> Bool { await center.notificationSettings().authorizationStatus == .authorized }

    func enable() async -> Bool {
        let ok = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        guard ok else { return false }
        Prefs.set("kiln-reminders", "1")
        schedule(latest)
        return true
    }

    /// First launch: ask straight away. Asked once; a no can be undone in Settings.
    func askOnFirstLaunch() async {
        guard Prefs.string("kiln-reminders") == nil else { return }
        if await !enable() { Prefs.set("kiln-reminders", "0") }
    }

    func disable() {
        Prefs.set("kiln-reminders", "0")
        schedule(latest)
    }

    /// Asks if the system still will; otherwise sends them to Settings to allow it.
    func turnOn(store: Store) async -> Bool {
        if await enable() {
            store.remindersOn = true
            store.toast(t("remindersOnNudge"), "🔔")
            return true
        }
        awaitingSettings = true
        #if os(iOS)
        openURL(UIApplication.openNotificationSettingsURLString)
        #else
        openURL("x-apple.systempreferences:com.apple.Notifications-Settings.extension")
        #endif
        store.toast(t("notifAllowThenBack"), "🔔")
        return false
    }

    func returnedToForeground(store: Store) {
        guard awaitingSettings else { return }
        awaitingSettings = false
        Task {
            guard await granted() else { return }
            Prefs.set("kiln-reminders", "1")
            store.remindersOn = true
            schedule(latest)
            store.toast(t("remindersOnNudge"), "🔔")
        }
    }

    /// A task with a time is when reminders matter. Once per launch, so it never nags.
    func offer(store: Store) {
        guard !offered else { return }
        Task {
            if optedIn, await granted() { return }
            offered = true
            store.toast(t("remindOffer"), "🔔", action: (t("turnOn"), { Task { _ = await self.turnOn(store: store) } }), holdMs: 10000)
        }
    }

    func sendTest() async -> Bool {
        guard await granted() else { return false }
        let c = UNMutableNotificationContent()
        c.title = "kiln"
        c.body = t("testReminderBody")
        c.sound = .default
        try? await center.add(UNNotificationRequest(identifier: String(TEST_REMINDER_ID), content: c, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)))
        return true
    }

    func schedule(_ tasks: [KTask]) {
        latest = tasks
        timer?.cancel()
        timer = Task {
            try? await Task.sleep(for: .seconds(1))
            guard !Task.isCancelled else { return }
            await rebuild()
        }
    }

    private func rebuild() async {
        let pending = await center.pendingNotificationRequests().map(\.identifier).filter { $0 != String(TEST_REMINDER_ID) }
        center.removePendingNotificationRequests(withIdentifiers: pending)
        guard optedIn, await granted() else { return }
        for r in planReminders(latest) {
            let c = UNMutableNotificationContent()
            c.title = r.title
            c.body = r.body
            c.sound = .default
            let comps = cal.dateComponents([.year, .month, .day, .hour, .minute, .second], from: r.at)
            try? await center.add(UNNotificationRequest(identifier: String(r.id), content: c, trigger: UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)))
        }
    }
}

/// Counts app opens on stats.satpurastudio.com, as the web beacon did: no cookies,
/// and the visitor id is random and replaced every day (IST).
enum Analytics {
    static func countOpen() {
        let ist = Date().addingTimeInterval(5.5 * 3600)
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let c = utc.dateComponents([.year, .month, .day], from: ist)
        let today = String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
        let parts = (Prefs.string("satpura:v") ?? "").split(separator: "|").map(String.init)
        let visitor = parts.count == 2 && parts[0] == today ? parts[1] : UUID().uuidString.lowercased()
        Prefs.set("satpura:v", "\(today)|\(visitor)")
        var req = URLRequest(url: URL(string: "\(Backend.url)/rest/v1/page_views")!)
        req.httpMethod = "POST"
        req.setValue(Backend.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(Backend.anonKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        req.httpBody = JSON.obj(["product": "kiln", "path": "/", "referrer": nil, "device": "app", "visitor": .str(visitor)]).data
        #if !DEBUG
        URLSession.shared.dataTask(with: req).resume()
        #endif
    }
}
