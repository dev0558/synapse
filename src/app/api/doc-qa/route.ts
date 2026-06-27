import { NextRequest } from "next/server";
import { ai, MODELS } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 300;

// Document understanding: Gemini reads PDFs/text natively (vision for charts/tables).
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { mimeType, dataBase64, question } = body ?? {};
  if (!dataBase64 || !question) {
    return Response.json({ error: "Missing document data or question" }, { status: 400 });
  }

  const SYSTEM = `You are SYNAPSE analysing an uploaded security document (advisory, pentest report,
threat report, or CVE bulletin). Answer the analyst's question grounded ONLY in the document.
Quote relevant lines and cite the page/section where possible. If the document does not contain
the answer, say so. When relevant, extract IOCs, affected versions, CVSS, and map TTPs to MITRE ATT&CK.`;

  try {
    const result = await ai.models.generateContent({
      model: MODELS.workhorse,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: mimeType || "application/pdf", data: dataBase64 } },
            { text: question },
          ],
        },
      ],
      config: { systemInstruction: SYSTEM },
    });
    return Response.json({ answer: result.text ?? "(no answer)" });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
