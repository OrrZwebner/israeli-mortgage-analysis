# Report structure

Both modes share a spine. Mode A stops at diagnosis and target terms; Mode B adds evaluation of a specific offer.

Write in Hebrew, RTL, with tables. Number sections so action items can reference them. Open with a one-line note that this is an analysis of the supplied documents and public market data, not licensed financial advice.

Length is not the goal — reconciliation is. A report where every figure traces to a source document earns trust that no amount of prose will.

---

## Mode A — `ניתוח משכנתא וכדאיות למחזור`

### 1. תקציר מנהלים

Headline table: total balance, total monthly, LTV, composition by rate type, weighted effective cost. Then the verdict in one line — which tracks warrant refinancing, roughly what it is worth, and what to do first.

### 2. תמונת המצב

Full track table: file, type, rate, balance, monthly, maturity, next reset.

Composition breakdown (fixed / prime / variable-linked / variable-unlinked) as amounts and percentages. LTV against the stated property value.

If an advisor report was supplied, reconcile it here and flag discrepancies.

### 3. אנטומיה של המשכנתא — איך מחושב כל מסלול

This section is what makes the rest credible.

- The four balance components and what each means
- The Spitzer formula and the recalculation rule
- How the rate is set in each track type present
- **Full per-track component breakdown, one table per file**
- **Verification block** — show that components sum to subtotals and subtotals to file totals, that the index coefficient reproduces the stated linkage differences, and that the no-notice fee reproduces at 0.1% of linked principal. Mark each check.
- Prepayment fee breakdown per track, with the reductions applied

### 4. מנגנון ההצמדה

Only if linked tracks are present. Coefficient math, publication timing and lag, the monthly index cost against the principal repaid, and the resulting net debt reduction. This is usually the most persuasive section in the whole report.

### 5. רקע מקרו-כלכלי

From live search: policy rate and next decision date, research-department rate and inflation forecasts, average mortgage rates by track type, relevant anchor yields. Table form, dated. Follow with two or three sentences on what it implies for this specific mortgage.

### 6. דירוג המסלולים לפי כדאיות מחזור

The core output. For each track: comparison rate, market threshold, gap, and verdict.

| Bucket | Criterion |
|---|---|
| **למחזר** | comparison rate materially above threshold |
| **לא לגעת** | comparison rate at or below threshold |
| **נכס מוגן** | comparison rate far below market — refinancing would destroy value |

Explain the protected-asset finding explicitly, including the negative-reduction tell. Quantify the value at risk if these tracks were mistakenly included.

### 7. מה לבקש מהבנקים

Target terms for the tracks flagged for refinancing: amount, viable track types given the composition constraint, benchmark rates from § 5, and term. Note what the composition limit permits and forbids.

### 8. אילוצים רגולטוריים

Composition status now and after a hypothetical refinance. Whether drift or a real constraint. What it permits going forward.

### 9. עלות ההמתנה

Monthly cost of delay against the plausible gain from waiting.

### 10. Action Items

Grouped: immediate, at execution, follow-up. Each with a one-line rationale.

---

## Mode B — full opinion on a specific offer

Sections 1–5 and 8–9 as above, with these changes and additions.

### 1. תקציר מנהלים

Add: actual refinanced balance, framework amount, current vs offered monthly, cost of the move, benefit over the borrower's stated horizon, benefit to maturity, cost of delay. State the recommendation plainly — sign / do not sign / sign subject to conditions.

### 6. ההצעה — פירוק ותיקון

- Offer terms as stated
- **Framework reconciliation** — divide by 1.05 and show where it lands. If it matches the balance, restate every headline figure on the real amount in a two-column "as stated / actual" table. This single correction is often the most surprising thing in the report.
- Cite § 9 of Directive 329 on the amount not exceeding the repaid loan

### 7. האם כדאי להמתין

Whether the anchor already prices expected policy moves, and the delay cost from § 9. Reach a conclusion.

### 8. מרווח מול עוגן

Separate the bank's fixed margin from the market anchor. State plainly that rate holding preserves only the margin and that the quoted rate is indicative. Give the sensitivity of a plausible anchor move in shekels per year.

### 9. מגבלת הרכב המסלולים

Before/after composition. Apply the § 9 incremental test. State whether it passes and what it means for the next refinancing.

### 10. האותיות הקטנות

Everything the borrower would not otherwise notice. Include at minimum:

- Prepayment terms on the new loan and where the exit stations fall
- Average-index fee timing — with the explicit instruction to execute from the 16th
- Guarantor and standing-order conditions
- Appraisal, insurance, credit-report conditions
- Whether the uniform baskets were provided
- Term versus the tracks being closed — shorter, equal, or an extension
- Which fees are entitlements versus discretionary waivers
- Rate-hold expiry and approval validity

### 11. ניתוח כלכלי

Horizon comparison (payments, residual balance, costs, net advantage) at two inflation assumptions. Then to-maturity comparison. Then break-even in anchor terms.

### 12. תחנת היציאה

Only when the offer has reset stations and the borrower intends to use one.

- What is and is not exempt at the station
- The exact station date, including the one-month offset caveat
- Timeline working backwards, with the 10–45 day notice window marked
- Risks and mitigations
- What the composition limit will permit at that point

### 13. Action Items

Grouped by deadline: before rate expiry, at execution, follow-up. Reference section numbers.

### 14. שורה תחתונה

Restate the recommendation, the headline number, and the two or three operational details that matter more than further negotiation.

---

## Versioning

When revising a report after new information, add a `מה חדש בגרסה N` block at the top summarizing changes. If a previous version contained an error, **say so explicitly and mark the corrected section**. A correction stated openly strengthens the document; a silent fix means the borrower may act on the old version.

## Output

Write the Markdown, render with `scripts/build_pdf.py`, present both files. Keep the Markdown so the report can be revised and re-rendered.
