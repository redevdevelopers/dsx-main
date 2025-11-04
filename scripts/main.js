import { createMainMenu } from './menu.js';
import { SongSelect } from './songselect.js';
import { InputHandler } from './input.js';
import { Gameplay } from './gameplay.js';
import { ChartEditor } from './chartEditor.js';

const BUILD_VERSION = '2025.11.02';

// Small app state
const state = {
    currentScreen: 'menu',
    settings: {
        inverted: false,
        latency: 0,
        transition: 'elastic',
        developer: false,
        renderer: {
            resolution: 1,
            antialias: true,
            backgroundColor: 0x000000,
            autoDensity: true,
            powerPreference: 'high-performance'
        },
        scaling: 'fit', // 'fit', 'fill', or 'stretch'
        // visualizer & input settings
        visualizerBeat: true,
        blurMainMenuBackground: true,
        volumeScrollEnabled: true,
    },
    inputMap: null,
};

const uiRoot = document.getElementById('ui-root');
const gameRoot = document.getElementById('game-root');

// create persistent screens (only one active at a time)
const screens = {
    menu: document.createElement('div'),
    songSelect: document.createElement('div'),
    settings: document.createElement('div'),
    editor: document.createElement('div'),
    results: document.createElement('div')
};
for (const k of Object.keys(screens)) {
    const s = screens[k]; s.classList.add('screen'); s.dataset.screen = k; uiRoot.appendChild(s);
}

let __currentScreen = null;
function showScreen(name) {
    // name may be null to hide all screens
    if (name === __currentScreen) return;
    const from = __currentScreen ? screens[__currentScreen] : null;
    const to = name ? screens[name] : null;
    const hasAnime = typeof window.anime === 'function';

    function hideElement(el) {
        if (!el) return;
        // hide panels inside
        const panels = Array.from(el.querySelectorAll('.panel'));
        if (hasAnime && panels.length) {
            window.anime.timeline().add({
                targets: panels,
                opacity: [1, 0],
                translateY: [0, -18],
                scale: [1, 0.98],
                duration: 320,
                easing: 'easeInQuad',
                delay: window.anime.stagger(40)
            }).finished.then(() => { el.classList.remove('active'); el.style.display = 'none'; });
        } else {
            el.classList.remove('active'); el.style.display = 'none';
        }
    }

    function showElement(el) {
        if (!el) return;
        const panels = Array.from(el.querySelectorAll('.panel'));
        el.style.display = 'flex';
        el.classList.add('active');
        if (hasAnime && panels.length) {
            panels.forEach(p => { p.style.opacity = 0; p.style.transform = 'translateY(18px) scale(0.98)'; });
            window.anime.timeline().add({
                targets: panels,
                opacity: [0, 1],
                translateY: [18, 0],
                scale: [0.98, 1],
                duration: 480,
                easing: 'easeOutElastic(1, .75)',
                delay: window.anime.stagger(60)
            });
        }
    }

    // animate out current
    hideElement(from);
    // show next
    if (to) showElement(to);
    __currentScreen = name;
}

// load persisted config from localStorage (if any)
function loadConfig() {
    try {
        const raw = localStorage.getItem('dsx_config');
        if (!raw) return;
        const cfg = JSON.parse(raw);
        // Basic settings
        if (cfg.latency !== undefined) state.settings.latency = Number(cfg.latency) || 0;
        if (cfg.inverted !== undefined) state.settings.inverted = !!cfg.inverted;
        if (cfg.mappings) state.inputMap = cfg.mappings;
        if (cfg.transition) state.settings.transition = cfg.transition;

        // Advanced settings
        if (cfg.developer !== undefined) state.settings.developer = !!cfg.developer;
        if (cfg.scaling) state.settings.scaling = cfg.scaling;

        // Renderer settings
        if (cfg.renderer) {
            state.settings.renderer = Object.assign({}, state.settings.renderer, cfg.renderer);
        }
    } catch (e) { console.warn('Failed to load config', e); }
}

function saveConfig() {
    try {
        const cfg = {
            latency: state.settings.latency,
            inverted: state.settings.inverted,
            mappings: input.getMappings(),
            transition: state.settings.transition,
            developer: state.settings.developer,
            scaling: state.settings.scaling,
            renderer: state.settings.renderer,
            visualizerBeat: state.settings.visualizerBeat,
            blurMainMenuBackground: state.settings.blurMainMenuBackground,
            volumeScrollEnabled: state.settings.volumeScrollEnabled
        };
        localStorage.setItem('dsx_config', JSON.stringify(cfg));
        // show transient saved toast
        showSavedToast();
    } catch (e) { console.warn('Failed to save config', e); }
}

loadConfig();

function showSavedToast() {
    try {
        const existing = uiRoot.querySelector('.toast');
        if (existing) existing.remove();
        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = 'Saved';
        t.style.position = 'fixed';
        t.style.right = '18px';
        t.style.top = '18px';
        t.style.zIndex = 9999;
        uiRoot.appendChild(t);
        // force reflow then show
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 1200);
    } catch (e) { /* ignore */ }
}

const input = new InputHandler(state);

// create UI screens
const menu = createMainMenu({
    onStart: startGame,
    onSongSelect: openSongSelect,
    onSettings: openSettings,
    onDevModeActivate: () => {
        state.settings.developer = !state.settings.developer;
        saveConfig();
        // Show toast with developer mode status
        const message = state.settings.developer ? 'Developer Mode Enabled' : 'Developer Mode Disabled';
        const toast = document.createElement('div');
        toast.className = 'toast developer-toast';
        toast.style.background = state.settings.developer ? 'rgba(110,231,183,0.15)' : 'rgba(255,255,255,0.1)';
        toast.innerHTML = `<div style="font-weight:700">${message}</div>
                         <div style="font-size:12px;opacity:0.7;margin-top:2px">Build ${BUILD_VERSION}</div>`;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
});
screens.menu.appendChild(menu);
showScreen('menu');

let gameplay = null;

function openSongSelect() {
    // clear and render into songSelect screen
    screens.songSelect.innerHTML = '';
    const selector = new SongSelect({ onSelect: (song, chart) => { startGame({ song, chart }); }, onClose: () => { showScreen('menu'); } });
    screens.songSelect.appendChild(selector.getElement());
    showScreen('songSelect');
}

function openSettings() {
    // quick settings overlay
    // render settings into its dedicated screen
    screens.settings.innerHTML = '';
    const overlay = document.createElement('div');
    overlay.classList.add('panel');
    overlay.innerHTML = `
    <div class="menu-title">Settings</div>
        <div class="controls-row">
            <label><input type="checkbox" id="invert-toggle"> Inverted controls</label>
        </div>
        <div class="controls-row" style="margin-top:8px">
            <label><input type="checkbox" id="volume-scroll-toggle"> Enable volume scroll (mouse wheel)</label>
        </div>
        <div class="controls-row" style="margin-top:8px">
            <label><input type="checkbox" id="visualizer-beat-toggle"> Enable visualizer beat-to-background</label>
        </div>
        <div class="controls-row" style="margin-top:8px">
            <label><input type="checkbox" id="visualizer-blur-toggle"> Blur main menu background</label>
        </div>
        <div class="controls-row" style="margin-top:8px">
            <label>Latency (ms): <input type="number" id="latency-input" value="${state.settings.latency}" style="width:90px"></label>
            <button class="button ghost" id="remap-btn">Remap Inputs</button>
            <button class="button ghost" id="calibrate-btn">Calibrate</button>
        </div>
        <div class="controls-row" style="margin-top:8px">
            <label>Transition: <select id="transition-select">
                <option value="elastic">Elastic (pop)</option>
                <option value="slide">Slide</option>
                <option value="fade">Fade</option>
                <option value="flip">Flip</option>
            </select></label>
        </div>
        <div class="controls-row" style="margin-top:8px">
            <label>Game Scaling: <select id="scaling-select">
                <option value="fit">Fit Screen</option>
                <option value="fill">Fill Screen</option>
                <option value="stretch">Stretch</option>
            </select></label>
        </div>
        
        <div class="controls-section" id="developer-section" style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1)">
            <div class="controls-row">
                <label><input type="checkbox" id="developer-toggle"> Developer Mode</label>
            </div>
            <div id="developer-options" style="margin-top:8px;display:none">
                <div class="controls-row">
                    <label>Resolution Scale: <input type="number" id="resolution-input" value="${state.settings.renderer.resolution}" step="0.1" min="0.1" max="2" style="width:70px"></label>
                </div>
                <div class="controls-row" style="margin-top:4px">
                    <label><input type="checkbox" id="antialias-toggle" ${state.settings.renderer.antialias ? 'checked' : ''}> Antialias</label>
                </div>
                <div class="controls-row" style="margin-top:4px">
                    <label><input type="checkbox" id="autodensity-toggle" ${state.settings.renderer.autoDensity ? 'checked' : ''}> Auto DPI scaling</label>
                </div>
                <div class="controls-row" style="margin-top:4px">
                    <label>GPU Preference: <select id="gpu-select">
                        <option value="high-performance" ${state.settings.renderer.powerPreference === 'high-performance' ? 'selected' : ''}>High Performance</option>
                        <option value="low-power" ${state.settings.renderer.powerPreference === 'low-power' ? 'selected' : ''}>Power Saver</option>
                    </select></label>
                </div>
            </div>
        </div>
        
        <div style="margin-top:8px" id="mapping-display"></div>
        <div style="margin-top:8px"><button class="button" id="close-settings">Back</button></div>
  `;
    screens.settings.appendChild(overlay);
    showScreen('settings');
    const checkbox = overlay.querySelector('#invert-toggle');
    checkbox.checked = state.settings.inverted;
    checkbox.addEventListener('change', async (e) => {
        const { soundManager } = await import('./soundManager.js');
        await soundManager.play('toggle');
        state.settings.inverted = e.target.checked;
        input.setInverted(e.target.checked);
        saveConfig();
    });
    const latencyInput = overlay.querySelector('#latency-input');
    latencyInput.value = state.settings.latency;
    latencyInput.addEventListener('change', (e) => { state.settings.latency = Number(e.target.value) || 0; saveConfig(); });

    // Volume scroll control
    const volScrollToggle = overlay.querySelector('#volume-scroll-toggle');
    volScrollToggle.checked = state.settings.volumeScrollEnabled;
    volScrollToggle.addEventListener('change', (e) => {
        state.settings.volumeScrollEnabled = !!e.target.checked;
        // apply to runtime volume manager if available
        try {
            if (window.__dsx && window.__dsx.volumeManager && window.__dsx.volumeManager.instance) {
                window.__dsx.volumeManager.instance.enableWheel(state.settings.volumeScrollEnabled);
            }
        } catch (err) { /* ignore */ }
        saveConfig();
    });

    // Visualizer beat control
    const vizBeatToggle = overlay.querySelector('#visualizer-beat-toggle');
    vizBeatToggle.checked = state.settings.visualizerBeat;
    vizBeatToggle.addEventListener('change', (e) => {
        state.settings.visualizerBeat = !!e.target.checked;
        try {
            if (window.__dsx && window.__dsx.menu && window.__dsx.menu.visualizer) {
                window.__dsx.menu.visualizer.setBeatEnabled(state.settings.visualizerBeat);
            }
        } catch (err) { /* ignore */ }
        saveConfig();
    });

    // Visualizer blur control
    const vizBlurToggle = overlay.querySelector('#visualizer-blur-toggle');
    vizBlurToggle.checked = state.settings.blurMainMenuBackground;
    vizBlurToggle.addEventListener('change', (e) => {
        state.settings.blurMainMenuBackground = !!e.target.checked;
        try {
            if (window.__dsx && window.__dsx.menu && window.__dsx.menu.visualizer) {
                window.__dsx.menu.visualizer.setBlurEnabled(state.settings.blurMainMenuBackground);
            }
        } catch (err) { /* ignore */ }
        saveConfig();
    });

    const transitionSelect = overlay.querySelector('#transition-select');
    transitionSelect.value = state.settings.transition || 'elastic';
    transitionSelect.addEventListener('change', (e) => { state.settings.transition = e.target.value; saveConfig(); });

    const scalingSelect = overlay.querySelector('#scaling-select');
    scalingSelect.value = state.settings.scaling || 'fit';
    scalingSelect.addEventListener('change', (e) => {
        state.settings.scaling = e.target.value;
        saveConfig();
    });

    // Developer mode toggle and options
    const devToggle = overlay.querySelector('#developer-toggle');
    const devOptions = overlay.querySelector('#developer-options');
    devToggle.checked = state.settings.developer;
    devOptions.style.display = state.settings.developer ? 'block' : 'none';

    devToggle.addEventListener('change', (e) => {
        state.settings.developer = e.target.checked;
        devOptions.style.display = e.target.checked ? 'block' : 'none';
        saveConfig();
    });

    // Renderer settings
    const resolutionInput = overlay.querySelector('#resolution-input');
    resolutionInput.value = state.settings.renderer.resolution;
    resolutionInput.addEventListener('change', (e) => {
        state.settings.renderer.resolution = Number(e.target.value) || 1;
        saveConfig();
    });

    const antialiasToggle = overlay.querySelector('#antialias-toggle');
    antialiasToggle.checked = state.settings.renderer.antialias;
    antialiasToggle.addEventListener('change', (e) => {
        state.settings.renderer.antialias = e.target.checked;
        saveConfig();
    });

    const autoDensityToggle = overlay.querySelector('#autodensity-toggle');
    autoDensityToggle.checked = state.settings.renderer.autoDensity;
    autoDensityToggle.addEventListener('change', (e) => {
        state.settings.renderer.autoDensity = e.target.checked;
        saveConfig();
    });

    const gpuSelect = overlay.querySelector('#gpu-select');
    gpuSelect.value = state.settings.renderer.powerPreference;
    gpuSelect.addEventListener('change', (e) => {
        state.settings.renderer.powerPreference = e.target.value;
        saveConfig();
    });

    const mappingDisplay = overlay.querySelector('#mapping-display');
    function refreshMapping() {
        const m = input.getMappings();
        mappingDisplay.innerHTML = '<div style="font-size:13px;color:var(--muted)">Key mappings: ' + Object.entries(m.keys).map(k => `${k[0]}→${k[1]}`).join(', ') + '</div>' +
            '<div style="font-size:13px;color:var(--muted)">Gamepad mappings: ' + Object.entries(m.gp).map(k => `${k[0]}→${k[1]}`).join(', ') + '</div>';
    }
    refreshMapping();

    overlay.querySelector('#remap-btn').addEventListener('click', () => openRemapDialog());
    overlay.querySelector('#calibrate-btn').addEventListener('click', () => openCalibrationDialog());
    overlay.querySelector('#close-settings').addEventListener('click', () => showScreen('menu'));

    async function openCalibrationDialog() {
        const dlg = document.createElement('div'); dlg.classList.add('panel');
        dlg.innerHTML = `<div class="menu-title">Latency Calibration</div>
            <div style="font-size:13px;color:var(--muted);margin-bottom:8px">This will play a short series of clicks. When you hear each click, press any key (or gamepad button) as quickly as you can. The average difference will be used as your latency setting.</div>
            <div id="calib-status" style="margin-bottom:8px">Ready</div>
            <div id="calib-results" style="font-size:13px;color:var(--muted);margin-bottom:8px"></div>
            <div><button class="button" id="start-calib">Start</button> <button class="button ghost" id="retry-calib">Retry</button> <button class="button ghost" id="close-calib">Back</button></div>`;
        screens.settings.appendChild(dlg);
        const status = dlg.querySelector('#calib-status');
        const startBtn = dlg.querySelector('#start-calib');
        const retryBtn = dlg.querySelector('#retry-calib');
        const results = dlg.querySelector('#calib-results');
        dlg.querySelector('#close-calib').addEventListener('click', () => { dlg.remove(); });

        async function runCalibration() {
            startBtn.disabled = true; retryBtn.disabled = true;
            results.innerHTML = '';
            status.textContent = 'Calibrating... play clicks and press any key when you hear them.';
            const measured = await calibrateLatency();
            if (!measured) {
                status.textContent = 'No presses detected. Try again.';
                results.innerHTML = '';
            } else {
                const { avg, deltas, clicks, presses } = measured;
                status.textContent = `Measured latency: ${avg} ms — review below and apply.`;
                // show detailed per-click table with checkboxes and histogram
                results.innerHTML = `
                    <div style="margin-bottom:6px">Per-click results (pressTime - clickTime in ms). Uncheck any outliers and click Apply.</div>
                    <div id="calib-table" style="max-width:420px;max-height:160px;overflow:auto;border-radius:6px;padding:6px;background:rgba(255,255,255,0.01)"></div>
                    <canvas id="calib-hist" width="420" height="80" style="display:block;margin-top:8px;border-radius:6px;background:rgba(0,0,0,0.06)"></canvas>
                    <div style="margin-top:8px"><button class="button" id="apply-calib">Apply</button></div>
                `;
                const table = results.querySelector('#calib-table');
                const hist = results.querySelector('#calib-hist');
                // build rows
                const include = new Array(deltas.length).fill(true);
                function renderRows() {
                    table.innerHTML = '';
                    for (let i = 0; i < deltas.length; i++) {
                        const row = document.createElement('div');
                        row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.alignItems = 'center'; row.style.padding = '6px';
                        const left = document.createElement('div'); left.style.fontSize = '12px'; left.style.color = 'var(--muted)';
                        left.innerHTML = `#${i + 1} &nbsp; Click: ${Math.round(clicks[i])} ms<br/>Press: ${Math.round(presses[i])} ms`;
                        const right = document.createElement('div');
                        right.innerHTML = `<label style=\"font-size:13px;color:var(--muted)\">Delta: <strong style=\"color:#fff\">${deltas[i]}</strong></label> `;
                        const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = include[i]; chk.style.marginLeft = '8px';
                        chk.addEventListener('change', () => { include[i] = chk.checked; renderHistogram(); });
                        right.appendChild(chk);
                        row.appendChild(left); row.appendChild(right); table.appendChild(row);
                    }
                }
                function renderHistogram() {
                    const ctx = hist.getContext('2d');
                    ctx.clearRect(0, 0, hist.width, hist.height);
                    const vals = deltas.filter((_, i) => include[i]);
                    if (!vals.length) return;
                    // simple bins
                    const min = Math.min(...vals); const max = Math.max(...vals);
                    const bins = 8; const range = Math.max(1, max - min);
                    const counts = new Array(bins).fill(0);
                    for (const v of vals) {
                        const idx = Math.min(bins - 1, Math.floor((v - min) / range * bins));
                        counts[idx]++;
                    }
                    const maxc = Math.max(...counts);
                    const barW = hist.width / bins;
                    for (let i = 0; i < bins; i++) {
                        const h = (counts[i] / (maxc || 1)) * hist.height;
                        ctx.fillStyle = 'rgba(110,231,183,0.9)';
                        ctx.fillRect(i * barW + 2, hist.height - h, barW - 4, h);
                    }
                    // draw avg line
                    const includedVals = vals;
                    const avgNow = Math.round(includedVals.reduce((a, b) => a + b, 0) / includedVals.length);
                    const avgX = ((avgNow - min) / range) * hist.width;
                    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.moveTo(avgX, 0); ctx.lineTo(avgX, hist.height); ctx.stroke();
                }
                renderRows(); renderHistogram();

                // apply button
                results.querySelector('#apply-calib').addEventListener('click', () => {
                    const vals = deltas.filter((_, i) => include[i]);
                    if (!vals.length) { status.textContent = 'No samples selected.'; return; }
                    const newAvg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
                    state.settings.latency = Number(newAvg) || 0;
                    latencyInput.value = state.settings.latency;
                    saveConfig();
                    status.textContent = `Applied latency: ${newAvg} ms`;
                });
            }
            startBtn.disabled = false; retryBtn.disabled = false;
        }

        startBtn.addEventListener('click', runCalibration);
        retryBtn.addEventListener('click', runCalibration);
    }

    function calibrateLatency() {
        return new Promise((resolve) => {
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return resolve(null);
                const ctx = new AudioCtx();
                const clicks = [];
                const presses = [];
                const N = 6; const interval = 700; const startDelay = 400;

                function playClick() {
                    const now = ctx.currentTime;
                    const o = ctx.createOscillator();
                    const g = ctx.createGain();
                    o.type = 'sine';
                    o.frequency.value = 1500 + Math.random() * 200;
                    g.gain.setValueAtTime(0.0001, now);
                    g.gain.linearRampToValueAtTime(0.08, now + 0.001);
                    g.gain.linearRampToValueAtTime(0.0001, now + 0.04);
                    o.connect(g); g.connect(ctx.destination);
                    o.start(now);
                    o.stop(now + 0.045);
                    // record the approximate wall-clock time of play
                    clicks.push(performance.now());
                }

                function onKey(e) { if (e.repeat) return; presses.push(performance.now()); }
                window.addEventListener('keydown', onKey);

                // simple gamepad poll for button edges
                let gpPrev = [];
                const gpPoll = setInterval(() => {
                    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
                    for (let i = 0; i < gps.length; i++) {
                        const g = gps[i]; if (!g) continue;
                        if (!gpPrev[i]) gpPrev[i] = [];
                        for (let b = 0; b < g.buttons.length; b++) {
                            const pressed = !!g.buttons[b].pressed;
                            if (pressed && !gpPrev[i][b]) { presses.push(performance.now()); }
                            gpPrev[i][b] = pressed;
                        }
                    }
                }, 40);

                // schedule clicks using WebAudio scheduling to be consistent
                for (let i = 0; i < N; i++) {
                    const t = startDelay + i * interval;
                    setTimeout(() => { try { if (ctx.state === 'suspended') ctx.resume(); playClick(); } catch (e) { /* ignore */ } }, t);
                }

                // finish after last click + buffer
                setTimeout(() => {
                    window.removeEventListener('keydown', onKey);
                    clearInterval(gpPoll);
                    try { ctx.close(); } catch (e) { /* ignore */ }
                    const pairs = Math.min(clicks.length, presses.length);
                    if (pairs === 0) return resolve(null);
                    const deltas = [];
                    let sum = 0;
                    for (let i = 0; i < pairs; i++) {
                        const d = Math.round(presses[i] - clicks[i]);
                        deltas.push(d);
                        sum += d;
                    }
                    const avg = Math.round(sum / pairs);
                    // return clicks and presses arrays for more detailed UX
                    resolve({ avg, deltas, clicks, presses });
                }, startDelay + N * interval + 500);
            } catch (e) { console.warn('Calibration failed', e); resolve(null); }
        });
    }

    async function openRemapDialog() {
        const dlg = document.createElement('div'); dlg.classList.add('panel');
        dlg.innerHTML = `<div class="menu-title">Remap Inputs</div><div id="zone-list"></div><div style="margin-top:8px"><button class="button ghost" id="close-remap">Close</button></div>`;
        uiRoot.appendChild(dlg);
        const zoneList = dlg.querySelector('#zone-list');
        // show 6 zones
        for (let z = 0; z < 6; z++) {
            const row = document.createElement('div'); row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.alignItems = 'center'; row.style.padding = '6px 0';
            const label = document.createElement('div'); label.textContent = `Zone ${z}`;
            const btn = document.createElement('button'); btn.className = 'button ghost'; btn.textContent = 'Remap';
            btn.addEventListener('click', async () => {
                btn.textContent = 'Press a key or button...';
                try {
                    const res = await input.startRemap(z);
                    btn.textContent = res.type === 'key' ? `Key: ${res.key}` : `GP btn: ${res.button}`;
                    refreshMapping();
                    // persist mapping immediately
                    saveConfig();
                } catch (e) { btn.textContent = 'Remap'; }
            });
            row.appendChild(label); row.appendChild(btn); zoneList.appendChild(row);
        }
        dlg.querySelector('#close-remap').addEventListener('click', () => dlg.remove());
    }
}

function openEditor() {
    screens.editor.innerHTML = '';
    const editor = new ChartEditor();
    screens.editor.appendChild(editor.getElement());
    showScreen('editor');
}

function resetToMenu() {
    // show the main menu screen
    showScreen('menu');
}

async function startGame({ song = null, chart = null } = {}) {
    // Stop menu music if playing
    try {
        if (window.__dsx && window.__dsx.menu && window.__dsx.menu.visualizer && window.__dsx.menu.visualizer.isPlaying) {
            window.__dsx.menu.visualizer.togglePlayPause();
        }
    } catch (err) { /* ignore */ }

    // hide UI screens while playing
    showScreen(null);

    // Configure game root based on scaling setting
    const scaling = state.settings.scaling || 'fit';
    gameRoot.style.display = 'flex';
    gameRoot.style.alignItems = scaling === 'fill' ? 'flex-start' : 'center';
    gameRoot.style.justifyContent = scaling === 'fill' ? 'flex-start' : 'center';
    gameRoot.style.overflow = scaling === 'fill' ? 'hidden' : 'visible';

    // Create gameplay instance with renderer options
    gameplay = new Gameplay({
        parent: gameRoot,
        input,
        settings: {
            ...state.settings,
            renderer: {
                ...state.settings.renderer,
                // Only apply renderer settings in developer mode
                resolution: state.settings.developer ? state.settings.renderer.resolution : 1,
                antialias: state.settings.developer ? state.settings.renderer.antialias : true,
                autoDensity: state.settings.developer ? state.settings.renderer.autoDensity : true,
                powerPreference: state.settings.developer ? state.settings.renderer.powerPreference : 'high-performance'
            }
        }
    });
    await gameplay.loadSong(song, chart);
    gameplay.start();
}

// expose for debug
window.__dsx = { state, input };
