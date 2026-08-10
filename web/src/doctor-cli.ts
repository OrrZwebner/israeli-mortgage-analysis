import { doctor } from "./doctor.js";

const ICON = { ok: "✓", warn: "!", fail: "✗" } as const;

const { checks, ok } = await doctor();

console.log("mortgage-analysis-web preflight\n");
for (const check of checks) {
  // Some details are multi-line (the PDF-engine hint); keep the list scannable.
  const detail = check.detail.split("\n").join(" · ");
  console.log(`  ${ICON[check.status]} ${check.name.padEnd(12)} ${detail}`);
  if (check.fix && check.status !== "ok") console.log(`    ${" ".repeat(12)}   → ${check.fix}`);
}
console.log(ok ? "\nReady.\n" : "\nNot ready — fix the ✗ items above.\n");

process.exit(ok ? 0 : 1);
