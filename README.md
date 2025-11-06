![alt text](assets/misc/Images/gamelogo2.png)
# DreamSyncX: Eternal Force (Prototype)

This repository contains a browser-based rhythm game prototype by Redevon Community

Features included in this prototype:
- Pixi.js rendering of a hexagon playfield
- Keyboard (TYU,GHJ) TYU for top hex's zone and GHJ for bottom hex's zone.
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

# Version History changes:
V1.10-A
- Implement timed note scheduling from chart JSON and hit detection with accurate timing windows.
- Add latency calibration UI and remappable input UI.

V1.12-D
- Temporaily unlinked gameplay field custom hexagon skin due to some weird code issues. Will be added back soon though.
- Gameplay Field UI minor improvments (still WIP will be polished in later update)
- 2 new playable charts (not the best but will be polished in later update)
- Fixes with bug and improved code quality.
- GUI Fixes and improvements.
- Added custom cursor.
- More bugs!
