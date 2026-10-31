import XCTest
@testable import KilnCore

/// Everything here was computed by the web app's own JavaScript
/// (native/scripts/gen-shared.mjs), so these pin the port to the original.
final class GoldenTests: XCTestCase {
    private func fixture(_ name: String) throws -> JSON {
        let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().appendingPathComponent("shared/fixtures/\(name).json")
        return try XCTUnwrap(JSON.parse(try Data(contentsOf: url)))
    }

    private func at(_ f: JSON) {
        let n = f["now"]!.array!.map { Int($0.number!) }
        Clock.override = makeDate(n[0], n[1] - 1, n[2], n[3], n[4])
    }

    override func tearDown() { Clock.override = nil }

    func testStableStringify() throws {
        for c in try fixture("stable")["cases"]!.array! {
            XCTAssertEqual(c["value"]!.stable, c["json"]!.string!)
        }
    }

    func testParseQuickAdd() throws {
        let f = try fixture("parse")
        at(f)
        let projects = f["projects"]!.array!.map { (id: $0["id"]!.string!, name: $0["name"]!.string!) }
        for c in f["cases"]!.array! {
            let input = c["input"]!.string!, o = c["output"]!
            let p = parseQuickAdd(input, projects: projects)
            let got = Parsed(title: o["title"]!.string!, projectId: o["projectId"]?.string, newFolder: o["newFolder"]?.string,
                             priority: o["priority"]?.string, time: o["time"]?.string, due: o["due"]?.string)
            XCTAssertEqual(p, got, "input: \(input)")
        }
    }

    func testNextDue() throws {
        let f = try fixture("nextDue")
        at(f)
        for c in f["cases"]!.array! {
            XCTAssertEqual(nextDue(c["due"]?.string, c["repeat"]!.string!), c["next"]!.string!, "\(c.stable)")
        }
    }

    func testTimesAccentsHabits() throws {
        let f = try fixture("misc")
        at(f)
        I18n.lang = "en"
        for c in f["times"]!.array! { XCTAssertEqual(fmtTime(c["value"]!.string!), c["label"]!.string!) }
        for c in f["accents"]!.array! {
            let hex = c["hex"]!.string!
            let a = deriveAccent(hex)
            XCTAssertEqual(a.accent2, c["accent2"]!.string!, hex)
            XCTAssertEqual(a.deep, c["deep"]!.string!, hex)
            let (r, g, b) = hexRGB(hex)
            XCTAssertEqual("\(r), \(g), \(b)", c["rgb"]!.string!)
        }
        for c in f["habits"]!.array! {
            XCTAssertEqual(Habit(["log": c["log"]!]).streak, Int(c["streak"]!.number!), c.stable)
        }
    }

    func testMerge() throws {
        for c in try fixture("merge")["cases"]!.array! {
            let got = mergeSnapshots(base: Snapshot(json: c["base"]), local: Snapshot(json: c["local"]), remote: Snapshot(json: c["remote"]))
            XCTAssertEqual(got.json.stable, Snapshot(json: c["merged"]).json.stable, c["name"]!.string!)
        }
    }

    func testBackup() throws {
        let f = try fixture("backup")
        let got = try parseBackup(Data(f["input"]!.string!.utf8))
        let want = Snapshot(json: f["output"])
        XCTAssertEqual(got.projects.map { JSON.obj($0).stable }, want.projects.map { JSON.obj($0).stable })
        XCTAssertEqual(got.tasks.map { JSON.obj($0).stable }, want.tasks.map { JSON.obj($0).stable })
        XCTAssertEqual(got.habits.map { JSON.obj($0).stable }, want.habits.map { JSON.obj($0).stable })
    }
}
