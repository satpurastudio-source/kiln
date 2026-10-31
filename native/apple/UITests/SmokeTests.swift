import XCTest

/// Drives the real app through what a first-time person does, with screenshots.
/// Set KILN_SHOTS to a folder to keep them; otherwise they stay in the test report.
final class SmokeTests: XCTestCase {
    private let app = XCUIApplication()

    private func shot(_ name: String) {
        let png = XCUIScreen.main.screenshot().pngRepresentation
        let a = XCTAttachment(data: png, uniformTypeIdentifier: "public.png")
        a.name = name
        a.lifetime = .keepAlways
        add(a)
        if let dir = ProcessInfo.processInfo.environment["SIMCTL_CHILD_KILN_SHOTS"] ?? ProcessInfo.processInfo.environment["KILN_SHOTS"] {
            try? png.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }

    private func tap(_ label: String, timeout: Double = 6, file: StaticString = #filePath, line: UInt = #line) {
        let e = app.buttons[label].firstMatch
        XCTAssertTrue(e.waitForExistence(timeout: timeout), "no button: \(label)", file: file, line: line)
        e.tap()
    }

    func testFirstRun() {
        addUIInterruptionMonitor(withDescription: "notifications") { alert in
            alert.buttons["Allow"].tap()
            return true
        }
        app.launch()
        shot("01-language")
        tap("Next →")
        let name = app.textFields["Your name"]
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        name.tap()
        name.typeText("Anany")
        tap("Next →")
        shot("02-look")
        tap("Next →")
        tap("Next →")
        shot("03-capture")
        tap("Next →")
        tap("Next →")
        shot("04-account")
        tap("Continue on this device")

        let add = app.textFields["quickadd"].firstMatch
        XCTAssertTrue(add.waitForExistence(timeout: 6))
        app.tap() // lets the notification alert monitor fire
        sleep(1)
        shot("05-today")
        add.tap()
        add.typeText("Pay rent friday 5pm !high #work")
        sleep(1)
        shot("06-parsing")
        add.typeText("\n")
        sleep(1)
        add.typeText("Call the plumber today\n")
        sleep(1)
        shot("07-added")
    }
}
