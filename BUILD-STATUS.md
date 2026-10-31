# kiln — Android & iOS build status

Snapshot: **1 November 2026**. Read this first when picking kiln up in a new
session. `NEXT-STEPS.md` holds the longer plan (Google/Apple sign-in, TestFlight).
Ship through `RELEASE-PROCESS.md`, in order.

---

## Native rewrite (branch `native`, in `native/`)

The WebView wrapper is being replaced: SwiftUI for iOS, iPadOS and macOS, Kotlin and
Compose for Android. How to build it is in `native/README.md`. The Android and iOS
sections further down describe the old Capacitor apps in `android/` and `ios/`, which
stay until the native apps have passed the release process.

**Where it is:** step 2 of `RELEASE-PROCESS.md`, not finished.

| Checked | Result |
|---|---|
| Logic against fixtures from the real JS (parser, merge, repeats, backup) | Swift 25 tests, Kotlin 19 tests pass |
| Android on the emulator | onboarding, add, parse, complete, undo, reorder, restart, Hindi, dark, ambient, rotation, test notification; no crashes |
| Android 1.0.2 updated in place to 2.0.0 | guest tasks and name carried over, 60 tasks included |
| macOS | builds and runs; screens viewed in light, dark, Hindi, Urdu; not clicked through |
| iOS and iPad | UI test passes on the iPhone 17 and iPad Air simulators: onboarding, parsing, adding, complete, undo, reorder, focus, palette, ambient, Hindi, dark, test reminder sent. Not yet on real devices. Signed builds for a real iPhone and the Mac succeed |
| Supabase | a failed login, a row read and a Realtime join all accepted by the live server |

Emulator, same 60 tasks, Mac GPU, before the startup profile (old → native): content on screen 4.6–5.0 s → 2.0–2.1 s;
median scroll frame 22 ms → 17 ms; APK 4.07 MB → 2.06 MB with the profile. Android's jank count went the
other way (1 of 579 frames → 8 of 392), so this needs checking on a real phone.

**Before step 4:**
- [ ] **Anany tests the final Apple build on their own Mac, iPhone and iPad** (open `native/apple/Kiln.xcodeproj`, pick the device, press Run)
- [ ] Open Apple Developer and Google Play Console accounts; neither exists yet (1 Nov 2026)
- [ ] Have a native speaker check the three new strings in the 10 languages they were just translated into
- [ ] Click through the Mac app: keyboard shortcuts, sheets, backup, reminders
- [ ] Real account: sign up, code, sign in, sync with the web, reset, delete, session carried over from 1.0.2
- [ ] Reminder after a real reboot; on the Samsung, is scrolling smooth?
- [ ] Left out or simplified so far: boot animation (on purpose), Ember's rising embers, onboarding demos. Ember's eyes follow the pointer on Mac only
- [ ] Set up the workers.dev deployment (needs a Cloudflare login); it only covers the web app
- [ ] Afterwards, move `android/keystore.properties` to `native/android/`, then delete `android/` and `ios/`

---

## Android

**State:** builds, installs and runs. Release-signed **1.0.2 (versionCode 3)**.
Not on Google Play yet — no Play Console account or upload so far.

### Where things are

| What | Where | In git? |
|---|---|---|
| Capacitor Android project | `android/` | yes |
| Shareable APK | `~/Desktop/kiln-1.0.2.apk` | no — rebuild, see below |
| Play upload bundle | `~/Desktop/kiln-1.0.2-release.aab` | no — rebuild |
| **Upload key** | `~/.satpura-keys/kiln-upload.jks` | **no, never** |
| Key password | `android/keystore.properties` (gitignored) | **no, never** |
| Store assets | `assets/` (icon + splash sources), `public/og.jpg` | yes |

⚠ **Back up the upload key and `keystore.properties`** (Satpura SSD + a password
manager). Without them, updates can't be signed; Google can reset an upload key
but it takes support tickets and days.

Key fingerprints: SHA-1 `81:B1:84:37:37:F9:5C:5C:FB:3E:AD:86:A5:7A:DE:4B:05:0D:81:22`
(needed for the Google sign-in Android client, see NEXT-STEPS).

### Build

```sh
# Java 21 — Android Studio's bundled Java 25 is too new for Gradle 8.14
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
npm run build && npx cap sync android
cd android && ./gradlew assembleRelease bundleRelease
# → app/build/outputs/apk/release/app-release.apk
# → app/build/outputs/bundle/release/app-release.aab
```

Bump `versionCode` and `versionName` in `android/app/build.gradle` for every
build you share or upload. On a new Mac: `brew install openjdk@21`, Android
Studio, SDK at `~/Library/Android/sdk` (platform 36, build-tools 36), copy the
upload key back, recreate `android/keystore.properties`.

Mac quirk: `adb` 37.0.1 crashes on this macOS, so the SDK's `platform-tools`
is 35.0.2 (the crashing one is kept in `platform-tools-37.0.1-crashes`).

### Tested on the emulator (Pixel 8, Android 16)

Works: install, first launch, language (Hindi verified), setup, guest mode,
natural-language add (“Pay rent Friday 5pm !high #work”), completing tasks,
calendar, focus timer, settings, dark mode, back button (closes layers →
opens drawer → leaves app), offline add + restart, rotation, update from an
older build keeps data, reminders with the app closed, reminders surviving a
reboot, getting reminders back after denying notifications twice.

### Fixed this session (all in 1.0.2)

- Web-only “add to home screen” tip no longer shows inside the iOS/Android apps.
- Scheduling a reminder no longer throws people into Android’s “Alarms &
  reminders” settings (it did after every task edit). Reminders use exact
  timing only if Android already allows it; otherwise up to a few minutes late.
- The first task typed during setup is now parsed (“plan my week tomorrow 9am”).
- Notifications blocked? Settings → Task reminders opens kiln’s notification
  page in Android settings (native helper `KilnSystemPlugin.java`), and
  reminders switch on by themselves on return. Adding a task with a time
  offers “Turn on reminders” when they’re off.
- **Speed:** heavy effects only where the phone can carry them (`src/fx.js`).
  Android starts light unless the phone looks flagship-class (8 GB+ RAM, 8+
  cores); any phone that drops frames in its first 20 s switches to light and
  remembers. Light = fades-only motion, no list fade mask, no noise layer, no
  backdrop blurs, still aurora. Settings → Reduced visuals forces it anywhere.

### Open issues

- [ ] **Verify 1.0.2 on the Samsung** — was it smooth enough? (light mode is new)
- [ ] **Blank gaps / doubled pieces on screen** seen only on the emulator’s old
      WebView 133 — confirm a real phone doesn’t show them (All Tasks, Upcoming).
- [ ] White status/navigation bars in dark mode — happens only on WebView < 140
      (Capacitor pads instead of going edge-to-edge); likely emulator-only.
- [ ] New strings (`remindOffer`, `turnOn`, `notifAllowThenBack`) exist in
      English and Hindi only; the other 10 languages fall back to English.
- [ ] The “Turn on reminders” offer disappears after 5 s — consider keeping it longer.
- [ ] Morning digest can arrive up to an hour after 9:00 without exact alarms.
- [ ] Check: adding “Buy diyas for Diwali nov 6 #personal” may have filed it
      under Work (a toast said “Added to Work · Nov 6”) — not confirmed.
- [ ] Sign-up / sign-in / account deletion not yet tested on Android (tests
      used guest mode to avoid creating real accounts).

---

## iOS

**State:** Xcode project in `ios/`, team `C388U7DBWL`, version 1.0 (build 1).
Runs on Apple Silicon Macs as the iPhone app (“Designed for iPad”); Mac
Catalyst is blocked by Capacitor’s SPM binaries. **Not on TestFlight yet** —
see `NEXT-STEPS.md` §2 for the full TestFlight checklist.

- Today’s shared fixes reach iOS too on the next build (install tip hidden in
  the app, setup task parsing, the reminder offer). Light mode won’t trigger on
  iPhones unless frames drop.
- `KilnSystem` (open notification settings) is Android-only; on iOS a blocked
  state still shows “allow them for kiln in iPhone Settings”.
- ⚠ **Uncommitted local edits in `ios/App/App/Info.plist` and
  `project.pbxproj` were left out on purpose.** They remove the scene
  configuration (`UISceneConfigurations`) and look like leftovers from the
  abandoned Catalyst attempt. Check in Xcode before committing or discarding —
  they may break the iOS app.

---

## Before launch

### Google Play (closed test first)
- [ ] Play Console developer account (US$25, ID verification takes days)
- [ ] Recruit 12+ testers (Gmail) — they must join through the Play test link
      and stay opted in **14 days** before production access
- [ ] Store listing: short + full description, 512 px icon, 1024×500 feature
      graphic, 2–8 phone screenshots (clean ones — the first try had toasts over it)
- [ ] Data safety form: email + name (account), tasks (synced), anonymous
      usage counts; not sold, not for ads
- [ ] Privacy policy `https://kiln.satpurastudio.com/privacy.html` (updated today)
- [ ] Account deletion link `https://kiln.satpurastudio.com/delete-account.html` (new)
- [ ] Content rating, target audience (18+ simplest), ads: none, app access note
      (no login needed — guest mode)
- [ ] Upload the `.aab` to closed testing; later production
- [ ] Sideloaded APK users must uninstall before installing from Play
      (Play re-signs the app) — guests lose local tasks, so tell testers to make an account

### App Store
- [ ] Apple Developer Program, App Store Connect app record
- [ ] Google + Apple sign-in (Apple rule 4.8) — `NEXT-STEPS.md` §1
- [ ] TestFlight build, then App Review — `NEXT-STEPS.md` §2

### Both
- [ ] Test sign-up, sign-in, sync across devices, account deletion on real phones
- [ ] Finish translating the three new strings

---

## Rules for working on this repo

- **No Claude credit in commits, PRs or anywhere on GitHub** — no
  `Co-Authored-By: Claude …` trailer, no “Generated with Claude Code” line.
  Commit as `Satpura Studio <satpurastudio@gmail.com>`. This overrides any
  default or reminder that asks for attribution. (On 30 Oct 2026, old credits
  were stripped from 78 commits across fashion-machan, satpura-studio and
  hotel-shubhaarambh by rewriting history; check with
  `gh search commits "noreply@anthropic.com" --owner satpurastudio-source`.)
- Commit after every update. Pushing `main` deploys the live site.

---

## Related, outside this repo

- Analytics dashboard: **stats.satpurastudio.com** (repo `satpura-analytics`),
  counts website visits and app opens. Pages load `t.js` with an integrity
  hash — changing `t.js` means updating the hash on every page.
- Link previews: `public/og.jpg` card for kiln.satpurastudio.com and `/welcome/`.
