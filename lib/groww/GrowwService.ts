/**
 * Groww Service - High-level API for Groww operations
 * Orchestrates GrowwConnector with rate limiting and types
 */
import { GrowwConnector } from './GrowwConnector';
import { growwRateLimiter } from './GrowwRateLimiter';
import { GrowwLtpResponse, GrowwHolding, GrowwInstrument, GrowwCandle } from './GrowwContracts';
import { GrowwClientError } from './GrowwErrors';

export class GrowwService {

    /**
     * Fetches LTP for multiple symbols.
     * @param exchangeTradingSymbols - Array of symbols like ["NSE_RELIANCE", "NSE_TCS"]
     * @param segment - "CASH" for equities, "FNO" for derivatives
     */
    static async getLtp(exchangeTradingSymbols: string[], segment = "CASH"): Promise<GrowwLtpResponse[]> {
        if (exchangeTradingSymbols.length === 0) return [];

        await growwRateLimiter.waitForToken('LIVE_DATA');

        // Batch in groups of 10 (reduced for stability)
        const BATCH_SIZE = 10;
        const allResults: GrowwLtpResponse[] = [];

        for (let i = 0; i < exchangeTradingSymbols.length; i += BATCH_SIZE) {
            const batch = exchangeTradingSymbols.slice(i, i + BATCH_SIZE);
            try {
                // Persistent debug log
                try {
                    const fs = require('fs');
                    fs.appendFileSync('C:\\Users\\divit\\OneDrive\\Documents\\DTH\\decision-maker\\ltp_debug.log',
                        `[${new Date().toISOString()}] Attempting LTP for ${batch.length} symbols: ${batch.slice(0, 3).join(', ')}\n`);
                } catch (e) { }

                const response = await GrowwConnector.callPython('ltp_batch', {
                    symbols: batch,
                    segment
                });

                try {
                    const fs = require('fs');
                    fs.appendFileSync('C:\\Users\\divit\\OneDrive\\Documents\\DTH\\decision-maker\\ltp_debug.log',
                        `[${new Date().toISOString()}] Received response: ${response.ok ? 'OK' : 'FAILED'}, items: ${response.items?.length || 0}\n`);
                } catch (e) { }

                const items = response.items || (response.data && response.data.items) || [];
                if (items.length > 0) {
                    allResults.push(...items);
                }
            } catch (e: any) {
                try {
                    const fs = require('fs');
                    fs.appendFileSync('C:\\Users\\divit\\OneDrive\\Documents\\DTH\\decision-maker\\ltp_debug.log',
                        `[${new Date().toISOString()}] Batch failed, attempting rescue for ${batch.length} symbols.\n`);
                } catch (logErr) { }

                // RESCUE LOGIC: Try individually if batch fails
                for (const sym of batch) {
                    try {
                        const singleRes = await GrowwConnector.callPython('ltp_batch', {
                            symbols: [sym],
                            segment
                        });
                        const sItems = singleRes.items || (singleRes.data && singleRes.data.items) || [];
                        if (sItems.length > 0) {
                            allResults.push(...sItems);
                            try {
                                const fs = require('fs');
                                fs.appendFileSync('C:\\Users\\divit\\OneDrive\\Documents\\DTH\\decision-maker\\ltp_debug.log',
                                    `[${new Date().toISOString()}] Rescued ${sym}: ${sItems[0].price}\n`);
                            } catch (logErr) { }
                        }
                    } catch (singleErr: any) {
                        try {
                            const fs = require('fs');
                            fs.appendFileSync('C:\\Users\\divit\\OneDrive\\Documents\\DTH\\decision-maker\\ltp_debug.log',
                                `[${new Date().toISOString()}] Rescue failed for ${sym}: ${singleErr.message}\n`);
                        } catch (logErr) { }
                    }
                }
                // DO NOT THROW HERE. We want to return whatever we salvaged.
            }
        }

        return allResults;
    }

    /**
     * Fetches OHLC for multiple symbols.
     */
    static async getOhlc(exchangeTradingSymbols: string[], segment = "CASH"): Promise<Record<string, any>> {
        if (exchangeTradingSymbols.length === 0) return {};

        await growwRateLimiter.waitForToken('LIVE_DATA');

        const response = await GrowwConnector.callPython('ohlc_batch', {
            symbols: exchangeTradingSymbols,
            segment
        });

        return response.ohlc || {};
    }

    /**
     * Fetches user's holdings from connected Groww account.
     */
    static async getHoldings(): Promise<GrowwHolding[]> {
        await growwRateLimiter.waitForToken('NON_TRADING');

        const response = await GrowwConnector.callPython('holdings', {});
        // Response format compatibility
        return response.holdings || (response.data && response.data.holdings) || [];
    }

    /**
     * Fetches user's positions.
     * @param segment - Optional: "CASH", "FNO", "COMMODITY" or null for all
     */
    static async getPositions(segment?: string): Promise<any[]> {
        await growwRateLimiter.waitForToken('NON_TRADING');

        const response = await GrowwConnector.callPython('positions', { segment });
        return response.positions || (response.data && response.data.positions) || [];
    }

    /**
     * Searches for multiple instruments by name/symbol.
     */
    static async searchInstruments(query: string, exchange = "NSE"): Promise<GrowwInstrument[]> {
        await growwRateLimiter.waitForToken('NON_TRADING');

        // Persistent debug log
        try {
            const fs = require('fs');
            fs.appendFileSync('C:\\Users\\divit\\OneDrive\\Documents\\DTH\\decision-maker\\search_debug.log',
                `[${new Date().toISOString()}] Attempting search for query: "${query}", exchange: "${exchange}"\n`);
        } catch (e) { }

        const response = await GrowwConnector.callPython('search_instrument', {
            query,
            exchange
        });

        const results = response.instruments || response.result || (response.data && response.data.result) || [];
        try {
            const fs = require('fs');
            fs.appendFileSync('C:\\Users\\divit\\OneDrive\\Documents\\DTH\\decision-maker\\search_debug.log',
                `[${new Date().toISOString()}] Search for query: "${query}" -> Found: ${results.length}\n`);
        } catch (e) { }

        // Ensure we return a flat array even if 'result' was a single object (legacy)
        if (Array.isArray(results)) {
            return results as GrowwInstrument[];
        }
        return [results as GrowwInstrument];
    }

    /**
     * Searches for an instrument by name/symbol (returns best match).
     * @param query - Partial or full symbol like "RELIANCE"
     */
    static async searchInstrument(query: string, exchange = "NSE"): Promise<GrowwInstrument | null> {
        const results = await this.searchInstruments(query, exchange);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Fetches historical candle data.
     */
    static async getHistoricalCandles(
        symbol: string,
        start: string,
        end: string,
        intervalMinutes = 1440
    ): Promise<GrowwCandle[]> {
        await growwRateLimiter.waitForToken('LIVE_DATA');

        try {
            const response = await GrowwConnector.callPython('historical_daily', {
                tradingSymbol: symbol,
                start,
                end,
                intervalMinutes
            });
            return response.candles || [];
        } catch (e) {
            console.error(`History fetch failed for ${symbol}`, e);
            throw e;
        }
    }

    /**
     * Gets full quote data for a single instrument.
     */
    static async getQuote(tradingSymbol: string, exchange = "NSE", segment = "CASH"): Promise<any> {
        await growwRateLimiter.waitForToken('LIVE_DATA');

        const response = await GrowwConnector.callPython('quote', {
            tradingSymbol,
            exchange,
            segment
        });

        return response.quote || null;
    }
}
