/* WalkieTalkie — first-run microphone grant.
 *
 * Runs as a regular extension page (chrome-extension://<id>/setup.html)
 * because getUserMedia inside an offscreen document can't show a prompt.
 * The user clicks Request microphone, Chrome shows the prompt, the grant
 * sticks for the extension origin, and from then on offscreen can use
 * the mic without prompting. */

const card = document.getElementById("setup");
const grantBtn = document.getElementById("grant");
const retryBtn = document.getElementById("retry");
const errorDetail = document.getElementById("error-detail");

function setState(state) {
  card.dataset.state = state;
  document.querySelectorAll("[data-state]").forEach((el) => {
    if (el === card) return;
    el.hidden = el.dataset.state !== state;
  });
}

async function requestMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    chrome.runtime.sendMessage({ target: "background", type: "setup:granted" }).catch(() => {});
    setState("ok");
    // Auto-close so the user lands back where they were. Tabs opened via
    // chrome.tabs.create can close themselves with window.close.
    setTimeout(() => window.close(), 1200);
  } catch (e) {
    const name = e?.name || "Error";
    const message = e?.message || String(e);
    errorDetail.textContent = `${name}: ${message}`;
    setState("denied");
  }
}

grantBtn.addEventListener("click", async () => {
  grantBtn.disabled = true;
  await requestMic();
  grantBtn.disabled = false;
});

retryBtn.addEventListener("click", async () => {
  retryBtn.disabled = true;
  setState("idle");
  await requestMic();
  retryBtn.disabled = false;
});
