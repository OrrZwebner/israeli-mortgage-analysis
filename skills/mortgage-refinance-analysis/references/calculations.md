# Mortgage calculations

All formulas here are implemented in `scripts/mortgage_calc.py`. Use the script rather than doing the arithmetic by hand — the numbers appear in a report the borrower will show their banker, and a manual slip undermines the whole document.

## Contents

1. Spitzer amortization
2. Index linkage
3. Effective nominal rate of an index-linked track
4. Prepayment fees
5. Refinancing economics
6. Cost of delay
7. Break-even
8. Stress testing an exit station

---

## 1. Spitzer amortization

Every Israeli housing track uses `שפיצר (קרן וריבית)` — a level payment.

```
PMT = P × i / (1 − (1+i)^−n)
```

`i` = annual rate / 12, `n` = months remaining, `P` = current balance (**including accrued index** on linked tracks).

Remaining balance after `k` payments:

```
B = P(1+i)^k − PMT × ((1+i)^k − 1) / i
```

**The recalculation rule.** The schedule is rebuilt whenever the rate changes or the linked principal is revalued. This is why a reset produces a visible jump in the monthly payment even though the debt did not change. When explaining a payment jump, attribute it to recalculation at the new rate rather than to new borrowing — borrowers routinely misread it.

Payments computed from a statement will land within a few shekels of the printed figure, not exactly on it, because of partial first months and rounding conventions. Treat a match within ~1% as confirmation; a 10%+ gap means the wrong rate or the wrong remaining term.

---

## 2. Index linkage

Linked principal is **revalued, not accrued**:

```
קרן מוצמדת = קרן מקורית × (מדד ידוע / מדד בסיס)
הפרשי הצמדה = קרן × (מדד ידוע / מדד בסיס − 1)
```

Mechanics worth stating in any report covering linked tracks:

- The CBS publishes the CPI **monthly, around the 15th**, for the *previous* month.
- Banks use `מדד ידוע` — the last published index. There is roughly a two-month lag between actual inflation and its effect on the balance.
- Between publications the coefficient is frozen. The monthly revaluation is **one step per month**, not daily drift.
- Linkage is symmetric — a negative index reduces principal. Check the loan agreement for a floor clause preventing the coefficient from dropping below 1.

**Monthly index cost**, the number that usually drives the recommendation:

```
תוספת מדד חודשית ≈ יתרה מוצמדת × (אינפלציה שנתית / 12)
```

Compare it to the principal component of the monthly payment. When index accrual approaches or exceeds principal repayment, the borrower is barely reducing the debt — a fact worth putting in a table.

---

## 3. Effective nominal rate of an index-linked track

A linked track at rate `r` under inflation `π` costs approximately:

```
r_nominal ≈ (1 + r)(1 + π) − 1 ≈ r + π
```

This is why a linked track shows a `שיעור ריבית לצרכי השוואה` materially above its stated real rate. Prefer quoting the bank's own comparison rate over your own approximation — it is authoritative and uses the official forecast curve. Use the approximation to *explain* the comparison rate, not to replace it.

---

## 4. Prepayment fees

Governed by `צו הבנקאות (פרעון מוקדם של הלוואה לדיור), התשס"ב-2002`.

### Operational fee (`עמלה תפעולית`)

Flat, ~60 ₪, **per file**, always charged.

### No-notice fee (`עמלת אי הודעה`)

```
0.1% × (יתרת הקרן + הפרשי הצמדה על הקרן)
```

Waived entirely if the borrower gives written notice **10–45 days** before the prepayment date. Also waived, by the order, for the portion covered by a new loan from the same bank — so in an internal refinance it typically disappears. Confirm this with the banker; the quote will still print it.

### Discounting fee (`עמלת היוון` / `פערי ריבית`)

Charged only when the market average rate at prepayment is **below** the track's rate. Computed as the difference between the future payment stream discounted at the market average and at the track's own rate.

Two structural points that keep the fee small or zero:

- **Variable tracks discount only to the next reset date**, not to final maturity. A track resetting in five years has at most five years of exposure.
- **Statutory reductions** apply by elapsed time since origination — reaching 30% for a regular loan at five years or more.

If `סכום הפחתה` is **negative**, the fee is structurally zero and the borrower holds a below-market loan. Say so explicitly.

### Average-index fee (`עמלת מדד ממוצע` / `פיצוי מדד`)

Linked tracks only, and **only for prepayment between the 1st and the 15th of the month**. From the 16th to month end it is not charged at all.

```
הסכום הנפרע × ½ × (השיעור הממוצע של השינוי במדד ב-12 המדדים האחרונים)
```

At ~1.8% annual inflation the monthly average change is ~0.15%, so the fee runs ~0.075% of the balance — small in absolute terms, but avoidable at zero cost purely by timing. Always convert this into an explicit instruction to the banker.

### Exchange-rate fee (`עמלת הפרשי שער`)

FX-denominated or FX-linked loans only. Rare in this context.

---

## 5. Refinancing economics

Compare over **the horizon the borrower actually intends to hold the loan**, not automatically to maturity. A borrower planning to refinance again at the next exit station is buying a two-year loan, and a 24-year total-cost comparison misleads them.

For a horizon of `k` months:

```
עלות אפקטיבית = Σ תשלומים לאורך k חודשים + יתרה נותרת בחודש k + עלויות המהלך
```

Run it for both the status quo and the refinanced loan. For the linked status quo, inflate both the payments and the residual balance by the assumed index path. Report the horizon comparison as the headline and the to-maturity comparison as secondary.

Sensitivity: run at least two inflation assumptions (the central forecast and one meaningfully higher) and show both.

---

## 6. Cost of delay

Borrowers stall for months chasing marginal rate improvements. Quantify it:

```
עלות חודש של דחייה = (ריבית אפקטיבית נוכחית − ריבית מוצעת) × יתרה / 12
```

Then contrast against the plausible gain from waiting — typically an anchor move of 0.05–0.10%, worth `0.001 × balance` per year. Presenting these side by side usually settles the question immediately.

---

## 7. Break-even

For a variable offer, the break-even is the average rate at which the refinanced loan would cost the same as staying:

```
find r such that total_cost(new loan @ r) = total_cost(status quo)
```

Then translate it back into anchor terms by subtracting the fixed margin, and state how far that is from today's anchor. "The two-year bond yield would have to rise from today's level to an average of X% for the remaining term" communicates risk far better than a probability.

---

## 8. Stress testing an exit station

At the station, project the balance forward and recompute the payment across a range of rates:

```
B_station = balance after k months at the current rate
PMT(rate) = B_station × i / (1 − (1+i)^−(n−k))
```

Show the current rate plus three escalating scenarios (roughly +1%, +2%, +3%), and put the status-quo path alongside for comparison. The useful conclusion is usually not "rates might rise" but "even at +2% the payment is X, and the residual debt is still lower than staying".
