#!/usr/bin/env python3
"""Render a Hebrew Markdown report to a styled RTL A4 PDF.

    python build_pdf.py report.md report.pdf

Pipeline: markdown -> HTML (pandoc) -> PDF (wkhtmltopdf, or headless Chrome),
wrapped in an RTL template with a Hebrew-capable font.

Requirements: pandoc, a PDF engine, and a font covering Hebrew (DejaVu Sans on
most Linux images). The PDF engine is chosen automatically: wkhtmltopdf if it is
installed, otherwise any Chromium-family browser (Chrome, Chromium, Edge, Brave)
found on PATH, at the usual macOS/Linux install locations, or named by the
CHROME_PATH environment variable. Both engines honour the @page rule below, so
they produce the same page geometry. Force one with --engine. Check with:
    which pandoc wkhtmltopdf && fc-list :lang=he | head

Some glyphs commonly used in Markdown have no coverage in the available fonts
and render as black boxes, so they are substituted before conversion. Add to
GLYPH_SUBSTITUTIONS if new ones appear.
"""

import argparse
import os
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

# Chromium-family binaries, in preference order. PATH names first, then the
# standard install locations on macOS and Linux.
CHROME_CANDIDATES = (
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    "microsoft-edge",
    "brave-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/opt/google/chrome/chrome",
    "/snap/bin/chromium",
)

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

INSTALL_HINT = """no PDF engine found. Install either:
  wkhtmltopdf  -  apt-get install wkhtmltopdf
  Google Chrome -  https://www.google.com/chrome/  (macOS: brew install --cask google-chrome)
Or point CHROME_PATH at an existing Chromium-family binary."""


def require(tool):
    if shutil.which(tool) is None:
        sys.exit(f"missing required tool: {tool}")


def find_chrome():
    """Return a path to a Chromium-family binary, or None."""
    override = os.environ.get("CHROME_PATH")
    if override:
        resolved = shutil.which(override) or (override if os.path.isfile(override) else None)
        if resolved is None:
            sys.exit(f"CHROME_PATH does not point at an executable: {override}")
        return resolved
    for candidate in CHROME_CANDIDATES:
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None


def resolve_engine(engine):
    """Map the --engine choice to ('wkhtmltopdf', path) or ('chrome', path)."""
    if engine in ("auto", "wkhtmltopdf"):
        found = shutil.which("wkhtmltopdf")
        if found:
            return "wkhtmltopdf", found
        if engine == "wkhtmltopdf":
            sys.exit("missing required tool: wkhtmltopdf")
    if engine in ("auto", "chrome"):
        found = find_chrome()
        if found:
            return "chrome", found
        if engine == "chrome":
            sys.exit("no Chromium-family browser found. Set CHROME_PATH to one.")
    sys.exit(INSTALL_HINT)


def render_wkhtmltopdf(binary, html_path, pdf_path):
    subprocess.run(
        [binary, "--encoding", "utf-8", "--enable-local-file-access",
         "-q", str(html_path), str(pdf_path)],
        check=True,
    )


def render_chrome(binary, html_path, pdf_path, profile_dir):
    argv = [
        binary,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=10000",
        f"--user-data-dir={profile_dir}",
        f"--print-to-pdf={pdf_path}",
    ]
    # Chrome refuses to start as root without this, which is the common case
    # inside containers and CI images.
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        argv.insert(1, "--no-sandbox")
    argv.append(html_path.as_uri())
    subprocess.run(argv, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if not pdf_path.exists():
        sys.exit(f"{binary} did not produce {pdf_path}")


def build(md_path: pathlib.Path, pdf_path: pathlib.Path, title: str = "report",
          engine: str = "auto") -> None:
    require("pandoc")
    engine_kind, engine_path = resolve_engine(engine)

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
        if engine_kind == "wkhtmltopdf":
            render_wkhtmltopdf(engine_path, full_html, pdf_path)
        else:
            render_chrome(engine_path, full_html, pdf_path, tmp / "chrome-profile")

    print(f"wrote {pdf_path} ({engine_kind})")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("markdown")
    ap.add_argument("pdf")
    ap.add_argument("--title", default="mortgage report")
    ap.add_argument("--engine", default="auto", choices=["auto", "wkhtmltopdf", "chrome"],
                    help="PDF engine (default: auto - wkhtmltopdf, else headless Chrome)")
    a = ap.parse_args()
    build(pathlib.Path(a.markdown), pathlib.Path(a.pdf), a.title, a.engine)


if __name__ == "__main__":
    main()
