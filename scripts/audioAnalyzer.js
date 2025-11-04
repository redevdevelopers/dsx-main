export class AudioAnalyzer {
    // options: { audioContext, outputNode }
    constructor(options = {}) {
        this.audioContext = options.audioContext || new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);
        this.gainNode = this.audioContext.createGain();

        // Optional external output node (e.g. musicGain from soundManager)
        this.outputNode = options.outputNode || this.audioContext.destination;

        // Connect nodes: gain -> analyser (for data) and gain -> output (for sound)
        this.gainNode.connect(this.analyser);
        this.gainNode.connect(this.outputNode);
    }

    async loadAudio(url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

            // Create new source
            if (this.source && this.source.disconnect) {
                try { this.source.disconnect(); } catch (e) { /* ignore */ }
            }
            this.source = this.audioContext.createBufferSource();
            this.source.buffer = audioBuffer;
            this.source.connect(this.gainNode);

            // mark as buffer-based source
            this._mediaElement = null;

            return true;
        } catch (error) {
            console.error('Error loading audio as buffer:', error);
            return false;
        }
    }

    // Load audio via HTMLAudioElement + MediaElementSource (better for long/streamed tracks)
    async loadFromElement(url, autoplay = false) {
        try {
            // cleanup previous element/source
            if (this._mediaElement) {
                try { this._mediaElement.pause(); } catch (e) { }
            }
            if (this.source && this.source.disconnect) {
                try { this.source.disconnect(); } catch (e) { }
                this.source = null;
            }

            const audio = document.createElement('audio');
            audio.crossOrigin = 'anonymous';
            audio.src = url;
            audio.preload = 'auto';
            audio.loop = false;

            // create media element source and connect to gainNode
            const mediaNode = this.audioContext.createMediaElementSource(audio);
            mediaNode.connect(this.gainNode);

            this._mediaElement = audio;
            this._mediaSourceNode = mediaNode;

            if (autoplay) audio.play().catch(() => { });
            return true;
        } catch (err) {
            console.error('Failed to load audio via media element:', err);
            return false;
        }
    }

    play(startTime = 0) {
        // If using media element, control it directly
        if (this._mediaElement) {
            try {
                // start at given seconds
                if (typeof startTime === 'number' && startTime > 0) this._mediaElement.currentTime = startTime;
                this._mediaElement.play().catch(() => { });
            } catch (e) { /* ignore */ }
            return;
        }
        if (this.source) {
            // createBufferSource can only be started once; recreate from buffer if needed
            if (this.source.started) {
                try { this.source.disconnect(); } catch (e) { }
                const newSource = this.audioContext.createBufferSource();
                newSource.buffer = this.source.buffer;
                newSource.connect(this.gainNode);
                this.source = newSource;
            }
            this.source.start(0, startTime);
            this.source.started = true;
        }
    }

    stop() {
        if (this._mediaElement) {
            try { this._mediaElement.pause(); } catch (e) { }
            return;
        }
        if (this.source) {
            try {
                this.source.stop();
            } catch (e) {
                // ignore if already stopped
            }
            this.source.started = false;
        }
    }

    setVolume(value) {
        this.gainNode.gain.value = value;
    }

    getFrequencyData() {
        this.analyser.getByteFrequencyData(this.dataArray);
        return this.dataArray;
    }

    getWaveformData() {
        this.analyser.getByteTimeDomainData(this.dataArray);
        return this.dataArray;
    }

    getCurrentTime() {
        if (this._mediaElement) return this._mediaElement.currentTime;
        return this.audioContext.currentTime;
    }

    resume() {
        return this.audioContext.resume();
    }

    suspend() {
        return this.audioContext.suspend();
    }
}