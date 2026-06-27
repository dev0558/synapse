import { kevCheck, kevDeclaration } from "./kev";
import { mapDetections, detectionsDeclaration } from "./detections";
import { cvssLookup, cvssDeclaration } from "./cvss";

// Registry mapping tool name -> implementation. The agent loop dispatches here.
export const TOOL_IMPL: Record<string, (args: any) => any> = {
  kev_check: kevCheck,
  map_detections: mapDetections,
  cvss_lookup: cvssLookup,
};

// Function declarations passed to Gemini in config.tools.
// (search_documents / web_ground are added by the agent route once RAG is wired.)
export const LOCAL_DECLARATIONS = [kevDeclaration, detectionsDeclaration, cvssDeclaration];

export async function runTool(name: string, args: any) {
  const fn = TOOL_IMPL[name];
  if (!fn) return { error: `Unknown tool: ${name}` };
  try {
    return await fn(args);
  } catch (e: any) {
    return { error: `Tool ${name} failed: ${e?.message ?? String(e)}` };
  }
}
