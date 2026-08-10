import fs from "node:fs";
import path from "node:path";
import express from "express";
import multer from "multer";
import MarkdownIt from "markdown-it";
import { runAgent } from "./agent.js";
import { accessControl, ACCESS_TOKEN } from "./auth.js";
import {
  HOST,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  MOBILE,
  MODEL,
  PORT,
  RUNS_DIR,
  WEB_ROOT,
} from "./config.js";
import { doctor } from "./doctor.js";
import { lanAddresses, mobileUrl, qrSvg, qrTerminal } from "./net.js";
import { createJob, getJob, type Job } from "./jobs.js";
import { buildFollowUpPrompt, buildJobPrompt } from "./prompt.js";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_UPLOAD_FILES },
});
const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

app.use(express.json({ limit: "256kb" }));
app.use(accessControl);
app.use(express.static(path.join(WEB_ROOT, "public")));

fs.mkdirSync(RUNS_DIR, { recursive: true });

/**
 * Browsers send UTF-8 filenames but multer surfaces them as latin1, which turns
 * Hebrew names into mojibake. Re-decode when that round-trips cleanly.
 */
function decodeFilename(raw: string): string {
  const decoded = Buffer.from(raw, "latin1").toString("utf8");
  return decoded.includes("�") ? raw : decoded;
}

function safeFilename(raw: string, taken: Set<string>): string {
  let name = path.basename(decodeFilename(raw)).replace(/[\x00-\x1f/\\]/g, "_").trim();
  if (!name) name = "document.pdf";
  if (!name.toLowerCase().endsWith(".pdf")) name += ".pdf";
  if (name.length > 120) name = `${name.slice(0, 110)}.pdf`;

  let unique = name;
  let n = 2;
  while (taken.has(unique)) {
    unique = name.replace(/\.pdf$/i, `-${n++}.pdf`);
  }
  taken.add(unique);
  return unique;
}

const runningTurns = new Set<string>();

function startTurn(job: Job, prompt: string, resume?: string): void {
  runningTurns.add(job.id);
  void runAgent({ job, prompt, resume })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      job.lastError = message;
      job.emit("error", message);
      job.setStatus("error");
    })
    .finally(() => runningTurns.delete(job.id));
}

app.get("/api/doctor", async (_req, res) => {
  res.json({ ...(await doctor()), model: MODEL, mobile: MOBILE });
});

/** Powers the "open on my phone" QR in the desktop UI. */
app.get("/api/mobile", async (_req, res) => {
  const url = mobileUrl();
  if (!MOBILE) {
    res.json({ enabled: false, reason: "not-started-in-mobile-mode" });
    return;
  }
  if (!url) {
    res.json({ enabled: false, reason: "no-lan-address" });
    return;
  }
  res.json({ enabled: true, url, qr: await qrSvg(url) });
});

app.post("/api/jobs", upload.array("files"), (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    res.status(400).json({ error: "לא צורפו קבצים." });
    return;
  }

  const bad = files.find((f) => !f.buffer.subarray(0, 5).toString("latin1").startsWith("%PDF"));
  if (bad) {
    res.status(400).json({ error: `${decodeFilename(bad.originalname)} אינו קובץ PDF תקין.` });
    return;
  }

  const job = createJob();
  const taken = new Set<string>();
  for (const file of files) {
    const name = safeFilename(file.originalname, taken);
    fs.writeFileSync(path.join(job.inputDir, name), file.buffer);
    job.inputs.push(name);
  }

  const note = typeof req.body?.note === "string" ? req.body.note.slice(0, 4000) : undefined;
  job.note = note;
  job.emit("note", `התקבלו ${job.inputs.length} מסמכים: ${job.inputs.join(", ")}`);

  startTurn(job, buildJobPrompt(job.inputs, note));
  res.status(201).json(job.snapshot());
});

app.get("/api/jobs/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "unknown job" });
    return;
  }
  res.json(job.snapshot());
});

app.get("/api/jobs/:id/events", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).end();
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(": connected\n\n");

  const unsubscribe = job.subscribe((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 20_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

app.post("/api/jobs/:id/messages", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "unknown job" });
    return;
  }
  if (runningTurns.has(job.id)) {
    res.status(409).json({ error: "הניתוח עדיין רץ." });
    return;
  }
  if (!job.sessionId) {
    res.status(409).json({ error: "אין סשן להמשך." });
    return;
  }
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    res.status(400).json({ error: "הודעה ריקה." });
    return;
  }

  job.abort = new AbortController();
  job.emit("note", `שאלה: ${text}`, { userMessage: true });
  startTurn(job, buildFollowUpPrompt(text), job.sessionId);
  res.status(202).json(job.snapshot());
});

app.post("/api/jobs/:id/cancel", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "unknown job" });
    return;
  }
  job.abort.abort();
  res.json(job.snapshot());
});

function sendArtifact(job: Job, file: string, type: string, res: express.Response): void {
  if (!fs.existsSync(file)) {
    res.status(404).json({ error: "not produced (yet)" });
    return;
  }
  res.type(type).sendFile(file);
}

app.get("/api/jobs/:id/report.md", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "unknown job" });
    return;
  }
  sendArtifact(job, job.reportMd, "text/markdown; charset=utf-8", res);
});

app.get("/api/jobs/:id/report.pdf", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "unknown job" });
    return;
  }
  sendArtifact(job, job.reportPdf, "application/pdf", res);
});

app.get("/api/jobs/:id/preview", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "unknown job" });
    return;
  }
  if (!job.hasReport()) {
    res.status(404).json({ error: "not produced (yet)" });
    return;
  }
  const source = fs.readFileSync(job.reportMd, "utf8");
  res.json({ html: md.render(source), markdown: source });
});

app.use(
  (
    error: Error & { code?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "הקובץ גדול מדי (מקסימום 25MB)." });
      return;
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      res.status(413).json({ error: `מקסימום ${MAX_UPLOAD_FILES} קבצים.` });
      return;
    }
    console.error(error);
    res.status(500).json({ error: error.message });
  },
);

app.listen(PORT, HOST, async () => {
  const local = `http://127.0.0.1:${PORT}`;
  console.log(`\n  ניתוח משכנתא — ${local}`);
  console.log(`  model: ${MODEL}`);
  console.log(`  runs:  ${RUNS_DIR}`);

  if (!MOBILE) {
    console.log("\n  Phone access is off. Start with `npm run mobile` to enable it.\n");
    return;
  }

  const url = mobileUrl();
  if (!url) {
    console.log("\n  Mobile mode is on, but no LAN address was found on this machine.\n");
    return;
  }

  console.log("\n  Phone access is ON — this machine is reachable on your network.");
  console.log(`  Open on your phone (same Wi-Fi):\n\n  ${url}\n`);
  console.log(await qrTerminal(url));
  const others = lanAddresses().slice(1);
  if (others.length) console.log(`  other addresses: ${others.join(", ")}`);
  console.log(
    `  The link contains a one-time access key. It stops working when this server stops.\n`,
  );
  if (!ACCESS_TOKEN) console.log("  (warning: no access token was generated)\n");
});
