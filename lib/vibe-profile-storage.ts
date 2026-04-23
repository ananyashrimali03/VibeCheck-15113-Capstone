import type { VibeProfilePacket } from "@/lib/types";
import {
  labelForAboutKeyword,
  MCQS,
  THIS_OR_THAT,
} from "@/lib/vibe-profile-quiz-data";

const STORAGE_KEY = "vibecheck_vibe_profile_v1";

export type TotPicks = { a: boolean; b: boolean };

export type VibeProfileStored = {
  display_name: string;
  /** Freeform bio under keywords */
  about: string;
  /** Selected keyword ids from ABOUT_KEYWORDS */
  about_keywords: string[];
  mbti: string | null;
  zodiac: string | null;
  /** Per row: each side can be on/off independently (both allowed) */
  this_or_that: Record<string, TotPicks>;
  /** mcq id -> option id */
  mcq: Record<string, string>;
  updated_at_iso: string;
};

function emptyStored(): VibeProfileStored {
  return {
    display_name: "",
    about: "",
    about_keywords: [],
    mbti: null,
    zodiac: null,
    this_or_that: {},
    mcq: {},
    updated_at_iso: new Date(0).toISOString(),
  };
}

function migrateThisOrThat(raw: unknown): Record<string, TotPicks> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, TotPicks> = {};
  for (const [id, val] of Object.entries(raw)) {
    if (val === "a") out[id] = { a: true, b: false };
    else if (val === "b") out[id] = { a: false, b: true };
    else if (val && typeof val === "object") {
      const o = val as { a?: unknown; b?: unknown };
      out[id] = { a: Boolean(o.a), b: Boolean(o.b) };
    }
  }
  return out;
}

function totNote(row: (typeof THIS_OR_THAT)[number], picks: TotPicks | undefined): string | null {
  if (!picks) return null;
  const { a, b } = picks;
  if (a && b) return `Resonates with both “${row.a}” and “${row.b}”.`;
  if (a && !b) return `Leans toward “${row.a}” (over “${row.b}”).`;
  if (!a && b) return `Leans toward “${row.b}” (over “${row.a}”).`;
  return null;
}

function buildPreferenceNotes(stored: VibeProfileStored): string[] {
  const notes: string[] = [];
  for (const row of THIS_OR_THAT) {
    const line = totNote(row, stored.this_or_that[row.id]);
    if (line) notes.push(line);
  }
  for (const q of MCQS) {
    const oid = stored.mcq[q.id];
    const opt = q.options.find((o) => o.id === oid);
    if (opt) notes.push(`${q.question} → ${opt.label}.`);
  }
  return notes;
}

export function buildProfilePacket(stored: VibeProfileStored): VibeProfilePacket {
  const preference_notes = buildPreferenceNotes(stored);
  const lines: string[] = [];
  if (stored.display_name.trim()) {
    lines.push(`Goes by “${stored.display_name.trim()}”.`);
  }
  if (stored.about_keywords.length > 0) {
    const labels = stored.about_keywords
      .map((id) => labelForAboutKeyword(id) ?? id)
      .filter(Boolean);
    if (labels.length > 0) {
      lines.push(`Vibe / taste keywords (self-selected): ${labels.join(", ")}.`);
    }
  }
  if (stored.about.trim()) {
    lines.push(`About: ${stored.about.trim()}`);
  }
  if (stored.mbti && stored.mbti !== "skip") {
    lines.push(`MBTI (self-reported): ${stored.mbti}.`);
  }
  if (stored.zodiac && stored.zodiac !== "skip") {
    lines.push(`Zodiac (self-reported): ${stored.zodiac}.`);
  }
  lines.push(...preference_notes);
  const summary_for_model =
    lines.length > 0
      ? lines.join(" ")
      : "No detailed vibe profile yet — rely on live signals only.";

  return {
    display_name: stored.display_name.trim(),
    about: stored.about.trim(),
    mbti: stored.mbti && stored.mbti !== "skip" ? stored.mbti : null,
    zodiac: stored.zodiac && stored.zodiac !== "skip" ? stored.zodiac : null,
    preference_notes,
    summary_for_model,
    updated_at_iso: stored.updated_at_iso,
  };
}

export function hasMeaningfulProfile(stored: VibeProfileStored | null): boolean {
  if (!stored) return false;
  if (stored.display_name.trim().length >= 1) return true;
  if (stored.about.trim().length >= 8) return true;
  if (stored.about_keywords.length >= 1) return true;
  if (stored.mbti && stored.mbti !== "skip") return true;
  if (stored.zodiac && stored.zodiac !== "skip") return true;
  if (Object.keys(stored.this_or_that).some((id) => {
    const p = stored.this_or_that[id];
    return p && (p.a || p.b);
  }))
    return true;
  if (Object.keys(stored.mcq).length >= 2) return true;
  return false;
}

export function loadVibeProfile(): VibeProfileStored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VibeProfileStored> & {
      this_or_that?: unknown;
      about_keywords?: unknown;
    };
    const base = emptyStored();

    let about_keywords: string[] = [];
    if (Array.isArray(parsed.about_keywords)) {
      about_keywords = parsed.about_keywords.filter((x): x is string => typeof x === "string");
    }

    return {
      display_name: typeof parsed.display_name === "string" ? parsed.display_name : base.display_name,
      about: typeof parsed.about === "string" ? parsed.about : base.about,
      about_keywords,
      mbti: typeof parsed.mbti === "string" || parsed.mbti === null ? parsed.mbti : base.mbti,
      zodiac: typeof parsed.zodiac === "string" || parsed.zodiac === null ? parsed.zodiac : base.zodiac,
      this_or_that: migrateThisOrThat(parsed.this_or_that),
      mcq: parsed.mcq && typeof parsed.mcq === "object" ? (parsed.mcq as Record<string, string>) : {},
      updated_at_iso:
        typeof parsed.updated_at_iso === "string" ? parsed.updated_at_iso : base.updated_at_iso,
    };
  } catch {
    return null;
  }
}

export function saveVibeProfile(stored: VibeProfileStored): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function clearVibeProfile(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function emptyProfile(): VibeProfileStored {
  return emptyStored();
}
