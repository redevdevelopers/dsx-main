import { AudioManager } from './audioManager.js';

export const sampleSongs = [
    { id: 'sample1', title: 'Flame', artist: 'by maimai', file: "songs/flame.mp4", chart: 'charts/flames.json', difficulty: 'normal', image: 'songs/InternetYamero/bg.jpg' },
    { id: 'sample2', title: 'Internet Yamero', artist: 'by Autobahn 96', file: 'songs/InternetYamero/Internet_Yamero.mp4', chart: 'charts/internet-yamero.json', difficulty: 'normal', image: 'songs/InternetYamero/yamero.jpg' },
    { id: 'sample3', title: 'DreamSync TEST Chart', artist: 'by Kyrinn', file: 'assets/misc/song.mp3', chart: 'charts/enhanced_sample.json', difficulty: 'Unrated', image: 'assets/misc/Images/gamelogo2.png' },
];

export class SongSelect {
    constructor({ onSelect, onClose } = {}) {
        this.onSelect = onSelect;
        this.onClose = onClose;
        this._el = document.createElement('div');
        this._el.classList.add('panel');
        this._render();
    }

    _render() {
        this._el.innerHTML = `
      <div class="menu-title">Song Select</div>
      <div class="song-list" id="song-list"></div>
      <div style="margin-top:8px"><button class="button ghost" id="close">Close</button></div>
    `;
        const list = this._el.querySelector('#song-list');
        sampleSongs.forEach(s => {
            const it = document.createElement('div');
            it.classList.add('song-item');
            it.style.backgroundImage = `url(${s.image || 'assets/misc/Images/gamelogo2.png'})`;
            it.innerHTML = `<div class="song-info">
        <div style="font-weight:700;font-size:16px">${s.title}</div>
        <div class="meta">${s.artist} • ${s.difficulty}</div>
      </div>
      <div>
        <button class="button" data-id="${s.id}">Play</button>
        <button class="button ghost" data-preview="${s.id}">Preview</button>
      </div>`;
            const playBtn = it.querySelector('[data-id]');
            const prevBtn = it.querySelector('[data-preview]');
            // SFX + ripple
            const bind = (el, sfx = 'dsx-confirm') => {
                if (!el) return;
                el.addEventListener('mouseenter', async () => { try { const { soundManager } = await import('./soundManager.js'); soundManager.play('nav'); } catch { } });
                el.addEventListener('mousedown', async (e) => {
                    try { const { soundManager } = await import('./soundManager.js'); soundManager.play(sfx); } catch { }
                    const ripple = document.createElement('span');
                    ripple.style.position = 'absolute';
                    ripple.style.left = `${e.offsetX - 10}px`;
                    ripple.style.top = `${e.offsetY - 10}px`;
                    ripple.style.width = ripple.style.height = '20px';
                    ripple.style.borderRadius = '50%';
                    ripple.style.background = 'rgba(255,255,255,0.3)';
                    ripple.style.transform = 'scale(1)';
                    ripple.style.pointerEvents = 'none';
                    ripple.style.transition = 'transform .4s ease, opacity .4s ease';
                    el.style.position = 'relative';
                    el.appendChild(ripple);
                    requestAnimationFrame(() => { ripple.style.transform = 'scale(8)'; ripple.style.opacity = '0'; });
                    setTimeout(() => ripple.remove(), 450);
                });
            };
            bind(playBtn, 'dsx-nav-enter');
            bind(prevBtn, 'button');

            playBtn.addEventListener('click', () => this._select(s));
            prevBtn.addEventListener('click', () => this._select(s, true));
            list.appendChild(it);
        });

        this._el.querySelector('#close').addEventListener('click', async () => { try { const { soundManager } = await import('./soundManager.js'); soundManager.play('button'); } catch { } this._cleanupPreview(); if (this.onClose) this.onClose(); this._el.remove(); });
    }

    _select(song, isAutoplay = false) {
        // ensure any preview is stopped
        this._cleanupPreview();
        if (this.onSelect) this.onSelect(song, song.chart, isAutoplay);
        this._el.remove();
    }

    async _preview(song) {
        if (!song.file) return alert('No preview file for this song.');
        try {
            const [{ AudioManager }, { soundManager }] = await Promise.all([
                import('./audioManager.js'),
                import('./soundManager.js')
            ]);
            // pause menu visualizer music if playing
            try { if (window.__dsx && window.__dsx.menu && window.__dsx.menu.visualizer && window.__dsx.menu.visualizer.isPlaying) window.__dsx.menu.visualizer.togglePlayPause(); } catch { }
            this._previewManager = new AudioManager({ audioContext: (soundManager && soundManager.context) || null, outputNode: (soundManager && soundManager.musicGain) || null });
            await this._previewManager.load(song.file);
            await this._previewManager.play();
            // stop after 12s preview and cleanup
            clearTimeout(this._previewTimeout);
            this._previewTimeout = setTimeout(() => { this._cleanupPreview(); }, 12000);
        } catch (e) { console.warn('Preview failed', e); alert('Preview failed to play. Make sure the audio file exists in /songs.'); }
    }

    _cleanupPreview() {
        try {
            clearTimeout(this._previewTimeout);
            if (this._previewManager) {
                this._previewManager.pause();
                this._previewManager.setCurrentTime(0);
                this._previewManager = null;
            }
        } catch { }
    }

    getElement() { return this._el; }
}
