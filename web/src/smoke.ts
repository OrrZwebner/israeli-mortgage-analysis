/**
 * Proves the plugin/skill wiring works end to end without needing real bank
 * documents: start a session exactly as the app does and check that the init
 * message reports the plugin and the skill.
 *
 * Exit codes: 0 ready · 1 wiring broken · 2 wiring fine but Claude isn't logged in.
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import { MODEL, PLUGIN_NAME, QUALIFIED_SKILL, REPO_ROOT } from "./config.js";

let plugins: Array<{ name: string; path: string }> = [];
let skills: string[] = [];
let authError: string | undefined;
let transportError: string | undefined;

try {
  for await (const message of query({
    prompt: "Reply with the single word: ready",
    options: {
      cwd: REPO_ROOT,
      plugins: [{ type: "local", path: REPO_ROOT }],
      settingSources: [],
      tools: ["Skill"],
      allowedTools: ["Skill"],
      permissionMode: "dontAsk",
      model: MODEL,
      maxTurns: 1,
    },
  })) {
    if (message.type === "system" && message.subtype === "init") {
      plugins = message.plugins;
      skills = message.skills;
      console.log(`model:   ${message.model}`);
      console.log(`plugins: ${plugins.map((p) => p.name).join(", ") || "(none)"}`);
      console.log(`skills:  ${skills.join(", ") || "(none)"}`);
    }
    if (message.type === "assistant" && message.error) {
      authError = message.error;
    }
    if (message.type === "result") {
      const detail = message.subtype === "success" ? message.result : message.errors?.join("; ");
      console.log(
        `result:  ${message.subtype}${message.is_error ? " (is_error)" : ""} · ` +
          `$${message.total_cost_usd.toFixed(4)}${detail ? ` · ${detail}` : ""}`,
      );
      if (message.is_error && !authError) authError = detail;
    }
  }
} catch (error) {
  // The SDK surfaces a non-zero CLI exit as a throw. Wiring is still readable
  // from the init message we already captured, so record it and carry on.
  transportError = error instanceof Error ? error.message : String(error);
}

if (!plugins.some((p) => p.name === PLUGIN_NAME)) {
  console.error(`\nFAIL: plugin "${PLUGIN_NAME}" did not load from ${REPO_ROOT}`);
  if (transportError) console.error(`       (transport: ${transportError})`);
  process.exit(1);
}
if (!skills.includes(QUALIFIED_SKILL)) {
  console.error(`\nFAIL: skill "${QUALIFIED_SKILL}" is not available`);
  process.exit(1);
}

console.log(`\nok: ${QUALIFIED_SKILL} is loaded and available.`);

if (authError) {
  console.error(`\nBut Claude could not run: ${authError}`);
  console.error("Run `claude` once and log in (or export ANTHROPIC_API_KEY), then retry.");
  process.exit(2);
}
if (transportError) {
  console.error(`\nBut the Claude Code process failed: ${transportError}`);
  process.exit(2);
}
console.log("Ready to analyse documents.");
