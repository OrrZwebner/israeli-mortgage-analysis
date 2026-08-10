# ניתוח משכנתא — local web UI

A single-user dashboard for the `mortgage-refinance-analysis` skill. Drop the PDFs
your bank gave you onto a page, watch the analysis happen, and get back the Hebrew
report as Markdown and as a styled RTL PDF.

Everything runs on your machine: the server binds to `127.0.0.1`, the documents are
written to `web/runs/` and never leave the disk, and the analysis runs through your
own Claude login.

## Setup

```bash
cd web
npm install
npm run doctor     # checks python3, pandoc, a PDF engine, fonts, and your Claude login
npm start          # http://127.0.0.1:5173
```

`npm run doctor` tells you exactly what is missing. The usual gap on a fresh Mac is
pandoc:

```bash
brew install pandoc
```

The PDF engine is found automatically — `wkhtmltopdf` if you have it, otherwise
Chrome, Chromium, Edge, or Brave. If you have none of those, the Markdown report is
still produced and shown in the browser; only the PDF download is unavailable.

### Authentication

The Agent SDK reuses Claude Code's own credentials, so if `claude` works in your
terminal, this works. If `ANTHROPIC_API_KEY` is set in the environment it takes
precedence and runs bill to the API instead of your subscription — the `auth` pill in
the header tells you which one is in effect.

This is a personal tool you run for yourself. Anthropic's SDK terms don't allow
offering claude.ai login to other people, so don't put this on a shared host.

## Verifying the wiring

```bash
npm run smoke   # confirms the plugin and skill load, and that Claude can run
npm test        # the permission gate's allow/deny rules
```

`npm run smoke` exits `0` when everything is ready, `1` if the skill didn't load, and
`2` if the skill loaded but Claude isn't logged in.

## How it works

```
browser ──▶ Express ──▶ Claude Agent SDK ──▶ Claude Code harness
                                              ├── plugin: this repository
                                              └── skill: mortgage-refinance-analysis
                          │
                          └── web/runs/<id>/  input/*.pdf · report.md · report.pdf · transcript.jsonl
```

Each run gets its own directory, which is also the agent's working directory. The
repository itself is loaded as a **local plugin**, so the skill is available by path —
no install step, and no dependence on however your own Claude Code is configured.
`settingSources: []` keeps your personal skills, settings, and `CLAUDE.md` files out
of a financial analysis.

The skill deliberately leaves output naming to the agent. A system-prompt appendix
(`src/prompt.ts`) pins it to `report.md` + `report.pdf` and forbids writing outside
the run directory; nothing else about the analysis is overridden.

### What the agent is allowed to do

Pre-approved: `Read`, `Glob`, `Grep`, `WebSearch`, `TodoWrite`, `Skill`.
Checked on every call by `src/permissions.ts`:

- **Write/Edit** — only inside the run directory.
- **Bash** — only an allowlist of executables (`python3`, plus read-only shell
  utilities); no command substitution, no `sudo`, and redirects must stay inside the
  run directory. Refusals appear in the progress log.
- **WebFetch** — allowed, and every URL is shown in the log. The skill needs live
  Bank of Israel data, so the network can't be closed off entirely; if a document
  ever tried a prompt-injection attack, this is the channel to watch.

This is a guard rail, not a sandbox. Read the progress log.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `MORTGAGE_WEB_PORT` | `5173` | Listen port |
| `MORTGAGE_WEB_HOST` | `127.0.0.1` | Bind address |
| `MORTGAGE_WEB_MODEL` | `claude-opus-5` | Model |
| `MORTGAGE_WEB_MAX_BUDGET_USD` | unset | Hard spend ceiling per turn |
| `MORTGAGE_WEB_BASH_ALLOW` | unset | Extra executables, comma separated |
| `CHROME_PATH` | unset | Browser to use for PDF rendering |

## Using it

1. Drop in the bank PDFs — `אישור יתרות`, `נתונים לסילוק מלא`, `לוח סילוקין`, an
   advisor's `דוח משכנתא`, and, if you have one, an `אישור עקרוני`. The skill decides
   on its own whether that's a portfolio analysis (Mode A) or an offer evaluation
   (Mode B).
2. Watch the log: which document is being read, which figures were reconciled, which
   market rates were looked up.
3. Read the report in the browser, or download the `.md` / `.pdf`.
4. Ask follow-up questions. A question is answered in the chat; a request for a change
   rewrites the report and re-renders the PDF with a `מה חדש בגרסה N` block at the top.

A run takes several minutes and reads live market data, so it is not free — the cost
of each turn is printed in the log when it finishes.

The URL carries the run id (`?job=…`), so a reload picks the run back up.
