import { GrowwService } from '../groww/GrowwService';
import { debugLog } from './debug';

export interface EnrichedMetadata {
    symbol: string | null;
    companyName: string | null;
    confidence: number;
}

// Simple in-memory cache for lookups
let lookupCache: Record<string, EnrichedMetadata> = {};

export class GrowwIngestionLookup {

    /**
     * Clears the in-memory lookup cache.
     */
    public static clearCache() {
        lookupCache = {};
    }

    /**
     * Resolves metadata for a row where either symbol or name is missing.
     * Uses a multi-pass strategy to handle messy spreadsheet data.
     */
    static async resolveMetadata(params: {
        symbol?: string | null;
        name?: string | null;
        rawInstrument?: string | null;
    }): Promise<EnrichedMetadata> {
        const { symbol, name, rawInstrument } = params;
        const queryBase = (symbol || name || rawInstrument || '').trim();
        if (!queryBase) return { symbol: null, companyName: null, confidence: 0 };

        // Cache key based on input
        const cacheKey = JSON.stringify({ symbol, name, rawInstrument }).toLowerCase();
        if (lookupCache[cacheKey]) return lookupCache[cacheKey];

        const trySearch = async (q: string): Promise<EnrichedMetadata | null> => {
            try {
                const results = await GrowwService.searchInstruments(q);
                if (!results || results.length === 0) return null;

                // Rank based on query overlap
                const qNorm = q.toUpperCase();
                const ranked = results.sort((a, b) => {
                    const aSym = (a.tradingSymbol || '').toUpperCase();
                    const bSym = (b.tradingSymbol || '').toUpperCase();
                    const aName = (a.name || '').toUpperCase();
                    const bName = (b.name || '').toUpperCase();

                    // Boost exact symbol matches
                    if (aSym === qNorm && bSym !== qNorm) return -1;
                    if (bSym === qNorm && aSym !== qNorm) return 1;

                    // Boost exact name matches
                    if (aName === qNorm && bName !== qNorm) return -1;
                    if (bName === qNorm && aName !== qNorm) return 1;

                    return (b.searchScore || 0) - (a.searchScore || 0);
                });

                if (!ranked.length) return null;
                const best = ranked[0];
                return {
                    symbol: best.tradingSymbol,
                    companyName: best.name || q,
                    confidence: best.tradingSymbol.toUpperCase() === qNorm ? 0.95 : 0.8
                };
            } catch (e) {
                return null;
            }
        };

        // Pass 1: Original Query
        let result = await trySearch(queryBase);

        // Pass 2: Clean Suffixes (Limited, Ltd, Industries, India)
        if (!result) {
            const clean = queryBase
                .replace(/\b(ltd|limited|private|pvt|inc|corp|corporation|industries|india|group|holdings|services|solutions)\b/gi, '')
                .replace(/\s+/g, ' ')
                .trim();
            if (clean.length > 3 && clean !== queryBase) {
                result = await trySearch(clean);
            }
        }

        // Pass 3: First two words (Fuzzy)
        if (!result) {
            const words = queryBase.split(/\s+/).filter(w => w.length > 2);
            if (words.length >= 2) {
                const fuzzy = words.slice(0, 2).join(' ');
                result = await trySearch(fuzzy);
                if (result) result.confidence = 0.6; // Lower confidence for partial matches
            }
        }

        const finalResult = result || { symbol: null, companyName: queryBase, confidence: 0 };
        // Only cache if we found SOMETHING or if we want to suppress repeated failures
        // For now, cache everything but allow higher-level retries
        lookupCache[cacheKey] = finalResult;
        return finalResult;
    }

    /**
     * Bulk resolve for a preview or small set of rows
     */
    static async enrichPreviewRows(rows: Record<string, any>[], roles: Record<string, string>): Promise<any[]> {
        this.clearCache();
        const instrumentKey = roles['instrument'];
        const qtyKey = roles['quantity'];
        const priceKey = roles['purchase_price'];

        debugLog('GrowwIngestionLookup', `Enriching ${rows.length} rows with instrumentKey: ${instrumentKey}`);

        if (!instrumentKey) return rows;

        // 1. Identify Unique Instruments to Dedupe Searches
        const uniqueInstruments = Array.from(new Set(rows.map(r => String(r[instrumentKey] || '').trim())));

        const fs = require('fs');
        const traceLog = (msg: string) => {
            try {
                fs.appendFileSync('C:\\Users\\divit\\OneDrive\\Documents\\DTH\\decision-maker\\trace_lookup.log',
                    `[${new Date().toISOString()}] ${msg}\n`);
            } catch (e) { }
        };

        traceLog(`Enriching ${rows.length} rows. Unique: ${uniqueInstruments.length}`);

        // Define symbols that we know are in the spreadsheet to force-test if needed
        // uniqueInstruments.push("Archean Chemical Industries Ltd");

        const resolvedCache = new Map<string, EnrichedMetadata>();
        const CONCURRENCY_LIMIT = 10;
        for (let i = 0; i < uniqueInstruments.length; i += CONCURRENCY_LIMIT) {
            const batch = uniqueInstruments.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(batch.map(async q => {
                // PASS 1: Direct search
                let metadata = await this.resolveMetadata({ rawInstrument: q });

                // PASS 2: Noise removal
                if (!metadata || !metadata.symbol) {
                    const cleaned = q.replace(/\b(Ltd|Limited|Corp|Corporation|Inc|India|Industries|Services|Solutions|Holding|Group)\b/gi, '').replace(/\s+/g, ' ').trim();
                    if (cleaned !== q && cleaned.length > 2) {
                        const m2 = await this.resolveMetadata({ rawInstrument: cleaned });
                        if (m2 && m2.symbol) metadata = m2;
                    }
                }

                if (metadata && metadata.symbol) {
                    traceLog(`Resolved: "${q}" -> ${metadata.symbol}`);
                    resolvedCache.set(q, metadata);
                } else {
                    traceLog(`Failed resolution: "${q}"`);
                }
            }));
        }

        // Apply resolution back to rows map
        const resolvedMap = new Map<number, EnrichedMetadata>();
        rows.forEach((row, idx) => {
            const rawVal = String(row[instrumentKey] || '').trim();
            const res = resolvedCache.get(rawVal);
            if (res) {
                resolvedMap.set(idx, res);
            } else if (idx < 5) {
                traceLog(`No resolution for row ${idx}: "${rawVal}"`);
            }
        });

        // 2. Batch fetch LTPs
        const validSymbols = Array.from(resolvedMap.values())
            .filter(m => m.symbol)
            .map(m => {
                let cleanSymbol = m.symbol!.replace(/[-\s]/g, '_').toUpperCase();
                if (!cleanSymbol.startsWith('NSE_') && !cleanSymbol.startsWith('BSE_')) {
                    cleanSymbol = `NSE_${cleanSymbol}`;
                }
                return cleanSymbol;
            });

        const uniqueSymbols = Array.from(new Set(validSymbols));
        traceLog(`Fetching LTP for ${uniqueSymbols.length} unique symbols: ${uniqueSymbols.slice(0, 5).join(', ')}`);

        const ltpMap: Record<string, number> = {};
        const LTP_TIMEOUT_MS = 15000; // Increased to 15s for large batches

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

                            // console.log(`[GrowwIngestionLookup] Fetching LTP for ${chunk.length} symbols: ${chunk.join(', ')}`);
                            const ltpResults = await Promise.race([fetchPromise, timeoutPromise]);
                            // console.log(`[GrowwIngestionLookup] Received ${ltpResults.length} LTP results`);

                            ltpResults.forEach(r => {
                                const fullSym = r.symbol.toUpperCase().replace(/[-\s]/g, '_');
                                const baseSym = fullSym.replace(/^(NSE|BSE)_/, '');
                                ltpMap[fullSym] = r.price;
                                ltpMap[baseSym] = r.price;
                            });
                            traceLog(`Received ${ltpResults.length} LTP prices. Sample: ${Object.keys(ltpMap).slice(0, 3).join(', ')}`);
                        } catch (chunkErr: any) {
                            traceLog(`LTP fetch failed/timeout: ${chunkErr.message}`);
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

            // Re-identify keys in case of index mismatch or mapping drift
            const rowQtyKey = qtyKey || Object.keys(row).find(k => k.toLowerCase().includes('qty') || k.toLowerCase().includes('quantity')) || '';
            const rowPriceKey = priceKey || Object.keys(row).find(k => k.toLowerCase().includes('price') || k.toLowerCase().includes('rate')) || '';

            const resSym = resolution?.symbol ? resolution.symbol.toUpperCase().replace(/[-\s]/g, '_') : '';
            const baseSym = resSym.replace(/^(NSE|BSE)_/, '');

            const ltp = ltpMap[resSym] ?? ltpMap[baseSym] ?? null;

            const qty = parseFloat(String(row[rowQtyKey] || 0));
            const buyPrice = parseFloat(String(row[rowPriceKey] || 0));

            const marketValue = (ltp !== null && !isNaN(qty)) ? ltp * qty : null;
            const investmentValue = (!isNaN(buyPrice) && !isNaN(qty)) ? buyPrice * qty : null;
            const pnl = (marketValue !== null && investmentValue !== null) ? marketValue - investmentValue : null;
            const pnlPercentage = (pnl !== null && investmentValue) ? (pnl / investmentValue) * 100 : null;

            return {
                ...row,
                _instrument_resolved: resolution?.symbol || null,
                company_name: resolution?.companyName || null,
                _resolution_confidence: resolution?.confidence || 0,
                _normalized_qty: qty,
                _normalized_price: buyPrice,
                current_price: ltp,
                market_value: marketValue,
                pnl: pnl,
                pnl_percentage: pnlPercentage,
                _is_enriched: !!resolution?.symbol
            };
        });
    }
}
