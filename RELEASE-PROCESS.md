# Release process

How every Satpura Studio update ships, for kiln and for every future project.
Work through the steps in order. A step only starts once the one before it has passed.
If something breaks, fix it and go back to step 1.

## 1. Test on workers.dev

Put every update and change on a workers.dev test deployment of the project first,
and test it there. Never test on the live site.

The live site stays untouched during this step. On kiln, pushing `main` deploys the
live site, so work stays on another branch until step 5.

## 2. Test every build

Once step 1 passes, check that every build works and nothing has broken:

- Mac
- iOS
- iPad
- Android

workers.dev only covers the web version. The apps are tested on their own builds,
on a simulator or emulator and on a real device where possible.

Projects that don't have one of these builds skip that build.

## 3. Cross-check everything again

Go through everything once more from the start, including what didn't change:
the new work, the existing features, and sync between devices and the web.

## 4. Test with friends

Deploy a test build for friends to try, and fix what they find.

- iOS, iPad and Mac: TestFlight
- Android: Google Play closed testing
- Web: the workers.dev link

## 5. Release to everyone

Deploy for everyone else only when all of this is true:

- everything is done
- everything works right
- there are no known bugs
- it is polished enough

If any of those isn't true yet, it isn't ready. Say what's missing rather than shipping it.
