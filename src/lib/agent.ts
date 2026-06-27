import { Type } from "@google/genai";
import { ai, MODELS } from "./gemini";
import { runTool } from "./tools";

// ---------- Streamed pipeline events ----------
export type AgentEvent =
  | { type: "stage"; name: string; status: "running" | "done" | "error"; detail?: string }
  | { type: "tool"; name: string; args: any; summary: string }
  | { type: "source"; title: string; uri: string }
  | { type: "answer"; data: SynapseAnswer }
  | { type: "critique"; verified: boolean; issues: string[]; notes: string }
  | { type: "error"; message: string }
  | { type: "done" };

export type Emit = (e: AgentEvent) => void;

export type SynapseAnswer = {
  summary: string;
  severity?: { cvss?: number; band?: string };
  attacker_view: {
    exploitation_path: string;
    poc_status: string;
    attack_techniques: string[];
    blast_radius: string;
  };
  defender_view: {
    exploited_in_the_wild: boolean;
    patch_priority: string;
    detection_guidance: string[];
    hunt_queries: string[];
    mitigations: string[];
  };
  citations: { source: string; detail: string }[];
};

// ---------- Small helper: structured JSON generation ----------
async function genJson<T>(prompt: string, schema: any, model = MODELS.workhorse): Promise<T> {
  const res = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema },
  });
  const text = res.text ?? "{}";
  return JSON.parse(text) as T;
}

// ---------- Stage 1: Planner ----------
type Plan = {
  intent: string;
  sub_questions: string[];
  cve_ids: string[];
  cvss_vectors: string[];
  needs_web: boolean;
  rationale: string;
};

const PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING },
    sub_questions: { type: Type.ARRAY, items: { type: Type.STRING } },
    cve_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
    cvss_vectors: { type: Type.ARRAY, items: { type: Type.STRING } },
    needs_web: { type: Type.BOOLEAN },
    rationale: { type: Type.STRING },
  },
  required: ["intent", "sub_questions", "cve_ids", "cvss_vectors", "needs_web", "rationale"],
};

async function plan(question: string): Promise<Plan> {
  return genJson<Plan>(
    `You are the PLANNER for SYNAPSE, a purple-team CVE/threat-intel research agent.
Decompose this analyst question into sub-questions and extract any CVE IDs (format CVE-YYYY-NNNN)
and any CVSS v3.1 vector strings present. Decide if live web grounding is needed (true when the
question asks about "latest", current exploit/PoC status, or anything time-sensitive).

QUESTION: """${question}"""`,
    PLAN_SCHEMA
  );
}

// ---------- Stage 2: deterministic tools ----------
async function runDeterministicTools(p: Plan, emit: Emit) {
  const results: Record<string, any> = {};
  for (const cve of p.cve_ids) {
    const kev = await runTool("kev_check", { cve_id: cve });
    results[`kev_check:${cve}`] = kev;
    emit({
      type: "tool",
      name: "kev_check",
      args: { cve_id: cve },
      summary: kev.in_kev
        ? `${cve}: EXPLOITED IN THE WILD · ${kev.patch_priority}`
        : `${cve}: not in CISA KEV · ${kev.patch_priority}`,
    });

    const det = await runTool("map_detections", { cve_id: cve });
    results[`map_detections:${cve}`] = det;
    emit({
      type: "tool",
      name: "map_detections",
      args: { cve_id: cve },
      summary: `${cve}: mapped ${det.detections?.length ?? 0} weakness class(es) → ATT&CK + hunts`,
    });
  }
  for (const vec of p.cvss_vectors) {
    const cvss = await runTool("cvss_lookup", { vector: vec });
    results[`cvss_lookup:${vec}`] = cvss;
    emit({
      type: "tool",
      name: "cvss_lookup",
      args: { vector: vec },
      summary: cvss.error ? cvss.error : `CVSS ${cvss.base_score} (${cvss.severity})`,
    });
  }
  return results;
}

// ---------- Stage 3: Web grounding (optional) ----------
async function webGround(question: string, emit: Emit) {
  const res = await ai.models.generateContent({
    model: MODELS.workhorse,
    contents: `Find the latest public information (exploit/PoC availability, active exploitation,
vendor patch status) relevant to: ${question}. Be concise and factual.`,
    config: { tools: [{ googleSearch: {} }] },
  });
  const meta = res.candidates?.[0]?.groundingMetadata as any;
  const chunks = meta?.groundingChunks ?? [];
  const sources: { title: string; uri: string }[] = [];
  for (const c of chunks) {
    if (c.web?.uri) {
      sources.push({ title: c.web.title ?? c.web.uri, uri: c.web.uri });
      emit({ type: "source", title: c.web.title ?? c.web.uri, uri: c.web.uri });
    }
  }
  return { text: res.text ?? "", sources, searchEntryPoint: meta?.searchEntryPoint?.renderedContent ?? null };
}

// ---------- Stage 4: Synthesizer (structured red/blue) ----------
const ANSWER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    severity: {
      type: Type.OBJECT,
      properties: { cvss: { type: Type.NUMBER }, band: { type: Type.STRING } },
    },
    attacker_view: {
      type: Type.OBJECT,
      properties: {
        exploitation_path: { type: Type.STRING },
        poc_status: { type: Type.STRING },
        attack_techniques: { type: Type.ARRAY, items: { type: Type.STRING } },
        blast_radius: { type: Type.STRING },
      },
      required: ["exploitation_path", "poc_status", "attack_techniques", "blast_radius"],
    },
    defender_view: {
      type: Type.OBJECT,
      properties: {
        exploited_in_the_wild: { type: Type.BOOLEAN },
        patch_priority: { type: Type.STRING },
        detection_guidance: { type: Type.ARRAY, items: { type: Type.STRING } },
        hunt_queries: { type: Type.ARRAY, items: { type: Type.STRING } },
        mitigations: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["exploited_in_the_wild", "patch_priority", "detection_guidance", "hunt_queries", "mitigations"],
    },
    citations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { source: { type: Type.STRING }, detail: { type: Type.STRING } },
        required: ["source", "detail"],
      },
    },
  },
  required: ["summary", "attacker_view", "defender_view", "citations"],
};

async function synthesize(
  question: string,
  toolResults: Record<string, any>,
  web: { text: string; sources: { title: string; uri: string }[] } | null
): Promise<SynapseAnswer> {
  const prompt = `You are the SYNTHESIZER for SYNAPSE, a purple-team threat-intel assistant.
Compose a cited brief answering the analyst question, split into an Attacker view (red) and a
Defender view (blue).

STRICT RULES:
- Ground every factual claim in the TOOL RESULTS or WEB FINDINGS below. Do NOT invent CVSS scores,
  KEV status, ATT&CK techniques, or detections · use only what the tools returned.
- For defender_view.exploited_in_the_wild, patch_priority, detection_guidance, hunt_queries and
  mitigations, copy from the kev_check / map_detections tool outputs.
- Cite sources in "citations": name the tool (e.g. "CISA KEV", "cvss_lookup", "map_detections")
  or the web URL, with a one-line detail.

QUESTION: """${question}"""

TOOL RESULTS (authoritative):
${JSON.stringify(toolResults, null, 2)}

WEB FINDINGS (may be empty):
${web ? web.text + "\nSources:\n" + web.sources.map((s) => `- ${s.title} (${s.uri})`).join("\n") : "(none)"}`;

  return genJson<SynapseAnswer>(prompt, ANSWER_SCHEMA);
}

// ---------- Stage 5: Self-critique ----------
const CRITIQUE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    verified: { type: Type.BOOLEAN },
    issues: { type: Type.ARRAY, items: { type: Type.STRING } },
    notes: { type: Type.STRING },
  },
  required: ["verified", "issues", "notes"],
};

async function critique(
  answer: SynapseAnswer,
  toolResults: Record<string, any>,
  web: { text: string; sources: { title: string; uri: string }[] } | null
) {
  return genJson<{ verified: boolean; issues: string[]; notes: string }>(
    `You are the CRITIC for SYNAPSE. Verify the ANSWER is well-grounded.

A claim is SUPPORTED if it is backed by EITHER the TOOL RESULTS or the WEB FINDINGS below.
Treat both as valid evidence sources. General security best-practice guidance (e.g. "apply the
vendor patch", "segment the network") is acceptable and does not need a citation.

Only flag a claim when it is clearly FABRICATED or CONTRADICTED by the evidence — specifically:
- a CVSS score, KEV/exploited-in-the-wild status, or ATT&CK technique that conflicts with the tools, or
- a specific factual claim that appears in neither the tool results nor the web findings.

Do NOT flag wording, formatting, or claims that the web findings reasonably support.
Return verified=true if there are no fabricated or contradicted claims (issues may be empty).

ANSWER:
${JSON.stringify(answer, null, 2)}

TOOL RESULTS:
${JSON.stringify(toolResults, null, 2)}

WEB FINDINGS:
${web ? web.text + "\nSources:\n" + web.sources.map((s) => `- ${s.title} (${s.uri})`).join("\n") : "(none)"}`,
    CRITIQUE_SCHEMA
  );
}

// ---------- Orchestrator ----------
export async function runAgent(question: string, emit: Emit) {
  try {
    // Stage 1
    emit({ type: "stage", name: "Planning", status: "running" });
    const p = await plan(question);
    emit({
      type: "stage",
      name: "Planning",
      status: "done",
      detail: `${p.sub_questions.length} sub-questions · ${p.cve_ids.length} CVE(s)${p.needs_web ? " · web grounding" : ""}`,
    });

    // Stage 2
    emit({ type: "stage", name: "Retrieving (red and blue tools)", status: "running" });
    const toolResults = await runDeterministicTools(p, emit);
    emit({ type: "stage", name: "Retrieving (red and blue tools)", status: "done" });

    // Stage 3
    let web: { text: string; sources: { title: string; uri: string }[] } | null = null;
    if (p.needs_web) {
      emit({ type: "stage", name: "Web grounding", status: "running" });
      try {
        web = await webGround(question, emit);
        emit({ type: "stage", name: "Web grounding", status: "done", detail: `${web.sources.length} source(s)` });
      } catch (e: any) {
        emit({ type: "stage", name: "Web grounding", status: "error", detail: "skipped (grounding unavailable)" });
      }
    }

    // Stage 4
    emit({ type: "stage", name: "Synthesizing", status: "running" });
    const answer = await synthesize(question, toolResults, web);
    emit({ type: "stage", name: "Synthesizing", status: "done" });
    emit({ type: "answer", data: answer });

    // Stage 5
    emit({ type: "stage", name: "Verifying citations", status: "running" });
    const c = await critique(answer, toolResults, web);
    emit({ type: "stage", name: "Verifying citations", status: "done", detail: c.verified ? "all claims supported" : `${c.issues.length} flag(s)` });
    emit({ type: "critique", verified: c.verified, issues: c.issues, notes: c.notes });

    emit({ type: "done" });
  } catch (e: any) {
    emit({ type: "error", message: e?.message ?? String(e) });
  }
}
