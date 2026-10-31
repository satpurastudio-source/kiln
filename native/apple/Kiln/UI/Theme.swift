import CoreText
import SwiftUI

extension Color {
    init(hex: String, opacity: Double = 1) {
        let (r, g, b) = hexRGB(hex)
        self.init(.sRGB, red: Double(r) / 255, green: Double(g) / 255, blue: Double(b) / 255, opacity: opacity)
    }
}

/// The design tokens from index.css, resolved for the current theme, accent and text size.
struct Tok: Equatable {
    var dark = false
    var accentHex = "#d85a30"
    var accent2Hex = "#ea6840"
    var deepHex = "#c24a24"
    var scale = 1.0

    init() {}
    init(_ s: AppState) {
        dark = s.theme == "dark"
        let a = resolveAccent(s.settings)
        accentHex = a.accent
        accent2Hex = a.accent2
        deepHex = a.deep
        scale = s.textScale
    }

    private var ink: (Double, Double, Double) { dark ? (244, 239, 230) : (42, 38, 32) }
    private func inked(_ o: Double) -> Color { Color(.sRGB, red: ink.0 / 255, green: ink.1 / 255, blue: ink.2 / 255, opacity: o) }

    var accent: Color { Color(hex: accentHex) }
    var accent2: Color { Color(hex: accent2Hex) }
    var deep: Color { Color(hex: deepHex) }
    var danger: Color { Color(hex: "#c43d2b") }
    var bg: Color { dark ? Color(hex: "#0e0b08") : Color(hex: "#f4efe6") }
    var raise: Color { dark ? Color(hex: "#181310") : .white }
    var panel: Color { dark ? inked(0.035) : Color.white.opacity(0.7) }
    var panelHover: Color { dark ? inked(0.07) : Color.white.opacity(0.98) }
    var panelStrong: Color { dark ? Color(.sRGB, red: 24 / 255, green: 19 / 255, blue: 16 / 255, opacity: 0.92) : Color.white.opacity(0.94) }
    var border: Color { inked(dark ? 0.08 : 0.12) }
    var borderStrong: Color { inked(dark ? 0.2 : 0.28) }
    var text: Color { inked(1) }
    var text2: Color { inked(0.62) }
    var text3: Color { inked(dark ? 0.38 : 0.42) }
    var dot: Color { inked(dark ? 0.045 : 0.055) }
    var scrim: Color { dark ? Color.black.opacity(0.55) : inked(0.4) }

    func ui(_ size: Double, _ weight: Font.Weight = .regular) -> Font { .custom("Figtree", size: size * scale).weight(weight) }
    func mono(_ size: Double, medium: Bool = false) -> Font { .custom(medium ? "DMMono-Medium" : "DMMono-Regular", size: size * scale) }
    /// Display sizes are not scaled by the text-size setting, as on the web.
    func display(_ size: Double) -> Font { .custom("BebasNeue-Regular", size: size) }
}

private struct TokKey: EnvironmentKey { static let defaultValue = Tok() }
extension EnvironmentValues {
    var tok: Tok {
        get { self[TokKey.self] }
        set { self[TokKey.self] = newValue }
    }
}

enum Fonts {
    static func register() {
        for name in ["Figtree", "BebasNeue", "DMMono", "DMMono-Medium"] {
            if let url = Bundle.main.url(forResource: name, withExtension: "ttf", subdirectory: "fonts") ?? Bundle.main.url(forResource: name, withExtension: "ttf") {
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            }
        }
    }
}

/// kiln's brand mark, flattened from the SVG in Icons.jsx (shared/flame.json).
struct FlameShape: Shape {
    private static let cubics: [Double] = [9.881, 14.5, 11, 13.381, 11, 12, 11, 10.62, 10.5, 10, 10, 9, 8.928, 6.857, 9.776, 4.946, 12, 3, 12.5, 5.5, 14, 7.9, 16, 9.5, 18, 11.1, 19, 13, 19, 15, 19, 18.866, 15.866, 22, 12, 22, 8.134, 22, 5, 18.866, 5, 15, 5, 13.847, 5.433, 12.706, 6, 12, 6, 13.381, 7.119, 14.5, 8.5, 14.5]
    func path(in r: CGRect) -> Path {
        let k = min(r.width, r.height) / 24
        func pt(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: r.minX + x * k, y: r.minY + y * k) }
        var p = Path()
        p.move(to: pt(8.5, 14.5))
        let c = Self.cubics
        for i in stride(from: 0, to: c.count, by: 6) {
            p.addCurve(to: pt(c[i + 4], c[i + 5]), control1: pt(c[i], c[i + 1]), control2: pt(c[i + 2], c[i + 3]))
        }
        p.closeSubpath()
        return p
    }
}

struct BrandMark: View {
    @Environment(\.tok) private var tok
    var size: CGFloat = 32
    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.3)
            .fill(LinearGradient(colors: [tok.accent2, tok.deep], startPoint: .topLeading, endPoint: .bottomTrailing))
            .frame(width: size, height: size)
            .overlay(FlameShape().stroke(.white, style: StrokeStyle(lineWidth: size * 0.055, lineCap: .round, lineJoin: .round)).frame(width: size * 0.55, height: size * 0.55))
    }
}

/// Warm paper with two faint accent glows and the dot grid. Drawn once, no blur, no timers.
struct Backdrop: View {
    @Environment(\.tok) private var tok
    var body: some View {
        Canvas(rendersAsynchronously: true) { ctx, size in
            ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .color(tok.bg))
            let m = max(size.width, size.height)
            ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .radialGradient(Gradient(colors: [tok.accent.opacity(0.06), .clear]), center: CGPoint(x: size.width * 0.1, y: size.height * 0.15), startRadius: 0, endRadius: m * 0.36))
            ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .radialGradient(Gradient(colors: [tok.accent.opacity(0.05), .clear]), center: CGPoint(x: size.width * 0.9, y: size.height * 0.8), startRadius: 0, endRadius: m * 0.38))
            var dots = Path()
            for x in stride(from: 13.0, to: size.width, by: 26) {
                for y in stride(from: 13.0, to: size.height, by: 26) {
                    dots.addEllipse(in: CGRect(x: x - 0.75, y: y - 0.75, width: 1.5, height: 1.5))
                }
            }
            ctx.fill(dots, with: .color(tok.dot))
        }
        .ignoresSafeArea()
    }
}

struct ProgressRing: View {
    @Environment(\.tok) private var tok
    var size: CGFloat = 18
    var stroke: CGFloat = 2.5
    var pct: Double
    var color: Color?
    var body: some View {
        ZStack {
            Circle().stroke(tok.borderStrong, lineWidth: stroke)
            Circle().trim(from: 0, to: pct / 100)
                .stroke(color ?? tok.accent, style: StrokeStyle(lineWidth: stroke, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.spring(response: 0.7, dampingFraction: 0.8), value: pct)
        }
        .frame(width: size, height: size)
    }
}

struct CheckCircle: View {
    var checked: Bool
    var color: Color
    var action: () -> Void
    @Environment(\.tok) private var tok
    private let rest = Color(hex: "#8e8478", opacity: 0.55)

    var body: some View {
        Button {
            if !checked { tick() }
            action()
        } label: {
            ZStack {
                Circle().fill(checked ? color : .clear)
                Circle().stroke(checked ? color : rest, lineWidth: 1.5)
                Path { p in
                    p.move(to: CGPoint(x: 6.9, y: 11.5))
                    p.addLine(to: CGPoint(x: 9.5, y: 14.2))
                    p.addLine(to: CGPoint(x: 15.1, y: 8.4))
                }
                .trim(from: 0, to: checked ? 1 : 0)
                .stroke(.white, style: StrokeStyle(lineWidth: 1.9, lineCap: .round, lineJoin: .round))
                .frame(width: 22, height: 22)
            }
            .frame(width: 22, height: 22)
            .scaleEffect(checked ? 1 : 0.98)
            .animation(.spring(response: 0.3, dampingFraction: 0.55), value: checked)
            .frame(width: 34, height: 34)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(checked ? t("markIncomplete") : t("markComplete"))
    }
}

struct Chip<Label: View>: View {
    @Environment(\.tok) private var tok
    var on = false
    var action: () -> Void
    @ViewBuilder var label: () -> Label
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) { label() }
                .font(tok.ui(13, .medium))
                .foregroundStyle(on ? tok.accent : tok.text2)
                .padding(.horizontal, 11)
                .frame(minHeight: 27)
                .background(on ? tok.accent.opacity(0.12) : .clear, in: Capsule())
                .overlay(Capsule().stroke(on ? tok.accent.opacity(0.6) : tok.border))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

struct PrimaryButton: View {
    @Environment(\.tok) private var tok
    var title: String
    var wide = false
    var busy = false
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(tok.ui(14, .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 18)
                .frame(maxWidth: wide ? .infinity : nil, minHeight: 42)
                .background(LinearGradient(colors: [tok.accent, tok.deep], startPoint: .top, endPoint: .bottom), in: RoundedRectangle(cornerRadius: 12))
                .opacity(busy ? 0.6 : 1)
        }
        .buttonStyle(Press())
        .disabled(busy)
    }
}

struct GhostButton: View {
    @Environment(\.tok) private var tok
    var title: String
    var wide = false
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(tok.ui(14, .medium))
                .foregroundStyle(tok.text2)
                .padding(.horizontal, 16)
                .frame(maxWidth: wide ? .infinity : nil, minHeight: 42)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(tok.border))
                .contentShape(Rectangle())
        }
        .buttonStyle(Press())
    }
}

struct MiniButton: View {
    @Environment(\.tok) private var tok
    var title: String
    var danger = false
    var primary = false
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(tok.ui(12.5, .medium))
                .foregroundStyle(primary ? .white : danger ? tok.danger : tok.text2)
                .padding(.horizontal, 11)
                .frame(minHeight: 28)
                .background(primary ? tok.accent : .clear, in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(danger ? tok.danger.opacity(0.4) : tok.border))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct Press: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(response: 0.2, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

struct IconButton: View {
    @Environment(\.tok) private var tok
    var symbol: String
    var size: CGFloat = 14
    var color: Color?
    var label: String
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: size, weight: .medium))
                .foregroundStyle(color ?? tok.text2)
                .frame(width: 32, height: 32)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .help(label)
    }
}

struct KField: View {
    @Environment(\.tok) private var tok
    var placeholder: String
    @Binding var text: String
    var secure = false
    var limit: Int?
    var submit: (() -> Void)?
    #if os(iOS)
    var keyboard: UIKeyboardType = .default
    #endif

    var body: some View {
        Group {
            if secure { SecureField(placeholder, text: $text) } else { TextField(placeholder, text: $text) }
        }
        .textFieldStyle(.plain)
        .font(tok.ui(15))
        .foregroundStyle(tok.text)
        .padding(.horizontal, 13)
        .frame(minHeight: 44)
        .background(tok.panel, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(tok.border))
        .onSubmit { submit?() }
        .onChange(of: text) { _, v in
            if let limit, v.count > limit { text = String(v.prefix(limit)) }
        }
        #if os(iOS)
        .keyboardType(keyboard)
        .textInputAutocapitalization(keyboard == .emailAddress || secure ? .never : .sentences)
        .autocorrectionDisabled(keyboard == .emailAddress || secure)
        #endif
    }
}

/// A wrapping row, for chips.
struct Flow: Layout {
    var spacing: CGFloat = 7
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrange(subviews, width: proposal.width ?? .infinity).size
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let a = arrange(subviews, width: bounds.width)
        for (i, p) in a.points.enumerated() {
            subviews[i].place(at: CGPoint(x: bounds.minX + p.x, y: bounds.minY + p.y), proposal: .unspecified)
        }
    }
    private func arrange(_ subviews: Subviews, width: CGFloat) -> (size: CGSize, points: [CGPoint]) {
        var points: [CGPoint] = []
        var x: CGFloat = 0, y: CGFloat = 0, line: CGFloat = 0, maxX: CGFloat = 0
        for s in subviews {
            let z = s.sizeThatFits(.unspecified)
            if x > 0 && x + z.width > width {
                x = 0
                y += line + spacing
                line = 0
            }
            points.append(CGPoint(x: x, y: y))
            x += z.width + spacing
            maxX = max(maxX, x - spacing)
            line = max(line, z.height)
        }
        return (CGSize(width: maxX, height: y + line), points)
    }
}

struct Confetti: View {
    let trigger: Int
    var colors: [Color]
    @State private var start: Date?
    private struct Bit { let x, vx, vy, spin, size: Double; let color: Int }
    @State private var bits: [Bit] = []

    var body: some View {
        Group {
            if let start {
                TimelineView(.animation) { tl in
                    Canvas { ctx, size in
                        let time = tl.date.timeIntervalSince(start)
                        for b in bits {
                            let x = b.x * size.width + b.vx * time
                            let y = size.height * 0.68 + b.vy * time + 520 * time * time
                            var c = ctx
                            c.opacity = max(0, 1 - time / 2.4)
                            c.translateBy(x: x, y: y)
                            c.rotate(by: .radians(b.spin * time))
                            c.fill(Path(CGRect(x: -b.size / 2, y: -b.size / 3, width: b.size, height: b.size * 0.66)), with: .color(colors[b.color % colors.count]))
                        }
                    }
                }
                .allowsHitTesting(false)
            }
        }
        .ignoresSafeArea()
        .onChange(of: trigger) {
            bits = (0..<140).map { i in
                let side = i % 3
                let origin = side == 0 ? 0.5 : side == 1 ? 0.05 : 0.95
                let dir = side == 0 ? Double.random(in: -300...300) : side == 1 ? Double.random(in: 60...420) : Double.random(in: -420 ... -60)
                return Bit(x: origin, vx: dir, vy: Double.random(in: -760 ... -300), spin: Double.random(in: -9...9), size: Double.random(in: 5...10), color: i)
            }
            start = Date()
            Task {
                try? await Task.sleep(for: .seconds(2.5))
                start = nil
            }
        }
    }
}
