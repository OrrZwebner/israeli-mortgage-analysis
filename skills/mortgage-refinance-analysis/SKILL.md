---
name: mortgage-refinance-analysis
description: Analyze Israeli mortgages (משכנתא) from bank payoff statements and produce a full Hebrew refinancing analysis report as Markdown + RTL PDF. Two modes — (A) balance statements only, producing a standalone "ניתוח משכנתא וכדאיות למחזור" that ranks every track by refinancing priority, and (B) balance statements plus a bank refinancing offer (אישור עקרוני), producing a full opinion with a recommendation, small-print findings, stress tests, exit-station planning, and action items. Use this skill whenever the user uploads or mentions אישור יתרות משכנתא, נתונים לסילוק מלא, לוח סילוקין, דוח משכנתא, אישור עקרוני להלוואה לדיור, or asks anything about מחזור משכנתא, כדאיות מחזור, האם כדאי למחזר, comparing mortgage tracks, prepayment fees (עמלת פירעון מוקדם / היוון), or evaluating a mortgage offer — even if they only say "תסתכל על המשכנתא שלי" or attach the PDFs without a question.
---

# Israeli Mortgage Refinance Analysis

Produce a rigorous, verifiable Hebrew analysis of an Israeli mortgage and its refinancing prospects.

The core value of this skill is **arithmetic that is checked against the bank's own documents**. Every number in the report should either come from a source document or be derived by a formula whose result matches a figure in that document. When a derived number does not reconcile, say so in the report rather than smoothing it over — unreconciled figures are the single most useful thing a borrower can take to their banker.

## Modes

Determine the mode from what the user provided:

| Mode | Inputs | Output |
|---|---|---|
| **A — Portfolio analysis** | Balance statements / amortization schedules only (`אישור יתרות`, `נתונים לסילוק מלא`, `לוח סילוקין`, advisor `דוח משכנתא`) | `ניתוח משכנתא וכדאיות למחזור` — per-track diagnosis, refinancing priority ranking, target terms to demand, action items |
| **B — Offer evaluation** | The same, **plus** a bank refinancing offer (`אישור עקרוני להלוואה לדיור`) | Full opinion with a clear recommendation (חתום / אל תחתום / חתום בתנאים), small-print findings, economic analysis, exit-station plan, action items |

If the user provides an offer but no balance statements, ask for the balance statements — the offer alone cannot be evaluated, because its whole value depends on what it replaces.

## Workflow

1. **Extract** every figure from the source documents. Read `references/extraction.md` first — Israeli bank PDFs have RTL text-layer scrambling and a specific field layout, and the reference explains how to read them and which traps to avoid.
2. **Verify** the extraction using the reconciliation identities in `references/extraction.md` (§ Verification). Do not proceed to analysis until the parts sum to the file totals. Run `scripts/mortgage_calc.py` to check the index coefficients and fee formulas.
3. **Diagnose** each track — read `references/calculations.md` for the formulas and `references/regulations.md` for the legal framework.
4. **Research** current market conditions. Search the web for: Bank of Israel policy rate and the date of the next decision, the research department's rate and inflation forecasts, average mortgage rates by track (`ריבית ממוצעת משכנתאות בנק ישראל`). Never rely on training data for these — they move constantly and the whole analysis hinges on them.
5. **Write** the report following `references/report-structure.md`.
6. **Render** to PDF with `scripts/build_pdf.py`, then present both the `.md` and `.pdf`.

## The central diagnostic

Every Israeli payoff statement prints a line called **"שיעור הריבית לצרכי השוואה"** for each track. The bank states the rule itself: if that figure exceeds the total expected rate (`ריבית כוללת חזויה`) of a new loan, refinancing that track is economically worthwhile.

This is the backbone of both modes. It is authoritative, it is per-track, and it already embeds inflation expectations for index-linked tracks — which is why an index-linked track shows a comparison rate materially above its stated real rate.

In Mode A there is no offer to compare against, so use the **current market average for the equivalent new track** (from step 4) as the comparison threshold, and state that assumption explicitly.

Rank tracks into three buckets and never blur them:

- **Refinance** — comparison rate materially above the threshold
- **Leave alone** — comparison rate at or below the threshold
- **Protected asset** — comparison rate far below market (typically old fixed non-linked tracks). Flag these loudly. Borrowers and even bankers sometimes sweep them into a refinance and destroy hundreds of thousands of shekels. A negative `סכום הפחתה מעמלת היוון` is the tell: the bank cannot charge a discounting fee because market rates are above the track's rate.

## Things that are easy to miss and change the answer

These recur across almost every real case. Check each one explicitly and report the result even when the finding is "not applicable here".

- **A rate reset that already happened.** Variable tracks reset on a fixed cycle from the origination date. If the monthly payment implies a rate different from the one an advisor's report shows, a reset has occurred. Statements also carry the note "מועד שינוי הריבית חל חודש לפני התאריך המצוין" — the printed next-reset date is a month later than the effective one. A recent reset is often the entire reason refinancing suddenly makes sense.
- **A stale advisor report.** If the user supplies a third-party `דוח משכנתא`, reconcile its monthly payments against the bank statements. These reports go stale the moment a track resets, and their headline "עלות סופית" understates reality.
- **The 5% framework buffer.** Refinancing approvals state a framework amount roughly 5% above the actual balance. Divide by 1.05 — if it lands on the balance, every headline figure in the offer (monthly payment, total cost, maximum payment) is inflated by the same 5% and must be restated on the real balance.
- **Rate hold protects the margin, not the rate.** For variable tracks, `שמירת ריבית` preserves only the `תוספת/הפחתה מריבית הבסיס`. The anchor is set at execution. The headline rate is indicative.
- **The average-index fee is a timing choice.** On index-linked tracks the fee applies only to prepayment between the 1st and the 15th of the month. Executing from the 16th onward costs nothing and avoids it entirely.
- **The no-notice fee usually vanishes in an internal refinance.** The prepayment order waives it for the portion covered by a new loan from the same bank.
- **Composition limits.** See `references/regulations.md` § 329 — and note the definition of "variable" is broader than most people assume.

## Report requirements

- **Hebrew, RTL.** The audience is the borrower and their banker.
- **Show the arithmetic.** Include a verification table proving the extracted components reconcile with the bank's own totals. This is what makes the report trustworthy rather than merely confident.
- **Quantify the cost of delay** when recommending action: the effective rate differential times the balance, divided by 12. Borrowers underestimate this badly and wait months for a 0.05% improvement.
- **Separate what the borrower decides from what the bank decides.** Fees the bank *may* charge are not entitlements; describe waivers as discretionary rather than as rights.
- **Never present a recommendation as financial advice.** Open with a one-line note that this is an analysis of the supplied documents and public market data, not licensed advice.
- **Action items grouped by deadline** — before the rate expiry, at execution, and long-term follow-up.

Full section-by-section structure, including which sections are Mode A vs Mode B, is in `references/report-structure.md`.

## Scripts

- `scripts/mortgage_calc.py` — Spitzer payments, index coefficients, remaining balances, effective nominal rate for index-linked tracks, prepayment fee checks, delay cost, break-even anchor. Run `python scripts/mortgage_calc.py --help` for the subcommands.
- `scripts/build_pdf.py` — renders a Hebrew Markdown report to a styled RTL A4 PDF via pandoc plus a PDF engine (wkhtmltopdf if installed, otherwise headless Chrome/Chromium/Edge). Handles the glyph substitutions that would otherwise render as black boxes.

## Tone

Write for a numerate reader who is not a finance professional. Explain mechanisms rather than asserting conclusions — a borrower who understands why an index-linked track costs more in nominal terms than its stated real rate will negotiate better than one who has been told to sign. Where the analysis rests on an assumption (inflation path, future anchor levels), name the assumption and show what happens if it is wrong.
