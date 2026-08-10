#!/usr/bin/env python3
"""Render a Hebrew Markdown report to a styled RTL A4 PDF.

    python build_pdf.py report.md report.pdf

Pipeline: markdown -> HTML (pandoc) -> PDF (wkhtmltopdf), wrapped in an RTL
template with a Hebrew-capable font.

Requirements: pandoc, wkhtmltopdf, and a font covering Hebrew (DejaVu Sans on
most Linux images). Check with:
    which pandoc wkhtmltopdf && fc-list :lang=he | head

Some glyphs commonly used in Markdown have no coverage in the available fonts
and render as black boxes, so they are substituted before conversion. Add to
GLYPH_SUBSTITUTIONS if new ones appear.
"""

import argparse
import pathlib
import shutil
import subprocess
import sys
import tempfile

GLYPH_SUBSTITUTIONS = {
    "\u2705": "[כן]",     # check mark
    "\u274c": "[לא]",     # cross mark
    "\u26a0\ufe0f": "[!]",
    "\u26a0": "[!]",
    "\u27a1": "->",
    "\u279c": "->",
    "\u2194": "<->",
    "\u00d7": "x",
    "\u2014": "\u2013",   # em dash renders inconsistently; use en dash
}

CSS = """
@page { size: A4; margin: 18mm 15mm 20mm 15mm; }
body { direction: rtl; text-align: right;
       font-family: "DejaVu Sans", "Liberation Sans", sans-serif;
       font-size: 10.5pt; line-height: 1.55; color: #1b1b1b; }
h1 { font-size: 19pt; color: #123a6b; border-bottom: 3px solid #123a6b;
     padding-bottom: 8px; margin: 0 0 14px 0; }
h2 { font-size: 14pt; color: #123a6b; margin-top: 20px; margin-bottom: 8px;
     border-right: 5px solid #c9a227; padding-right: 9px; page-break-after: avoid; }
h3 { font-size: 11.5pt; color: #2c4f7c; margin-top: 14px; margin-bottom: 6px;
     page-break-after: avoid; }
p { margin: 6px 0; }
table { border-collapse: collapse; width: 100%; margin: 10px 0 14px 0;
        font-size: 9.5pt; page-break-inside: avoid; direction: rtl; }
th { background: #123a6b; color: #fff; padding: 6px 7px; text-align: right;
     font-weight: bold; border: 1px solid #123a6b; }
td { border: 1px solid #c8d2df; padding: 5px 7px; text-align: right;
     vertical-align: top; }
tbody tr:nth-child(even) td { background: #f2f6fa; }
blockquote { border-right: 4px solid #c9a227; background: #fdf8e8; margin: 10px 0;
             padding: 8px 12px; font-size: 9.5pt; }
ul, ol { margin: 6px 22px 6px 0; padding: 0; }
li { margin: 3px 0; }
hr { border: none; border-top: 1px solid #d8dee6; margin: 16px 0; }
strong { color: #0d2c52; }
code { font-family: "DejaVu Sans Mono", monospace; background: #eef2f7; padding: 1px 3px; }
em { color: #555; }
"""

TEMPLATE = """<!DOCTYPE html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>{title}</title><style>{css}</style></head>
<body>{body}</body></html>"""


def require(tool):
    if shutil.which(tool) is None:
        sys.exit(f"missing required tool: {tool}")


def build(md_path: pathlib.Path, pdf_path: pathlib.Path, title: str = "report") -> None:
    require("pandoc")
    require("wkhtmltopdf")

    source = md_path.read_text(encoding="utf-8")
    for bad, good in GLYPH_SUBSTITUTIONS.items():
        source = source.replace(bad, good)

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        clean_md = tmp / "clean.md"
        body_html = tmp / "body.html"
        full_html = tmp / "report.html"

        clean_md.write_text(source, encoding="utf-8")
        subprocess.run(
            ["pandoc", str(clean_md), "-f", "markdown+pipe_tables",
             "-t", "html5", "-o", str(body_html)],
            check=True,
        )
        full_html.write_text(
            TEMPLATE.format(title=title, css=CSS,
                            body=body_html.read_text(encoding="utf-8")),
            encoding="utf-8",
        )
        pdf_path.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["wkhtmltopdf", "--encoding", "utf-8", "--enable-local-file-access",
             "-q", str(full_html), str(pdf_path)],
            check=True,
        )

    print(f"wrote {pdf_path}")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("markdown")
    ap.add_argument("pdf")
    ap.add_argument("--title", default="mortgage report")
    a = ap.parse_args()
    build(pathlib.Path(a.markdown), pathlib.Path(a.pdf), a.title)


if __name__ == "__main__":
    main()
