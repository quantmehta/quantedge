import { computeDecision, Criterion } from '../lib/decision-compute-engine.js';

const assert = (condition, msg) => {
    if (!condition) {
        console.error(`❌ FAIL: ${msg}`);
        process.exit(1);
    } else {
        console.log(`✅ PASS: ${msg}`);
    }
};

const runTests = () => {
    console.log("--- Starting Decision Logic Tests (ESM) ---");

    const alternatives = ["A", "B", "C"];
    const states = ["S1", "S2"];
    const payoffs = [
        ["100", "0"],
        ["50", "50"],
        ["20", "80"]
    ];

    // 1. Test Maximax
    const maximax = computeDecision({ criterion: Criterion.MAXIMAX, alternatives, states, payoffs });
    assert(maximax.recommendedAlternative === "A", "Maximax should choose A");
    assert(maximax.bestValue === "100", "Maximax value should be 100");

    // 2. Test Maximin
    const maximin = computeDecision({ criterion: Criterion.MAXIMIN, alternatives, states, payoffs });
    assert(maximin.recommendedAlternative === "B", "Maximin should choose B");
    assert(maximin.bestValue === "50", "Maximin value should be 50");

    // 3. Test EMV
    const emv = computeDecision({ criterion: Criterion.EMV, alternatives, states, payoffs, probabilities: ["0.6", "0.4"] });
    assert(emv.recommendedAlternative === "A", "EMV should choose A");
    assert(emv.bestValue === "60", "EMV value should be 60");

    // 4. Test Minimax Regret
    const regret = computeDecision({ criterion: Criterion.MINIMAX_REGRET, alternatives, states, payoffs });
    assert(regret.recommendedAlternative === "B", "Minimax Regret should choose B");
    assert(regret.bestValue === "50", "Minimax Regret value should be 50");

    // 5. Test Laplace
    const laplace = computeDecision({ criterion: Criterion.LAPLACE, alternatives, states, payoffs });
    assert(laplace.recommendedAlternative === "A", "Laplace should choose A");
    assert(laplace.bestValue === "50", "Laplace value should be 50");

    // 6. Test Hurwicz
    const hurwicz = computeDecision({ criterion: Criterion.HURWICZ, alternatives, states, payoffs, alpha: "0.7" });
    assert(hurwicz.recommendedAlternative === "A", "Hurwicz (0.7) should choose A");
    assert(hurwicz.bestValue === "70", "Hurwicz value should be 70");

    // 7. Test EVPI
    const evpi = computeDecision({ criterion: Criterion.EVWPI_EVPI, alternatives, states, payoffs, probabilities: ["0.6", "0.4"] });
    assert(evpi.bestValue === "32", "EVPI value should be 32");

    console.log("\n🎉 ALL TESTS PASSED");
};

runTests();
