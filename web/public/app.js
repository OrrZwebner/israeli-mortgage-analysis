const $ = (id) => document.getElementById(id);

const el = {
  doctor: $("doctor"),
  dropzone: $("dropzone"),
  fileInput: $("file-input"),
  filelist: $("filelist"),
  note: $("note"),
  start: $("start"),
  cancel: $("cancel"),
  elapsed: $("elapsed"),
  intakeError: $("intake-error"),
  log: $("log"),
  report: $("report"),
  tabs: $("tabs"),
  dlMd: $("dl-md"),
  dlPdf: $("dl-pdf"),
  chat: $("chat"),
  chatInput: $("chat-input"),
  chatSend: $("chat-send"),
  phoneButton: $("phone-button"),
  phoneDialog: $("phone-dialog"),
  phoneClose: $("phone-close"),
  phoneUrl: $("phone-url"),
  qr: $("qr"),
};

const state = {
  files: [],
  jobId: null,
  running: false,
  startedAt: null,
  tab: "preview",
  markdown: "",
  events: null,
  timer: null,
};

const ICONS = {
  status: "•",
  init: "◆",
  assistant: "✍",
  tool: "⚙",
  denied: "⛔",
  note: "›",
  result: "✓",
  error: "✕",
};

/* ---------------- preflight ---------------- */

async function loadDoctor() {
  try {
    const res = await fetch("/api/doctor");
    const { checks, model } = await res.json();
    el.doctor.innerHTML = "";
    for (const check of checks) {
      const pill = document.createElement("span");
      pill.className = `pill ${check.status}`;
      pill.textContent = check.name;
      pill.title = check.fix ? `${check.detail}\n→ ${check.fix}` : check.detail;
      el.doctor.append(pill);
    }
    const modelPill = document.createElement("span");
    modelPill.className = "pill";
    modelPill.textContent = model;
    modelPill.title = "הדגם שמריץ את הניתוח";
    el.doctor.append(modelPill);
  } catch {
    el.doctor.textContent = "בדיקת סביבה נכשלה";
  }
}

/* ---------------- phone pairing ---------------- */

async function loadMobile() {
  try {
    const res = await fetch("/api/mobile");
    const data = await res.json();
    if (!data.enabled) return;
    el.qr.innerHTML = data.qr;
    el.phoneUrl.textContent = data.url;
    el.phoneButton.hidden = false;
  } catch {
    /* phone pairing is optional; a failure here changes nothing else */
  }
}

el.phoneButton.addEventListener("click", () => el.phoneDialog.showModal());
el.phoneClose.addEventListener("click", () => el.phoneDialog.close());
el.phoneDialog.addEventListener("click", (event) => {
  // Backdrop click: the dialog element itself is the backdrop hit target.
  if (event.target === el.phoneDialog) el.phoneDialog.close();
});

/* ---------------- file intake ---------------- */

function renderFiles() {
  el.filelist.innerHTML = "";
  state.files.forEach((file, index) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)}MB`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = "הסרה";
    remove.onclick = () => {
      state.files.splice(index, 1);
      renderFiles();
    };
    li.append(name, remove);
    el.filelist.append(li);
  });
  el.start.disabled = state.files.length === 0 || state.running;
}

function addFiles(list) {
  for (const file of list) {
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      showError(`${file.name} אינו PDF — דילגתי עליו.`);
      continue;
    }
    if (!state.files.some((f) => f.name === file.name && f.size === file.size)) {
      state.files.push(file);
    }
  }
  renderFiles();
}

function showError(message) {
  el.intakeError.textContent = message;
  el.intakeError.hidden = !message;
}

el.dropzone.addEventListener("click", () => el.fileInput.click());
el.dropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    el.fileInput.click();
  }
});
el.fileInput.addEventListener("change", () => {
  addFiles(el.fileInput.files);
  el.fileInput.value = "";
});
for (const type of ["dragenter", "dragover"]) {
  el.dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    el.dropzone.classList.add("over");
  });
}
for (const type of ["dragleave", "drop"]) {
  el.dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    el.dropzone.classList.remove("over");
  });
}
el.dropzone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));

/* ---------------- progress log ---------------- */

function appendEntry(event) {
  const placeholder = el.log.querySelector(".placeholder");
  if (placeholder) placeholder.remove();

  // Status events are reflected in the buttons and timer, not the log.
  if (event.kind === "status") return;

  const atBottom = el.log.scrollHeight - el.log.scrollTop - el.log.clientHeight < 60;

  const entry = document.createElement("div");
  entry.className = `entry ${event.data?.userMessage ? "user" : event.kind}`;
  const icon = document.createElement("span");
  icon.className = "icon";
  icon.textContent = ICONS[event.kind] ?? "•";
  const text = document.createElement("span");
  text.textContent = event.text;
  entry.append(icon, text);
  el.log.append(entry);

  if (atBottom) el.log.scrollTop = el.log.scrollHeight;
}

/* ---------------- report pane ---------------- */

async function refreshReport() {
  if (!state.jobId) return;
  const res = await fetch(`/api/jobs/${state.jobId}/preview`);
  if (!res.ok) return;
  const { html, markdown } = await res.json();
  state.markdown = markdown;

  el.tabs.hidden = false;
  el.dlMd.href = `/api/jobs/${state.jobId}/report.md`;
  el.dlMd.download = "report.md";
  el.dlPdf.href = `/api/jobs/${state.jobId}/report.pdf`;
  el.dlPdf.download = "report.pdf";

  const pdf = await fetch(`/api/jobs/${state.jobId}/report.pdf`, { method: "HEAD" });
  el.dlPdf.hidden = !pdf.ok;

  renderReport(html);
}

function renderReport(html) {
  if (state.tab === "markdown") {
    const pre = document.createElement("pre");
    pre.className = "raw";
    pre.textContent = state.markdown;
    el.report.replaceChildren(pre);
  } else {
    const div = document.createElement("div");
    div.className = "md";
    div.innerHTML = html ?? "";
    el.report.replaceChildren(div);
  }
}

el.tabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tab]");
  if (!button) return;
  state.tab = button.dataset.tab;
  for (const other of el.tabs.querySelectorAll("button[data-tab]")) {
    other.classList.toggle("active", other === button);
  }
  refreshReport();
});

/* ---------------- run lifecycle ---------------- */

function setRunning(running) {
  state.running = running;
  el.start.disabled = running || state.files.length === 0;
  el.cancel.hidden = !running;
  el.chatInput.disabled = running || !state.jobId;
  el.chatSend.disabled = el.chatInput.disabled;

  clearInterval(state.timer);
  if (running) {
    state.startedAt = state.startedAt ?? Date.now();
    state.timer = setInterval(() => {
      const seconds = Math.round((Date.now() - state.startedAt) / 1000);
      const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
      const ss = String(seconds % 60).padStart(2, "0");
      el.elapsed.textContent = `רץ ${mm}:${ss}`;
    }, 1000);
  } else {
    state.startedAt = null;
  }
}

function connect(jobId) {
  state.events?.close();
  const source = new EventSource(`/api/jobs/${jobId}/events`);
  state.events = source;

  source.onmessage = (message) => {
    const event = JSON.parse(message.data);
    appendEntry(event);

    if (event.kind === "status") {
      const status = event.data?.status;
      setRunning(status === "running");
      if (status === "done" || status === "error") {
        el.elapsed.textContent = status === "done" ? "הסתיים" : "נעצר";
        refreshReport();
      }
    }
    if (event.kind === "tool" && event.data?.tool === "Write") refreshReport();
  };

  source.onerror = () => {
    // EventSource retries on its own; nothing to do but stop the timer if the
    // server went away mid-run.
    if (!state.running) source.close();
  };
}

el.start.addEventListener("click", async () => {
  showError("");
  const body = new FormData();
  for (const file of state.files) body.append("files", file, file.name);
  if (el.note.value.trim()) body.append("note", el.note.value.trim());

  el.start.disabled = true;
  try {
    const res = await fetch("/api/jobs", { method: "POST", body });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "שגיאה בהעלאה");
    state.jobId = data.id;
    history.replaceState(null, "", `?job=${data.id}`);
    el.log.replaceChildren();
    el.report.replaceChildren(
      Object.assign(document.createElement("p"), {
        className: "placeholder",
        textContent: "הדוח ייכתב בסוף הניתוח.",
      }),
    );
    setRunning(true);
    connect(data.id);
  } catch (error) {
    showError(error.message);
    el.start.disabled = state.files.length === 0;
  }
});

el.cancel.addEventListener("click", async () => {
  if (!state.jobId) return;
  await fetch(`/api/jobs/${state.jobId}/cancel`, { method: "POST" });
});

el.chat.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = el.chatInput.value.trim();
  if (!text || !state.jobId) return;
  el.chatInput.value = "";
  setRunning(true);
  const res = await fetch(`/api/jobs/${state.jobId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    showError(data.error ?? "שליחה נכשלה");
    setRunning(false);
  }
});

/* ---------------- deep link ---------------- */

/** A run survives a page reload: ?job=<id> replays the log and the report. */
async function restoreFromUrl() {
  const id = new URLSearchParams(location.search).get("job");
  if (!id) return;
  const res = await fetch(`/api/jobs/${id}`);
  if (!res.ok) return;
  const job = await res.json();
  state.jobId = job.id;
  el.log.replaceChildren();
  setRunning(job.status === "running");
  connect(job.id);
  if (job.hasReport) refreshReport();
}

loadDoctor();
loadMobile();
renderFiles();
restoreFromUrl();
