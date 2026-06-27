import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

type KevEntry = {
  cveID: string;
  vendorProject: string;
  product: string;
  dateAdded: string;
  dueDate: string;
  knownRansomwareCampaignUse: string;
  cwes?: string[];
};

let CACHE: any = null;

export async function GET() {
  if (CACHE) return Response.json(CACHE);

  const p = path.join(process.cwd(), "data", "kev", "cisa-kev.json");
  const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
  const vulns: KevEntry[] = raw.vulnerabilities ?? [];

  const ransomware = vulns.filter(
    (v) => /known/i.test(v.knownRansomwareCampaignUse) && !/unknown/i.test(v.knownRansomwareCampaignUse)
  ).length;

  // Top vendors
  const vendorCount: Record<string, number> = {};
  for (const v of vulns) vendorCount[v.vendorProject] = (vendorCount[v.vendorProject] ?? 0) + 1;
  const topVendors = Object.entries(vendorCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // CWE distribution
  const cweCount: Record<string, number> = {};
  for (const v of vulns) for (const c of v.cwes ?? []) cweCount[c] = (cweCount[c] ?? 0) + 1;
  const topCwes = Object.entries(cweCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  // Additions per month (last 12 buckets)
  const monthCount: Record<string, number> = {};
  for (const v of vulns) {
    const ym = (v.dateAdded || "").slice(0, 7);
    if (ym) monthCount[ym] = (monthCount[ym] ?? 0) + 1;
  }
  const timeline = Object.entries(monthCount)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));

  CACHE = {
    catalogVersion: raw.catalogVersion,
    total: vulns.length,
    ransomware,
    ransomwarePct: Math.round((ransomware / vulns.length) * 100),
    uniqueVendors: Object.keys(vendorCount).length,
    topVendors,
    topCwes,
    timeline,
  };
  return Response.json(CACHE);
}
