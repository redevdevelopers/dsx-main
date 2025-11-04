import { ScoreSystem } from './scoring.js';

const { PIXI } = window;

export class Gameplay {
    constructor({ parent, input, settings }) {
        this.parent = parent || document.body;
        this.input = input;
        this.settings = settings || {};
        this.app = new PIXI.Application({ backgroundAlpha: 0, resizeTo: this.parent });
        this.parent.appendChild(this.app.view);
        this.stage = this.app.stage;

        // background parallax layers
        this.bgLayer = new PIXI.Container();
        this.stage.addChildAt(this.bgLayer, 0);
        this._createParallaxBackground();

        this.score = new ScoreSystem();

        this.hexGroup = new PIXI.Container();
        this.stage.addChild(this.hexGroup);

        // additive glow layer for neon bloom imitation
        this.glowLayer = new PIXI.Container();
        this.glowLayer.blendMode = PIXI.BLEND_MODES.ADD;
        this.stage.addChild(this.glowLayer);

        this.uiLayer = new PIXI.Container();
        this.stage.addChild(this.uiLayer);

        this._createHexGrid();

        // particle / combo arrays
        this.activeParticles = [];
        this.zoneLastHit = new Array(6).fill(0);

        this.running = false;
        this.chart = null;
        this.songAudio = null;
        this.audioManager = null;
        this.startTime = 0; // ms
        this.scheduledIndex = 0;
        this.activeNotes = [];
        this.approachTime = 1500; // ms the time a note takes to travel from spawn to hit
        this.latencyOffset = (this.settings.latency || 0); // ms
        this.hitWindows = { perfect: 50, great: 100, good: 200 };

        this.pointer = { x: 0.5, y: 0.5 };
        this.app.view.addEventListener('pointermove', (e) => {
            const r = this.app.view.getBoundingClientRect();
            this.pointer.x = (e.clientX - r.left) / r.width;
            this.pointer.y = (e.clientY - r.top) / r.height;
        });

        this.lastLargeComboShown = 0;
    }

    async loadSong(song, chartPath) {
        // load chart JSON if provided
        if (chartPath) {
            try {
                const res = await fetch(chartPath);
                this.chart = await res.json();
                // sanitize chart notes: clamp out-of-range zones and skip malformed notes
                if (this.chart && Array.isArray(this.chart.notes)) {
                    let skipped = 0;
                    let clamped = 0;
                    const maxZone = (this.zonePositions && this.zonePositions.length) ? (this.zonePositions.length - 1) : 5;
                    const sanitized = [];
                    for (let i = 0; i < this.chart.notes.length; i++) {
                        const n = this.chart.notes[i];
                        if (!n || typeof n.time !== 'number' || typeof n.zone !== 'number' || Number.isNaN(n.time) || Number.isNaN(n.zone)) {
                            skipped++;
                            continue;
                        }
                        let zone = Math.floor(n.zone);
                        if (zone < 0) { zone = 0; clamped++; }
                        else if (zone > maxZone) { zone = maxZone; clamped++; }
                        // preserve other properties
                        sanitized.push(Object.assign({}, n, { zone }));
                    }
                    this.chart.notes = sanitized;
                    // show brief toast in UI with results
                    if (skipped > 0 || clamped > 0) this._showChartValidationToast(clamped, skipped);
                }
            } catch (e) { console.warn('Failed to load chart', e); }
        }
        // load audio if provided
        if (song && song.file) {
            try {
                const [{ AudioManager }, { soundManager }] = await Promise.all([
                    import('./audioManager.js'),
                    import('./soundManager.js')
                ]);
                // Pass shared AudioContext and musicGain so gameplay audio is routed through soundManager
                this.audioManager = new AudioManager({ audioContext: (soundManager && soundManager.context) || null, outputNode: (soundManager && soundManager.musicGain) || null });
                await this.audioManager.load(song.file);
            } catch (e) { console.warn('Audio load failed', e); this.audioManager = null; }
        }
    }

    start() {
        this.running = true;
        this.app.ticker.add(this._update, this);
        this.scheduledIndex = 0;
        this.activeNotes = [];
        this.startTime = performance.now();
        // if audio available, play and use its clock
        if (this.audioManager) {
            this.audioManager.play();
        }
        // read latency from settings in case it changed
        this.latencyOffset = (this.settings.latency || 0);
    }

    stop() {
        this.running = false;
        this.app.ticker.remove(this._update, this);
    }

    _createHexGrid() {
        // Draw a simple hex grid with 6 zones around center
        const center = { x: this.app.renderer.width / 2, y: this.app.renderer.height / 2 };
        const radius = Math.min(this.app.renderer.width, this.app.renderer.height) * 0.22;
        this.zonePositions = [];

        const hexBackground = new PIXI.Graphics();
        hexBackground.beginFill(0x000000, 0.3);
        hexBackground.drawCircle(center.x, center.y, radius + 70);
        hexBackground.endFill();
        this.hexGroup.addChild(hexBackground);
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const x = center.x + Math.cos(angle) * radius;
            const y = center.y + Math.sin(angle) * radius;
            const g = new PIXI.Graphics();
            g.beginFill(0x0a1220, 0.6);
            g.lineStyle(2, 0x1f3344, 0.6);
            this._drawHex(g, x, y, 60);
            g.endFill();
            this.hexGroup.addChild(g);
            this.zonePositions.push({ x, y });
        }
        // add subtle glow under each zone
        this.zoneGlows = [];
        for (let i = 0; i < this.zonePositions.length; i++) {
            const p = this.zonePositions[i];
            const glow = new PIXI.Graphics();
            glow.beginFill(0x6ee7b7, 0.06);
            glow.drawCircle(0, 0, 60);
            glow.endFill();
            glow.x = p.x; glow.y = p.y;
            glow.alpha = 0.7;
            this.hexGroup.addChildAt(glow, 0);
            this.zoneGlows.push(glow);
        }
        // add neon bloom blobs behind zones on glowLayer (vary color per zone)
        this.zoneBlooms = [];
        const colors = [0x6ee7b7, 0xff6fd8, 0x9ef0ff, 0xffe86b, 0xa8d7ff, 0xff9ea8];
        for (let i = 0; i < this.zonePositions.length; i++) {
            const p = this.zonePositions[i];
            const b = new PIXI.Container();
            // multiple concentric circles for soft bloom (larger and softer)
            for (let s = 0; s < 5; s++) {
                const c = new PIXI.Graphics();
                const alpha = (0.18 / (s + 1)) * 1.2;
                const size = 80 + s * 40;
                c.beginFill(colors[i % colors.length], alpha);
                c.drawCircle(0, 0, size);
                c.endFill();
                c.x = 0; c.y = 0;
                b.addChild(c);
            }
            b.x = p.x; b.y = p.y;
            b.alpha = 0.85;
            this.glowLayer.addChild(b);
            this.zoneBlooms.push(b);
        }
        // Score text
        this.scoreText = new PIXI.Text('Score: 0', {
            fill: 0xe6eef6,
            fontSize: 24,
            fontWeight: 'bold',
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowBlur: 4,
            dropShadowAngle: Math.PI / 2,
            dropShadowDistance: 2,
        });
        this.scoreText.x = 20; this.scoreText.y = 20;
        this.uiLayer.addChild(this.scoreText);

        // combo text
        this.comboText = new PIXI.Text('', {
            fill: 0xfff1a8,
            fontSize: 48,
            fontWeight: '900',
            stroke: '#000000',
            strokeThickness: 4,
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowBlur: 7,
            dropShadowAngle: Math.PI / 2,
            dropShadowDistance: 4,
        });
        this.comboText.anchor.set(0.5);
        this.comboText.x = this.app.renderer.width / 2;
        this.comboText.y = this.app.renderer.height * 0.25;
        this.comboText.alpha = 0;
        this.uiLayer.addChild(this.comboText);

        // full-screen combo modal
        this.comboModal = new PIXI.Container();
        this.comboModal.visible = false; this.comboModal.alpha = 0;
        const modalBg = new PIXI.Graphics();
        modalBg.beginFill(0x051224, 0.8); modalBg.drawRect(0, 0, this.app.renderer.width, this.app.renderer.height); modalBg.endFill();
        modalBg.x = 0; modalBg.y = 0; this.comboModal.addChild(modalBg);
        this.comboModalText = new PIXI.Text('', { fill: 0xffe86b, fontSize: 96, fontWeight: '900' });
        this.comboModalText.anchor.set(0.5); this.comboModalText.x = this.app.renderer.width / 2; this.comboModalText.y = this.app.renderer.height / 2;
        this.comboModal.addChild(this.comboModalText);
        this.uiLayer.addChild(this.comboModal);
    }

    _showChartValidationToast(clampedCount, skippedCount) {
        try {
            const msgs = [];
            if (clampedCount > 0) msgs.push(`${clampedCount} clamped`);
            if (skippedCount > 0) msgs.push(`${skippedCount} skipped`);
            if (msgs.length === 0) return;
            const text = `Chart loaded — ${msgs.join(', ')}`;
            const toast = new PIXI.Container();
            const w = this.app.renderer.width;
            const bg = new PIXI.Graphics();
            bg.beginFill(0x071224, 0.9);
            bg.drawRoundedRect(-220, -22, 440, 44, 8);
            bg.endFill();
            const msg = new PIXI.Text(text, { fill: 0xe6eef6, fontSize: 14, fontWeight: '700' });
            msg.anchor.set(0.5);
            msg.x = 0; msg.y = 0;
            toast.addChild(bg);
            toast.addChild(msg);
            toast.x = w / 2;
            toast.y = 40;
            toast.alpha = 0;
            this.uiLayer.addChild(toast);

            const start = performance.now();
            const duration = 3000; // show for 3s
            const fadeDur = 450;
            const anim = () => {
                const t = performance.now() - start;
                if (t < fadeDur) {
                    toast.alpha = Math.min(1, t / fadeDur);
                } else if (t < duration - fadeDur) {
                    toast.alpha = 1;
                } else if (t < duration) {
                    toast.alpha = Math.max(0, (duration - t) / fadeDur);
                } else {
                    if (toast.parent) toast.parent.removeChild(toast);
                    this.app.ticker.remove(anim);
                }
            };
            this.app.ticker.add(anim);
        } catch (e) { console.warn('Failed to show chart validation toast', e); }
    }

    _createParallaxBackground() {
        // simple starfield and soft gradient
        const bg = new PIXI.Graphics();
        const w = this.app.renderer.width, h = this.app.renderer.height;
        const g = bg.beginTextureFill({});
        // gradient rect (approx)
        const grd = new PIXI.Graphics();
        grd.beginFill(0x071022); grd.drawRect(0, 0, w, h); grd.endFill();
        this.bgLayer.addChild(grd);

        // stars
        this.starLayer = new PIXI.Container();
        for (let i = 0; i < 120; i++) {
            const s = new PIXI.Graphics();
            const r = Math.random() * 2.2;
            s.beginFill(0xffffff, 0.06 + Math.random() * 0.18);
            s.drawCircle(0, 0, r);
            s.endFill();
            s.x = Math.random() * w; s.y = Math.random() * h;
            this.starLayer.addChild(s);
        }
        this.bgLayer.addChild(this.starLayer);
    }

    _drawHex(g, x, y, r) {
        const verts = [];
        for (let i = 0; i < 6; i++) verts.push({ x: x + r * Math.cos(Math.PI / 3 * i), y: y + r * Math.sin(Math.PI / 3 * i) });
        g.moveTo(verts[0].x, verts[0].y);
        for (let i = 1; i < 6; i++) g.lineTo(verts[i].x, verts[i].y);
        g.closePath();
    }

    _spawnNote(note) {
        if (!note || typeof note.zone !== 'number') {
            console.warn('Attempted to spawn invalid note:', note);
            return;
        }
        const zoneIndex = note.zone;
        const pos = this.zonePositions[zoneIndex];
        if (!pos) {
            console.warn('Note has invalid zone index:', zoneIndex, note);
            return;
        }
        const g = new PIXI.Graphics();
        g.beginFill(0x6ee7b7);
        g.drawCircle(0, 0, 12);
        g.endFill();
        // start position further out
        const spawnY = pos.y - 180;
        g.x = pos.x; g.y = spawnY;
        g.alpha = 0.95;
        // create approach ring (shrink toward hit)
        const ring = new PIXI.Graphics();
        ring.lineStyle(3, 0x6ee7b7, 0.85);
        ring.drawCircle(0, 0, 36);
        ring.x = pos.x; ring.y = spawnY;
        ring.alpha = 0.9;
        this.stage.addChild(ring);
        this.stage.addChild(g);
        const targetTime = note.time; // ms
        const spawnedAt = this._now();
        this.activeNotes.push({ note, sprite: g, ring, spawnedAt, targetTime, zone: zoneIndex });
    }

    _now() {
        // return current song time in ms; if audio available use audio.currentTime
        if (this.audioManager) return this.audioManager.getCurrentTime() * 1000;
        return performance.now() - this.startTime;
    }

    _update(delta) {
        const now = this._now();

        // schedule notes from chart based on approachTime and latency
        if (this.chart && this.chart.notes && this.scheduledIndex < this.chart.notes.length) {
            while (this.scheduledIndex < this.chart.notes.length) {
                const n = this.chart.notes[this.scheduledIndex];
                if (!n || typeof n.time !== 'number' || typeof n.zone !== 'number') {
                    console.warn('Skipping invalid chart note at index', this.scheduledIndex, n);
                    this.scheduledIndex++;
                    continue;
                }
                const spawnTime = n.time - this.approachTime - this.latencyOffset;
                if (now >= spawnTime) {
                    this._spawnNote(n);
                    this.scheduledIndex++;
                } else break;
            }
        }

        // update active notes positions based on time progress
        for (let i = this.activeNotes.length - 1; i >= 0; i--) {
            const a = this.activeNotes[i];
            const progress = (now - (a.targetTime - this.approachTime)) / this.approachTime; // 0..1 when arriving
            const pos = this.zonePositions[a.zone];
            if (!pos) {
                // invalid zone for this active note - remove gracefully
                console.warn('Active note has invalid zone, removing:', a);
                if (a.sprite) a.sprite.destroy();
                if (a.ring) a.ring.destroy();
                this.activeNotes.splice(i, 1);
                continue;
            }
            if (progress >= 1) {
                // reached hit position and wasn't hit -> miss
                this._onMiss(a);
                if (a.sprite) a.sprite.destroy();
                if (a.ring) a.ring.destroy();
                this.activeNotes.splice(i, 1);
                continue;
            }
            // clamp
            const t = Math.max(0, Math.min(1, progress));
            const startY = pos.y - 180;
            a.sprite.y = startY + (pos.y - startY) * t;
            a.sprite.scale.set(1 + 0.3 * t);
            a.sprite.alpha = 0.95 * (1 - 0.1 * t);
            // animate approach ring position/scale/alpha
            if (a.ring) {
                a.ring.x = pos.x;
                // ring moves with sprite and shrinks as it approaches
                a.ring.y = startY + (pos.y - startY) * t;
                const ringScale = Math.max(0.2, 1 - t);
                a.ring.scale.set(ringScale);
                a.ring.alpha = 0.9 * (1 - t);
            }
        }

        // animate particles
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const p = this.activeParticles[i];
            p.life -= 16 * (delta || 1);
            p.x += p.vx * (delta || 1);
            p.y += p.vy * (delta || 1);
            p.sprite.x = p.x; p.sprite.y = p.y;
            p.sprite.alpha = Math.max(0, p.life / p.maxLife);
            p.sprite.scale.set(1 + (1 - p.life / p.maxLife) * 0.6);
            if (p.glow) {
                p.glow.x = p.x; p.glow.y = p.y;
                p.glow.alpha = Math.max(0, (p.life / p.maxLife) * 0.45);
                p.glow.scale.set(1 + (1 - p.life / p.maxLife) * 0.8);
            }
            if (p.life <= 0) { if (p.glow) p.glow.destroy(); p.sprite.destroy(); this.activeParticles.splice(i, 1); }
        }

        // animate zone glows (idle pulse + hit pulse)
        const time = performance.now() / 1000;
        for (let zi = 0; zi < this.zoneGlows.length; zi++) {
            const g = this.zoneGlows[zi];
            const idle = 0.03 * Math.sin(time * 2 + zi);
            const sinceHit = (performance.now() - (this.zoneLastHit[zi] || 0));
            const hitPulse = sinceHit < 600 ? (1 - sinceHit / 600) * 0.6 : 0;
            g.scale.set(1 + idle + hitPulse);
            g.alpha = 0.2 + hitPulse * 0.6;
        }

        // animate bloom blobs (slightly move/scale with pointer for neon effect)
        for (let i = 0; i < this.zoneBlooms.length; i++) {
            const b = this.zoneBlooms[i];
            // subtle follow pointer
            const targetX = this.zonePositions[i].x + (this.pointer.x - 0.5) * 40;
            const targetY = this.zonePositions[i].y + (this.pointer.y - 0.5) * 30;
            b.x += (targetX - b.x) * 0.08;
            b.y += (targetY - b.y) * 0.08;
            b.rotation = Math.sin(time + i) * 0.02;
        }

        // background parallax: move stars slightly by pointer and time
        if (this.starLayer) {
            const sx = (this.pointer.x - 0.5) * 40;
            const sy = (this.pointer.y - 0.5) * 20;
            this.starLayer.x = sx + Math.sin(time * 0.2) * 6;
            this.starLayer.y = sy + Math.cos(time * 0.17) * 4;
        }

        // input handling: get pressed zones from input handler (remappable)
        const pressedZones = (this.input && this.input.getPressedZones) ? this.input.getPressedZones() : [];
        for (const z of pressedZones) this._tryHit(z);

        // update score UI
        this.scoreText.text = `Score: ${this.score.score}`;

        // end condition: when all notes scheduled and no active notes and audio finished
        const allScheduled = this.chart && this.scheduledIndex >= (this.chart.notes ? this.chart.notes.length : 0);
        const noActive = this.activeNotes.length === 0;
        const audioEnded = this.audioManager ? (this.audioManager.getCurrentTime() * 1000 >= ((this.chart && this.chart.notes && this.chart.notes.length) ? (this.chart.notes[this.chart.notes.length - 1].time + 2000) : 0)) : false;
        if (allScheduled && noActive && (this.audioManager ? audioEnded : allScheduled)) {
            this._showResults();
            this.stop();
        }
    }

    _tryHit(zone) {
        const now = this._now();
        // find closest active note in zone
        let bestIndex = -1; let bestDiff = Infinity;
        for (let i = 0; i < this.activeNotes.length; i++) {
            const a = this.activeNotes[i];
            if (a.zone !== zone) continue;
            const diff = Math.abs(a.targetTime - now);
            if (diff < bestDiff) { bestDiff = diff; bestIndex = i; }
        }
        if (bestIndex === -1) return; // no note
        // grading
        const ms = bestDiff;
        let grade = null; let points = 0;
        if (ms <= this.hitWindows.perfect) { grade = 'perfect'; points = 300; }
        else if (ms <= this.hitWindows.great) { grade = 'great'; points = 150; }
        else if (ms <= this.hitWindows.good) { grade = 'good'; points = 50; }
        else { grade = 'miss'; }

        const a = this.activeNotes[bestIndex];
        // remove note and show feedback
        a.sprite.destroy();
        if (a.ring) a.ring.destroy();
        this.activeNotes.splice(bestIndex, 1);

        if (grade !== 'miss') {
            this.score.addHit(points);
            this.score.registerGrade(grade);
            // register last-hit time for glow
            this.zoneLastHit[a.zone] = performance.now();
            this._showHitFeedback(grade, a.zone);
        } else {
            this.score.miss();
            this.zoneLastHit[a.zone] = performance.now();
            this._showHitFeedback('miss', a.zone);
        }
    }

    _onMiss(a) {
        this.score.miss();
        this.score.registerGrade('miss');
        this._showHitFeedback('miss', a.zone);
    }

    async _showHitFeedback(grade, zone) {
        const pos = this.zonePositions[zone];

        // Play judgment sound
        try {
            const { soundManager } = await import('./soundManager.js');
            // Play appropriate sound for the grade
            await soundManager.play(grade, { volume: grade === 'perfect' ? 0.6 : 0.5 });
        } catch (e) { /* ignore if sound fails */ }

        // grade text with animated pop
        const color = grade === 'perfect' ? 0xfff1a8 : grade === 'great' ? 0xa8ffd6 : grade === 'good' ? 0xa8d7ff : 0xff9ea8;
        const txt = new PIXI.Text(grade.toUpperCase(), { fill: color, fontSize: 20, fontWeight: '700' });
        txt.anchor.set(0.5);
        txt.x = pos.x; txt.y = pos.y - 30;
        txt.scale.set(0.6);
        this.uiLayer.addChild(txt);

        // spark circle
        const spark = new PIXI.Graphics();
        spark.beginFill(color);
        spark.drawCircle(0, 0, 8);
        spark.endFill();
        spark.x = pos.x; spark.y = pos.y;
        this.uiLayer.addChild(spark);

        const start = performance.now();
        const duration = 420;
        const animate = () => {
            const elapsed = performance.now() - start;
            const t = Math.min(1, elapsed / duration);
            // grade text pop
            const s = 1 + 0.6 * (1 - (t - 0.2) * (t - 0.2));
            txt.scale.set(0.6 + 0.9 * (1 - t));
            txt.alpha = 1 - t * 1.1;
            // spark expand
            spark.scale.set(1 + t * 1.8);
            spark.alpha = 1 - t;
            if (t >= 1) {
                txt.destroy();
                spark.destroy();
                this.app.ticker.remove(animate);
            }
        };
        this.app.ticker.add(animate);

        // particle burst
        const particleCount = grade === 'perfect' ? 12 : grade === 'great' ? 9 : grade === 'good' ? 6 : 4;
        for (let i = 0; i < particleCount; i++) {
            const sp = new PIXI.Graphics();
            // rounded rect particle
            sp.beginFill(color, 1);
            sp.drawRoundedRect(-3, -2, 6, 4, 2);
            sp.endFill();
            sp.x = pos.x; sp.y = pos.y;
            this.uiLayer.addChild(sp);
            // bloom copy into glow layer (soft larger)
            const glow = new PIXI.Graphics();
            glow.beginFill(color, 0.25);
            glow.drawCircle(0, 0, 8);
            glow.endFill();
            glow.x = pos.x; glow.y = pos.y; this.glowLayer.addChild(glow);
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 5;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed - (Math.random() * 0.6);
            this.activeParticles.push({ sprite: sp, glow, x: pos.x, y: pos.y, vx, vy, life: 700, maxLife: 700 });
        }

        // combo pop
        const combo = this.score.combo || 0;
        if (combo > 1) {
            this.comboText.text = `${combo}x`;
            this.comboText.alpha = 1;
            this.comboText.scale.set(0.6);
            const start = performance.now();
            const dur = 700;
            const anim = () => {
                const t = Math.min(1, (performance.now() - start) / dur);
                const s = 1 + 0.8 * (1 - t);
                this.comboText.scale.set(s);
                this.comboText.alpha = 1 - t * 1.1;
                if (t >= 1) this.app.ticker.remove(anim);
            };
            this.app.ticker.add(anim);
        }

        // full-screen combo modal for big combos
        const bigThresholds = [20, 50, 100];
        for (let th of bigThresholds) {
            if (combo >= th && this.lastLargeComboShown < th) {
                this._showFullComboModal(combo, th);
                this.lastLargeComboShown = th;
                break;
            }
        }
    }

    _showFullComboModal(combo, threshold) {
        this.comboModal.visible = true;
        this.comboModal.alpha = 0;
        this.comboModalText.text = `${combo}x COMBO!`;
        this.comboModalText.style.fill = combo >= 100 ? 0xff7bd6 : combo >= 50 ? 0x9ef0ff : 0xfff1a8;
        // scale up animation
        const start = performance.now();
        const dur = 1200;
        const anim = () => {
            const t = Math.min(1, (performance.now() - start) / dur);
            this.comboModal.alpha = 1 - t * 0.9;
            this.comboModalText.scale.set(1 + 1.5 * (1 - t));
            if (t >= 1) {
                this.comboModal.visible = false;
                this.app.ticker.remove(anim);
            }
        };
        this.app.ticker.add(anim);
        // small particle burst centered
        const pos = { x: this.app.renderer.width / 2, y: this.app.renderer.height / 2 };
        for (let i = 0; i < Math.min(60, 10 + Math.floor(combo / 5)); i++) {
            const pcol = combo >= 100 ? 0xff7bd6 : combo >= 50 ? 0x9ef0ff : 0xfff1a8;
            const sp = new PIXI.Graphics(); sp.beginFill(pcol, 1); sp.drawCircle(0, 0, 5); sp.endFill(); sp.x = pos.x; sp.y = pos.y; this.uiLayer.addChild(sp);
            const angle = Math.random() * Math.PI * 2; const speed = 3 + Math.random() * 6;
            const vx = Math.cos(angle) * speed; const vy = Math.sin(angle) * speed;
            this.activeParticles.push({ sprite: sp, x: sp.x, y: sp.y, vx, vy, life: 900, maxLife: 900 });
        }
    }

    _showResults() {
        // Import grade calculations
        import('./grades.js').then(({ calculateGrade, calculateFinalScore, formatNumber }) => {
            const accuracy = this.score.getAccuracy();
            const gradeData = calculateGrade(accuracy);
            const finalScore = calculateFinalScore(this.score.score, gradeData.grade);

            // Canvas results overlay with grade animation
            const canvasOverlay = new PIXI.Container();
            const w = this.app.renderer.width, h = this.app.renderer.height;

            // Full screen dark overlay with grade reveal
            const bg = new PIXI.Graphics();
            bg.beginFill(0x000000, 0.7);
            bg.drawRect(0, 0, w, h);
            bg.endFill();
            canvasOverlay.addChild(bg);

            // Main results panel
            const panel = new PIXI.Container();
            const panelBg = new PIXI.Graphics();
            panelBg.beginFill(0x071224, 0.95);
            panelBg.lineStyle(2, gradeData.color, 0.3);
            panelBg.drawRoundedRect(-280, -180, 560, 360, 16);
            panelBg.endFill();
            panel.addChild(panelBg);

            // Grade display
            const gradeText = new PIXI.Text(gradeData.grade, {
                fill: gradeData.color,
                fontSize: 120,
                fontWeight: '900',
                dropShadow: true,
                dropShadowColor: 0x000000,
                dropShadowDistance: 4,
                dropShadowBlur: 4
            });
            gradeText.anchor.set(0.5);
            gradeText.y = -100;
            panel.addChild(gradeText);

            // Grade title and description
            const titleText = new PIXI.Text(gradeData.title, {
                fill: gradeData.color,
                fontSize: 24,
                fontWeight: '700'
            });
            titleText.anchor.set(0.5);
            titleText.y = -40;
            panel.addChild(titleText);

            const descText = new PIXI.Text(gradeData.description, {
                fill: 0xe6eef6,
                fontSize: 18
            });
            descText.anchor.set(0.5);
            descText.y = -10;
            panel.addChild(descText);

            // Stats with animations
            const statsContainer = new PIXI.Container();
            statsContainer.y = 40;

            const statLines = [
                { label: 'Score', value: formatNumber(finalScore), bonus: gradeData.reward > 0 ? `+${formatNumber(gradeData.reward)}` : '' },
                { label: 'Max Combo', value: `${this.score.maxCombo}x` },
                { label: 'Accuracy', value: `${accuracy}%` },
                { label: 'Perfect', value: this.score.grades.perfect || 0 },
                { label: 'Great', value: this.score.grades.great || 0 },
                { label: 'Good', value: this.score.grades.good || 0 },
                { label: 'Miss', value: this.score.grades.miss || 0 }
            ];

            statLines.forEach((stat, i) => {
                const row = new PIXI.Container();
                row.y = i * 28;

                const label = new PIXI.Text(stat.label + ':', {
                    fill: 0x9fbfd6,
                    fontSize: 16
                });
                label.anchor.set(1, 0);
                label.x = -10;
                row.addChild(label);

                const value = new PIXI.Text(stat.value, {
                    fill: 0xe6eef6,
                    fontSize: 16,
                    fontWeight: '700'
                });
                value.x = 10;
                row.addChild(value);

                if (stat.bonus) {
                    const bonus = new PIXI.Text(stat.bonus, {
                        fill: gradeData.color,
                        fontSize: 16,
                        fontWeight: '700'
                    });
                    bonus.x = value.x + value.width + 10;
                    row.addChild(bonus);
                }

                statsContainer.addChild(row);
            });
            panel.addChild(statsContainer);

            // Controls hint
            const controls = new PIXI.Text('Press SPACE to retry or ESC for menu', {
                fill: 0x9fbfd6,
                fontSize: 14
            });
            controls.anchor.set(0.5);
            controls.y = 160;
            panel.addChild(controls);

            panel.x = w / 2;
            panel.y = h / 2;
            canvasOverlay.addChild(panel);
            this.uiLayer.addChild(canvasOverlay);

            // Entrance animation
            const tname = (this.settings && this.settings.transition) ? this.settings.transition : 'elastic';
            const start = performance.now();
            const duration = 1200;

            // Initial state
            panel.alpha = 0;
            gradeText.scale.set(2);
            gradeText.alpha = 0;
            titleText.alpha = 0;
            descText.alpha = 0;
            statsContainer.alpha = 0;
            controls.alpha = 0;

            const anim = () => {
                const t = Math.min(1, (performance.now() - start) / duration);
                if (t >= 1) {
                    this.app.ticker.remove(anim);
                    return;
                }

                // Panel animation based on transition style
                if (tname === 'elastic') {
                    const s = 0.8 + (1.2 - 0.8) * (1 - Math.pow(1 - t, 3));
                    panel.scale.set(s);
                    panel.alpha = Math.min(1, t * 2);
                } else if (tname === 'slide') {
                    panel.y = (h / 2) + (1 - t) * 200;
                    panel.alpha = t;
                } else if (tname === 'fade') {
                    panel.scale.set(0.96 + 0.04 * t);
                    panel.alpha = t;
                } else if (tname === 'flip') {
                    const sx = Math.cos((1 - t) * Math.PI) * -1;
                    panel.scale.x = sx;
                    panel.alpha = t;
                }

                // Sequenced element animations
                if (t > 0.2) {
                    const gt = Math.min(1, (t - 0.2) / 0.3);
                    gradeText.scale.set(2 - gt);
                    gradeText.alpha = gt;
                }
                if (t > 0.4) {
                    const tt = Math.min(1, (t - 0.4) / 0.2);
                    titleText.alpha = tt;
                    descText.alpha = tt;
                }
                if (t > 0.5) {
                    const st = Math.min(1, (t - 0.5) / 0.3);
                    statsContainer.alpha = st;
                }
                if (t > 0.7) {
                    const ct = Math.min(1, (t - 0.7) / 0.2);
                    controls.alpha = ct;
                }
            };
            this.app.ticker.add(anim);

            // Keyboard controls
            const handleKeys = (e) => {
                if (e.code === 'Space') {
                    e.preventDefault();
                    cleanup();
                    this.start();
                } else if (e.code === 'Escape') {
                    e.preventDefault();
                    cleanup();
                    location.reload();
                }
            };
            window.addEventListener('keydown', handleKeys);

            // Cleanup
            const cleanup = () => {
                try {
                    window.removeEventListener('keydown', handleKeys);
                    if (canvasOverlay.parent) canvasOverlay.parent.removeChild(canvasOverlay);
                } catch (e) { /* ignore */ }
            };
        });
    }
}
