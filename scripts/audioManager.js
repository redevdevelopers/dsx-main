export class AudioManager {
    // options: { audioContext, outputNode }
    constructor(options = {}) {
        this.audio = new Audio();
        this.audio.crossOrigin = 'anonymous';
        this.onended = null;
        this.audioContext = options.audioContext || null;
        this.outputNode = options.outputNode || null;

        // If an AudioContext and output node are provided, create a media element source
        if (this.audioContext && this.outputNode && this.audioContext.createMediaElementSource) {
            try {
                this._mediaSource = this.audioContext.createMediaElementSource(this.audio);
                this._mediaSource.connect(this.outputNode);
            } catch (e) {
                // Some browsers throw if you create multiple MediaElementSource from same element
                console.warn('AudioManager: failed to create media element source', e);
                this._mediaSource = null;
            }
        }

    }

    async load(url) {
        return new Promise((resolve, reject) => {
            this.audio.src = url;
            this.audio.preload = 'auto';
            const oncan = () => { cleanup(); resolve(); };
            const onerr = (e) => { cleanup(); reject(e); };
            const cleanup = () => { this.audio.removeEventListener('canplay', oncan); this.audio.removeEventListener('error', onerr); };
            this.audio.addEventListener('canplay', oncan);
            this.audio.addEventListener('error', onerr);
            // attempt to load
            this.audio.load();
        });
    }

    play() {
        return this.audio.play();
    }

    pause() { this.audio.pause(); }

    stop() { this.audio.pause(); this.audio.currentTime = 0; }

    getCurrentTime() { return this.audio.currentTime; } // seconds

    setCurrentTime(s) { this.audio.currentTime = s; }

    setVolume(v) { this.audio.volume = v; }

    setOnEnded(cb) { this.onended = cb; this.audio.onended = cb; }
}
