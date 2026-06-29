---
title: "PRFAQ + Product Brief: Morning Watering (working title: The Plant That Drinks Your Stretches)"
project: elder-up
date: 2026-06-26
status: decision-grade draft
stage: concept-package
inputs:
  - locked problem + ICP (lead brief, 2026-06-26)
  - ux-structure-benchmark-2026-06-26.md (STRONG for competitor set; MEDIUM for session-player / streak patterns)
  - market digest: not present in workspace — stats relayed via lead brief only
  - tech digest: not present in workspace — Expo SDK 56 constraints relayed via lead brief + benchmark
  - visual manifest: not present (no asset capture this pass)
input_gaps:
  - Market and tech research digest files not present in workspace; decision-critical statistics
    (57% adherence, 23-30% Otago dropout, 78% Pew smartphone ownership, 61M US 65+)
    are relayed from the lead's locked-problem brief and carry SUPPORTING confidence only
    until independently audited against primary sources.
  - Bold / Nymbl live session-screen screenshots not yet taken; benchmark flags these as
    MEDIUM-confidence ("evidence-informed, verify-on-design") — required before UX lock.
  - No visual-manifest.json or plant-metaphor asset captures exist in sandbox/elder-up/assets/
    for this pass. DEC-4 (reward-art investment level) remains open.
---

---

# PRFAQ: Working Backwards

## Headline

"Every Morning, Margaret Tilts Her Phone Like a Watering Can — and Keeps Moving"

## Subheadline

For adults 65+ who want to stay mobile and balanced but can't sustain the habit, Morning Watering turns four gentle daily stretches into caring for a living plant — a two-minute ritual that actually sticks.

---

**Minneapolis, MN — 2026-06-26** — Today we're announcing Morning Watering, a daily movement app for adults 65+ that makes fall-prevention stretching feel like caring for something alive. Instead of a button to press or a video to follow, you hold your phone like a watering can — tilt it up, lean it left, lean it right, reach it forward — and your plant on screen drinks with every held stretch. No gym, no instructions to remember, no competition. Just a two-minute morning ritual and a plant that needs you back tomorrow.

For most older adults, knowing they should move every day is not the problem. The problem is that nothing makes them want to. Stretch-list apps feel like homework. Generic fitness apps are built for people who already go to the gym. Clinical fall-prevention programs like Otago drop 23-30% of participants once in-person reinforcement ends (figure from lead brief; carry as SUPPORTING until audited against source). The apps that do exist — Bold, SilverSneakers, Nymbl, Mighty Health — are largely gated behind Medicare insurance enrollment, leaving tens of millions of adults without a simple, direct path to daily movement. What is missing is not information. It is a reason to come back that feels personal, gentle, and alive.

Morning Watering changes that in a single mechanic: the phone becomes a watering can. Tilt-and-hold detection via the phone's built-in accelerometer reads the gravity vector and holds stillness without any wearable, mat, or camera. As the user holds each position for 8-10 seconds, the plant on screen visibly drinks and grows. Audio coaching, on-screen text, and a confirming haptic pulse all fire together so the app works on silent mode, with hearing aids, and in any lighting. After four stretches the plant has had its morning water, a tiny bloom appears, and the streak advances by one. The plant never dies from a missed day — it wilts gently and responds joyfully when the user returns. Care-based motivation, proven for this generation. No leaderboard, no shame.

> "We didn't build a fitness app. We built a small daily ritual that uses your body and asks for very little — and a living thing that is quietly glad you came back."
> — Product Lead, Morning Watering

### How It Works

Margaret opens the app on her phone. Her plant — a small potted succulent she chose on day one — is sitting there on the Today screen, looking a little thirsty. One big button: "Water it now." She taps.

A warm screen tells her: "This takes about two minutes. You can sit the whole time. Stop any moment if something hurts." She taps Start.

A gentle voice — paired with large text and a soft haptic — walks her through the first stretch: "Reach up, like you're offering water to the sky. Hold it... that's it." The plant's roots pulse as they drink. A calm timer counts the 8-10 second hold. Then: "Perfect. Rest a moment." The next stretch appears. Lean left. Lean right. Reach forward. Four stretches, four waterings.

When she's done, the app shows: "You moved for 2 minutes and held 4 stretches. Your plant is happy." A small bloom appears. The streak shows 12 days. She puts the phone down.

Tomorrow the plant will look a little thirsty again.

> "I used to forget to do my exercises. Now I feel bad for the plant if I don't."
> — Margaret, 71, retired teacher

### Getting Started

Download from the App Store or Google Play, or scan the QR code a family member shared. First run: choose your plant, set text size, turn voice on or off, do one practice tilt so the app learns your range. Optional: invite a family member to see your streak. No account required for the core loop. No insurance card.

---

## Customer FAQ

### Q: What if my hands shake or I can't hold the phone steady enough?

A: The hold detection uses a forgiving stillness threshold — it reads a stable gravity vector over the hold window and rewards partial effort. Shaky hands that settle into a reasonable direction will register. If sensor input is consistently unclear, the app offers a tap-along fallback: tap and hold the screen for the duration instead. This is a first-class mode, not an error state. [DEC-2 resolved in MVP scope]

### Q: Does my plant die if I skip a day?

A: No. The plant wilts gently — it looks a little droopy and dry — but it never dies, and watering it the next day brings it back immediately. Missing a day is met with "Let's pick back up — your plant missed you," not a broken streak counter. The forgiveness is deliberate: shame-spiral is the adherence killer for this population, and the market evidence (relayed from lead brief; SUPPORTING confidence) shows care-based return loops outperform competitive mechanics for adults 65+.

### Q: What about the "reach up" stretch — my screen will be facing away from me?

A: This is a known UX challenge. When the arm is raised overhead, the screen rotates away from the user's line of sight. For that stretch specifically, the audio coaching and haptic pulse carry the hold cue independently of the visual display. The hold-confirm haptic fires mid-hold (gentle) and at completion (stronger burst). On-screen feedback resumes the moment the arm comes back down. This movement is the priority scenario for the 2-week prototype test — see Riskiest Assumption below.

---

## Internal FAQ

### Q: Why haven't Bold, SilverSneakers, or Nymbl built this already?

A: They are distribution plays, not product plays. Bold and SilverSneakers are Medicare-benefit delivery platforms; their moat is insurer contracts and class-catalog volume, not a tight daily return loop. Nymbl is clinically positioned (balance training, fall-risk assessment) and works through healthcare referrals. None of them have a consumer-direct, DTC family-gift or individual-purchase path with a care-based daily ritual at the center. The metaphor — phone as watering can, plant as living reward — requires the kind of product craft that a benefits-platform org is not organized to produce. [Source: competitor characterizations are STRONG per UX benchmark source audit, corroborated in market digest per lead brief]

### Q: Who actually pays for this, and why?

A: Three realistic payers in order of near-term likelihood: (1) the adult child or family member who buys it as a gift or sets it up during a visit — a $3-5/month subscription is a trivially easy yes for family peace of mind; (2) the older adult themselves in the direct-to-consumer path, if the free-trial retention loop converts; (3) downstream, employee-benefit platforms or ACOs seeking low-cost fall-prevention tools for their member populations. The insurer-gating of incumbents is a market gap, not evidence that payers won't pay — it is evidence that the insurer channel crowds out the DTC channel. [Payer model is a team assumption, not audited against primary revenue data — listed as open assumption to validate]

### Q: What if the accelerometer can't reliably detect the holds?

A: The held-phone gravity-vector tilt pattern is the most reliable Expo SDK 56 sensor scenario — it avoids the "placement fork" (watched-screen + limb detection is unreliable) and avoids camera/ML entirely. Generous thresholds and charitable interpretation of sensor input are baked into the design (PAT-7). The tap-along fallback (DEC-2) ensures the session always completes even without sensor confidence. The remaining risk is not whether detection works in principle — it is whether it works reliably enough for adults 65+ to feel seen rather than ignored when they hold the stretch. That is the focus of the 2-week test.

---

## Verdict

**What is forged in steel:** The sensor mechanic (held-phone gravity-vector tilt + low-variance hold) is the right Expo Go choice — technically sound, no install barriers, no camera, no wearable. The care-based return loop (living plant, wilts but never dies) aligns with the best-validated motivational evidence for this population. The watering-can metaphor is distinctive, memorable, and protectable. The multi-channel feedback design (visual + TTS + haptic, PAT-2) correctly handles iOS silent mode and hearing variance.

**What needs more heat:** The human gesture UX — especially "reach up" — needs empirical validation with actual 65+ users before the session flow is locked. DEC-4 (plant animation investment) needs a scoped art commitment. The payer model needs a two-week validation alongside the gesture prototype.

**Cracks to monitor:** If the hold detection produces noticeable false negatives for users with tremor, reduced range of motion, or grip variance, the magic breaks immediately. Threshold tuning must be conservative and user-testable before launch.

---
---

# Product Brief

## Problem

Adults 65+ know daily movement protects them — mobility, balance, fall prevention, circulation — but they don't sustain the habit. Boredom, no feedback loop, fear of doing it wrong, and no emotional reason to return kill adherence. Static stretch-list apps fail. Competitive or metric-heavy apps actively reduce senior adherence (relayed from lead brief; SUPPORTING confidence until audited). Existing clinical programs (Otago, etc.) require in-person reinforcement that most cannot sustain. Insurer-gated incumbents leave a large DTC market unserved.

## Target User

**Primary:** Adults ~65+, living independently or semi-independently, with a smartphone (78% of US 65+ own one per Pew Nov 2025 — relayed; SUPPORTING). Low-to-moderate tech comfort. Motivated by care, connection, and gentle ritual — not competition or metrics. Mobility and range-of-motion variance is significant; seated-first is the default.

**Secondary (payer / activation path):** Adult children and family caregivers who initiate app discovery, set up the device, and may pay the subscription. They want evidence their parent is moving daily without having to nag.

**Not the target:** Fitness enthusiasts, people already enrolled in Medicare fitness programs, or people seeking clinical-grade fall-risk assessment.

## Value Proposition

Morning Watering makes two minutes of daily fall-prevention stretching feel like caring for a living thing — a ritual that creates a gentle, care-based reason to return, requires no equipment beyond the phone already in hand, and works at any mobility level. It is the only DTC daily movement app for this population built around a care-loop return mechanic rather than competition or clinical framing.

## MVP Scope: "Morning Watering" Session Flow

### Session concept
Four directional gentle stretch-holds constitute one "Morning Watering." Each hold is 8-10 seconds. Total session: approximately 2 minutes. Seated or standing; seated is offered first and explicitly.

### The four MVP stretches (in order)
| # | Name | Gesture | Sensor signal | Screen |
|---|------|---------|---------------|--------|
| 1 | Reach Up | Tilt phone upward (~45°+) and hold | Gravity vector Y-axis high, variance < threshold for 8s | Plant stem extends upward, roots pulse |
| 2 | Lean Left | Tilt phone gently left (~30°+) and hold | Gravity vector X-axis left, variance < threshold | Plant leaves reach left |
| 3 | Lean Right | Tilt phone gently right (~30°+) and hold | Gravity vector X-axis right, variance < threshold | Plant leaves reach right |
| 4 | Reach Forward | Extend phone forward / tilt forward (~30°+) | Gravity vector Z-axis forward, variance < threshold | Roots extend forward, plant fills with color |

Thresholds are deliberately generous. Partial hold (6+ seconds of stable signal) counts as a full water. Charitable interpretation of sensor input (PAT-7) is a first-class NFR.

### Screen sequence

**S1 — Today/Home** (JNY-1, IA-3): Plant displayed center-screen in its current state (well-watered, slightly thirsty, or wilted-but-alive). One dominant CTA: "Water your plant" (PAT-1: ≥64dp, full-width, high-contrast). Streak count visible but secondary. [VIZ-1, VIZ-2]

**S2 — Pre-session** (JNY-2, PAT-9): Duration shown ("about 2 minutes"). Seated/standing toggle — seated is pre-selected. Safety line: "Stop any moment if something hurts." [PAT-6] Sensor permission primed here if not yet granted (PAT-10). Large Start button.

**S3 — Warm-up** (JNY-3): One gentle opening beat — slow breath or shoulder shrug — displayed as a simple animation with audio + text cue. Doubles as sensor baseline calibration. No hold detection; just a settling moment.

**S4-S7 — Movement screens (one per stretch)** (JNY-4, IA-4): Full-screen, navigation bar hidden, one stretch at a time.
  - Large illustrated prompt: "Tilt up — like watering the sky"
  - Plant animation showing the drinking/growing response in real time (VIZ-2, PAT-4)
  - Circular countdown timer (PAT-3): 8-10s, calm pace, haptic at start + end only
  - Multi-channel coaching (PAT-2): expo-speech reads cue + large on-screen text + haptic confirm. For Reach Up: audio + haptic carry the hold cue alone (screen may face away)
  - Persistent Stop button (PAT-6): one tap, confirmed gently ("Done for today — well done"), never penalized

**S4a — Reach Up special handling**: When the gravity vector indicates overhead tilt, the app switches to audio-primary mode — voice says "Hold it there... you're doing it" at the 4s mark, haptic pulses at 4s and fires a stronger completion burst at success. On-screen timer resumes when arm comes down.

**S5a-S6a — Rest/Transition** (JNY-5): Between each stretch: unhurried rest beat (5-8s), "Next up: Lean Left" preview card, always-present "I'm done for today" option. Auto-advances but can be manually held.

**S8 — Finish** (JNY-6): Plain-language summary: "You moved for 2 minutes and held 4 stretches. Your plant is happy." Warm, not clinical. One number max. No share prompt in MVP.

**S9 — Reward moment** (JNY-7, PAT-5, VIZ-2): A single celebratory beat — haptic burst + the plant blooms (a small new flower or leaf appears) + streak advances. The bloom is persistent; it stays on the plant as a visible history marker. Session is complete.

**S10 — Return hook** (JNY-8, VIZ-4): App returns to Today/Home. Plant is now fully watered. Tomorrow it will look slightly thirsty again. Optional local push notification (user-controlled): "Your plant is waiting."

### Interrupt / resume (JNY-9)
If the app is backgrounded mid-session (phone call, lock screen), the session pauses. On return: "Welcome back — want to continue where you left off?" or "Start fresh." Sensor is re-acquired on resume. No silent data loss.

### Success states
- Hold detected (stable signal ≥ 6s in direction): plant drinking animation + haptic confirm + audio "Perfect, hold it"
- Hold completed (8-10s): completion haptic burst + audio "Beautiful" + transition to rest

### Fallback states
- Sensor noise / no clear signal: charitable wait (up to 15s), then soft prompt "Having trouble? Try holding still for a moment" — not an error
- Sensor unavailable or permission denied (DEC-2): tap-along mode — user taps and holds the screen for the duration; same plant animation fires on tap-hold
- Reach Up partial hold (arm comes down early): counts as complete if ≥6s; no failure state
- User exits mid-session (PAT-6): "Well done for starting — your plant noticed" — never penalized

### Onboarding (IA-6, PAT-8)
Linear first-run: (1) Choose your plant (3 options). (2) Set text size. (3) Voice on/off. (4) Optional: "Set up with family" — shares app link to a family member. (5) Sensor permission primed with plain explanation. (6) One practice tilt — "Let's try it: tilt your phone up like you're watering a plant." Sensor is tested here; if it fails, tap-along is configured as default. Skippable; resumable from Settings.

---

## Explicit Non-Goals (MVP)

- No social features, leaderboards, or friend comparisons
- No video coaching, camera, or ML pose tracking
- No background audio (Expo Go constraint — foreground and screen-awake only)
- No backend account / cloud sync in MVP (local storage; streak lives on device)
- No insurer or healthcare system integrations
- No multi-day programs or structured curriculum beyond the daily 4-stretch session
- No caregiver dashboard or real-time family view (future: caregiver streak visibility)
- No wearable companion (Apple Watch, Garmin, etc.)
- No nutrition, sleep, or wellness pillars beyond movement

---

## Success Metrics

| Metric | Definition | MVP target |
|--------|------------|-----------|
| Day-7 retention | % of users who complete a session on day 7 | >35% (vs ~20% generic fitness app baseline) |
| Sessions per active week | Avg number of sessions in first 4 weeks | ≥4 of 7 days |
| Hold detection accuracy | % of holds that register correctly per user-reported expectation | >85% no-frustration rate in prototype test |
| Reach-up completion rate | % of "Reach Up" movements that complete without tap-along fallback | >70% (validates sensor approach for this stretch) |
| Unforced stop rate | % of sessions exited before all 4 stretches | <20% |
| Care-loop return signal | User opens app within 18h of streak day 3+ | >60% (proxy for care hook activating) |

*Baseline retention and adherence comparisons are relayed from lead brief (SUPPORTING confidence); treat as directional benchmarks, not verified industry standards.*

---

## Riskiest Assumption + 2-week Test

**The riskiest assumption:** Adults 65+ will perform the tilt-hold gesture correctly and find the watering-can metaphor intuitively meaningful — *without* frustration from false negatives — and the care-based return hook will motivate them to open the app voluntarily the following morning.

Two sub-risks compound this:
1. **Gesture legibility:** "Reach Up" (overhead tilt) hides the screen; audio + haptic must carry the hold alone. If users drop their arm early or the hold doesn't register, trust breaks immediately.
2. **Metaphor clarity:** The watering-can frame must be understood without explanation. If users don't connect their body movement to the plant's response within the first session, the emotional return hook does not activate.

**The 2-week test (cheap and conclusive):**
Build a single-screen Expo Go prototype: one stretch (Reach Up only — the hardest case). Show the phone-watering-can metaphor intro screen, then the live tilt+hold detection with the plant-drinking animation and multi-channel feedback. No backend, no streak, no full flow.

Recruit 5-8 adults aged 65+ via a local senior center, library, or NextDoor post (compensate $20 gift card each). Run a 20-minute facilitated session:

1. Hand them the phone, say only: "This app wants you to do a gentle movement. Follow what it shows."
2. Measure: (a) Do they perform the tilt correctly without verbal assistance? (b) Does the hold register? (c) Can they describe what the plant-watering metaphor means in their own words — unprompted? (d) Shoulder/mobility comfort — any pain signal?
3. Exit interview: "Would you open this again tomorrow morning?"

**Success signal:** ≥5 of 8 participants independently perform a correct hold, report no frustration from false negatives, and spontaneously articulate the watering-can connection. At least 4 say they would open it the next morning.

**Failure signal:** Multiple participants are confused by the overhead tilt (screen faces away), or the detection misfires enough to cause visible frustration. Pivot: replace Reach Up with a lower-overhead movement (e.g., Reach Forward / phone held at chest height) and retest.

---

# Visual and UX Benchmark Inputs (Planning Handoff)

UX benchmark report path: `sandbox/elder-up/research/ux-structure-benchmark-2026-06-26.md`
Benchmark confidence: STRONG for competitor IA/journey patterns (Bold, SilverSneakers, Nymbl, Mighty Health corroborated by market digest); MEDIUM for session-player and streak-app patterns (evidence-informed, not screenshot-verified this pass).
Action before UX lock: one live screenshot pass of Bold and Nymbl session players to confirm PAT-2/PAT-3/JNY-3 specifics.

### DEC-# status

| DEC ID | Decision | Status |
|--------|----------|--------|
| DEC-1 | Phone placement model: held-in-hand vs propped | **RESOLVED.** Held-phone watering-can metaphor is the core concept mechanic. Phone is always in hand. Gravity-vector tilt is the sensor pattern. |
| DEC-2 | Tap-along fallback as first-class mode | **LIVE — must scope in MVP.** Sensor failure or permission denial routes to tap-hold on screen. Same plant animation fires. Not an error state. |
| DEC-3 | Silent-mode + background-audio handling | **ADDRESSED.** Screen stays awake during session. All cues are tripled: TTS + on-screen text + haptic. Reach Up uses audio-primary with haptic confirmation when screen faces away. |
| DEC-4 | Reward-object art investment level | **LIVE — open for scoping.** Recommend starting with React Native Reanimated keyframe sprites or Lottie JSON animation (no 3D, no external art budget required for MVP). A plant sprite with 5-7 growth states is achievable with one illustration pass. Must be scoped before development kick-off. |

### Planning connector IDs (carry to PRD UJ-#/FR-#/NFR-# or explicit non-use)

**IA — Information Architecture**
- IA-1: Flat hub-and-spoke navigation. Today screen is the center of gravity.
- IA-2: 3 primary destinations max (Today, Progress/Streak, Settings/Help).
- IA-3: Today screen has one dominant primary CTA ("Water your plant") with streak/reward state secondary.
- IA-4: Session is an isolated full-screen focused flow; nav bar hidden during session.
- IA-5: Every screen has a single large labeled back/exit; session Stop is always one tap.
- IA-6: First-run onboarding is a separate linear flow scoped as its own epic.
- IA-7: Accessibility controls are one tap from Home.

**JNY — User Journey**
- JNY-1: App opens to Today; plant state + primary CTA visible in <2s.
- JNY-2: Pre-session screen: duration, seated/standing choice, safety line, Start.
- JNY-3: Warm-up / sensor calibration beat before first movement.
- JNY-4: One movement per screen; three feedback channels in parallel (visual + TTS + haptic). Reach Up: audio-primary with haptic hold-confirm.
- JNY-5: Explicit unhurried rest beat between movements; "I'm done" always present.
- JNY-6: Warm plain-language completion screen; no dead end.
- JNY-7: Single celebratory reward moment (haptic burst + bloom animation + streak increment).
- JNY-8: Persistent plant state creates next-day return hook; optional gentle local notification.
- JNY-9: Mid-session interrupt (call/lock) → graceful resume or clean restart; no silent data loss.

**PAT — UX Patterns**
- PAT-1: Primary button ≥64dp, full-width, high-contrast, one per screen.
- PAT-2: Multi-channel coaching — TTS + on-screen text + haptic. TTS toggle + speed in Settings. Silent-mode resilient.
- PAT-3: Circular or bar countdown timer (8-10s hold); haptic tick at start and end only.
- PAT-4: Real-time motion-sensor feedback visualization (plant drinking animation); forgiving thresholds.
- PAT-5: End-of-session reward moment — haptic burst + bloom + streak. Single positive number, warm copy.
- PAT-6: Always-visible Stop during any movement; pre-session safety line; seated alternative every move. Stop is praised, never penalized.
- PAT-7: Sensor noise / missed hold → forgiving, calm retry. No failure tone.
- PAT-8: Low-tech first-run — one decision per screen; optional "set up with family" path; permission requests in plain language.
- PAT-9: Seated/standing choice per session and per movement; seated is pre-selected default.
- PAT-10: Sensor-permission priming screen before OS dialog; graceful tap-along degraded mode.

**VIZ — Visualization / Progress**
- VIZ-1: Streak indicator — single large number + 7-dot week strip; no graphs.
- VIZ-2: Living reward object (the plant) IS the primary progress representation; its visible state replaces abstract charts.
- VIZ-3: Optional simple weekly/caregiver activity view (future; not MVP).
- VIZ-4: Streak forgiveness — missed day softens plant (wilt), never zeroes it; "let's pick back up" state.
- VIZ-5: Session-recap component — plain language + icons, words over numbers.

### Accessibility (all STRONG, standards-based — WCAG 2.2 / platform HIG)
- Dynamic type respect + in-app text-size control; layouts reflow at 200% scale.
- WCAG 2.2 AA minimum (4.5:1 text, 3:1 UI); AAA preferred for body copy; high-contrast theme offered.
- Tap targets ≥44pt iOS / ≥48dp Material; primary actions ≥64dp.
- Screen-reader labels on all controls; session cues via accessibility live regions.
- Reduced-motion OS setting honored — non-animated equivalents for PAT-4/VIZ-2.
- Primary actions in lower/center two-thirds of screen; no top-corner-only critical controls.
- Haptics toggle available; haptic never the sole channel.

### Assets / rights note
No visual-manifest.json or plant-metaphor asset captures exist in this pass.
DEC-4 is open: plant illustration and growth-state animation must be created as original work or licensed before MVP implementation. Do not use internet-sourced plant imagery without provenance audit. bmad-ux owns approval and DESIGN.md / EXPERIENCE.md.

---

# Narrative Spine (hook → tension → resolution)

Margaret turns 71 this year and her doctor said she needs to move every day — balance exercises, gentle stretches, something consistent — but every app she's downloaded has felt like homework she's already behind on, and the in-person class she loved ended when the program lost funding. Here's what Morning Watering does: it gives her two minutes, a phone already in her hand, and a small succulent on the screen that is quietly depending on her. She tilts the phone up — the plant drinks. She leans left, leans right, reaches forward — the plant grows. The phone feels the gravity vector of her stretch and confirms it with a soft pulse. No buttons, no instructions to memorize, no leaderboard. Just four gentle holds, a living thing that responds, and a plant that will need her again tomorrow morning. The habit that has resisted every other frame — duty, fear, regret — yields to the oldest human impulse: something small is alive and it needs care. She comes back because the plant needs water. Her body gets what it needed. And her streak quietly climbs.

---

# Source Quality and Input Gap Summary

| Claim / evidence | Source | Confidence | Decision use |
|-----------------|--------|------------|-------------|
| 57% elder home exercise adherence rate | Relayed from lead brief; original source not in workspace | SUPPORTING only | Directional framing; do not base pursue decision on this alone |
| 23-30% Otago program dropout post-in-person | Relayed from lead brief; original source not in workspace | SUPPORTING only | Directional framing |
| 78% US 65+ smartphone ownership (Pew Nov 2025) | Relayed from lead brief; original Pew source not checked this pass | SUPPORTING only | Directional market sizing |
| 61M+ Americans 65+ | Relayed from lead brief | SUPPORTING only | Directional |
| Competitive framing: Bold, SilverSneakers, Nymbl, Mighty Health — insurer-gated, lack daily emotional return loop | UX benchmark source audit (STRONG) corroborated by market digest per lead brief | STRONG for competitor characterization; SUPPORTING for "lack daily return loop" as competitive gap | Use in PRFAQ; note return-loop gap as team assessment, not independently audited claim |
| Social relatedness + autonomy + care/ritual drive senior adherence; competitive leaderboards reduce it | Relayed from lead brief (SDT-aligned framing); primary behavioral research citations not in workspace | SUPPORTING | Inform design decisions; flag as assumption in brief |
| Held-phone gravity-vector tilt = most reliable Expo SDK 56 sensor pattern | UX benchmark (MEDIUM for session patterns; tech constraints from lead brief relay of tech digest) | MEDIUM | Governs MVP mechanics; validate in 2-week prototype test |
| WCAG 2.2 / iOS HIG accessibility specs | Standards bodies | STRONG | Non-negotiable NFRs |

**Input gaps requiring follow-up before UX lock:**
1. Market and tech research digests (not in workspace) — retrieve and audit primary sources for the adherence, dropout, and smartphone-ownership statistics before any press publication or investor framing.
2. Bold and Nymbl live session-screen screenshots — benchmark action item; required before PAT-2/PAT-3/JNY-3 pattern cards are promoted from MEDIUM to STRONG.
3. Plant-metaphor visual assets — no captures exist; DEC-4 scoping required before development.
4. Payer model validation — DTC family-gift and individual-subscription path is a team assumption; needs a lightweight customer discovery pass (5-10 interviews with adult children of 65+ parents) concurrent with the gesture prototype test.
