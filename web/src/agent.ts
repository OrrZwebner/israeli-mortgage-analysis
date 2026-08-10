import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { MAX_BUDGET_USD, MODEL, PLUGIN_NAME, QUALIFIED_SKILL, REPO_ROOT } from "./config.js";
import type { Job } from "./jobs.js";
import { makeCanUseTool } from "./permissions.js";
import { OUTPUT_CONTRACT } from "./prompt.js";

/** The base tool set. Anything outside this list does not exist for the agent. */
const TOOLS = [
  "Read",
  "Glob",
  "Grep",
  "WebSearch",
  "WebFetch",
  "TodoWrite",
  "Skill",
  "Write",
  "Edit",
  "Bash",
];

/** Pre-approved, so they never reach `canUseTool` and never clutter the log. */
const ALLOWED_TOOLS = ["Read", "Glob", "Grep", "WebSearch", "TodoWrite", "Skill"];

function truncate(value: string, max = 160): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** A one-line, human-readable rendering of a tool call for the progress log. */
function describeTool(job: Job, name: string, input: Record<string, unknown>): string {
  const rel = (p: unknown) => {
    const raw = String(p ?? "");
    if (!raw) return "";
    const resolved = path.isAbsolute(raw) ? raw : path.resolve(job.dir, raw);
    const inside = path.relative(job.dir, resolved);
    return inside && !inside.startsWith("..") ? inside : raw;
  };

  switch (name) {
    case "Skill":
      return `הפעלת כישור: ${input.command ?? input.name ?? input.skill ?? ""}`;
    case "Read":
      return `קריאת ${rel(input.file_path)}`;
    case "Write":
      return `כתיבת ${rel(input.file_path)}`;
    case "Edit":
    case "MultiEdit":
      return `עריכת ${rel(input.file_path)}`;
    case "Glob":
      return `חיפוש קבצים: ${input.pattern ?? ""}`;
    case "Grep":
      return `חיפוש בטקסט: ${input.pattern ?? ""}`;
    case "WebSearch":
      return `חיפוש באינטרנט: ${input.query ?? ""}`;
    case "WebFetch":
      return `קריאת דף: ${input.url ?? ""}`;
    case "Bash":
      return `הרצה: ${truncate(String(input.command ?? ""))}`;
    case "TodoWrite":
      return "עדכון רשימת המשימות";
    default:
      return `${name} ${truncate(JSON.stringify(input), 120)}`;
  }
}

function formatUsd(value: number | undefined): string {
  return typeof value === "number" ? `$${value.toFixed(3)}` : "—";
}

export interface RunOptions {
  job: Job;
  prompt: string;
  /** Session to continue. Absent for the first turn. */
  resume?: string;
}

/**
 * Drives one agent turn and pushes normalised events onto the job's stream.
 * Resolves when the turn finishes; never throws for ordinary model errors —
 * those become `error` events and an `error` job status.
 */
export async function runAgent({ job, prompt, resume }: RunOptions): Promise<void> {
  const options: Options = {
    cwd: job.dir,
    // The repository is itself the plugin, so the skill loads by path — no
    // install step, and no dependence on the user's Claude Code configuration.
    plugins: [{ type: "local", path: REPO_ROOT }],
    // Isolation: none of the user's own settings, skills or CLAUDE.md files
    // reach a financial analysis. The plugin above is the only extension.
    settingSources: [],
    systemPrompt: { type: "preset", preset: "claude_code", append: OUTPUT_CONTRACT },
    tools: TOOLS,
    allowedTools: ALLOWED_TOOLS,
    permissionMode: "default",
    canUseTool: makeCanUseTool(job),
    model: MODEL,
    abortController: job.abort,
    ...(MAX_BUDGET_USD ? { maxBudgetUsd: MAX_BUDGET_USD } : {}),
    ...(resume ? { resume } : {}),
    stderr: (data) => {
      const text = data.trim();
      if (text) console.error(`[job ${job.id}] ${text}`);
    },
  };

  job.setStatus("running");

  try {
    for await (const message of query({ prompt, options })) {
      handleMessage(job, message);
    }
    if (job.status === "running") {
      job.setStatus(job.hasReport() ? "done" : "error");
      if (!job.hasReport()) {
        job.lastError = "The run finished without producing report.md.";
        job.emit("error", "הריצה הסתיימה בלי שנוצר report.md.");
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (job.abort.signal.aborted) {
      job.setStatus("error", "הריצה בוטלה.");
    } else if (job.status === "running") {
      job.lastError = message;
      job.emit("error", message);
      job.setStatus("error");
    }
    // Otherwise the turn already reported a definitive result and this is just
    // the transport noticing the CLI exited non-zero — reporting it twice only
    // obscures the real reason, which is already in the log.
  }
}

function handleMessage(job: Job, message: SDKMessage): void {
  if ("session_id" in message && message.session_id) {
    job.sessionId = message.session_id;
  }

  switch (message.type) {
    case "system": {
      if (message.subtype !== "init") return;
      const loadedPlugin = message.plugins.some((p) => p.name === PLUGIN_NAME);
      job.emit(
        "init",
        loadedPlugin
          ? `הכישור נטען (${QUALIFIED_SKILL}) · דגם ${message.model}`
          : `אזהרה: התוסף ${PLUGIN_NAME} לא נטען`,
        {
          model: message.model,
          skills: message.skills,
          plugins: message.plugins,
          apiKeySource: message.apiKeySource,
          sessionId: message.session_id,
        },
      );
      if (!loadedPlugin) {
        // Without the skill this is just a chatbot with PDFs — an unverified
        // report that looks authoritative is the exact failure the skill exists
        // to prevent, so stop rather than produce one.
        job.lastError = `Plugin "${PLUGIN_NAME}" did not load from ${REPO_ROOT}.`;
        job.emit("error", job.lastError);
        job.setStatus("error");
        job.abort.abort();
      } else if (!message.skills.includes(QUALIFIED_SKILL)) {
        job.emit(
          "note",
          `הכישור ${QUALIFIED_SKILL} אינו ברשימת הכישורים שדווחה — ממשיך בכל זאת.`,
          { skills: message.skills },
        );
      }
      return;
    }

    case "assistant": {
      if (message.error) {
        // e.g. authentication_failed — the text block carries the CLI's own
        // wording ("Invalid API key · Please run /login"), which is the most
        // useful thing to show.
        job.lastError = message.error;
        job.emit("error", `שגיאת מודל (${message.error})`, { error: message.error });
      }
      for (const block of message.message.content) {
        if (block.type === "text" && block.text.trim()) {
          job.emit("assistant", block.text.trim());
        } else if (block.type === "tool_use") {
          job.emit("tool", describeTool(job, block.name, block.input as Record<string, unknown>), {
            tool: block.name,
          });
        }
      }
      return;
    }

    case "user": {
      // Surface tool failures only; successful results are noise in a progress log.
      const content = message.message.content;
      if (typeof content === "string") return;
      for (const block of content) {
        if (block.type === "tool_result" && block.is_error) {
          const text =
            typeof block.content === "string"
              ? block.content
              : JSON.stringify(block.content ?? "");
          job.emit("note", `שגיאת כלי: ${truncate(text, 240)}`);
        }
      }
      return;
    }

    case "tool_progress": {
      if (message.elapsed_time_seconds >= 30) {
        job.emit(
          "note",
          `${message.tool_name} רץ כבר ${Math.round(message.elapsed_time_seconds)} שניות…`,
        );
      }
      return;
    }

    case "result": {
      const cost = formatUsd(message.total_cost_usd);
      const seconds = Math.round(message.duration_ms / 1000);
      // `subtype: 'success'` only means the loop terminated normally; a failed
      // turn (bad credentials, for instance) still arrives that way with
      // `is_error` set, so both have to be checked.
      if (message.subtype === "success" && !message.is_error) {
        job.emit("result", `הסתיים ב-${seconds} שניות · ${message.num_turns} סבבים · ${cost}`, {
          costUsd: message.total_cost_usd,
          durationMs: message.duration_ms,
          numTurns: message.num_turns,
          usage: message.usage,
        });
        job.setStatus(job.hasReport() ? "done" : "error");
        if (!job.hasReport()) {
          job.lastError = "The run finished without producing report.md.";
          job.emit("error", "הריצה הסתיימה בלי שנוצר report.md.");
        }
      } else {
        const detail =
          message.subtype === "success"
            ? message.result
            : message.errors?.join("; ") || message.subtype;
        job.lastError = detail || message.subtype;
        job.emit("error", `הריצה נכשלה: ${job.lastError} · ${cost}`, {
          subtype: message.subtype,
          costUsd: message.total_cost_usd,
        });
        job.setStatus("error");
      }
      return;
    }

    default:
      return;
  }
}
