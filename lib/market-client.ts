import { GrowwService } from './groww/GrowwService';

/**
 * High-performance market data client.
 * Delegates to GrowwService for actual data fetching via Python bridge.
 */

export async function fetchLtpBatch(exchangeTradingSymbols: string[], segment = "CASH") {
    try {
        if (!exchangeTradingSymbols || exchangeTradingSymbols.length === 0) {
            return { items: [] };
        }

        // GrowwService handles batching and rate limiting
        const items = await GrowwService.getLtp(exchangeTradingSymbols, segment);
        return { items };
    } catch (error) {
        console.error("fetchLtpBatch failed:", error);
        // Fallback to empty to prevent UI crash, relying on error logging
        return { items: [] };
    }
}

export async function fetchHistory(symbol: string, start: string, end: string, interval = 1440) {
    try {
        const candles = await GrowwService.getHistoricalCandles(symbol, start, end, interval);
        return {
            candles,
            source: "groww_live"
        };
    } catch (error) {
        console.error(`fetchHistory failed for ${symbol}:`, error);
        return { candles: [], source: "error" };
    }
}
