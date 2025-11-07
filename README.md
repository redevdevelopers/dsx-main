# DreamSyncX: Eternal Force (Prototype)

This repository contains a browser-based rhythm game prototype inspired by osu! and Cytus.

Features included in this prototype:
- Pixi.js rendering of a hexagon playfield
- Keyboard (WASD) and Gamepad input (ABXY) via Gamepad API
- Main menu, song select stub, settings overlay
- Simple scoring system and UI

# How to run:
Open Windows PowerShell and you can run a quick server from the project directory:

```powershell
# Python 3
python -m http.server 8000

# or if you have Node.js
npx http-server -p 8000
```

Then open http://localhost:8000 in your browser.

PS: Please make sure you have either Python version 3 or Node.js in order for the game to work.

# Notes and next steps:
- Add audio files in `/songs` and point `sampleSongs` in `scripts/songselect.js` to real tracks.

# Features added in this version:
- Implement timed note scheduling from chart JSON and hit detection with accurate timing windows.
- Add latency calibration UI and remappable input UI.
