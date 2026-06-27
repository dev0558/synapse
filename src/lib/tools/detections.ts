import fs from "node:fs";
import path from "node:path";
import { kevCheck } from "./kev";

type DetectionEntry = {
  weakness: string;
  attack_techniques: string[];
  detection_guidance: string;
  hunt_queries: string[];
  mitigations: string[];
};

let KB: { cwe: Record<string, DetectionEntry>; default: DetectionEntry } | null = null;

function loadKb() {
  if (KB) return KB;
  const p = path.join(process.cwd(), "data", "detections", "detection-kb.json");
  KB = JSON.parse(fs.readFileSync(p, "utf-8"));
  return KB!;
}

/**
 * Blue-team tool: map a CVE (via its CWEs from KEV) or an explicit CWE to
 * concrete detection guidance, hunt queries, ATT&CK techniques, and mitigations.
 * The LLM uses this for the Defender view instead of inventing detections.
 */
export function mapDetections(args: { cve_id?: string; cwe?: string }) {
  const kb = loadKb();

  // Resolve CWEs: explicit cwe arg, else pull from KEV entry for the CVE.
  let cwes: string[] = [];
  let source = "explicit CWE";
  if (args.cwe) {
    cwes = [args.cwe.toUpperCase().startsWith("CWE-") ? args.cwe.toUpperCase() : `CWE-${args.cwe}`];
  } else if (args.cve_id) {
    const kev = kevCheck({ cve_id: args.cve_id });
    cwes = (kev.cwes as string[] | undefined) ?? [];
    source = kev.in_kev ? "CWEs from CISA KEV entry" : "no CWE found (CVE not in KEV)";
  }

  const matched = cwes
    .map((c) => ({ cwe: c, entry: kb.cwe[c] }))
    .filter((m) => m.entry);

  if (matched.length === 0) {
    return {
      cve_id: args.cve_id ?? null,
      resolved_cwes: cwes,
      source,
      used: "default playbook (no specific CWE match)",
      detections: [
        {
          cwe: "generic",
          weakness: kb.default.weakness,
          attack_techniques: kb.default.attack_techniques,
          detection_guidance: kb.default.detection_guidance,
          hunt_queries: kb.default.hunt_queries,
          mitigations: kb.default.mitigations,
        },
      ],
    };
  }

  return {
    cve_id: args.cve_id ?? null,
    resolved_cwes: cwes,
    source,
    detections: matched.map((m) => ({ cwe: m.cwe, ...m.entry })),
  };
}

export const detectionsDeclaration = {
  name: "map_detections",
  description:
    "BLUE TEAM. Given a CVE (or a CWE id) return concrete defensive guidance: mapped MITRE ATT&CK techniques, " +
    "detection logic, threat-hunt queries (Sigma-style pseudo-queries), and mitigating controls. " +
    "Use this to build the Defender view (detection + hunting + mitigation).",
  parameters: {
    type: "OBJECT",
    properties: {
      cve_id: { type: "STRING", description: "A CVE id, e.g. CVE-2026-12569 (CWEs are resolved from KEV)." },
      cwe: { type: "STRING", description: "Optional explicit weakness id, e.g. CWE-502." },
    },
    required: [],
  },
} as const;
