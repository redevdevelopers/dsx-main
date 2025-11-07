// Grade thresholds and rewards system
export const GRADES = {
    'SSS+': { minAcc: 100, color: 0xffe86b, reward: 1000, description: 'Perfect!', title: 'YOU DESERVED THIS CONGRATS!!!' },
    'SSS': { minAcc: 99.5, color: 0xffd700, reward: 800, description: 'Phenomenal!', title: 'BETTER THAN NOTHING!' },
    'SS': { minAcc: 98, color: 0xff9ef0, reward: 600, description: 'Incredible!', title: 'NICE TRY!' },
    'S': {
        minAcc: 95, color: 0x9ef0ff, reward: 500, description: 'Excellent!', title: 'YOU ARE SKILLED!'
    },
    'A': { minAcc: 90, color: 0x6ee7b7, reward: 400, description: 'Great!', title: 'NOT BAD NOT PERFECT. GOOD ONE!' },
    'B': { minAcc: 80, color: 0xa8d7ff, reward: 300, description: 'Good!', title: 'ATLEAST YOU TRIED!' },
    'C': { minAcc: 70, color: 0xff9ea8, reward: 200, description: 'Decent', title: 'TRAIN MORE :D' },
    'D': { minAcc: 60, color: 0xff7b7b, reward: 100, description: 'Pass', title: 'AWW MAN' },
    'F': { minAcc: 0, color: 0x888888, reward: 0, description: 'Failed', title: 'ASS' }
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