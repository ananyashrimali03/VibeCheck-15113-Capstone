"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearListeningHistory,
  loadListeningHistory,
  recordPreviewListen,
} from "@/lib/listening";
import { VibeAccountModal } from "@/components/VibeAccountModal";
import { VibeDesktopToast } from "@/components/VibeDesktopToast";
import { VibePlayerWidget } from "@/components/VibePlayerWidget";
import { postVibeOsNotification } from "@/lib/os-notification";
import { readStoredGeo, writeStoredGeo } from "@/lib/geo-storage";
import { collectSignals } from "@/lib/signals";
import {
  buildProfilePacket,
  hasMeaningfulProfile,
  loadVibeProfile,
  type VibeProfileStored,
} from "@/lib/vibe-profile-storage";
import { appleMusicDeepLink } from "@/lib/apple-music-open";
import {
  clearShownTrackIds,
  formatExcludeParam,
  loadSeenTrackIds,
  recordShownTrackIds,
} from "@/lib/shown-tracks-storage";
import { resolveVibeTheme } from "@/lib/vibe-theme";
import type { DeezerTrack, InferenceResult } from "@/lib/types";

const PRIVACY_KEY = "vibecheck_privacy_ok_v2";

type GeoSetup = "idle" | "pending" | "done";
const DEBOUNCE_MS = 15_000;

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [privacyOk, setPrivacyOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [musicBusy, setMusicBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [inference, setInference] = useState<InferenceResult | null>(null);
  const [tracks, setTracks] = useState<DeezerTrack[]>([]);
  const [lastRun, setLastRun] = useState<number>(0);
  const [online, setOnline] = useState(true);
  const [listeningCount, setListeningCount] = useState(0);
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [toastOpen, setToastOpen] = useState(false);
  const [playSignal, setPlaySignal] = useState(0);
  const [geoSetup, setGeoSetup] = useState<GeoSetup>("idle");
  const [geoRequesting, setGeoRequesting] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [storedProfile, setStoredProfile] = useState<VibeProfileStored | null>(null);

  /** 0 until first pointer/key event; avoids impure Date.now() during render. */
  const lastInteract = useRef(0);
  /** Tracks which song ids finished playing (audio ended) in the current queue — for auto-reshuffle. */
  const playedThroughRef = useRef<Set<number>>(new Set());
  /** Latest tracks for runCycle (callback has stable deps — avoids stale [] for exclude on re-read). */
  const tracksRef = useRef<DeezerTrack[]>([]);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  const touchActivity = useCallback(() => {
    lastInteract.current = Date.now();
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      const ok = window.localStorage.getItem(PRIVACY_KEY) === "1";
      setPrivacyOk(ok);
      if (ok) {
        setGeoSetup(readStoredGeo() ? "done" : "pending");
      }
      setListeningCount(loadListeningHistory().length);
      setStoredProfile(loadVibeProfile());
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    const syncOnline = () => setOnline(typeof navigator !== "undefined" && navigator.onLine);
    syncOnline();
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const w = () => touchActivity();
    window.addEventListener("pointerdown", w, { passive: true });
    window.addEventListener("keydown", w);
    return () => {
      window.removeEventListener("pointerdown", w);
      window.removeEventListener("keydown", w);
    };
  }, [touchActivity]);

  const runCycle = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const cycleId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : String(Date.now());

      const interactAt = lastInteract.current || Date.now();
      const idleMs = Date.now() - interactAt;
      const signals = await collectSignals(idleMs);
      const profileStored = loadVibeProfile();
      const inferPayload =
        profileStored && hasMeaningfulProfile(profileStored)
          ? { ...signals, vibe_profile: buildProfilePacket(profileStored) }
          : signals;

      const inferRes = await fetch("/api/infer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inferPayload),
      });
      if (!inferRes.ok) throw new Error(`Inference failed: ${inferRes.status}`);
      const result = (await inferRes.json()) as InferenceResult & { _source?: string };

      const qSearch = result.deezer_search_query?.trim();
      if (!qSearch) throw new Error("No search keywords from inference");

      const nonce =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const musicQs = new URLSearchParams({
        q: qSearch,
        vary: nonce,
      });
      const excludeStr = formatExcludeParam(
        new Set([
          ...loadSeenTrackIds(),
          ...tracksRef.current.map((t) => t.id),
        ])
      );
      if (excludeStr) musicQs.set("exclude", excludeStr);

      const musicRes = await fetch(`/api/music?${musicQs.toString()}`, {
        cache: "no-store",
      });
      if (!musicRes.ok) throw new Error(`Music search failed: ${musicRes.status}`);
      const list = (await musicRes.json()) as DeezerTrack[];

      console.table({
        cycle_id: cycleId,
        source: result._source ?? "live",
        mood: result.mood_label,
        tracks: list.length,
      });

      setInference(result);
      recordShownTrackIds(list.map((t) => t.id));
      setTracks(list);
      setActiveTrackIndex(0);
      setLastRun(Date.now());
      setToastOpen(true);

      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        postVibeOsNotification({
          body: result.notification_line,
          icon: list[0]?.album?.cover_medium,
          tag: `vibe-${cycleId}`,
        });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!privacyOk || geoSetup !== "done") return;
    queueMicrotask(() => void runCycle());
  }, [privacyOk, geoSetup, runCycle]);

  void tick;
  /* Wall-clock cooldown; tick re-runs render every 1s. */
  const cooldownLeft =
    lastRun === 0 ? DEBOUNCE_MS : Math.max(0, DEBOUNCE_MS - (Date.now() - lastRun)); // eslint-disable-line react-hooks/purity -- countdown

  const canReread =
    !loading &&
    cooldownLeft === 0 &&
    privacyOk &&
    hydrated &&
    !!inference;

  const navigateTrack = useCallback((delta: -1 | 1) => {
    setActiveTrackIndex((i) => {
      const len = tracks.length;
      if (len === 0) return 0;
      return (i + delta + len) % len;
    });
  }, [tracks.length]);

  const onPreviewPlay = useCallback((t: DeezerTrack) => {
    recordPreviewListen({
      deezer_track_id: t.id,
      title: t.title,
      artist_name: t.artist.name,
    });
    setListeningCount(loadListeningHistory().length);
  }, []);

  const handleClearListening = useCallback(() => {
    clearListeningHistory();
    setListeningCount(0);
  }, []);

  const handleClearSuggestedMemory = useCallback(() => {
    clearShownTrackIds();
  }, []);

  const acceptPrivacy = () => {
    window.localStorage.setItem(PRIVACY_KEY, "1");
    setPrivacyOk(true);
    setGeoSetup(readStoredGeo() ? "done" : "pending");
  };

  const allowLocation = useCallback(() => {
    touchActivity();
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoSetup("done");
      return;
    }
    setGeoRequesting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        writeStoredGeo({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy,
        });
        setGeoSetup("done");
        setGeoRequesting(false);
      },
      () => {
        setGeoSetup("done");
        setGeoRequesting(false);
      },
      { enableHighAccuracy: false, timeout: 25_000, maximumAge: 600_000 }
    );
  }, [touchActivity]);

  const skipLocation = useCallback(() => {
    touchActivity();
    setGeoSetup("done");
  }, [touchActivity]);

  useEffect(() => {
    playedThroughRef.current.clear();
  }, [tracks]);

  const handleToastPlayInApp = useCallback(() => {
    setPlaySignal((n) => n + 1);
    requestAnimationFrame(() => {
      document
        .getElementById("vibe-player-widget")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const reshuffleTracks = useCallback(
    async (opts?: { autoPlay?: boolean }): Promise<boolean> => {
      touchActivity();
      const query = inference?.deezer_search_query?.trim();
      if (!query) return false;
      if (tracks.length === 0) return false;

      setMusicBusy(true);
      setErr(null);
      try {
        const excludeStr = formatExcludeParam(
          new Set([...loadSeenTrackIds(), ...tracks.map((t) => t.id)])
        );
        const qs = new URLSearchParams({
          q: query,
          vary:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        });
        if (excludeStr) qs.set("exclude", excludeStr);
        const musicRes = await fetch(`/api/music?${qs.toString()}`, {
          cache: "no-store",
        });
        if (!musicRes.ok) throw new Error(`Music search failed: ${musicRes.status}`);
        const list = (await musicRes.json()) as DeezerTrack[];
        if (list.length > 0) {
          recordShownTrackIds(list.map((t) => t.id));
          setTracks(list);
          setActiveTrackIndex(0);
          if (opts?.autoPlay) setPlaySignal((n) => n + 1);
          return true;
        }
        return false;
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Reshuffle failed");
        return false;
      } finally {
        setMusicBusy(false);
      }
    },
    [touchActivity, inference?.deezer_search_query, tracks]
  );

  const onTrackEndedQueue = useCallback(
    (ended: DeezerTrack) => {
      playedThroughRef.current.add(ended.id);
      const allPlayed =
        tracks.length > 0 && tracks.every((tr) => playedThroughRef.current.has(tr.id));
      if (!allPlayed || !inference?.deezer_search_query?.trim()) return false;

      void reshuffleTracks({ autoPlay: true }).then((ok) => {
        if (!ok) playedThroughRef.current.delete(ended.id);
      });
      return true;
    },
    [tracks, inference?.deezer_search_query, reshuffleTracks]
  );

  const canReshuffle =
    !loading &&
    !musicBusy &&
    privacyOk &&
    hydrated &&
    !!inference &&
    tracks.length >= 1;

  const vibeTheme = useMemo(
    () => (inference ? resolveVibeTheme(inference) : null),
    [inference]
  );

  const shellStyle = useMemo(() => {
    if (!vibeTheme) {
      return {
        backgroundColor: "#fff8f0",
        backgroundImage:
          "radial-gradient(ellipse 120% 80% at 50% -20%, rgba(232,93,142,0.08), transparent)",
      } as const;
    }
    return {
      ...vibeTheme.vars,
      backgroundColor: "var(--vc-page-bg)",
      backgroundImage: `radial-gradient(ellipse 120% 80% at 50% -20%, var(--vc-radial), transparent), radial-gradient(ellipse 90% 55% at 100% 0%, var(--vc-radial-2), transparent)`,
    } as const;
  }, [vibeTheme]);

  return (
    <div
      className="relative min-h-screen text-neutral-900 transition-[background-color] duration-700 ease-out"
      style={shellStyle}
      data-vibe-theme={vibeTheme?.id ?? undefined}
    >
      {vibeTheme ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[1]"
          style={{
            opacity: 0.26,
            background:
              "radial-gradient(ellipse 90% 55% at 50% 108%, var(--vc-radial), transparent)",
            filter: "saturate(var(--vc-saturate)) hue-rotate(var(--vc-hue-rotate))",
          }}
        />
      ) : null}

      {hydrated && inference && (
        <VibeDesktopToast
          open={toastOpen}
          onDismiss={() => setToastOpen(false)}
          headline={inference.notification_line}
          subline={
            [inference.mood_label, inference.weather_metaphor]
              .filter(Boolean)
              .join(" · ") || undefined
          }
          track={tracks[activeTrackIndex] ?? tracks[0] ?? null}
          onPlayInApp={handleToastPlayInApp}
          themeVars={vibeTheme?.vars}
          onOsEnabled={() => {
            postVibeOsNotification({
              body: "Desktop alerts are on — you’ll see a system ping when we finish reading the room.",
              tag: "vibecheck-alerts-enabled",
            });
          }}
        />
      )}

      <VibeAccountModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        onSaved={() => setStoredProfile(loadVibeProfile())}
      />

      <main className="relative z-10 mx-auto flex min-h-full w-full max-w-7xl flex-col px-5 pb-20 pt-8 sm:px-8 lg:px-12 lg:pt-10">
        {!online && (
          <div className="mb-6 rounded-2xl border-2 border-black bg-[#ffe8e0] px-4 py-3 text-sm text-neutral-900 shadow-[4px_4px_0_0_#000]">
            You’re offline — mood text may still load from cache; music search and streams need internet.
          </div>
        )}
        {!(inference && tracks.length > 0) && (
          <header className="mb-10 rounded-2xl border-2 border-black bg-[#fff4d6] px-6 py-6 shadow-[6px_6px_0_0_#000] sm:px-8 lg:rounded-3xl lg:px-10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e85d8e]">
              VibeCheck
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 lg:text-3xl">
              Reading the room.
            </h1>
            {!inference && (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-700 lg:text-base">
                Collecting signals and reading your vibe with Gemini…
              </p>
            )}
          </header>
        )}

        {!hydrated && (
          <p className="py-24 text-center text-sm text-neutral-600">Loading…</p>
        )}

        {hydrated && !privacyOk && (
          <div className="mx-auto w-full max-w-2xl rounded-2xl border-2 border-black bg-[#d8f8ee] p-6 shadow-[6px_6px_0_0_#000] sm:p-8 lg:max-w-3xl lg:rounded-3xl">
            <p className="text-sm leading-relaxed text-neutral-800">
              VibeCheck reads signals from <strong className="font-semibold text-neutral-900">this device</strong>{" "}
              (local date &amp; time, timezone, language, battery when available, tab activity, on-device listening
              history) and uses <strong className="font-semibold text-neutral-900">Gemini</strong> to infer your mood
              and match music via iTunes. You can allow location next for live weather (Open-Meteo). Playback can use
              full-length YouTube embeds when <span className="font-medium">YOUTUBE_API_KEY</span> is configured
              server-side. Preview listens are logged <strong className="font-semibold text-neutral-900">only on this device</strong>{" "}
              — clear anytime in the footer. No server account — optional vibe profile saved only in this browser.
            </p>
            <button
              type="button"
              onClick={acceptPrivacy}
              className="mt-4 w-full rounded-2xl border-2 border-black bg-[#ffb8d9] px-4 py-3 text-sm font-semibold text-neutral-900 shadow-[4px_4px_0_0_#000] transition hover:bg-[#ffa3cf] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_0_#000]"
            >
              Continue
            </button>
          </div>
        )}

        {hydrated && privacyOk && geoSetup === "pending" && (
          <div className="mx-auto w-full max-w-2xl rounded-2xl border-2 border-black bg-[#e8deff] p-6 shadow-[6px_6px_0_0_#000] sm:p-8 lg:max-w-3xl lg:rounded-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-700">Location &amp; weather</p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-800">
              Allowing location lets VibeCheck pull <strong className="font-semibold text-neutral-900">approximate coordinates</strong>{" "}
              so we can add current conditions from Open-Meteo (free, no key) to your vibe read. Time, timezone, and
              device hints are already collected without this permission.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={geoRequesting}
                onClick={allowLocation}
                className="flex-1 rounded-2xl border-2 border-black bg-[#c8f5e5] px-4 py-3 text-sm font-semibold text-neutral-900 shadow-[4px_4px_0_0_#000] transition enabled:hover:bg-[#b3efd9] disabled:opacity-60"
              >
                {geoRequesting ? "Waiting for browser…" : "Allow location"}
              </button>
              <button
                type="button"
                disabled={geoRequesting}
                onClick={skipLocation}
                className="flex-1 rounded-2xl border-2 border-black bg-white px-4 py-3 text-sm font-semibold text-neutral-900 shadow-[4px_4px_0_0_#000] transition enabled:hover:bg-[#faf5eb] disabled:opacity-60"
              >
                Not now
              </button>
            </div>
          </div>
        )}

        {hydrated && privacyOk && geoSetup === "done" && loading && !inference && (
          <div className="flex flex-col items-center gap-4 py-20">
            <div className="h-12 w-12 animate-pulse rounded-full border-2 border-black bg-[#bfefff]" />
            <p className="text-sm font-medium text-neutral-700">
              Reading the room with Gemini…
            </p>
          </div>
        )}

        {err && (
          <div className="rounded-2xl border-2 border-black bg-[#ffd4d4] px-4 py-3 text-sm text-neutral-900 shadow-[4px_4px_0_0_#000]">
            {err}
          </div>
        )}

        {inference && (
          <section className="space-y-10 lg:space-y-12">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 border-b border-neutral-900/15 pb-6 sm:flex-row sm:items-start sm:justify-between lg:pb-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--vc-accent)]">
                  VibeCheck
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-neutral-900 lg:text-2xl">
                  {storedProfile?.display_name?.trim()
                    ? `${storedProfile.display_name.trim()}'s session`
                    : "Your session"}
                </h2>
                <button
                  type="button"
                  onClick={() => setAccountOpen(true)}
                  className="mt-3 inline-flex items-center rounded-xl border-2 border-black bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 shadow-[3px_3px_0_0_#000] transition hover:bg-[#fff4d6] sm:text-sm"
                >
                  Vibe profile
                  {storedProfile && hasMeaningfulProfile(storedProfile) ? (
                    <span className="ml-2 rounded-full bg-[#c8f5e5] px-2 py-0.5 text-[10px] font-bold text-neutral-900 sm:text-xs">
                      saved
                    </span>
                  ) : null}
                </button>
                <p className="mt-3 hidden max-w-xl text-sm text-neutral-600 lg:block lg:text-base">
                  Two columns—playback on the left, mood and notes on the right.
                </p>
                {storedProfile && !hasMeaningfulProfile(storedProfile) ? (
                  <p className="mt-2 text-xs text-neutral-600">
                    Add more in Vibe profile for stronger, more personal picks.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <span className="rounded-full border-2 border-black bg-[var(--vc-chip-mood)] px-3 py-1 text-xs font-medium text-neutral-900">
                  {inference.mood_label}
                </span>
                <span className="rounded-full border-2 border-black bg-[var(--vc-chip-confidence)] px-3 py-1 text-xs font-medium text-neutral-900">
                  {(inference.confidence * 100).toFixed(0)}% confidence
                </span>
              </div>
            </div>

            <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 lg:grid-cols-[minmax(0,11fr)_minmax(0,10fr)] lg:items-start lg:gap-x-8 lg:gap-y-8 xl:gap-x-10">
              <div className="min-w-0 space-y-8">
                {tracks.length > 0 && (
                  <VibePlayerWidget
                    tracks={tracks}
                    activeIndex={activeTrackIndex}
                    onNavigateTrack={navigateTrack}
                    onPreviewListen={onPreviewPlay}
                    playSignal={playSignal}
                    themed
                    onTrackEndedQueue={onTrackEndedQueue}
                  />
                )}

                <div>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-700">
                      Tracks
                    </p>
                    <button
                      type="button"
                      disabled={!canReshuffle}
                      onClick={() => void reshuffleTracks()}
                      title="Fetch three new songs for this vibe (same search keywords)"
                      className="rounded-xl border-2 border-black bg-[var(--vc-reshuffle)] px-3 py-1.5 text-xs font-semibold text-neutral-900 shadow-[3px_3px_0_0_#000] transition enabled:hover:bg-[var(--vc-reshuffle-hover)] enabled:active:translate-x-[1px] enabled:active:translate-y-[1px] enabled:active:shadow-[1px_1px_0_0_#000] disabled:cursor-not-allowed disabled:border-neutral-400 disabled:bg-neutral-100 disabled:text-neutral-500 disabled:shadow-none"
                    >
                      {musicBusy ? "Mixing…" : "Reshuffle"}
                    </button>
                  </div>
                  {tracks.length === 0 ? (
                    <p className="vc-session-card rounded-2xl border-2 border-black border-dashed bg-[var(--vc-empty-tracks)] px-4 py-8 text-center text-sm text-neutral-600">
                      No tracks loaded yet—use Re-read the room below.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-3" data-track-list>
                      {tracks.map((t, i) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => setActiveTrackIndex(i)}
                            className={`flex w-full gap-3 rounded-xl border-2 p-3 text-left shadow-[3px_3px_0_0_#000] transition hover:bg-[var(--vc-track-active)] ${
                              i === activeTrackIndex
                                ? "border-black bg-[var(--vc-track-active)] ring-2 ring-black ring-offset-2"
                                : "border-black bg-[var(--vc-track-row)]"
                            }`}
                          >
                            {t.album?.cover_medium ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={t.album.cover_medium}
                                alt=""
                                className="h-14 w-14 shrink-0 rounded-lg border-2 border-black object-cover"
                              />
                            ) : (
                              <div className="h-14 w-14 shrink-0 rounded-lg border-2 border-black bg-[var(--vc-player-cover-fallback)]" />
                            )}
                            <div className="min-w-0 flex-1 text-left">
                              <p className="truncate font-semibold text-neutral-900">{t.title}</p>
                              <p className="truncate text-sm text-neutral-700">{t.artist.name}</p>
                              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                                {i === activeTrackIndex ? "In player" : "Load in player"}
                              </p>
                              <a
                                href={appleMusicDeepLink(t.link)}
                                target="_blank"
                                rel="noreferrer"
                                title="Opens in the Apple Music app when installed"
                                className="mt-1 inline-block text-xs font-semibold text-neutral-900 underline decoration-2 underline-offset-2 hover:text-[color:var(--vc-link-hover)]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Apple Music
                              </a>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <aside className="mt-10 min-w-0 space-y-6 lg:mt-0 lg:sticky lg:top-8 lg:self-start">
                <div className="vc-session-card rounded-2xl border-2 border-black bg-[var(--vc-sidebar-now)] px-4 py-4 shadow-[5px_5px_0_0_#000] sm:px-5 sm:py-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-700">
                    Now
                  </p>
                  <p className="mt-2 text-base font-semibold leading-snug text-neutral-900">
                    {inference.notification_line}
                  </p>
                  <p className="mt-3 text-sm italic text-neutral-800">
                    {inference.weather_metaphor}
                  </p>

                  <details className="mt-6 rounded-2xl border-2 border-black bg-[var(--vc-sidebar-details-inner)] px-4 py-3 text-left [&_summary::-webkit-details-marker]:hidden">
                    <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-[0.15em] text-neutral-700 transition hover:text-neutral-900">
                      <span className="mr-2 inline-block text-[color:var(--vc-accent)]">▸</span>
                      How this read is framed
                    </summary>
                    <div className="mt-4 space-y-4 border-t-2 border-black pt-4 text-sm leading-relaxed text-neutral-700">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                          Signal read
                        </p>
                        <p className="mt-1 text-neutral-900">
                          {inference.signals_used_for_read}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                          Search strategy
                        </p>
                        <p className="mt-1 text-neutral-900">{inference.deezer_query_why}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                          Moment arc
                        </p>
                        <p className="mt-1 text-neutral-900">{inference.moment_arc}</p>
                      </div>
                    </div>
                  </details>
                </div>

                <div className="vc-session-card rounded-2xl border-2 border-black bg-[var(--vc-sidebar-suggested)] p-4 shadow-[5px_5px_0_0_#000] sm:p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-700">
                    Suggested listen
                  </p>
                  <h3 className="mt-2 text-base font-bold text-neutral-900">
                    {inference.playlist_title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-800">
                    {inference.playlist_vibe}
                  </p>
                  <p className="mt-3 text-xs text-neutral-700">
                    Search keywords:{" "}
                    <span className="font-medium text-neutral-900">
                      {inference.deezer_search_query}
                    </span>
                  </p>
                </div>

                <div className="vc-session-card rounded-2xl border-2 border-black bg-[var(--vc-sidebar-nudge)] p-4 shadow-[5px_5px_0_0_#000] sm:p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-700">
                    Creative nudge
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-900">
                    {inference.creative_nudge}
                  </p>
                  <p className="mt-4 text-sm text-neutral-800">{inference.affirmation_line}</p>
                </div>

                {inference.safety.distress_hint && (
                  <div className="rounded-2xl border-2 border-black bg-[#ffe4a8] p-4 text-sm text-neutral-900 shadow-[4px_4px_0_0_#000]">
                    If you’re in immediate danger, contact local emergency services.
                    VibeCheck does not provide crisis care.
                  </div>
                )}
              </aside>
            </div>

            <div className="mx-auto w-full max-w-6xl pt-2">
              <button
                type="button"
                disabled={!canReread}
                onClick={() => {
                  touchActivity();
                  void runCycle();
                }}
                className="w-full rounded-2xl border-2 border-black bg-white py-3.5 text-sm font-semibold text-neutral-900 shadow-[4px_4px_0_0_#000] transition enabled:hover:bg-[var(--vc-re-read-hover)] disabled:cursor-not-allowed disabled:border-neutral-400 disabled:bg-neutral-100 disabled:text-neutral-500 disabled:shadow-none lg:py-4 lg:text-base"
              >
                {loading
                  ? "Reading…"
                  : !canReread
                    ? `Re-read available in ${Math.ceil(cooldownLeft / 1000)}s`
                    : "Re-read the room"}
              </button>
            </div>
          </section>
        )}

        <footer
          id="vibecheck-footer"
          className="mt-auto space-y-3 rounded-2xl border-2 border-black border-dashed bg-[var(--vc-footer,#faf5eb)] px-5 py-6 text-[11px] leading-relaxed text-neutral-700 sm:px-8 lg:flex lg:items-start lg:justify-between lg:gap-8 lg:text-left lg:text-xs"
        >
          <p className="lg:max-w-md">
            On-device previews logged:{" "}
            <span className="font-semibold text-neutral-900">{listeningCount}</span>
            {" · "}
            <button
              type="button"
              onClick={handleClearListening}
              className="font-semibold text-neutral-900 underline decoration-2 decoration-black underline-offset-2 hover:text-[color:var(--vc-link-hover,#e85d8e)]"
              suppressHydrationWarning
            >
              Clear listening history
            </button>
            {" · "}
            <button
              type="button"
              onClick={handleClearSuggestedMemory}
              className="font-semibold text-neutral-900 underline decoration-2 decoration-black underline-offset-2 hover:text-[color:var(--vc-link-hover,#e85d8e)]"
              suppressHydrationWarning
            >
              Reset suggested-song memory
            </button>
          </p>
          <p className="text-neutral-600 lg:max-w-xl lg:text-right">
            Vibe profile &amp; quiz stay in your browser only · Signals from this device · Mood read by Gemini · Music via
            iTunes (+ optional YouTube full playback) · Not clinical advice.
          </p>
        </footer>
      </main>
    </div>
  );
}
