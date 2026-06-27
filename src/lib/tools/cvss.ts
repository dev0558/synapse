// Red-team tool: deterministic CVSS v3.1 base-score computation from a vector string.
// The LLM must NOT estimate scores · it calls this for exact math + severity band.

const W = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  AC: { L: 0.77, H: 0.44 },
  PR: { N: 0.85, L: 0.62, H: 0.27 }, // unchanged-scope values; adjusted below if scope changed
  PR_C: { N: 0.85, L: 0.68, H: 0.5 }, // changed-scope values
  UI: { N: 0.85, R: 0.62 },
  CIA: { H: 0.56, L: 0.22, N: 0.0 },
} as const;

function band(score: number): string {
  if (score === 0) return "None";
  if (score < 4) return "Low";
  if (score < 7) return "Medium";
  if (score < 9) return "High";
  return "Critical";
}

const roundUp1 = (n: number) => Math.ceil(n * 10) / 10;

export function cvssLookup(args: { vector: string }) {
  const v = (args.vector || "").toUpperCase().replace(/^CVSS:3\.[01]\//, "");
  const m: Record<string, string> = {};
  for (const part of v.split("/")) {
    const [k, val] = part.split(":");
    if (k && val) m[k] = val;
  }
  const need = ["AV", "AC", "PR", "UI", "S", "C", "I", "A"];
  const missing = need.filter((k) => !(k in m));
  if (missing.length) {
    return { error: `Invalid/incomplete CVSS vector. Missing: ${missing.join(", ")}`, vector: args.vector };
  }

  const scopeChanged = m.S === "C";
  const prTable = scopeChanged ? W.PR_C : W.PR;

  const iss =
    1 - (1 - W.CIA[m.C as keyof typeof W.CIA]) * (1 - W.CIA[m.I as keyof typeof W.CIA]) * (1 - W.CIA[m.A as keyof typeof W.CIA]);
  const impact = scopeChanged
    ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15)
    : 6.42 * iss;

  const exploitability =
    8.22 *
    W.AV[m.AV as keyof typeof W.AV] *
    W.AC[m.AC as keyof typeof W.AC] *
    prTable[m.PR as keyof typeof prTable] *
    W.UI[m.UI as keyof typeof W.UI];

  let base = 0;
  if (impact > 0) {
    base = scopeChanged
      ? roundUp1(Math.min(1.08 * (impact + exploitability), 10))
      : roundUp1(Math.min(impact + exploitability, 10));
  }

  return {
    vector: `CVSS:3.1/${v}`,
    base_score: base,
    severity: band(base),
    scope: scopeChanged ? "Changed" : "Unchanged",
    attack_vector: m.AV,
    privileges_required: m.PR,
    user_interaction: m.UI,
    impact_subscore: Math.round(impact * 10) / 10,
    exploitability_subscore: Math.round(exploitability * 10) / 10,
  };
}

export const cvssDeclaration = {
  name: "cvss_lookup",
  description:
    "RED TEAM. Compute the exact CVSS v3.1 base score and severity band from a CVSS vector string " +
    "(e.g. 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'). Always use this for scoring · never estimate.",
  parameters: {
    type: "OBJECT",
    properties: {
      vector: { type: "STRING", description: "A CVSS v3.1 vector string." },
    },
    required: ["vector"],
  },
} as const;
