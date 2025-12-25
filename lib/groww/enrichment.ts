
import { GrowwService } from '../groww/GrowwService';
import { withRetry } from '../utils/retry';
import { mapConcurrency } from '../utils/concurrency';

// Cache per upload session (or global LRU)
// For simplicity in this run, global simple map
const SYMBOL_CACHE: Record<string, string | null> = {};
const PRICE_CACHE: Record<string, number | null> = {};

export class GrowwEnricher {

    static async searchSymbol(companyName: string): Promise<string | null> {
        const key = companyName.toLowerCase().trim();
        if (SYMBOL_CACHE[key] !== undefined) return SYMBOL_CACHE[key];

        // LOGIC: Smart Search with Fallback
        const cleanName = companyName.replace(/[^\w\s]/g, '').trim();

        try {
            const result = await withRetry(async () => {
                // 1. Try as exact Symbol first if it looks like one (Upper case, no spaces, short)
                const isTickerLikely = /^[A-Z0-9]{1,10}$/.test(companyName.trim());
                if (isTickerLikely) {
                    try {
                        const cleanSym = companyName.toUpperCase().trim();
                        const results = await GrowwService.searchInstruments(cleanSym);
                        const exactMatch = results.find(r => r.tradingSymbol === cleanSym || r.tradingSymbol === `NSE_${cleanSym}`);
                        if (exactMatch) return exactMatch.tradingSymbol;
                    } catch (ignore) { /* Continue to normal search */ }
                }

                // 2. Standard Search (Name based)
                let results = await GrowwService.searchInstruments(cleanName);

                // 3. Fallback: If no results, try splitting and searching first word if long enough
                if ((!results || results.length === 0) && cleanName.includes(' ')) {
                    const firstWord = cleanName.split(' ')[0];
                    if (firstWord.length > 3) {
                        results = await GrowwService.searchInstruments(firstWord);
                    }
                }

                if (!results || results.length === 0) return null;

                // Sort purely deterministic
                results.sort((a, b) => {
                    // Exact trading symbol match
                    if (a.tradingSymbol === companyName) return -1;
                    if (b.tradingSymbol === companyName) return 1;

                    // Exact name match
                    if (a.name === companyName) return -1;
                    if (b.name === companyName) return 1;

                    // Prefer NSE
                    const aIsNSE = a.tradingSymbol.startsWith('NSE') ? 1 : 0;
                    const bIsNSE = b.tradingSymbol.startsWith('NSE') ? 1 : 0;
                    if (aIsNSE !== bIsNSE) return bIsNSE - aIsNSE;

                    return a.tradingSymbol.length - b.tradingSymbol.length || a.tradingSymbol.localeCompare(b.tradingSymbol);
                });

                return results[0].tradingSymbol;
            });

            SYMBOL_CACHE[key] = result;
            return result;
        } catch (e) {
            console.warn(`Failed search for ${companyName}`, e);
            return null;
        }
    }

    static async getLtp(symbol: string): Promise<number | null> {
        if (!symbol) return null;
        const key = symbol.toUpperCase();
        if (PRICE_CACHE[key] !== undefined) return PRICE_CACHE[key];

        try {
            const price = await withRetry(async () => {
                // Determine exchange format
                const fetchSymbol = (symbol.startsWith('NSE_') || symbol.startsWith('BSE_')) ? symbol : `NSE_${symbol}`;
                const quotes = await GrowwService.getLtp([fetchSymbol]);
                return quotes.length > 0 ? quotes[0].price : null;
            });
            PRICE_CACHE[key] = price;
            return price;
        } catch (e) {
            console.warn(`Failed LTP for ${symbol}`, e);
            return null;
        }
    }

    /**
     * Batch Enrichment for Rows
     */
    static async enrichRows(
        items: { id: any, name: string }[],
        concurrency = 50
    ): Promise<Record<any, { symbol: string | null, ltp: number | null }>> {

        const results: Record<any, { symbol: string | null, ltp: number | null }> = {};

        // 1. Resolve Symbols
        await mapConcurrency(items, async (item) => {
            const sym = await this.searchSymbol(item.name);
            results[item.id] = { symbol: sym, ltp: null };
        }, concurrency);

        // 2. Fetch Prices for resolved symbols
        const symbolsToFetch = [...new Set(Object.values(results).map(r => r.symbol).filter(Boolean) as string[])];

        // Batch LTP call 50 at a time (GrowwService internal limit is 50, but we should respect it here too)
        const CHUNK_SIZE = 50;
        for (let i = 0; i < symbolsToFetch.length; i += CHUNK_SIZE) {
            const chunk = symbolsToFetch.slice(i, i + CHUNK_SIZE);
            const cleanChunk = chunk.map(s => (s.startsWith('NSE_') || s.startsWith('BSE_')) ? s : `NSE_${s}`);

            try {
                const quotes = await withRetry(() => GrowwService.getLtp(cleanChunk));
                quotes.forEach(q => {
                    // Match back to cache
                    // Response symbol usually has header
                    const rawSym = q.symbol.replace(/^(NSE|BSE)_/, '');
                    PRICE_CACHE[rawSym] = q.price;
                    PRICE_CACHE[q.symbol] = q.price;
                });
            } catch (e) {
                console.error("Batch LTP failed", e);
            }
        }

        // Apply prices
        Object.keys(results).forEach(k => {
            const r = results[k];
            if (r.symbol) {
                r.ltp = PRICE_CACHE[r.symbol] || PRICE_CACHE[`NSE_${r.symbol}`] || null;
            }
        });

        return results;
    }
}
