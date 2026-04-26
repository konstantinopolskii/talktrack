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
├── transcript.txt    — what you said, with timestamps
├── timeline.md       — voice over events, merged by timestamp
├── log.txt           — human-readable timeline of DOM events
├── events.jsonl      — same events, one JSON per line
└── session.json      — metadata: started, stopped, duration, audio, transcript
```

Audio defaults to AAC in an mp4 container (`.m4a`) — light, universal,
plays in QuickTime, Music, Windows Media Player, VLC, anything modern.
On browsers that don't ship the AAC encoder it falls back to opus webm.
Transcription runs live during the recording via Chrome's Web Speech API
(no extra install, no model download). On macOS the default download
directory is `~/Downloads`; point Chrome at `~/Documents` if you want
sessions to land there.

After a session, the popup shows a paste-ready briefing — drop it into
your agent and it knows where to look and what each file holds:

```
WalkieTalkie session 20260426-114530
folder: ~/Downloads/walkietalkie/session-20260426-114530
duration: 3 min 12 sec, 47 events, 14 voice segments
files:
  audio.m4a       microphone capture (m4a)
  timeline.md     voice over events, merged by timestamp
  transcript.txt  what you said, plain text with timestamps
  log.txt         human-readable timeline of clicks, selections, keys
  events.jsonl    same events, one JSON object per line
  session.json    metadata: started, stopped, duration, audio, transcript

Read timeline.md first — voice and DOM events line up there.
Match timestamps to events.jsonl for full DOM context (selector,
bbox, attrs) on any moment.
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
- Offscreen document (`offscreen.js`) runs MediaRecorder for audio and
  Web Speech API for live transcription on the same mic.
- Content script (`content.js`) hooks click, contextmenu, keydown,
  selectionchange, input, and scroll on every host page.
- Popup (`popup.html` + `popup.js`) is the inspector card UI.
- Setup page (`setup.html` + `setup.js`) handles the one-time mic grant
  Chrome won't show inside an extension popup.
- Styles ship from `@kk/design-system` via `vendor/kk/`.
