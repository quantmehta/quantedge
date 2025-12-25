import { GrowwService } from '../groww/GrowwService';

export interface EnrichedMetadata {
    symbol: string | null;
    companyName: string | null;
    confidence: number;
}

// Simple in-memory cache for lookups
const lookupCache: Record<string, EnrichedMetadata> = {};

export class GrowwIngestionLookup {

    /**
     * Resolves metadata for a row where either symbol or name is missing.
     */
    static async resolveMetadata(params: {
        symbol?: string | null;
        name?: string | null;
        rawInstrument?: string | null;
    }): Promise<EnrichedMetadata> {
        const { symbol, name, rawInstrument } = params;

        // Cache key based on input
        const cacheKey = JSON.stringify({ symbol, name, rawInstrument }).toLowerCase();
        if (lookupCache[cacheKey]) return lookupCache[cacheKey];

        let resultSymbol = symbol || null;
        let resultName = name || rawInstrument || null;
        let confidence = 0;

        try {
            const query = symbol || name || rawInstrument;
            if (query) {
                const searchResults = await GrowwService.searchInstruments(query);
                if (searchResults && searchResults.length > 0) {
                    // Filter out invalid results first
                    const validResults = searchResults.filter(r => r && r.tradingSymbol);

                    if (validResults.length > 0) {
                        // Deterministic Ranking
                        const ranked = validResults.sort((a, b) => {
                            const aSymbolNorm = (a.tradingSymbol || '').toUpperCase();
                            const bSymbolNorm = (b.tradingSymbol || '').toUpperCase();
                            const queryNorm = (query || '').toUpperCase();

                            const aExactSymbol = aSymbolNorm === queryNorm ? 1 : 0;
                            const bExactSymbol = bSymbolNorm === queryNorm ? 1 : 0;
                            if (aExactSymbol !== bExactSymbol) return bExactSymbol - aExactSymbol;

                            const aExactName = (a.name || '').toUpperCase() === queryNorm ? 1 : 0;
                            const bExactName = (b.name || '').toUpperCase() === queryNorm ? 1 : 0;
                            if (aExactName !== bExactName) return bExactName - aExactName;

                            const scoreDiff = (b.searchScore || 0) - (a.searchScore || 0);
                            if (scoreDiff !== 0) return scoreDiff;

                            return aSymbolNorm.localeCompare(bSymbolNorm);
                        });

                        const best = ranked[0];
                        resultSymbol = best.tradingSymbol;
                        if (best.name) resultName = best.name;
                        confidence = 0.8;
                        if ((best.tradingSymbol || '').toUpperCase() === (query || '').toUpperCase()) confidence = 0.95;
                    }
                }
            }
        } catch (error) {
            console.error(`[GrowwIngestionLookup] Error during enrichment:`, error);
        }

        // FALLBACK: If name search yielded no confidence, try cleaning the name
        if (!resultSymbol && (name || rawInstrument) && !symbol) {
            const inputName = name || rawInstrument || '';
            const cleanName = inputName.replace(/\b(ltd|limited|private|pvt|inc|corp|corporation)\b/gi, '').trim();
            if (cleanName.length > 3 && cleanName !== inputName) {
                try {
                    const retryResults = await GrowwService.searchInstruments(cleanName);
                    if (retryResults && retryResults.length > 0) {
                        const best = retryResults[0];
                        resultSymbol = best.tradingSymbol;
                        if (best.name) resultName = best.name;
                        confidence = 0.7;
                    }
                } catch { }
            }
        }

        const finalResult = {
            symbol: resultSymbol,
            companyName: resultName,
            confidence: (resultSymbol && resultName) ? Math.max(confidence, 1.0) : confidence
        };

        // Cache result
        lookupCache[cacheKey] = finalResult;
        return finalResult;
    }

    /**
     * Bulk resolve for a preview or small set of rows
     */
    static async enrichPreviewRows(rows: Record<string, any>[], roles: Record<string, string>): Promise<any[]> {
        const instrumentKey = roles['instrument'];
        const qtyKey = roles['quantity'];
        const priceKey = roles['purchase_price'];

        if (!instrumentKey) return rows;

        // 1. Identify Unique Instruments to Dedupe Searches
        const uniqueRawInstruments = new Map<string, { symbol: string | null, name: string | null }>();
        rows.forEach(row => {
            const rawVal = row[instrumentKey];
            if (!rawVal) return;
            const strVal = String(rawVal).trim();
            if (!strVal) return;

            if (!uniqueRawInstruments.has(strVal)) {
                let symbol: string | null = null;
                let name: string | null = null;
                // Heuristic: short upper-case strings are likely tickers
                if (strVal.length < 15 && /^[A-Z0-9.\-]+$/i.test(strVal)) {
                    symbol = strVal;
                } else {
                    name = strVal;
                }
                uniqueRawInstruments.set(strVal, { symbol, name });
            }
        });

        // 2. Resolve Metadata for Unique Instruments (Batch with Concurrency)
        const instrumentList = Array.from(uniqueRawInstruments.keys());
        const resolvedCache = new Map<string, EnrichedMetadata>();
        const CONCURRENCY_LIMIT = 15; // Increased for faster processing
        const LOOKUP_TIMEOUT_MS = 3000; // 3 second timeout per lookup to prevent blocking

        // Helper: wrap lookup with timeout
        const resolveWithTimeout = async (rawText: string): Promise<void> => {
            const params = uniqueRawInstruments.get(rawText);
            if (!params) return;

            try {
                const timeoutPromise = new Promise<EnrichedMetadata>((_, reject) =>
                    setTimeout(() => reject(new Error('Lookup timeout')), LOOKUP_TIMEOUT_MS)
                );
                const lookupPromise = this.resolveMetadata(params);

                const res = await Promise.race([lookupPromise, timeoutPromise]);
                resolvedCache.set(rawText, res);
            } catch (e) {
                // On timeout or error, use raw text as fallback
                console.warn(`[GrowwIngestionLookup] Timeout/error for "${rawText}", using fallback`);
                resolvedCache.set(rawText, {
                    symbol: params.symbol,
                    companyName: params.name || rawText,
                    confidence: 0.1
                });
            }
        };

        for (let i = 0; i < instrumentList.length; i += CONCURRENCY_LIMIT) {
            const chunk = instrumentList.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(chunk.map(resolveWithTimeout));
        }

        // Apply resolution back to rows map
        const resolvedMap = new Map<number, EnrichedMetadata>();
        rows.forEach((row, idx) => {
            const rawVal = String(row[instrumentKey] || '').trim();
            const res = resolvedCache.get(rawVal);
            if (res) resolvedMap.set(idx, res);
        });

        // 2. Batch fetch LTPs
        const validSymbols = Array.from(resolvedMap.values())
            .filter(m => m.symbol)
            .map(m => {
                // Groww API requires "NSE_SYMBOL" format for getLtp
                let cleanSymbol = m.symbol!.replace(/[-\s]/g, '_').toUpperCase();

                // If no prefix, default to NSE_
                if (!cleanSymbol.startsWith('NSE_') && !cleanSymbol.startsWith('BSE_')) {
                    cleanSymbol = `NSE_${cleanSymbol}`;
                }

                return cleanSymbol;
            });

        // Dedupe symbols
        const uniqueSymbols = Array.from(new Set(validSymbols));

        const ltpMap: Record<string, number> = {};
        const LTP_TIMEOUT_MS = 5000; // 5 second timeout for entire LTP fetch

        if (uniqueSymbols.length > 0) {
            try {
                const CHUNK_SIZE = 50;
                const ltpPromises: Promise<void>[] = [];

                for (let i = 0; i < uniqueSymbols.length; i += CHUNK_SIZE) {
                    const chunk = uniqueSymbols.slice(i, i + CHUNK_SIZE);

                    // Wrap each chunk fetch with timeout
                    const chunkPromise = (async () => {
                        try {
                            const timeoutPromise = new Promise<never>((_, reject) =>
                                setTimeout(() => reject(new Error('LTP chunk timeout')), LTP_TIMEOUT_MS)
                            );
                            const fetchPromise = GrowwService.getLtp(chunk);

                            const ltpResults = await Promise.race([fetchPromise, timeoutPromise]);
                            ltpResults.forEach(r => {
                                const fullSym = r.symbol.toUpperCase().replace(/[-\s]/g, '_');
                                const baseSym = fullSym.replace(/^(NSE|BSE)_/, '');
                                ltpMap[fullSym] = r.price;
                                ltpMap[baseSym] = r.price;
                            });
                        } catch (chunkErr) {
                            console.warn(`[GrowwIngestionLookup] LTP chunk timeout/error, continuing without prices`);
                        }
                    })();

                    ltpPromises.push(chunkPromise);
                }

                // Run all chunks in parallel for faster processing
                await Promise.all(ltpPromises);
            } catch (e) {
                console.error("[GrowwIngestionLookup] Failed to fetch batch LTPs:", e);
            }
        }

        // 3. Construct enriched rows with calculations
        return rows.map((row, idx) => {
            const resolution = resolvedMap.get(idx);
            if (!resolution) return row;

            const resSym = resolution.symbol ? resolution.symbol.toUpperCase().replace(/[-\s]/g, '_') : '';
            const baseSym = resSym.replace(/^(NSE|BSE)_/, '');

            const ltp = ltpMap[resSym] ?? ltpMap[baseSym] ?? null;

            const qty = parseFloat(String(row[qtyKey] || 0));
            const buyPrice = parseFloat(String(row[priceKey] || 0));

            const marketValue = (ltp !== null && !isNaN(qty)) ? ltp * qty : null;
            const investmentValue = (!isNaN(buyPrice) && !isNaN(qty)) ? buyPrice * qty : null;
            const pnl = (marketValue !== null && investmentValue !== null) ? marketValue - investmentValue : null;
            const pnlPercentage = (pnl !== null && investmentValue) ? (pnl / investmentValue) * 100 : null;

            return {
                ...row,
                _instrument_resolved: resolution.symbol,
                company_name: resolution.companyName,
                _resolution_confidence: resolution.confidence,
                _normalized_qty: qty,
                _normalized_price: buyPrice,
                current_price: ltp,
                market_value: marketValue,
                pnl: pnl,
                pnl_percentage: pnlPercentage,
                _is_enriched: true
            };
        });
    }
}
