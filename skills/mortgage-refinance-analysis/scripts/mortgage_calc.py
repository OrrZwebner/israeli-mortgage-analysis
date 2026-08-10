#!/usr/bin/env python3
"""Mortgage calculations for Israeli housing loans.

Subcommands:
  pmt          Spitzer monthly payment
  balance      Remaining balance after k payments
  rate         Infer the annual rate implied by a payment (used to detect resets)
  index        Index coefficient and linkage differences
  verify       Check a track set against the bank's own figures
  horizon      Compare two scenarios over a holding horizon
  delay        Monthly cost of delaying a refinance
  breakeven    Average rate at which refinancing breaks even
  stress       Payment across rate scenarios at a future exit station

Run any subcommand with -h for its arguments.
"""

import argparse
import json
import sys


# --------------------------------------------------------------------------
# core
# --------------------------------------------------------------------------

def pmt(principal: float, annual_rate: float, months: int) -> float:
    """Spitzer level payment. annual_rate as a percentage, e.g. 4.55."""
    if months <= 0:
        raise ValueError("months must be positive")
    i = annual_rate / 100.0 / 12.0
    if abs(i) < 1e-12:
        return principal / months
    return principal * i / (1 - (1 + i) ** -months)


def balance_after(principal: float, annual_rate: float, months: int, k: int) -> float:
    """Remaining balance after k payments of a loan of `months` total."""
    i = annual_rate / 100.0 / 12.0
    payment = pmt(principal, annual_rate, months)
    if abs(i) < 1e-12:
        return max(0.0, principal - payment * k)
    growth = (1 + i) ** k
    return max(0.0, principal * growth - payment * (growth - 1) / i)


def implied_rate(principal: float, payment: float, months: int) -> float:
    """Annual rate (percent) implied by a payment. Bisection; robust enough here."""
    lo, hi = 0.0, 60.0
    for _ in range(300):
        mid = (lo + hi) / 2
        if pmt(principal, mid, months) < payment:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def index_coefficient(known_index: float, base_index: float) -> float:
    return known_index / base_index


def linkage(principal: float, known_index: float, base_index: float) -> float:
    return principal * (index_coefficient(known_index, base_index) - 1)


def effective_nominal(real_rate: float, inflation: float) -> float:
    """Fisher, in percent."""
    return ((1 + real_rate / 100) * (1 + inflation / 100) - 1) * 100


def no_notice_fee(principal: float, principal_linkage: float = 0.0) -> float:
    """0.1% of principal plus linkage on principal. Excludes accrued interest."""
    return 0.001 * (principal + principal_linkage)


# --------------------------------------------------------------------------
# scenarios
# --------------------------------------------------------------------------

def horizon_cost(principal, annual_rate, months, k, inflation=0.0, upfront=0.0):
    """Total payments over k months plus residual balance, in nominal terms.

    For an index-linked track pass the real rate and a non-zero inflation:
    payments and the residual balance are both inflated by the index path.
    """
    payment = pmt(principal, annual_rate, months)
    monthly_infl = (1 + inflation / 100) ** (1 / 12) - 1
    paid = 0.0
    for m in range(1, k + 1):
        paid += payment * (1 + monthly_infl) ** m
    residual = balance_after(principal, annual_rate, months, k) * (1 + monthly_infl) ** k
    return {
        "payments": round(paid, 2),
        "residual_balance": round(residual, 2),
        "upfront_costs": round(upfront, 2),
        "total": round(paid + residual + upfront, 2),
        "first_payment": round(payment, 2),
    }


def delay_cost(balance, current_effective_rate, offered_rate):
    annual = balance * (current_effective_rate - offered_rate) / 100
    return {
        "annual": round(annual, 2),
        "monthly": round(annual / 12, 2),
        "gain_from_0.1pct_lower_anchor_annual": round(balance * 0.001, 2),
    }


def breakeven_rate(principal, months, k, target_total, inflation=0.0, upfront=0.0):
    lo, hi = 0.01, 30.0
    for _ in range(300):
        mid = (lo + hi) / 2
        got = horizon_cost(principal, mid, months, k, 0.0, upfront)["total"]
        if got < target_total:
            lo = mid
        else:
            hi = mid
    return round((lo + hi) / 2, 4)


def stress(principal, annual_rate, months, k, scenarios):
    b = balance_after(principal, annual_rate, months, k)
    remaining = months - k
    return {
        "balance_at_station": round(b, 2),
        "months_remaining": remaining,
        "scenarios": [
            {"rate": r, "payment": round(pmt(b, r, remaining), 2)} for r in scenarios
        ],
    }


# --------------------------------------------------------------------------
# verification
# --------------------------------------------------------------------------

def verify(tracks, known_index=None, tol=2.0):
    """Check extracted tracks against the identities in references/extraction.md.

    Each track: name, principal, [principal_linkage], [interest],
    [interest_linkage], [subtotal], [base_index], [no_notice_fee],
    [total_fee], [payoff]
    """
    results = []
    for t in tracks:
        name = t.get("name", "?")
        checks = []

        p = t.get("principal", 0.0)
        pl = t.get("principal_linkage", 0.0)
        i = t.get("interest", 0.0)
        il = t.get("interest_linkage", 0.0)
        computed_subtotal = p + pl + i + il

        if "subtotal" in t:
            d = computed_subtotal - t["subtotal"]
            checks.append({
                "check": "components sum to subtotal",
                "computed": round(computed_subtotal, 2),
                "stated": t["subtotal"],
                "delta": round(d, 2),
                "pass": abs(d) <= tol,
            })

        if t.get("base_index") and known_index:
            calc = linkage(p, known_index, t["base_index"])
            d = calc - pl
            checks.append({
                "check": "index coefficient reproduces linkage",
                "computed": round(calc, 2),
                "stated": round(pl, 2),
                "delta": round(d, 2),
                "pass": abs(d) <= max(tol, abs(pl) * 0.0005),
            })

        if "no_notice_fee" in t:
            calc = no_notice_fee(p, pl)
            d = calc - t["no_notice_fee"]
            checks.append({
                "check": "no-notice fee = 0.1% of linked principal",
                "computed": round(calc, 2),
                "stated": t["no_notice_fee"],
                "delta": round(d, 2),
                "pass": abs(d) <= 0.05,
            })

        if "payoff" in t and "total_fee" in t:
            calc = computed_subtotal + t["total_fee"]
            d = calc - t["payoff"]
            checks.append({
                "check": "subtotal + fees = payoff",
                "computed": round(calc, 2),
                "stated": t["payoff"],
                "delta": round(d, 2),
                "pass": abs(d) <= tol,
            })

        results.append({"track": name, "subtotal": round(computed_subtotal, 2),
                        "checks": checks})

    total = sum(r["subtotal"] for r in results)
    return {"tracks": results, "sum_of_subtotals": round(total, 2),
            "all_passed": all(c["pass"] for r in results for c in r["checks"])}


# --------------------------------------------------------------------------
# cli
# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("pmt"); p.add_argument("principal", type=float)
    p.add_argument("rate", type=float); p.add_argument("months", type=int)

    p = sub.add_parser("balance"); p.add_argument("principal", type=float)
    p.add_argument("rate", type=float); p.add_argument("months", type=int)
    p.add_argument("k", type=int)

    p = sub.add_parser("rate"); p.add_argument("principal", type=float)
    p.add_argument("payment", type=float); p.add_argument("months", type=int)

    p = sub.add_parser("index"); p.add_argument("principal", type=float)
    p.add_argument("known_index", type=float); p.add_argument("base_index", type=float)

    p = sub.add_parser("verify")
    p.add_argument("json_file", help="{'known_index': float, 'tracks': [...]}")

    p = sub.add_parser("horizon"); p.add_argument("principal", type=float)
    p.add_argument("rate", type=float); p.add_argument("months", type=int)
    p.add_argument("k", type=int); p.add_argument("--inflation", type=float, default=0.0)
    p.add_argument("--upfront", type=float, default=0.0)

    p = sub.add_parser("delay"); p.add_argument("balance", type=float)
    p.add_argument("current_effective_rate", type=float)
    p.add_argument("offered_rate", type=float)

    p = sub.add_parser("breakeven"); p.add_argument("principal", type=float)
    p.add_argument("months", type=int); p.add_argument("k", type=int)
    p.add_argument("target_total", type=float); p.add_argument("--upfront", type=float, default=0.0)

    p = sub.add_parser("stress"); p.add_argument("principal", type=float)
    p.add_argument("rate", type=float); p.add_argument("months", type=int)
    p.add_argument("k", type=int)
    p.add_argument("--scenarios", type=float, nargs="+", default=None)

    a = ap.parse_args()

    if a.cmd == "pmt":
        out = {"payment": round(pmt(a.principal, a.rate, a.months), 2)}
    elif a.cmd == "balance":
        out = {"balance": round(balance_after(a.principal, a.rate, a.months, a.k), 2)}
    elif a.cmd == "rate":
        out = {"implied_annual_rate": round(implied_rate(a.principal, a.payment, a.months), 4)}
    elif a.cmd == "index":
        coef = index_coefficient(a.known_index, a.base_index)
        out = {"coefficient": round(coef, 6),
               "linkage": round(linkage(a.principal, a.known_index, a.base_index), 2),
               "linked_principal": round(a.principal * coef, 2)}
    elif a.cmd == "verify":
        with open(a.json_file, encoding="utf-8") as fh:
            data = json.load(fh)
        out = verify(data["tracks"], data.get("known_index"))
    elif a.cmd == "horizon":
        out = horizon_cost(a.principal, a.rate, a.months, a.k, a.inflation, a.upfront)
    elif a.cmd == "delay":
        out = delay_cost(a.balance, a.current_effective_rate, a.offered_rate)
    elif a.cmd == "breakeven":
        out = {"breakeven_rate": breakeven_rate(a.principal, a.months, a.k,
                                                a.target_total, 0.0, a.upfront)}
    elif a.cmd == "stress":
        sc = a.scenarios or [a.rate, a.rate + 1, a.rate + 2, a.rate + 3]
        out = stress(a.principal, a.rate, a.months, a.k, sc)
    else:
        ap.print_help(); return 1

    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
