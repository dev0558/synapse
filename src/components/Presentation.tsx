"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Presentation as PresentationIcon } from "lucide-react";

type Slide = { kicker?: string; title: string; subtitle?: string; bullets?: string[]; accent?: string };

export default function Presentation() {
  const [cve, setCve] = useState("CVE-2026-12569");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const next = useCallback(() => setI((p) => Math.min(p + 1, slides.length - 1)), [slides.length]);
  const prev = useCallback(() => setI((p) => Math.max(p - 1, 0)), []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [next, prev]);

  async function generate() {
    if (!cve.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/cve-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cve_id: cve }),
      });
      const data = await res.json();
      if (data.error) { setErr(data.error); setBusy(false); return; }
      setSlides(data.slides);
      setI(0);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
    setBusy(false);
  }

  const s = slides[i];

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input
          className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-base outline-none focus:border-indigo-500 focus:bg-white"
          placeholder="Enter a CVE id to build a threat-brief deck, e.g. CVE-2026-12569"
          value={cve}
          onChange={(e) => setCve(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
        />
        <button
          onClick={generate}
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-6 py-3 text-base font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Building…" : "Generate Deck"}
        </button>
      </div>

      {err && <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-base text-red-700">{err}</div>}

      {slides.length === 0 ? (
        <div className="flex h-[60vh] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm">
          <PresentationIcon className="h-12 w-12" />
          <p className="mt-3 text-base">Generate a presentation built from a CVE&apos;s real findings.</p>
        </div>
      ) : (
        <>
          <div className="relative flex h-[62vh] flex-col justify-center overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-indigo-950 p-12 text-white shadow-lg">
            <div className="absolute right-6 top-5 text-sm text-slate-400">{i + 1} / {slides.length}</div>

            {s.kicker && (
              <div className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">{s.kicker}</div>
            )}

            {i === 0 ? (
              <h1 className={`mb-3 bg-gradient-to-r ${s.accent ?? "from-indigo-400 to-cyan-300"} bg-clip-text text-6xl font-extrabold text-transparent`}>
                {s.title}
              </h1>
            ) : (
              <h2 className={`text-4xl font-bold ${s.accent?.startsWith("text-") ? s.accent : "text-white"}`}>{s.title}</h2>
            )}

            {s.subtitle && <p className="mt-3 max-w-3xl text-xl text-slate-300">{s.subtitle}</p>}

            {s.bullets && (
              <ul className="mt-7 space-y-3">
                {s.bullets.map((b, k) => (
                  <li key={k} className="flex items-start gap-3 text-xl text-slate-200">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="absolute bottom-6 left-12 text-sm text-slate-500">
              SYNAPSE · Purple-Team Threat Brief · {cve}
            </p>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button onClick={prev} disabled={i === 0}
              className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40">
              <ChevronLeft className="h-5 w-5" /> Prev
            </button>
            <div className="flex gap-1.5">
              {slides.map((_, k) => (
                <button key={k} onClick={() => setI(k)}
                  className={`h-2.5 rounded-full transition ${k === i ? "w-7 bg-indigo-600" : "w-2.5 bg-slate-300"}`} />
              ))}
            </div>
            <button onClick={next} disabled={i === slides.length - 1}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-base font-semibold text-white hover:bg-indigo-500 disabled:opacity-40">
              Next <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-2 text-center text-sm text-slate-400">Tip: use ← / → arrow keys to navigate</p>
        </>
      )}
    </div>
  );
}
