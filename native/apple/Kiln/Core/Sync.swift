import Foundation

/// The kiln_data row, one user. A protocol so the engine can be tested against
/// a fake cloud that races it.
@MainActor
protocol CloudTransport: AnyObject {
    func pull(userId: String) async throws -> (data: JSON, at: String?)?
    /// nil = the cloud no longer holds `ifAt`.
    func update(userId: String, data: JSON, at: String, ifAt: String) async throws -> String?
    /// nil = the row already exists.
    func insert(userId: String, data: JSON, at: String) async throws -> String?
    func upsert(userId: String, data: JSON, at: String) async throws
}

protocol BaseStore {
    func read(userId: String) -> (at: String?, data: Snapshot)?
    func write(userId: String, at: String?, data: Snapshot)
}

/// Cloud sync for one signed-in user — a port of src/sync.js.
///
/// We remember the last copy the cloud confirmed ("base", persisted). So changes
/// made offline are still known to be unsynced after a restart and get merged in,
/// and a push only lands if the cloud still holds our base — if another device
/// wrote first, we pull its copy, merge, and push the merge instead.
@MainActor
final class SyncEngine {
    enum Status: String { case idle, syncing, synced, offline, error }

    let userId: String
    private let cloud: CloudTransport
    private let baseStore: BaseStore
    private let getLocal: () -> Snapshot
    private let applyRemote: (Snapshot) -> Void
    private let onStatus: (Status) -> Void
    private let isOnline: () -> Bool
    private let retryDelays: [Double]

    private var base: (at: String?, data: Snapshot, json: String)?
    private var pushing: Task<Void, Never>?
    private var again = false
    private var recheck = false
    private var conflicts = 0
    private var retryTask: Task<Void, Never>?
    private var retryN = 0
    private var started = false
    private var stopped = false

    init(userId: String, cloud: CloudTransport, baseStore: BaseStore, getLocal: @escaping () -> Snapshot, applyRemote: @escaping (Snapshot) -> Void,
         onStatus: @escaping (Status) -> Void, isOnline: @escaping () -> Bool = { true }, retryDelays: [Double] = [3, 10, 30, 60]) {
        self.userId = userId
        self.cloud = cloud
        self.baseStore = baseStore
        self.getLocal = getLocal
        self.applyRemote = applyRemote
        self.onStatus = onStatus
        self.isOnline = isOnline
        self.retryDelays = retryDelays
        if let b = baseStore.read(userId: userId) { base = (b.at, b.data, b.data.fingerprint) }
    }

    private func status(_ s: Status) { if !stopped { onStatus(s) } }
    var pending: Bool { base == nil || getLocal().fingerprint != base!.json }

    private func setBase(_ data: Snapshot, _ at: String?) {
        base = (at, data, data.fingerprint)
        baseStore.write(userId: userId, at: at, data: data)
    }

    private func failed(_ e: Error) {
        status(isOnline() ? .error : .offline)
        retryTask?.cancel()
        let delay = retryDelays[min(retryN, retryDelays.count - 1)]
        retryN += 1
        retryTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(delay))
            guard let self, !Task.isCancelled else { return }
            if self.started { await self.push() } else { await self.start() }
        }
    }

    /// Fold a cloud copy into local state.
    func absorb(data: JSON, at: String?) {
        guard data["projects"]?.array != nil, data["tasks"]?.array != nil else { return }
        let cloudCopy = Snapshot(json: data)
        let json = cloudCopy.fingerprint
        let local = getLocal()
        if let b = base, json == b.json {
            // nothing new (often our own echo) — just track the cloud's version
            if let at { setBase(b.data, at) }
            return
        }
        if base == nil || local.fingerprint == base!.json {
            // first sync on this device, or nothing unsynced here → cloud wins
            setBase(cloudCopy, at)
            applyRemote(cloudCopy)
            return
        }
        // both sides changed since we last agreed
        let merged = mergeSnapshots(base: base!.data, local: local, remote: cloudCopy)
        setBase(cloudCopy, at)
        if merged.fingerprint != local.fingerprint { applyRemote(merged) }
    }

    private func writeOnce(_ data: Snapshot) async throws -> String? {
        let at = ISO8601DateFormatter.kiln.string(from: Date())
        if conflicts >= 3 {
            // something keeps racing us — we've merged already, so a plain
            // overwrite is safe enough to break the loop
            try await cloud.upsert(userId: userId, data: data.json, at: at)
            return at
        }
        if let ifAt = base?.at {
            return try await cloud.update(userId: userId, data: data.json, at: at, ifAt: ifAt)
        }
        return try await cloud.insert(userId: userId, data: data.json, at: at)
    }

    private func doPush() async throws {
        let local = getLocal()
        let json = local.fingerprint
        if let b = base, json == b.json { return status(.synced) }
        status(.syncing)
        if let at = try await writeOnce(local) {
            conflicts = 0
            retryN = 0
            setBase(local, at)
            if pending { again = true } else { status(.synced) }
            return
        }
        // another device got there first: take its copy in, then try again
        conflicts += 1
        if let cloudCopy = try await cloud.pull(userId: userId) {
            absorb(data: cloudCopy.data, at: cloudCopy.at)
        } else {
            base = nil // row vanished → next write creates it
        }
        again = true
    }

    func push() async {
        if stopped { return }
        if let pushing {
            again = true
            await pushing.value
            return
        }
        retryTask?.cancel()
        let task = Task { @MainActor [weak self] in
            guard let self else { return }
            do { try await self.doPush() } catch { self.failed(error) }
            self.pushing = nil
            if self.stopped { return }
            if self.again {
                self.again = false
                await self.push()
            } else if self.recheck {
                self.recheck = false
                await self.refresh()
            }
        }
        pushing = task
        await task.value
    }

    func start() async {
        if stopped { return }
        status(.syncing)
        do {
            let cloudCopy = try await cloud.pull(userId: userId)
            if stopped { return }
            if let cloudCopy { absorb(data: cloudCopy.data, at: cloudCopy.at) }
            started = true
            retryN = 0
            await push() // adopts local on a brand-new account; no-op when in step
        } catch {
            failed(error)
        }
    }

    /// A row change arrived over realtime.
    func remoteChanged(data: JSON?, at: String?) async {
        if pushing != nil {
            recheck = true // look again once our own write has settled
            return
        }
        // large rows can arrive without their payload — fetch it instead
        if let data, !data.isNull { absorb(data: data, at: at) } else { await refresh() }
    }

    /// Fallback freshness for when realtime is down or the app was asleep.
    func refresh() async {
        if stopped || !started { return await start() }
        if pending { return await push() }
        if let pushing { return await pushing.value }
        do {
            if let c = try await cloud.pull(userId: userId) { absorb(data: c.data, at: c.at) }
        } catch {
            failed(error)
        }
    }

    /// True once everything local is in the cloud (or false if it's clear it can't be).
    func flush(timeout: Double = 6) async -> Bool {
        await withTaskGroup(of: Bool.self) { group in
            group.addTask { @MainActor in
                var i = 0
                while i < 4 && self.pending {
                    await self.push()
                    i += 1
                }
                return !self.pending
            }
            group.addTask {
                try? await Task.sleep(for: .seconds(timeout))
                return false
            }
            let first = await group.next() ?? false
            group.cancelAll()
            return first
        }
    }

    func stop() {
        stopped = true
        retryTask?.cancel()
    }
}

extension ISO8601DateFormatter {
    nonisolated(unsafe) static let kiln: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
}
