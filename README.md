# Israeli Mortgage Analysis

A Claude plugin that reads Israeli bank mortgage documents and produces a full Hebrew refinancing analysis report as Markdown and a styled RTL PDF.

## What it does

Israeli mortgages are split into tracks (`מסלולים`) with different rate mechanisms, linkage bases, and reset cycles. Whether refinancing makes sense is a per-track question, and the answer is frequently counterintuitive — an old fixed non-linked track is usually worth protecting at all costs, while an index-linked track that just reset can be quietly costing far more in nominal terms than its stated real rate suggests.

This plugin extracts every figure from the bank's own statements, **verifies the extraction against reconciliation identities**, ranks each track by refinancing priority using the bank's own `שיעור הריבית לצרכי השוואה`, and writes a report the borrower can take to their banker.

### Two modes

| Mode | Inputs | Output |
|---|---|---|
| **A** | `אישור יתרות משכנתא` / `נתונים לסילוק מלא` / `לוח סילוקין` | `ניתוח משכנתא וכדאיות למחזור` — per-track diagnosis, refinancing priority, target terms to demand, action items |
| **B** | The above **plus** `אישור עקרוני להלוואה לדיור` | Full opinion — recommendation, small-print findings, economic analysis at the borrower's actual horizon, stress tests, exit-station plan, action items |

## Installation

### As a plugin

```
/plugin marketplace add OrrZwebner/israeli-mortgage-analysis
/plugin install israeli-mortgage-analysis
```

### As a standalone skill

Copy `skills/mortgage-refinance-analysis/` into your skills directory, or upload the packaged `.skill` file.

### On claude.ai — no terminal required

No terminal, no Claude Code. Install it as a **skill** instead of a plugin. Requires a paid Claude plan.

1. Download **`mortgage-refinance-analysis.zip`** from the [latest release](../../releases/latest). Don't unzip it.
2. Go to **claude.ai** → **Customize** in the left sidebar → **Skills**.
3. Click **Upload skill**, pick the file you just downloaded, and make sure the toggle next to **mortgage-refinance-analysis** is **on**.

Then start a new chat, attach your mortgage PDFs, and ask in Hebrew — see [Usage](#usage). Claude loads the skill by itself once it sees the documents; you don't need to name it.

> Use the release file, not the green **Code → Download ZIP** button. That button gives you the entire repository, which buries `SKILL.md` three folders deep and won't be recognized as a skill. The release archive is built for uploading as-is.

**Which files to attach** — ask your bank for `אישור יתרות משכנתא` or `נתונים לסילוק מלא`, one per file number (`תיק`). Add the refinancing offer (`אישור עקרוני להלוואה לדיור`) if you have one, and you get the fuller Mode B opinion.

**About the PDF** — the Hebrew report always works. The styled RTL PDF needs `pandoc` and `wkhtmltopdf` in the runtime, which is not guaranteed on claude.ai. If it fails, the Markdown report is complete on its own and you can print it to PDF from your browser.

## Usage

Attach the PDFs and ask in either language:

```
מצורפים אישורי יתרות של המשכנתא שלי — תנתח ותגיד אם כדאי למחזר
```

```
מצורפים אישורי יתרות והצעה למחזור מהבנק. תן חוות דעת מלאה.
```

The skill triggers on mentions of `מחזור משכנתא`, `אישור יתרות`, `אישור עקרוני`, `כדאיות מחזור`, prepayment fees, or comparing mortgage tracks.

## What it checks that people miss

- **Rate resets that already happened** — variable tracks reset on a cycle from origination; a reset often explains a payment jump the borrower hasn't registered, and is frequently the entire reason refinancing suddenly makes sense
- **Stale advisor reports** — third-party `דוח משכנתא` files go out of date the moment a track resets, understating the true cost
- **The 5% framework buffer** — refinancing approvals quote a framework ~5% above the real balance, which inflates every headline figure in the offer
- **Rate holding protects the margin, not the rate** — on variable tracks the quoted rate is indicative; the anchor is set at execution
- **Average-index fee timing** — on linked tracks, executing from the 16th of the month avoids it entirely, at zero cost
- **No-notice fee waiver** — the prepayment order waives it when the same bank funds the refinance
- **Composition limits** — Directive 329 defines "variable" more broadly than most commentary assumes, and its refinancing test is incremental rather than absolute

## Repository layout

```
.claude-plugin/plugin.json
skills/mortgage-refinance-analysis/
├── SKILL.md
├── references/
│   ├── extraction.md          field map for Israeli bank PDFs, RTL traps, verification identities
│   ├── calculations.md        Spitzer, index linkage, prepayment fees, horizon economics, break-even
│   ├── regulations.md         Directives 329 and 451, the 2002 prepayment order, uniform baskets
│   └── report-structure.md    section-by-section output structure for both modes
└── scripts/
    ├── mortgage_calc.py       calculations and extraction verification
    └── build_pdf.py           Hebrew Markdown to styled RTL A4 PDF
```

## Scripts

```bash
# verify extracted tracks against the bank's own totals
python scripts/mortgage_calc.py verify tracks.json

# detect whether a rate reset has occurred
python scripts/mortgage_calc.py rate <balance> <monthly_payment> <months_remaining>

# Spitzer payment, index coefficient, delay cost, stress test
python scripts/mortgage_calc.py pmt <principal> <rate> <months>
python scripts/mortgage_calc.py index <principal> <known_index> <base_index>
python scripts/mortgage_calc.py delay <balance> <current_effective_rate> <offered_rate>
python scripts/mortgage_calc.py stress <principal> <rate> <months> <k> --scenarios 4.5 5.5 6.5

# render the report
python scripts/build_pdf.py report.md report.pdf
```

`build_pdf.py` requires `pandoc`, `wkhtmltopdf`, and a Hebrew-capable font (DejaVu Sans on most Linux images).

## Scope

This produces an analysis of supplied documents and public market data. It is not licensed financial advice, and the reports it generates say so. Rates, forecasts, and regulatory text change — the skill searches for current market data at run time rather than relying on stored values, and decisive regulatory points should be verified against `boi.org.il`.
