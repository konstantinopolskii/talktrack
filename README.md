# WalkieTalkie

Chrome extension that records voice plus DOM interactions on any open page.
You hit start, talk through the page, click whatever catches you. WalkieTalkie
captures audio and a structured log of every click, selection, key combo,
text input, and scroll, and writes the bundle to disk when you stop.

## What lands on disk

Each session writes a folder under your Chrome download directory:

```
<chrome download dir>/walkietalkie/session-YYYYMMDD-HHMMSS/
├── audio.m4a         — microphone capture, AAC in mp4 (or .webm fallback)
├── log.txt           — human-readable timeline of DOM events
├── events.jsonl      — same events, one JSON per line
└── session.json      — metadata: started, stopped, duration, audio, ua
```

Audio defaults to AAC in an mp4 container (`.m4a`) — light, universal,
plays in QuickTime, Music, Windows Media Player, VLC, anything modern.
On browsers that don't ship the AAC encoder it falls back to opus webm.
On macOS the default download directory is `~/Downloads`; point Chrome
at `~/Documents` if you want sessions to land there.

After a session, the popup shows a paste-ready briefing — drop it into
your agent and it has the path, the file inventory, and instructions
to transcribe the audio, line voice up against the DOM events, ask
clarifying questions, and confirm the direction before acting:

```
WalkieTalkie session 20260426-114530
folder: ~/Downloads/walkietalkie/session-20260426-114530
duration: 3 min 12 sec, 47 events
files:
  audio.m4a    microphone capture (m4a)
  log.txt      human-readable timeline of clicks, selections, keys
  events.jsonl same events, one JSON object per line
  session.json metadata: started, stopped, duration, audio, ua

Instructions for you (the agent):
1. Transcribe audio.m4a yourself.
2. Read log.txt and line up each voice segment with the DOM events
   by timestamp. Use events.jsonl for full DOM context (selector,
   bbox, attrs) on any moment.
3. If anything is unclear — what I meant, why I did something, where
   I want to take it next — ask before assuming.
4. After the analysis, summarize what you understood and confirm the
   direction with me before you act on it.
```

## Install

Local dev:

```
npm install
# → vendors @kk/design-system into vendor/kk for the popup styles
```

Then in Chrome:
1. open `chrome://extensions`
2. toggle on **Developer mode**
3. click **Load unpacked** and pick this folder
4. pin the action so the popup is one click away
5. on first start, allow microphone access for the extension

## Pipeline

Designed against the kk-agentic-ds inspector card pattern. Popup composes
three cards in a single `inspector__group`: heading, recorder, last
session. No three-column shell, no off-grid tokens, no invented components.

## Stack

- Manifest V3 service worker (`background.js`) holds session state and
  writes the bundle to disk.
- Offscreen document (`offscreen.js`) runs MediaRecorder for audio.
- Content script (`content.js`) hooks click, contextmenu, keydown,
  selectionchange, input, and scroll on every host page.
- Popup (`popup.html` + `popup.js`) is the inspector card UI.
- Setup page (`setup.html` + `setup.js`) handles the one-time mic grant
  Chrome won't show inside an extension popup.
- Styles ship from `@kk/design-system` via `vendor/kk/`.
