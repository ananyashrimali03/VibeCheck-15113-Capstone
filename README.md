# VibeCheck
**Context-aware music recommendations — no listening history required.**

VibeCheck reads passive signals from your browser (time of day, weather at your location, battery level, online status, and more), sends them to **Google Gemini** for mood inference, and surfaces matching tracks via **iTunes Search**.

**Live app:** https://vibecheck-15113-capstone.onrender.com/

---

## How it works

1. **Signal collection** — the browser gathers passive context: local time, weather (via Open-Meteo, if location is granted), battery level, network status, and your optional listening history stored on-device.
2. **Mood inference** — signals are packaged and sent to the `/api/infer` endpoint, which asks Gemini to produce a structured `InferenceResult` (mood tags, energy level, genre hints, a short vignette).
3. **Track retrieval** — the inferred tags drive an iTunes Search query. Full-length audio is resolved via **Piped** (public API); falls back to a YouTube embed.
4. **Re-read / Reshuffle** — re-collect signals for a fresh inference, or keep the same vibe and swap in new tracks.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| AI | Google Gemini (`@google/generative-ai`) |
| Music metadata | iTunes Search API |
| Full-length audio | Piped public API (no key required) |
| Weather | Open-Meteo (no key required) |
| Hosting | Render (Node web service) |

---

## Running locally

```bash
cp .env.example .env.local   # add GEMINI_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

**Required env var:**
- `GEMINI_API_KEY` — Google AI Studio key for live mood inference.

**Optional env vars:**
- `PIPED_API_BASES` — comma-separated Piped API hosts to use instead of the built-in public list (useful if default instances are slow or blocked).

If `GEMINI_API_KEY` is missing, the app loads with **fallback vignettes** (rotating placeholder copy + SoundHelix audio) so you can still click through the full UI.

---

## Key design decisions

- **No account, no OAuth.** Listening history is stored in `localStorage` and can be cleared from the footer.
- **Location is optional.** Granting it adds weather data to the signal packet; inference still runs without it (with a note in the payload).
- **Recommendations from context, not history.** The core premise: what you should hear right now is better predicted by *where you are and how you feel* than by what you played last week.
- **30s previews by default.** iTunes provides these freely. Full-length playback via Piped is attempted server-side before the client falls back to a YouTube embed.

---

## Deployment (Render)

| Setting | Value |
|---|---|
| Language | Node |
| Branch | main |
| Build command | `npm install; npm run build` |
| Start command | `npm run start` |
| Root directory | *(leave blank)* |
| Environment variables | `GEMINI_API_KEY` |

---

> Not a clinical or mental-health tool.
