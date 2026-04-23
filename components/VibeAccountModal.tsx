"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ABOUT_KEYWORDS,
  MBTI_OPTIONS,
  MCQS,
  THIS_OR_THAT,
  ZODIAC_OPTIONS,
} from "@/lib/vibe-profile-quiz-data";
import {
  emptyProfile,
  loadVibeProfile,
  saveVibeProfile,
  clearVibeProfile,
  type VibeProfileStored,
} from "@/lib/vibe-profile-storage";

const STEPS = 4;

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function VibeAccountModal({ open, onClose, onSaved }: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<VibeProfileStored>(() => emptyProfile());

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setForm(loadVibeProfile() ?? emptyProfile());
      setStep(1);
    });
  }, [open]);

  const update = useCallback(<K extends keyof VibeProfileStored>(key: K, val: VibeProfileStored[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
  }, []);

  const toggleTotSide = useCallback((id: string, side: "a" | "b") => {
    setForm((f) => {
      const cur = f.this_or_that[id] ?? { a: false, b: false };
      const nextPick = { ...cur, [side]: !cur[side] };
      return {
        ...f,
        this_or_that: { ...f.this_or_that, [id]: nextPick },
      };
    });
  }, []);

  const toggleKeyword = useCallback((id: string) => {
    setForm((f) => {
      const has = f.about_keywords.includes(id);
      const about_keywords = has
        ? f.about_keywords.filter((x) => x !== id)
        : [...f.about_keywords, id];
      return { ...f, about_keywords };
    });
  }, []);

  const setMcq = useCallback((qid: string, oid: string) => {
    setForm((f) => ({
      ...f,
      mcq: { ...f.mcq, [qid]: oid },
    }));
  }, []);

  const handleSave = useCallback(() => {
    const next: VibeProfileStored = {
      ...form,
      updated_at_iso: new Date().toISOString(),
    };
    saveVibeProfile(next);
    onSaved();
    onClose();
  }, [form, onClose, onSaved]);

  const handleClear = useCallback(() => {
    if (!window.confirm("Erase your saved vibe profile on this device?")) return;
    clearVibeProfile();
    setForm(emptyProfile());
    onSaved();
    onClose();
  }, [onClose, onSaved]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center p-4 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vibe-account-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border-2 border-black bg-[#fff8f0] shadow-[8px_8px_0_0_#000]">
        <div className="flex items-start justify-between gap-3 border-b-2 border-black bg-[#fff4d6] px-4 py-3 sm:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e85d8e]">Account</p>
            <h2 id="vibe-account-title" className="text-lg font-bold text-neutral-900">
              Your vibe profile
            </h2>
            <p className="mt-1 text-xs text-neutral-600">
              Saved only on this device. We use it to tune recommendations with time, weather, and context.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border-2 border-black bg-white px-2.5 py-1 text-sm font-bold text-neutral-900 shadow-[2px_2px_0_0_#000]"
          >
            ✕
          </button>
        </div>

        <div className="border-b-2 border-black bg-white px-4 py-2 sm:px-5">
          <div className="flex gap-1">
            {Array.from({ length: STEPS }, (_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full border border-black ${
                  i + 1 <= step ? "bg-[#ffb8d9]" : "bg-neutral-200"
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Step {step} / {STEPS}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {step === 1 ? (
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">Name</span>
                <input
                  type="text"
                  value={form.display_name}
                  onChange={(e) => update("display_name", e.target.value)}
                  placeholder="What should we call you?"
                  className="mt-1.5 w-full rounded-xl border-2 border-black bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-[3px_3px_0_0_#000] placeholder:text-neutral-400"
                  maxLength={80}
                  autoComplete="nickname"
                />
              </label>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">About you — keywords</span>
                <p className="mt-1 text-xs text-neutral-600">Select any that fit (multiple ok).</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ABOUT_KEYWORDS.map((kw) => {
                    const on = form.about_keywords.includes(kw.id);
                    return (
                      <button
                        key={kw.id}
                        type="button"
                        onClick={() => toggleKeyword(kw.id)}
                        aria-pressed={on}
                        className={`rounded-full border-2 px-3 py-1.5 text-xs font-semibold shadow-[2px_2px_0_0_#000] transition sm:text-sm ${
                          on
                            ? "border-black bg-[#c8f5e5] text-neutral-900 ring-2 ring-black ring-offset-1"
                            : "border-black bg-white text-neutral-800 hover:bg-[#faf5eb]"
                        }`}
                      >
                        {kw.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Anything else?
                </span>
                <textarea
                  value={form.about}
                  onChange={(e) => update("about", e.target.value)}
                  placeholder="Optional — music taste, typical mood, what a good day sounds like…"
                  rows={4}
                  className="mt-1.5 w-full resize-y rounded-xl border-2 border-black bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-[3px_3px_0_0_#000] placeholder:text-neutral-400"
                  maxLength={2000}
                />
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">MBTI</span>
                <select
                  value={form.mbti ?? "skip"}
                  onChange={(e) =>
                    update("mbti", e.target.value === "skip" ? "skip" : e.target.value)
                  }
                  className="mt-1.5 w-full rounded-xl border-2 border-black bg-white px-3 py-2.5 text-sm font-medium text-neutral-900 shadow-[3px_3px_0_0_#000]"
                >
                  {MBTI_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">Zodiac</span>
                <select
                  value={form.zodiac ?? "skip"}
                  onChange={(e) =>
                    update("zodiac", e.target.value === "skip" ? "skip" : e.target.value)
                  }
                  className="mt-1.5 w-full rounded-xl border-2 border-black bg-white px-3 py-2.5 text-sm font-medium text-neutral-900 shadow-[3px_3px_0_0_#000]"
                >
                  {ZODIAC_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs leading-relaxed text-neutral-600">
                Totally optional — treat these as fun flavor for the model, not science.
              </p>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-neutral-800">This or that</p>
                <p className="mt-1 text-xs text-neutral-600">
                  Tap each side on or off — you can choose one, both, or neither if you’re undecided.
                </p>
              </div>
              {THIS_OR_THAT.map((row) => {
                const pick = form.this_or_that[row.id] ?? { a: false, b: false };
                return (
                  <div key={row.id} className="rounded-xl border-2 border-black bg-[#faf5eb] p-3 shadow-[3px_3px_0_0_#000]">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        aria-pressed={pick.a}
                        onClick={() => toggleTotSide(row.id, "a")}
                        className={`rounded-lg border-2 px-3 py-2.5 text-left text-sm font-semibold transition ${
                          pick.a
                            ? "border-black bg-[#c8f5e5] ring-2 ring-black"
                            : "border-black bg-white hover:bg-[#dffaf0]"
                        }`}
                      >
                        {row.a}
                      </button>
                      <button
                        type="button"
                        aria-pressed={pick.b}
                        onClick={() => toggleTotSide(row.id, "b")}
                        className={`rounded-lg border-2 px-3 py-2.5 text-left text-sm font-semibold transition ${
                          pick.b
                            ? "border-black bg-[#c8f5e5] ring-2 ring-black"
                            : "border-black bg-white hover:bg-[#dffaf0]"
                        }`}
                      >
                        {row.b}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-6">
              {MCQS.map((q) => (
                <fieldset key={q.id} className="rounded-xl border-2 border-black bg-white p-3 shadow-[3px_3px_0_0_#000]">
                  <legend className="px-1 text-sm font-bold text-neutral-900">{q.question}</legend>
                  <div className="mt-3 space-y-2">
                    {q.options.map((opt) => {
                      const checked = form.mcq[q.id] === opt.id;
                      return (
                        <label
                          key={opt.id}
                          className={`flex cursor-pointer items-start gap-2 rounded-lg border-2 px-2.5 py-2 text-sm ${
                            checked
                              ? "border-black bg-[#e8deff]"
                              : "border-transparent bg-[#faf5eb] hover:border-black/30"
                          }`}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            value={opt.id}
                            checked={checked}
                            onChange={() => setMcq(q.id, opt.id)}
                            className="mt-1"
                          />
                          <span className="text-neutral-800">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t-2 border-black bg-[#faf5eb] px-4 py-3 sm:px-5">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="rounded-xl border-2 border-black bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-[3px_3px_0_0_#000]"
            >
              Back
            </button>
          ) : (
            <span className="min-w-[4rem]" />
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="rounded-xl border-2 border-dashed border-neutral-600 px-3 py-2 text-xs font-semibold text-neutral-700"
            >
              Erase saved profile
            </button>
            {step < STEPS ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(STEPS, s + 1))}
                className="rounded-xl border-2 border-black bg-[#ffb8d9] px-5 py-2.5 text-sm font-bold text-neutral-900 shadow-[4px_4px_0_0_#000]"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSave()}
                className="rounded-xl border-2 border-black bg-[#c8f5e5] px-5 py-2.5 text-sm font-bold text-neutral-900 shadow-[4px_4px_0_0_#000]"
              >
                Save profile
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
