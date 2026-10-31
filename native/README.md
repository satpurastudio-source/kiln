# kiln, native

The apps, without a WebView. SwiftUI for iPhone, iPad and Mac; Kotlin and Jetpack
Compose for Android. The web app in `src/` stays live at kiln.satpurastudio.com,
and all three share one Supabase row, so a task moves between them as before.

```
native/
  apple/     SwiftUI app. Kiln/Core is logic, Kiln/App is services, Kiln/UI is screens
  android/   Compose app. core/ is logic, ui/ is screens
  shared/    locales, fonts, and test fixtures, used by both
  scripts/   regenerate shared/ and the Android icons from the web source
```

## Build

**Apple** needs Xcode, and iOS 17 / macOS 14 or later to run.

```sh
cd native/apple
swift test                  # logic tests, no simulator needed
open Kiln.xcodeproj         # pick iPhone, iPad or My Mac, press Run
```

**Android** needs Java 21 (Android Studio's Java 25 is too new for Gradle 8.14).

```sh
cd native/android
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
./gradlew :app:testDebugUnitTest
./gradlew :app:assembleRelease :app:bundleRelease
```

Bump `versionCode` and `versionName` in `app/build.gradle.kts` for each build you
share. Release signing reads `keystore.properties` from `native/android/`, or from
`android/` while that folder exists. It is the same upload key as the old app, which
is what lets this install over it. **If you delete `android/`, move the file first.**

Compose stays on BOM 2026.01.00: newer ones need Android Gradle plugin 9 and SDK 37.

## When the web app changes

The logic is ported, not shared, so a behaviour change in `src/` has to be made in
Swift and Kotlin too.

```sh
node native/scripts/gen-shared.mjs          # after changing locales, or the parser, merge, repeats
node native/scripts/gen-android-icons.mjs   # after changing Icons.jsx
```

`gen-shared.mjs` runs the real JS to produce `shared/fixtures/`, and both test suites
must reproduce those results exactly. If the JS changed on purpose, the tests fail
until the port catches up, which is the point.

The sync format must stay compatible. Records are kept as plain JSON on every
platform, so fields one version doesn't know about survive a round trip.

## Choices worth knowing

- **No Supabase SDK.** Auth, the row and Realtime are small hand-written clients
  (`Cloud`, `Realtime`). Less to load at launch, no version churn.
- **No boot animation.** The web app's typewriter loader was left out on purpose.
- **Old Android data moves automatically.** The old app kept everything in WebView
  `localStorage` for `https://localhost`. On first launch after updating, `Migration.kt`
  reads it once with a throwaway WebView: tasks, settings, sync state and sign-in.
  Fresh installs never load a WebView.
- **Email links still land on the web.** Password reset and verified pages stay there,
  as they did in the old app.
- **Reminders** use exact alarms only where Android already allows it, as in 1.0.2.
