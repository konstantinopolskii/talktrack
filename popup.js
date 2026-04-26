/* WalkieTalkie — popup controller. */

const recorder = document.getElementById("recorder");
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const elapsed = document.getElementById("elapsed");
const recordingNote = document.getElementById("recording-note");
const sessionCard = document.getElementById("session");
const sessionBriefing = document.getElementById("session-briefing");
const copyBtn = document.getElementById("copy-briefing");
const micWarning = document.getElementById("mic-warning");
const micWarningDetail = document.getElementById("mic-warning-detail");
const micSetupBtn = document.getElementById("open-mic-setup");
const micSelect = document.getElementById("mic-select");

const MIC_DEVICE_KEY = "walkietalkie:mic-device-id";

let timerHandle = null;

function setMode(mode) {
  recorder.dataset.mode = mode;
  document.querySelectorAll("[data-mode-show]").forEach((el) => {
    el.hidden = el.dataset.modeShow !== mode;
  });
}

function fmtClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function startTimer(startedAt) {
  stopTimer();
  const tick = () => {
    elapsed.textContent = fmtClock(Date.now() - startedAt);
  };
  tick();
  timerHandle = setInterval(tick, 250);
}

function stopTimer() {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = null;
}

function fmtDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} sec`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} sec` : `${m} min`;
}

function buildBriefing(last) {
  const ext = last.audio?.ext || "webm";
  const lines = [
    `WalkieTalkie session ${last.id}`,
    `folder: ~/Downloads/${last.folder}`,
    `duration: ${fmtDuration(last.durationMs)}, ${last.events} events`,
    `files:`
  ];
  if (last.audio?.ok) {
    lines.push(`  audio.${ext.padEnd(6)}microphone capture (${ext})`);
  }
  lines.push(`  log.txt       human-readable timeline of clicks, selections, keys`);
  lines.push(`  events.jsonl  same events, one JSON object per line`);
  lines.push(`  session.json  metadata: started, stopped, duration, audio, ua`);
  if (last.audio && last.audio.ok === false) {
    lines.push(``);
    lines.push(`audio: missing (${last.audio.error || "unknown"}). Events only.`);
  }
  lines.push(``);
  lines.push(`Instructions for you (the agent):`);
  if (last.audio?.ok) {
    lines.push(`1. Transcribe audio.${ext} yourself.`);
    lines.push(`2. Read log.txt and line up each voice segment with the DOM events`);
    lines.push(`   by timestamp. Use events.jsonl for full DOM context (selector,`);
    lines.push(`   bbox, attrs) on any moment.`);
  } else {
    lines.push(`1. Read log.txt and use events.jsonl for full DOM context`);
    lines.push(`   (selector, bbox, attrs) on any moment.`);
  }
  lines.push(`3. If anything is unclear — what I meant, why I did something, where`);
  lines.push(`   I want to take it next — ask before assuming.`);
  lines.push(`4. After the analysis, summarize what you understood and confirm the`);
  lines.push(`   direction with me before you act on it.`);
  return lines.join("\n");
}

function renderLast(last) {
  if (!last) {
    sessionCard.hidden = true;
    return;
  }
  sessionCard.hidden = false;
  sessionBriefing.textContent = buildBriefing(last);
}

function showMicWarning(audio) {
  if (audio && audio.ok) {
    micWarning.hidden = true;
    return;
  }
  if (!audio || audio.ok === null) {
    micWarning.hidden = true;
    return;
  }
  const reason = audio.error || "unknown";
  const map = {
    "mic-denied": "Microphone blocked. Allow it once below, then start again.",
    "no-response": "Audio recorder did not start. Try once more, then allow the mic.",
    "send-failed": "Audio recorder unreachable. Try once more."
  };
  micWarningDetail.textContent = map[reason] || `Audio capture failed (${reason}). Events still logged.`;
  micWarning.hidden = false;
}

async function populateMicList() {
  // enumerateDevices only returns labels once the page has been granted
  // mic permission. Without labels we still get deviceIds, just unnamed.
  let devices = [];
  try {
    devices = await navigator.mediaDevices.enumerateDevices();
  } catch {
    return;
  }
  const mics = devices.filter((d) => d.kind === "audioinput");
  const stored = (await chrome.storage.local.get(MIC_DEVICE_KEY))[MIC_DEVICE_KEY] || "";

  micSelect.innerHTML = "";
  const def = document.createElement("option");
  def.value = "";
  def.textContent = "Default (system input)";
  micSelect.appendChild(def);

  for (const m of mics) {
    const opt = document.createElement("option");
    opt.value = m.deviceId;
    opt.textContent = m.label || `Microphone (${m.deviceId.slice(0, 6)}…)`;
    micSelect.appendChild(opt);
  }

  // Restore selection if the stored device is still present; otherwise
  // fall back to default (empty string).
  if (stored && mics.some((m) => m.deviceId === stored)) {
    micSelect.value = stored;
  } else {
    micSelect.value = "";
  }
}

async function refresh() {
  const state = await chrome.runtime.sendMessage({ target: "background", type: "popup:state" });
  if (state.recording) {
    setMode("recording");
    startTimer(state.startedAt);
    showMicWarning(state.audio);
    micSelect.disabled = true;
  } else {
    setMode("idle");
    stopTimer();
    showMicWarning(state.last?.audio);
    micSelect.disabled = false;
  }
  renderLast(state.last);
}

micSelect.addEventListener("change", async () => {
  await chrome.storage.local.set({ [MIC_DEVICE_KEY]: micSelect.value });
});

populateMicList();

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  const res = await chrome.runtime.sendMessage({ target: "background", type: "popup:start" });
  startBtn.disabled = false;
  if (res?.ok) {
    setMode("recording");
    startTimer(res.startedAt);
    showMicWarning(res.audio);
    micSelect.disabled = true;
  }
});

stopBtn.addEventListener("click", async () => {
  stopBtn.disabled = true;
  const res = await chrome.runtime.sendMessage({ target: "background", type: "popup:stop" });
  stopBtn.disabled = false;
  if (res?.ok) {
    setMode("idle");
    stopTimer();
    renderLast(res.last);
    micSelect.disabled = false;
  }
});

copyBtn.addEventListener("click", async () => {
  const text = sessionBriefing.textContent;
  try {
    await navigator.clipboard.writeText(text);
    const original = copyBtn.textContent;
    copyBtn.textContent = "Copied";
    setTimeout(() => { copyBtn.textContent = original; }, 1200);
  } catch {}
});

micSetupBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ target: "background", type: "popup:open-mic-setup" }).catch(() => {});
  window.close();
});

refresh();
