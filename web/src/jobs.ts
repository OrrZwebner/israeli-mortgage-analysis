import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { RUNS_DIR } from "./config.js";

export type JobStatus = "pending" | "running" | "done" | "error";

export type JobEventKind =
  | "status" // lifecycle changes
  | "init" // session started, skill/plugin confirmed
  | "assistant" // prose from Claude
  | "tool" // a tool call, summarised for humans
  | "denied" // a tool call the permission gate refused
  | "note" // anything else worth showing
  | "result" // end of a turn: cost, duration
  | "error";

export interface JobEvent {
  seq: number;
  at: string;
  kind: JobEventKind;
  text: string;
  /** Free-form extras: cost, tool name, file path… */
  data?: Record<string, unknown>;
}

type Listener = (event: JobEvent) => void;

export class Job {
  readonly id: string;
  readonly dir: string;
  readonly inputDir: string;
  readonly createdAt = new Date().toISOString();

  status: JobStatus = "pending";
  sessionId?: string;
  inputs: string[] = [];
  note?: string;
  lastError?: string;
  abort = new AbortController();

  private seq = 0;
  private readonly log: JobEvent[] = [];
  private readonly listeners = new Set<Listener>();
  private readonly transcript: string;

  constructor(id = randomUUID().slice(0, 8)) {
    this.id = id;
    this.dir = path.join(RUNS_DIR, id);
    this.inputDir = path.join(this.dir, "input");
    this.transcript = path.join(this.dir, "transcript.jsonl");
    fs.mkdirSync(this.inputDir, { recursive: true });
  }

  get reportMd(): string {
    return path.join(this.dir, "report.md");
  }

  get reportPdf(): string {
    return path.join(this.dir, "report.pdf");
  }

  hasReport(): boolean {
    return fs.existsSync(this.reportMd);
  }

  hasPdf(): boolean {
    return fs.existsSync(this.reportPdf);
  }

  emit(kind: JobEventKind, text: string, data?: Record<string, unknown>): JobEvent {
    const event: JobEvent = {
      seq: ++this.seq,
      at: new Date().toISOString(),
      kind,
      text,
      ...(data ? { data } : {}),
    };
    this.log.push(event);
    // Best effort: a failed transcript write must never kill a running analysis.
    try {
      fs.appendFileSync(this.transcript, JSON.stringify(event) + "\n", "utf8");
    } catch {
      /* ignore */
    }
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        /* a dead SSE connection must not break the others */
      }
    }
    return event;
  }

  setStatus(status: JobStatus, text?: string): void {
    this.status = status;
    this.emit("status", text ?? status, { status });
  }

  /** Replays everything so far, then streams. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    for (const event of this.log) listener(event);
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  snapshot() {
    return {
      id: this.id,
      status: this.status,
      createdAt: this.createdAt,
      inputs: this.inputs,
      note: this.note,
      sessionId: this.sessionId,
      hasReport: this.hasReport(),
      hasPdf: this.hasPdf(),
      lastError: this.lastError,
    };
  }
}

const jobs = new Map<string, Job>();

export function createJob(): Job {
  const job = new Job();
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}
