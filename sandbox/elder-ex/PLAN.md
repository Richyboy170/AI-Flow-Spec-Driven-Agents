# Elder-Ex — Expo Go MVP Implementation Plan

**Date:** 2026-06-25
**Status:** Ready for engineering
**UX Benchmark:** Not available — no benchmark file found at `sandbox/elder-ex/research/ux-structure-benchmark-2026-06-25.md`. Plan proceeds using established elder-UX / accessibility conventions (WHO age-friendly design, WCAG 2.1 AA, platform accessibility guidelines for 65-85 population). No IA-#/JNY-#/PAT-#/DEC-# IDs are fabricated.

---

## 1. Final Feature Cut

Six locked features — no additions, no removals:

| # | Feature |
|---|---------|
| F1 | Guided low-impact routines (chair, gentle stretching, balance, strength) — ordered steps with name, plain-language instruction, duration seconds, optional safety note; in-session view with BIG timer (auto-advance or manual Next), Pause/Resume, always-visible "Stop if you feel pain" affordance |
| F2 | "How I feel today" check-in (Easy / Normal / Strong) that scales routine difficulty: Easy = durations reduced by 40% and reps reduced to 60% of baseline; Normal = baseline; Strong = durations +20% and full rep count — stored per session, influences routine presented at session start |
| F3 | Daily streak + gentle, never-shaming motivation messages on home screen and post-session |
| F4 | Progress view: sessions done, total minutes moved, current streak, best streak — large friendly visuals |
| F5 | Safety-first cues: warm-up reminder before session begins, "Stop if you feel pain" text visible at all times during a session |
| F6 | Reminders — **OPTIONAL** (see Story ST-8); engineer must verify `expo-notifications` feasibility in Expo Go for the scaffolded SDK before building; fallback is in-app at-launch nudge only |

**Non-goals (MVP):** social features, video playback, backend/server sync, user accounts, adaptive AI, paid content, custom routine builder.

---

## 2. Screen Map and Navigation

### Navigation Structure

Flat bottom tab bar — 3 tabs. No nested navigators deeper than 1 modal/stack level. No hidden gestures.

```
App
├── Tab: Home         (HomeScreen)
├── Tab: Progress     (ProgressScreen)
└── Tab: Library      (RoutineLibraryScreen)
    └── (stack push) RoutineDetailScreen
        └── (modal/stack) SessionScreen
            └── (replace/push) SessionCompleteScreen
```

### Screens

#### HomeScreen
- Purpose: Entry point after check-in; shows daily streak, today's motivation message, and a "Start Today's Routine" CTA.
- Content: Current streak badge, motivation copy, check-in widget (if not yet done today), Start button → navigates to RoutineDetailScreen for today's recommended routine.
- F-refs: F2, F3

#### CheckInScreen (modal, launched from HomeScreen if check-in not done)
- Three large tappable cards: Easy / Normal / Strong, each with a single emoji + plain label.
- On selection: stores check-in value, dismisses, updates difficulty multiplier for today.
- F-refs: F2

#### RoutineLibraryScreen
- Four category tiles (chair, gentle stretching, balance, strength), large tap targets.
- Tapping a category shows a list of routines in that category.
- F-refs: F1

#### RoutineDetailScreen
- Shows routine name, estimated duration (after difficulty scaling), step count, any safety note for the routine.
- "Begin Routine" button → launches SessionScreen.
- Displays warm-up reminder text here before session begins.
- F-refs: F1, F5

#### SessionScreen (primary in-session experience)
- Displays: current step name (large), plain-language instruction, step number / total steps.
- BIG countdown timer (min 80sp text size).
- "Stop if you feel pain" text always visible at bottom of screen.
- Controls: Pause/Resume (large button, min 60dp), Next Step (large button), Stop Session (accessible, clearly labelled).
- Auto-advance on timer expiry or manual Next.
- F-refs: F1, F5

#### SessionCompleteScreen
- Shows: routine completed, duration achieved, gentle congratulation message, streak update.
- CTA: "Back to Home".
- F-refs: F3, F4

#### ProgressScreen
- Large stat cards: sessions completed, total minutes moved, current streak, best streak.
- Simple visual (e.g. monthly calendar dots or a bar chart via react-native-svg).
- F-refs: F4

---

## 3. Data Model (AsyncStorage — local only)

All state stored in AsyncStorage under the keys defined below. Routine content is statically seeded in-app (no network calls).

### 3.1 Routine Seed Shape (static, bundled)

```ts
type RoutineStep = {
  id: string;              // e.g. "step-chair-01-01"
  name: string;            // short display name, e.g. "Seated March"
  instruction: string;     // plain-language, ≤ 2 short sentences
  durationSeconds: number; // baseline duration; scaled at runtime by difficulty
  reps?: number;           // baseline rep count if rep-based; scaled at runtime
  safetyNote?: string;     // shown if present; e.g. "Hold armrests if needed"
};

type Routine = {
  id: string;              // e.g. "chair-01"
  category: "chair" | "stretching" | "balance" | "strength";
  name: string;
  description: string;     // 1-2 sentences, plain language
  steps: RoutineStep[];
  warmUpNote?: string;     // shown on RoutineDetailScreen before session
};

// Static export from routines.ts — at least 2 routines per category for MVP
const ROUTINES: Routine[] = [...];
```

### 3.2 Difficulty Scaling Rules (runtime, not stored)

```ts
type CheckInLevel = "easy" | "normal" | "strong";

function scaleDuration(baseSec: number, level: CheckInLevel): number {
  if (level === "easy")   return Math.round(baseSec * 0.6);
  if (level === "strong") return Math.round(baseSec * 1.2);
  return baseSec;
}

function scaleReps(baseReps: number, level: CheckInLevel): number {
  if (level === "easy")   return Math.round(baseReps * 0.6);
  if (level === "strong") return baseReps;
  return baseReps;
}
```

### 3.3 Daily Check-In (AsyncStorage key: `@elder_ex:checkin`)

```ts
type CheckInRecord = {
  date: string;          // ISO date "YYYY-MM-DD"
  level: CheckInLevel;
};
```

Stored as JSON. On load, compare `date` to today; if stale, treat as no check-in yet.

### 3.4 Session Log (AsyncStorage key: `@elder_ex:sessions`)

```ts
type SessionLog = {
  id: string;            // uuid or timestamp string
  routineId: string;
  date: string;          // ISO date "YYYY-MM-DD"
  completedAt: string;   // ISO datetime
  durationMinutes: number;
  checkInLevel: CheckInLevel;
  completed: boolean;    // false if user stopped early
}[];
```

Stored as a JSON array; append-only. Cap at 365 entries; prune oldest if exceeded.

### 3.5 Streak State (AsyncStorage key: `@elder_ex:streak`)

```ts
type StreakState = {
  currentStreak: number;
  bestStreak: number;
  lastSessionDate: string;  // ISO date "YYYY-MM-DD"
};
```

Streak update logic: on completing a session, check if `lastSessionDate` is yesterday or today. If yesterday, increment `currentStreak`. If today (already logged), no change. Otherwise reset to 1. Update `bestStreak` when `currentStreak` exceeds it.

### 3.6 Reminder Preference (AsyncStorage key: `@elder_ex:reminder`) — OPTIONAL

```ts
type ReminderPreference = {
  enabled: boolean;
  hour: number;   // 0-23
  minute: number;
};
```

Only persisted if ST-8 (reminders) is built.

---

## 4. Accessibility Specification

These are concrete requirements baked into every story's acceptance criteria — not a review checklist.

| Rule | Concrete Number / Requirement |
|------|-------------------------------|
| **Tap target minimum** | 60dp (dp, not px) on all interactive elements — buttons, cards, tab bar items |
| **Primary font size** | Body text minimum 18sp; headings minimum 24sp; session timer minimum 80sp |
| **Font scaling** | `allowFontScaling={true}` on every `Text`; `maxFontSizeMultiplier={1.4}` to prevent extreme breakage while respecting user preferences |
| **Color contrast** | All foreground/background text pairs must meet WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text ≥ 18sp) |
| **accessibilityLabel** | Required on every `TouchableOpacity`, `Pressable`, `Button`, and icon-only element; must describe action, not just element type |
| **accessibilityRole** | Required on every interactive element; "button", "tab", "header" etc. as appropriate |
| **accessibilityHint** | Recommended on CTAs where the label alone does not describe the outcome |
| **No time pressure** | No feature auto-navigates away from a screen based solely on time; timer auto-advance in session only advances the step, never the screen without a visible affordance |
| **Navigation depth** | Maximum 2 levels deep from any tab; no swipe-to-go-back required as only path (visible Back button required) |
| **Language complexity** | All instructions maximum 7th-grade reading level; no fitness jargon without a plain-language descriptor |
| **Tone** | Encouraging only; no language implying failure, shame, or comparison |
| **Haptic feedback** | Use `expo-haptics` for step advance and session complete (light/medium impact); never as the sole signal of a state change |

---

## 5. Expo Go Library List

All libraries must be compatible with Expo Go (managed workflow, no custom native modules, no dev-client-only APIs).

| Library | Purpose | Expo Go compatible |
|---------|---------|-------------------|
| `expo` (SDK) | Base SDK, device APIs | Yes |
| `expo-router` | File-based navigation + tab bar | Yes |
| `react-navigation/native` | Navigation container (peer dep of expo-router) | Yes |
| `@react-native-async-storage/async-storage` | All local state persistence | Yes |
| `expo-haptics` | Haptic feedback on step advance / completion | Yes |
| `react-native-svg` | Progress visualizations in ProgressScreen | Yes |
| `expo-notifications` | Scheduled daily reminders — **OPTIONAL, ST-8 only; engineer to verify Expo Go feasibility before building** | Conditional — verify |
| `expo-font` (if custom font needed) | Large, legible typeface | Yes |
| `expo-status-bar` | Status bar styling | Yes |

Do NOT add: `react-native-video`, custom native modules, Lottie (use react-native-svg or simple animated View instead), Firebase, or any package requiring `expo prebuild`.

---

## 6. Ordered Build Stories

Each story maps to a locked feature (F1-F6) and includes acceptance criteria with a11y numbers embedded.

---

### ST-1 — Project Scaffold and Navigation Shell

**Feature refs:** Foundation (all features)
**Goal:** Expo Go project boots with flat 3-tab navigation, screens stubbed, AsyncStorage initialized.

**Acceptance Criteria:**
- `npx expo start` boots without error in Expo Go on both iOS and Android.
- Three tabs render: Home, Progress, Library — each showing a placeholder screen.
- Tab bar items have `accessibilityLabel` and `accessibilityRole="tab"`.
- Tab bar icons and labels are legible at minimum system font sizes.
- Tab bar tap targets are at minimum 60dp height.
- AsyncStorage package is installed and importable.
- No custom native modules referenced anywhere.

---

### ST-2 — Static Routine Content (Seed Data)

**Feature refs:** F1
**Goal:** Bundled routine data module with at least 2 routines per category (8 total), all steps conforming to the data model.

**Acceptance Criteria:**
- `routines.ts` exports a typed `ROUTINES` array; TypeScript compiles with no errors.
- At least 8 routines across 4 categories: chair (2), stretching (2), balance (2), strength (2).
- Every routine has at least 3 steps; every step has `id`, `name`, `instruction`, `durationSeconds`.
- Every `instruction` is ≤ 2 short sentences written at ≤ 7th-grade reading level.
- At least 50% of steps include a `safetyNote`.
- At least 1 routine per category includes a `warmUpNote` at the routine level.
- No network calls; data is purely static import.

---

### ST-3 — "How I Feel Today" Check-In (F2)

**Feature refs:** F2
**Goal:** Daily check-in modal/screen with 3 options that stores choice and exposes scaling multiplier to the app.

**Acceptance Criteria:**
- CheckInScreen presents three cards: Easy, Normal, Strong.
- Each card tap target is at minimum 60dp tall and full-width.
- Each card has `accessibilityLabel` describing the level and its meaning (e.g., "Easy — I am feeling tired or sore today").
- Selected level is persisted to `@elder_ex:checkin` with today's ISO date.
- On app re-launch the same calendar day, check-in is treated as already complete; the stored level is used.
- On a new calendar day, check-in is cleared and the user is prompted again before starting a session.
- A `useCheckIn()` hook (or equivalent) returns `{ level, setLevel, hasCheckedInToday }`.
- `scaleDuration` and `scaleReps` functions are unit-tested: Easy=0.6x, Normal=1.0x, Strong=1.2x durations; Easy=0.6x, Normal=1.0x, Strong=1.0x reps.

---

### ST-4 — Routine Library and Detail (F1, F5)

**Feature refs:** F1, F5
**Goal:** Library screen with category tiles; Detail screen showing scaled routine info and warm-up note before session.

**Acceptance Criteria:**
- RoutineLibraryScreen shows 4 category tiles; each tile is at minimum 60dp tall with `accessibilityLabel` and `accessibilityRole="button"`.
- Tapping a category shows the list of routines in that category (can be same screen or inline list).
- RoutineDetailScreen displays: routine name (≥24sp), description, estimated total duration scaled by today's check-in level, step count, and warm-up note if present.
- Warm-up reminder text ("Take a moment to warm up before starting") is visible on RoutineDetailScreen before the user taps Begin.
- "Begin Routine" button is at minimum 60dp tall, has `accessibilityLabel="Begin routine: [routine name]"`.
- Back navigation from RoutineDetailScreen uses a visible Back button (not swipe-only).

---

### ST-5 — In-Session Step Experience (F1, F5)

**Feature refs:** F1, F5
**Goal:** Full step-by-step session view with big timer, auto-advance, Pause/Resume, manual Next, and always-visible pain stop affordance.

**Acceptance Criteria:**
- SessionScreen shows: current step name (≥24sp), instruction text (≥18sp), step counter ("Step 2 of 6"), and countdown timer (≥80sp).
- Timer counts down from scaled `durationSeconds`; when it reaches 0 it auto-advances to next step without any extra tap.
- "Next Step" button is at minimum 60dp tall; `accessibilityLabel="Next step"`.
- "Pause / Resume" button is at minimum 60dp tall; `accessibilityLabel` updates to "Pause" or "Resume" based on current state.
- "Stop Session" button is visible and labelled clearly; tapping it confirms and exits to SessionCompleteScreen with `completed: false`.
- "Stop if you feel pain — it is okay to stop at any time" text is visible in a fixed position on-screen during the entire session; font size ≥ 16sp; high-contrast color.
- Safety note for the current step (if any) is displayed under the instruction.
- On final step completion, auto-advances to SessionCompleteScreen with `completed: true`.
- `expo-haptics` fires a light impact on each step advance and a medium impact on session complete.
- Timer survives app backgrounding for short periods (best effort; no native background timer required for MVP — state pause is acceptable).
- All interactive elements have `accessibilityLabel` and `accessibilityRole="button"`.

---

### ST-6 — Session Persistence and Streak Logic (F3, F4)

**Feature refs:** F3, F4
**Goal:** On session complete, persist session log entry and update streak state.

**Acceptance Criteria:**
- `@elder_ex:sessions` receives a new `SessionLog` entry on every session end (completed or stopped early).
- `durationMinutes` is calculated from actual elapsed time, not estimated.
- Streak update logic: if `lastSessionDate` is yesterday, increment `currentStreak`; if today, no change; otherwise reset to 1. `bestStreak` updated if exceeded.
- `@elder_ex:streak` is written atomically before navigating to SessionCompleteScreen.
- If AsyncStorage write fails, error is caught and logged; the session is not silently lost (at minimum, error is console-logged and a non-blocking in-app message is shown).
- Unit tests cover the four streak cases: first session ever, consecutive day, same day second session, gap of 2+ days.

---

### ST-7 — Home Screen and Progress Screen (F3, F4)

**Feature refs:** F3, F4
**Goal:** HomeScreen with streak and motivation; ProgressScreen with large stat cards.

**Acceptance Criteria:**
- HomeScreen displays current streak (≥24sp), a daily motivation message (friendly, non-shaming, changes daily or randomly), and a "Start Today's Routine" button (≥60dp, `accessibilityLabel`).
- If check-in not yet done today, HomeScreen prompts "How are you feeling today?" before starting — either inline or navigates to CheckInScreen.
- Motivation messages are drawn from a static pool of ≥ 10 unique strings; none contain language implying failure or comparison.
- ProgressScreen shows 4 stat cards: sessions completed, total minutes moved, current streak, best streak.
- Stat card values use ≥ 32sp font; labels use ≥ 16sp.
- ProgressScreen includes at least one simple visualization (e.g., dots per day for last 30 days using react-native-svg, or a simple bar chart).
- All stat card containers have `accessibilityLabel` (e.g., "Current streak: 5 days").
- Stats are computed from `@elder_ex:sessions` and `@elder_ex:streak` on every screen focus.

---

### ST-8 — Daily Reminder Notification — OPTIONAL

**Feature refs:** F6
**Feasibility gate (engineer action before building):** Verify that `expo-notifications` schedules and delivers daily repeating local notifications in Expo Go for the exact Expo SDK version used in this project. Do not build this story until feasibility is confirmed. If not feasible, skip ST-8 entirely.

**If feasible, Acceptance Criteria:**
- User can set a daily reminder time via a simple time picker in settings (or a simple hour selection).
- Preference is persisted to `@elder_ex:reminder`.
- A daily repeating local notification is scheduled using `expo-notifications` with a friendly message ("Time for your Elder-Ex routine. You can do it!").
- On first launch, request notification permission with a clear explanation; gracefully handle denial (app functions fully without it).
- Reminder preference screen has `accessibilityLabel` on all controls.

**If not feasible — mandatory fallback:**
- On app launch, if `@elder_ex:streak.lastSessionDate` is not today, show a non-blocking banner on HomeScreen: "Ready for today's routine? Tap here to start." Banner dismisses on tap or after 10 seconds.
- This fallback is always built, regardless of whether ST-8 is built.

---

## 7. Open Decisions

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| OD-1 | Navigation library: `expo-router` vs `react-navigation` | expo-router = file-based, newer; react-navigation = more explicit, well-documented | Use `expo-router` if engineer is comfortable; otherwise `react-navigation` with manual stack is fine. Both Expo Go compatible. |
| OD-2 | Progress visualization: calendar dots vs bar chart | Both possible with react-native-svg | Calendar dots are simpler and more familiar to the target population. |
| OD-3 | Routine count for MVP | 2 per category (8 total) vs more | 8 is the minimum. Add more if content is ready before engineering is done; data model supports it with no code change. |
| OD-4 | ST-8 feasibility | Must be verified by engineer | Verify in Expo Go with exact SDK version before committing ST-8 to a sprint. |
| OD-5 | Difficulty scaling exact math | 0.6x / 1.0x / 1.2x as specified | Locked in this plan. If playtesting shows this feels wrong, update `scaleDuration`/`scaleReps` only — no structural change needed. |

---

## 8. Story Summary and Coverage

| Story ID | Feature(s) | Description |
|----------|-----------|-------------|
| ST-1 | Foundation | Project scaffold, navigation shell |
| ST-2 | F1 | Static routine seed data |
| ST-3 | F2 | Daily check-in and difficulty scaling |
| ST-4 | F1, F5 | Routine library and detail screen |
| ST-5 | F1, F5 | In-session step experience |
| ST-6 | F3, F4 | Session persistence and streak logic |
| ST-7 | F3, F4 | Home screen and progress screen |
| ST-8 | F6 | Daily reminders (OPTIONAL — verify feasibility first) |

All 6 locked features (F1-F6) have at least one story. F6 is covered by ST-8 with mandatory in-app fallback built into ST-7.

---

## Delegation Receipt

This plan was produced as a deliberate **lean, single-domain planning pass** by the `cs-epic-story-planner` agent. The `bmad-create-epics-and-stories` multi-step skill workflow was intentionally bypassed per the user's explicit instruction ("Do NOT run the full heavy PRD machine"). No PRD was created; the locked feature cut was used directly as the traceability spine (F1-F6 → story IDs ST-1 to ST-8).

Skills consulted: `advisor` (structural review prior to writing). No UX benchmark agent was invoked (benchmark file absent). No architecture agent was invoked (Expo Go constraint is self-contained). No evaluation architect invoked (no existing verification matrix).

Next handoff: engineer can build from this PLAN.md directly. Suggested wave order: ST-1 → ST-2 → ST-3 → ST-6 (logic) → ST-5 → ST-4 → ST-7 → ST-8 (if feasible).
