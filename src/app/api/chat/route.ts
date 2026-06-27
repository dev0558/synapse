import { NextRequest } from "next/server";
import { ai, MODELS } from "@/lib/gemini";
import { LOCAL_DECLARATIONS, runTool } from "@/lib/tools";

export const runtime = "nodejs";
export const maxDuration = 300;

const SYSTEM = `You are SYNAPSE, a purple-team cybersecurity assistant. You help both red-teamers
and SOC/blue-team analysts. Use your tools for facts:
- cvss_lookup for exact CVSS scoring (never estimate scores yourself),
- kev_check for CISA KEV / exploited-in-the-wild status and patch priority,
- map_detections for ATT&CK techniques, threat-hunt queries and mitigations.
Always cite which tool gave you a fact. Be concise and practical. When relevant, give both an
attacker perspective and a defender perspective.`;

type Msg = { role: "user" | "model"; text: string };

export async function POST(req: NextRequest) {
  let messages: Msg[] = [];
  try {
    const body = await req.json();
    messages = body?.messages ?? [];
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const contents: any[] = messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  const tools = [{ functionDeclarations: LOCAL_DECLARATIONS }] as any;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: any) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        for (let i = 0; i < 6; i++) {
          const result = await ai.models.generateContent({
            model: MODELS.workhorse,
            contents,
            config: { tools, systemInstruction: SYSTEM },
          });

          const calls = result.functionCalls ?? [];
          if (calls.length > 0) {
            const modelParts: any[] = [];
            const responseParts: any[] = [];
            for (const fc of calls) {
              emit({ type: "tool", name: fc.name, args: fc.args });
              const out = await runTool(fc.name!, fc.args);
              modelParts.push({ functionCall: fc });
              responseParts.push({
                functionResponse: { name: fc.name, response: { result: out }, id: (fc as any).id },
              });
            }
            contents.push({ role: "model", parts: modelParts });
            contents.push({ role: "user", parts: responseParts });
            continue;
          }

          emit({ type: "text", text: result.text ?? "" });
          break;
        }
        emit({ type: "done" });
      } catch (e: any) {
        emit({ type: "error", message: e?.message ?? String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
