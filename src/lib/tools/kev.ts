import fs from "node:fs";
import path from "node:path";

// ---- Load + index the CISA KEV catalog once at module load ----
type KevEntry = {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
  dueDate: string;
  knownRansomwareCampaignUse: string;
  notes: string;
  cwes?: string[];
};

let KEV_INDEX: Map<string, KevEntry> | null = null;
let CATALOG_VERSION = "unknown";

function loadKev(): Map<string, KevEntry> {
  if (KEV_INDEX) return KEV_INDEX;
  const p = path.join(process.cwd(), "data", "kev", "cisa-kev.json");
  const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
  CATALOG_VERSION = raw.catalogVersion ?? "unknown";
  const idx = new Map<string, KevEntry>();
  for (const v of raw.vulnerabilities as KevEntry[]) {
    idx.set(v.cveID.toUpperCase(), v);
  }
  KEV_INDEX = idx;
  return idx;
}

/**
 * Blue-team tool: deterministic patch-priority lookup.
 * The LLM must NOT invent KEV status · this is the source of truth.
 */
export function kevCheck(args: { cve_id: string }) {
  const idx = loadKev();
  const cve = (args.cve_id || "").trim().toUpperCase();
  const entry = idx.get(cve);

  if (!entry) {
    return {
      cve_id: cve,
      in_kev: false,
      exploited_in_the_wild: false,
      patch_priority: "P3 · Standard",
      rationale:
        "Not present in the CISA Known Exploited Vulnerabilities catalog. " +
        "No confirmed in-the-wild exploitation on record; patch per normal SLA based on CVSS/exposure.",
      catalog_version: CATALOG_VERSION,
    };
  }

  const ransomware =
    /known/i.test(entry.knownRansomwareCampaignUse) &&
    !/unknown/i.test(entry.knownRansomwareCampaignUse);

  // Deterministic priority: ransomware-linked or past-due KEV = emergency.
  const overdue = computeOverdue(entry.dueDate);
  let patch_priority: string;
  if (ransomware) patch_priority = "P0 · Emergency (ransomware-linked, exploited in the wild)";
  else if (overdue) patch_priority = "P0 · Emergency (KEV due date passed)";
  else patch_priority = "P1 · Critical (actively exploited; remediate by CISA due date)";

  return {
    cve_id: entry.cveID,
    in_kev: true,
    exploited_in_the_wild: true,
    vendor: entry.vendorProject,
    product: entry.product,
    name: entry.vulnerabilityName,
    date_added: entry.dateAdded,
    due_date: entry.dueDate,
    overdue,
    known_ransomware_use: ransomware,
    required_action: entry.requiredAction,
    cwes: entry.cwes ?? [],
    patch_priority,
    rationale:
      `Listed in CISA KEV (added ${entry.dateAdded}, remediation due ${entry.dueDate}). ` +
      `Confirmed exploited in the wild${ransomware ? ", with known ransomware-campaign use" : ""}. ` +
      `${overdue ? "Remediation deadline has PASSED · escalate immediately." : "Prioritize ahead of non-KEV items."}`,
    catalog_version: CATALOG_VERSION,
  };
}

function computeOverdue(dueDate: string): boolean {
  // Compare against build-time today via env-injected date to stay deterministic in serverless.
  const today = new Date().toISOString().slice(0, 10);
  return dueDate < today;
}

export const kevDeclaration = {
  name: "kev_check",
  description:
    "BLUE TEAM. Look up a CVE in the CISA Known Exploited Vulnerabilities (KEV) catalog. " +
    "Returns whether it is exploited in the wild, ransomware-campaign use, the CISA remediation due date, " +
    "and a deterministic patch-priority (P0/P1/P3). Use this for any patch-prioritization or 'is it being exploited' question.",
  parameters: {
    type: "OBJECT",
    properties: {
      cve_id: { type: "STRING", description: "A CVE identifier, e.g. CVE-2026-12569" },
    },
    required: ["cve_id"],
  },
} as const;
