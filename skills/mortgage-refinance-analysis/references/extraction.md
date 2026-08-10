# Extracting data from Israeli mortgage documents

## Contents

1. Document types
2. The payoff statement (`נתונים לסילוק מלא`) — field map
3. Reading the two-column rate block
4. The refinancing approval (`אישור עקרוני`) — field map
5. Third-party advisor reports
6. Verification identities
7. RTL extraction traps

---

## 1. Document types

| Document | Hebrew title | What it gives you |
|---|---|---|
| Payoff statement | `נתונים לסילוק מלא של הלוואה בתיק` / `אישור יתרות משכנתא` | Per-track balances, rates, dates, prepayment fees. **The authoritative source.** |
| Refinancing approval | `אישור עקרוני להלוואה לדיור` | Offered tracks, rates, term, fees, conditions, validity |
| Advisor report | `דוח משכנתא` | Convenient summary, often stale — treat as unverified |
| Amortization schedule | `לוח סילוקין` | Payment-by-payment breakdown; useful but usually redundant |

One borrower commonly has **several תיקים** (file numbers), each containing **several חלקים** (tracks). Always work at the track level and keep the file number attached, because prepayment fees and operational fees are charged per file.

---

## 2. Payoff statement — field map

### File-level header (per תיק)

- `מס' תיק` — file number
- `סכום המסגרת` / `סכום הביצוע` — original framework and drawn amount
- `היתרה לסילוק בתיק` — total payoff including fees
- `ההחזר החודשי` — total monthly for the file
- `מטרת הלוואה` — purpose (`בניה עצמית`, `מיחזור לבנק אחר`, etc.)
- `לתאריך` — **the calculation date. Every figure is valid only for that date.**

### Per-track block (per חלק)

Left side, `נתונים כלליים`:

- `שם החלק בהלוואה` — track type, e.g. `לא צמוד, ריבית פריים, שפיצר` / `ריבית קבועה לא צמודה למדד` / `משתנה צמודה כל 1,2.5,5 שנים על בסיס אג"ח ממשלתי`
- `סכום חלק זה בעת הביצוע` — original amount
- `תאריך הביצוע`, `תאריך חיוב ראשון`, `תאריך סיום חלק זה`
- `סוג הריבית` — קבועה / פריים / משתנה
- `מנגנון קביעת הריבית` — the anchor definition
- `תדירות שינוי הריבית` — reset frequency in months
- `מועד שינוי הריבית הקרוב` — next reset (**see the one-month note in § 7**)
- `סוג ההצמדה` — צמוד מדד / לא צמוד
- `מדד הבסיס לחישוב ההצמדה` — base index (linked tracks only)
- `סכום החיוב החודשי בגין חלק זה` — monthly payment
- `שיעור ריבית ממוצעת במועד הסילוק` — **the Bank of Israel published market average for this track type.** Extremely useful: it is a free, authoritative market benchmark.
- `הריבית הכוללת החזויה` and `שיעור הריבית לצרכי השוואה` — the refinancing decision metric

Right side, `נתונים לסילוק`:

- `יתרת הקרן`
- `הפרשי הצמדה על הקרן`
- `ריבית`
- `הפרשי הצמדה על הריבית`
- `סיכום ביניים` = sum of the four above
- `עמלת פרעון מוקדם`: `עמלת אי הודעה`, `פיצוי מדד`, `הפרשי היוון (לאחר הפחתה אם ישנה)`, `שיעור הפחתה`, `סכום הפחתה`
- `סה"כ עמלת פרעון מוקדם`
- `סכום הסילוק בחלק זה` = `סיכום ביניים` + total fee

### File summary page

`קרן ריבית והצמדה`, `עמלות לסילוק ההלוואה`, `עמלת עלות` (the ~60 ₪ operational fee), `סה"כ לסילוק`, plus `מדד ידוע` — the known index used for all linked calculations.

---

## 3. Reading the two-column rate block

Variable tracks print rate data in two columns headed `מועד החישוב` and `מתן ההלוואה`. Because of RTL extraction the column order is unreliable in the text layer.

**Resolve it by arithmetic, not by position.** Both columns satisfy `anchor + margin = rate`, and the margin is identical in both. So:

1. Pair each anchor with the rate that differs from it by the stated margin.
2. Determine which pair is *current* by computing the Spitzer payment on `סיכום ביניים` over the remaining months at each candidate rate, and comparing to `סכום החיוב החודשי`.

The pair that reproduces the actual monthly payment is the current rate. This matters enormously: when the "מתן ההלוואה" rate sits far below the current one, the borrower's cost may have risen severalfold since origination and they may not know it.

---

## 4. Refinancing approval — field map

From the `סל מוצע` table:

- `שם ההלוואה` (per offered track), `סכום ההלוואה`, `תקופת ההלוואה (חודשים)`, `אופן התשלום`
- `שיעור הריבית השנתית`
- `מנגנון קביעת הריבית` — anchor, its tenor, and the additive margin
- `הריבית הכוללת החזויה (כולל עמלות ותחזיות)` — the comparison threshold
- `סכום ההחזר החודשי (חודש ראשון)`
- `סכום ההחזר החודשי הגבוה ביותר הצפוי` and the month it occurs
- `סך כל הסכום הצפוי החזוי`
- `עמלות`
- `האם קיימת עמלת פירעון מוקדם בגין הפרשי ריבית` — read the exemption wording carefully; "בחודש עדכון הריבית בלבד" defines the exit stations

Elsewhere in the approval:

- `תוקף שיעורי הריבית המוצגים לעיל הוא עד` — the rate-hold expiry (usually ~10 days)
- Validity of the approval itself (usually 45 days)
- `תכנית מימון` — `יתרת ההלוואות המיועדות למיחזור` and `סכום ההלוואה המבוקשת`
- `התחייבות נוספות` — existing debt the bank sees, and the portion being discharged
- `פירוט התניות לביצוע ההלוואה` — guarantors, standing order structure, insurance, appraisal, credit report
- `פרטי הנכס` — property value, used for LTV

**Check whether the three `סלים אחידים` (uniform baskets) are present.** Regulation requires the bank to present three standardized baskets alongside its own proposal so the borrower can compare across banks. They are frequently missing or blank. Flag it.

---

## 5. Third-party advisor reports

Useful for orientation, unreliable for arithmetic. Always reconcile each track's monthly payment against the bank statement. A mismatch on a variable track almost always means the report predates a rate reset.

When they disagree, the bank statement wins, and the discrepancy belongs in the report as a finding.

Advisor reports also decompose rates differently (their "anchor" and "margin" may not match the contract's `תוספת הנקובה בהלוואה`). The contract decomposition is what governs future resets, so use the bank's.

---

## 6. Verification identities

Run all of these. They are cheap and they catch extraction errors that would otherwise propagate through the whole report.

**Identity 1 — track components sum to the subtotal**

```
יתרת הקרן + הפרשי הצמדה על הקרן + ריבית + הפרשי הצמדה על הריבית = סיכום ביניים
```

**Identity 2 — tracks sum to the file total**

```
Σ סיכום ביניים (all tracks in file) = קרן ריבית והצמדה (file summary)
Σ סה"כ עמלת פרעון מוקדם            = עמלות לסילוק ההלוואה
```

**Identity 3 — the index coefficient**

```
הפרשי הצמדה על הקרן ≈ יתרת הקרן × (מדד ידוע / מדד הבסיס − 1)
```

Should match to within a shekel or two. A large miss means the wrong base index was read.

**Identity 4 — the no-notice fee**

```
עמלת אי הודעה = 0.001 × (יתרת הקרן + הפרשי הצמדה על הקרן)
```

Note the base **excludes accrued interest**. This identity reproduces the published figure to the agora and is a strong confirmation that the principal and index figures were read correctly.

**Identity 5 — the payoff amount**

```
סכום הסילוק בחלק זה = סיכום ביניים + סה"כ עמלת פרעון מוקדם
```

If any identity fails, re-read the source rather than adjusting the numbers. `scripts/mortgage_calc.py verify` runs identities 1, 3, 4 and 5 from a small JSON description of the tracks.

---

## 7. RTL extraction traps

- **Numbers survive, order does not.** Hebrew PDFs extract with labels and values often separated or reversed. Match values to labels by magnitude and plausibility, then confirm with the verification identities.
- **Percentages appear with the sign detached.** `+ 5.000000 %` and `- 0.600000 %` may lose their signs. Recover them from `anchor + margin = rate`.
- **The one-month offset.** Statements carry: `מועד שינוי הריבית חל חודש לפני התאריך המצוין לעיל`. The printed next-reset date is one month *later* than the operative one. This determines the exit-station window and is worth restating in the report.
- **Dates are DD/MM/YYYY.**
- **A blank page is information.** Missing uniform baskets in an approval, or a missing track page, is a finding.
- **Zero versus absent.** `אין` in a fee field means the fee does not apply; `0.00` means it was computed and came out zero. For the discounting fee, `אין` alongside a negative `סכום הפחתה` means market rates are above the track's rate — the borrower is holding a valuable below-market loan.
