"use client";

import { useRef, useState } from "react";
import { FileText, Upload, Paperclip, MessageSquare } from "lucide-react";

type QA = { q: string; a: string };

export default function Docs() {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [mimeType, setMimeType] = useState<string>("");
  const [b64, setB64] = useState<string>("");
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<QA[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(f: File) {
    setErr(null);
    setHistory([]);
    setFileName(f.name);
    setMimeType(f.type || guessMime(f.name));
    setFileUrl(URL.createObjectURL(f));

    const buf = await f.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    setB64(btoa(binary));

    if ((f.type || "").startsWith("text") || /\.(txt|md|json|log|csv|yaml|yml)$/i.test(f.name)) {
      setTextPreview(new TextDecoder().decode(buf).slice(0, 20000));
    } else {
      setTextPreview(null);
    }
  }

  async function ask() {
    if (!question.trim() || !b64 || busy) return;
    setBusy(true);
    setErr(null);
    const q = question;
    setQuestion("");
    try {
      const res = await fetch("/api/doc-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType, dataBase64: b64, question: q }),
      });
      const data = await res.json();
      if (data.error) setErr(data.error);
      else setHistory((h) => [...h, { q, a: data.answer }]);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-700">
            <FileText className="h-4 w-4 text-indigo-600" /> Document Viewer
          </h3>
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            <Upload className="h-4 w-4" /> Upload file
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.txt,.md,.json,.log,.csv,.yaml,.yml,application/pdf,text/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </div>

        {!fileUrl && (
          <div
            onClick={() => inputRef.current?.click()}
            className="flex h-64 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500"
          >
            <Paperclip className="h-8 w-8" />
            <p className="mt-2 text-sm">Click to upload an advisory, pentest report, or threat PDF</p>
            <p className="text-xs">PDF · TXT · MD · JSON · LOG · CSV · YAML</p>
          </div>
        )}

        {fileUrl && (
          <>
            <div className="mb-2 text-xs text-slate-500">
              <span className="font-mono">{fileName}</span> · {mimeType || "unknown"}
            </div>
            {textPreview !== null ? (
              <pre className="h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                {textPreview}
              </pre>
            ) : (
              <iframe src={fileUrl} className="h-64 w-full rounded-lg border border-slate-200" title="document" />
            )}
          </>
        )}
      </div>

      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-700">
          <MessageSquare className="h-4 w-4 text-indigo-600" /> Ask the document
        </h3>

        <div className="flex-1 space-y-3 overflow-y-auto" style={{ maxHeight: "18rem" }}>
          {history.length === 0 && (
            <p className="text-sm text-slate-400">
              Upload a document, then ask things like “What are the critical findings and remediation
              order?”, “Extract all IOCs”, or “Map the TTPs to MITRE ATT&CK.”
            </p>
          )}
          {history.map((qa, i) => (
            <div key={i} className="space-y-1">
              <div className="rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800">{qa.q}</div>
              <div className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{qa.a}</div>
            </div>
          ))}
          {busy && <div className="text-sm text-slate-400">Reading the document…</div>}
          {err && <div className="rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-700">{err}</div>}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:bg-white disabled:opacity-50"
            placeholder={b64 ? "Ask about this document…" : "Upload a document first"}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            disabled={!b64 || busy}
          />
          <button
            onClick={ask}
            disabled={!b64 || busy}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}

function guessMime(name: string) {
  if (/\.pdf$/i.test(name)) return "application/pdf";
  if (/\.(txt|log)$/i.test(name)) return "text/plain";
  if (/\.md$/i.test(name)) return "text/markdown";
  if (/\.json$/i.test(name)) return "application/json";
  if (/\.csv$/i.test(name)) return "text/csv";
  return "application/octet-stream";
}
