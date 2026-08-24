# Distribution PLAN — shipping the dashboard as a local one-liner

> **Status: deferred, not implemented (2026-08-24).** The shipped product is unchanged —
> clone the repo and run `./run.sh`. This file is kept for the hosting research below
> (policy citations, measured cost, npm packaging traps) in case packaging is revisited.

**Decision (2026-08-24):** the dashboard stays local. Sharing happens by distributing the
program, not by hosting it. See `decisions.md`.

## Why not hosted

Anthropic does not permit third-party apps to offer claude.ai login, to route requests
through Free/Pro/Max credentials on behalf of users, or to collect or intermediate
claude.ai credentials — developers must use Console API-key auth
([legal-and-compliance](https://code.claude.com/docs/en/legal-and-compliance),
[agent-sdk/overview](https://code.claude.com/docs/en/agent-sdk/overview)). A hosted build
would therefore be either BYO-API-key (each user needs a Console account with billing) or
billed to us. The measured cost of one real analysis is **$6.09 / 88 min / 53 turns**
(the author's own run transcript, `claude-opus-5`), so "we pay" does not scale, and
hosting would also put other people's mortgage statements on our server — personal
financial data under חוק הגנת הפרטיות, and the loss of the product's own privacy claim.

Running locally on the user's own subscription is ordinary individual use and stays clean.

## Target

```
npx @orrzwebner/israeli-mortgage-analysis          # installs nothing permanently, opens the browser
npx @orrzwebner/israeli-mortgage-analysis --mobile  # LAN + QR
```

Both names (`israeli-mortgage-analysis`, `@orrzwebner/israeli-mortgage-analysis`) are
unregistered as of 2026-08-24. Publishing requires `npm login`.

Distribution routes after this change, in order of user sophistication:

| Audience | Route | Status |
|---|---|---|
| Non-technical, no terminal | claude.ai skill zip (release asset) | already shipped |
| Has a terminal, wants the UI | `npx …` | **this plan** |
| Claude Code user | `/plugin marketplace add …` | already shipped |
| Contributor | `git clone && ./run.sh` | already shipped, must not regress |

## Work items

### 1. Collapse to a single root package (prerequisite)

npm cannot pack files outside the package directory, so `web/package.json` cannot ship
`skills/` or `.claude-plugin/`. The published package must be rooted at the repository.

- Move `web/package.json` → root `package.json`; keep `web/src`, `web/public` where they are.
- `tsconfig.json` at root, `rootDir: web/src`, `outDir: web/dist`.
- Update `run.sh` (no more `cd web`) and both GitHub workflows.
- Name `@orrzwebner/israeli-mortgage-analysis`, `bin: { "israeli-mortgage-analysis": "bin/cli.js" }`,
  `engines.node >= 20`, `type: module`.

### 2. `files` must be explicit — the one that silently breaks

Root `.gitignore` contains `dist/`. With no `files` field or `.npmignore`, npm honours
`.gitignore` and the compiled server would be **missing from the tarball** while `npm pack`
still succeeds. Declare it:

```json
"files": ["bin/", "web/dist/", "web/public/", "skills/", ".claude-plugin/", "run.sh"]
```

Add `"prepublishOnly": "npm run build"` so `web/dist` is always current when published.

### 3. `bin/cli.js` — port of `run.sh` to Node

Same flags (`--mobile`, `--doctor`, `--smoke`), same preflight, minus the npm-install step
(npx already installed the deps). Adds: open the browser automatically (`open` / `start` /
`xdg-open`, failing silently), and print the URL. `run.sh` becomes a thin wrapper that
calls it, so the clone route keeps working unchanged.

### 4. Move `runs/` out of the package directory — required, not cosmetic

`RUNS_DIR` is currently `web/runs`, which under npx lands inside a cache directory that is
wiped and is not a sane home for a user's reports.

```ts
export const RUNS_DIR = process.env.MORTGAGE_WEB_RUNS
  ?? path.join(os.homedir(), ".israeli-mortgage-analysis", "runs");
```

Nothing else changes: `jobs.ts` already derives every path from `RUNS_DIR`.

### 5. Confirm plugin loading survives being inside `node_modules`

`config.ts` derives `REPO_ROOT` from `dist/` (`web/dist` → `web` → package root), and
`agent.ts` loads the plugin by that path. Inside `node_modules/@orrzwebner/…` the layout is
identical, so it should resolve — but this is the highest-risk assumption in the plan and is
what test T3 exists to prove. If it fails, the fallback is to resolve the plugin root from
`import.meta.resolve("../.claude-plugin/plugin.json")`.

### 6. Publish from CI

Extend `.github/workflows/release.yml` (which already builds the skill zip on a `v*` tag)
with `npm publish --provenance --access public`, gated on an `NPM_TOKEN` secret.

### 7. Docs

`README.md` Option D leads with the `npx` line; `git clone && ./run.sh` moves below it as
the contributor route. Note the first run downloads ~121 MB (68 MB of that is the Agent SDK
and its bundled CLI binary) and is cached afterwards.

## Test plan

Run in order; T3 is the gate.

| # | Case | Input | Expected |
|---|---|---|---|
| T1 | Tarball contents | `npm pack` | contains `skills/mortgage-refinance-analysis/SKILL.md`, all four `references/*.md`, both `scripts/*.py`, `.claude-plugin/plugin.json`, `web/dist/server.js`, `web/public/index.html`, `bin/cli.js` |
| T2 | Clean install | install the tarball in an empty temp dir, `--doctor` | every check `ok`/`warn`, none `fail`; the `skill` check points inside `node_modules` |
| T3 | **Plugin loads from node_modules** | `--smoke` from that install | exit `0`; init reports plugin `israeli-mortgage-analysis` and skill `israeli-mortgage-analysis:mortgage-refinance-analysis` |
| T4 | Runs directory | start the server, `POST /api/jobs` with a non-PDF | `400`, and `~/.israeli-mortgage-analysis/runs/` exists and is writable (no model spend) |
| T5 | Permission gate unchanged | `npm test` | passes after the restructure |
| T6 | Clone route regression | `./run.sh --doctor` in the repo | unchanged behaviour |
| T7 | Browser open degrades | run with no display / `BROWSER=` unset on Linux | server still starts, URL printed, no crash |

Edge cases to cover in T2/T4: read-only `HOME`, a `MORTGAGE_WEB_RUNS` override, and a
second concurrent instance on the same port (should fail with a clear message, not hang).

No end-to-end analysis in the suite — one real run is $6. T3 proves the wiring; the
analysis itself is already covered by `.github/workflows/test.yml`.

## Out of scope

Hosted BYOK. If it is ever wanted, the hook is small: `Options.env` accepts a per-job
`ANTHROPIC_API_KEY` (`web/node_modules/@anthropic-ai/claude-agent-sdk/entrypoints/sdk/runtimeTypes.d.ts`),
noting that in TypeScript `env` **replaces** the subprocess environment, so `...process.env`
must be spread. Multi-tenant hosting would additionally need per-tenant `CLAUDE_CONFIG_DIR`,
`CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, a `SessionStore`, and a document-retention policy
([hosting guide](https://code.claude.com/docs/en/agent-sdk/hosting)).
