import { GrowwService } from '../lib/groww/GrowwService';

async function runBenchmark() {
    console.log("Starting Groww API Benchmark...");

    // Symbols to test with - repetitive but good for scale test
    const testSymbols = Array(100).fill("RELIANCE");
    const testQueries = ["RELIANCE", "TCS", "INFY", "HDFC", "ICICI", "SBIN", "BHARTIARTL", "AXISBANK", "WIPRO", "HCLTECH"];

    // 1. Test Concurrency of searchInstruments
    // This is what typically causes 'spawn UNKNOWN' because each search spawns a process.
    console.log("\n--- Testing Search Concurrency ---");
    const concurrencyLevels = [5, 10, 15, 20, 25, 30, 40, 50];

    for (const level of concurrencyLevels) {
        console.log(`Testing Concurrency Level: ${level}`);
        const start = Date.now();
        const queries = Array(level).fill(0).map((_, i) => testQueries[i % testQueries.length]);

        try {
            const results = await Promise.all(queries.map(q => GrowwService.searchInstrument(q)));
            const duration = Date.now() - start;
            console.log(`  Success: ${results.length} results in ${duration}ms (Avg: ${Math.round(duration / level)}ms)`);
        } catch (e: any) {
            console.error(`  FAILED at Concurrency ${level}:`, e.message);
            console.log("  Stopping Search Concurrency test.");
            break;
        }
    }

    // 2. Test Batch Size of ltp_batch
    // Note: getLtp already batches into 50. We want to see how many 50-item batches we can send in parallel.
    console.log("\n--- Testing LTP Batch Concurrency ---");
    const ltpBatchConcurrency = [1, 2, 4, 8, 10];

    for (const level of ltpBatchConcurrency) {
        console.log(`Testing Parallel LTP Batches (Size 50 each): ${level}`);
        const start = Date.now();
        const batches = Array(level).fill(0).map(() => Array(50).fill("NSE_RELIANCE"));

        try {
            const results = await Promise.all(batches.map(b => GrowwService.getLtp(b)));
            const duration = Date.now() - start;
            console.log(`  Success: ${results.length * 50} items fetched in ${duration}ms`);
        } catch (e: any) {
            console.error(`  FAILED at LTP Concurrency ${level}:`, e.message);
            break;
        }
    }

    console.log("\nBenchmark Complete.");
}

runBenchmark().catch(console.error);
