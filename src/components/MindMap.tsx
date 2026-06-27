"use client";

import { useState, useCallback, useEffect } from "react";
import {
  ReactFlow, Background, Controls, MiniMap, type Node, type Edge, MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Brain } from "lucide-react";

type Branch = { key: string; label: string; color: string; items: string[] };

export default function MindMap() {
  const [cve, setCve] = useState("CVE-2026-12569");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const build = useCallback(async (cveId: string) => {
    if (!cveId.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/mindmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cve_id: cveId }),
      });
      const data = await res.json();
      if (data.error) { setErr(data.error); setBusy(false); return; }
      const { n, e } = layout(data.cve, data.title, data.branches);
      setNodes(n);
      setEdges(e);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
    setBusy(false);
  }, [busy]);

  // Auto-generate the default CVE on first load so the canvas isn't empty.
  useEffect(() => { build("CVE-2026-12569"); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input
          className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-base outline-none focus:border-indigo-500 focus:bg-white"
          placeholder="Enter a CVE id, e.g. CVE-2026-12569"
          value={cve}
          onChange={(e) => setCve(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && build(cve)}
        />
        <button
          onClick={() => build(cve)}
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-6 py-3 text-base font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Building…" : "Generate Mind Map"}
        </button>
      </div>

      {err && <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-base text-red-700">{err}</div>}

      <div className="h-[70vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {nodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-slate-400">
            <Brain className="h-12 w-12" />
            <p className="mt-3 text-base">Generate a mind map to explore a CVE as a connected graph.</p>
          </div>
        ) : (
          <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
            <Background color="#e2e8f0" gap={20} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}

function layout(cve: string, title: string, branches: Branch[]) {
  const n: Node[] = [];
  const e: Edge[] = [];

  const ROW = 58;        // vertical slot per leaf · guarantees no overlap
  const GROUP_GAP = 26;  // extra space between branches
  const X_ROOT = 0, X_BRANCH = 320, X_LEAF = 640;

  // Stack every leaf in one global column; each gets a unique y slot.
  let y = 0;
  const branchYs: number[] = [];

  branches.forEach((b) => {
    const bid = `b-${b.key}`;
    const leafYs: number[] = [];

    b.items.forEach((item, ii) => {
      const iid = `${bid}-i-${ii}`;
      const ly = y;
      leafYs.push(ly);
      y += ROW;
      n.push({
        id: iid,
        position: { x: X_LEAF, y: ly },
        data: { label: truncate(item, 40) },
        style: leafStyle(b.color),
        targetPosition: "left" as any,
      });
      e.push({ id: `e-${bid}-${iid}`, source: bid, target: iid, style: { stroke: b.color, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: b.color } });
    });

    const by = leafYs.reduce((a, c) => a + c, 0) / leafYs.length;
    branchYs.push(by);
    n.push({
      id: bid,
      position: { x: X_BRANCH, y: by },
      data: { label: b.label },
      style: branchStyle(b.color),
      sourcePosition: "right" as any,
      targetPosition: "left" as any,
    });
    e.push({ id: `e-root-${bid}`, source: "root", target: bid, animated: true, style: { stroke: b.color, strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: b.color } });

    y += GROUP_GAP;
  });

  const rootY = branchYs.reduce((a, c) => a + c, 0) / branchYs.length;
  n.unshift({
    id: "root",
    position: { x: X_ROOT, y: rootY },
    data: { label: `${cve}${title ? "\n" + title : ""}` },
    style: rootStyle(),
    sourcePosition: "right" as any,
  });

  return { n, e };
}

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

function rootStyle(): React.CSSProperties {
  return {
    background: "linear-gradient(135deg,#4f46e5,#06b6d4)",
    color: "white",
    fontWeight: 700,
    fontSize: 13,
    borderRadius: 14,
    padding: 14,
    width: 200,
    textAlign: "center",
    whiteSpace: "pre-line",
    border: "none",
  };
}
function branchStyle(color: string): React.CSSProperties {
  return {
    background: "white",
    color,
    fontWeight: 700,
    fontSize: 12,
    borderRadius: 12,
    padding: 10,
    width: 180,
    textAlign: "center",
    border: `2px solid ${color}`,
  };
}
function leafStyle(color: string): React.CSSProperties {
  return {
    background: `${color}14`,
    color: "#0f172a",
    fontSize: 11,
    borderRadius: 10,
    padding: 8,
    width: 220,
    border: `1px solid ${color}55`,
  };
}
