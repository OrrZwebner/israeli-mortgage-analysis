import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)); // web/dist

/** `web/` — the app root. */
export const WEB_ROOT = path.resolve(here, "..");

/** The repository root, which is also the Claude plugin root. */
export const REPO_ROOT = path.resolve(WEB_ROOT, "..");

export const SKILL_DIR = path.join(REPO_ROOT, "skills", "mortgage-refinance-analysis");
export const BUILD_PDF = path.join(SKILL_DIR, "scripts", "build_pdf.py");
export const SCRIPTS_DIR = path.join(SKILL_DIR, "scripts");

/** One directory per analysis run. Git-ignored. */
export const RUNS_DIR = path.join(WEB_ROOT, "runs");

/** Plugin name from .claude-plugin/plugin.json; skills are namespaced by it. */
export const PLUGIN_NAME = "israeli-mortgage-analysis";
export const SKILL_NAME = "mortgage-refinance-analysis";
export const QUALIFIED_SKILL = `${PLUGIN_NAME}:${SKILL_NAME}`;

export const PORT = Number(process.env.MORTGAGE_WEB_PORT ?? 5173);

/**
 * Mobile mode listens on every interface so a phone on the same Wi-Fi can reach
 * the app. That also exposes your mortgage documents — and an agent that spends
 * money — to everyone on the network, so it is opt-in and gated by a token that
 * is regenerated on every start (see `src/auth.ts`).
 */
export const MOBILE = process.env.MORTGAGE_WEB_MOBILE === "1";
export const HOST = process.env.MORTGAGE_WEB_HOST ?? (MOBILE ? "0.0.0.0" : "127.0.0.1");
export const MODEL = process.env.MORTGAGE_WEB_MODEL ?? "claude-opus-5";

/**
 * Optional hard spend ceiling per turn. The SDK ends the query with
 * `error_max_budget_usd` when it is exceeded. Unset by default: a real analysis
 * reads several PDFs and searches the web, and a ceiling that is too low
 * truncates the report halfway through.
 */
export const MAX_BUDGET_USD = process.env.MORTGAGE_WEB_MAX_BUDGET_USD
  ? Number(process.env.MORTGAGE_WEB_MAX_BUDGET_USD)
  : undefined;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 12;

/** Extra executables the agent may run via Bash, comma separated. */
export const EXTRA_BASH_ALLOW = (process.env.MORTGAGE_WEB_BASH_ALLOW ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
