# Contributing

## Running the tests

The calculation scripts have no dependencies beyond the Python 3.11 standard
library. From the skill directory:

```bash
cd skills/mortgage-refinance-analysis

python3 scripts/mortgage_calc.py pmt 750000 4.25 300
python3 scripts/mortgage_calc.py index 400000 160.0 128.0
python3 scripts/mortgage_calc.py delay 800000 6.5 4.5
python3 scripts/mortgage_calc.py stress 900000 4.0 300 24 --scenarios 4.0 5.0 6.0 7.0
python3 scripts/mortgage_calc.py verify tracks.json
```

The expected values, and the `tracks.json` fixture for `verify`, are in
[`.github/workflows/test.yml`](.github/workflows/test.yml) — that workflow is
the authoritative regression suite and runs on every push and pull request to
`main`. It parses the JSON output and compares numerically (tolerance `0.01`
for currency, `1e-5` for the index coefficient), so re-formatting output is
safe but changing a computed value is not.

**All test inputs are synthetic.** They are deliberately round numbers chosen
so the expected results are checkable by hand rather than taken on trust:
`160/128 = 1.25` exactly, so the linkage on 400,000 is exactly 100,000; the
delay cost is a flat 2.00% of 800,000 over twelve months; and the two tracks in
the `verify` fixture are built so all four reconciliation identities close with
a delta of exactly `0.00`. The payment and stress figures follow from the
standard annuity formula `P·r / (1 − (1+r)^−n)`.

If a change moves any expected value, the change is wrong until proven
otherwise — fix the code, do not update the expectation. If you do need to
change a fixture, derive the new expectation independently of the script;
asserting whatever the script currently prints tests nothing.

`scripts/build_pdf.py` additionally needs `pandoc`, a font covering Hebrew, and a
PDF engine — `wkhtmltopdf`, or any Chromium-family browser as a fallback. Check
with:

```bash
which pandoc wkhtmltopdf google-chrome chromium && fc-list :lang=he | head
```

Keep the fallback stdlib-only: it shells out via `shutil.which` and
`subprocess`, so the no-dependencies rule above still holds.

## Cutting a release

The claude.ai instructions in the README point at a `mortgage-refinance-analysis.zip`
attached to the latest release. Don't build or commit that file by hand —
[`.github/workflows/release.yml`](.github/workflows/release.yml) builds it from
`skills/` and attaches it whenever you push a `v*` tag:

```bash
git tag v1.1.0 && git push origin v1.1.0
```

The workflow fails the build if `SKILL.md` or any reference or script is
missing from the archive, or if `SKILL.md` is not directly inside the single
top-level folder — that layout is what makes the file uploadable as-is.

## Keeping `SKILL.md` short

Everything under `references/` is loaded **on demand**, only when the analysis
actually reaches that material. `SKILL.md` is loaded up front, every time. Keep
it under roughly **500 lines**: it should route to the reference files and carry
the judgment that applies across all of them, not restate their content. New
detail belongs in a reference file.

## Changing `references/regulations.md`

This file states what a bank may charge, which mixes it may approve, and what
disclosure a borrower is owed. Bank of Israel directives are amended, and an
outdated constraint stated confidently is worse than no statement at all.

Before changing any regulatory claim, verify it against the current directive
at [boi.org.il](https://www.boi.org.il) and cite what you checked in the pull
request. The same applies to claims that merely look stable — caps, fee
formulas, and notice periods have all moved before.
