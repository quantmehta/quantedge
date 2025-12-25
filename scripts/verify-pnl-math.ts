/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */

// Mock the dependencies (for reference, but not used in standalone mode)
// const mockSearch = jest.fn();
// const mockGetLtp = jest.fn();
// jest.mock(...)

// Simple mocking shim since we don't have full jest setup in this run context
// We'll replace the imports with direct mocks for standalone node execution
const { GrowwService } = require('../lib/groww/GrowwService');

// Overwrite methods
GrowwService.searchInstruments = async () => [{
    tradingSymbol: "NSE_RELIANCE",
    name: "Reliance Industries",
    searchScore: 1.0
}];

GrowwService.getLtp = async () => [{
    symbol: "NSE_RELIANCE",
    price: 2500.0
}];

// Import the class (it will use the modified singleton/static methods)
const { GrowwIngestionLookup } = require('../lib/ingestion/groww-lookup');

async function runStandalone() {
    console.log("--- Verifying PnL Logic (Standalone) ---");

    // 2. Input Row
    // User bought 10 shares at 2000
    const rows = [{
        "Instrument": "Reliance",
        "Qty": "10",
        "Avg Price": "2000"
    }];

    const roles = {
        "instrument": "Instrument",
        "quantity": "Qty",
        "purchase_price": "Avg Price"
    };

    // 3. Run Enrichment
    console.log("Enriching rows...");
    const enriched = await GrowwIngestionLookup.enrichPreviewRows(rows, roles);
    const result = enriched[0];

    // 4. Assertions
    console.log("\n--- Results ---");
    console.log(`Instrument: ${result._instrument_resolved}`);
    console.log(`Quantity: ${result._normalized_qty}`);
    console.log(`Buy Price: ${result._normalized_price}`);
    console.log(`Current Price: ${result.current_price}`);
    console.log(`Market Value: ${result.market_value}`);
    console.log(`PnL: ${result.pnl}`);


    // Validation
    const expectedMarketValue = 2500 * 10; // 25000
    const expectedInvested = 2000 * 10;    // 20000
    const expectedPnL = 25000 - 20000;     // 5000

    if (result.market_value === expectedMarketValue) {
        console.log("✅ Market Value Correct");
    } else {
        console.error(`❌ Market Value Failed: Expected ${expectedMarketValue}, Got ${result.market_value}`);
    }

    if (result.pnl === expectedPnL) {
        console.log("✅ PnL Correct");
    } else {
        console.error(`❌ PnL Failed: Expected ${expectedPnL}, Got ${result.pnl}`);
    }
}

runStandalone().catch(console.error);
