import { NextRequest } from "next/server";
import { runAgent, type AgentEvent } from "@/lib/agent";

// Node runtime + long timeout for the multi-stage agent loop (Vercel Fluid Compute).
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let question = "";
  try {
    const body = await req.json();
    question = (body?.question ?? "").toString().trim();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }
  if (!question) {
    return new Response(JSON.stringify({ error: "Missing 'question'" }), { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AgentEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(e) + "\n")); // NDJSON
      };
      try {
        await runAgent(question, emit);
      } catch (e: any) {
        emit({ type: "error", message: e?.message ?? String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
