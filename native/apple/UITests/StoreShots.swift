import XCTest

/// Store screenshots: a fresh install, onboarding, a realistic Friday morning of tasks typed the
/// way people talk, then each main screen. Run with KILN_SHOTS set to a folder (see store/README.md).
final class StoreShots: XCTestCase {
    private let app = XCUIApplication()

    private func shot(_ name: String) {
        let png = XCUIScreen.main.screenshot().pngRepresentation
        let a = XCTAttachment(data: png, uniformTypeIdentifier: "public.png")
        a.name = name
        a.lifetime = .keepAlways
        add(a)
        if let dir = ProcessInfo.processInfo.environment["KILN_SHOTS"] {
            try? png.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }

    private func button(_ label: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "identifier == %@ OR label == %@ OR label BEGINSWITH %@", label, label, label + ",")).firstMatch
    }

    private func tap(_ label: String, timeout: Double = 6, file: StaticString = #filePath, line: UInt = #line) {
        let e = button(label)
        XCTAssertTrue(e.waitForExistence(timeout: timeout), "no button: \(label)", file: file, line: line)
        e.tap()
    }

    /// Closes a one-time tip card if one is showing.
    private func closeTip() {
        let c = app.buttons.matching(NSPredicate(format: "label == %@", "Close")).firstMatch
        if c.waitForExistence(timeout: 1), c.isHittable { c.tap(); usleep(400_000) }
    }

    private func openMenuIfThere() {
        let m = button("Open menu")
        if m.waitForExistence(timeout: 1.5), m.isHittable { m.tap() }
    }

    func testStoreShots() {
        addUIInterruptionMonitor(withDescription: "notifications") { alert in
            alert.buttons["Allow"].tap()
            return true
        }
        app.launchEnvironment["KILN_CLOCK"] = "2026-11-06T10:20"
        app.launch()

        tap("Next →")
        let name = app.textFields["Your name"]
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        name.tap()
        name.typeText("Anany")
        for _ in 0..<5 { tap("Next →") }
        tap("Continue on this device")

        let add = app.textFields["quickadd"].firstMatch
        XCTAssertTrue(add.waitForExistence(timeout: 6))
        app.tap() // lets the notification alert monitor fire
        sleep(1)
        let close = button("Close")
        if close.waitForExistence(timeout: 2) { close.tap() }

        add.tap()
        for task in [
            "Call the CA about GST return today 4pm !high #work",
            "Pay electricity bill today 11am #home",
            "Buy diyas and rangoli colours today 6pm #home",
            "Send invoice to Sharma Traders today 2pm #work",
            "Gym tomorrow 7am",
            "Submit project report 12 nov !med #work",
            "Pay rent friday 5pm !high #home",
            "Book train tickets to Indore parso",
        ] {
            add.typeText(task + "\n")
            usleep(600_000)
        }
        sleep(4) // let the last "Added" note fade
        add.typeText("mummy ko kal 9 baje raat call")
        sleep(1)
        shot("02-hinglish")
        add.typeText("\n")
        sleep(4)


        openMenuIfThere()
        tap("Upcoming")
        sleep(1)
        closeTip()
        shot("03-upcoming")

        openMenuIfThere()
        tap("Calendar")
        sleep(1)
        closeTip()
        shot("04-calendar")

        openMenuIfThere()
        tap("Today")
        sleep(1)
        closeTip()
        shot("01-today")
        tap("Focus on this task")
        sleep(1)
        closeTip()
        sleep(2)
        shot("05-focus")
        tap("Minimize")
        sleep(1)

        tap("Command palette (Ctrl+K)")
        app.typeText("ambient")
        sleep(1)
        tap("Open Ambient mode")
        sleep(3)
        shot("06-ambient")
        app.tap()
        tap("Exit ambient mode")
        sleep(1)

        openMenuIfThere()
        tap("Settings")
        sleep(1)
        tap("Dark")
        sleep(1)
        tap("Done")
        sleep(1)
        closeTip()
        shot("07-dark")

        openMenuIfThere()
        tap("Settings")
        sleep(1)
        tap("Light")
        sleep(1)
        tap("हिन्दी")
        sleep(1)
        let done = app.buttons.matching(NSPredicate(format: "label == %@ OR label == %@", "Done", "हो गया")).firstMatch
        if done.waitForExistence(timeout: 2) { done.tap() }
        sleep(3) // let the list settle into Hindi
        closeTip()
        shot("08-hindi")
    }
}
