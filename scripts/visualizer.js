import { soundManager } from './soundManager.js';
import { AudioAnalyzer } from './audioAnalyzer.js';

export class Visualizer {
    constructor(container) {
        this.container = container;
        this.audioAnalyzer = null; // will attach when audio context is available
        this.setupVisualizer();
        this.setupControls();
        this.isPlaying = false;
        this.visualizationMode = 'bars'; // 'bars' or 'wave'
        this.pendingTrack = null;
        // visualizer settings
        this.beatEnabled = true;
        this.blurEnabled = true;
        this.beatThreshold = 160; // threshold for low-frequency energy to trigger beat zoom
        this._lastBeat = 0;

        this._renderLoop();
    }

    // Attach an existing AudioContext and output node (musicGain)
    attachAudio(audioContext, outputNode) {
        this.audioAnalyzer = new AudioAnalyzer({ audioContext, outputNode });
        // If a track was pending load, prefer media-element loading for robust playback/seek
        if (this.pendingTrack && this.pendingTrack.audioUrl) {
            const autoplay = !!this.pendingAutoplay;
            this.audioAnalyzer.loadFromElement(this.pendingTrack.audioUrl, autoplay).catch(() => {
                // Fallback to buffer load if media element load fails
                return this.audioAnalyzer.loadAudio(this.pendingTrack.audioUrl).catch(() => { });
            });
            this.pendingTrack = null;
            this.pendingAutoplay = false;
        }
    }

    setupVisualizer() {
        // Create background media container
        this.mediaContainer = document.createElement('div');
        this.mediaContainer.className = 'media-background';
        this.container.prepend(this.mediaContainer);

        // Create visualizer canvas
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'visualizer-canvas';
        this.container.prepend(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        // Create track info display
        this.trackInfo = document.createElement('div');
        this.trackInfo.className = 'track-info';
        this.container.appendChild(this.trackInfo);

        // Create playback controls
        this.controls = document.createElement('div');
        this.controls.className = 'playback-controls';
        this.controls.innerHTML = `
            <button class="control-btn" id="prevBtn">
                <svg width="24" height="24" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" fill="white"></path></svg>
            </button>
            <button class="control-btn" id="playBtn">
                <svg class="play-icon" width="36" height="36" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="white"></path></svg>
                <svg class="pause-icon" width="36" height="36" viewBox="0 0 24 24" style="display: none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="white"></path></svg>
            </button>
            <button class="control-btn" id="nextBtn">
                <svg width="24" height="24" viewBox="0 0 24 24"><path d="M16 6h2v12h-2zm-4.5 6l-8.5 6V6z" fill="white"></path></svg>
            </button>
            <div class="time-slider">
                <input type="range" min="0" max="100" value="0" class="slider" id="timeSlider">
                <div class="time-display">0:00 / 0:00</div>
            </div>
        `;
        this.container.appendChild(this.controls);

        // Handle window resize
        window.addEventListener('resize', () => this.resizeCanvas());
        this.resizeCanvas();
        // default blur style
        this.mediaContainer.style.filter = this.blurEnabled ? 'blur(8px) saturate(1.05)' : 'none';
        this.mediaContainer.style.transition = 'transform 400ms ease-out, filter 220ms ease';
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setupControls() {
        const playBtn = this.controls.querySelector('#playBtn');
        const prevBtn = this.controls.querySelector('#prevBtn');
        const nextBtn = this.controls.querySelector('#nextBtn');
        const timeSlider = this.controls.querySelector('#timeSlider');

        playBtn.addEventListener('click', () => this.togglePlayPause());
        prevBtn.addEventListener('click', () => this.previousTrack());
        nextBtn.addEventListener('click', () => this.nextTrack());
        timeSlider.addEventListener('input', (e) => this.seekTo(e.target.value));

        // Show controls on hover
        this.container.addEventListener('mousemove', () => {
            this.controls.classList.add('visible');
            clearTimeout(this.controlsTimeout);
            this.controlsTimeout = setTimeout(() => {
                this.controls.classList.remove('visible');
            }, 3000);
        });
    }

    async loadTrack(track, autoplay = false) {
        this.currentTrack = track;
        this.trackInfo.textContent = track.title;

        // Update background
        this.mediaContainer.style.backgroundImage = track.backgroundUrl ?
            `url(${track.backgroundUrl})` : 'none';

        // Load and prepare audio using media element (better for music playback)
        if (track.audioUrl) {
            if (this.audioAnalyzer) {
                // prefer media element source for robust seeking/streaming
                try {
                    await this.audioAnalyzer.loadFromElement(track.audioUrl, !!autoplay);
                } catch (e) {
                    // fallback to buffer-based load
                    await this.audioAnalyzer.loadAudio(track.audioUrl).catch(() => { });
                }
            } else {
                // store pending track until audio is attached
                this.pendingTrack = track;
                this.pendingAutoplay = !!autoplay;
            }
        }

        // Reset playback state
        this.isPlaying = autoplay;
        const playIcon = this.controls.querySelector('.play-icon');
        const pauseIcon = this.controls.querySelector('.pause-icon');
        if (this.isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'inline';
        } else {
            playIcon.style.display = 'inline';
            pauseIcon.style.display = 'none';
        }

        // Update time display
        this.updateTimeDisplay(0, track.duration || 0);
    }

    toggleVisualizationMode() {
        this.visualizationMode = this.visualizationMode === 'bars' ? 'wave' : 'bars';
    }

    togglePlayPause() {
        this.isPlaying = !this.isPlaying;
        const playIcon = this.controls.querySelector('.play-icon');
        const pauseIcon = this.controls.querySelector('.pause-icon');

        if (this.isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'inline';
            if (this.audioAnalyzer) {
                if (this.audioAnalyzer.audioContext.state === 'suspended') this.audioAnalyzer.audioContext.resume();
                try { this.audioAnalyzer.play(); } catch (e) { /* ignore */ }
            }
        } else {
            playIcon.style.display = 'inline';
            pauseIcon.style.display = 'none';
            if (this.audioAnalyzer) {
                try { this.audioAnalyzer.stop(); } catch (e) { /* ignore */ }
            }
        }
    }

    previousTrack() {
        if (this.onPrevious) this.onPrevious();
    }

    nextTrack() {
        if (this.onNext) this.onNext();
    }

    seekTo(percentage) {
        if (this.onSeek) this.onSeek(percentage);
        this.updateTimeDisplay(percentage * this.currentTrack.duration / 100, this.currentTrack.duration);
    }

    updateTimeDisplay(current, total) {
        const formatTime = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        const timeDisplay = this.controls.querySelector('.time-display');
        timeDisplay.textContent = `${formatTime(current)} / ${formatTime(total)}`;
    }

    _renderLoop() {
        // Clear with fade effect
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const frequencyData = this.audioAnalyzer && this.isPlaying ? this.audioAnalyzer.getFrequencyData() : new Uint8Array(128).fill(0);

        // Beat zoom effect: check low-frequency energy and slightly scale background if above threshold
        if (this.beatEnabled && this.audioAnalyzer && this.isPlaying) {
            // average first few bins for bass energy
            let sum = 0; const bins = Math.min(8, frequencyData.length);
            for (let i = 0; i < bins; i++) sum += frequencyData[i];
            const avg = sum / bins;
            const now = performance.now();
            if (avg > this.beatThreshold && now - this._lastBeat > 100) {
                this._lastBeat = now;
                // small zoom
                try {
                    this.mediaContainer.style.transform = 'scale(1.025)';
                    setTimeout(() => { this.mediaContainer.style.transform = 'scale(1)'; }, 120);
                } catch (e) { }
            }
        }

        if (this.visualizationMode === 'bars') {
            this.drawBars(frequencyData);
        } else {
            this.drawWaveform();
        }

        this.animationFrame = requestAnimationFrame(() => this._renderLoop());
    }

    drawBars(frequencyData) {
        // Smooth the data using a moving average
        const smoothingFactor = 4;
        const smoothedData = new Uint8Array(frequencyData.length);
        for (let i = 0; i < frequencyData.length; i++) {
            let sum = 0;
            let count = 0;
            for (let j = -smoothingFactor; j <= smoothingFactor; j++) {
                const index = i + j;
                if (index >= 0 && index < frequencyData.length) {
                    sum += frequencyData[index];
                    count++;
                }
            }
            smoothedData[i] = sum / count;
        }

        const barCount = smoothedData.length / 2;
        const barWidth = this.canvas.width / barCount;
        const heightScale = this.canvas.height / 500;

        for (let i = 0; i < barCount; i++) {
            const height = smoothedData[i] * heightScale;
            const hue = (i / barCount) * 260 + 200; // Color range from cyan to purple
            const brightness = 40 + (smoothedData[i] / 256) * 40; // Dynamic brightness

            // keep bars low/translucent so background remains visible
            this.ctx.fillStyle = `hsla(${hue}, 75%, ${brightness}%, 0.15)`;

            // Mirror bars for symmetrical effect
            const x1 = this.canvas.width / 2 + i * barWidth;
            const x2 = this.canvas.width / 2 - (i + 1) * barWidth;

            // Draw mirrored bars
            this.ctx.fillRect(x1, this.canvas.height - height, barWidth - 1, height);
            this.ctx.fillRect(x2, this.canvas.height - height, barWidth - 1, height);
        }
    }

    drawWaveform() {
        const waveformData = this.audioAnalyzer && this.isPlaying ? this.audioAnalyzer.getWaveformData() : new Uint8Array(this.canvas.width).fill(128);
        const bufferLength = waveformData.length;

        // Smooth the data using a moving average
        const smoothingFactor = 8;
        const smoothedData = new Uint8Array(bufferLength);
        for (let i = 0; i < bufferLength; i++) {
            let sum = 0;
            let count = 0;
            for (let j = -smoothingFactor; j <= smoothingFactor; j++) {
                const index = i + j;
                if (index >= 0 && index < bufferLength) {
                    sum += waveformData[index];
                    count++;
                }
            }
            smoothedData[i] = sum / count;
        }


        const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, 0);
        gradient.addColorStop(0, 'rgba(0, 225, 255, 0.9)');
        gradient.addColorStop(0.5, 'rgba(255, 0, 255, 0.9)');
        gradient.addColorStop(1, 'rgba(0, 225, 255, 0.9)');


        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = gradient;
        this.ctx.beginPath();

        const sliceWidth = this.canvas.width / bufferLength;
        let x = 0;
        this.ctx.moveTo(0, this.canvas.height / 2);

        for (let i = 0; i < bufferLength; i++) {
            const v = smoothedData[i] / 128.0;
            const y = v * this.canvas.height / 2;

            const nextIndex = (i + 1) % bufferLength;
            const vNext = smoothedData[nextIndex] / 128.0;
            const yNext = vNext * this.canvas.height / 2;

            const xc = (x + x + sliceWidth) / 2;
            const yc = (y + yNext) / 2;

            this.ctx.quadraticCurveTo(x, y, xc, yc);

            x += sliceWidth;
        }

        this.ctx.stroke();
    }

    stopVisualization() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }

    setBeatEnabled(enabled) {
        this.beatEnabled = !!enabled;
    }

    setBlurEnabled(enabled) {
        this.blurEnabled = !!enabled;
        try {
            this.mediaContainer.style.filter = this.blurEnabled ? 'blur(8px) saturate(1.05)' : 'none';
        } catch (e) { /* ignore */ }
    }
}
