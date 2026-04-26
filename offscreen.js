/* WalkieTalkie — offscreen audio recorder + live transcript.
 *
 * MV3 service workers can't hold a MediaRecorder. We run one here in a
 * lifetime-pinned offscreen document for the duration of a session.
 * Alongside the recorder we run a Web Speech API recognizer on the same
 * mic. The recognizer streams final segments with their start/end times
 * (relative to recording start) so the background can write a transcript
 * and a merged voice-over-events timeline. */

let recorder = null;
let stream = null;
let chunks = [];
let mime = "audio/webm";

let recognition = null;
let segments = [];
let pendingStartMs = null;
let recordingStartedAt = 0;

function pickMime() {
  // Prefer mp4/AAC: lighter than webm/opus per second only at higher
  // bitrates, but plays everywhere on macOS, iOS, Windows out of the box
  // (.m4a in QuickTime/Music/WMP). Fall back to webm/opus for browsers
  // that don't ship the AAC encoder.
  const candidates = [
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus"
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

function extFor(m) {
  if (!m) return "bin";
  if (m.includes("mp4")) return "m4a";
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg")) return "ogg";
  return "bin";
}

function startRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return { ok: false, reason: "speech-api-missing" };
  try {
    recognition = new SR();
  } catch (e) {
    return { ok: false, reason: "speech-init-failed", error: String(e?.message || e) };
  }
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || "en-US";

  segments = [];
  pendingStartMs = null;

  recognition.addEventListener("result", (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) {
        const text = (r[0]?.transcript || "").trim();
        if (text) {
          segments.push({
            startMs: pendingStartMs ?? Date.now() - recordingStartedAt,
            endMs: Date.now() - recordingStartedAt,
            text,
            confidence: r[0]?.confidence ?? null
          });
        }
        pendingStartMs = null;
      } else if (pendingStartMs == null) {
        pendingStartMs = Date.now() - recordingStartedAt;
      }
    }
  });

  recognition.addEventListener("error", (e) => {
    // no-speech and aborted are routine; the api stops and we restart on end.
    if (e.error && e.error !== "no-speech" && e.error !== "aborted") {
      console.warn("[walkietalkie] speech error:", e.error);
    }
  });

  recognition.addEventListener("end", () => {
    // Chrome's continuous recognizer auto-stops every minute or so. Keep it
    // alive while we're still recording.
    if (recorder && recorder.state === "recording" && recognition) {
      try {
        recognition.start();
      } catch {
        // start() throws if the previous session is still tearing down;
        // a short delay before retry covers the window.
        setTimeout(() => {
          if (recorder && recorder.state === "recording" && recognition) {
            try { recognition.start(); } catch {}
          }
        }, 250);
      }
    }
  });

  try {
    recognition.start();
  } catch (e) {
    return { ok: false, reason: "speech-start-failed", error: String(e?.message || e) };
  }
  return { ok: true };
}

function stopRecognition() {
  if (!recognition) return;
  // Drop the auto-restart hook before stopping.
  recognition.onend = null;
  try { recognition.abort(); } catch {}
  recognition = null;
}

async function start() {
  if (recorder) return { ok: false, reason: "already-running" };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    return { ok: false, reason: "mic-denied", error: String(e && e.message || e) };
  }
  chunks = [];
  const picked = pickMime();
  mime = picked || "audio/webm";
  const opts = picked ? { mimeType: picked } : undefined;
  recorder = new MediaRecorder(stream, opts);
  recorder.addEventListener("dataavailable", (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  });
  recordingStartedAt = Date.now();
  recorder.start(1000);
  const speech = startRecognition();
  return { ok: true, mime, ext: extFor(mime), speech };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}

async function stop() {
  if (!recorder) return { ok: false, reason: "not-running" };
  stopRecognition();
  const finished = new Promise((resolve) => {
    recorder.addEventListener("stop", () => resolve(), { once: true });
  });
  recorder.stop();
  await finished;
  for (const track of stream.getTracks()) track.stop();
  const blob = new Blob(chunks, { type: mime });
  const dataUrl = await blobToDataUrl(blob);
  const ext = extFor(mime);
  const segs = segments.slice();
  recorder = null;
  stream = null;
  chunks = [];
  segments = [];
  pendingStartMs = null;
  return { ok: true, dataUrl, ext, bytes: blob.size, mime, segments: segs };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== "offscreen") return false;
  if (msg.type === "start") {
    start().then(sendResponse);
    return true;
  }
  if (msg.type === "stop") {
    stop().then(sendResponse);
    return true;
  }
  return false;
});

chrome.runtime.sendMessage({ target: "background", type: "offscreen:ready" }).catch(() => {});
