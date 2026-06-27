"use client";

import { useRef, useState, useEffect } from "react";
import { Bot, ShieldHalf, Wrench, Send } from "lucide-react";

type Msg = { role: "user" | "model"; text: string };
type ToolPing = { name: string; args: any };

const SUGGESTIONS = [
  "Is CVE-2026-12569 being exploited right now?",
  "Score CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:H/A:N",
  "How do I hunt for CWE-502 deserialization attacks?",
];

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [tools, setTools] = useState<ToolPing[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, tools]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const history: Msg[] = [...messages, { role: "user", text }];
    setMessages(history);
    setInput("");
    setBusy(true);
    setTools([]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let answered = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let e: any;
          try { e = JSON.parse(line); } catch { continue; }
          if (e.type === "tool") setTools((p) => [...p, { name: e.name, args: e.args }]);
          else if (e.type === "text") { answered = true; setMessages((m) => [...m, { role: "model", text: e.text }]); }
          else if (e.type === "error") setMessages((m) => [...m, { role: "model", text: "Error: " + e.message }]);
        }
      }
      if (!answered) setMessages((m) => [...m, { role: "model", text: "(no response)" }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "model", text: "Error: " + (e?.message ?? String(e)) }]);
    }
    setBusy(false);
  }

  return (
    <div className="flex h-[72vh] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <Bot className="h-6 w-6" />
        </div>
        <div>
          <div className="text-base font-semibold text-slate-800">SYNAPSE Assistant</div>
          <div className="text-sm text-slate-400">Conversational · tool-augmented (KEV · CVSS · detections)</div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="mt-8 text-center">
            <ShieldHalf className="mx-auto h-12 w-12 text-indigo-400" />
            <p className="mt-3 text-base text-slate-400">Ask me anything about CVEs, exploitation, or defense.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-600">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-base ${
              m.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"
            }`}>
              {m.text}
            </div>
          </div>
        ))}

        {busy && tools.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tools.map((t, i) => (
              <span key={i} className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm text-amber-700 ring-1 ring-amber-200">
                <Wrench className="h-4 w-4" /> calling <span className="font-mono">{t.name}</span>({JSON.stringify(t.args)})
              </span>
            ))}
          </div>
        )}
        {busy && <div className="text-sm text-slate-400">SYNAPSE is thinking…</div>}
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-100 p-4">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-base outline-none focus:border-indigo-500 focus:bg-white"
            placeholder="Type a message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            disabled={busy}
          />
          <button
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-base font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            onClick={() => send(input)}
            disabled={busy}
          >
            <Send className="h-5 w-5" /> Send
          </button>
        </div>
      </div>
    </div>
  );
}
