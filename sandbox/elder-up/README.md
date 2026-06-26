# Morning Watering 🌱

**The plant that drinks your stretches.**

Morning Watering turns the phone into a watering can. Each morning an elder
"waters" an on-screen plant by moving through **four gentle stretches** — tilt
and hold the phone like you're pouring, or simply **press and hold one big
button**. As you hold each stretch, the plant drinks and grows; finish the set
and it blooms. A care-based streak tracks the habit and **wilts when you miss a
day but never dies** — a missed morning just softens the plant, and the next
watering revives it instantly. No scores, no guilt, no failure state: just a
small living thing that's a little happier every time you move.

Built as an **Expo Go MVP** (Expo SDK 54 / React 19 / React Native 0.81.5 /
TypeScript). Pinned to SDK 54 to match the installed App Store Expo Go client —
npm's `latest` tag had already advanced to SDK 56, but the Expo Go binaries for
SDK 55/56 were not yet available, so a 54 project is what actually loads today. The plant is original art drawn entirely from React Native `View`
and `Animated` primitives — no image assets.

---

## How to run

```bash
cd sandbox/elder-up
npm install
npx expo start
```

Then open **Expo Go** on a phone and scan the QR code from the terminal.

> Corporate-network note: if a Node command fails with
> `unable to get local issuer certificate`, prefix it with
> `NODE_OPTIONS="--use-system-ca"` (e.g. `NODE_OPTIONS="--use-system-ca" npx expo export`).

---

## Accessibility choices (elder-first)

The design targets users 65+ and is intentionally larger and calmer than typical
mobile UI. Tokens live in `src/theme.ts`.

- **Large type.** Body text is 24pt, buttons 28pt, headings 30–40pt, the streak
  number 56pt — readable at arm's length.
- **High contrast.** Near-black ink (`#1F2A33`) on a light morning sky
  (`#EAF6FF`) clears WCAG AA comfortably; the green primary CTA uses white text.
  The hold timer readout uses ink (13.3:1), not the water blue (which failed AA).
- **Big tap targets.** Minimum touch target is 64pt (`TOUCH_MIN`); primary
  actions (`BigButton`) are larger still (72pt), and seated/standing choices are 72pt.
- **Two equal input paths.** Every stretch can be completed by **press-and-hold**
  on a large button *or* by tilting the phone. Tap-and-hold is always offered and
  is the primary, no-sensor path.
- **Screen-reader labels.** Headings use `accessibilityRole="header"`; the streak,
  toggles, seated/standing radio group, and hold progress bar carry explicit
  labels/state; decorative progress dots and plant art are hidden from assistive
  tech.
- **Reduce-motion aware.** Both the home plant and the session read the OS "reduce
  motion" setting (live-subscribed on Home) and skip the idle sway.
- **Spoken coaching + gentle haptics**, both user-toggleable, default on.
- **Stays awake & forgiving.** The screen is kept awake during a session
  (`expo-keep-awake`); backgrounding the app (a call, lock) pauses cleanly; you
  can stop "I'm done for today" at any point and still get credit.
- **Seated by default.** The pre-session screen defaults to sitting and shows a
  plain safety line ("move only as far as feels comfortable").

---

## Verified vs. unverified on-device

This build was finished and checked on a Windows development machine **without a
phone, sensors, or Expo Go runtime**. Be honest about what that does and doesn't
prove:

### ✅ Verified
- **Type safety** — `npx tsc --noEmit` passes with no errors.
- **Bundle builds** — `npx expo export --platform ios` produces a bundle with no
  errors (the real "it compiles and packages" gate).
- **Tap-and-hold flow** — the press-and-hold path through warmup → 4 stretches →
  rest beats → finish/reward is the verified default and does not depend on any
  sensor.
- **State machine & persistence** — screen routing, streak/mood logic
  (`recordWatering`, `moodFor`), and AsyncStorage load/save are wired and
  type-checked.

### ⚠️ Unverified (needs a real device)
- **Tilt detection.** `useTiltHold` reads the accelerometer via `expo-sensors`.
  The `matchTilt` predicates in `src/data/stretches.ts` are **deliberately
  forgiving and must be tuned on a real device** — they have not been validated
  against real motion. The app degrades gracefully when no sensor is present and
  falls back to tap-and-hold.
- **Haptics.** `expo-haptics` feedback is unverified (no device).
- **Text-to-speech.** `expo-speech` spoken coaching is unverified (no device).
- **Screen-reader pass with a live reader** (VoiceOver/TalkBack). Labels are in
  place in code but have not been driven by an actual screen reader.

**Next device step:** run on a phone in Expo Go, tune the `matchTilt` thresholds
in `src/data/stretches.ts`, and confirm haptics/TTS/VoiceOver behave as intended.

### Known accessibility follow-ups (from independent review)

An independent accessibility review fixed the cheap, certain issues (contrast of
the hold readout, missing progressbar/radiogroup labels, reduce-motion on Home,
explicit Switch state, loading-spinner label, secondary-button hint). Three
larger items were **deliberately left for a device-verified follow-up** rather
than built speculatively on a machine with no phone:

1. **Screen-reader operable watering.** The "Hold to water" mechanic relies on a
   continuous physical press (`onPressIn`/`onPressOut`). Under VoiceOver/TalkBack
   the standard double-tap fires press-in and press-out instantly, so hold time
   may not accumulate. Recommended fix: add an `accessibilityActions` "longPress"
   action that runs a timed auto-watering sequence. Needs on-device verification
   of the real screen-reader gesture behavior first. (Sighted users always have
   the tap-and-hold and tilt paths.)
2. **Android edge-to-edge safe area.** The root uses RN's built-in `SafeAreaView`
   (fine on iOS). For Android edge-to-edge, add `react-native-safe-area-context`
   (bundled with the SDK) + `SafeAreaProvider` so the header doesn't sit under the
   status bar.
3. **Phase-change announcements.** Session phase transitions
   (warmup→stretch→rest→finish) swap the whole view without an
   `AccessibilityInfo.announceForAccessibility()` call; screen-reader focus can be
   lost. Add a short announcement after each `setPhase`.

---

## Project structure

```
App.tsx                     root state machine (home ↔ pre ↔ session)
index.ts                    registerRootComponent(App)
src/
  theme.ts                  elder-first design tokens
  types.ts                  Stretch, PlantMood, Settings, Progress, Screen
  data/stretches.ts         the 4 stretches + forgiving matchTilt predicates
  storage/progress.ts       AsyncStorage load/save, streak logic, mood
  feedback.ts               speech + haptics (settings-guarded, error-swallowing)
  hooks/useTiltHold.ts      accelerometer tilt detection (graceful fallback)
  components/               BigButton, HoldBar, Plant (original Animated art)
  screens/                  HomeScreen, PreSessionScreen, SessionScreen
```
