
// Minimal test runner since we might not have Jest configured perfectly
// Run with: npx ts-node scripts/decision.test.ts

import { computeDecision, Criterion } from '../lib/decision-compute-engine';
import { parseCommand } from '../lib/input-parser';
import { parseInputToDecimal } from '../lib/decimal-utils';

const assert = (condition: boolean, msg: string) => {
    if (!condition) {
        console.error(`❌ FAIL: ${msg}`);
        process.exit(1);
    } else {
        console.log(`✅ PASS: ${msg}`);
    }
};

const runTests = () => {
    console.log("--- Starting Decision Logic Tests ---");

    // 1. Data Setup
    const alternatives = ["A", "B", "C"];
    const states = ["S1", "S2"];
    const payoffs = [
        ["100", "0"],
        ["50", "50"],
        ["20", "80"]
    ];

    // 2. Test Maximax (Optimistic)
    // A: max 100, B: max 50, C: max 80 -> Choose A (100)
    const maximax = computeDecision({
        criterion: Criterion.MAXIMAX,
        alternatives,
        states,
        payoffs
    });
    assert(maximax.recommendedAlternative === "A", "Maximax should choose A");
    assert(maximax.bestValue === "100", "Maximax value should be 100");

    // 3. Test Maximin (Conservative)
    // A: min 0, B: min 50, C: min 20 -> Choose B (50)
    const maximin = computeDecision({
        criterion: Criterion.MAXIMIN,
        alternatives,
        states,
        payoffs
    });
    assert(maximin.recommendedAlternative === "B", "Maximin should choose B");
    assert(maximin.bestValue === "50", "Maximin value should be 50");

    // 4. Test EMV
    // Probs: 0.6, 0.4
    // A: 100*0.6 + 0 = 60
    // B: 50*0.6 + 50*0.4 = 50
    // C: 20*0.6 + 80*0.4 = 12 + 32 = 44
    // Choose A
    const emv = computeDecision({
        criterion: Criterion.EMV,
        alternatives,
        states,
        payoffs,
        probabilities: ["0.6", "0.4"]
    });
    assert(emv.recommendedAlternative === "A", "EMV should choose A");
    assert(emv.bestValue === "60", "EMV value should be 60");

    // 5. Test Minimax Regret
    // Best in S1: 100, Best in S2: 80
    // Regret Matrix:
    // A: |100-100|=0, |80-0|=80 -> Max Regret 80
    // B: |100-50|=50, |80-50|=30 -> Max Regret 50
    // C: |100-20|=80, |80-80|=0 -> Max Regret 80
    // Min of Max Regrets: 50 (B)
    const regret = computeDecision({
        criterion: Criterion.MINIMAX_REGRET,
        alternatives,
        states,
        payoffs
    });
    assert(regret.recommendedAlternative === "B", "Minimax Regret should choose B");
    assert(regret.bestValue === "50", "Minimax Regret value should be 50");

    // 6. Test Laplace (Equally Likely)
    // A: (100+0)/2 = 50
    // B: (50+50)/2 = 50
    // C: (20+80)/2 = 50
    // All 50. Should pick A (first one)
    const laplace = computeDecision({
        criterion: Criterion.LAPLACE,
        alternatives,
        states,
        payoffs
    });
    assert(laplace.recommendedAlternative === "A", "Laplace should choose A (tie-break first)");
    assert(laplace.bestValue === "50", "Laplace value should be 50");

    // 7. Test Hurwicz (Alpha=0.7)
    // A: 0.7*100 + 0.3*0 = 70
    // B: 0.7*50 + 0.3*50 = 50
    // C: 0.7*80 + 0.3*20 = 56 + 6 = 62
    // Choose A (70)
    const hurwicz = computeDecision({
        criterion: Criterion.HURWICZ,
        alternatives,
        states,
        payoffs,
        alpha: "0.7"
    });
    assert(hurwicz.recommendedAlternative === "A", "Hurwicz (0.7) should choose A");
    assert(hurwicz.bestValue === "70", "Hurwicz value should be 70");

    // 8. Test EVPI
    // Context: Best EMV was A (60) with [0.6, 0.4] probs.
    // EVwPI:
    // S1 Max: 100 * 0.6 = 60
    // S2 Max: 80 * 0.4 = 32
    // EVwPI = 60 + 32 = 92
    // EVPI = 92 - 60 = 32
    const evpi = computeDecision({
        criterion: Criterion.EVWPI_EVPI,
        alternatives,
        states,
        payoffs,
        probabilities: ["0.6", "0.4"]
    });
    assert(evpi.bestValue === "32", "EVPI value should be 32");

    console.log("\n--- Starting Parser Tests ---");

    // 6. Test Numeric Parsing
    const dec = parseInputToDecimal("₹1,000.50");
    assert(dec.equals(1000.5), "Currency parsing correct");

    const pct = parseInputToDecimal("50%");
    assert(pct.equals(0.5), "Percentage parsing correct");

    // 7. Test Command Parsing
    const cmd1 = parseCommand("/set criterion = EMV");
    assert(cmd1?.type === 'SET_CRITERION' && cmd1.value === 'EMV', "Command /set criterion parsed");

    const cmd2 = parseCommand("/set payoff alt=\"A\" state=\"S1\" value=99");
    assert(cmd2?.type === 'SET_PAYOFF' && cmd2.value === '99', "Command /set payoff parsed");

    const cmd3 = parseCommand("maximize");
    assert(cmd3 === null, "Text input not parsed as command");


    console.log("\n🎉 ALL TESTS PASSED");
};

runTests();
