"use client";

import { useEffect, useState } from "react";
import { Microscope, Brain, BarChart3, FileText, Bot, Presentation as PresentationIcon, Swords, ShieldCheck, Database, type LucideIcon } from "lucide-react";
import PipelineHeader from "@/components/PipelineHeader";
import Analyze from "@/components/Analyze";
import Dashboard from "@/components/Dashboard";
import Chat from "@/components/Chat";
import Docs from "@/components/Docs";
import MindMap from "@/components/MindMap";
import Presentation from "@/components/Presentation";

type Tab = "analyze" | "mindmap" | "dashboard" | "docs" | "chat" | "deck";

// Tabs ordered to follow the analyst workflow / pipeline:
// investigate -> visualize -> situational awareness -> documents -> converse -> deliver.
const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: "analyze", label: "Analyze", Icon: Microscope },
  { id: "mindmap", label: "Mind Map", Icon: Brain },
  { id: "dashboard", label: "Dashboard", Icon: BarChart3 },
  { id: "docs", label: "Docs", Icon: FileText },
  { id: "chat", label: "Chat", Icon: Bot },
  { id: "deck", label: "Presentation", Icon: PresentationIcon },
];

const HIGHLIGHTS: { Icon: LucideIcon; title: string; text: string; color: string }[] = [
  { Icon: Swords, title: "Attacker and Defender", text: "One CVE, two cited views · exploitation path for red teams, detection and patch priority for blue teams.", color: "text-rose-600" },
  { Icon: Database, title: "Real threat data", text: "Grounded in the live CISA KEV catalog and MITRE ATT&CK mappings · never invented.", color: "text-indigo-600" },
  { Icon: ShieldCheck, title: "Visible AI pipeline", text: "Watch the agent plan, retrieve, web-ground, synthesize, and self-verify in real time.", color: "text-cyan-600" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("analyze");

  // Deep-linkable tabs via URL hash (e.g. /#mindmap).
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace("#", "") as Tab;
      if (TABS.some((t) => t.id === h)) setTab(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const select = (id: Tab) => { setTab(id); if (typeof window !== "undefined") window.location.hash = id; };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Hero */}
        <header className="mb-8 text-center">
          <h1 className="text-6xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-indigo-600 to-cyan-500 bg-clip-text text-transparent">
              SYNAPSE
            </span>
          </h1>
          <p className="mt-3 text-2xl font-medium text-slate-600">
            Purple-Team CVE &amp; Threat-Intelligence Research Agent
          </p>
          <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-slate-500">
            An agentic threat-intelligence assistant: ask about any CVE or paste a CVSS vector, and a
            visible AI pipeline returns a cited brief split into an attacker view and a defender view.
          </p>
        </header>

        {/* What it does · highlights */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {HIGHLIGHTS.map(({ Icon, title, text, color }) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${color}`} />
                <h3 className="text-base font-bold text-slate-800">{title}</h3>
              </div>
              <p className="mt-1.5 text-sm leading-snug text-slate-500">{text}</p>
            </div>
          ))}
        </div>

        {/* Tab box */}
        <nav className="mb-8 grid grid-cols-3 gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:grid-cols-6">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => select(id)}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-xl px-3 py-4 text-base font-medium transition ${
                tab === id ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-6 w-6" />
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main>
          {tab === "analyze" && (
            <div className="space-y-6">
              <PipelineHeader />
              <Analyze />
            </div>
          )}
          {tab === "mindmap" && <MindMap />}
          {tab === "dashboard" && <Dashboard />}
          {tab === "docs" && <Docs />}
          {tab === "chat" && <Chat />}
          {tab === "deck" && <Presentation />}
        </main>

        <footer className="mt-8 text-center text-sm text-slate-400">
          Built with Google Antigravity · Gemini API · Next.js on Vercel · Data: CISA KEV and MITRE ATT&amp;CK
        </footer>
      </div>
    </div>
  );
}
