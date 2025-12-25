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

        // Batch in groups of 50 (SDK limit)
        const BATCH_SIZE = 50;
        const allResults: GrowwLtpResponse[] = [];

        for (let i = 0; i < exchangeTradingSymbols.length; i += BATCH_SIZE) {
            const batch = exchangeTradingSymbols.slice(i, i + BATCH_SIZE);
            try {
                const response = await GrowwConnector.callPython('ltp_batch', {
                    symbols: batch,
                    segment
                });

                if (response.items) {
                    allResults.push(...response.items);
                }
            } catch (e: any) {
                console.error(`LTP Batch failed for ${batch.length} items:`, e);
                // Partial failure: continue to next batch or throw?
                // For live data in UI, partial result is better than none.
                // But if AUTHORIZATION_FAILED, we should probably stop.
                if (e instanceof GrowwClientError && !e.retryable) {
                    throw e;
                }
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

        const response = await GrowwConnector.callPython('search_instrument', {
            query,
            exchange
        });
        return response.instruments || (response.result ? [response.result as GrowwInstrument] : []);
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
