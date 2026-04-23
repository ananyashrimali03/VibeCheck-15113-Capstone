# Claude Prompt Log — VibeCheck Project

---

## [1] Initial Project Setup & Planning

> Go through the whole project plan and spec and all the files once and understand the project first
> what the project is about: I am building a web based extension where a notification pop up will happen. the application tries to predict the mood of the user based on different sources and combines it and then passes it through the LLM (I want to add a gemini api key and integrate it) and then the LLM gives a music recommendation by interpreting the mood and then give a music recommendation. I need to have a music api which is free and easy to integrate tell me the steps and I will get the api key and we will integrate it. tell me exact steps to get the api key. you pick the best option for me (I was thinking of sound cloud api). it should be easy and free and I want the whole flow to work end to end and that is my first priority
>
> Create a .env file for the api keys and fetch from there. you are a senior developer. think about the code end to end working but keep the code simple and not complicate it unnecessary. keep it easy and simple
>
> I want to go step by step as and go to the next step after the current step is completely working
>
> I have the api key for gemini LLM already I will paste it in the env file which you will create
>
> Added a screenshot of what I am seeing in the soundcloud api creating what do i need to enter for the website field?
>
> Also, Much of the code is already written so take care that you are not changing the already written code. I want you to create a new branch and write all the code there
>
> make sure everything is working without errors and the whole flow is integrated and working
>
> If you have questions take info from reference if unclear then ask me directly
>
> I dont want to make a complicated app but want to keep it simple but working
>
> Go step by step and lets make everything working locally first
> create a requirements.txt file i assume it should be required. go step by step after each step is running properly we will go to next step

---

## [2] API Key Pasted

> done pasted

*(Gemini API key added to `vibecheck/.env.local`)*

---

## [3] Hydration Error Report

> Got this error
> A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:
> - A server/client branch `if (typeof window !== 'undefined')`.
> - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.
> ...
>
> what is this. the app still works, i dont know the issue

---

## [4] Additional Gemini API Info

> curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent" \
>   -H 'Content-Type: application/json' \
>   -H 'X-goog-api-key: ' \
>   -X POST \
>   -d '{ "contents": [{ "parts": [{ "text": "Explain how AI works in a few words" }] }] }'
>
> this is what i have created and added the api key to give you more information about connecting the LLM and models

---

## [5] Push to Collaborator Repo

> push the changes to the new branch and dont merge to main just push to a new branch in remote

---

## [6] Collaboration Question

> If I want to collaborate to the current project https://github.com/ananyashrimali03/MoodMusic_Notification-Popping-Recommendation
> can I just add my things here to a new branch I would want to do that

---

## [7] Push to Own Repo

> Okay scrpt that git plan
> Just simply push my changes here
> git remote add origin https://github.com/Ashay041/music-recommendation.git
> git branch -M main
> git push -u origin main

---

## [8] UI / layout (recent)

> rather than making the boxes wide, could you rearrange in a decent proportion maybe go side by side

---

## [9] Mood-themed UI

> can you update the ui of the app based on the vibes? keep the basic style same but update the colors filters, and make little changes in the aesthetic to update along with the reading the room based on same inputs

---

## [10] Player: auto-play on skip

> when i hit the next song, auto-start it and dont wait for me to push the play buutton

---

## [11] Vibe profile, quiz, and recommendations

> can you add an account option and lets the user to create a name and about then info, ask a quiz to understand the person's vibe better and let the app remember it for all the time. and take that info for recommendation too and then based on that mainly recommend songs for teh date time location weather environmental vibe etc. ask interesting questions to know the persons's vibe in the quiz. also ask mbti, zodiac etc. and fun this or that, quick mcqs to understand what the person is like.

---

## [12] Prompt log maintenance

> update all my new prompts to prompt log

---

## [13] Plan requirements review (`review.md`)

> You are a senior software and QA QC engineer. hwlp me review the app based on the plan's requirements and generate a review.md document. dont update anything in the app itself for now

**Deliverable:** [`review.md`](./review.md) — traceability vs [`plan.md`](./plan.md) / [`spec.md`](./spec.md); executive summary; matrices; critical findings (Claude vs Gemini, Deezer vs iTunes, theme, docs drift).

---

## [14] Review.md — functioning vs literal plan

> tell in the review.md whether or not the app is functioning as required or not, despite not selecting the exact aestheric features and APIs suggested in the plan

**Intent:** Separate **product behavior** (signals → LLM → playable previews, privacy, Re-read, listening) from **letter-of-plan** compliance (named APIs, track counts, dark UI, README).

**Updated in:** [`review.md`](./review.md) — section *“Is the app functioning as required? (behavior vs. exact plan)”* and summary table.

---

## [15] Input QC report (`input-qc-report.md`)

> can you run another quality check on the inputs being considered properly in determining the mood as well as picking the recommendation. Create an input QC report. You are a senior engineer

**Deliverable:** [`input-qc-report.md`](./input-qc-report.md) — end-to-end input flow, field-by-field QC (signals → inference → iTunes query → tracks), gaps (idle, listening genres, fallback scenes), verdict tables, hardening suggestions.

---

## [16] Apple Music — open app / play

> when i hit the playy in apple music button can it just open apple music and start playing without having to hit play another time?

**Outcome:** Native deep links (`music://`, `itms://`) via [`lib/apple-music-open.ts`](./lib/apple-music-open.ts); wired in toast + track list. OS/browser still control autoplay.

---

## [17] Meaning of UI chips / Creative nudge (Ask mode)

> what does the confidence and the other buttons tell exactly?
>
> what is creative nudge

*(Answered in chat; no code change.)*

---

## [18] Reshuffle — truly new trio

> when i reshuffle it only reshuffle the existing visible tracks, it should update the three tracks to new songs

**Outcome:** `/api/music` gains `exclude` + wider iTunes sourcing; client sends `vary`, `cache: 'no-store'`, `tracksRef` for stale closure fix.

---

## [19] Song suggestions — diversity & freshness

> its not really updating… flexible range… updated on reshuffle and re read… new songs which havent been shown before

**Outcome:** [`lib/shown-tracks-storage.ts`](./lib/shown-tracks-storage.ts) (local remembered iTunes ids), merged exclude on re-read + reshuffle, **`expandCandidatePool`** (multi-query iTunes merge), footer **Reset suggested-song memory**, infer prompt rule to **vary `deezer_search_query`** across reads.

---

## [20] Prompt log maintenance (this file)

> update prompt log

**Note:** Entries [16]–[20] and the **Production Gemini prompts** / **Non-LLM** sections below were synced with the repo (infer route, music route, shown-tracks storage, Apple Music helper).

---

## Production Gemini prompts (`app/api/infer/route.ts`)

**Model:** `gemini-flash-latest`  
**Request shape:** `generateContent([{ text: SYSTEM_PROMPT }, { text: buildPrompt(signals) }])`

### System prompt (`SYSTEM_PROMPT`)

```
You are VibeCheck, a mood-reading system that recommends music based on passive signals about a user's current moment. You receive a JSON signals packet and must return a single JSON object describing the user's mood and a music recommendation. No markdown, no explanation — only raw JSON.

Return exactly this shape:
{
  "mood_label": "two-word mood phrase, lowercase (e.g. 'quiet focus', 'sunlit ease')",
  "confidence": 0.0 to 1.0,
  "weather_metaphor": "short sensory image, 3-6 words, no full stop",
  "notification_line": "poetic headline, 8-14 words, captures the moment",
  "signals_used_for_read": "one sentence explaining which signals shaped the read",
  "deezer_query_why": "one sentence explaining why the search keywords fit the mood",
  "moment_arc": "one sentence on how headline + metaphor + nudge form a coherent moment",
  "deezer_search_query": "3-7 keywords for iTunes search — see rules below",
  "playlist_title": "Title / Subtitle format, evocative",
  "playlist_vibe": "2-3 sentences describing the feeling of the playlist, not genre labels",
  "creative_nudge": "one small, specific, physical action the user can take right now",
  "affirmation_line": "one brief affirming sentence",
  "safety": { "distress_hint": false, "note": "" }
}

Music search rules for "deezer_search_query" (still maps to the vibe above — only the retrieval style changes):
- Aim for recognizable hit songs by famous mainstream artists (major-label pop, rock, hip-hop, dance, alt).
  Prefer queries that combine a real artist name and/or a well-known song title that fits the mood.
  For iTunes variety: favor genre + era + vibe + "hits" / "radio" style queries (e.g. "2010s summer pop radio hits", "arena rock anthems 2000s") so results mix multiple stars — avoid queries that are only one artist name, which often returns several tracks by the same person.
  Examples of good directions (not literal templates): upbeat daylight → sunny pop hits; night energy → arena rock or chart electronic; introspective → famous ballads or acoustic singles by household-name artists.
- Across separate reads of the user's signals, deliberately vary deezer_search_query wording (rotate decades 1990s–2020s, alternate lanes like pop vs rock vs r&b vs dance vs indie, alternate phrasing like hits/radio/anthems/essentials/best of) whenever the mood still fits — avoid emitting the exact same keyword string on every inference so the catalog can surface different artists and eras.
- Do NOT steer searches toward study music, focus/lofi playlists, ambient beds, meditation, royalty-free, or generic instrumental background unless distress handling explicitly warrants something very gentle — and even then prefer a famous tender ballad over spa/ambient keywords.
- Avoid words like: study, lofi, ambient, instrumental (unless naming a specific famous song), focus music, concentration, background, cafe sleep playlist.

If signals suggest emotional distress, set distress_hint to true and add a brief note. Keep tone warm, non-clinical, non-prescriptive.

Time and weather (read the signals literally):
- collected_at_iso is UTC for ordering/debugging only — do NOT use it to infer the user's local time of day (it will mislead you vs their real clock).
- For morning/afternoon/evening/night language, rely on local_time_24h, local_hour_24, local_time_period, timezone, and day_of_week. Treat local_time_period as the canonical bucket (e.g. 18:23 → evening, not afternoon).
- Hard rule for visible text: In mood_label, notification_line, and weather_metaphor, your time-of-day words MUST match local_time_period. If local_time_period is "evening", never use "afternoon", "midday", or "noon"; use evening/dusk/twilight/night-adjacent imagery. If "afternoon", do not say evening or morning for the clock. This overrides poetic habit and any vibe_profile wording.
- Current weather in object "weather" is from Open-Meteo at geo lat/lon when present; match metaphors to condition, temp_c, and wind. If weather is absent, note limitations in signals_used_for_read and do not invent conditions.

When the JSON includes "vibe_profile" (long-term taste & personality self-report from the same device):
- Treat it as the primary prior for what kinds of songs and energies this person likes — especially for deezer_search_query, playlist_vibe, and playlist_title.
- Blend it with live signals (local time, weekday, weather, battery/idle, listening history): the moment still matters, but the profile should steer genre lean, era bias, social vs introspective edge, and lyrical vs production-first taste.
- Mention in signals_used_for_read how live context and profile combined (one sentence).
- If vibe_profile is missing or empty, rely on live signals only (same as before).
- vibe_profile must not override local_time_period for clock/circadian wording — profile is taste; local_time_period is the actual local clock bucket.
```

### User message (`buildPrompt(signals)`)

Built at runtime. Always includes:

1. Intro line: *Here are the user's current signals (JSON). The packet may include "vibe_profile" with name, about, MBTI/zodiac self-reports, and quiz answers.*

2. **Circadian alignment block** (always):

   `REQUIRED alignment: local_time_period is "<period>" at local clock <local_time_24h> (<timezone>). All mood_label, notification_line, and weather_metaphor wording for time-of-day MUST fit "<period>" — if period is evening, do not write "afternoon" or "midday".`

3. **`JSON.stringify(signals, null, 2)`** — full `SignalsPacket` (time, timezone, geo, weather, device, behavior, listening, limitations, optional **`vibe_profile`**).

4. **Optional profile hint** — if `signals.vibe_profile.summary_for_model` is set, append:

   ```
   Vibe profile summary (weight heavily for recommendations):
   <summary_for_model>
   ```

5. Closing instruction: *Read the mood and return the JSON object. For deezer_search_query, use keywords that will surface chart-level artists and famous songs on iTunes (no study/ambient/background-style queries), tuned to BOTH the live moment and the long-term vibe profile when present.*

### Client-assembled profile text (not sent as its own LLM call)

`lib/vibe-profile-storage.ts` → **`buildProfilePacket()`** turns saved name, about, MBTI, zodiac, this-or-that picks, and MCQ answers into **`summary_for_model`** and **`preference_notes`**, which are embedded in `signals.vibe_profile` for the infer route.

### Non-LLM “prompting”

- **`lib/vibe-theme.ts`** — keyword buckets map inference text to UI CSS variables (no Gemini).
- **Music API** (`app/api/music/route.ts`) — multiple merged iTunes Search queries per request (`expandCandidatePool`: base query + paraphrases like hits/radio/chart, `popular …`, `best songs …`, etc.); optional `exclude` (comma-separated track ids); `vary` seeds shuffle / diversity scoring (mulberry32); genre/decade/album-aware **`pickDiverseTracks`**; optional YouTube/Piped full playback via **`resolveFullPlayback`**. No LLM.
- **`lib/shown-tracks-storage.ts`** — client persists seen iTunes track ids; **`formatExcludeParam`** caps list length for URLs; pairs with UI **Reset suggested-song memory**.

---
