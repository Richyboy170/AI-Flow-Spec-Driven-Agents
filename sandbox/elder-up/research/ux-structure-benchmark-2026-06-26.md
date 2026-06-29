# UX/UI Structure Benchmark — Elder-Up (Expo Go senior exercise & stretch app)

Date: 2026-06-26
Scope: Category-level benchmark of senior-friendly mobile UX and exercise-session flows for a UI-bearing Expo Go app that motivates adults ~65+ to do daily low-impact movement with a real engagement loop (NOT a static list of stretches). No concept is finalized at benchmark time; this documents reusable IA, journey, pattern, and visualization evidence that planning can trace into a PRD/UX spec.

Tech reality this benchmark must stay consistent with (from dispatched cs-tech-researcher, Expo SDK 56): movement feedback comes from `expo-sensors` accelerometer/gyroscope + `expo-haptics` + `expo-speech` audio cues and `react-native-reanimated` animation — NOT camera/ML pose tracking. Two hard constraints shape every pattern below: (a) background audio is not available in Expo Go, so a session must keep the screen awake and foreground; (b) iOS silent-mode mutes `expo-speech`, so audio coaching must never be the ONLY feedback channel — pair it with on-screen text + haptics.

---

## 1. Benchmarked references

| Ref | What it is | Why relevant | Source quality |
|-----|-----------|--------------|----------------|
| Bold (agebold.com) | Medicare-covered fitness for older adults, ~12M members (per dispatched market research) | Senior-first session UX, gentle tone, balance/strength programming | Strong (corroborated in market digest) |
| SilverSneakers GO | App companion to the 18M+-eligible Medicare benefit | Class/session discovery, large-control patterns for 65+ | Strong (corroborated in market digest) |
| Nymbl | Clinical balance-training app for seniors | Balance-session UX, fall-prevention framing, short daily sessions | Strong (corroborated in market digest) |
| Mighty Health | 50+ coaching, nutrition + movement | Onboarding for low-tech-comfort users, coach-led tone | Strong (corroborated in market digest) |
| Calm / Headspace (guided players) | Mainstream meditation/breathing players | Audio-first single-focus session player; breathing-orb guided-motion UI; minimal-chrome "do this now" screen | Medium (well-known patterns; not re-verified live this pass) |
| Mainstream guided-workout players (timer/rep/rest) | Generic fitness session player conventions | Countdown, work/rest blocks, "next up" preview, pause/exit affordances | Medium (general category knowledge) |
| Streak/habit apps (e.g. Duolingo-style streak + reward) | Gamified daily-return loops | Streak visualization, forgiving streak-freeze, celebratory reward moment | Medium (general category knowledge) |
| Large-button / elder phone launchers | Accessibility-first Android/iOS launchers for seniors | Flat IA, oversized targets, high-contrast, minimal choices per screen | Medium (general accessibility knowledge) |

### Source Quality Audit
- STRONG, decision-critical: the competitor set (Bold, SilverSneakers, Nymbl, Mighty Health) and their senior-first positioning are corroborated by the dispatched cs-market-researcher digest, which cited primary/commercial sources. These anchor the "what good senior UX looks like" claims.
- MEDIUM, supporting: the session-player, streak, and elder-launcher pattern descriptions draw on well-established, widely-documented UX conventions and the lead's domain knowledge rather than a fresh per-app live teardown in this pass (the autonomous UX-research dispatch failed twice on an output-token limit; see delegation receipt). They are reliable as category patterns but a future pass should screenshot-verify Bold/Nymbl session screens before locking pixel-level UX.
- ACCESSIBILITY claims (contrast ratios, tap-target minimums, font scaling) follow WCAG 2.2 and platform HIG/Material accessibility guidance — strong, standards-based.
- ACTION: before UX sign-off, do one live screenshot pass of Bold and Nymbl session players to confirm PAT-2/PAT-3/JNY-3 specifics. Until then treat those pattern cards as "evidence-informed, verify-on-design."

---

## 2. Information Architecture & navigation (IA-#)

Senior UX principle: minimize choices per screen, keep depth shallow, make "the one thing to do today" unmissable, and make exit/back always obvious.

| ID | IA decision | Recommendation | Evidence basis |
|----|-------------|----------------|----------------|
| IA-1 | Navigation model | FLAT hub-and-spoke. A single Home/Today screen is the app's center of gravity; everything is ≤1 level deep from it. No nested tab-within-tab. | Elder-launcher + Nymbl short-session model; reduces cognitive load |
| IA-2 | Max primary destinations | 3 max: **Today** (the session), **Progress** (streak/history), **Help/Settings** (font size, voice, caregiver). Prefer a single bottom bar with 3 large items, or even a no-tab single-screen-first design. | Senior UX: ≤3-5 nav items, oversized |
| IA-3 | Home/Today screen | One dominant primary action ("Start today's movement") occupying the visual center, with the streak/reward state shown but secondary. Everything else demoted. | Streak apps + guided-player "one CTA" convention |
| IA-4 | Session is a focused sub-flow | The exercise session is a full-screen, chrome-light flow that the user cannot get lost in: one movement on screen at a time, persistent Exit/Stop, no navigation bar competing for attention. | Calm/Headspace single-focus player |
| IA-5 | Back/Exit clarity | Every screen has a single, large, labeled back/exit ("✕ Stop" / "← Back") top-left or bottom; never rely on gesture-only back. Exiting a session is always confirmed gently, never punished. | Forgiving senior UX |
| IA-6 | Onboarding placement | First-run is a separate linear flow (not buried in settings): set text size + voice on/off, optional caregiver/family help, sensor permission with plain-language reason, one practice movement. Skippable but resumable. | Mighty Health coach-led onboarding |
| IA-7 | Settings depth | Accessibility controls (font scale, high-contrast, voice toggle, reduce-motion, haptics on/off) live one tap from Home and are themselves large-target. | WCAG + platform accessibility |

---

## 3. Daily-session user journey (JNY-#)

The motivating loop: discover → start → warm-up → guided movement with feedback → rest → finish → reward/streak → return tomorrow.

| ID | Journey stage | Pattern / requirement | Notes for 65+ |
|----|---------------|----------------------|---------------|
| JNY-1 | Daily entry / discover | App opens straight to Today with the single primary action pre-selected; the "why open it" hook (streak state, a living reward that changed overnight) is visible immediately. | No hunting. The reason to act is on screen in <2s. |
| JNY-2 | Start & readiness | A calm pre-session screen: how long it takes, a "sit or stand — your choice" option, "stop anytime if it hurts" safety line, and a clear Start. Permission (sensor) requested here with plain reason if not yet granted. | Safety framing up front; seated default always offered |
| JNY-3 | Warm-up | One gentle opening movement (e.g. slow breaths / shoulder roll) to calibrate sensors and ease in; sets the audio + haptic feedback expectation. | Doubles as sensor calibration baseline |
| JNY-4 | Guided movement WITH live feedback | One movement at a time, full screen. Three feedback channels in parallel (never audio-only): (1) on-screen visual cue + progress, (2) `expo-speech` coaching, (3) `expo-haptics` confirm/encourage. Movement is detected via accelerometer/gyro (tilt-hold, stillness/balance, gross limb/phone movement) — generous thresholds, forgiving. | Multi-channel because iOS silent mode can mute voice |
| JNY-5 | Rest / transition | Explicit, unhurried rest beat between movements with a "next up" preview and an always-present "I need a break / I'm done" option. Never auto-rush to the next move. | Older users need longer transitions |
| JNY-6 | Finish | A clear, warm completion screen — never a dead end. Summarizes what was done in plain encouraging language ("You moved for 4 minutes and held 3 stretches"). | Closure + dignity, no metrics overload |
| JNY-7 | Reward / streak | A single celebratory, sensory reward moment (haptic + animation + a visible persistent change to a reward object/streak). One number max. | Reward must feel earned, not infantilizing |
| JNY-8 | Return tomorrow | The persistent reward state creates an unfinished/needs-you hook for tomorrow (a living thing that depends on the user, or an unfinished progression). Optional gentle local reminder. | The retention engine; proven elder motivator = care/relatedness |
| JNY-9 | Interrupt / resume | If a call/lock interrupts mid-session, the app resumes gracefully to the same movement (or offers a clean restart); progress is not silently lost. | Background-audio limit makes interruption common |

---

## 4. UX/UI pattern cards (PAT-#)

| ID | Pattern | Spec | Why for seniors |
|----|---------|------|-----------------|
| PAT-1 | Large-target primary control | Primary action button ≥ 64dp tall, full-width-ish, high-contrast, text label + icon, generous margins; one primary per screen. | Reduced fine motor control, low vision |
| PAT-2 | Audio-first coaching (multi-channel) | `expo-speech` reads cues; ALWAYS mirrored as large on-screen text + a haptic so the cue survives silent mode / hearing loss. Voice toggle + speed in settings. | Hearing variance + iOS silent-mode TTS mute |
| PAT-3 | Countdown / hold timer | Big circular or bar timer with a number; counts a hold (e.g. 8-10s). Calm pace, audible/haptic tick at start and finish only (not every second). | Clear "how long more"; low anxiety |
| PAT-4 | Motion-sensor feedback display | A simple, immediate visual that responds to detected movement/stillness (a fill, a growing element, a glow) so the user SEES the sensor working. Generous thresholds; reward partial effort. | Builds trust that "it sees me"; forgiving |
| PAT-5 | Encouragement / reward moment | One celebratory beat at session end: haptic burst + reanimated flourish + a persistent visible change. Single positive number, warm copy. | Dopamine without competition/shame |
| PAT-6 | "Stop if it hurts" safety affordance | A persistent, always-visible Stop control during any movement, plus a pre-session safety line and a seated alternative for every move. Stopping is praised, never penalized. | Medical safety + trust |
| PAT-7 | Forgiving error handling | Sensor noise, a missed hold, or an early exit never produce a failure/error tone. The app interprets ambiguous input charitably and offers a calm retry. | Avoids frustration → abandonment |
| PAT-8 | Low-tech + caregiver-assisted onboarding | Plain-language, one-decision-per-screen first run; an optional "set up with family" path; permission requests explained in everyday words ("so the app can feel you move"). | Onboarding is the #1 senior drop point |
| PAT-9 | Seated/standing choice | Every session offers a seated option up front and per-movement; the default never assumes standing balance. | Mobility/balance variance |
| PAT-10 | Sensor-permission priming | Before the OS permission dialog, a friendly screen explains why and reassures (no camera, no recording). Graceful degraded mode if denied (tap-along fallback). | Permission fear is common in 65+ |

---

## 5. Progress / data-visualization patterns (VIZ-#)

Keep visualization celebratory and glanceable, never a dense analytics dashboard.

| ID | Viz | Spec | Notes |
|----|-----|------|-------|
| VIZ-1 | Streak indicator | A single large, friendly streak count + a simple 7-dot week strip (done/not-done), high contrast. No graphs. | The one number that matters |
| VIZ-2 | Living reward object | A persistent visual that visibly grows/changes with cumulative sessions (the retention object). Its state IS the progress chart. | Replaces abstract charts with emotion |
| VIZ-3 | Weekly activity at a glance | Optional simple "this week" view: large icons/checkmarks per day, plain-language summary ("4 of 7 days — lovely"). | For the user and a caregiver |
| VIZ-4 | Streak-freeze / forgiveness | Missing a day softens but never zeroes/destroys progress; show a gentle "let's pick it back up" state, not a broken streak. | Shame-spiral protection drives return |
| VIZ-5 | Session recap | End-of-session plain-language recap (time moved, holds completed) — words and icons over numbers. | Dignity, comprehension |

---

## 6. State coverage

| State | Requirement |
|-------|-------------|
| Empty (first ever) | Warm welcome + single "start your first movement"; reward object in its seed/initial state; no blank dashboards. |
| Loading | Calm, branded, never a bare spinner; reassure ("getting ready…"); keep screen awake. |
| Error (sensor/audio fail) | Plain-language, non-alarming; offer tap-along fallback; never a red error code. |
| Success (movement detected / session done) | Clear positive confirmation via PAT-4/PAT-5; haptic + visual + (audible if unmuted). |
| Permission (sensor/mic) | Primed by PAT-10; explain plainly; graceful degraded mode if denied. |
| Destructive / safety-stop | PAT-6 Stop is always reachable, one tap, confirmed gently, praised. |
| Mid-session interrupt (call/lock) | JNY-9 graceful resume or clean restart; no silent data loss; re-acquire sensors on return. |
| Offline | Core session works fully offline (no network dependency for the MVP exercise flow). |

---

## 7. Accessibility & responsive implications

- Font scaling: respect OS dynamic type; in-app text-size control (Large default); layouts must reflow without clipping at 200% scale.
- Contrast: WCAG 2.2 AA minimum (4.5:1 text, 3:1 large text/UI); prefer AAA for body. Offer a high-contrast theme.
- Tap targets: minimum 44x44pt (iOS HIG) / 48dp (Material); aim ≥64dp for primary actions, with generous spacing to avoid mis-taps.
- Screen-reader: every control labeled; session cues announced via accessibility live regions, not only TTS; reward states described.
- Reduced motion: honor the OS reduce-motion setting; provide non-animated equivalents for PAT-4/VIZ-2.
- One-handed reach: primary actions in the lower/center two-thirds of the screen; avoid top-corner-only critical controls.
- Haptics toggle: allow disabling; never rely on haptics as the sole channel either (deaf-blind / no-vibration devices).

---

## 8. Use / Avoid (elder UX)

USE
- One primary action per screen; one number that matters.
- Multi-channel feedback (visual + audio + haptic) so no single sense is required.
- Seated-first, "stop if it hurts," forgiving thresholds, charitable interpretation of sensor input.
- A living/persistent reward that creates a gentle care-based reason to return.
- Plain, warm, peer-level language and big calm pacing.

AVOID
- Dense dashboards, multiple competing CTAs, deep nested navigation.
- Audio-only coaching (dies on silent mode / hearing loss).
- Competitive leaderboards, harsh streak-breaking, failure tones (market evidence: competition + shame reduce senior adherence).
- Infantilizing tone, tiny text, gesture-only navigation, time pressure.
- Any reliance on background audio or camera/ML pose tracking (not Expo-Go-safe / not in scope).

---

## 9. Planning Connector table

| Connector ID | Unblocks (downstream decision) |
|--------------|-------------------------------|
| IA-1 | Choose flat hub-and-spoke navigation in the UX spec / app shell. |
| IA-2 | Lock the ≤3 primary destinations for the nav contract. |
| IA-3 | Define the Today/Home screen layout and primary-CTA hierarchy. |
| IA-4 | Specify the session as an isolated focused full-screen flow. |
| IA-5 | Define global back/exit + session-stop affordances. |
| IA-6 | Scope the first-run onboarding flow as its own epic. |
| IA-7 | Place accessibility settings one tap from Home. |
| JNY-1..JNY-9 | Author the primary user journey UJ-# in the PRD (daily session, incl. interrupt/resume and return hook). |
| PAT-1 | Component spec: primary button sizing/contrast. |
| PAT-2 | FR + NFR: multi-channel coaching (TTS + on-screen text + haptic) with silent-mode resilience. |
| PAT-3 | Component spec: hold/countdown timer. |
| PAT-4 | FR: real-time motion-sensor feedback visualization with forgiving thresholds. |
| PAT-5 | FR: end-of-session reward moment. |
| PAT-6 | FR + safety NFR: always-available Stop + seated alternative. |
| PAT-7 | NFR: forgiving error handling / charitable sensor interpretation. |
| PAT-8 | Onboarding epic incl. caregiver-assisted path. |
| PAT-9 | FR: seated/standing choice per session and per movement. |
| PAT-10 | FR: sensor-permission priming + degraded tap-along fallback. |
| VIZ-1 | Progress screen: streak + week strip component. |
| VIZ-2 | The living-reward object as the primary progress representation. |
| VIZ-3 | Optional weekly/caregiver activity view. |
| VIZ-4 | NFR/UX: streak-forgiveness behavior. |
| VIZ-5 | Session-recap component. |
| DEC-1 | DECISION: phone placement model (held-in-hand vs propped) — must be resolved before session UX is final, because it determines which movements are reliably detectable (held-phone tilt/stillness = robust; propped + fine limb movement = unreliable per tech research). Recommend held-phone, movement-IS-the-phone-movement concepts. |
| DEC-2 | DECISION: degraded/no-sensor fallback (tap-along) as a first-class mode, not an afterthought. |
| DEC-3 | DECISION: silent-mode + background-audio handling — confirm screen stays awake and all cues are mirrored visually + haptically. |
| DEC-4 | DECISION: reward-object art investment level (drives MVP cost) — pick a concept whose reward object is achievable with simple self-made visuals. |

DEC-# IDs must be carried by planning until mapped to PRD UJ-#/FR-#/NFR-# or an explicit non-use decision.
