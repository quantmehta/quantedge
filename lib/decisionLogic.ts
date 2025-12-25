export type DecisionCriterion = 'maximax' | 'maximin' | 'emv' | 'minimaxRegret';

export interface Scenario {
    alternatives: string[];
    states: string[];
    payoffs: number[][]; // [alternativeIndex][stateIndex]
    probabilities?: number[]; // [stateIndex]
}

export interface DecisionResult {
    bestAlternativeIndex: number;
    bestValue: number;
    values: number[]; // Value for each alternative based on criterion
    regretMatrix?: number[][];
    explanation: string;
}

export const solveMaximax = (payoffs: number[][]): DecisionResult => {
    const values = payoffs.map(row => Math.max(...row));
    const bestValue = Math.max(...values);
    const bestAlternativeIndex = values.indexOf(bestValue);

    return {
        bestAlternativeIndex,
        bestValue,
        values,
        explanation: "Maximax selects the alternative with the highest possible payoff (Optimistic approach)."
    };
};

export const solveMaximin = (payoffs: number[][]): DecisionResult => {
    const values = payoffs.map(row => Math.min(...row));
    const bestValue = Math.max(...values);
    const bestAlternativeIndex = values.indexOf(bestValue);

    return {
        bestAlternativeIndex,
        bestValue,
        values,
        explanation: "Maximin selects the alternative with the best 'worst-case' scenario (Pessimistic approach)."
    };
};

export const solveEMV = (payoffs: number[][], probabilities: number[]): DecisionResult => {
    if (probabilities.length === 0) {
        throw new Error("Probabilities are required for EMV");
    }

    // Normalize probs just in case, or assume user input is correct? 
    // For now assuming user input sums to 1 or similar scale, but we calculate weighted sum directly.

    const values = payoffs.map(row => {
        return row.reduce((sum, payoff, idx) => sum + (payoff * (probabilities[idx] || 0)), 0);
    });

    const bestValue = Math.max(...values);
    const bestAlternativeIndex = values.indexOf(bestValue);

    return {
        bestAlternativeIndex,
        bestValue,
        values,
        explanation: "EMV (Expected Monetary Value) weighs payoffs by their probability."
    };
};

export const solveMinimaxRegret = (payoffs: number[][]): DecisionResult => {
    const numStates = payoffs[0].length;
    const numAlternatives = payoffs.length;

    // 1. Find max for each column (state)
    const maxInStates = Array(numStates).fill(-Infinity);
    for (let s = 0; s < numStates; s++) {
        for (let a = 0; a < numAlternatives; a++) {
            if (payoffs[a][s] > maxInStates[s]) {
                maxInStates[s] = payoffs[a][s];
            }
        }
    }

    // 2. Calculate Regret Matrix
    const regretMatrix = payoffs.map((row, aIdx) => {
        return row.map((val, sIdx) => maxInStates[sIdx] - val);
    });

    // 3. Find Max Regret for each alternative
    const values = regretMatrix.map(row => Math.max(...row)); // This is the 'Max Regret' for this row

    // 4. Find Min of those Max Regrets
    const bestValue = Math.min(...values);
    const bestAlternativeIndex = values.indexOf(bestValue);

    return {
        bestAlternativeIndex,
        bestValue, // This is the Minimax Regret value
        values, // These are the max regrets for each alternative
        regretMatrix,
        explanation: "Minimax Regret minimizes the maximum opportunity loss."
    };
};
