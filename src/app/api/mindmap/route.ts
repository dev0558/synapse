import { NextRequest } from "next/server";
import { runTool } from "@/lib/tools";

export const runtime = "nodejs";

// Build a NotebookLM-style mind map for a CVE from deterministic tool outputs.
export async function POST(req: NextRequest) {
  let cve = "";
  try {
    cve = ((await req.json())?.cve_id ?? "").toString().trim().toUpperCase();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!/^CVE-\d{4}-\d+$/i.test(cve)) {
    return Response.json({ error: "Provide a valid CVE id, e.g. CVE-2026-12569" }, { status: 400 });
  }

  const kev = await runTool("kev_check", { cve_id: cve });
  const det = await runTool("map_detections", { cve_id: cve });

  // Collect ATT&CK techniques + mitigations across matched CWEs.
  const techniques = new Set<string>();
  const mitigations = new Set<string>();
  for (const d of det.detections ?? []) {
    (d.attack_techniques ?? []).forEach((t: string) => techniques.add(t));
    (d.mitigations ?? []).forEach((m: string) => mitigations.add(m));
  }

  const title = kev.in_kev ? `${kev.vendor ?? ""} ${kev.product ?? ""}`.trim() : cve;

  // Keep it focused: a few branches, max 3 concise items each. No noise.
  const branches = [
    {
      key: "severity",
      label: "Severity",
      color: "#f59e0b",
      items: [
        kev.in_kev ? "In CISA KEV" : "Not in CISA KEV",
        kev.patch_priority,
        kev.due_date ? `Patch by ${kev.due_date}` : null,
      ].filter(Boolean).slice(0, 3) as string[],
    },
    {
      key: "weakness",
      label: "Weakness",
      color: "#8b5cf6",
      items: ((det.resolved_cwes ?? []).length ? det.resolved_cwes : ["No CWE mapped"]).slice(0, 3),
    },
    {
      key: "attacker",
      label: "Attacker (ATT&CK)",
      color: "#ef4444",
      items: (techniques.size ? [...techniques] : ["T1190 Exploit Public-Facing App"]).slice(0, 3),
    },
    {
      key: "defender",
      label: "Defender",
      color: "#3b82f6",
      items: (mitigations.size ? [...mitigations] : ["Apply vendor patch"]).slice(0, 3),
    },
  ];

  return Response.json({ cve, title, branches });
}
