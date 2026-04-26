/* TalkTrack — first-run microphone grant.
 *
 * Runs as a regular extension page (chrome-extension://<id>/setup.html)
 * because getUserMedia inside an offscreen document can't show a prompt.
 * This page calls getUserMedia with a user gesture, the prompt appears,
 * the grant sticks for the extension origin, and from then on offscreen
 * can use the mic without prompting. */

const card = document.getElementById("setup");
const grantBtn = document.getElementById("grant");
const closeBtn = document.getElementById("close");

function setState(state) {
  card.dataset.state = state;
  document.querySelectorAll("[data-state]").forEach((el) => {
    if (el === card) return;
    el.hidden = el.dataset.state !== state;
  });
}

grantBtn.addEventListener("click", async () => {
  grantBtn.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    chrome.runtime.sendMessage({ target: "background", type: "setup:granted" }).catch(() => {});
    setState("ok");
  } catch (e) {
    setState("denied");
  } finally {
    grantBtn.disabled = false;
  }
});

closeBtn.addEventListener("click", () => {
  window.close();
});
