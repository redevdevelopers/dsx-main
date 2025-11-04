import { AudioManager } from './audioManager.js';

export const sampleSongs = [
    { id: 'sample1', title: 'Internet Yamero', artist: 'by Autobahn 83', file: 'songs/interfaceloading.mp3', chart: '/charts/enhanced_sample.json', difficulty: 'Easy', image: 'songs/Sewerslvt_Restlessness/bg.jpg' },
    { id: 'sample2', title: 'Hysteria', artist: 'Muse', file: 'songs/sample.mp3', chart: '/charts/sample_chart.json', difficulty: 'Medium', image: 'https://i1.sndcdn.com/artworks-000053235823-43r90g-t500x500.jpg' },
    { id: 'sample3', title: 'Knights of Cydonia', artist: 'Muse', file: 'songs/sample.mp3', chart: '/charts/sample_chart.json', difficulty: 'Hard', image: 'https://m.media-amazon.com/images/M/MV5BMDgxN2YxYzktMzBwZi00YjA4LWIzYjItYzAwOWM0MDUxZGUzXkEyXkFqcGdeQXVyNTQ4NTc5OTU@._V1_.jpg' },
    { id: 'sample4', title: 'Internet Yamero', artist: 'by Autobahn 83', file: 'songs/interfaceloading.mp3', chart: '/charts/enhanced_sample.json', difficulty: 'Easy', image: 'songs/Sewerslvt_Restlessness/bg.jpg' },
    { id: 'sample5', title: 'Hysteria', artist: 'Muse', file: 'songs/sample.mp3', chart: '/charts/sample_chart.json', difficulty: 'Medium', image: 'https://i1.sndcdn.com/artworks-000053235823-43r90g-t500x500.jpg' },
    { id: 'sample6', title: 'Knights of Cydonia', artist: 'Muse', file: 'songs/sample.mp3', chart: '/charts/sample_chart.json', difficulty: 'Hard', image: 'https://m.media-amazon.com/images/M/MV5BMDgxN2YxYzktMzBwZi00YjA4LWIzYjItYzAwOWM0MDUxZGUzXkEyXkFqcGdeQXVyNTQ4NTc5OTU@._V1_.jpg' },
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
            it.style.backgroundImage = `url(${s.image})`;
            it.innerHTML = `<div class="song-info">
        <div style="font-weight:600">${s.title}</div>
        <div class="meta">${s.artist} • ${s.difficulty}</div>
      </div>
      <div>
        <button class="button" data-id="${s.id}">Play</button>
        <button class="button ghost" data-preview="${s.id}">Preview</button>
      </div>`;
            it.querySelector('[data-id]').addEventListener('click', () => this._select(s));
            it.querySelector('[data-preview]').addEventListener('click', () => this._preview(s));
            list.appendChild(it);
        });

        this._el.querySelector('#close').addEventListener('click', () => { if (this.onClose) this.onClose(); this._el.remove(); });
    }

    _select(song) {
        // load chart path and optional audio. Keep song.file null for now.
        if (this.onSelect) this.onSelect(song, song.chart);
        this._el.remove();
    }

    async _preview(song) {
        if (!song.file) return alert('No preview file for this song.');
        try {
            const [{ AudioManager }, { soundManager }] = await Promise.all([
                import('./audioManager.js'),
                import('./soundManager.js')
            ]);
            const am = new AudioManager({ audioContext: (soundManager && soundManager.context) || null, outputNode: (soundManager && soundManager.musicGain) || null });
            await am.load(song.file);
            await am.play();
            // stop after 12s preview and cleanup
            setTimeout(() => { try { am.pause(); am.setCurrentTime(0); } catch (e) { /* ignore */ } }, 12000);
        } catch (e) { console.warn('Preview failed', e); alert('Preview failed to play. Make sure the audio file exists in /songs.'); }
    }

    getElement() { return this._el; }
}
