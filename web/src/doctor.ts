import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { SCRIPTS_DIR, SKILL_DIR } from "./config.js";

const run = promisify(execFile);

export type CheckStatus = "ok" | "warn" | "fail";

export interface Check {
  name: string;
  status: CheckStatus;
  detail: string;
  /** Shown when the check is not ok. */
  fix?: string;
}

async function tryRun(cmd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout, stderr } = await run(cmd, args, { timeout: 15_000 });
    return (stdout || stderr).trim();
  } catch {
    return null;
  }
}

async function checkPython(): Promise<Check> {
  const version = await tryRun("python3", ["--version"]);
  return version
    ? { name: "python3", status: "ok", detail: version }
    : {
        name: "python3",
        status: "fail",
        detail: "not found on PATH",
        fix: "Install Python 3.11+ (macOS: brew install python).",
      };
}

async function checkPandoc(): Promise<Check> {
  const version = await tryRun("pandoc", ["--version"]);
  return version
    ? { name: "pandoc", status: "ok", detail: version.split("\n")[0] ?? "installed" }
    : {
        // A warning, not a failure: without pandoc the report is still written
        // and displayed in the browser — only the PDF download is lost.
        name: "pandoc",
        status: "warn",
        detail: "not found — the report still works, only the PDF download won't",
        fix: "brew install pandoc, or the installer at pandoc.org/installing (Linux: apt install pandoc)",
      };
}

/**
 * Asks build_pdf.py itself which engine it would pick, so this never drifts
 * from the script's own detection logic.
 */
async function checkPdfEngine(): Promise<Check> {
  const probe = [
    "-c",
    [
      "import sys",
      `sys.path.insert(0, ${JSON.stringify(SCRIPTS_DIR)})`,
      "import build_pdf",
      "kind, binary = build_pdf.resolve_engine('auto')",
      "print(kind, binary)",
    ].join("; "),
  ];
  try {
    const { stdout } = await run("python3", probe, { timeout: 15_000 });
    return { name: "PDF engine", status: "ok", detail: stdout.trim() };
  } catch (error) {
    // build_pdf.py prints a multi-line install hint; the first line is the
    // diagnosis and `fix` below already carries the advice.
    const stderr = (error as { stderr?: string }).stderr?.trim().split("\n")[0];
    const detail =
      !stderr || stderr.endsWith("Install either:")
        ? "no wkhtmltopdf and no Chromium-family browser found"
        : stderr;
    return {
      name: "PDF engine",
      status: "warn",
      detail,
      fix: "Install Google Chrome, or set CHROME_PATH. The Markdown report still works without it.",
    };
  }
}

async function checkHebrewFont(): Promise<Check> {
  if (process.platform === "darwin") {
    return { name: "Hebrew font", status: "ok", detail: "macOS system fonts cover Hebrew" };
  }
  const list = await tryRun("fc-list", [":lang=he", "family"]);
  if (list === null) {
    return { name: "Hebrew font", status: "warn", detail: "fc-list unavailable; cannot verify" };
  }
  const count = list.split("\n").filter(Boolean).length;
  return count > 0
    ? { name: "Hebrew font", status: "ok", detail: `${count} font(s) covering Hebrew` }
    : {
        name: "Hebrew font",
        status: "warn",
        detail: "no Hebrew-capable font found; the PDF will show boxes",
        fix: "apt-get install fonts-dejavu-core",
      };
}

function checkAuth(): Check {
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      name: "auth",
      status: "warn",
      detail: "ANTHROPIC_API_KEY is set — runs bill to the API, not your subscription",
      fix: "unset ANTHROPIC_API_KEY to use your Claude subscription login instead.",
    };
  }
  const home = os.homedir();
  const candidates = [
    path.join(home, ".claude", ".credentials.json"),
    path.join(home, ".claude.json"),
    path.join(home, ".config", "claude", "credentials.json"),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  return found
    ? { name: "auth", status: "ok", detail: `Claude subscription login (${found})` }
    : {
        name: "auth",
        status: "fail",
        detail: "not logged in to Claude",
        fix:
          "Install Claude Code (npm install -g @anthropic-ai/claude-code), " +
          "run `claude`, and type /login. Needs a paid Claude plan.",
      };
}

function checkSkill(): Check {
  const skillMd = path.join(SKILL_DIR, "SKILL.md");
  return fs.existsSync(skillMd)
    ? { name: "skill", status: "ok", detail: skillMd }
    : {
        name: "skill",
        status: "fail",
        detail: `SKILL.md not found at ${skillMd}`,
        fix: "Run the app from inside the israeli-mortgage-analysis repository.",
      };
}

export async function doctor(): Promise<{ checks: Check[]; ok: boolean }> {
  const checks = [
    checkSkill(),
    checkAuth(),
    await checkPython(),
    await checkPandoc(),
    await checkPdfEngine(),
    await checkHebrewFont(),
  ];
  return { checks, ok: checks.every((c) => c.status !== "fail") };
}
