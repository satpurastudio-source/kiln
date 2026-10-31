// swift-tools-version:5.10
// Lets `swift test` exercise the app's logic without building the app. The app
// target compiles the same Kiln/Core sources directly.
import PackageDescription

let package = Package(
    name: "KilnCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    targets: [
        .target(name: "KilnCore", path: "Kiln/Core"),
        .testTarget(
            name: "KilnCoreTests",
            dependencies: ["KilnCore"],
            path: "Tests/KilnCoreTests"
        ),
    ]
)
