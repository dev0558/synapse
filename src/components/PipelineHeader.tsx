import { Compass, ShieldHalf, Globe, Zap, CheckCircle2, type LucideIcon } from "lucide-react";

const STEPS: { Icon: LucideIcon; label: string; sub: string; color: string }[] = [
  { Icon: Compass, label: "Plan", sub: "decompose", color: "bg-violet-500" },
  { Icon: ShieldHalf, label: "Retrieve", sub: "red and blue tools", color: "bg-rose-500" },
  { Icon: Globe, label: "Web-ground", sub: "live status", color: "bg-emerald-500" },
  { Icon: Zap, label: "Synthesize", sub: "cited brief", color: "bg-amber-500" },
  { Icon: CheckCircle2, label: "Verify", sub: "self-critique", color: "bg-cyan-500" },
];

export default function PipelineHeader() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
        The Agentic Pipeline
      </p>
      <div className="flex items-center gap-2 overflow-x-auto">
        {STEPS.map(({ Icon, label, sub, color }, i) => (
          <div key={label} className="flex flex-1 items-center" style={{ minWidth: 0 }}>
            <div className="flex min-w-[96px] flex-1 items-center justify-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color} text-white shadow-sm`}>
                <Icon className="h-6 w-6" strokeWidth={2.2} />
              </div>
              <div className="leading-tight">
                <div className="text-base font-bold text-slate-800">{label}</div>
                <div className="text-xs text-slate-400">{sub}</div>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div className="h-px w-6 shrink-0 bg-slate-200" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
