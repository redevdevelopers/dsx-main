// Minimal remappable input handler

export class InputHandler {
    constructor(state) {
        this.state = state || {};
        this.inverted = false;
        this.gamepadIndex = null;
        this.polling = false;

        this.keyMap = Object.assign({}, (this.state.inputMap && this.state.inputMap.keys) || { 'j': 2, 'y': 0, 't': 5, 'u': 1, 'h': 3, 'g': 4 });
        this.keyMap = Object.assign({}, (this.state.inputMap && this.state.inputMap.keys) || { 'P': 2, 'W': 0, 'Q': 5, 'E': 1, 'O': 3, 'I': 4 });
        this.gpMap = Object.assign({}, (this.state.inputMap && this.state.inputMap.gp) || { '4': 2, '3': 0, '5': 5, '2': 1, '1': 3, '0': 4 });

        this.pressedKeys = new Set();
        this.keyDownBuffer = new Set();
        this.gpButtonPrev = {};
        this.gpButtonBuffer = new Set();

        this.remapActive = false;
        this.remapTarget = null;
        this.remapResolve = null;

        this._setupKeyboard();
        this._setupGamepadListeners();
    }

    setInverted(v) { this.inverted = !!v; }

    _setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            const k = e.key;
            if (!this.pressedKeys.has(k)) this.keyDownBuffer.add(k);
            this.pressedKeys.add(k);
            if (this.remapActive && this.remapResolve) {
                this.keyMap[k.toLowerCase()] = this.remapTarget;
                const resolve = this.remapResolve; this._endRemap(); resolve({ type: 'key', key: k.toLowerCase() });
            }
        });
        window.addEventListener('keyup', (e) => { this.pressedKeys.delete(e.key); });
    }

    _setupGamepadListeners() {
        window.addEventListener('gamepadconnected', (e) => {
            this.gamepadIndex = e.gamepad.index;
            if (!this.polling) this._startPolling();
        });
        window.addEventListener('gamepaddisconnected', (e) => { if (this.gamepadIndex === e.gamepad.index) this.gamepadIndex = null; });
    }

    _startPolling() {
        this.polling = true;
        const poll = () => {
            if (!this.polling) return;
            const pads = navigator.getGamepads ? navigator.getGamepads() : [];
            const gp = pads[this.gamepadIndex] || pads[0];
            if (gp && gp.buttons) {
                gp.buttons.forEach((b, idx) => {
                    const pressed = !!(b && b.pressed);
                    const prev = !!this.gpButtonPrev[idx];
                    if (pressed && !prev) {
                        this.gpButtonBuffer.add(String(idx));
                        if (this.remapActive && this.remapResolve) {
                            this.gpMap[String(idx)] = this.remapTarget;
                            const resolve = this.remapResolve; this._endRemap(); resolve({ type: 'gp', button: idx });
                        }
                    }
                    this.gpButtonPrev[idx] = pressed;
                });
            }
            requestAnimationFrame(poll);
        };
        requestAnimationFrame(poll);
    }

    getPressedZones() {
        const zones = new Set();
        for (const k of this.keyDownBuffer) {
            const key = k.toLowerCase(); if (this.keyMap.hasOwnProperty(key)) zones.add(this.keyMap[key]);
        }
        for (const b of this.gpButtonBuffer) { if (this.gpMap.hasOwnProperty(b)) zones.add(this.gpMap[b]); }
        this.keyDownBuffer.clear(); this.gpButtonBuffer.clear();
        return Array.from(zones);
    }

    getMappings() { return { keys: Object.assign({}, this.keyMap), gp: Object.assign({}, this.gpMap) }; }

    startRemap(zone) {
        if (this.remapActive) return Promise.reject(new Error('Remapping already active'));
        this.remapActive = true; this.remapTarget = zone;
        return new Promise((resolve) => { this.remapResolve = resolve; });
    }

    _endRemap() { this.remapActive = false; this.remapTarget = null; this.remapResolve = null; }

    resetBuffers() { this.keyDownBuffer.clear(); this.gpButtonBuffer.clear(); }
}

