// Chart parsing and validation
export class ChartData {
    constructor(rawData) {
        this.raw = rawData;
        this.validate();
        this.processTimingData();
    }

    validate() {
        // Required fields
        const required = {
            meta: ['title', 'bpm'],
            timing: ['offset'],
            notes: []
        };

        for (const [section, fields] of Object.entries(required)) {
            if (!this.raw[section]) throw new Error(`Missing required section: ${section}`);
            for (const field of fields) {
                if (this.raw[section][field] === undefined) {
                    throw new Error(`Missing required field: ${section}.${field}`);
                }
            }
        }

        // Validate notes
        if (!Array.isArray(this.raw.notes)) {
            throw new Error('Notes must be an array');
        }

        this.raw.notes.forEach((note, i) => {
            if (note.time === undefined) throw new Error(`Note ${i} missing time`);
            if (note.zone === undefined) throw new Error(`Note ${i} missing zone`);

            // Validate note types and their required data
            if (note.type) {
                switch (note.type) {
                    case 'hold':
                        if (!note.hold?.duration) throw new Error(`Hold note ${i} missing duration`);
                        break;
                    case 'chain':
                        if (!note.chainData?.length || !note.chainData?.interval) {
                            throw new Error(`Chain note ${i} missing chain data`);
                        }
                        break;
                    case 'multi':
                        if (!Array.isArray(note.zone)) {
                            throw new Error(`Multi note ${i} zone must be array`);
                        }
                        break;
                }
            }
        });
    }

    processTimingData() {
        // Process BPM changes
        this.bpmChanges = (this.raw.timing?.bpmChanges || [{ time: 0, bpm: this.raw.meta.bpm.init || this.raw.meta.bpm }])
            .sort((a, b) => a.time - b.time);

        // Process time signatures
        this.timeSignatures = (this.raw.timing?.timeSignatures || [{ time: 0, numerator: 4, denominator: 4 }])
            .sort((a, b) => a.time - b.time);

        // Calculate beat timings if BPM changes exist
        this.beatMap = new Map();
        let currentBPM = this.bpmChanges[0].bpm;
        let lastTime = 0;

        // Determine a reasonable end time for beat map generation
        const lastNoteTime = this.raw.notes.length > 0 ? Math.max(...this.raw.notes.map(n => n.time)) : 300000; // Default to 5 minutes if no notes
        const chartEndTime = lastNoteTime + 10000; // 10 seconds after last note

        this.bpmChanges.forEach((change, i) => {
            const nextChange = this.bpmChanges[i + 1];
            const endTime = nextChange ? nextChange.time : chartEndTime;

            // Map beats in this BPM section
            let time = change.time;
            const msPerBeat = 60000 / change.bpm;

            if (!isFinite(msPerBeat) || msPerBeat <= 0) {
                console.warn(`Invalid BPM value (${change.bpm}) at time ${change.time}. Skipping this BPM segment.`);
                return;
            }

            while (time < endTime) {
                this.beatMap.set(time, {
                    beat: (time - change.time) / msPerBeat,
                    bpm: change.bpm
                });
                time += msPerBeat;
            }

            currentBPM = change.bpm;
            lastTime = change.time;
        });
    }

    getNotesInRange(startTime, endTime) {
        return this.raw.notes.filter(n => n.time >= startTime && n.time < endTime);
    }

    getBPMAtTime(time) {
        // Find the last BPM change before this time
        for (let i = this.bpmChanges.length - 1; i >= 0; i--) {
            if (this.bpmChanges[i].time <= time) return this.bpmChanges[i].bpm;
        }
        return this.bpmChanges[0].bpm;
    }

    getSectionAtTime(time) {
        if (!this.raw.sections) return null;
        return this.raw.sections.find(s => time >= s.startTime && time < s.endTime);
    }

    getBeatInfo(time) {
        // Find closest beat in beatMap
        let closestTime = Array.from(this.beatMap.keys())
            .reduce((prev, curr) =>
                Math.abs(curr - time) < Math.abs(prev - time) ? curr : prev
            );

        return this.beatMap.get(closestTime);
    }

    // Get note counts by type for statistics
    getNoteStats() {
        const stats = {
            total: this.raw.notes.length,
            regular: 0,
            hold: 0,
            chain: 0,
            multi: 0
        };

        this.raw.notes.forEach(note => {
            if (!note.type || note.type === 'regular') stats.regular++;
            else stats[note.type]++;
        });

        return stats;
    }

    // Calculate approximate difficulty rating
    calculateDifficulty() {
        if (this.raw.meta.difficulty) return this.raw.meta.difficulty;

        // Simple difficulty calculation based on:
        // - Note density
        // - Type complexity
        // - BPM changes
        // - Multi-note frequency

        const duration = Math.max(...this.raw.notes.map(n => n.time)) / 1000; // seconds
        const noteStats = this.getNoteStats();

        const densityScore = noteStats.total / duration * 0.8;
        const complexityScore = (
            (noteStats.hold * 1.2) +
            (noteStats.chain * 1.5) +
            (noteStats.multi * 2)
        ) / noteStats.total * 5;

        const bpmChangeScore = this.bpmChanges.length > 1 ?
            Math.min(2, this.bpmChanges.length * 0.5) : 0;

        return Math.round(
            Math.min(15, Math.max(1,
                densityScore +
                complexityScore +
                bpmChangeScore
            ))
        );
    }
}