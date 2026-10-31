import Foundation

/// Every synced record stays plain JSON, so a field added by a newer web build
/// survives a round trip through an older native app, and the merge can treat
/// fields generically the way merge.js does.
enum JSON: Equatable, Codable {
    case null, bool(Bool), num(Double), str(String), arr([JSON]), obj([String: JSON])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self) { self = .num(v) }
        else if let v = try? c.decode(String.self) { self = .str(v) }
        else if let v = try? c.decode([JSON].self) { self = .arr(v) }
        else { self = .obj(try c.decode([String: JSON].self)) }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let v): try c.encode(v)
        case .num(let v): try c.encode(v)
        case .str(let v): try c.encode(v)
        case .arr(let v): try c.encode(v)
        case .obj(let v): try c.encode(v)
        }
    }

    static func parse(_ data: Data) -> JSON? { try? JSONDecoder().decode(JSON.self, from: data) }
    static func parse(_ text: String) -> JSON? { parse(Data(text.utf8)) }

    var string: String? { if case .str(let v) = self { return v }; return nil }
    var number: Double? { if case .num(let v) = self { return v }; return nil }
    var boolean: Bool? { if case .bool(let v) = self { return v }; return nil }
    var array: [JSON]? { if case .arr(let v) = self { return v }; return nil }
    var object: [String: JSON]? { if case .obj(let v) = self { return v }; return nil }
    var isNull: Bool { self == .null }

    subscript(key: String) -> JSON? { object?[key] }

    /// merge.js stableStringify: sorted keys, JS number and string formatting.
    var stable: String {
        var out = ""
        write(to: &out)
        return out
    }
    var data: Data { Data(stable.utf8) }

    private func write(to out: inout String) {
        switch self {
        case .null: out += "null"
        case .bool(let v): out += v ? "true" : "false"
        case .num(let v): out += JSON.jsNumber(v)
        case .str(let v): JSON.jsString(v, to: &out)
        case .arr(let v):
            out += "["
            for (i, x) in v.enumerated() {
                if i > 0 { out += "," }
                x.write(to: &out)
            }
            out += "]"
        case .obj(let v):
            out += "{"
            let keys = v.keys.sorted { $0.utf16.lexicographicallyPrecedes($1.utf16) }
            for (i, k) in keys.enumerated() {
                if i > 0 { out += "," }
                JSON.jsString(k, to: &out)
                out += ":"
                v[k]!.write(to: &out)
            }
            out += "}"
        }
    }

    private static func jsNumber(_ v: Double) -> String {
        if v == v.rounded() && abs(v) < 1e21 { return String(format: "%.0f", v == 0 ? 0 : v) }
        return "\(v)"
    }

    private static func jsString(_ s: String, to out: inout String) {
        out += "\""
        for u in s.unicodeScalars {
            switch u {
            case "\"": out += "\\\""
            case "\\": out += "\\\\"
            case "\n": out += "\\n"
            case "\r": out += "\\r"
            case "\t": out += "\\t"
            case "\u{08}": out += "\\b"
            case "\u{0C}": out += "\\f"
            default:
                if u.value < 0x20 { out += String(format: "\\u%04x", u.value) }
                else { out.unicodeScalars.append(u) }
            }
        }
        out += "\""
    }
}

typealias Item = [String: JSON]

extension JSON: ExpressibleByStringLiteral, ExpressibleByFloatLiteral, ExpressibleByIntegerLiteral, ExpressibleByBooleanLiteral, ExpressibleByNilLiteral {
    init(stringLiteral v: String) { self = .str(v) }
    init(floatLiteral v: Double) { self = .num(v) }
    init(integerLiteral v: Int) { self = .num(Double(v)) }
    init(booleanLiteral v: Bool) { self = .bool(v) }
    init(nilLiteral: ()) { self = .null }
}

extension Optional where Wrapped == String {
    /// A string or JSON null, for fields like due and time.
    var json: JSON { map(JSON.str) ?? .null }
}
