# Israeli Mortgage Analysis

A Claude skill that reads Israeli bank mortgage documents and writes a full Hebrew refinancing analysis — Markdown plus a styled RTL PDF.

Israeli mortgages are split into tracks (`מסלולים`) with different rate mechanisms, linkage bases, and reset cycles, so whether refinancing pays is a per-track question. The answer is often counterintuitive: an old fixed non-linked track is usually worth protecting at all costs, while an index-linked track that just reset can be costing far more in nominal terms than its stated real rate suggests.

This extracts every figure from the bank's own statements, **verifies the extraction against reconciliation identities**, ranks each track by refinancing priority using the bank's own `שיעור הריבית לצרכי השוואה`, and writes a report you can take to your banker.

| Mode | You provide | You get |
|---|---|---|
| **A** | `אישור יתרות משכנתא` / `נתונים לסילוק מלא` / `לוח סילוקין` | Per-track diagnosis, refinancing priority, target terms to demand, action items |
| **B** | The above **plus** a refinancing offer (`אישור עקרוני להלוואה לדיור`) | A full opinion on the offer: recommendation, small print, stress tests, exit-station plan |

You don't pick the mode — it follows from the documents you attach.

<div dir="rtl">

## בעברית

מבקשים מהבנק `אישור יתרות משכנתא` (או `נתונים לסילוק מלא`), אחד לכל תיק. מצרפים, ומקבלים דוח בעברית שעובר מסלול-מסלול ואומר מה כדאי למחזר, מה להשאיר, ומה בכלל אסור לגעת בו. כל מספר בדוח נבדק מול הסכומים של הבנק עצמו.

יש לכם גם הצעת מחזור מהבנק? צרפו גם אותה, ותקבלו חוות דעת על ההצעה.

**איך משתמשים:** חמש דרכים, בטבלה למטה. הכי מהיר להתחיל זה [מסלול 0](#option-0--paste-a-prompt-install-nothing) — מעתיקים פרומפט ומדביקים בצ׳אט. הכי נוח לאורך זמן זה [מסלול A](#option-a--upload-the-skill-to-claudeai). ואם בא לכם ממשק במקום צ׳אט, [מסלול D](#option-d--the-local-dashboard) נותן דף שגוררים אליו קבצים ולוחצים כפתור.

צריך מנוי Claude בתשלום. אין גרסה מקוונת: הכול רץ לוקאלית (אין חשיפה לקבצים שאתם מעלים מעבר לClaude).
</div>

## Ways to use it

Five, and they're alternatives — pick one. All of them need a **paid Claude plan**.

| | Route | Pick it if |
|---|---|---|
| **[0](#option-0--paste-a-prompt-install-nothing)** | Paste a prompt, install nothing | You want to see what it says, right now |
| **[A](#option-a--upload-the-skill-to-claudeai)** | Upload the skill to claude.ai | You use Claude in a browser or the desktop app |
| **[B](#option-b--claude-code-as-a-plugin)** | Install as a Claude Code plugin | You use Claude Code in a terminal |
| **[C](#option-c--claude-code-as-a-standalone-skill)** | Copy the skill folder into Claude Code | Same, but you'd rather not add a marketplace |
| **[D](#option-d--the-local-dashboard)** | Run the local dashboard | You'd rather drag files onto a page than type |

**Which documents** — ask your bank for `אישור יתרות משכנתא` or `נתונים לסילוק מלא`, one per file number (`תיק`). A `לוח סילוקין` or an advisor's `דוח משכנתא` can be added. Attach a refinancing offer too and you get the Mode B opinion.

**About the PDF** — the Hebrew report always works. The styled RTL PDF additionally needs `pandoc` and a PDF engine, which not every environment has. When it can't render, the Markdown report stands on its own and prints to PDF from any browser.

---

### Option 0 — paste a prompt, install nothing

Claude reads the skill's files straight out of this repository, so you get the method without installing it.

1. Open a new chat at **claude.ai**, with web access enabled.
2. Attach your mortgage PDFs.
3. Paste this:

```
מצורפים אישורי יתרות משכנתא לניתוח.

לפני שאתה מתחיל, קרא את הקבצים הבאים ופעל לפיהם במדויק:
https://raw.githubusercontent.com/OrrZwebner/israeli-mortgage-analysis/main/skills/mortgage-refinance-analysis/SKILL.md
https://raw.githubusercontent.com/OrrZwebner/israeli-mortgage-analysis/main/skills/mortgage-refinance-analysis/references/extraction.md
https://raw.githubusercontent.com/OrrZwebner/israeli-mortgage-analysis/main/skills/mortgage-refinance-analysis/references/calculations.md
https://raw.githubusercontent.com/OrrZwebner/israeli-mortgage-analysis/main/skills/mortgage-refinance-analysis/references/regulations.md
https://raw.githubusercontent.com/OrrZwebner/israeli-mortgage-analysis/main/skills/mortgage-refinance-analysis/references/report-structure.md

חלץ כל נתון מהמסמכים, אמת את החילוץ מול הסכומים של הבנק עצמו,
בדוק את תנאי השוק העדכניים, וכתוב את הדוח המלא בעברית לפי report-structure.md.
```

> **The weakest route, and worth knowing why.** Pasting a bare link to this repository does *not* load the skill: Claude skims the README and writes a confident report without the reconciliation checks — the exact failure this exists to prevent. Naming the files fixes that. Even so, `mortgage_calc.py` never runs, so the arithmetic is checked by hand rather than by the script. Fine for a first look; use Option A if the answer will inform a real decision.

---

### Option A — upload the skill to claude.ai

No terminal, nothing installed on your computer.

1. Download **`mortgage-refinance-analysis.zip`** from the [latest release](../../releases/latest). Don't unzip it.
2. Go to **claude.ai** → **Customize** → **Skills**.
3. Click **Upload skill**, pick that file, and make sure the **mortgage-refinance-analysis** toggle is **on**.

Then start a chat, attach the PDFs, and ask. Claude loads the skill itself once it sees the documents — you don't need to name it.

> Use the release file, not the green **Code → Download ZIP** button. That one gives you the whole repository, which buries `SKILL.md` three folders deep and won't be recognised as a skill.

---

### Option B — Claude Code, as a plugin

Two commands inside Claude Code, nothing to download by hand:

```
/plugin marketplace add OrrZwebner/israeli-mortgage-analysis
/plugin install israeli-mortgage-analysis
```

---

### Option C — Claude Code, as a standalone skill

Copy `skills/mortgage-refinance-analysis/` into `~/.claude/skills/` (all projects) or `.claude/skills/` (one project). Same skill as Option B, without the plugin wrapper or its updates.

---

### Option D — the local dashboard

A web page on your own computer: drag the PDFs in, press one button, read the report. Nothing is deployed and the documents never leave your machine.

![The dashboard](docs/screenshot-desktop.png)

Two one-time setup steps, then starting it. Everything below is typed into the **Terminal** app — on a Mac, press `⌘`+`Space`, type `terminal`, press Enter.

**1 — install Node.js**, the engine the app runs on. Get it from [nodejs.org](https://nodejs.org) and install it like any other app. To check, paste this — any number 20 or higher is fine:

```bash
node --version
```

**2 — log in to Claude.** Paste these one at a time:

```bash
npm install -g @anthropic-ai/claude-code
claude
```

When Claude opens, type `/login`, press Enter, and log in through the browser. Type `exit` to leave. You never need to do this again.

**3 — get the app and start it:**

```bash
git clone https://github.com/OrrZwebner/israeli-mortgage-analysis
cd israeli-mortgage-analysis
./run.sh
```

> If a window asks to install *command line developer tools*, click **Install**, let it finish, and paste the block again.

The script installs what it needs on the first run, checks the environment, and opens the dashboard in your browser. If something is missing it stops and tells you what to fix. Then drag the PDFs in and press **התחל ניתוח** — it takes a few minutes and you can watch every step.

After that, starting it is just `cd israeli-mortgage-analysis && ./run.sh`. For your phone, use `./run.sh --mobile` and scan the QR code it prints (same Wi-Fi). Troubleshooting, configuration, and what the agent is allowed to do: [`web/README.md`](web/README.md).

## What it checks that people miss

- **Rate resets that already happened** — variable tracks reset on a cycle from origination; a reset often explains a payment jump nobody registered, and is frequently the whole reason refinancing suddenly makes sense
- **Stale advisor reports** — a third-party `דוח משכנתא` goes out of date the moment a track resets, understating the true cost
- **The 5% framework buffer** — approvals quote a framework ~5% above the real balance, inflating every headline figure in the offer
- **Rate holding protects the margin, not the rate** — on variable tracks the quoted rate is indicative; the anchor is set at execution
- **Average-index fee timing** — on linked tracks, executing from the 16th of the month avoids it entirely, at zero cost
- **No-notice fee waiver** — the prepayment order waives it when the same bank funds the refinance
- **Composition limits** — Directive 329 defines "variable" more broadly than most commentary assumes, and its refinancing test is incremental rather than absolute

## What's in here

```
skills/mortgage-refinance-analysis/
├── SKILL.md          the method
├── references/       bank-PDF field map · formulas · Directives 329/451 · report structure
└── scripts/          mortgage_calc.py (calculations + verification) · build_pdf.py (RTL PDF)
web/                  the dashboard — Agent SDK + Express + one HTML page
```

Running the scripts directly, the test suite, and how to cut a release: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Scope

This analyses the documents you supply plus public market data. It is not licensed financial advice, and the reports say so. Rates, forecasts, and regulatory text move — the skill looks up current market data at run time rather than trusting stored values, and decisive regulatory points should be checked against [boi.org.il](https://www.boi.org.il).

## License

[MIT](LICENSE) © Orr. The skill, the scripts, and the dashboard are all covered — use, modify, and redistribute freely, with no warranty.
