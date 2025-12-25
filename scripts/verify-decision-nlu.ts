import { transition, INITIAL_STATE } from '../lib/chatbot-state-machine';

const testInput = "I am choosing between Gold and Stocks. I feel optimistic.";

console.log("--- Testing Smart Extraction ---");
const state = transition(INITIAL_STATE, testInput);

console.log("New State:", state.state);
console.log("Context Alternatives:", state.context.alternatives);
console.log("Context Criterion:", state.context.criterion);
console.log("Last Message:", state.history[state.history.length - 1].content);

if (state.context.alternatives.includes("Gold") && state.context.criterion === "MAXIMAX") {
    console.log("✅ Success: Detected both alternatives and criterion in one message!");
} else {
    console.log("❌ Failed: Extraction missed something.");
}

const testInput2 = "Vendor X and Vendor Y. If the market crashes or it booms.";
const state2 = transition(INITIAL_STATE, testInput2);
console.log("\n--- Testing Alternative + State Extraction ---");
console.log("New State:", state2.state);
console.log("Context Alternatives:", state2.context.alternatives);
console.log("Context States:", state2.context.states);

if (state2.context.alternatives.length >= 2 && state2.context.states.length >= 2) {
    console.log("✅ Success: Detected both alts and states!");
} else {
    console.log("❌ Failed: Multi-entity extraction failed.");
}
