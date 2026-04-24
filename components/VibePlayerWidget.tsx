"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DeezerTrack } from "@/lib/types";

/** Narrow getBattery() result without relying on BatteryManager in all TS libs */
type BatteryHandle = EventTarget & {
  level: number;
  charging: boolean;
};

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const BAR_COUNT = 18;

export function VibePlayerWidget({
  tracks,
  activeIndex,
  onNavigateTrack,
  onPreviewListen,
  playSignal = 0,
  themed = false,
  onTrackEndedQueue,
}: {
  tracks: DeezerTrack[];
  activeIndex: number;
  onNavigateTrack: (delta: -1 | 1) => void;
  onPreviewListen: (t: DeezerTrack) => void;
  /** Increment from parent to start playback (e.g. from desktop toast). */
  playSignal?: number;
  /** Use mood CSS variables from the session shell (inherit). */
  themed?: boolean;
  /** If true, skip wrapping to the next track (parent is reshuffling or handling queue). */
  onTrackEndedQueue?: (track: DeezerTrack) => boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastPlaySignal = useRef(0);
  /** Set before skip/end navigation so the newly loaded track starts without an extra tap */
  const autoplayAfterTrackChangeRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [battery, setBattery] = useState<number | null>(null);
  const [charging, setCharging] = useState<boolean | null>(null);

  const t = tracks[activeIndex];
  const useFullAudio = Boolean(t?.stream_audio_url);

  useEffect(() => {
    let cancelled = false;
    let cleanupBt: (() => void) | undefined;
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{ level: number; charging: boolean }>;
    };
    nav.getBattery?.()?.then((bat) => {
      if (cancelled) return;
      const b = bat as BatteryHandle;
      setBattery(Math.round(b.level * 100));
      setCharging(b.charging);
      const onLvl = () => setBattery(Math.round(b.level * 100));
      const onChg = () => setCharging(b.charging);
      b.addEventListener("levelchange", onLvl);
      b.addEventListener("chargingchange", onChg);
      cleanupBt = () => {
        b.removeEventListener("levelchange", onLvl);
        b.removeEventListener("chargingchange", onChg);
      };
    });
    return () => {
      cancelled = true;
      cleanupBt?.();
    };
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const src = t?.stream_audio_url || t?.preview;
    if (!src) return;

    const wantAutoplay = autoplayAfterTrackChangeRef.current;
    autoplayAfterTrackChangeRef.current = false;

    el.pause();
    el.src = src;
    el.load();

    queueMicrotask(() => {
      setCurrent(0);
      setDuration(0);
      if (!wantAutoplay) setPlaying(false);
    });

    if (!wantAutoplay) return;

    const trackForListen = t;
    const playWhenReady = () => {
      void el
        .play()
        .then(() => {
          setPlaying(true);
          if (trackForListen) onPreviewListen(trackForListen);
        })
        .catch(() => setPlaying(false));
    };

    if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      playWhenReady();
    } else {
      el.addEventListener("canplay", playWhenReady, { once: true });
    }
  }, [t?.id, t?.stream_audio_url, t?.preview, onPreviewListen, t]);

  useEffect(() => {
    const src = t?.stream_audio_url || t?.preview;
    if (!playSignal || playSignal <= lastPlaySignal.current || !src || !t) return;
    lastPlaySignal.current = playSignal;
    const el = audioRef.current;
    if (!el) return;
    void el
      .play()
      .then(() => {
        setPlaying(true);
        onPreviewListen(t);
      })
      .catch(() => {});
  }, [playSignal, t, onPreviewListen]);

  const onTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    setCurrent(el.currentTime);
    if (Number.isFinite(el.duration)) setDuration(el.duration);
  }, []);

  const onLoadedMeta = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (Number.isFinite(el.duration)) setDuration(el.duration);
  }, []);

  const togglePlay = useCallback(async () => {
    const el = audioRef.current;
    if (!el || !t) return;
    const src = t.stream_audio_url || t.preview;
    if (!src) return;
    if (el.paused) {
      await el.play();
      setPlaying(true);
      onPreviewListen(t);
    } else {
      el.pause();
      setPlaying(false);
    }
  }, [t, onPreviewListen]);

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  const fallbackDur =
    duration > 0
      ? duration
      : t && t.duration > 0
        ? t.duration
        : 30;

  if (!t) return null;

  return (
    <div
      id="vibe-player-widget"
      className={`rounded-2xl border-2 border-black bg-[var(--vc-player-surface,#faf5eb)] p-4 shadow-[5px_5px_0_0_#000] sm:p-5 ${themed ? "vc-session-card" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--vc-accent,#e85d8e)]">
            VibeCheck
          </p>
          <p className="mt-1 text-lg font-bold leading-tight text-neutral-900">
            Your picks, this moment.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div
            className="flex items-center gap-0.5 rounded-lg border-2 border-black bg-[var(--vc-player-badge,#fff4d6)] px-1.5 py-1 text-[10px] font-bold text-neutral-900"
            title={battery != null ? `Battery ~${battery}%` : "Battery"}
          >
            <BatteryIcon pct={battery} charging={charging} />
            {battery != null ? <span>{battery}</span> : null}
          </div>
          <button
            type="button"
            onClick={() =>
              document.getElementById("vibecheck-footer")?.scrollIntoView({
                behavior: "smooth",
              })
            }
            className="rounded-lg border-2 border-black bg-white p-1.5 text-neutral-900 shadow-[2px_2px_0_0_#000] hover:bg-[var(--vc-player-gear-hover,#fff4d6)]"
            aria-label="Settings and info"
          >
            <GearIcon />
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        {t.album?.cover_medium ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.album.cover_medium}
            alt=""
            className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-xl border-2 border-black object-cover"
          />
        ) : (
          <div className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-xl border-2 border-black bg-[var(--vc-player-cover-fallback,#fff4d6)]" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-neutral-600">
            {t.artist.name}
          </p>
          <p className="truncate text-base font-bold text-neutral-900">{t.title}</p>
        </div>
      </div>

      <>
        {useFullAudio ? (
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
            Full-length audio
          </p>
        ) : null}
        <WaveformBars active={playing} />

        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full border-2 border-black bg-white">
            <div
              className="h-full bg-[var(--vc-progress,#e85d8e)] transition-[width] duration-150 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[11px] font-semibold text-neutral-700">
            <span>{fmtTime(current)}</span>
            <span>{fmtTime(fallbackDur)}</span>
          </div>
        </div>
      </>

      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => {
            autoplayAfterTrackChangeRef.current = true;
            onNavigateTrack(-1);
          }}
          disabled={tracks.length < 2}
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-black bg-[var(--vc-player-skip,#dffaf0)] text-neutral-900 shadow-[3px_3px_0_0_#000] disabled:opacity-40"
          aria-label="Previous track"
        >
          <SkipBackIcon />
        </button>
        <button
          type="button"
          onClick={() => void togglePlay()}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-black bg-[var(--vc-player-play,#ffb8d9)] text-neutral-900 shadow-[4px_4px_0_0_#000]"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          onClick={() => {
            autoplayAfterTrackChangeRef.current = true;
            onNavigateTrack(1);
          }}
          disabled={tracks.length < 2}
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-black bg-[var(--vc-player-skip,#dffaf0)] text-neutral-900 shadow-[3px_3px_0_0_#000] disabled:opacity-40"
          aria-label="Next track"
        >
          <SkipFwdIcon />
        </button>
      </div>

      {(t.stream_audio_url || t.preview) ? (
        <audio
          ref={audioRef}
          className="hidden"
          preload="metadata"
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMeta}
          onEnded={() => {
            setPlaying(false);
            if (!t) return;
            const skipDefault = onTrackEndedQueue?.(t) ?? false;
            if (skipDefault) return;
            if (tracks.length > 1) {
              autoplayAfterTrackChangeRef.current = true;
              onNavigateTrack(1);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function WaveformBars({ active }: { active: boolean }) {
  return (
    <div
      className="mt-4 flex h-10 items-end justify-center gap-[3px] rounded-xl border-2 border-black bg-white px-2 py-2"
      aria-hidden
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <span
          key={i}
          className={`w-[5px] origin-bottom rounded-sm border border-black bg-[var(--vc-wave,#e85d8e)] ${
            active ? "vc-wave-active min-h-[40%]" : ""
          }`}
          style={
            active
              ? { animationDelay: `${i * 45}ms` }
              : { height: `${28 + (i % 5) * 10}%` }
          }
        />
      ))}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}
function SkipBackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11 18V6l-8 6 8 6zm10 0V6l-8 6 8 6z" />
    </svg>
  );
}
function SkipFwdIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}
function BatteryIcon({
  pct,
  charging,
}: {
  pct: number | null;
  charging: boolean | null;
}) {
  const fill =
    pct == null ? 0.5 : Math.max(0.15, Math.min(1, pct / 100));
  return (
    <svg width="20" height="12" viewBox="0 0 24 14" fill="none" aria-hidden>
      <rect x="1" y="3" width="18" height="8" rx="2" stroke="black" strokeWidth="1.5" />
      <rect x="20" y="5" width="2" height="4" rx="1" fill="black" />
      <rect x="3" y="5" width={14 * fill} height="4" rx="0.5" fill="var(--vc-accent,#e85d8e)" />
      {charging ? (
        <path d="M8 7l2 4 4-6" stroke="black" strokeWidth="1.2" fill="none" />
      ) : null}
    </svg>
  );
}
