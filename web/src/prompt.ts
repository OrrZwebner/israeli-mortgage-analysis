import { BUILD_PDF, QUALIFIED_SKILL, SCRIPTS_DIR } from "./config.js";

/**
 * Appended to the `claude_code` system prompt preset.
 *
 * The skill deliberately leaves output naming to the agent
 * (references/report-structure.md: "write the Markdown, render with
 * build_pdf.py, present both files"). A web app cannot serve files whose names
 * it has to guess, so this pins them down — and nothing else. Everything about
 * *what* to analyse stays in SKILL.md.
 */
export const OUTPUT_CONTRACT = `
You are running inside a local, single-user web application that wraps the
\`${QUALIFIED_SKILL}\` skill. The person using it uploaded their own mortgage
documents and is watching your progress in a browser.

Start by invoking the Skill tool for \`${QUALIFIED_SKILL}\` and follow it exactly.
The rules below only pin down details the skill intentionally leaves open.

Working directory and files:
- The working directory is a per-run directory. The uploaded documents are in \`input/\`.
- Write the Hebrew Markdown report to \`report.md\` in the working directory, under
  exactly that name — the application serves that path.
- Render it with:
    python3 "${BUILD_PDF}" report.md report.pdf --title "ניתוח משכנתא"
  overwriting \`report.pdf\` in place. The script picks its own PDF engine. If it
  fails, report the failure plainly and keep going: \`report.md\` is the deliverable
  of record and the application can display it without the PDF.
- The calculation helper is \`python3 "${SCRIPTS_DIR}/mortgage_calc.py"\`.
- Never create, edit, or delete anything outside the working directory. Bash is
  restricted to a small allowlist; if a command is refused, solve the problem with
  the Read/Write/Edit tools or with the two scripts above rather than working around it.

Revisions:
- On a follow-up request that changes the analysis, rewrite \`report.md\` in place and
  re-render \`report.pdf\`, and open the report with a \`## מה חדש בגרסה N\` block that
  names what changed and calls out any earlier error explicitly, per
  \`references/report-structure.md\`.
- On a follow-up that is only a question, answer in the chat and leave the report alone.

Answering in the chat:
- Write to the person in Hebrew.
- Finish each turn with a short summary — a handful of lines, the headline finding and
  what it means. The full argument belongs in \`report.md\`, not in the chat.
`.trim();

/** The opening request. Phrased to match the skill's own trigger vocabulary. */
export function buildJobPrompt(files: string[], note?: string): string {
  const list = files.map((f) => `- input/${f}`).join("\n");
  const extra = note?.trim()
    ? `\n\nהערות מהמשתמש (התייחס אליהן בניתוח):\n${note.trim()}\n`
    : "\n";

  return `צורפו מסמכי משכנתא לניתוח. הקבצים נמצאים בתיקיית input/ שבתיקיית העבודה:
${list}
${extra}
בצע ניתוח משכנתא וכדאיות למחזור מלא:
קרא את כל המסמכים שצורפו, חלץ כל נתון, אמת את החילוץ מול הסכומים של הבנק עצמו,
אבחן כל מסלול, בדוק את תנאי השוק העדכניים, וכתוב את הדוח המלא בעברית.

זהה בעצמך את המצב (מצב א' — אישורי יתרות בלבד, או מצב ב' — יתרות יחד עם אישור עקרוני)
לפי המסמכים שצורפו בפועל.

בסיום: report.md ו-report.pdf בתיקיית העבודה.`;
}

/** A follow-up turn on a finished report. */
export function buildFollowUpPrompt(text: string): string {
  return `${text.trim()}

(המשך של אותו ניתוח. הדוח הקיים נמצא ב-report.md בתיקיית העבודה. אם התשובה מחייבת
שינוי בדוח — עדכן אותו ורנדר מחדש ל-report.pdf, כולל בלוק "מה חדש בגרסה N".
אם זו רק שאלה — ענה כאן בלבד.)`;
}
