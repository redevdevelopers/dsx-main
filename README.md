# DreamSyncX: Eternal Force (Prototype)

This repository contains a browser-based rhythm game prototype inspired by osu! and Cytus.

Features included in this prototype:
- Pixi.js rendering of a hexagon playfield
- Keyboard (WASD) and Gamepad input (ABXY) via Gamepad API
- Main menu, song select stub, settings overlay
- Simple scoring system and UI
- Basic chart editor that exports JSON

How to run:
1. Open `index.html` in a modern browser (Chrome, Edge, Firefox). For local file access of charts, prefer running a local http server.

On Windows PowerShell you can run a quick server from the project directory:

```powershell
# Python 3
python -m http.server 8000

# or if you have Node.js
npx http-server -p 8000
```

Then open http://localhost:8000 in your browser.

Notes and next steps:
- Add audio files in `/songs` and point `sampleSongs` in `scripts/songselect.js` to real tracks.
- Implement timed note scheduling from chart JSON and hit detection with accurate timing windows.
- Add latency calibration UI and remappable input UI.
