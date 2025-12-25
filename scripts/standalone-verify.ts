import Decimal from 'decimal.js';

// --- Logic ---

const solveEMV = (payoffs: Decimal[][], alternatives: string[], probabilities: Decimal[]) => {
    let bestScore = new Decimal(-Infinity);
    let bestAltIndex = -1;
    payoffs.forEach((row, rIdx) => {
        let emv = new Decimal(0);
        row.forEach((val, cIdx) => {
            emv = emv.plus(val.mul(probabilities[cIdx]));
        });
        if (emv.gt(bestScore)) {
            bestScore = emv;
            bestAltIndex = rIdx;
        } else if (bestAltIndex === -1) {
            bestScore = emv;
            bestAltIndex = rIdx;
        }
    });
    return { recommendedAlternative: alternatives[bestAltIndex], bestValue: bestScore.toString() };
};

const solveLaplace = (payoffs: Decimal[][], alternatives: string[]) => {
    let bestScore = new Decimal(-Infinity);
    let bestAltIndex = -1;
    const numStates = new Decimal(payoffs[0].length);
    payoffs.forEach((row, rIdx) => {
        let sum = new Decimal(0);
        row.forEach(val => sum = sum.plus(val));
        const avg = sum.div(numStates);
        if (avg.gt(bestScore)) {
            bestScore = avg;
            bestAltIndex = rIdx;
        } else if (bestAltIndex === -1) {
            bestScore = avg;
            bestAltIndex = rIdx;
        }
    });
    return { recommendedAlternative: alternatives[bestAltIndex], bestValue: bestScore.toString() };
};

const solveHurwicz = (payoffs: Decimal[][], alternatives: string[], alpha: Decimal) => {
    let bestScore = new Decimal(-Infinity);
    let bestAltIndex = -1;
    const oneMinusAlpha = new Decimal(1).minus(alpha);
    payoffs.forEach((row, rIdx) => {
        let maxVal = new Decimal(-Infinity);
        let minVal = new Decimal(Infinity);
        row.forEach(val => {
            if (val.gt(maxVal)) maxVal = val;
            if (val.lt(minVal)) minVal = val;
        });
        const score = alpha.mul(maxVal).plus(oneMinusAlpha.mul(minVal));
        if (score.gt(bestScore)) {
            bestScore = score;
            bestAltIndex = rIdx;
        } else if (bestAltIndex === -1) {
            bestScore = score;
            bestAltIndex = rIdx;
        }
    });
    return { recommendedAlternative: alternatives[bestAltIndex], bestValue: bestScore.toString() };
};

const solveEVPI = (payoffs: Decimal[][], alternatives: string[], probabilities: Decimal[]) => {
    const emvRes = solveEMV(payoffs, alternatives, probabilities);
    const bestEMV = new Decimal(emvRes.bestValue);
    let evwpi = new Decimal(0);
    const numStates = payoffs[0].length;
    for (let c = 0; c < numStates; c++) {
        let maxInState = new Decimal(-Infinity);
        for (let r = 0; r < payoffs.length; r++) {
            if (payoffs[r][c].gt(maxInState)) maxInState = payoffs[r][c];
        }
        evwpi = evwpi.plus(maxInState.mul(probabilities[c]));
    }
    return { bestValue: evwpi.minus(bestEMV).toString() };
};

// --- Tests ---
const assert = (condition: boolean, msg: string) => {
    if (!condition) {
        console.error(`❌ FAIL: ${msg}`);
        process.exit(1);
    } else {
        console.log(`✅ PASS: ${msg}`);
    }
};

const alternatives = ["A", "B", "C"];
const payoffs = [
    [new Decimal("100"), new Decimal("0")],
    [new Decimal("50"), new Decimal("50")],
    [new Decimal("20"), new Decimal("80")]
];
const probs = [new Decimal("0.6"), new Decimal("0.4")];

console.log("--- Standalone Logic Verification ---");

const laplace = solveLaplace(payoffs, alternatives);
assert(laplace.bestValue === "50", "Laplace should be 50");

const hurwicz = solveHurwicz(payoffs, alternatives, new Decimal("0.7"));
assert(hurwicz.bestValue === "70", "Hurwicz (0.7) should be 70");

const evpi = solveEVPI(payoffs, alternatives, probs);
assert(evpi.bestValue === "32", "EVPI should be 32");

console.log("🎉 LOGIC VERIFIED");
