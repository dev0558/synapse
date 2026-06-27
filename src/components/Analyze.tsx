"use client";

import { useRef, useState } from "react";
import { Swords, ShieldCheck, Wrench, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

type Stage = { name: string; status: "running" | "done" | "error"; detail?: string };
type ToolCall = { name: string; args: any; summary: string };
type Source = { title: string; uri: string };
type Answer = {
  summary: string;
  severity?: { cvss?: number; band?: string };
  attacker_view: { exploitation_path: string; poc_status: string; attack_techniques: string[]; blast_radius: string };
  defender_view: {
    exploited_in_the_wild: boolean;
    patch_priority: string;
    detection_guidance: string[];
    hunt_queries: string[];
    mitigations: string[];
  };
  citations: { source: string; detail: string }[];
};
type Critique = { verified: boolean; issues: string[]; notes: string };

const EXAMPLES = [
  "What's the exploitation path, blast radius and patch priority for CVE-2026-12569?",
  "Is CVE-2026-12569 exploited in the wild, and what hunt queries should my SOC run?",
  "Score CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H · attacker and defender picture.",
];

export default function Analyze() {
  const [question, setQuestion] = useState("");
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<Stage[]>([]);
  const [tools, setTools] = useState<ToolCall[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [critique, setCritique] = useState<Critique | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function ask(q: string) {
    if (!q.trim() || running) return;
    setRunning(true);
    setStages([]); setTools([]); setSources([]); setAnswer(null); setCritique(null); setError(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!res.body) { setError("No response stream"); setRunning(false); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try { handleEvent(JSON.parse(line)); } catch {}
        }
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
    setRunning(false);
  }

  function handleEvent(e: any) {
    switch (e.type) {
      case "stage":
        setStages((prev) => {
          const i = prev.findIndex((s) => s.name === e.name);
          const next = [...prev];
          const v = { name: e.name, status: e.status, detail: e.detail };
          if (i >= 0) next[i] = v; else next.push(v);
          return next;
        });
        break;
      case "tool": setTools((p) => [...p, { name: e.name, args: e.args, summary: e.summary }]); break;
      case "source": setSources((p) => [...p, { title: e.title, uri: e.uri }]); break;
      case "answer": setAnswer(e.data); break;
      case "critique": setCritique({ verified: e.verified, issues: e.issues, notes: e.notes }); break;
      case "error": setError(e.message); break;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex gap-3">
          <input
            className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-5 py-4 text-lg text-slate-900 outline-none focus:border-indigo-500 focus:bg-white"
            placeholder="Ask about a CVE, CVSS vector, exploitation path, detection logic…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(question)}
            disabled={running}
          />
          <button
            className="rounded-xl bg-indigo-600 px-8 py-4 text-lg font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            onClick={() => ask(question)}
            disabled={running}
          >
            {running ? "Running…" : "Analyze"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => { setQuestion(ex); ask(ex); }}
              disabled={running}
              className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-base text-slate-600 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-50"
            >
              {ex.length > 70 ? ex.slice(0, 70) + "…" : ex}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-base text-red-700">{error}</div>
      )}

      {stages.length > 0 && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Live Run</h2>
          <div className="flex flex-wrap items-center gap-2">
            {stages.map((s) => (
              <div
                key={s.name}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-base transition ${
                  s.status === "done"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : s.status === "error"
                    ? "border-amber-300 bg-amber-50 text-amber-700"
                    : "border-indigo-300 bg-indigo-50 text-indigo-700"
                }`}
              >
                {s.status === "done" ? <CheckCircle2 className="h-5 w-5" /> : s.status === "error" ? <AlertTriangle className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
                <span className="font-medium">{s.name}</span>
                {s.detail && <span className="text-sm opacity-70">· {s.detail}</span>}
              </div>
            ))}
          </div>
          {tools.length > 0 && (
            <div className="mt-4 space-y-2">
              {tools.map((t, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <Wrench className="mt-0.5 h-4 w-4 text-indigo-500" />
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-indigo-600">{t.name}</span>
                  <span>{t.summary}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {answer && (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-700">Summary</h2>
              {answer.severity?.cvss != null && (
                <span className={`rounded-md px-3 py-1 text-sm font-bold ${sevColor(answer.severity.band)}`}>
                  CVSS {answer.severity.cvss} {answer.severity.band}
                </span>
              )}
            </div>
            <p className="mt-2 text-base leading-relaxed text-slate-700">{answer.summary}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-rose-700">
                <Swords className="h-6 w-6" /> ATTACKER VIEW
              </h3>
              <Field label="Exploitation path" value={answer.attacker_view.exploitation_path} />
              <Field label="PoC status" value={answer.attacker_view.poc_status} />
              <Field label="Blast radius" value={answer.attacker_view.blast_radius} />
              <Tags label="ATT&CK techniques" items={answer.attacker_view.attack_techniques} tone="red" />
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-blue-700">
                <ShieldCheck className="h-6 w-6" /> DEFENDER VIEW
              </h3>
              <div className="mb-3 flex flex-wrap gap-2">
                <span className={`flex items-center gap-1 rounded px-2 py-1 text-sm font-semibold ${answer.defender_view.exploited_in_the_wild ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                  {answer.defender_view.exploited_in_the_wild && <AlertTriangle className="h-4 w-4" />}
                  {answer.defender_view.exploited_in_the_wild ? "Exploited in the wild" : "No confirmed ITW exploitation"}
                </span>
                <span className="rounded bg-blue-100 px-2 py-1 text-sm font-semibold text-blue-700">
                  {answer.defender_view.patch_priority}
                </span>
              </div>
              <List label="Detection guidance" items={answer.defender_view.detection_guidance} />
              <CodeList label="Threat-hunt queries" items={answer.defender_view.hunt_queries} />
              <List label="Mitigations" items={answer.defender_view.mitigations} />
            </div>
          </div>

          {answer.citations?.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">Citations</h3>
              <ul className="space-y-1 text-sm text-slate-600">
                {answer.citations.map((c, i) => (
                  <li key={i}><span className="font-mono text-indigo-600">{c.source}</span> · {c.detail}</li>
                ))}
              </ul>
            </div>
          )}

          {sources.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">Live web sources</h3>
              <ul className="space-y-1 text-sm">
                {sources.map((s, i) => (
                  <li key={i}><a href={s.uri} target="_blank" className="text-indigo-600 hover:underline">{s.title}</a></li>
                ))}
              </ul>
            </div>
          )}

          {critique && (
            <div className={`flex items-start gap-2 rounded-2xl border p-4 text-base ${critique.verified ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
              {critique.verified ? <CheckCircle2 className="mt-0.5 h-5 w-5" /> : <AlertTriangle className="mt-0.5 h-5 w-5" />}
              <div>
                <span className="font-semibold">{critique.verified ? "Self-critique passed · all claims supported" : "Self-critique flags"}</span>
                {!critique.verified && critique.issues?.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-sm">{critique.issues.map((x, i) => <li key={i}>{x}</li>)}</ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3">
      <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-base text-slate-700">{value}</div>
    </div>
  );
}
function List({ label, items }: { label: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mb-3">
      <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-base text-slate-700">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}
function CodeList({ label, items }: { label: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mb-3">
      <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 space-y-1">
        {items.map((x, i) => (
          <pre key={i} className="overflow-x-auto rounded bg-slate-900 px-3 py-2 font-mono text-sm text-emerald-300">{x}</pre>
        ))}
      </div>
    </div>
  );
}
function Tags({ label, items, tone }: { label: string; items: string[]; tone: "red" | "blue" }) {
  if (!items?.length) return null;
  return (
    <div className="mb-1">
      <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {items.map((x, i) => (
          <span key={i} className={`rounded px-2.5 py-1 text-sm ${tone === "red" ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"}`}>{x}</span>
        ))}
      </div>
    </div>
  );
}
function sevColor(band?: string) {
  switch (band) {
    case "Critical": return "bg-red-600 text-white";
    case "High": return "bg-orange-500 text-white";
    case "Medium": return "bg-yellow-400 text-slate-900";
    case "Low": return "bg-emerald-600 text-white";
    default: return "bg-slate-200 text-slate-700";
  }
}
