# kiln: privacy answers for the stores

Taken from what the native apps actually send (checked 6 Nov 2026): Supabase sign-in and the
`kiln_data` row for signed-in people, and one anonymous app-open count a day (`page_views`,
release builds only). No ads, no third-party SDKs, no tracking. Guest mode sends only the
app-open count. This matches `apple/Kiln/Resources/PrivacyInfo.xcprivacy` and
https://kiln.satpurastudio.com/privacy.html. If any of this changes, update all three.

## Google Play: Data safety

- Does your app collect or share any of the required user data types? **Yes**
- Is all of the user data collected by your app encrypted in transit? **Yes**
- Do you provide a way for users to request that their data is deleted? **Yes**, in the app (Settings → Delete account) and at https://kiln.satpurastudio.com/delete-account.html

| Data type | Collected | Shared | Optional | Purpose |
|---|---|---|---|---|
| Personal info → Email address | Yes | No | Yes (only with an account) | Account management |
| Personal info → Name | Yes | No | Yes (only with an account) | App functionality |
| App activity → Other user-generated content (tasks, notes, folders, habits) | Yes | No | Yes (only with an account; guests keep them on the phone) | App functionality |
| App activity → App interactions (an anonymous app-open count) | Yes | No | No | Analytics |

Data is not used for advertising and is not sold.

## App Store: App Privacy

- Tracking: **No**
- Data Linked to You: **Contact Info → Email Address**, **Contact Info → Name**, **User Content → Other User Content**, each for **App Functionality**
- Data Not Linked to You: **Usage Data → Product Interaction**, for **Analytics**

## Content rating questionnaire (Play)

Category: Utility, productivity, communication or other. Answer **No** to violence, sexuality,
language, controlled substances, gambling, user-to-user communication, sharing location and
digital purchases. Expected result: Everyone / PEGI 3.

## Target audience (Play)

18 and over is simplest (no Families policy review). kiln has nothing aimed at children.
