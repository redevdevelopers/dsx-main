export class VolumeManager {
    constructor() {
        this.volumes = {
            master: 1.0,
            music: 1.0,
            effects: 1.0
        };

        // allow disabling wheel-based volume control via settings
        this.wheelEnabled = true;

        this.activeControl = 'master'; // Default active volume control
        this.setupVolumeUI();
        this.setupControls();

        // Store callbacks for volume changes
        this.onVolumeChange = {
            master: () => { },
            music: () => { },
            effects: () => { }
        };
    }

    setupVolumeUI() {
        // Create volume overlay container
        this.container = document.createElement('div');
        this.container.className = 'volume-overlay';
        document.body.appendChild(this.container);

        // Create volume controls
        const controls = [
            { id: 'master', label: 'Master', color: '#fff' },
            { id: 'music', label: 'Music', color: '#6ee7b7' },
            { id: 'effects', label: 'Effects', color: '#ff6fd8' }
        ];

        controls.forEach(({ id, label, color }) => {
            const control = document.createElement('div');
            control.className = 'volume-control';
            control.innerHTML = `
                <div class="volume-label">
                    <span>${label}</span>
                    <span class="volume-percentage">100%</span>
                </div>
                <div class="volume-bar">
                    <div class="volume-fill" style="background: ${color}"></div>
                </div>
            `;
            this.container.appendChild(control);

            // Store elements for easy access
            this[`${id}Bar`] = control.querySelector('.volume-fill');
            this[`${id}Text`] = control.querySelector('.volume-percentage');
        });

        // Hide initially
        this.hideTimeout = null;
        this.container.style.opacity = '0';
        this.container.style.transform = 'translateY(-50%) translateX(10px)';
        this.container.style.visibility = 'hidden';  // Start hidden
    }

    setupControls() {
        // Mouse wheel control
        window.addEventListener('wheel', (e) => {
            if (!this.wheelEnabled) return;
            e.preventDefault();

            // Show volume overlay
            this.container.style.visibility = 'visible';
            this.container.style.opacity = '1';
            this.container.style.transform = 'translateY(-50%) translateX(0)';

            // Clear previous hide timeout
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
            }

            // Determine volume change
            const delta = -Math.sign(e.deltaY) * 0.05;

            // Modify volume based on held keys
            if (e.altKey) {
                this.setVolume('effects', this.volumes.effects + delta);
            } else if (e.shiftKey) {
                this.setVolume('music', this.volumes.music + delta);
            } else {
                this.setVolume('master', this.volumes.master + delta);
            }

            // Hide after delay
            this.hideTimeout = setTimeout(() => {
                this.container.style.opacity = '0';
                this.container.style.transform = 'translateY(-50%) translateX(10px)';
                // Hide completely after transition ends
                setTimeout(() => {
                    if (this.container.style.opacity === '0') {
                        this.container.style.visibility = 'hidden';
                    }
                }, 300);
            }, 1000);
        }, { passive: false });

        // Key bindings for changing active control
        window.addEventListener('keydown', (e) => {
            switch (e.key.toLowerCase()) {
                case 'm':
                    this.activeControl = 'master';
                    break;
                case 'u':
                    this.activeControl = 'music';
                    break;
                case 'e':
                    this.activeControl = 'effects';
                    break;
            }
        });
    }

    setVolume(type, value) {
        // Clamp value between 0 and 1
        value = Math.max(0, Math.min(1, value));
        this.volumes[type] = value;

        // Update UI
        this[`${type}Bar`].style.width = `${value * 100}%`;
        this[`${type}Text`].textContent = `${Math.round(value * 100)}%`;

        // Call volume change callback
        this.onVolumeChange[type](value);
    }

    getVolume(type) {
        return this.volumes[type];
    }

    getMasterScaledVolume(type) {
        return this.volumes[type] * this.volumes.master;
    }

    // Enable or disable wheel-based control
    enableWheel(enabled) {
        this.wheelEnabled = !!enabled;
    }

    isWheelEnabled() { return !!this.wheelEnabled; }
}