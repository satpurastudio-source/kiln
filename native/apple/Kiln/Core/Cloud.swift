import Foundation

enum Backend {
    /// The anon key is public by design — safety comes from Row Level Security.
    static let url = "https://hdrqegyvegsbpjdjmozp.supabase.co"
    static let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkcnFlZ3l2ZWdzYnBqZGptb3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NTU1NDIsImV4cCI6MjA5OTUzMTU0Mn0.U06b0zXbXLrUCdffRh21yvNJh9jKy8NcXfGXDgTHC80"
    /// Email links land on the web app: a mail app can't open this one.
    static let webURL = "https://kiln.satpurastudio.com/"
}

struct CloudError: Error {
    let message: String
    var code: String?
    var status: Int?
    var isNetwork = false
}

struct AuthSession: Equatable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Double // seconds since 1970
    var userId: String
    var email: String?
    var name: String?

    init?(json: JSON?) {
        guard let access = json?["access_token"]?.string, let refresh = json?["refresh_token"]?.string,
              let user = json?["user"]?.object, let id = user["id"]?.string else { return nil }
        accessToken = access
        refreshToken = refresh
        expiresAt = json?["expires_at"]?.number ?? (Date().timeIntervalSince1970 + (json?["expires_in"]?.number ?? 3600))
        userId = id
        email = user["email"]?.string
        name = user["user_metadata"]?["name"]?.string
    }

    var json: JSON {
        .obj(["access_token": .str(accessToken), "refresh_token": .str(refreshToken), "expires_at": .num(expiresAt),
              "user": .obj(["id": .str(userId), "email": email.json, "user_metadata": .obj(["name": name.json])])])
    }
}

/// A thin client for the three Supabase surfaces kiln uses, with no SDK to load
/// at launch: auth, the one `kiln_data` row, and the delete-account function.
@MainActor
final class Cloud {
    private(set) var session: AuthSession?
    var onSessionChange: ((_ event: String, _ session: AuthSession?) -> Void)?
    private let store: SessionStore
    private let http: URLSession
    private var refreshing: Task<AuthSession, Error>?

    init(store: SessionStore = KeychainSessionStore(), http: URLSession = .shared) {
        self.store = store
        self.http = http
        session = store.load()
    }

    // MARK: requests

    func request(_ method: String, _ path: String, body: JSON? = nil, headers: [String: String] = [:], authed: Bool = true) async throws -> JSON? {
        var req = URLRequest(url: URL(string: Backend.url + path)!, timeoutInterval: 20)
        req.httpMethod = method
        req.setValue(Backend.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var bearer = Backend.anonKey
        if authed, session != nil { bearer = try await validToken() }
        req.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
        for (k, v) in headers { req.setValue(v, forHTTPHeaderField: k) }
        if let body { req.httpBody = body.data }
        let data: Data, resp: URLResponse
        do {
            (data, resp) = try await http.data(for: req)
        } catch {
            throw CloudError(message: error.localizedDescription, isNetwork: true)
        }
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        let json = data.isEmpty ? nil : JSON.parse(data)
        guard (200..<300).contains(status) else {
            let m = json?["msg"]?.string ?? json?["error_description"]?.string ?? json?["message"]?.string ?? json?["error"]?.string ?? "Request failed (\(status))"
            throw CloudError(message: m, code: json?["code"]?.string ?? json?["error_code"]?.string, status: status)
        }
        return json
    }

    private func q(_ s: String) -> String {
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: "+&=?/:")
        return s.addingPercentEncoding(withAllowedCharacters: allowed) ?? s
    }

    // MARK: auth

    func validToken() async throws -> String {
        guard let s = session else { throw CloudError(message: "Not signed in") }
        if s.expiresAt - Date().timeIntervalSince1970 > 60 { return s.accessToken }
        return try await refreshSession().accessToken
    }

    @discardableResult
    func refreshSession() async throws -> AuthSession {
        if let refreshing { return try await refreshing.value }
        guard let current = session else { throw CloudError(message: "Not signed in") }
        let task = Task { @MainActor () throws -> AuthSession in
            defer { refreshing = nil }
            do {
                let json = try await request("POST", "/auth/v1/token?grant_type=refresh_token", body: .obj(["refresh_token": .str(current.refreshToken)]), authed: false)
                guard let next = AuthSession(json: json) else { throw CloudError(message: "Bad session") }
                adopt(next, event: "TOKEN_REFRESHED")
                return next
            } catch let e as CloudError {
                // a revoked or expired refresh token is a real sign-out; a network blip is not
                if !e.isNetwork, let st = e.status, (400..<500).contains(st) { clear() }
                throw e
            }
        }
        refreshing = task
        return try await task.value
    }

    private func adopt(_ s: AuthSession, event: String) {
        session = s
        store.save(s)
        onSessionChange?(event, s)
    }

    private func clear() {
        session = nil
        store.clear()
        onSessionChange?("SIGNED_OUT", nil)
    }

    func signIn(email: String, password: String) async throws {
        let json = try await request("POST", "/auth/v1/token?grant_type=password", body: .obj(["email": .str(email), "password": .str(password)]), authed: false)
        guard let s = AuthSession(json: json) else { throw CloudError(message: "Bad session") }
        adopt(s, event: "SIGNED_IN")
    }

    /// Returns true if a session came straight back (email confirmation off).
    func signUp(email: String, password: String, name: String) async throws -> Bool {
        let redirect = q(Backend.webURL + "?verified=1")
        let json = try await request("POST", "/auth/v1/signup?redirect_to=\(redirect)", body: .obj(["email": .str(email), "password": .str(password), "data": .obj(["name": .str(name)])]), authed: false)
        if let s = AuthSession(json: json) {
            adopt(s, event: "SIGNED_IN")
            return true
        }
        return false
    }

    func verifySignup(email: String, code: String) async throws {
        let json = try await request("POST", "/auth/v1/verify", body: .obj(["email": .str(email), "token": .str(code), "type": "signup"]), authed: false)
        guard let s = AuthSession(json: json) else { throw CloudError(message: "Bad session") }
        adopt(s, event: "SIGNED_IN")
    }

    func resendSignup(email: String) async throws {
        let redirect = q(Backend.webURL + "?verified=1")
        _ = try await request("POST", "/auth/v1/resend?redirect_to=\(redirect)", body: .obj(["type": "signup", "email": .str(email)]), authed: false)
    }

    func recover(email: String) async throws {
        let redirect = q(Backend.webURL + "?reset=1")
        _ = try await request("POST", "/auth/v1/recover?redirect_to=\(redirect)", body: .obj(["email": .str(email)]), authed: false)
    }

    func changeEmail(_ email: String) async throws {
        let redirect = q(Backend.webURL + "?verified=1")
        _ = try await request("PUT", "/auth/v1/user?redirect_to=\(redirect)", body: .obj(["email": .str(email)]))
    }

    func changePassword(_ password: String) async throws {
        _ = try await request("PUT", "/auth/v1/user", body: .obj(["password": .str(password)]))
    }

    func signOut() async {
        if session != nil {
            _ = try? await request("POST", "/auth/v1/logout?scope=local")
        }
        clear()
    }

    func deleteAccount() async throws {
        _ = try await request("POST", "/functions/v1/delete-account", body: .obj([:]))
    }

    /// Picks up a session left by the old WebView app, without announcing it twice.
    func restore(_ s: AuthSession) {
        session = s
        store.save(s)
    }
}

extension Cloud: CloudTransport {
    func pull(userId: String) async throws -> (data: JSON, at: String?)? {
        let json = try await request("GET", "/rest/v1/kiln_data?select=data,updated_at&user_id=eq.\(q(userId))")
        guard let row = json?.array?.first, let data = row["data"] else { return nil }
        return (data, row["updated_at"]?.string)
    }

    func update(userId: String, data: JSON, at: String, ifAt: String) async throws -> String? {
        let json = try await request("PATCH", "/rest/v1/kiln_data?user_id=eq.\(q(userId))&updated_at=eq.\(q(ifAt))&select=updated_at",
                                     body: .obj(["data": data, "updated_at": .str(at)]), headers: ["Prefer": "return=representation"])
        return json?.array?.first?["updated_at"]?.string
    }

    func insert(userId: String, data: JSON, at: String) async throws -> String? {
        do {
            let json = try await request("POST", "/rest/v1/kiln_data?select=updated_at",
                                         body: .obj(["user_id": .str(userId), "data": data, "updated_at": .str(at)]), headers: ["Prefer": "return=representation"])
            return json?.array?.first?["updated_at"]?.string ?? at
        } catch let e as CloudError where e.code == "23505" {
            return nil // already exists
        }
    }

    func upsert(userId: String, data: JSON, at: String) async throws {
        _ = try await request("POST", "/rest/v1/kiln_data", body: .obj(["user_id": .str(userId), "data": data, "updated_at": .str(at)]),
                              headers: ["Prefer": "resolution=merge-duplicates,return=minimal"])
    }
}

protocol SessionStore {
    func load() -> AuthSession?
    func save(_ s: AuthSession)
    func clear()
}

struct KeychainSessionStore: SessionStore {
    private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "com.satpurastudio.kiln", kSecAttrAccount as String: "session"]
    }

    func load() -> AuthSession? {
        var q = query
        q[kSecReturnData as String] = true
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        return AuthSession(json: JSON.parse(data))
    }

    func save(_ s: AuthSession) {
        let attrs: [String: Any] = [kSecValueData as String: s.json.data, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock]
        if SecItemUpdate(query as CFDictionary, attrs as CFDictionary) == errSecItemNotFound {
            SecItemAdd(query.merging(attrs) { _, n in n } as CFDictionary, nil)
        }
    }

    func clear() { SecItemDelete(query as CFDictionary) }
}
