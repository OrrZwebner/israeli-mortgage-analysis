import path from "node:path";
import type { CanUseTool, PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { EXTRA_BASH_ALLOW, SKILL_DIR } from "./config.js";
import type { Job } from "./jobs.js";

/**
 * Executables the agent may run. The skill only ever needs its own two Python
 * scripts; the rest are read-only shell utilities it reaches for while checking
 * its own work. Anything else is refused with an explanation, so the model can
 * pick a different route instead of silently failing.
 */
const BASH_ALLOWLIST = new Set([
  "python3",
  "python",
  "ls",
  "pwd",
  "cat",
  "head",
  "tail",
  "wc",
  "file",
  "which",
  "mkdir",
  "echo",
  "date",
  "sort",
  "uniq",
  "grep",
  "stat",
  "basename",
  "dirname",
  ...EXTRA_BASH_ALLOW,
]);

/** Constructs that hide an executable from the allowlist check. */
const SHELL_ESCAPES: Array<[RegExp, string]> = [
  [/\$\(/, "command substitution $( … )"],
  [/`/, "backtick command substitution"],
  [/\bsudo\b/, "sudo"],
  [/\beval\b/, "eval"],
];

const allow = (input: Record<string, unknown>): PermissionResult => ({
  behavior: "allow",
  updatedInput: input,
});

const deny = (message: string): PermissionResult => ({ behavior: "deny", message });

function isInside(parent: string, candidate: string): boolean {
  const rel = path.relative(parent, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** Splits on shell operators so each pipeline stage is checked on its own. */
function segments(command: string): string[] {
  return command
    .split(/\|\||&&|;|\||\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** First non-assignment word of a segment, unquoted, without its directory. */
function executableOf(segment: string): string {
  const words = segment.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  for (const word of words) {
    const bare = word.replace(/^['"]|['"]$/g, "");
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(bare)) continue; // FOO=bar prefix
    return path.basename(bare);
  }
  return "";
}

/** Redirect targets are the one way a whitelisted command writes anywhere. */
function redirectTargets(command: string): string[] {
  const targets: string[] = [];
  const re = />>?\s*("[^"]*"|'[^']*'|[^\s;|&]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(command)) !== null) {
    const raw = match[1];
    if (raw && !/^&\d?$/.test(raw)) targets.push(raw.replace(/^['"]|['"]$/g, ""));
  }
  return targets;
}

function checkBash(job: Job, input: Record<string, unknown>): PermissionResult {
  const command = String(input.command ?? "");
  if (!command.trim()) return deny("Empty command.");

  for (const [pattern, label] of SHELL_ESCAPES) {
    if (pattern.test(command)) {
      return deny(
        `This app refuses shell commands using ${label}, because it cannot check what they run. ` +
          `Run the executable directly instead.`,
      );
    }
  }

  for (const segment of segments(command)) {
    const exe = executableOf(segment);
    if (!BASH_ALLOWLIST.has(exe)) {
      return deny(
        `This app only allows these executables via Bash: ${[...BASH_ALLOWLIST].sort().join(", ")}. ` +
          `"${exe || segment}" is not one of them. Use the Read/Write/Edit tools, or ` +
          `mortgage_calc.py / build_pdf.py under ${SKILL_DIR}/scripts, to do this instead.`,
      );
    }
  }

  for (const target of redirectTargets(command)) {
    const resolved = path.resolve(job.dir, target);
    if (!isInside(job.dir, resolved)) {
      return deny(
        `Refusing to redirect output to ${target}: writes must stay inside the run directory (${job.dir}).`,
      );
    }
  }

  return allow(input);
}

function checkWrite(job: Job, input: Record<string, unknown>): PermissionResult {
  const target = String(input.file_path ?? input.notebook_path ?? input.path ?? "");
  if (!target) return deny("No file path supplied.");
  const resolved = path.resolve(job.dir, target);
  if (!isInside(job.dir, resolved)) {
    return deny(
      `Refusing to write to ${target}. This app confines every write to the run directory ` +
        `(${job.dir}). Write the report to report.md there.`,
    );
  }
  return allow(input);
}

/**
 * Read-only tools are pre-approved through `allowedTools` and never reach this
 * callback. What arrives here is the write surface plus WebFetch, which is
 * allowed but surfaced in the UI so the user can see every page the agent pulls.
 */
export function makeCanUseTool(job: Job): CanUseTool {
  return async (toolName, input) => {
    let result: PermissionResult;

    switch (toolName) {
      case "Bash":
      case "BashOutput":
        result = checkBash(job, input);
        break;
      case "Write":
      case "Edit":
      case "MultiEdit":
      case "NotebookEdit":
        result = checkWrite(job, input);
        break;
      case "WebFetch":
        result = allow(input);
        break;
      default:
        result = deny(
          `The ${toolName} tool is not available in this app. Use Read, Glob, Grep, WebSearch, ` +
            `WebFetch, Write, Edit, or Bash.`,
        );
    }

    if (result.behavior === "deny") {
      job.emit("denied", `${toolName} נדחה: ${result.message}`, { tool: toolName, input });
    }
    return result;
  };
}
