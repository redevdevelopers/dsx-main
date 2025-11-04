import { soundManager } from './soundManager.js';
import { Visualizer } from './visualizer.js';
import { VolumeManager } from './volumeManager.js';
import { sampleSongs } from './songselect.js';

// Create global volume manager instance
const volumeManager = new VolumeManager();

// Configure volume manager callbacks
volumeManager.onVolumeChange.master = (value) => {
    // Master affects both music and effects
    soundManager.setMasterVolume(value);
};

volumeManager.onVolumeChange.effects = (value) => {
    soundManager.setEffectsVolume(value);
};

volumeManager.onVolumeChange.music = (value) => {
    soundManager.setMusicVolume(value);
};

export function createMainMenu(handlers = {}) {
    const root = document.createElement('div');

    root.classList.add('menu-root');
    root.style.textAlign = 'center';
    // full-screen transparent menu root (no boxed panel)
    root.innerHTML = `
        <div class="logo-container">
            <img id="game-logo" src="assets/misc/Images/gamelogo2.png" alt="" class="menu-logo">
        </div>
        <div class="button-container">
            <button class="button primary" id="start">Start</button>
            <button class="button ghost" id="settings">Settings</button>
        </div>
        <div class="build-info">DSX_BUILD_V1.10-A | PLATFORM Win_x86_64_26100.6899 24H2 (C) Redevon Studios 2021-2025</div>
    `;

    // Create visualizer instance AFTER we set innerHTML so its DOM isn't overwritten
    const visualizer = new Visualizer(root);
    // expose visualizer and volumeManager so settings can control them
    try {
        window.__dsx = window.__dsx || {};
        window.__dsx.menu = window.__dsx.menu || {};
        window.__dsx.menu.visualizer = visualizer;
        window.__dsx.volumeManager = window.__dsx.volumeManager || null;
        // also expose the volumeManager instance
        window.__dsx.volumeManager = window.__dsx.volumeManager || {};
        window.__dsx.volumeManager.instance = window.__dsx.volumeManager.instance || null;
        // set instance to our local volumeManager
        window.__dsx.volumeManager.instance = (window.__dsx.volumeManager.instance || volumeManager);
    } catch (e) { /* ignore */ }
    // Ensure sound manager is initialized and attach its audio context to the visualizer when ready
    soundManager.init().then(() => {
        try {
            if (soundManager.context) {
                visualizer.attachAudio(soundManager.context, soundManager.musicGain);

                // Check for suspended audio context and show a hint
                if (soundManager.context.state === 'suspended') {
                    const hint = document.createElement('div');
                    hint.className = 'autoplay-hint';
                    hint.style.position = 'fixed';
                    hint.style.bottom = '20px';
                    hint.style.right = '20px';
                    hint.style.padding = '10px 20px';
                    hint.style.background = 'rgba(0,0,0,0.7)';
                    hint.style.color = 'white';
                    hint.style.borderRadius = '5px';
                    hint.style.cursor = 'pointer';
                    hint.addEventListener('click', () => {
                        soundManager.context.resume().then(() => {
                            hint.remove();
                        });
                    }, { once: true });
                    root.appendChild(hint);
                }
            }
        } catch (e) {
            console.warn('Failed to attach audio context to visualizer', e);
        }
    }).catch(() => { });

    // After audio context attached, load a default track into the visualizer (first sample) and attempt autoplay.
    // Autoplay may be blocked by browser policy; that's acceptable — user can press play.
    try {
        const defaultSong = sampleSongs && sampleSongs.length ? sampleSongs[0] : null;
        if (defaultSong) {
            const track = {
                title: defaultSong.title,
                audioUrl: defaultSong.file,
                backgroundUrl: defaultSong.image || defaultSong.bg || null,
                duration: defaultSong.duration || 0
            };
            // defer loading slightly to ensure attachAudio ran
            setTimeout(() => {
                try { visualizer.loadTrack(track, true); } catch (e) { /* ignore autoplay failures */ }
            }, 260);
        }
    } catch (e) { /* ignore */ }

    // Hidden developer mode trigger
    let titleClicks = 0;
    let lastClickTime = 0;
    root.querySelector('#game-logo').addEventListener('click', (e) => {
        const now = Date.now();
        if (now - lastClickTime > 3000) { // Reset after 3 seconds
            titleClicks = 0;
        }
        lastClickTime = now;
        titleClicks++;

        if (titleClicks === 5) {
            titleClicks = 0;
            if (handlers.onDevModeActivate) handlers.onDevModeActivate();
        }
    });

    root.querySelector('#start').addEventListener('click', async () => {
        await soundManager.play('start');
        if (handlers.onSongSelect) handlers.onSongSelect();
    });
    root.querySelector('#settings').addEventListener('click', async () => {
        await soundManager.play('button');
        if (handlers.onSettings) handlers.onSettings();
    });

    return root;
}
