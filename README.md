# VibeCheck

**Context-aware music picks:** passive signals from the browser → **Gemini** produces a structured **`InferenceResult`** → **iTunes Search** for tracks (optional **YouTube** embeds for full-length playback when `YOUTUBE_API_KEY` is set).

Specs and planning: **[`plan.md`](./plan.md)** and `spec.md`

## Testing the product

1. Copy **`.env.example`** to **`.env.local`** and add **`GEMINI_API_KEY`** (required for live mood reads). Optional: **`YOUTUBE_API_KEY`** for in-app full songs via YouTube embeds.
2. Run **`npm install`** then **`npm run dev`** and open **http://localhost:3000**.
3. Complete consent, choose **Allow location** or **Not now** (location feeds Open-Meteo weather into the signal packet).
4. Use **Re-read the room** and **Reshuffle** to exercise signal collection, inference, and track retrieval.

If Gemini isn’t configured, the app still loads using **fallback vignettes** (rotating placeholder copy + SoundHelix audio) so testers can click through the UI.

## Features
Recommendations are being done from external factors rather than music history. So, I'm proud of the creative and (maybe) better recommendations.  

## Setup

```bash
cd music-recommendation-main   # or your clone folder name
copy .env.example .env.local   # Windows — or cp on macOS/Linux
```

Edit `.env.local`:

```bash
GEMINI_API_KEY=your_key_here
# Optional:
YOUTUBE_API_KEY=your_youtube_data_api_key
```

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## For testers

- **No Spotify OAuth**; listening history is stored **on-device** in `localStorage` (clear in footer).
- **Location** improves weather context (Open-Meteo); inference still runs if you skip it, with limitations noted in the signal payload.
- **Music:** iTunes supplies **~30s previews**. The server resolves **full-length** playback by default: it looks up the track on **Piped** (public API hosts) for a **direct audio stream**, or falls back to a **YouTube embed**. Optional **`YOUTUBE_API_KEY`** is tried first for video ID lookup. Set **`PIPED_API_BASES`** (comma-separated) if the default instances are slow or blocked.
- **Not** a clinical or mental-health tool.
