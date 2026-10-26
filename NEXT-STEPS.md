# kiln — next steps

Where things stand and what comes next, in order. Tick items off as they land.

---

## ✅ Done — email sign-up works

- Sign-up sends a branded email with a code and a one-tap link, through Brevo SMTP.
- Typing the code in kiln signs you in on the spot, in the browser and in the app shell.
- Gotchas hit on the way are recorded in `SETUP-SUPABASE.md` → section 3.

---

## 1. Google + Apple sign-in (ship both, never one alone)

App Store rule 4.8: an iOS app that offers Google sign-in must also offer
Sign in with Apple. So both land together.

How each platform signs in:

| | Google | Apple |
|---|---|---|
| Web / PWA | Supabase redirect (`signInWithOAuth`) | Supabase redirect — optional, see note |
| iOS app | native Google sheet → `signInWithIdToken` | native Apple sheet → `signInWithIdToken` |
| Android app | native account picker → `signInWithIdToken` | browser redirect (no native Apple) |

Plugin: `@capgo/capacitor-social-login` (Google + Apple, iOS + Android).

### Setup on the consoles (Anany)

- [ ] **Apple Developer Program** membership active (US$99/yr — also needed for TestFlight).
- [ ] **Apple Developer → Identifiers → `com.satpurastudio.kiln`** → enable *Sign in with Apple*.
- [ ] **Google Cloud Console → APIs & Services → Credentials** → OAuth consent screen
      (app name kiln, support email, privacy + terms links), then three OAuth clients:
  - [ ] **Web** client — redirect URI `https://hdrqegyvegsbpjdjmozp.supabase.co/auth/v1/callback`
  - [ ] **iOS** client — bundle ID `com.satpurastudio.kiln`
  - [ ] **Android** client — package `com.satpurastudio.kiln` + SHA-1 of the signing key
- [ ] **Supabase → Authentication → Sign In / Providers**
  - [ ] Google: on, Web client ID + secret; add the iOS and Android client IDs to *Client IDs*
  - [ ] Apple: on, add `com.satpurastudio.kiln` to *Client IDs*

> **Apple on the web is optional.** It needs a Services ID and a secret made from
> an Apple key that **expires every 6 months** — miss the renewal and web Apple
> sign-in silently breaks. Native iOS doesn't need it. Plan: web gets Google +
> email; Apple only in the iOS app. Revisit later if wanted.

### Build (code)

- [ ] New branch off `main` — keep the live site untouched until it's tested.
- [ ] Install `@capgo/capacitor-social-login`, `npx cap sync`.
- [ ] iOS project: *Sign in with Apple* capability; Google reversed client ID URL scheme in `Info.plist`.
- [ ] `Login.jsx`: "Continue with Apple" / "Continue with Google" buttons —
      native sheets in the app, redirect on the web; nonce passed through to Supabase.
- [ ] **Guests keep their tasks** — a guest who picks Google/Apple gets the identity
      *linked* (`linkIdentity`) instead of a fresh account.
- [ ] **Apple shares the name only on the first sign-in** — save it to the profile then.
- [ ] Add the console steps above to `SETUP-SUPABASE.md`.

### Test

- [ ] Web: Google sign-in, sign-out, sign back in → same tasks.
- [ ] iOS (device, not simulator): Apple + Google, including "Hide My Email".
- [ ] Guest → Google: tasks made as guest are still there after.
- [ ] Same person, email account + Google with the same address → one account, not two.
- [ ] Account deletion still works for Google/Apple users.

---

## 2. Apple testing — TestFlight

Gets the iOS build onto real phones (yours, then testers') before App Store review.

### One-time

- [ ] **App Store Connect → Apps → ＋ New App** — platform iOS, name *kiln*,
      bundle ID `com.satpurastudio.kiln`, SKU `kiln-ios`.
- [ ] Xcode → kiln target → *Signing & Capabilities* → Team: Satpura Studio,
      automatic signing; *Sign in with Apple* capability present.
- [ ] `Info.plist`: `ITSAppUsesNonExemptEncryption` = `NO` (skips the export-compliance question every build).
- [ ] App icon 1024×1024 in place, no transparency.
- [ ] Privacy policy URL live (App Store Connect → App Privacy) + data-collection answers
      (email, name, tasks — linked to the user, not used for tracking).

### Every build

- [ ] Bump version / build number in Xcode (build number must go up every upload).
- [ ] `npm run ios` (builds web, syncs, opens Xcode).
- [ ] Xcode → device target *Any iOS Device* → **Product → Archive**.
- [ ] Organizer → **Distribute App → App Store Connect → Upload**.
- [ ] Wait for processing (~10–30 min, email arrives).

### Testers

- [ ] **Internal testing** — add yourself (and up to 100 team members); no review needed.
- [ ] **External testing** — needs a short Beta App Review. Provide a **demo account**
      (email + password with verification already done) — reviewers can't receive the code.
- [ ] Share the public TestFlight link with testers.

### Before moving on to App Store review

- [ ] Sign up, verify by code, sign in with Apple and Google — all on a TestFlight build.
- [ ] Reminders fire with the app closed.
- [ ] Account deletion works from inside the app (required by Apple).
