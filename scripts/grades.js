// Grade thresholds and rewards system
export const GRADES = {
    'SSS+': { minAcc: 100, color: 0xffe86b, reward: 1000, description: 'Perfect!', title: 'Absolute Perfection' },
    'SSS': { minAcc: 99.5, color: 0xffd700, reward: 800, description: 'Phenomenal!', title: 'Masterful Performance' },
    'SS': { minAcc: 98, color: 0xff9ef0, reward: 600, description: 'Incredible!', title: 'Elite Performance' },
    'S': { minAcc: 95, color: 0x9ef0ff, reward: 500, description: 'Excellent!', title: 'Superior Performance' },
    'A': { minAcc: 90, color: 0x6ee7b7, reward: 400, description: 'Great!', title: 'Advanced Performance' },
    'B': { minAcc: 80, color: 0xa8d7ff, reward: 300, description: 'Good!', title: 'Skilled Performance' },
    'C': { minAcc: 70, color: 0xff9ea8, reward: 200, description: 'Decent', title: 'Standard Performance' },
    'D': { minAcc: 60, color: 0xff7b7b, reward: 100, description: 'Pass', title: 'Basic Performance' },
    'F': { minAcc: 0, color: 0x888888, reward: 0, description: 'Failed', title: 'Practice More' }
};

export function calculateGrade(accuracy) {
    for (const [grade, data] of Object.entries(GRADES)) {
        if (accuracy >= data.minAcc) return { grade, ...data };
    }
    return { grade: 'F', ...GRADES['F'] };
}

// Format large numbers with commas
export function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Calculate total score with grade bonus
export function calculateFinalScore(baseScore, grade) {
    const gradeData = GRADES[grade] || GRADES['F'];
    return Math.round(baseScore + gradeData.reward);
}