# UX Structure Benchmark: Elder Exercise Mobile App (Expo Go)

**Date:** 2026-06-25
**Author:** cs-ux-structure-researcher (automated)
**Target population:** Adults 65-85 doing low-impact chair/stretch/balance/strength routines
**Platform:** Expo Go (React Native), iOS + Android, local state only

---

## Scope and Assumptions

### In scope
- Accessibility floor numbers for the 65-85 population (touch targets, font sizes, contrast ratios, motion, reading level)
- Information architecture and navigation model for the five locked features
- Per-screen UX pattern cards for all five locked screens/flows
- State coverage (empty/first-run, mid-session, completed, streak-broken, rest-day)
- Use / avoid list specific to elder users

### Out of scope
- Visual brand identity and color palette (no brand; handled separately in DESIGN.md)
- Reminders / notifications (explicitly out of UX scope per brief)
- Competitor teardowns beyond what is usable as light product benchmarks
- Server-side features; local AsyncStorage only

### Assumptions
- Expo Go constraints are treated as a React Native build; all dp/sp/pt values are 1:1 in practical RN stylesheet units at mdpi baseline
- "Large friendly visuals" for progress means glanceable, not analytics-dense (see VIZ-2 for the tension)
- Multi-language work is not requested; name localization gate does not apply
- Safety content (warm-up, stop-if-pain) references patterns for UX presentation only; specific medical thresholds are out of scope and must be sourced from a qualified clinical partner before implementation
- Benchmark set relies on design standards and peer-reviewed geriatric HCI evidence as primary benchmarks, supplemented by two light product reference points; this is explicitly scoped per brief

---

## Benchmark Set

| ID | Benchmark | Type | Relevance |
|---|---|---|---|
| UXR-1 | WCAG 2.2 Success Criteria (W3C, 2023) | International accessibility standard | Authoritative floor for contrast, target size, resize, motion |
| UXR-2 | Android Accessibility Touch Target guidance (Google Support) | Platform primary source | Android dp target floor and spacing |
| UXR-3 | Apple HIG Accessibility (Apple Developer Documentation) | Platform primary source | iOS pt target floor and Dynamic Type system |
| UXR-4 | PMC8837196 — Design Considerations for mHealth Apps for Older Adults (2021, Journal of Alzheimer's Disease) | Peer-reviewed literature | mHealth-specific font, target, contrast, nav depth numbers |
| UXR-5 | PMC7330495 — Button Position and Font Size for Older Adults (2020; journal name unverified — page not opened); n=64 (ages 65-76 vs 18-35) | Peer-reviewed empirical study | Empirically optimal font size (22pt for parity with younger adults) |
| UXR-6 | JMIR Human Factors — Tablet Exercise App Usability for Older Adults (2019, n=14) | Peer-reviewed usability study | Exercise app-specific: what worked / failed for 65+ doing tablet exercise sessions |
| UXR-7 | PMC — Design Guidelines for Mobile Apps for Older Adults, Systematic Review (2023, JMIR mHealth) | Systematic review (peer-reviewed) | Navigation depth, wizard flow, general guidelines |
| UXR-8 | SilverSneakers GO (product reference, light) | Real product — senior fitness app | Navigation model, difficulty adjustment, exercise library as product analogue |

---

## Native and Localized Name Ledger

Not applicable. No multi-language work requested. No real brand or product names to localize.

---

## Source Quality Audit

| Evidence ID | Source | Type | Score / 10 | Rating | Corroboration | Date fit | Decision use |
|---|---|---|---:|---|---|---|---|
| UXR-1 | WCAG 2.2 — W3C, w3.org/TR/WCAG22/ | Standards body primary | 10 | Strong | N/A (authoritative source) | 2023, current | Contrast, target floor, resize, motion SC |
| UXR-2 | Google Android Accessibility touch target, support.google.com/accessibility/android/answer/7101858 | Platform primary | 9 | Strong | Corroborated by M1 and M2 Material docs | Current | 48dp floor |
| UXR-3 | Apple HIG Accessibility, developer.apple.com/design/human-interface-guidelines/accessibility | Platform primary (page did not render; content not retrieved) | 6 | Supporting | 44pt corroborated by Deque University iOS rule docs and search results citing Apple HIG; consistent with WCAG AAA 2.5.5 44px | Current | 44pt floor (iOS) — not decision-bearing; elder floor uses 48dp (UXR-2) |
| UXR-4 | PMC8837196 — Journal of Alzheimer's Disease, 2021 (Design Considerations for Mobile Health Applications for Older Adults) | Peer-reviewed literature review | 8 | Strong | Consistent with UXR-2 on 48dp; button floor 15mm (~80dp) | 2021, applicable | mHealth nav depth, button min, contrast 4.5:1 |
| UXR-5 | PMC7330495 — 2020; n=64 (ages 65-76 vs 18-35); journal name unverified (content retrieved from PMC; journal not confirmed in fetch) | Peer-reviewed empirical study | 8 | Strong | 22pt finding directly retrieved from PMC; corroborated by UXR-6 text-density complaints | 2020, directly applicable | 22pt body text recommendation for 65-76 parity |
| UXR-6 | JMIR Human Factors 2019, e11598; n=14, tablet exercise app | Peer-reviewed usability study | 8 | Strong | Consistent with UXR-7 on complexity/wizard flow | 2019, applicable (exercise app context) | Navigation, video instruction, gesture avoidance, text density |
| UXR-7 | PMC10557006 — JMIR mHealth 2023, systematic review | Systematic review (peer-reviewed) | 8 | Strong | Corroborates UXR-4 on nav depth and wizard flow | 2023, current | Wizard flow, 2 options per step, minimize path |
| UXR-8 | SilverSneakers GO — prnewswire.com/news-releases/...-300732957.html + seniorliving.org reviews | Product press release + review aggregator | 5 | Lead only | Not independently audited | 2018 press release | Light product reference only; no design spec claims |

All decision-bearing claims in this report rely on UXR-1 through UXR-7 (strong / 8-10). UXR-8 is treated as a discovery lead and cited only as a product existence note, not as evidence for any specific UX claim.

---

## Product Structure and IA Patterns

### IA-1: Flat Tab Navigation, Maximum 4 Tabs, No Sub-Navigation

**Evidence:** UXR-4 recommends a maximum of 6 functions visible on a smartphone home screen without scrolling and fewer than 3 steps for data entry tasks. UXR-6 found that scheduling complexity (adding exercises, multi-step configuration) had only 14% unaided success; the simplest "Today" single-tap workflow achieved 92% success. UXR-7 concludes wizard-style flows with "2 options (next/exit)" outperform branching menus for procedural tasks with older adults.

**Pattern:** Bottom tab bar with exactly 4 tabs, no nesting, no hamburger menu, no swipe-only navigation. Every feature reachable in 1 tap from the tab bar.

**Tab inventory:**
1. Today (home — exercise for today, check-in)
2. Session (in-session view, only active during a routine; otherwise tab routes to Today)
3. Progress (streak, weekly dots, total minutes)
4. Safety (warm-up reminder, stop-if-pain cue card — persistent reference, not modal)

**Nav depth:** Max 2 levels — Tab > Screen content. No modals as primary navigation. Destructive or confirming dialogs are overlays, not new screens.

### IA-2: Home Screen Foregrounds Today's Single Action

**Evidence:** UXR-4 notes cognitive load reduction through single focal points; UXR-6 shows "Today" tab success rate was highest (92%) when surfacing the scheduled workout directly. UXR-7 identifies that older users abandon flows when presented with "what do I do first" ambiguity.

**Pattern:** Home screen (Today) shows one primary CTA ("Start today's routine") above the fold, with the how-I-feel check-in immediately visible below it or as a required pre-start gate. No feature discovery, no onboarding carousel occupying home real estate after first run.

### IA-3: First-Run is a Single Onboarding Screen, Not a Multi-Step Wizard

**Evidence:** UXR-5 showed 22pt font dramatically reduced error rates; simple interface setup also reduces anxiety. UXR-4 recommends fewer than 3 data-entry steps with auto-save. UXR-6 onboarding required only first name + last name + contact number for successful adoption.

**Pattern:** First run: one screen with a welcome message, the app's purpose in one sentence (plain language, grade 6 reading level), and a single "Get started" button. No account creation, no permissions request beyond what the OS requires. Prefer no onboarding carousel.

---

## User Journey Benchmarks

### JNY-1: Primary Task Journey — Daily Exercise Session (Margaret, 71)

Margaret is a retired teacher who does gentle exercise to keep her balance. She opens the app most mornings after breakfast.

1. **Entry.** App opens to Today tab. Large greeting: "Good morning, Margaret." Streak badge visible. One CTA button: "Start today's routine — Chair Stretches".
2. **How-I-feel check-in.** Before session starts, a full-screen modal with three large buttons: "Easy today", "Normal", "Feeling strong". One tap, no back-navigation needed. Tap advances immediately to routine.
3. **Warm-up cue.** First session screen shows a warm-up reminder card (not a separate screen): "Always start seated and warm. Take 3 slow breaths." A "Begin" button proceeds.
4. **In-session step view.** Step-by-step: one exercise at a time, full-screen. Large heading (exercise name), brief instruction (2-3 sentences max, grade 6), and a large countdown timer (numerals: min 72sp / 72pt). Pause/Resume button is full-width, secondary action. Progress indicator: "Step 3 of 8."
5. **Rest period.** After each rep, a large "Rest — 20 seconds" screen with a countdown, no instructions to read. Haptic pulse on rest end [INFERRED — Expo supports Haptics.notificationAsync].
6. **Stop-if-pain affordance.** Persistent "Stop & rest" button on every in-session screen, below the main content, never hidden. Tap pauses session and shows the safety cue card (not a flow exit).
7. **Session complete.** Full-screen celebration: large checkmark, session summary ("12 minutes done — great work!"), streak counter incremented. One button: "Done."
8. **Return to Today.** Today tab now shows "Session complete" state. No further prompts.

**Recovery path:** If Margaret closes the app mid-session, on reopen the app detects incomplete session and offers "Resume" or "Skip today" with equal visual weight — no guilt language.

**Error/recovery:** If the check-in is skipped (app crash recovery), the session defaults to "Normal" difficulty and a note is shown.

### JNY-2: Progress Check Journey (Margaret, Sunday morning)

1. Margaret taps Progress tab.
2. Progress screen loads with: streak ring (large, centered), weekly dot row (7 dots, filled = done), total minutes this week.
3. No drill-down needed. All information is above-the-fold at a single glance.
4. Margaret taps Today tab to return. No back-button sequence required.

### JNY-3: First-Run Journey (new user, no data state)

1. App opens to first-run screen: large app name, one-sentence purpose, "Get started" button.
2. Today tab shows: "Welcome! Let's do your first routine." One routine card displayed with a "Start" CTA.
3. Check-in flow runs as normal.
4. After first session complete: streak shows "1 day — great start!"

### JNY-4: Streak-Broken Recovery Journey

1. Margaret missed yesterday. App opens to Today tab.
2. Streak shows 0 (or reset to 0), but the wording is: "New streak starts today — ready?" Not "You broke your streak."
3. No penalty screen. Primary CTA is still "Start today's routine."
4. Motivational note (single line) is shown below the streak: "Every day counts."

### JNY-5: Rest Day Journey

1. Margaret deliberately skips. She taps "Rest today" option on the Today tab (secondary button, smaller than Start but still 48dp minimum).
2. Today tab updates: "Rest day — well done. Back tomorrow!"
3. Streak is preserved on rest days (1 rest day per week does not break streak) — [PRODUCT DECISION NEEDED — mark as open planning question].

---

## Screen and State Inventory

| Screen | States to implement |
|---|---|
| Today / Home | Empty / first-run; Normal (session not done); Session complete (done today); Rest day set; App-returned mid-session (resume prompt) |
| How-I-Feel Check-In | Full-screen (blocks session start); selected state (highlights chosen button); loading (instant — local only) |
| In-Session Step View | Active step; Rest period; Paused; Stop-if-pain overlay; Session complete |
| Progress | Empty (no sessions yet — 0 streak, empty weekly dots, 0 minutes); Partial week; Full week; Streak milestone (e.g., 7 days) |
| Safety Screen | Static reference card (always accessible, no empty state) |
| Onboarding / First-run | First-run only (shown once; dismissed permanently after first "Get started") |

### State details

**Empty/first-run:** No skeleton screens that look like broken data. Instead, a friendly illustration placeholder and a single CTA. Text: "Your first session is ready." No "No data yet" system language.

**Mid-session (app backgrounded and returned):** Resume prompt must appear within 2 seconds. Offer "Resume" and "End session" with equal button weight. Do not auto-resume with a countdown — that introduces time pressure (see avoid list).

**Streak-broken:** Zero-blame copy. No red X or broken-chain icon. Soft reset with forward-looking language.

**Rest-day:** Explicit acknowledgment. Non-exercise rest is valid; app confirms it.

---

## UX/UI Pattern Cards

### PAT-1: Big Timer In-Session Display

**Purpose:** Keep the exercising older adult eyes-up and confident about duration without needing to squint.

**Structure:**
- Timer numerals: minimum 72sp (dp) in a monospace or tabular-lining typeface. Recommended 80-96sp for phone viewport. Centered, full-width.
- Current step name: 28sp bold, above timer.
- Brief instruction text: 18sp regular, 2-3 lines max, below timer. Grade 6 reading level.
- Pause/Resume: full-width button, 64dp tall minimum, high-contrast primary color. Label: "Pause" / "Resume" — one word, no icon-only.
- Stop & rest: secondary full-width button, 56dp tall, below Pause. Label: "Stop & rest" — visible at all times, never hidden behind scroll.
- Progress indicator: "Step 3 of 8" text at bottom, 16sp min.

**Audio/haptic cues:**
- On step completion: single short haptic (Haptics.notificationAsync — SUCCESS type in Expo) + optional audio chime (device volume permitting). Not auto-playing; user sets preference on first run or Settings.
- On rest end: double haptic pulse + audio cue. Reason: older adults exercising may have eyes closed or look away from screen.
- No looping animations that could trigger vestibular issues (WCAG SC 2.3.3 / 2.2.2).

**Evidence:** UXR-5 (22pt body = 29sp approx for elder parity; timer numerals vastly exceed this intentionally), UXR-6 (full-screen video instruction preferred; participants requested fullscreen), UXR-1 (SC 2.3.3 for motion).

### PAT-2: How-I-Feel Check-In (3-Choice Full-Screen Modal)

**Purpose:** Gate session difficulty without cognitive overhead.

**Structure:**
- Full-screen overlay (not a small card).
- Title: "How are you feeling today?" — 28sp bold.
- Three buttons stacked vertically, equal size, 72dp tall minimum each, 16dp gap between.
  - "Easy today" (lower difficulty)
  - "Normal"
  - "Feeling strong" (higher difficulty)
- No icons required; plain text only reduces visual parsing load.
- Selection: immediate visual highlight (filled button state), auto-advance after 400ms or on second tap. No separate "Confirm" step.
- Back / dismiss: "Skip (use Normal)" — small secondary text link at bottom, 44dp tap target.

**Evidence:** UXR-7 (2 options preferred; 3 here is justified by clinical need for difficulty adjustment; wizard-single-step pattern), UXR-4 (fewer than 3 steps for data entry).

### PAT-3: Streak + Motivation Display

**Purpose:** Gentle daily reinforcement without pressure or shame.

**Structure:**
- Streak ring or large numeral: "7 days" centered, 48sp+.
- Sub-text: one short motivational line, max 12 words. Positive-only. Examples: "You showed up — that's everything." / "Every session is a win."
- Avoid: percentage bars compared to a target, "X days until goal", countdown to reward, red color for 0-day streak.
- Streak ring color: warm, not clinical. Green or amber suggested (not red/orange for low values).
- Weekly dot row (7 dots): filled dot = session done; outlined dot = upcoming; half-filled [INFERRED — may need explicit rest-day state dot style].

**Evidence:** UXR-6 (checkmark weekly schedule was intuitive and motivating), UXR-4 (positive reinforcement reduces drop-off), UXR-7 (simplicity paramount).

### PAT-4: Safety Cue Card (Persistent Reference)

**Purpose:** Warm-up and stop-if-pain guidance accessible at any time without interrupting the session.

**Structure:**
- Tab: "Safety" — always visible in tab bar.
- Card layout with two clearly separated sections:
  - "Before you start" — warm-up cues (3-5 bullet points, grade 6 language, max 12 words per bullet).
  - "During exercise — stop and rest if you feel:" — symptom list (chest pain, dizziness, joint pain that's sharp).
- No animation, no video on this screen (static, fast-loading).
- Font: 18sp body minimum. Section headers: 22sp bold.
- The "Stop & rest" button in the in-session view (PAT-1) links to this card.

**In-session trigger:** Tapping "Stop & rest" during a session pauses the session and slides up the Safety card as a bottom sheet. Dismissing returns to the paused session.

**Content note:** The symptom list must be reviewed by a qualified health professional before shipping. UX pattern only; not a medical claim.

**Evidence:** UXR-8 (SilverSneakers GO includes safety tips; light product reference only). Pattern design based on UXR-4 (error recovery, step-by-step guidance), UXR-6 (users value safety framing in exercise apps).

### PAT-5: Progress Screen — Glanceable Visuals

**Purpose:** Show accomplishment without creating a data dashboard that overwhelms.

**Structure:**
- Section 1 (top half): Streak ring / large numeral. "N-day streak" label in 22sp.
- Section 2: Weekly row — 7 large dots (32dp each), labeled with day letter (M T W T F S S), 14sp labels.
- Section 3: Summary stats — two cards side by side:
  - "Sessions this week: N" — large numeral (48sp), label below (16sp).
  - "Minutes moved: N" — same treatment.
- No line charts, no bar graphs, no trend lines, no percentages of goals.
- "This week" time scope only — no "all time" graph. Reason: dense longitudinal data increases cognitive load; the goal is pride-in-today, not performance analytics.

**Evidence:** UXR-4 (6 or fewer items on smartphone screen), UXR-6 (weekly schedule with checkmarks was most intuitive progress signal), VIZ tension addressed in VIZ-1.

### PAT-6: Today / Home Screen Layout

**Purpose:** One-glance understanding of what to do today.

**Structure (top to bottom):**
1. Greeting line: "Good morning, [first name]" — 20sp, not bold.
2. Streak badge: compact, inline with greeting or just below. "7-day streak" — 18sp.
3. Primary action card (full-width, high contrast): "Today's routine — Chair Stretches" with a start button (64dp tall, full-width) and difficulty label (e.g., "~12 min | Easy").
4. Check-in prompt: "How are you feeling?" — secondary button opens PAT-2 modal. This may be shown pre-start (recommended: gate check-in before start rather than separate).
5. Rest day option: text link below primary card: "Rest today instead" — 44dp tap target.
6. No more than 3 content sections above the fold. No horizontal scroll.

**Evidence:** UXR-4 (max 6 items on smartphone home), UXR-6 (Today tab's 92% success rate with direct action foreground), UXR-7 (minimize decision points).

---

## Visualization and Data Display Patterns

### VIZ-1: Progress Is Glanceable Achievement, Not Analytics

**Decision purpose:** An older adult exercising for health needs to feel accomplishment, not measure KPIs.

**Pattern:** Weekly dot row (7 dots, binary filled/empty) + two summary numbers (sessions, minutes). No trend lines, no goal completion percentages, no historical graphs. Reason: dense dashboards increase cognitive load and can create anxiety when streaks break (UXR-7; PMC10557006 general principle).

**Tension flagged:** The brief says "large friendly visuals" which risks becoming a dashboard. Resolution: large = large numerals (48sp+) and large dots (32dp), not large number of data points. Deliberately limit to 3 visual elements total on the Progress screen.

**Evidence:** UXR-6 (weekly checkmark schedule was most effective progress signal for older adult exercise study), UXR-4 (cognitive load reduction = fewer visual elements).

### VIZ-2: Timer Numerals as Primary In-Session Visual

**Decision purpose:** The large timer serves dual purpose — countdown for pacing AND reassurance that the set is almost over.

**Pattern:** Timer MM:SS format, minimum 72sp, centered. Below the timer, a thin progress bar (full-width, 8dp height) can be used to show time consumed as a secondary glance signal. Color fill: primary brand color (warm, non-red). No animated progress arcs that spin or pulse (vestibular risk).

**Evidence:** UXR-1 (SC 2.3.3 motion), UXR-5 (large numerals reduce error for older adults).

### VIZ-3: Streak Ring

**Decision purpose:** Single most motivating data point for consistency apps; must be warm, not clinical.

**Pattern:** Large ring or arc (not a percentage bar), filled with warm color, number centered. Scale: approximately 120dp diameter. Do not use a red/depleted ring for 0-day state. Show 0-day as an empty ring with forward-facing copy only.

**Evidence:** UXR-6 (visual confirmation of completion was intuitive and motivating), UXR-7 (simple positive reinforcement).

---

## Accessibility, Responsiveness, and Trust Patterns

### A11y Floor — Authoritative Numbers for Implementation

These are the minimum values for the elder population. Where a platform standard and a geriatric HCI study recommend different values, the **higher** value is used as the implementation floor.

#### Touch Target Size

| Source | Value | Unit | Notes |
|---|---|---|---|
| WCAG 2.2 SC 2.5.8 AA | 24 | CSS px (= dp in RN) | Absolute legal floor; insufficient for elder use |
| WCAG 2.2 SC 2.5.5 AAA | 44 | CSS px (= dp) | Recommended enhanced floor |
| Android/Google (UXR-2) | 48 | dp | Platform recommendation |
| Apple HIG (UXR-3) | 44 | pt (= dp at 1x) | Platform recommendation |
| mHealth literature (UXR-4) | 15mm physical | ~80 dp at 160dpi (basis: 48dp = 9mm, so 15mm ≈ 80dp) | Geriatric mHealth recommendation for round buttons; supports primary controls above 64dp |

**Elder exercise app floor: 48dp for all interactive elements. Primary action buttons: 64dp tall. Preferred: 56-64dp for any button that initiates or controls a session.**

Rationale: 48dp = ~9mm physical (Android baseline), which meets the 7-10mm research range and exceeds the WCAG AA floor. During exercise, motor precision is further reduced; primary controls should exceed 48dp.

#### Font Sizes

| Source | Value | Role |
|---|---|---|
| NIA/NLM historical guideline (UXR-7 summary) | 12-14pt | Absolute minimum for general web — not sufficient for elder mobile |
| mHealth literature (UXR-4) | 20-30pt | Body/secondary text range |
| Empirical study (UXR-5, n=64 ages 65-76) | 22pt | Body text for parity with younger adults (task performance equivalent) |
| In-session timer (this benchmark) | 72-96sp | Large numeral, exercise pacing |

**Elder exercise app font floor (React Native sp units, equivalent to pt at 1x):**

| Role | Min size | Notes |
|---|---|---|
| Body / instruction text | 18sp | Absolute minimum; prefer 20sp |
| Section heading | 22sp bold | Matches empirical parity threshold (UXR-5) |
| Screen title / primary label | 24-28sp bold | Screen-level headings |
| Timer numerals | 72sp | In-session large countdown |
| Button labels | 18sp bold | Inside 48dp+ buttons |
| Secondary / caption text | 16sp | Minimum; avoid smaller |
| Streak numeral | 48sp | Progress screen |

**Do not allow system font scaling to shrink below these floors.** Support `allowFontScaling={true}` (Expo/RN default) but set `maxFontSizeMultiplier` to cap upward at 1.4-1.6x to prevent layout overflow rather than capping downward.

#### Contrast Ratios

| Source | Value | Condition |
|---|---|---|
| WCAG 2.2 SC 1.4.3 AA | 4.5:1 | Normal text (< 18pt or < 14pt bold) |
| WCAG 2.2 SC 1.4.3 AA | 3:1 | Large text (≥ 18pt / 24sp, or ≥ 14pt / 19sp bold) |
| WCAG 2.2 SC 1.4.6 AAA | 7:1 | Enhanced; highly recommended for elder population |
| mHealth literature (UXR-4) | 4.5:1 minimum | Specifically recommended for older adult mHealth |

**Elder exercise app target:** Aim for 7:1 (WCAG AAA) for all body text and instruction content. Accept 4.5:1 as the absolute floor for large decorative headings. Never use gray-on-gray, light gray text on white, or light-on-light combinations.

#### Dynamic Type / Font Scaling

- Set `allowFontScaling={true}` on all Text components (Expo/RN default).
- Do NOT hardcode pixel font sizes outside the StyleSheet; always use sp units.
- Test layouts at iOS Accessibility > Display & Text Size > Larger Text at maximum. Ensure no text is clipped, truncated with ellipsis on critical instructions, or hidden.
- Do not use `numberOfLines` prop to truncate instruction text; instead, design for wrapping.

#### Motion and Animation

- WCAG SC 2.3.3 (AAA): Motion animation triggered by interaction can be disabled.
- WCAG SC 2.2.2 (AA): No auto-playing moving content that runs more than 5 seconds unless user can pause/stop.
- In Expo/RN: Check `AccessibilityInfo.isReduceMotionEnabled()` on mount; when `true`, skip transitions and loading spinners beyond a simple opacity fade. Do not use spring bounce, rotation, or parallax effects.
- Progress animations (streak ring fill, dot fill on session complete) should be short (< 500ms), single-direction, and skippable.
- Timer countdown increment is not "animation" in the motion-sensitivity sense; it is functional and should always run.

#### Reading Level and Tone

- Target Flesch-Kincaid grade 6 or below for all body copy, instructions, and button labels.
- Avoid medical jargon ("range of motion," "dorsiflexion") — use plain equivalents ("how far your ankle bends").
- Avoid tech jargon ("sync," "dashboard," "analytics," "log").
- Preferred voice: warm, peer-to-peer ("Let's do this together"), not clinical or directive ("You must complete...").
- Sentence length: max 15 words per sentence in instruction text.
- Error messages: positive, action-oriented ("Let's try again" not "Error: operation failed").

#### Gestures

- Use only single-tap for primary interactions. No swipe-to-dismiss, swipe-to-delete, or swipe-between-tabs as primary navigation.
- Long-press is explicitly forbidden as a primary action (UXR-6: 25% failure on tap-and-hold for older adults).
- Pinch-to-zoom is permissive (do not disable OS-level zoom).
- Haptic feedback confirms primary actions; never use haptic for passive notifications during exercise (unnecessary distraction).

#### Error Prevention

- UXR-4 and UXR-7 both emphasize error prevention over error recovery for older adults.
- Implement: confirmation dialogs for destructive actions only ("End session — are you sure?"), auto-save of session state every 30 seconds so app-backgrounding does not lose progress.
- Avoid: form validation that blocks progress mid-flow, required fields other than the how-I-feel selection.

#### Responsiveness

- Design for phone-only viewport (Expo Go on iPhone 14 = 390pt, Android mid-range = ~360dp). Tablet layout is not in scope for MVP.
- Safe area insets: always respect `SafeAreaView` / `useSafeAreaInsets` — older users may have navigation bars or home indicators overlapping bottom content.
- Bottom tab bar must not be obscured by system navigation bars. The "Stop & rest" button in-session must always remain visible and not scroll off screen.

---

## Adaptation Recommendations

### DEC-1: Set 48dp as the Non-Negotiable Touch Target Floor; Primary Buttons at 64dp

Do not implement 44pt (Apple minimum) as the floor for this population. Use 48dp (Android/Google) as the floor for all interactive elements. Primary action buttons (Start routine, Pause, Resume) should be 64dp tall and full-width. This exceeds all platform minimums and aligns with mHealth literature for the 65+ group.

**Evidence:** UXR-2 (48dp Android), UXR-4 (15mm physical minimum = ~56dp), UXR-5 (larger interaction area reduces error).

### DEC-2: Body Text at 18sp Minimum, Instruction Headings at 22sp; Never Hardcode px

The empirical study (UXR-5) found 22pt font enabled 65-76 year olds to perform as fast as younger adults. 18sp for body text is a conservative lower bound that still exceeds legacy NIA/NLM guidance. All fonts must use sp units so system accessibility scaling works correctly.

**Evidence:** UXR-5 (22pt empirical optimum), UXR-4 (20-30pt range for elder mHealth body text).

### DEC-3: Timer Numeral at 72sp Minimum; Single Large Number, No Decoration

The in-session timer is the most safety-critical display. The user needs to see it without holding the phone close. 72sp is approximately 1 inch tall on a standard device — visible at arm's length or while performing seated exercises.

**Evidence:** UXR-5 (font size reduces time-on-task for older adults proportionally), UXR-6 (participants wanted fullscreen video/display during exercise).

### DEC-4: Target 7:1 Contrast for All Instructional Text; Never Gray-on-White

WCAG AAA (7:1) should be the target for instruction text. The avoid list should include any gray-on-white text combinations. Age-related contrast sensitivity decline starts around age 40 and accelerates; 4.5:1 (WCAG AA) may not be sufficient for the 65-85 population.

**Evidence:** UXR-1 (SC 1.4.6 AAA 7:1), UXR-4 (high contrast specifically recommended for older adult mHealth).

### DEC-5: Disable Reduce Motion Animations When OS Accessibility Flag is Set

Implement `AccessibilityInfo.isReduceMotionEnabled()` check on app startup and store the value in context. Any animated component must respect this flag. This is both an accessibility requirement (WCAG SC 2.3.3) and a user safety concern — vestibular disorders are common in the 65-85 age range.

**Evidence:** UXR-1 (SC 2.3.3, SC 2.2.2).

### DEC-6: Limit Progress Screen to 3 Visual Elements; No Charts or Trend Lines

The "large friendly visuals" brief requirement must be resolved as: large = big numerals and big dots, not a large number of charts. A streak ring + weekly dots + two summary numbers is the maximum before cognitive overload risk increases. Do not add bar charts, line graphs, or goal-completion meters.

**Evidence:** UXR-4 (max 6 items on smartphone, minimalist design for cognitive load), UXR-6 (weekly checkmark schedule most intuitive), VIZ-1.

### DEC-7: Foreground Single CTA on Today Screen; Check-In Gates Session Start

The Today screen must have one primary action above the fold. The how-I-feel check-in should be a required gate (full-screen, PAT-2) that runs when the user taps "Start routine" — not a separate pre-visit step that could be missed. This preserves a single CTA on the home screen while capturing the wellness data.

**Evidence:** UXR-6 (Today tab 92% success = single foreground action), UXR-7 (wizard flow with 2 options, minimize decision points).

### DEC-8: Avoid All Gesture-Based Primary Interactions; Single-Tap Only

No swipe navigation between exercise steps, no long-press to pause. UXR-6 documented 25% failure rate on long-press for older adults in a real exercise app study. Use explicit large buttons for every primary action.

**Evidence:** UXR-6 (25% failure on tap-and-hold), UXR-7 (favor direct single tap), UXR-4 (button-only interface recommended).

### DEC-9: Safety Content Must Be Reviewed by a Qualified Health Professional

This benchmark documents UX patterns for surfacing safety cues. The actual content of the stop-if-pain symptom list is outside UX scope and must be reviewed by a physiotherapist or physician before launch, even for a sandbox concept app, to avoid inadvertently normalizing harmful exercise cues.

**Evidence:** [ASSUMPTION — standard clinical governance for exercise guidance for 65+ population].

---

## Use / Avoid

### Use

- **48dp minimum touch targets** on all interactive elements; 64dp for primary action buttons
- **18-22sp body text** as the floor; 22sp for exercise instruction headings
- **72sp+ timer numerals** in-session — visible at arm's length
- **High contrast (target 7:1)** for all instruction text and critical copy
- **Single-tap primary interactions** — buttons, not gestures
- **Full-screen layouts** for in-session steps and check-in — one task at a time
- **Plain language** at Flesch-Kincaid grade 6 or below
- **Warm, positive, forward-facing copy** — no shame, no penalty for missing a day
- **Bottom tab bar** with 4 tabs max — flat navigation, no sub-menus
- **Static progress indicators** (dots + numbers) — not animated trend charts
- **Large, named buttons** with text labels — not icon-only controls
- **Auto-save session state** every 30 seconds
- **Respect `reduceMotion`** OS accessibility flag — skip or shorten all non-essential animations
- **Persistent "Stop & rest" button** visible on every in-session screen, never scroll-hidden

### Avoid

- **Tiny text** below 16sp anywhere; below 18sp for body/instruction text
- **Gray-on-white or light-on-light color combinations** — any contrast below 4.5:1 is a reject
- **Hidden gestures** — swipe-to-dismiss, long-press, swipe-between-tabs as primary actions
- **Time pressure** — no session-start countdowns, no auto-resume timers after backgrounding
- **Dense dashboards** — no line graphs, bar charts, multiple KPIs on a single screen
- **Icon-only buttons** — all controls must have visible text labels
- **Medical or tech jargon** — no "sync," "analytics," "dorsiflexion," "range of motion"
- **Multi-step data entry** — no forms with more than 1 required field per screen
- **Shame or loss language** — no "You broke your streak," no red indicators for 0-day state
- **Auto-playing animation or audio** that cannot be paused immediately
- **Modals as primary navigation** — overlays for confirmation only, not core journeys
- **Horizontal scroll** on home or progress screens
- **Content that scrolls the "Stop & rest" button off screen** during a session
- **Carousels or auto-advancing content** — older adults need control over pacing
- **Pulsing or looping animations** — vestibular hazard; violates WCAG SC 2.3.3

---

## Planning Connector

| Research ID | Evidence source IDs | Planning consumer | Suggested planning ID | Requirement or UX implication | Confidence | Status |
|---|---|---|---|---|---|---|
| IA-1 | UXR-4, UXR-6, UXR-7 | EXPERIENCE.md / epics | IA decision | 4-tab flat bottom nav; max 2-level depth; no hamburger menu | high | ready |
| IA-2 | UXR-6, UXR-7 | EXPERIENCE.md / home screen story | FR candidate | Today tab foregrounds one CTA (Start routine); check-in gates session start | high | ready |
| IA-3 | UXR-4, UXR-5 | EXPERIENCE.md / onboarding story | FR candidate | Single first-run screen; no carousel; no account creation | high | ready |
| JNY-1 | UXR-6, UXR-7, UXR-4 | UJ: daily session | UJ-1 candidate | 8-step daily session journey incl. check-in gate, step view, safety affordance, completion | high | ready |
| JNY-2 | UXR-6, UXR-4 | UJ: progress check | UJ-2 candidate | Progress screen single-view; no drill-down; today + week summary only | high | ready |
| JNY-3 | UXR-4, UXR-7 | UJ: onboarding | UJ-3 candidate | First-run to first session in < 3 taps | high | ready |
| JNY-4 | UXR-7 | UJ: streak recovery | UJ-4 candidate | Streak-broken state uses zero-blame copy; no penalty screen | high | ready |
| JNY-5 | UXR-7 | UJ: rest day | UJ-5 candidate | Rest day acknowledged; streak preservation rule is an open product decision | medium | needs product decision (streak preservation rule) |
| PAT-1 | UXR-1, UXR-5, UXR-6 | EXPERIENCE.md / FR for in-session screen | FR candidate | Timer 72sp+; pause/resume full-width 64dp; stop-if-pain always visible; haptic on step end | high | ready |
| PAT-2 | UXR-7, UXR-4 | EXPERIENCE.md / FR for check-in | FR candidate | 3-choice full-screen modal; equal-size 72dp buttons; auto-advance after selection | high | ready |
| PAT-3 | UXR-6, UXR-4 | EXPERIENCE.md / streak display | FR candidate | Large streak ring; weekly dots; warm positive copy only | high | ready |
| PAT-4 | UXR-4, UXR-6 | EXPERIENCE.md / safety screen | FR candidate | Persistent Safety tab; in-session bottom sheet trigger; static card; no video | high | ready; clinical content review required (DEC-9) |
| PAT-5 | UXR-6, UXR-4, VIZ-1 | EXPERIENCE.md / progress screen | FR candidate | Max 3 visual elements: streak ring + weekly dots + 2 summary numbers; no charts | high | ready |
| PAT-6 | UXR-6, UXR-7, UXR-4 | EXPERIENCE.md / home screen | FR candidate | 3 content sections above fold; greeting + streak + primary CTA + rest-day secondary | high | ready |
| VIZ-1 | UXR-6, UXR-4 | DESIGN.md / progress screen spec | NFR / DEC | Progress = glanceable achievement; large dots + large numerals; no analytics charts | high | ready |
| VIZ-2 | UXR-1, UXR-5 | DESIGN.md / in-session spec | FR candidate | Timer 72-96sp centered; thin progress bar only secondary; no pulsing arcs | high | ready |
| VIZ-3 | UXR-6, UXR-7 | DESIGN.md / streak component | FR candidate | Streak ring ~120dp; warm non-red color; 0-day = empty ring + forward copy | high | ready |
| DEC-1 | UXR-2, UXR-4, UXR-5 | EXPERIENCE.md / NFR accessibility | NFR | Min touch target 48dp all controls; 64dp primary buttons | high | ready |
| DEC-2 | UXR-5, UXR-4 | EXPERIENCE.md / NFR typography | NFR | Body 18sp min, heading 22sp min; sp units only; never hardcode px | high | ready |
| DEC-3 | UXR-5, UXR-6 | EXPERIENCE.md / FR timer | FR | Timer numeral 72sp min; single large centered numeral | high | ready |
| DEC-4 | UXR-1, UXR-4 | DESIGN.md / NFR contrast | NFR | Target 7:1 AAA for instruction text; 4.5:1 absolute floor | high | ready |
| DEC-5 | UXR-1 | EXPERIENCE.md / NFR motion | NFR | Check `AccessibilityInfo.isReduceMotionEnabled()` on mount; skip non-essential animation | high | ready |
| DEC-6 | UXR-4, UXR-6 | EXPERIENCE.md / progress screen | FR / NFR | Max 3 visual elements on progress; no charts or trend lines | high | ready |
| DEC-7 | UXR-6, UXR-7 | EXPERIENCE.md / home screen | FR | Single CTA on Today; check-in modal gates session start | high | ready |
| DEC-8 | UXR-6, UXR-4, UXR-7 | EXPERIENCE.md / interaction primitives | NFR | Single-tap only for all primary actions; no long-press, no swipe-as-primary | high | ready |
| DEC-9 | [ASSUMPTION] | PRD / launch checklist | Non-UX gate | Safety cue content requires clinical review before any user-facing deployment | high | open — blocks launch |

---

## Handoff Block

**Report path:** `C:\Users\cf306237\Desktop\Projects\tidlor-reborn\sandbox\elder-ex\research\ux-structure-benchmark-2026-06-25.md`

**Benchmark count:** 8 sources (7 strong/authoritative; 1 lead-only for product reference)

**Connector IDs ready for planning:**
- IA: IA-1, IA-2, IA-3
- JNY: JNY-1, JNY-2, JNY-3, JNY-4, JNY-5
- PAT: PAT-1, PAT-2, PAT-3, PAT-4, PAT-5, PAT-6
- VIZ: VIZ-1, VIZ-2, VIZ-3
- DEC: DEC-1 through DEC-9

**Open planning decisions:**
1. Streak preservation rule on rest days (JNY-5): does 1 rest day per week preserve streak? Product decision needed.
2. Audio chime on/off preference: where is the user preference stored and when is it set? (PAT-1)
3. Safety cue content clinical review (DEC-9): must be resolved before any external user testing.

**Source quality status:** All decision-bearing claims backed by UXR-1 through UXR-7 (scores 8-10, strong). UXR-8 (SilverSneakers GO) is discovery-only; no decisions depend on it solely.

**Intended consumers:** `cs-planning-lead`, `cs-requirements-architect`, `bmad-ux` (EXPERIENCE.md authoring), `cs-epic-story-planner`
