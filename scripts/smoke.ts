// Live end-to-end smoke test of the SYNAPSE agent pipeline.
// Run: npx tsx scripts/smoke.ts
// Requires GEMINI_API_KEY in .env.local (loaded below).

import fs from "node:fs";
import path from "node:path";

// Minimal .env.local loader (no dotenv dependency needed).
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "your-key-here") {
  console.error("❌ GEMINI_API_KEY is not set in .env.local — set it and re-run.");
  process.exit(1);
}

const { runAgent } = await import("../src/lib/agent");

const question =
  process.argv.slice(2).join(" ") ||
  "Is CVE-2026-12569 exploited in the wild, what's its CVSS and patch priority, and what detection and hunt queries should my SOC run?";

console.log("❓ Question:", question, "\n");

let gotAnswer = false;
let critiqueSeen = false;

await runAgent(question, (e: any) => {
  switch (e.type) {
    case "stage":
      console.log(`  [${e.status === "done" ? "✓" : e.status === "error" ? "!" : "…"}] ${e.name}${e.detail ? " — " + e.detail : ""}`);
      break;
    case "tool":
      console.log(`      🔧 ${e.name}: ${e.summary}`);
      break;
    case "source":
      console.log(`      🌐 ${e.title}`);
      break;
    case "answer":
      gotAnswer = true;
      console.log("\n===== ANSWER =====");
      console.log("Summary:", e.data.summary);
      console.log("Severity:", JSON.stringify(e.data.severity));
      console.log("\n🔴 ATTACKER:", JSON.stringify(e.data.attacker_view, null, 2));
      console.log("\n🔵 DEFENDER:", JSON.stringify(e.data.defender_view, null, 2));
      console.log("\nCitations:", e.data.citations.map((c: any) => `${c.source} — ${c.detail}`).join("\n  "));
      break;
    case "critique":
      critiqueSeen = true;
      console.log(`\n🧪 Self-critique: ${e.verified ? "PASSED" : "FLAGS — " + e.issues.join("; ")}`);
      break;
    case "error":
      console.error("\n❌ ERROR:", e.message);
      break;
  }
});

console.log("\n==================");
console.log(gotAnswer ? "✅ Pipeline produced a structured answer." : "❌ No answer produced.");
console.log(critiqueSeen ? "✅ Critique stage ran." : "⚠️  Critique stage did not run.");
process.exit(gotAnswer ? 0 : 1);
