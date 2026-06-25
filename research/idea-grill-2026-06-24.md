# Idea Forcing-Grill — Health-Insights Web App (2026-06-24)

Product: Client-side Apple Health (`export.xml`) insights web app. Upload iOS Health export zip, parse entirely in-browser (privacy), visualize key metrics, rule-based recommendations, trend projections. Stack: React + Vite + TypeScript, no backend.

| # | Question | Working answer | Kill check |
|---|----------|----------------|-----------|
| Q1 | Problem & pain | Apple Health hoards rich longitudinal data but its native app gives shallow, siloed views; no synthesis, no recommendations, no trend projection. Active workarounds: people pay for WHOOP/Oura subscriptions, export to spreadsheets, use Gyroscope. Painkiller-leaning for quantified-self users. | Pass — active paid workarounds exist |
| Q2 | ICP | Privacy-conscious quantified-self iPhone user who already has years of Health data and distrusts sending it to a cloud SaaS. Beachhead: "the person who exported their Health data once and didn't know what to do with the zip." | Pass — nameable beachhead |
| Q3 | Existing alternatives | Apple Health app (siloed), WHOOP/Oura (need their hardware + cloud subscription), Gyroscope (cloud upload), manual CSV/spreadsheet. Status quo failure: either shallow, or requires hardware/cloud and recurring fees. | Confirm via market research |
| Q4 | Unique wedge | 100% client-side privacy + no hardware + no subscription + works on data the user ALREADY has. Insight: the export zip is an underused asset. | Confirm differentiation real |
| Q5 | Market & timing | Why now: browsers can now parse multi-GB files via streaming + Web Workers + WASM unzip; privacy sentiment high. TAM = iPhone health-data users. Confirm SAM/SOM via market research. | Confirm why-now |
| Q6 | Value capture | Out of immediate scope (no backend / likely free or one-time). Note as open. | Deferred — flag |
| Q7 | Riskiest assumption | That a real Apple Health export (100s MB–multi GB) can be parsed + visualized in-browser without crashing the tab, AND that rule-based recs are trustworthy/non-misleading. | Drives tech + safety research |

Decision: problem and ICP are sufficiently locked to proceed to research fan-out (Workflow 1, steps 3-5). No real-brand asset gate (original product; WHOOP/Apple/Oura are layout benchmarks only). Visual-researcher: not applicable (no brand assets). UX-structure-researcher: applicable (dashboard IA/dataviz benchmark).
