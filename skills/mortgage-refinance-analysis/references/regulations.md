# Regulatory framework

Israeli mortgage regulation is genuinely load-bearing in this analysis: it determines what the bank may charge, what mixes it may approve, and what disclosure the borrower is owed. Getting it wrong in either direction — inventing a constraint or missing one — damages the report's credibility.

When a regulatory point is decisive, verify the current text against `boi.org.il` rather than relying on this summary. Directives get amended.

## Contents

1. Directive 329 — mortgage limits
2. Directive 451 — disclosure and the principle approval
3. The prepayment order (2002)
4. Uniform baskets
5. Rate holding

---

## 1. Directive 329 — `מגבלות למתן הלוואות לדיור`

### The definition that trips people up

> "הלוואה לדיור בריבית משתנה" — הלוואה לדיור, **או חלק ממנה, שהריבית שהיא נושאת עשויה להשתנות לאורך תקופת ההלוואה**

There is **no exemption for long reset cycles**. A track resetting every five years is variable exactly as a prime track is. This is counterintuitive — market commentary often treats five-year tracks as quasi-fixed — and getting it wrong produces a confidently wrong conclusion.

### The limits

| Section | Limit |
|---|---|
| § 2 | LTV: single dwelling 75%, replacement dwelling 70%, investment 50% |
| § 5 | Payment-to-income ratio not above 50% (above 40% triggers a 100% risk weight) |
| § 7 | **Variable portion not above 66.66%** of the loan |
| § 8 | Final maturity not above 30 years |

The prime-specific cap was abolished in December 2020; only the general variable cap remains.

### The refinancing rule — § 9

> תאגיד בנקאי לא יאשר ולא יבצע מיחזור של הלוואה לדיור, **אם כתוצאה מן המיחזור נוצרה חריגה** מאחת המגבלות המפורטות לעיל, **או הוגדלה חריגה שהייתה קיימת ערב המיחזור**

The test is **incremental, not absolute**. A borrower already above the variable cap may still refinance, provided the transaction does not worsen the ratio. Swapping one variable track for another leaves it unchanged and is therefore permitted.

§ 9 also limits the refinance to "סכום שאינו עולה על סכום ההלוואה הנפרעת" — useful leverage when an approval's framework exceeds the actual balance.

### Passive drift

A compliant mix can drift out of range without anyone doing anything: index-linked variable tracks grow with the CPI while fixed tracks only amortize, pushing the variable share up over time. When you find a borrower above the cap, check whether this explains it — the distinction between drift and a breach at approval matters, and it reassures a borrower who would otherwise think something is wrong.

### The forward-looking consequence

A borrower at or above the cap **cannot increase their variable share** at a future refinancing. Adding prime would require adding fixed in parallel. Conversely, adding a fixed track improves the bank's ratio, which makes it the easiest request to get approved. Worth stating in any exit-station plan.

---

## 2. Directive 451 — `נהלים למתן הלוואות לדיור`

Governs disclosure, the principle approval, and refinancing procedure. Practical points:

- The principle approval must state the rate mechanism, the derived rate at issue date, the derived monthly payment, and a notice that the rate may change.
- A variable track's linkage basis and rate mechanism cannot change mid-life, though the loan may grant the borrower an option to switch.
- 2023 amendments eased refinancing procedure, including moving between banks.

---

## 3. The prepayment order — `צו הבנקאות (פרעון מוקדם של הלוואה לדיור), התשס"ב-2002`

Fee mechanics are in `calculations.md` § 4. The legally significant points:

**Fees are capped, not mandated.** The order sets maxima a bank *may* charge. Anything below is negotiable, and the loan agreement may provide further reductions.

**Statutory reductions to the discounting fee**, by elapsed time from origination:

| Elapsed | Regular loan | Supplementary loan |
|---|---|---|
| Under 1 year | none | none |
| 1–2 years | none | 10% |
| 2–3 years | none | 20% |
| 3–4 years | 20% | 30% |
| 4–5 years | 20% | 40% |
| 5+ years | 30% | 40% |

**Waiver when the same bank funds the prepayment:** "אם נתן התאגיד הבנקאי הלוואה לצורך הפרעון המוקדם, לא תגבה העמלה האמורה... ביחס לסכום ההלוואה החדש שנתן". This applies to the no-notice fee and materially reduces the cost of an internal refinance.

**No fee on a reset date.** For variable tracks, prepayment on the rate-update date incurs no fee beyond the operational one. This is what creates exit stations.

**Section 9א1 of the Banking (Service to Customer) Law** restricts prepayment fees when the mortgage is being discharged on sale of a sole residence, subject to consideration thresholds.

**Disclosure duties:** the bank must supply a fee-explanation sheet when prepayment is requested, and within 60 days of execution a breakdown of what was actually charged. Borrowers can and should ask for both.

---

## 4. Uniform baskets — `סלים אחידים`

An approval must present **four** baskets: three standardized by the Bank of Israel plus the bank's own proposal. The standardized ones exist so a borrower can compare offers across banks on identical terms.

They are often missing, blank, or omitted from what the borrower receives. Check, and if absent, make requesting them an action item — they are the single most useful comparison tool available and cost nothing.

---

## 5. Rate holding — `תוקף שמירת הריבית`

Typically ~10 days from issue, with the approval itself valid ~45 days.

The distinction that matters:

- **Fixed tracks** — the rate itself is held.
- **Variable tracks** — only the `תוספת/הפחתה מריבית הבסיס` (the bank's margin) is held. The anchor floats and is set at execution.

So a quoted variable rate is **indicative**. Loan documents also specify when the anchor is computed — commonly twice monthly, on the 11th and 26th — and which of those readings governs a reset. Read the specific clause; it determines both the execution rate and every future reset.
