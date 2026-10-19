"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  THRESHOLDS,
  checkContrast,
  normalizeHex,
  suggestLightnessNudge,
} from "@/lib/contrast";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/fill";
import { formatRatioLocale, formatThreshold } from "@/lib/i18n/format";

type ToolText = Dictionary["tool"];

const DEFAULT_FG = "#1a1a1a";
const DEFAULT_BG = "#ffffff";

// Tailwind palette names; "White" is localized at render time.
const PRESETS: { fgName: string; bgName: string; fg: string; bg: string }[] = [
  { fgName: "Slate 900", bgName: "White", fg: "#0f172a", bg: "#ffffff" },
  { fgName: "Indigo 600", bgName: "White", fg: "#4f46e5", bg: "#ffffff" },
  { fgName: "White", bgName: "Indigo 700", fg: "#ffffff", bg: "#4338ca" },
  { fgName: "Gray 500", bgName: "White", fg: "#6b7280", bg: "#ffffff" },
  { fgName: "Amber 400", bgName: "Slate 900", fg: "#fbbf24", bg: "#0f172a" },
  { fgName: "Emerald 600", bgName: "White", fg: "#059669", bg: "#ffffff" },
  { fgName: "Red 500", bgName: "White", fg: "#ef4444", bg: "#ffffff" },
  { fgName: "Slate 400", bgName: "Slate 800", fg: "#94a3b8", bg: "#1e293b" },
];

function readQuery(): { fg: string; bg: string } {
  const params = new URLSearchParams(window.location.search);
  return {
    fg: normalizeHex(params.get("fg") ?? "") ?? DEFAULT_FG,
    bg: normalizeHex(params.get("bg") ?? "") ?? DEFAULT_BG,
  };
}

function ColorField({
  id,
  label,
  value,
  onChange,
  t,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (hex: string) => void;
  t: ToolText;
}) {
  const [text, setText] = useState(value);
  // Keep the text box in sync when the color changes from elsewhere (swap, picker, preset).
  useEffect(() => {
    if (normalizeHex(text) !== value) setText(value);
  }, [value]);
  const invalid = normalizeHex(text) === null;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="flex items-stretch gap-2">
        <input
          type="color"
          aria-label={fill(t.pickerLabel, { label })}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-14 cursor-pointer rounded-md border border-slate-300 bg-white p-1"
        />
        <input
          id={id}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          value={text}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            const hex = normalizeHex(e.target.value);
            if (hex) onChange(hex);
          }}
          onBlur={() => setText(value)}
          className={`h-11 w-full rounded-md border px-3 font-mono text-base uppercase outline-none focus:ring-2 focus:ring-indigo-500 ${
            invalid ? "border-red-500" : "border-slate-300"
          }`}
        />
      </div>
      {invalid && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-700">
          {t.hexError}
        </p>
      )}
    </div>
  );
}

function Badge({ label, detail, pass, t }: { label: string; detail: string; pass: boolean; t: ToolText }) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
        pass ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"
      }`}
    >
      <div>
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <div className="text-xs text-slate-600">{detail}</div>
      </div>
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
          pass ? "bg-emerald-700 text-white" : "bg-red-700 text-white"
        }`}
      >
        {pass ? t.pass : t.fail}
      </span>
    </div>
  );
}

export default function ContrastTool({ locale, t }: { locale: Locale; t: ToolText }) {
  const [fg, setFg] = useState(DEFAULT_FG);
  const [bg, setBg] = useState(DEFAULT_BG);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read ?fg=&bg= on load and on back/forward.
  useEffect(() => {
    const apply = () => {
      const q = readQuery();
      setFg(q.fg);
      setBg(q.bg);
    };
    apply();
    setReady(true);
    window.addEventListener("popstate", apply);
    return () => window.removeEventListener("popstate", apply);
  }, []);

  // Reflect current colors in the URL (without adding history entries per keystroke).
  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    url.searchParams.set("fg", fg.slice(1));
    url.searchParams.set("bg", bg.slice(1));
    if (url.href !== window.location.href) window.history.replaceState(null, "", url);
  }, [fg, bg, ready]);

  const result = useMemo(() => checkContrast(fg, bg), [fg, bg]);
  const ratioText = formatRatioLocale(result.ratio, locale);
  const th = (v: number) => `≥ ${formatThreshold(v, locale)}`;

  const nudgeAA = useMemo(
    () => (result.aaNormal ? null : suggestLightnessNudge(fg, bg, THRESHOLDS.aaNormal)),
    [fg, bg, result.aaNormal],
  );
  const nudgeAAA = useMemo(
    () => (result.aaaNormal ? null : suggestLightnessNudge(fg, bg, THRESHOLDS.aaaNormal)),
    [fg, bg, result.aaaNormal],
  );

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1800);
  }, []);

  const copy = useCallback(
    async (text: string, done: string) => {
      try {
        await navigator.clipboard.writeText(text);
        flash(done);
      } catch {
        flash(t.copyFailed);
      }
    },
    [flash, t.copyFailed],
  );

  const shareUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("fg", fg.slice(1));
    url.searchParams.set("bg", bg.slice(1));
    return url.href;
  };

  return (
    <section aria-label={t.sectionLabel} className="grid gap-6 lg:grid-cols-2">
      {/* Inputs + results */}
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <ColorField id="fg" label={t.fgLabel} value={fg} onChange={setFg} t={t} />
          <button
            type="button"
            onClick={() => {
              setFg(bg);
              setBg(fg);
            }}
            className="h-11 rounded-md border border-slate-300 px-3 text-sm font-medium hover:bg-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            aria-label={t.swapLabel}
            title={t.swapTitle}
          >
            ⇄ {t.swap}
          </button>
          <ColorField id="bg" label={t.bgLabel} value={bg} onChange={setBg} t={t} />
        </div>

        <div className="rounded-xl bg-slate-900 p-4 text-white">
          <div className="text-xs tracking-wide text-slate-300 uppercase">{t.ratioLabel}</div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <output aria-live="polite" className="font-mono text-4xl font-bold tabular-nums">
              {ratioText}
            </output>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copy(ratioText, t.copiedRatio)}
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
              >
                {t.copyRatio}
              </button>
              <button
                type="button"
                onClick={() => copy(fill(t.hexPair, { fg, bg }), t.copiedHexes)}
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
              >
                {t.copyHexes}
              </button>
              <button
                type="button"
                onClick={() => copy(shareUrl(), t.copiedLink)}
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
              >
                {t.copyLink}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Badge t={t} label={`AA · ${t.normalText}`} detail={th(THRESHOLDS.aaNormal)} pass={result.aaNormal} />
          <Badge t={t} label={`AA · ${t.largeText}`} detail={th(THRESHOLDS.aaLarge)} pass={result.aaLarge} />
          <Badge t={t} label={`AAA · ${t.normalText}`} detail={th(THRESHOLDS.aaaNormal)} pass={result.aaaNormal} />
          <Badge t={t} label={`AAA · ${t.largeText}`} detail={th(THRESHOLDS.aaaLarge)} pass={result.aaaLarge} />
          <div className="sm:col-span-2">
            <Badge t={t} label={t.uiComponents} detail={`${th(THRESHOLDS.ui)} (${t.uiCriterion})`} pass={result.ui} />
          </div>
        </div>

        {(nudgeAA || nudgeAAA) && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
            <p className="font-medium text-slate-900">{t.suggestionTitle}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { level: "AA", hex: nudgeAA },
                { level: "AAA", hex: nudgeAAA },
              ].map(
                ({ level, hex }) =>
                  hex && (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFg(hex)}
                      className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 hover:bg-slate-100"
                    >
                      <span aria-hidden className="h-4 w-4 rounded border border-slate-300" style={{ background: hex }} />
                      <span className="font-mono">{hex}</span>
                      <span className="text-xs text-slate-600">
                        {level} · {formatRatioLocale(checkContrast(hex, bg).ratio, locale)}
                      </span>
                    </button>
                  ),
              )}
            </div>
          </div>
        )}

        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">{t.presetsTitle}</h2>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.fg + p.bg}
                type="button"
                onClick={() => {
                  setFg(p.fg);
                  setBg(p.bg);
                }}
                className="flex items-center gap-1.5 rounded-full border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100"
              >
                <span
                  aria-hidden
                  className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[9px] font-bold"
                  style={{ background: p.bg, color: p.fg }}
                >
                  A
                </span>
                {[p.fgName, p.bgName].map((n) => (n === "White" ? t.white : n)).join(" / ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div
        className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-6 shadow-sm"
        style={{ background: bg, color: fg }}
        aria-label={t.previewLabel}
      >
        <p className="text-xs font-semibold tracking-wide uppercase opacity-80">{t.previewLabel}</p>
        <p className="text-3xl font-bold leading-tight">{t.previewHeading}</p>
        <p className="text-base leading-relaxed">{t.previewBody}</p>
        <p className="text-sm">{t.previewSmall}</p>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="rounded-md px-4 py-2 text-sm font-semibold"
            style={{ background: fg, color: bg }}
          >
            {t.solidButton}
          </span>
          <span className="rounded-md border-2 px-4 py-2 text-sm font-semibold" style={{ borderColor: fg }}>
            {t.outlineButton}
          </span>
          <svg aria-hidden width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <a href="#how-it-works" className="underline" style={{ color: fg }}>
            {t.textLink}
          </a>
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg transition-opacity ${
          toast ? "opacity-100" : "opacity-0"
        }`}
      >
        {toast}
      </div>
    </section>
  );
}
