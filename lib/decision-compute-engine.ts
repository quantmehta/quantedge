import { Decimal, toDecimal } from './decimal-utils';

export enum Criterion {
    MAXIMAX = 'MAXIMAX',
    MAXIMIN = 'MAXIMIN',
    EMV = 'EMV',
    MINIMAX_REGRET = 'MINIMAX_REGRET',
    // Phase 2
    LAPLACE = 'LAPLACE',
    HURWICZ = 'HURWICZ',
    EVWPI_EVPI = 'EVWPI_EVPI',
}

export interface DecisionPayload {
    criterion: Criterion;
    alternatives: string[];
    states: string[];
    payoffs: string[][]; // Row: Alternative, Col: State. Passed as strings to preserve precision
    probabilities?: string[]; // Required for EMV, EVwPI
    alpha?: string; // Required for Hurwicz
}

export interface ComputeResult {
    recommendedAlternative: string;
    bestValue: string; // Decimal string
    scores: { alternative: string; score: string }[];
    trace: string; // Markdown formatted explanation
    debug?: any;  // regrex matrix etc
}

// --- Algorithms ---

const solveMaximax = (payoffs: Decimal[][], alternatives: string[]): ComputeResult => {
    let bestScore = new Decimal(-Infinity);
    let bestAltIndex = -1;
    const scores: { alternative: string; score: string }[] = [];

    let trace = "### Optimistic Calculation (Maximax)\n\n";
    trace += "| Alternative | Max Payoff |\n|---|---|\n";

    payoffs.forEach((row, rIdx) => {
        let maxVal = new Decimal(-Infinity);
        row.forEach(val => {
            if (val.gt(maxVal)) maxVal = val;
        });

        scores.push({ alternative: alternatives[rIdx], score: maxVal.toString() });
        trace += `| ${alternatives[rIdx]} | ${maxVal.toString()} |\n`;

        // Strict > means we keep the first one in case of ties (earliest index rule)
        if (maxVal.gt(bestScore)) {
            bestScore = maxVal;
            bestAltIndex = rIdx;
        } else if (bestAltIndex === -1) {
            // First iteration
            bestScore = maxVal;
            bestAltIndex = rIdx;
        }
    });

    return {
        recommendedAlternative: alternatives[bestAltIndex],
        bestValue: bestScore.toString(),
        scores,
        trace: trace + `\n**Recommendation**: ${alternatives[bestAltIndex]} with max payoff of ${bestScore.toString()}`
    };
};

const solveMaximin = (payoffs: Decimal[][], alternatives: string[]): ComputeResult => {
    let bestScore = new Decimal(-Infinity);
    let bestAltIndex = -1;
    const scores: { alternative: string; score: string }[] = [];

    let trace = "### Conservative Calculation (Maximin)\n\n";
    trace += "| Alternative | Min Payoff |\n|---|---|\n";

    payoffs.forEach((row, rIdx) => {
        let minVal = new Decimal(Infinity);
        row.forEach(val => {
            if (val.lt(minVal)) minVal = val;
        });

        scores.push({ alternative: alternatives[rIdx], score: minVal.toString() });
        trace += `| ${alternatives[rIdx]} | ${minVal.toString()} |\n`;

        // We want to Maximize the Minimum
        if (minVal.gt(bestScore)) {
            bestScore = minVal;
            bestAltIndex = rIdx;
        } else if (bestAltIndex === -1) {
            bestScore = minVal;
            bestAltIndex = rIdx;
        }
    });

    return {
        recommendedAlternative: alternatives[bestAltIndex],
        bestValue: bestScore.toString(),
        scores,
        trace: trace + `\n**Recommendation**: ${alternatives[bestAltIndex]} with guaranteed minimum of ${bestScore.toString()}`
    };
};

const solveEMV = (payoffs: Decimal[][], alternatives: string[], probabilities: Decimal[]): ComputeResult => {
    let bestScore = new Decimal(-Infinity);
    let bestAltIndex = -1;
    const scores: { alternative: string; score: string }[] = [];

    let trace = "### Balanced Calculation (Expected Monetary Value)\n\n";
    trace += `**Probabilities**: [${probabilities.map(p => p.toString()).join(', ')}]\n\n`;
    trace += "| Alternative | Calculation | EMV |\n|---|---|---|\n";

    payoffs.forEach((row, rIdx) => {
        let emv = new Decimal(0);
        let calcParts: string[] = [];

        row.forEach((val, cIdx) => {
            const prob = probabilities[cIdx];
            const part = val.mul(prob);
            emv = emv.plus(part);
            calcParts.push(`${val}*${prob}`);
        });

        scores.push({ alternative: alternatives[rIdx], score: emv.toString() });
        trace += `| ${alternatives[rIdx]} | ${calcParts.join(' + ')} | ${emv.toString()} |\n`;

        if (emv.gt(bestScore)) {
            bestScore = emv;
            bestAltIndex = rIdx;
        } else if (bestAltIndex === -1) {
            bestScore = emv;
            bestAltIndex = rIdx;
        }
    });

    return {
        recommendedAlternative: alternatives[bestAltIndex],
        bestValue: bestScore.toString(),
        scores,
        trace: trace + `\n**Recommendation**: ${alternatives[bestAltIndex]} with EMV of ${bestScore.toString()}`
    };
};

const solveLaplace = (payoffs: Decimal[][], alternatives: string[], states: string[]): ComputeResult => {
    let bestScore = new Decimal(-Infinity);
    let bestAltIndex = -1;
    const scores: { alternative: string; score: string }[] = [];
    const numStates = new Decimal(states.length);

    let trace = "### Equally Likely Calculation (Laplace)\n\n";
    trace += "| Alternative | Calculation (Sum / n) | Average Payoff |\n|---|---|---|\n";

    payoffs.forEach((row, rIdx) => {
        let sum = new Decimal(0);
        row.forEach(val => sum = sum.plus(val));
        const avg = sum.div(numStates);

        scores.push({ alternative: alternatives[rIdx], score: avg.toString() });
        trace += `| ${alternatives[rIdx]} | ${sum.toString()} / ${numStates.toString()} | ${avg.toString()} |\n`;

        if (avg.gt(bestScore)) {
            bestScore = avg;
            bestAltIndex = rIdx;
        } else if (bestAltIndex === -1) {
            bestScore = avg;
            bestAltIndex = rIdx;
        }
    });

    return {
        recommendedAlternative: alternatives[bestAltIndex],
        bestValue: bestScore.toString(),
        scores,
        trace: trace + `\n**Recommendation**: ${alternatives[bestAltIndex]} with average payoff of ${bestScore.toString()}`
    };
};

const solveHurwicz = (payoffs: Decimal[][], alternatives: string[], alpha: Decimal): ComputeResult => {
    let bestScore = new Decimal(-Infinity);
    let bestAltIndex = -1;
    const scores: { alternative: string; score: string }[] = [];
    const oneMinusAlpha = new Decimal(1).minus(alpha);

    let trace = "### Coefficient of Optimism (Hurwicz)\n\n";
    trace += `**Alpha (α)**: ${alpha.toString()} (Optimism level)\n\n`;
    trace += "| Alternative | Max | Min | Calculation (α*Max + (1-α)*Min) | Hurwicz Score |\n|---|---|---|---|---|\n";

    payoffs.forEach((row, rIdx) => {
        let maxVal = new Decimal(-Infinity);
        let minVal = new Decimal(Infinity);
        row.forEach(val => {
            if (val.gt(maxVal)) maxVal = val;
            if (val.lt(minVal)) minVal = val;
        });

        const score = alpha.mul(maxVal).plus(oneMinusAlpha.mul(minVal));

        scores.push({ alternative: alternatives[rIdx], score: score.toString() });
        trace += `| ${alternatives[rIdx]} | ${maxVal.toString()} | ${minVal.toString()} | ${alpha.toString()}*${maxVal.toString()} + ${oneMinusAlpha.toString()}*${minVal.toString()} | ${score.toString()} |\n`;

        if (score.gt(bestScore)) {
            bestScore = score;
            bestAltIndex = rIdx;
        } else if (bestAltIndex === -1) {
            bestScore = score;
            bestAltIndex = rIdx;
        }
    });

    return {
        recommendedAlternative: alternatives[bestAltIndex],
        bestValue: bestScore.toString(),
        scores,
        trace: trace + `\n**Recommendation**: ${alternatives[bestAltIndex]} with Hurwicz score of ${bestScore.toString()}`
    };
};

const solveEVWPI_EVPI = (payoffs: Decimal[][], alternatives: string[], states: string[], probabilities: Decimal[]): ComputeResult => {
    // 1. Calculate EMV first
    const emvResult = solveEMV(payoffs, alternatives, probabilities);
    const bestEMV = new Decimal(emvResult.bestValue);

    // 2. Calculate EVwPI (Expected Value with Perfect Information)
    const numStates = states.length;
    let evwpi = new Decimal(0);

    for (let c = 0; c < numStates; c++) {
        let maxInState = new Decimal(-Infinity);
        for (let r = 0; r < payoffs.length; r++) {
            if (payoffs[r][c].gt(maxInState)) maxInState = payoffs[r][c];
        }
        const statePart = maxInState.mul(probabilities[c]);
        evwpi = evwpi.plus(statePart);
    }

    // 3. EVPI = EVwPI - Max(EMV)
    const evpi = evwpi.minus(bestEMV);

    let trace = "### Perfect Information Analysis (EVPI)\n\n";
    trace += "#### Step 1: Expected Value with Perfect Information (EVwPI)\n";
    trace += "| State | Best Payoff | Prob | Weight |\n|---|---|---|---|\n";
    for (let c = 0; c < numStates; c++) {
        let maxInState = new Decimal(-Infinity);
        for (let r = 0; r < payoffs.length; r++) {
            if (payoffs[r][c].gt(maxInState)) maxInState = payoffs[r][c];
        }
        trace += `| ${states[c]} | ${maxInState} | ${probabilities[c]} | ${maxInState.mul(probabilities[c])} |\n`;
    }
    trace += `\n**EVwPI Sum**: ${evwpi.toString()}\n\n`;

    trace += "#### Step 2: Value of Information\n";
    trace += `- **EVwPI**: ${evwpi.toString()}\n`;
    trace += `- **Maximum EMV (without perfect info)**: ${bestEMV.toString()}\n`;
    trace += `- **EVPI (EVwPI - Best EMV)**: ${evpi.toString()}\n\n`;

    trace += `**Analysis**: The maximum you should pay for additional "perfect" information about the future states is **${evpi.toString()}**.`;

    return {
        recommendedAlternative: emvResult.recommendedAlternative,
        bestValue: evpi.toString(),
        scores: emvResult.scores,
        trace,
        debug: { evwpi: evwpi.toString(), bestEMV: bestEMV.toString() }
    };
};

const solveMinimaxRegret = (payoffs: Decimal[][], alternatives: string[], states: string[]): ComputeResult => {
    const numStates = payoffs[0].length;

    // 1. Find max in each state (column)
    const maxInStates: Decimal[] = [];
    let bestInStateTrace = "**Best Payoff per State**:\n";

    for (let c = 0; c < numStates; c++) {
        let maxVal = new Decimal(-Infinity);
        for (let r = 0; r < payoffs.length; r++) {
            if (payoffs[r][c].gt(maxVal)) maxVal = payoffs[r][c];
        }
        maxInStates.push(maxVal);
        bestInStateTrace += `- ${states[c]}: ${maxVal.toString()}\n`;
    }

    // 2. Build Regret Matrix
    const regretMatrix: Decimal[][] = [];
    for (let r = 0; r < payoffs.length; r++) {
        const rowRegrets: Decimal[] = [];
        for (let c = 0; c < numStates; c++) {
            // Regret = BestInState - Actual
            rowRegrets.push(maxInStates[c].minus(payoffs[r][c]));
        }
        regretMatrix.push(rowRegrets);
    }

    // 3. Find Max Regret per Alt
    let minMaxRegret = new Decimal(Infinity);
    let bestAltIndex = -1;
    const scores: { alternative: string; score: string }[] = [];

    let trace = "### Regret-Minimizing Calculation (Minimax Regret)\n\n";
    trace += bestInStateTrace + "\n";
    trace += "| Alternative | Regret (per State) | Max Regret |\n|---|---|---|\n";

    regretMatrix.forEach((row, rIdx) => {
        let maxRegret = new Decimal(-Infinity);
        row.forEach(val => {
            if (val.gt(maxRegret)) maxRegret = val;
        });

        scores.push({ alternative: alternatives[rIdx], score: maxRegret.toString() });
        trace += `| ${alternatives[rIdx]} | [${row.map(d => d.toString()).join(', ')}] | ${maxRegret.toString()} |\n`;

        // We want to Minimize the Max Regret
        if (maxRegret.lt(minMaxRegret)) {
            minMaxRegret = maxRegret;
            bestAltIndex = rIdx;
        } else if (bestAltIndex === -1) {
            minMaxRegret = maxRegret;
            bestAltIndex = rIdx;
        }
    });

    return {
        recommendedAlternative: alternatives[bestAltIndex],
        bestValue: minMaxRegret.toString(),
        scores,
        trace: trace + `\n**Recommendation**: ${alternatives[bestAltIndex]} with Minimax Regret of ${minMaxRegret.toString()}`,
        debug: { regretMatrix: regretMatrix.map(r => r.map(c => c.toString())) }
    };
};


export const computeDecision = (payload: DecisionPayload): ComputeResult => {
    // 1. Parse Payoffs
    const payoffs = payload.payoffs.map(row => row.map(val => toDecimal(val)));

    switch (payload.criterion) {
        case Criterion.MAXIMAX:
            return solveMaximax(payoffs, payload.alternatives);

        case Criterion.MAXIMIN:
            return solveMaximin(payoffs, payload.alternatives);

        case Criterion.EMV:
            if (!payload.probabilities || payload.probabilities.length !== payload.states.length) {
                throw new Error("Invalid probabilities for EMV");
            }
            const probs = payload.probabilities.map(p => toDecimal(p));
            // Validate sum? We can optional strict check here, but typically validator does it.
            return solveEMV(payoffs, payload.alternatives, probs);

        case Criterion.MINIMAX_REGRET:
            return solveMinimaxRegret(payoffs, payload.alternatives, payload.states);

        case Criterion.LAPLACE:
            return solveLaplace(payoffs, payload.alternatives, payload.states);

        case Criterion.HURWICZ:
            if (!payload.alpha) throw new Error("Alpha required for Hurwicz");
            return solveHurwicz(payoffs, payload.alternatives, toDecimal(payload.alpha));

        case Criterion.EVWPI_EVPI:
            if (!payload.probabilities || payload.probabilities.length !== payload.states.length) {
                throw new Error("Invalid probabilities for EVPI");
            }
            return solveEVWPI_EVPI(payoffs, payload.alternatives, payload.states, payload.probabilities.map(p => toDecimal(p)));

        default:
            throw new Error(`Criterion ${payload.criterion} not yet supported`);
    }
};
