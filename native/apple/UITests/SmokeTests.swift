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
        // a row's label can run on past its title ("Open Ambient mode, Action")
        let e = app.buttons.matching(NSPredicate(format: "identifier == %@ OR label == %@ OR label BEGINSWITH %@", label, label, label + ",")).firstMatch
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
        add.typeText("Water the plants today\n")
        sleep(1)
        shot("07-added")
        // a tap outside isn't enough to leave the field on iOS; the chips stay usable above the keyboard
        app.swipeDown()

        // complete and undo
        tap("Mark complete")
        sleep(1)
        XCTAssertTrue(app.buttons["Undo"].waitForExistence(timeout: 3))
        shot("08-completed")
        app.buttons["Undo"].tap()
        sleep(1)

        // reorder inside a folder, by the grip (upward: a drop near the bottom completes the task)
        tap("Open menu")
        shot("09-drawer")
        tap("folder-Getting Started")
        sleep(1)
        let moved = app.staticTexts["Add a task using the bar above"].firstMatch
        XCTAssertTrue(moved.waitForExistence(timeout: 4))
        let before = moved.frame.minY
        let grip = app.descendants(matching: .any).matching(identifier: "grip-Add a task using the bar above").firstMatch
        XCTAssertTrue(grip.waitForExistence(timeout: 3))
        let from = grip.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        from.press(forDuration: 0.15, thenDragTo: from.withOffset(CGVector(dx: 0, dy: -130)))
        sleep(1)
        XCTAssertLessThan(moved.frame.minY, before, "the row should have moved up")
        shot("10-reordered")

        // focus
        tap("Focus on this task")
        sleep(1)
        XCTAssertTrue(app.buttons["25 · 5"].waitForExistence(timeout: 3))
        shot("11-focus")
        tap("Minimize")
        sleep(1)
        shot("12-focus-pill")

        // search, and what it finds
        tap("Command palette (Ctrl+K)")
        app.typeText("ambient")
        sleep(1)
        shot("13-palette")
        tap("Open Ambient mode")
        sleep(2)
        shot("14-ambient")
        app.tap()
        tap("Exit ambient mode")
        sleep(1)

        // settings: language stays put, dark mode, reminders
        tap("Open menu")
        tap("Settings")
        sleep(1)
        tap("हिन्दी")
        sleep(1)
        shot("15-hindi")
        tap("English") // only there if Settings stayed open through the language change
        sleep(1)
        tap("Dark")
        sleep(1)
        shot("16-dark-settings")
        for _ in 0..<6 where !app.buttons["Send a test"].exists { app.swipeUp() }
        if app.buttons["Send a test"].waitForExistence(timeout: 2) {
            app.buttons["Send a test"].tap()
            sleep(1)
            shot("17-test-sent")
        } else {
            shot("17-no-test-button")
        }
        tap("Done")
        sleep(1)
        shot("18-dark")
    }
}
