# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

A Claude **plugin** (`.claude-plugin/plugin.json`) whose only content is one skill,
`skills/mortgage-refinance-analysis/`, plus a local web dashboard (`web/`) that runs that
same skill through the Agent SDK. The skill is the product; the dashboard is the headline
delivery route, alongside a raw-URL prompt, a claude.ai zip upload, a plugin install, and a
skill copy (see `README.md`). There is deliberately no hosted version — `notes/decisions.md`
records why, and that decision is policy-bound, not a TODO.

## Commands

Skill scripts (Python 3.11 stdlib only, no dependencies — keep it that way):

```bash
cd skills/mortgage-refinance-analysis
python3 scripts/mortgage_calc.py pmt 750000 4.25 300         # also: balance rate index verify horizon delay breakeven stress
python3 scripts/build_pdf.py report.md report.pdf --engine chrome
```

Dashboard (`web/`, Node 20+, TypeScript → `dist/`):

```bash
./run.sh              # install deps if needed, run doctor, start on 127.0.0.1:5173, open the browser
./run.sh --mobile     # bind LAN + QR pairing;  --doctor / --smoke run checks only
cd web && npm test    # builds, then: node --test dist/permissions.test.js
cd web && npm run doctor   # environment preflight (python3, pandoc, PDF engine, Hebrew font, Claude auth)
cd web && npm run smoke    # real Agent SDK session; exit 1 = plugin/skill didn't load, 2 = not logged in
```

There is no lint step. `npm test` covers only `src/permissions.ts`; run a single case with
`node --test --test-name-pattern '<name>' dist/permissions.test.js`.

The authoritative regression suite for the Python scripts is
`.github/workflows/test.yml` — seven inline `python3 -c` assertions, not a pytest file.
Reproduce a failure by copying the step body. Its inputs are synthetic round numbers chosen
so expectations are hand-checkable; **if a change moves an expected value, fix the code, not
the expectation** (see `CONTRIBUTING.md`).

## Architecture

### The skill

`SKILL.md` is loaded on every invocation and must stay under ~500 lines: it routes to
`references/` (loaded on demand) and carries only cross-cutting judgment. New detail goes in
a reference file — `extraction.md` (bank-PDF field map, RTL traps, reconciliation identities),
`calculations.md` (Spitzer, linkage, prepayment fees, horizon economics), `regulations.md`
(BoI Directives 329/451, 2002 prepayment order), `report-structure.md` (section-by-section
output for both modes).

The pipeline is extract → **verify against the bank's own totals** → diagnose per track →
search live market data → write Hebrew RTL Markdown → render PDF. Two modes, inferred from
the documents rather than asked: A (balance statements only) and B (plus an
`אישור עקרוני` offer). The central diagnostic is the bank's own printed
`שיעור הריבית לצרכי השוואה` per track.

Regulatory claims in `regulations.md` must be verified against boi.org.il before being
changed, and the check cited — an outdated constraint stated confidently is worse than none.

### The dashboard

Express + SSE + one static HTML page (`web/public/`), driving `@anthropic-ai/claude-agent-sdk`.
Flow: `POST /api/jobs` (multer, PDF magic-byte check, Hebrew filename latin1→utf8 repair) →
`Job` in `jobs.ts` (in-memory registry, per-run dir `web/runs/<id>/` with `input/`,
`report.md`, `report.pdf`, `transcript.jsonl`) → `agent.ts` runs the SDK turn and normalises
SDK messages into Hebrew `JobEvent`s → the browser replays + streams them over
`GET /api/jobs/:id/events`. Follow-ups resume the same `session_id`.

Four constraints hold this together, and changes should preserve them:

1. **The repo is loaded as the plugin by path** (`plugins: [{type:"local", path: REPO_ROOT}]`)
   with `settingSources: []`, so no user CLAUDE.md, skill, or setting reaches a financial
   analysis. If the init message doesn't report the plugin, `agent.ts` aborts the run rather
   than emit an unverified-but-authoritative report.
2. **`permissions.ts` is the security boundary**, not advice: `canUseTool` allows only an
   executable allowlist for Bash (rejecting `$( )`, backticks, `sudo`, `eval`, and checking
   each pipeline segment separately), confines every write and redirect target to the run
   directory, and denies unknown tools with an explanation the model can act on. This is the
   only tested file in `web/`.
3. **`prompt.ts` pins down only what the skill deliberately leaves open** — the filenames
   `report.md` / `report.pdf` and the render command. What to analyse stays in `SKILL.md`;
   do not migrate analysis rules into the prompt.
4. **Mobile mode is opt-in and token-gated** (`auth.ts`): a fresh key per start, `?k=` from
   the QR exchanged once for an httpOnly cookie, loopback always trusted.

`config.ts` centralises every path and env override (`MORTGAGE_WEB_PORT`, `_MOBILE`, `_HOST`,
`_MODEL`, `_MAX_BUDGET_USD`, `_BASH_ALLOW`) and derives `REPO_ROOT` from `dist/` — moving
`src/`, `dist/`, or `web/` breaks plugin loading.

## Releases

Never build or commit `mortgage-refinance-analysis.zip` by hand. Pushing a `v*` tag runs
`.github/workflows/release.yml`, which zips `skills/mortgage-refinance-analysis` and fails
the build unless `SKILL.md` sits directly inside the single top-level folder — that layout is
what makes the file uploadable at claude.ai → Customize → Skills.

## Local data

`web/runs/` is git-ignored and holds whatever documents were analysed on this machine, plus
the reports produced from them — real personal financial data by definition. Never copy its
contents into commits, issues, tests, fixtures, or screenshots. Test fixtures are synthetic
round numbers (see `.github/workflows/test.yml`); keep it that way.
