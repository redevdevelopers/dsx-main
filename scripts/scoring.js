export class ScoreSystem {
    constructor() {
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.hits = 0;
        this.grades = { perfect: 0, great: 0, good: 0, miss: 0 };
    }

    addHit(points) {
        this.score += points;
        this.combo += 1;
        this.hits += 1;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    }

    registerGrade(grade) {
        if (!this.grades[grade]) this.grades[grade] = 0;
        this.grades[grade] += 1;
        if (grade === 'miss') this.combo = 0;
    }

    miss() {
        this.combo = 0;
        this.registerGrade('miss');
    }

    getAccuracy() {
        // Weighted accuracy calculation
        const totalHits = this.hits + (this.grades.miss || 0);
        if (!totalHits) return 0;

        // Weight perfect hits more heavily for SSS+ potential
        const weights = {
            perfect: 1,
            great: 0.8,
            good: 0.5,
            miss: 0
        };

        let weighted = 0;
        let total = 0;

        for (const [grade, weight] of Object.entries(weights)) {
            const count = this.grades[grade] || 0;
            weighted += count * weight;
            total += count;
        }

        // Round to 2 decimal places for more precise grade boundaries
        return Number((100 * (weighted / total)).toFixed(2));
    }
}
