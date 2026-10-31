import Foundation

/// Live row changes over Supabase Realtime's Phoenix websocket, so a task finished
/// on one device shows on the other within a second. Sync still works without it.
@MainActor
final class RealtimeChannel {
    private let userId: String
    private let token: () async -> String?
    private let onChange: (_ data: JSON?, _ at: String?) -> Void
    private var socket: URLSessionWebSocketTask?
    private var heartbeat: Task<Void, Never>?
    private var reader: Task<Void, Never>?
    private var reconnect: Task<Void, Never>?
    private var ref = 0
    private var attempts = 0
    private var stopped = false

    init(userId: String, token: @escaping () async -> String?, onChange: @escaping (JSON?, String?) -> Void) {
        self.userId = userId
        self.token = token
        self.onChange = onChange
    }

    private var topic: String { "realtime:kiln-sync-\(userId)" }

    func start() {
        stopped = false
        connect()
    }

    func stop() {
        stopped = true
        tearDown()
        reconnect?.cancel()
    }

    private func tearDown() {
        heartbeat?.cancel()
        reader?.cancel()
        socket?.cancel(with: .goingAway, reason: nil)
        socket = nil
    }

    private func nextRef() -> String {
        ref += 1
        return String(ref)
    }

    private func send(_ topic: String, _ event: String, _ payload: Item) {
        let msg = JSON.obj(["topic": .str(topic), "event": .str(event), "payload": .obj(payload), "ref": .str(nextRef())])
        socket?.send(.string(msg.stable)) { _ in }
    }

    private func connect() {
        if stopped || socket != nil { return }
        let host = Backend.url.replacingOccurrences(of: "https://", with: "wss://")
        guard let url = URL(string: "\(host)/realtime/v1/websocket?apikey=\(Backend.anonKey)&vsn=1.0.0") else { return }
        let s = URLSession.shared.webSocketTask(with: url)
        socket = s
        s.resume()
        Task { [weak self] in
            guard let self, let access = await self.token(), !self.stopped else { return }
            let config: Item = [
                "broadcast": .obj(["self": false]),
                "presence": .obj(["key": ""]),
                "postgres_changes": .arr([.obj(["event": "*", "schema": "public", "table": "kiln_data", "filter": .str("user_id=eq.\(self.userId)")])]),
            ]
            self.send(self.topic, "phx_join", ["config": .obj(config), "access_token": .str(access)])
        }
        heartbeat = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(25))
                guard let self, !Task.isCancelled else { return }
                self.send("phoenix", "heartbeat", [:])
                if let access = await self.token() { self.send(self.topic, "access_token", ["access_token": .str(access)]) }
            }
        }
        reader = Task { [weak self] in
            while !Task.isCancelled {
                do {
                    guard let msg = try await s.receive() as URLSessionWebSocketTask.Message?, let self else { return }
                    self.attempts = 0
                    if case .string(let text) = msg { self.handle(text) }
                } catch {
                    self?.dropped()
                    return
                }
            }
        }
    }

    private func handle(_ text: String) {
        guard let msg = JSON.parse(text), msg["event"]?.string == "postgres_changes",
              let row = msg["payload"]?["data"] else { return }
        let record = row["record"]
        onChange(record?["data"], record?["updated_at"]?.string)
    }

    private func dropped() {
        tearDown()
        if stopped { return }
        attempts += 1
        let delay = min(30.0, pow(2.0, Double(attempts)))
        reconnect?.cancel()
        reconnect = Task { [weak self] in
            try? await Task.sleep(for: .seconds(delay))
            guard let self, !Task.isCancelled else { return }
            self.connect()
        }
    }
}
