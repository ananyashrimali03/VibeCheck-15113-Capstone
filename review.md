# VibeCheck — Requirements review (QA / QC)

**Review date:** 2026-04-23  
**Sources:** [`plan.md`](./plan.md), [`spec.md`](./spec.md), and the current implementation under `app/`, `components/`, and `lib/`.  
**Scope:** Traceability against the plan and spec only; no application code was modified for this document.

---

## Executive summary

The product delivers a credible **signals → LLM → playable audio** loop with privacy gating, optional location/weather, **local listening history (FIFO + Clear)**, **Re-read** with a **15 s** cooldown, distress UI, and offline awareness. Several items are **material mismatches** with [`plan.md`](./plan.md) and [`spec.md`](./spec.md): the LLM integration is **Google Gemini** (not **Claude** / Anthropic), music retrieval uses the **iTunes Search API** with **three** diverse tracks (not **Deezer** with **4–8** previews), the visual language is a **light** pastel theme rather than the specified **dark, ambient** mobile-first UI, and project documentation still points at a **non-existent** `app/api/claude` route and **`ANTHROPIC_API_KEY`**. If hackathon rules require Anthropic Claude in code, this is a **release blocker** until the inference path and docs align.

---

## Is the app functioning as required? (behavior vs. exact plan)

This question has two different answers, depending on whether “required” means **the product behavior the plan describes** or **the specific technologies and visuals written into the plan**.

### If “required” means **core behavior** (intent of the journey)

**Yes — mostly.** Ignoring which LLM and which music API the plan names, the implementation **does** carry out the intended loop: collect passive **`SignalsPacket`** data (including optional weather after location), call a **server-side** LLM that returns structured mood/playlist fields, run a **search** to get **preview-capable** tracks, render results with **playback**, **Re-read** with debounce, **listening history** merged into the next cycle, **privacy** gating, **offline** messaging, and **distress** UI when flagged. Swapping Claude for Gemini and Deezer for iTunes does **not** break that architecture—both paths satisfy “infer → query → play previews,” assuming `GEMINI_API_KEY` is set and iTunes returns previews.

**Remaining functional gaps vs the plan’s *numbers* and *robustness* (not aesthetics):** the UI surfaces **three** tracks per cycle instead of **4–8**; geolocation uses a **25 s** timeout instead of the plan’s **~5 s** weather window; observability (`console.table` / **cycle_id** logging) is thin; music search failures collapse to an **empty list** without a clear error. Those are **behavioral** caveats, not theme choices.

### If “required” means **literal plan/spec** (named APIs, counts, dark UI, README)

**No — not fully.** The plan and spec explicitly call for **Claude**, **Deezer**, **4–8** tracks, **dark** ambient UI, and documented env/setup that matches the code. The app **does not** match those specifics. That is a **compliance / submission-rule** issue, not proof that the product loop is broken.

### One-line summary

| Question | Answer |
|----------|--------|
| Does it **function** as the described **product** (signals → LLM → playable previews → re-run, with privacy and listening)? | **Largely yes**, with the non-aesthetic gaps noted above. |
| Does it meet the **exact** APIs, track counts, theme, and docs in [`plan.md`](./plan.md) / [`spec.md`](./spec.md)? | **No** — substitutes (Gemini, iTunes, 3 tracks, light UI) and doc drift. |
| Does it meet **external** requirements that mandate **Claude in code** (e.g. hackathon rules)? | **Uncertain / at risk** until rules are checked; implementation is **not** Claude today. |

---

## Traceability matrix (plan.md)

| Plan reference | Requirement (summary) | Status | Notes |
|----------------|----------------------|--------|--------|
| §0.1 Tech | Vite + React or Next SPA, **mobile-first dark UI** | **Partial** | Next.js App Router SPA patterns are present; UI is **light** (`bg-[#fff8f0]`, high-contrast borders), not dark ambient. |
| §0.1 Signals | Time, TZ, day, locale, `onLine`, visibility, idle estimate, `ua_mobile`; optional battery | **Met** | [`lib/signals.ts`](./lib/signals.ts) collects these; battery best-effort. Scroll/click counters correctly omitted for single-pass scope. |
| §0.1 Weather | Open-Meteo only when geo works; else degrade | **Met** | [`lib/weather-openmeteo.ts`](./lib/weather-openmeteo.ts); limitations include `no_weather` / `weather_unavailable` when applicable. |
| §0.1 Geo timing | `getCurrentPosition` within **~5 s** (plan §0.1 / spec SP-03) | **Gap** | [`app/page.tsx`](./app/page.tsx) uses `{ timeout: 25_000 }` for geolocation—slower than the spec’s ~5 s window for the weather slice. |
| §0.1 Claude | One proxy, `SignalsPacket` → strict **`InferenceResult`** | **Not met** | Inference is **`POST /api/infer`** using **`GEMINI_API_KEY`** and `@google/generative-ai` ([`app/api/infer/route.ts`](./app/api/infer/route.ts)), not Claude Messages API. |
| §0.1 Deezer | Search → **4–6** tracks with previews; `<audio>` | **Not met** | Music is **`GET /api/music`** → **iTunes** (`itunes.apple.com/search`), **`pickDiverseTracks`** returns up to **3** tracks ([`app/api/music/route.ts`](./app/api/music/route.ts)). Player uses `<audio>` for iTunes previews (and optional YouTube embed). |
| §0.1 UI flow | Loading → results → **Re-read** (15 s debounce) | **Met** | `DEBOUNCE_MS = 15_000` in [`app/page.tsx`](./app/page.tsx). |
| §0.1 Privacy | Short notice + Continue | **Met** | First-visit gate with `localStorage`; copy describes signals (see consistency issues below). |
| §0.1 Listening | Stub or FIFO; Phase 2 note | **Exceeded (good)** | [`lib/listening.ts`](./lib/listening.ts): FIFO cap 32, merge via `buildListeningContext`, **Clear** in footer—matches full MVP-09 style. |
| §3.3 Secrets | No Claude key in client bundle | **Met** | API keys read server-side in route handlers. |
| §6.x Safety | Non-clinical; `distress_hint` | **Met** | System prompt + static panel when `safety.distress_hint` is true. |
| §10 / §11 | Accessibility / observability | **Partial** | Play controls have labels; **`cycle_id`** is created but **not** logged via `console.table` as suggested in §11. |

---

## Traceability matrix (spec.md — full MVP IDs)

| ID | Requirement | Status | Notes |
|----|-------------|--------|--------|
| MVP-01 | Auto read cycle on load | **Met** | After privacy **Continue** and geo flow **`done`**, `useEffect` calls `runCycle()` ([`app/page.tsx`](./app/page.tsx)). |
| MVP-02 | No mandatory mood text input | **Met** | |
| MVP-03 | Privacy notice once, `localStorage` | **Met** | `vibecheck_privacy_ok_v2`. |
| MVP-04 | Hero `notification_line`, `weather_metaphor`, `mood_label`, confidence | **Met** | Extra collapsible “How this read is framed” matches extended `InferenceResult` type. |
| MVP-05 | **4–8 Deezer** tracks, preview URLs, `<audio>` | **Not met** | iTunes-based; **3** tracks; types still named `DeezerTrack`. |
| MVP-06 | `creative_nudge`, `affirmation_line` | **Met** | |
| MVP-07 | Re-read + ≥15 s debounce | **Met** | |
| MVP-08 | Distress resources if `distress_hint` | **Met** | Short static copy; aligns with “minimal” path. |
| MVP-09 | Listening FIFO + merge + Clear | **Met** | [`lib/listening.ts`](./lib/listening.ts), footer controls. |

**Stretch (spec §2.2):** In-app notification-style toast ([`components/VibeDesktopToast.tsx`](./components/VibeDesktopToast.tsx)) and optional OS notifications ([`lib/os-notification.ts`](./lib/os-notification.ts)) are implemented; toast is **`hidden md:block`**, so **small-screen sessions** do not get the same chrome. Periodic re-scan (STR-03), `music_handoff` (STR-04), and OAuth (STR-06) are not in scope of this review as unstretched items.

---

## Critical findings (severity)

### 1. LLM vendor: Claude (plan/spec/README) vs Gemini (code)

- **Plan / spec:** Anthropic **Claude**, server-side proxy, **`ANTHROPIC_API_KEY`** in `.env.example` (spec SP-01).
- **Code:** [`app/api/infer/route.ts`](./app/api/infer/route.ts) uses **`GEMINI_API_KEY`** and `gemini-flash-latest`.
- **README:** Root [`README.md`](./README.md) claims [`app/api/claude/route.ts`](./app/api/claude/route.ts)—that path **does not exist** in this tree.
- **Risk:** Fails documented contracts and stated **prize / Devpost “Use Claude”** narrative unless the submission explicitly retitles the integration or restores Claude.

### 2. Music provider: Deezer (plan/spec) vs iTunes + optional YouTube (code)

- **Plan §7:** `GET https://api.deezer.com/search/track`, **4–8** preview-capable tracks.
- **Code:** iTunes search, random diversity pass, **maximum three** tracks returned to the client.

### 3. Documentation drift

- [`.env.example`](./.env.example) documents **`GEMINI_API_KEY`** / optional **`YOUTUBE_API_KEY`**—consistent with code, **not** with [`plan.md`](./plan.md) §0.2 step 1 (`ANTHROPIC_API_KEY`).
- README “Claude integration” section references files and env vars that do not match the running stack.

### 4. UI theme vs plan

- Plan repeatedly specifies **dark**, ambient, calm loading. The implemented UI is a **bright** neo-brutalist pastel palette. Functionally acceptable; **spec compliance** for visual direction is weak.

### 5. Inference JSON validation depth

- Client accepts `InferenceResult` if `mood_label` and `deezer_search_query` are strings ([`app/page.tsx`](./app/page.tsx)). Server validates minimally (`isInferencePayload`). Full **strict schema** validation (Zod / required nested `safety`) per spec §5 is **light**.

### 6. Music API failure transparency

- [`app/api/music/route.ts`](./app/api/music/route.ts) returns **`[]`** on fetch failure; the UI may show “No tracks” without distinguishing **search error** vs empty catalog.

---

## Positive observations

- **Signal packet** shape and **limitations** array match the intent of graceful degradation.
- **Open-Meteo** integration is clean; no API key required.
- **Listening history** behavior (FIFO, dedupe window, aggregate hint for Claude/Gemini) matches the spirit of §4.4.
- **Re-read debounce**, **offline banner**, and **distress pathway** align with plan §9–§11 themes.
- **VibePlayerWidget** provides accessible play/pause/skip, waveform affordance, and optional full-length YouTube path when `YOUTUBE_API_KEY` is set—useful product flexibility (outside strict Deezer-only MVP).

---

## Recommended verification (manual QA)

When you next test (no code changes required for this list):

1. **Cold load:** Privacy → optional geo → single automatic cycle; confirm hero copy and at least one **iTunes** preview plays in widget.
2. **Re-read:** Confirm button shows countdown and blocks repeats for **15 s**.
3. **Offline:** Toggle network off; confirm banner and graceful degradation.
4. **Listening:** Play previews, reload, confirm history affects inference payload; **Clear** resets count.
5. **Distress:** Only if testing safety copy—confirm panel appears when model sets `distress_hint: true` (careful with real users).
6. **Cross-browser:** Compare **desktop** (toast + notifications) vs **mobile width** (toast hidden)—decide if that matches product goals.

---

## Summary verdict

| Dimension | Assessment |
|-----------|------------|
| **Core user journey (functioning product)** | **Largely yes:** passive signals → LLM JSON → playable previews → Re-read; privacy, listening, distress, offline—not blocked by choosing Gemini/iTunes/light UI instead of Claude/Deezer/dark. |
| **plan.md / spec.md literal compliance** | **Poor** on LLM vendor, music API, track count, dark UI, geo timeout, and README/env parity. |
| ** README “Claude + repo accuracy”** | **At risk** until docs and implementation agree. |

This review is informational only; apply changes when you choose to align the codebase with [`plan.md`](./plan.md) or update the plan/README to reflect the Gemini + iTunes architecture intentionally.
