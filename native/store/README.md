# kiln store kit

- `listing.md`: names, descriptions, keywords and release notes for Google Play and the App Store. `node check.mjs` checks every field against the store limits.
- `privacy.md`: Google Play Data safety and App Store App Privacy answers, matched to what the apps send.
- Screenshots and graphics are not in git (they're large and can be remade). The current set is in `~/Downloads/kiln-store-assets/`:
  - `iphone-6.9/` 1320×2868, `ipad-13/` 2064×2752, `android-phone/` 1080×2400 — eight screens each
  - `feature-graphic-1024x500.png` (Play), `icon-512.png` (Play)

## Remaking the screenshots

Both run a fresh install at Friday 6 Nov 2026, 10:20 (a debug-only clock hook: `KILN_CLOCK` on Apple,
the `kiln_clock` launch extra on Android), type a realistic morning of tasks the way people talk, and
capture Today, Hinglish typing, Upcoming, Calendar, Focus, Ambient, dark mode and Hindi.

**iPhone and iPad** (`apple/UITests/StoreShots.swift`):

```sh
cd native/apple
xcrun simctl create "Store iPhone 6.9" com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max
xcrun simctl create "Store iPad 13" com.apple.CoreSimulator.SimDeviceType.iPad-Pro-13-inch-M5-12GB
# for each: boot it, uninstall com.satpurastudio.kiln, then
xcrun simctl status_bar <id> override --time 10:20 --batteryState charged --batteryLevel 100 --wifiBars 3 --cellularBars 4
TEST_RUNNER_KILN_SHOTS=/some/folder xcodebuild test -project Kiln.xcodeproj -scheme Kiln \
  -destination "platform=iOS Simulator,id=<id>" -only-testing:KilnUITests/StoreShots/testStoreShots
```

**Android** (`android-shots.py`): start the `Kiln_Pixel` emulator, install `app-debug.apk`, turn on
System UI demo mode for a clean status bar (`adb shell settings put global sysui_demo_allowed 1`, then
the `com.android.systemui.demo` broadcasts for clock 1020, battery 100, notifications hidden), and run
`python3 android-shots.py /some/folder` (needs Python 3; no packages).
