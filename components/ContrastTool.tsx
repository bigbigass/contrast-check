"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  THRESHOLDS,
  checkContrast,
  formatRatio,
  normalizeHex,
  suggestLightnessNudge,
} from "@/lib/contrast";

const DEFAULT_FG = "#1a1a1a";
const DEFAULT_BG = "#ffffff";

const PRESETS: { name: string; fg: string; bg: string }[] = [
  { name: "Slate 900 / White", fg: "#0f172a", bg: "#ffffff" },
  { name: "Indigo 600 / White", fg: "#4f46e5", bg: "#ffffff" },
  { name: "White / Indigo 700", fg: "#ffffff", bg: "#4338ca" },
  { name: "Gray 500 / White", fg: "#6b7280", bg: "#ffffff" },
  { name: "Amber 400 / Slate 900", fg: "#fbbf24", bg: "#0f172a" },
  { name: "Emerald 600 / White", fg: "#059669", bg: "#ffffff" },
  { name: "Red 500 / White", fg: "#ef4444", bg: "#ffffff" },
  { name: "Slate 400 / Slate 800", fg: "#94a3b8", bg: "#1e293b" },
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
}: {
  id: string;
  label: string;
  value: string;
  onChange: (hex: string) => void;
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
          aria-label={`${label} color picker`}
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
          Enter a 3- or 6-digit hex color, e.g. #1a1a1a
        </p>
      )}
    </div>
  );
}

function Badge({ label, detail, pass }: { label: string; detail: string; pass: boolean }) {
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
        {pass ? "Pass" : "Fail"}
      </span>
    </div>
  );
}

export default function ContrastTool() {
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
  const ratioText = formatRatio(result.ratio);

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
    async (text: string, what: string) => {
      try {
        await navigator.clipboard.writeText(text);
        flash(`Copied ${what}`);
      } catch {
        flash("Copy failed — select and copy manually");
      }
    },
    [flash],
  );

  const shareUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("fg", fg.slice(1));
    url.searchParams.set("bg", bg.slice(1));
    return url.href;
  };

  return (
    <section aria-label="Color contrast checker tool" className="grid gap-6 lg:grid-cols-2">
      {/* Inputs + results */}
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <ColorField id="fg" label="Text (foreground)" value={fg} onChange={setFg} />
          <button
            type="button"
            onClick={() => {
              setFg(bg);
              setBg(fg);
            }}
            className="h-11 rounded-md border border-slate-300 px-3 text-sm font-medium hover:bg-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            aria-label="Swap foreground and background colors"
            title="Swap colors"
          >
            ⇄ Swap
          </button>
          <ColorField id="bg" label="Background" value={bg} onChange={setBg} />
        </div>

        <div className="rounded-xl bg-slate-900 p-4 text-white">
          <div className="text-xs tracking-wide text-slate-300 uppercase">Contrast ratio</div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <output aria-live="polite" className="font-mono text-4xl font-bold tabular-nums">
              {ratioText}
            </output>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copy(ratioText, "ratio")}
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
              >
                Copy ratio
              </button>
              <button
                type="button"
                onClick={() => copy(`${fg} on ${bg}`, "hex colors")}
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
              >
                Copy hexes
              </button>
              <button
                type="button"
                onClick={() => copy(shareUrl(), "share link")}
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
              >
                Copy link
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Badge label="AA · Normal text" detail="≥ 4.5:1" pass={result.aaNormal} />
          <Badge label="AA · Large text" detail="≥ 3:1" pass={result.aaLarge} />
          <Badge label="AAA · Normal text" detail="≥ 7:1" pass={result.aaaNormal} />
          <Badge label="AAA · Large text" detail="≥ 4.5:1" pass={result.aaaLarge} />
          <div className="sm:col-span-2">
            <Badge label="UI components & graphics" detail="≥ 3:1 (SC 1.4.11)" pass={result.ui} />
          </div>
        </div>

        {(nudgeAA || nudgeAAA) && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
            <p className="font-medium text-slate-900">Closest passing text color (same hue, adjusted lightness):</p>
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
                        {level} · {formatRatio(checkContrast(hex, bg).ratio)}
                      </span>
                    </button>
                  ),
              )}
            </div>
          </div>
        )}

        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Preset pairs</h2>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
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
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div
        className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-6 shadow-sm"
        style={{ background: bg, color: fg }}
        aria-label="Live preview"
      >
        <p className="text-xs font-semibold tracking-wide uppercase opacity-80">Live preview</p>
        <p className="text-3xl font-bold leading-tight">Large heading text (24px bold)</p>
        <p className="text-base leading-relaxed">
          Normal body text at 16px. The quick brown fox jumps over the lazy dog. Good contrast keeps paragraphs
          readable for people with low vision, color blindness, or a phone in bright sunlight.
        </p>
        <p className="text-sm">Small print at 14px — fine print still needs to meet the normal-text threshold.</p>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="rounded-md px-4 py-2 text-sm font-semibold"
            style={{ background: fg, color: bg }}
          >
            Solid button
          </span>
          <span className="rounded-md border-2 px-4 py-2 text-sm font-semibold" style={{ borderColor: fg }}>
            Outline button
          </span>
          <svg aria-hidden width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <a href="#how-it-works" className="underline" style={{ color: fg }}>
            Text link
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
