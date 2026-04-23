# VibeCheck — Agent Implementation Spec

**Overview:** A mobile-first web app that passively collects browser/environment signals plus **listening context** (on-device preview history by default; optional Spotify/Last.fm stretch), calls Claude once to infer mood and produce playlist/search metadata, fetches playable tracks from Deezer, and surfaces results via in-app UI plus optional Web Notifications—aligned with the hackathon theme (creative amplification / meaning-making without forcing explicit mood input).

**Technical specification:** [`spec.md`](./spec.md) (APIs, prompts, validation, UI states, demo script).

### Can this ship in **1 hour** (single agent, one pass)?

**Not the entire spec.** The full document (all signals, weather edge cases, listening FIFO, notifications, handoff URLs) targets **~90–120+ minutes** for a polished path. A **deliberately cut “single-pass MVP”** (below) **is doable in about one hour** if the agent follows the cut list strictly and does not expand scope mid-build.

**Single-pass rule:** Implement **only** **§0.1** (table below) in the first PR/session; treat everything else in this file as **Phase 2**.

### 0.1 — 60-minute cut: what ships vs defer

| Ship in ~60 min | Defer (Phase 2) |
|-------------------|-----------------|
| Vite + React (or Next) SPA, mobile-first dark UI | Spotify / Last.fm OAuth |
| **Signals:** `collected_at_iso`, timezone, local time, day, `locale`, `navigator.onLine`, `visibility`, minimal `idle_ms_estimate` (timestamp-based), `ua_mobile` heuristic | Scroll/click counters, battery (unless free minutes remain) |
| **Weather:** Open-Meteo **only if** `getCurrentPosition` succeeds within ~5 s; else `weather_unavailable` and continue | Reverse geocode city name |
| **Claude:** one proxy route, `SignalsPacket` → strict JSON `InferenceResult`, generic safety line | Retry polish beyond one retry |
| **Deezer:** search → **4–6** tracks with previews; `<audio>` controls | Dedupe vs listening history |
| UI: loading → results → **Re-read** (15 s debounce) | Web Push, hourly timers, toast chrome |
| **Privacy:** short inline notice + Continue (no fancy modal) | Full settings |
| **Listening:** send `listening: { source: "local_app", recent_plays: [] }` always (**cold stub**) OR omit key | MVP-09 FIFO + Clear button |
| README: how to run, `ANTHROPIC_API_KEY`, honest limitations | music_handoff URLs |

**After the hour:** turn on **MVP-09** listening + Clear, then optional STR features.

### 0.2 — Agent execution order (single session, do not reorder)

1. Scaffold app + env example (`.env.example`: `ANTHROPIC_API_KEY`).
2. Implement `/api/claude` (or Vite middleware) forwarding to Anthropic Messages API.
3. Build minimal `SignalsPacket` collectors + Open-Meteo fetch behind geo.
4. Wire automatic cycle on load after privacy Continue.
5. Deezer search + results UI + audio.
6. Re-read + debounce + basic error UI.
7. README + quick manual test in browser.

### 0.3 — Recommended agent allocation *(project default)*

Use this table when assigning Cursor agents or parallel contributors.

| Scenario | Agents | Roles |
|----------|--------|--------|
| **~60 min single-pass** (§0.1 table) | **1** | One agent follows **§0.1–§0.2** only; simplest coordination, lowest merge risk. |
| **Full MVP + polish** (MVP-01 … MVP-09, stretch if time) | **2** *(recommended)* | **Agent A — Platform & AI:** scaffold, env, Claude proxy, `SignalsPacket` + weather/geo fallbacks, JSON validation/retry, shared types. **Agent B — UI & audio:** screens (privacy, loading, results), Deezer grid + playback, Re-read debounce, listening logger + Clear, README/demo copy. |
| **Large parallel push** | **3+** | Usually **not** worth it at this repo size—merge conflicts and duplicated assumptions exceed speed gains. Reserve for rare cases with a human merge owner. |

**Handshake (when using 2 agents):** Agent A lands **`POST /api/claude`** + exported **`SignalsPacket` / `InferenceResult` types** (or Zod schemas) first; Agent B imports those and does not redefine shapes. Integrate behind **`main`** with one short smoke test: privacy → cycle → preview plays.

## Implementation checklist

- [ ] **single-pass-60m** *(if timeboxed to ~1 hr)* — Follow **§0.1–§0.2** only: stub `listening`, minimal signals, skip OAuth / push / listening FIFO until Phase 2.
- [ ] **agents-2-full-mvp** *(if using two agents)* — Split per **§0.3**: A = proxy + signals + validation; B = UI + Deezer + listening UX; merge after shared types.
- [ ] **bootstrap-project** — Create/select project folder, scaffold React SPA with mobile-first layout and dark ambient theme placeholders.
- [ ] **signals-weather** — Implement SignalsPacket collectors (time, locale, visibility, idle, optional geo) + Open-Meteo/OpenWeather with graceful degradation and user-facing privacy notice.
- [ ] **claude-json** — Add Claude Messages call with strict JSON schema for InferenceResult + safety guardrails + server-side key handling.
- [ ] **deezer-player** — Implement Deezer search → track list w/ previews + outbound links; handle missing previews.
- [ ] **listening-history** — Persist **local** play history from in-app previews (cap N, `localStorage`); merge into `SignalsPacket.listening`; optional stretch: OAuth **Spotify** / **Last.fm** for richer history (see §4.4).
- [ ] **demo-ux** — Build ambient loading + results view + optional notification/in-app banner + README for judges.
- [ ] **stretch-hourly-push-handoff** *(optional)* — Hourly cadence beyond “tab open”: Web Push + service worker **or** native wrapper; notification actions **deep-link** into Spotify / Apple Music / YouTube Music (see section 15).

---

Use this document as the **source of truth** for scope, UX, APIs, data contracts, and demo. For a **~60 min single-pass**, follow **§0.1–§0.2** only. For a **1.5 hr hackathon**, extend to full MVP path + stretch where time allows.

---

## 1. Theme alignment (pitch-ready)

**One-liner:** “When AI handles routine work, what’s left is inner life—who we are. VibeCheck doesn’t ask you to explain yourself; it reads the room and gives you music + a tiny creative nudge so expression stays accessible.”

**How it maps to the prompt:**

- **Amplifies human creativity:** Each cycle outputs a **creative_nudge** (micro-act: hum, one line, scribble, breathe + listen)—not only music.
- **Meaning-making:** Music as emotional processing + metaphor framing (“weather metaphor”) turns raw state into something legible and human.
- **Equal access:** No intake forms, no “therapy workflow,” no assumption the user identifies as an artist—**ambient** and low friction.
- **Responsible framing:** Passive inference is **probabilistic**, not diagnostic; the product must never claim to know mental health status.

---

## 2. Product definition

### 2.1 Name and promise

- **Name:** VibeCheck
- **Promise:** “We don’t ask how you feel—we read the room and offer a playable moment.”

### 2.2 Non-goals (explicit)

- Not a clinical tool; **no MEDICAL_OR_THERAPEUTIC_CLAIMS** in copy.
- Not iOS native widget / Screen Time / HealthKit in MVP.
- Not guaranteed “accurate mind reading”—it’s **contextual inference**.

### 2.3 MVP user journey (must ship)

1. User opens the URL on mobile browser (Safari demo is the bar).
2. Screen shows **ambient loading**: “Reading the room…” with subtle motion (no forms).
3. App collects **SignalsPacket** (section 5) best-effort with graceful degradation, including **`listening`** from on-device history (previews played in-app) and optionally connected services later.
4. **Claude** returns structured JSON (**InferenceResult**, section 6).
5. **Deezer** returns **tracks + 30s preview URLs** using Claude’s **`deezer_search_query`** (section 7).
6. UI shows: **notification_line**, **weather_metaphor**, **mood_label**, mini player grid, **creative_nudge**, and “Re-read the room”.
7. Optional: request notification permission once; post a **Web Notification** with the evocative line + open focus.
8. Optional stretch: timer to re-run every **30 minutes** if page is open/visible (not a hard requirement if time is tight).

---

## 3. Tech stack constraints (fast ship)

### 3.1 Required

- **Single-page web app** (React recommended; vanilla is fine if faster for the team).
- **Claude API** (Messages API) with **strict JSON outputs** (`response_format` or prompt-enforced JSON).
- **Deezer public API** for search + previews: `https://api.deezer.com` (no OAuth for basic search in many environments; verify in net blockers).
- **OpenWeather** (free tier) for weather at coarse location OR **Open-Meteo** (no key) as zero-key fallback.

### 3.2 Client-side only in MVP

- Avoid building a backend **unless** you hit CORS/API key leakage issues. If you must, add a **tiny** proxy only for secrets (OpenWeather key, Claude key)—do not ship Claude key in public static hosting.

### 3.3 Secrets handling (critical)

- **Never** expose **Claude API key** in a public client bundle.
- Acceptable hackathon approaches (pick one):
  - **Dev server proxy** (Vite/Next API route) keeping the key server-side.
  - **Cursor/Cloud Agent** runtime with serverless function (if allowed).
  - **User-pasted API key** in UI (hacky but demo-safe if local-only) — only if judges allow; default should be **server-side proxy**.

---

## 4. Passive “Signal stack”

### 4.1 Signals to collect (priority order)

| Signal | Source | Inference (soft) | Reliability |
|--------|--------|------------------|-------------|
| **local_time + timezone + day_of_week** | `Date`, `Intl` | circadian vibe, weekday rhythm | High |
| **locale / language** | `navigator.language` | linguistic tone for outputs | Medium |
| **coarse geo** | Geolocation API → reverse geocode to **city** | contextual flavor | Medium (permission UX) |
| **weather** | OpenWeather/Open-Meteo using lat/lon | baseline atmosphere | Medium (needs key or alternative) |
| **idle_ms / last_interaction** | pointer/keyboard/touch timestamps | overstim vs stillness | Medium |
| **visibility / focused** | Page Visibility API | background doom-scroll vs foreground | Medium |
| **battery** | Battery Status API | “rushing/low power” heuristic | **Low on iOS Safari** (often unsupported) |
| **listening history (local)** | `localStorage` log of previews played **inside VibeCheck** | taste loop, repetition vs novelty | High once user has played tracks |
| **listening history (connected)** | Optional Spotify / Last.fm OAuth APIs | broad real-world taste | **Stretch** — auth + backend time |

### 4.2 Explicitly NOT in MVP

- Microphone / voice (user requested **no** expression input).
- Reading iPhone activity / screen time / health.

### 4.3 Privacy copy (must show once)

Short notice: location is used **only** to fetch local weather and approximate context; **no accounts** by default. **Local listening history** (tracks you play *in this app*) may be stored on-device to improve suggestions—**clear history** control in settings/footer. If you add **Connect Spotify / Last.fm**, disclose what is read and offer disconnect.

### 4.4 Listening history (how it feeds recommendations)

Use listening data as **soft bias** for Claude + Deezer—never the only signal.

| Mode | What we store | Hackathon fit |
|------|----------------|---------------|
| **A. Local (default)** | Each in-app preview play: `{ played_at_iso, deezer_track_id?, title, artist_name, genres[]?, duration_played_ms }`, capped (~20–40 entries, FIFO). | No login; privacy-friendly; improves after a few plays. |
| **B. Spotify (stretch)** | Recent tracks / top artists via Web API after user clicks **Connect**. | Needs OAuth redirect + **backend** for client secret; big demo payoff. |
| **C. Last.fm (stretch)** | `user.getRecentTracks` if user supplies username + you have API key server-side. | Lighter than Spotify if you already have a proxy. |

**Model behavior:** Claude uses history to steer `deezer_search_query` toward **adjacent** genres/moods (avoid repeating the same keywords every cycle) and to explain *why* this moment fits them—without claiming it “knows” their mental state.

---

## 5. Data contracts

### 5.1 `SignalsPacket` (input to Claude)

Fields (all optional except timestamps):

```json
{
  "collected_at_iso": "2026-04-18T23:43:00.000Z",
  "timezone": "America/New_York",
  "local_time_24h": "19:43",
  "day_of_week": "Saturday",
  "locale": "en-US",
  "geo": { "lat": 40.44, "lon": -79.99, "city": "Pittsburgh", "accuracy_m": 12000 },
  "weather": { "condition": "rain", "temp_c": 9, "wind_mps": 4 },
  "device": {
    "battery_percent": null,
    "charging": null,
    "online": true,
    "ua_mobile": true
  },
  "behavior": {
    "visibility": "visible",
    "idle_ms_estimate": 480000,
    "interaction_events_last_5m": { "scrolls": 42, "clicks": 6 }
  },
  "listening": {
    "source": "local_app",
    "recent_plays": [
      {
        "played_at_iso": "2026-04-18T23:40:00.000Z",
        "title": "Example Track",
        "artist_name": "Example Artist",
        "genres": ["ambient", "electronic"],
        "deezer_track_id": 123456789,
        "play_ratio": 0.85
      }
    ],
    "aggregate_hint": {
      "top_genres": ["ambient", "indie"],
      "notes": "optional short summary or empty if cold start"
    }
  },
  "limitations": ["battery_api_unavailable", "geolocation_denied", "listening_cold_start"]
}
```

### 5.2 `InferenceResult` (output from Claude)

```json
{
  "mood_label": "quietly exhausted",
  "confidence": 0.62,
  "weather_metaphor": "last candle before bed",
  "notification_line": "Low battery, late night—something soft.",
  "deezer_search_query": "ambient rainy night piano",
  "playlist_title": "Rain Glass / Warm Static",
  "playlist_vibe": "2–3 sentences, no copyrighted lyrics",
  "creative_nudge": "Listen to one track eyes closed; exhale matched to hi-hats.",
  "affirmation_line": "Non-cheesy, one sentence, permissive",
  "safety": {
    "distress_hint": false,
    "note": "If distress_hint true, UI shows gentle resources UI (section 9)"
  }
}
```

**Prompting rules for Claude:**

- Output **ONLY** JSON matching `InferenceResult`.
- **`deezer_search_query`** must be **short**, **English** unless `locale` suggests otherwise, and optimized for keyword search (genres/moods/instruments), not natural language paragraphs.
- Use **`listening`** when present: prefer **adjacent** or **complementary** directions vs repeating the exact same keywords as recent plays; if cold start (`listening.recent_plays` empty), ignore.
- Avoid naming real trademarked playlists; Deezer returns real tracks downstream.

---

## 6. Claude integration spec

### 6.1 Single-call MVP

- One Claude request per cycle: input `SignalsPacket` → output `InferenceResult`.

### 6.2 Safety guardrail (lightweight)

Include system instructions:

- Not therapy; encourage professional help if severe self-harm risk appears (based only on passive signals plus **optional aggregated listening summaries**—never invasive surveillance).
- Set `distress_hint` conservatively; default false.

### 6.3 Model selection

- Use a **fast** Claude model suitable for JSON generation on device-demo latency.

---

## 7. Deezer integration spec

### 7.1 Flow

1. Take `deezer_search_query`.
2. `GET https://api.deezer.com/search/track?q=<encoded>`
3. Pick **4–8** tracks with **`preview`** URL present.
4. UI lists: title, artist, **30s preview** player, link out to Deezer.

### 7.2 Failure modes

- No previews: show tracks without play, or rerun with alternate query terms (deterministic fallback list in code).

---

## 8. Notifications spec (optional but high demo value)

### 8.1 Permission UX

- After first successful inference, ask: “Notify me with a one-line vibe ping?” **Only if** `Notification` supported.

### 8.2 iOS Safari constraints (must document in README)

- Web Push requirements differ; **simple Notifications** may work when permitted, but reliability varies. MVP should **not** depend on notifications—**in-app banner** duplicates the same content.

---

## 9. Distress pathway (minimal)

If `distress_hint` is true OR heuristic triggers (optional): show static panel:

- “If you’re in crisis, contact local emergency services.”
- Provide region-agnostic wording; avoid collecting PII.

---

## 10. UI/UX requirements

### 10.1 Screens

- **Ambient collect:** full-bleed dark calm; status dots for signals collected (weather ok, geo denied, etc.).
- **Result:** hero **notification_line**, sub **weather_metaphor**, chips for **mood_label**, playlist title + vibe text, Deezer previews, **creative_nudge**, **affirmation_line**.
- **Controls:** “Re-read the room” triggers new cycle; debounce spam.

### 10.2 Accessibility

- Large tap targets; readable contrast; previews keyboard-focusable.

---

## 11. Observability / demo hardening

- Log **cycle_id**, signal collection errors, Claude latency, Deezer count — `console.table` fine.
- Offline mode message if `navigator.onLine === false`.

---

## 12. README for judges (short)

Include: what signals are used, privacy stance, limitations (not mind-reading), how to run, where keys go.

---

## 13. Time-boxed implementation order (90 minutes core)

1. Scaffold UI + signal collectors + degradation flags (20m)
2. Weather path (Open-Meteo no-key OR OpenWeather with proxy) (15m)
3. Claude JSON contract + parsing + error UI (20m)
4. Deezer search + preview grid (15m)
5. Polish: copy, skeleton UI, demo path, in-app “fake notification” banner (15m)
6. Stretch: periodic re-check + Web Notifications permission (remaining)

---

## 14. Acceptance criteria

- Opens on **iPhone Safari** with no user text input required.
- Produces playable **preview** audio in the majority case.
- Never claims clinical accuracy; shows limitations.
- Completes under ~5–8s typical on mobile (weather + Claude + Deezer).

---

## 15. Hourly OS notifications + “play in my music app” (feasibility)

This section answers: *Can we show a notification every hour that suggests music, use an LLM to read the room, and play from the notification without opening our app?*

### 15.1 What you can realistically ship

| Goal | Web (PWA / Safari) | Native app (iOS/Android) |
|------|-------------------|----------------------------|
| **LLM infers vibe from passive signals** | Yes (same `SignalsPacket` → Claude) | Yes |
| **Hourly nudge while your site is open** | Yes (`setInterval` / `alarm` / visible tab) | Yes (local notification scheduler) |
| **Hourly nudge when browser is closed / phone locked** | **Hard without a backend**: you need **push** from a server (or OS-specific workarounds users hate) | Feasible (local notifications; may need BG refresh for fresh signals) |
| **Tap notification → starts playback in Spotify / Apple Music** | **Partially**: you can put **deep links / universal links** on notification actions (best with a **service worker** + Web Push). The OS usually **opens** the music app or a URL; it does **not** guarantee “zero UI” like a system music player’s Now Playing controls. | **Best**: “Open in Spotify / Apple Music” buttons; actually **embedding** Spotify’s player in the shade is governed by Spotify/Apple APIs and user subscription. |
| **Play music from the notification shade with no app opening** | **Generally no** for a web app: browsers are not allowed to behave like Spotify for background audio from a random site without the user engaging. | **Sometimes**: native media sessions can show controls for **your** app’s audio; **starting** another vendor’s catalog from a notification usually = **handoff** via deep link (opens target app). |

**Plain-language takeaway:** Your vision matches **smart notifications + deep links into the user’s installed music app**. True “hit play on the shade with zero cold-open friction” is closest to **native + official music APIs / MusicKit / Spotify SDK**, not a 1.5 hr web artifact.

### 15.2 Recommended product shape (aligned with LLM “reading the room”)

1. **Inference stays the same:** passive signals → Claude → `InferenceResult` plus **music deep-link fields** (see 15.3).
2. **Notification content:** one evocative line + optional **actions**: `Play in Spotify`, `Play in Apple Music`, `Not now`.
3. **Deep links (expectation-set):** links **open** the provider app or web player; that is still “one tap from the shade” and demos well.
4. **Hourly cadence:**
   - **Hackathon-web MVP:** while the page is open / PWA foreground → schedule hourly re-read + local in-app banner (no OS dependency).
   - **“Even when closed” hourly:** add a **tiny backend** (cron + Web Push to subscribed clients) **or** defer to native.

### 15.3 Extend `InferenceResult` (optional fields for providers)

Add when you want OS-level handoff (LLM still picks *what* to suggest; your code maps to URLs):

```json
{
  "music_handoff": {
    "primary_query": "ambient rainy night piano",
    "spotify_url": "https://open.spotify.com/search/ambient%20rainy%20night%20piano",
    "apple_music_url": "https://music.apple.com/search?term=ambient%20rainy%20night%20piano",
    "youtube_music_url": "https://music.youtube.com/search?q=ambient+rainy+night+piano"
  }
}
```

**Important:** Prefer **search** URLs or **IDs** resolved from Deezer/ISRC crosswalk if you later add metadata—copyright/attribution stays honest. For a hackathon, **search terms** from Claude are acceptable if you label them “suggested listen” not “official playlist.”

### 15.4 Notification implementation notes (web)

- **Web Push** requires **user permission**, **service worker**, and usually a **push service** (or your server) to enqueue hourly messages.
- **iOS Safari** added Web Push in recent versions but behavior and reliability differ; keep a **fallback in-app banner** for the demo.
- **Do not promise** OS-level playback controls for third-party catalogs unless integrated via official APIs.

### 15.5 Privacy / creepiness guardrail

Hourly proactive suggestions can feel invasive. Ship with: **quiet hours**, **max nudge frequency**, easy **disable**, and copy that explains signals used (even if passive).

### 15.6 Hackathon demo slice (matches “show the idea,” not full OS integration)

You said the **north star** is closer to *playback without bouncing between apps*, but for a **demo** you mainly need one vertical slice that proves: **signals → LLM → music suggestion → user hits play**.

**Fastest credible demo path (web):**

1. Keep **passive `SignalsPacket` → Claude → `InferenceResult`** as the “brain.”
2. Keep **Deezer previews** as the actual **Play** affordance (30s clips play **inside your web app**—no Spotify login required).
3. Optional “notification-like” polish that still demos well:
   - Use an **in-app banner / toast** styled like a notification with **Play preview** (instant judge comprehension).
   - Or request **Web Notifications** where supported; on tap, **focus the tab/PWA** and **auto-start** the first preview (`Audio` element `.play()`). This is not identical to native shade playback, but reads as “tap → music starts” for a hackathon story.

**What you explicitly defer in the pitch (honest judge framing):**

- **True OS-handoff “Play”** that starts Spotify/Apple Music **from the collapsed shade without opening our experience** requires **native**, **partner APIs**, and OAuth flows—outside a 1.5 hr web scope.
- Your README one-liner can still describe the **full vision** (hourly ambient companion + provider handoff), while the demo proves the **differentiated LLM layer** and a **real Play interaction** via previews.

---

## Optional repo layout

When you create a dedicated project repo, you may also copy this file to `docs/VIBECHECK_SPEC.md` and link it from the project README.
