
import { GrowwService } from '../groww/GrowwService';
import { debugLog } from './debug';

export interface EnrichedMetadata {
    symbol: string | null;
    companyName: string | null;
    exchange?: string;
    confidence: number;
}

/**
 * Optimized Lookup Service
 * Uses local in-memory index + Batch Fetching
 */
export class GrowwIngestionLookup {

    // --- In-Memory Indices ---
    private static isInitialized = false;
    private static isinMap = new Map<string, any>();
    private static symbolMapNSE = new Map<string, any>();
    private static symbolMapBSE = new Map<string, any>();
    // Normalized name map for fallback
    private static nameIndex: { name: string; symbol: string; exchange: string }[] = [];

    /**
     * Initialize the local index. 
     * Fetches all instruments from Python (which caches them).
     * This is heavy (~1-2s IO) but saves minutes of network calls.
     */
    static async initialize() {
        if (this.isInitialized) return;

        try {
            debugLog('GrowwIngestionLookup', 'Initializing Instrument Index...');
            const startTime = Date.now();
            const { instruments } = await GrowwService.getAllInstruments();

            if (!instruments || instruments.length === 0) {
                console.warn('GrowwIngestionLookup: No instruments fetched!');
                return;
            }

            // Build Indices
            instruments.forEach((inst: any) => {
                const sym = inst.tradingSymbol;
                const exch = inst.exchange;
                const isin = inst.isin;

                // ISIN Index
                if (isin) {
                    // Prefer NSE for ISIN conflict?
                    if (!this.isinMap.has(isin) || exch === "NSE") {
                        this.isinMap.set(isin, inst);
                    }
                }

                // Symbol Index
                if (exch === "NSE") this.symbolMapNSE.set(sym, inst);
                else if (exch === "BSE") this.symbolMapBSE.set(sym, inst);

                // Name Index (Simplified for memory - only keep essential)
                // We'll trust the Python search for fuzzy, but for exact name match we can keep a set
            });

            this.isInitialized = true;
            debugLog('GrowwIngestionLookup', `Index built in ${Date.now() - startTime}ms. ${instruments.length} items.`);
        } catch (e) {
            console.error('Failed to initialize Groww Lookup Index', e);
        }
    }

    /**
     * Bulk resolve for rows - THE MAIN ENTRY POINT
     */
    static async enrichPreviewRows(rows: Record<string, any>[], roles: Record<string, string>): Promise<any[]> {
        // Ensure index is ready
        await this.initialize();

        const instrumentKey = roles['instrument'];
        const isinKey = roles['isin'] || Object.keys(rows[0] || {}).find(k => k.toLowerCase().includes('isin'));
        const qtyKey = roles['quantity'];
        const priceKey = roles['purchase_price'];

        debugLog('GrowwIngestionLookup', `Enriching ${rows.length} rows...`);

        // 1. Resolve Instrument for each row (Local CPU bound, fast)
        const resolvedRows = rows.map((row, idx) => {
            const rawVal = String(row[instrumentKey] || '').trim();
            const isinVal = isinKey ? String(row[isinKey] || '').trim() : null;

            const meta = this.resolveLocal(rawVal, isinVal);
            return {
                ...row,
                _resolved_meta: meta
            };
        });

        // 2. Collect Items for Smart Batch Fetch
        const itemsToFetch: { symbol: string, name?: string, exchange?: string }[] = [];

        resolvedRows.forEach(r => {
            const m = r._resolved_meta;
            const rawName = String((r as any)[instrumentKey] || '').trim();

            // Logic:
            // If resolved locally (m.symbol exists), use that (it's safe).
            // If NOT resolved (m.symbol null), send the raw values to backend for smart resolution.

            if (m.symbol && m.exchange) {
                itemsToFetch.push({
                    symbol: `${m.exchange}_${m.symbol}`,
                    name: m.companyName || rawName
                });
            } else {
                // FALLBACK: Send raw inputs
                // We send rawName as 'symbol' if it looks like one, or just attached as name?
                // Backend creates fuzzy query from name + symbol.
                // We'll map rawName to both or split?
                // Let's rely on what we have.
                // If local resolution failed, 'm.symbol' is null.
                // We pass rawName as 'symbol' (to try symbol match) AND 'name' (to context).
                if (rawName) {
                    itemsToFetch.push({
                        symbol: rawName,
                        name: rawName // Use same raw string as name context
                    });
                }
            }
        });

        debugLog('GrowwIngestionLookup', `Need to fetch prices for ${itemsToFetch.length} items.`);

        // 3. Batch Fetch LTP (Chunked)
        const ltpMap = await this.fetchLtpBatched(itemsToFetch);

        // 4. Map Results
        return resolvedRows.map(row => {
            const m = row._resolved_meta;
            const lookupKey = m.symbol ? `${m.exchange}_${m.symbol}` : '';

            // Try lookup by resolved symbol OR by raw name
            const rawName = String((row as any)[instrumentKey] || '').trim();
            const data = ltpMap.get(lookupKey) || ltpMap.get(rawName);

            const ltp = data?.price ?? null;

            // Correction Logic: If backend found a better symbol (e.g. ACI for ARCHEAN), apply it.
            let finalSymbol = m.symbol;
            let finalConfidence = m.confidence;

            if (data?.resolvedSymbol) {
                // resolvedSymbol is like "NSE_ACI" or "ACI"
                // Let's strip prefix
                finalSymbol = data.resolvedSymbol.replace(/^(NSE|BSE)_/, '');

                // If we got a result from backend, we are confident.
                finalConfidence = 0.99;

                if (rawName.includes('ARCHEAN') || rawName.includes('BHAKTI')) {
                    debugLog('GrowwIngestionLookup', `Correction: ${rawName} -> ${finalSymbol} (Price: ${ltp})`);
                }
            }

            // Strictly overwrite the source column with the accurate ticker
            if (finalSymbol) {
                (row as any)[instrumentKey] = finalSymbol;
            }

            // Calc
            // Re-identify keys in case of index mismatch or mapping drift
            const rowQtyKey = qtyKey || Object.keys(row).find(k => k.toLowerCase().includes('qty') || k.toLowerCase().includes('quantity')) || '';
            const rowPriceKey = priceKey || Object.keys(row).find(k => k.toLowerCase().includes('price') || k.toLowerCase().includes('rate')) || '';

            const qty = parseFloat(String((row as any)[rowQtyKey] || 0));
            const buyPrice = (row as any)[rowPriceKey] ? parseFloat(String((row as any)[rowPriceKey])) : 0;

            const marketValue = (ltp !== null && !isNaN(qty)) ? ltp * qty : null;
            const investmentValue = (!isNaN(buyPrice) && !isNaN(qty)) ? buyPrice * qty : null;

            // Handle PnL
            let pnl = null;
            let pnlPercentage = null;
            if (marketValue !== null && investmentValue !== null) {
                pnl = marketValue - investmentValue;
                if (investmentValue !== 0) pnlPercentage = (pnl / investmentValue) * 100;
            }

            return {
                ...row,
                _instrument_resolved: finalSymbol || null,
                company_name: m.companyName || (row as any)[instrumentKey],
                _resolution_confidence: finalConfidence,
                exchange: data?.resolvedSymbol?.split('_')[0] || m.exchange, // Update exchange from backend result if available
                _normalized_qty: qty,
                _normalized_price: buyPrice,
                current_price: ltp,
                market_value: marketValue,
                pnl: pnl,
                pnl_percentage: pnlPercentage,
                _is_enriched: !!ltp
            };
        });
    }

    /**
     * Resolves a single row using purely local logic
     */
    private static resolveLocal(rawName: string, isin?: string | null): EnrichedMetadata {
        // Priority 1: ISIN
        if (isin && this.isinMap.has(isin)) {
            const inst = this.isinMap.get(isin);
            return {
                symbol: inst.tradingSymbol,
                companyName: inst.name,
                exchange: inst.exchange,
                confidence: 1.0
            };
        }

        // Priority 2: Exact Symbol Match (Common in spreadsheets)
        // Check NSE First
        const upper = rawName.toUpperCase();
        if (this.symbolMapNSE.has(upper)) {
            const inst = this.symbolMapNSE.get(upper);
            return { symbol: inst.tradingSymbol, companyName: inst.name, exchange: "NSE", confidence: 0.95 };
        }
        // Check BSE
        if (this.symbolMapBSE.has(upper)) {
            const inst = this.symbolMapBSE.get(upper);
            return { symbol: inst.tradingSymbol, companyName: inst.name, exchange: "BSE", confidence: 0.95 };
        }

        // Priority 3: Name Matches (Heuristic)
        // If the name is "Vedanta", "Reliance", etc.
        // We can do a rudimentary check here or fallback to the slower Python Search
        // Since we are aiming for SPEED, we might want to avoid per-row Python calls if possible.
        // BUT, for Phase 2 implementation per plan, the user said "If spreadsheet ISIN missing... use company name"

        // For now, if local exact fails, we return NULL and let the UI show "--" 
        // OR we could call the text search. The old logic did text search.
        // To be safe and fast, let's implement a quick local "Contains" search for high-value common stocks
        // But the best is to rely on the Symbol match which catches most.
        // Let's implement a semi-fuzzy fallback if the input looks like a valid symbol.

        return { symbol: null, companyName: rawName, confidence: 0 };
    }

    /**
     * Efficient Batch Fetcher
     */
    private static async fetchLtpBatched(items: { symbol: string, name?: string, exchange?: string }[]): Promise<Map<string, { price: number, resolvedSymbol: string }>> {
        const resultMap = new Map<string, { price: number, resolvedSymbol: string }>();
        if (items.length === 0) return resultMap;

        // Dedup by symbol+name key to avoid duplicate fetches
        // But maintain a LIST for the API call
        const uniqueItemsMap = new Map<string, typeof items[0]>();
        items.forEach(i => {
            const key = `${i.symbol || ''}|${i.name || ''}`;
            if (!uniqueItemsMap.has(key)) uniqueItemsMap.set(key, i);
        });

        const fetchList = Array.from(uniqueItemsMap.values());
        debugLog('GrowwIngestionLookup', `Fetching ${fetchList.length} items via Smart LTP...`);

        // Execute via Smart Service
        const results = await GrowwService.getSmartLtp(fetchList);

        results.forEach((r: any) => {
            // Use original_index to find WHO asked for this
            const idx = r.original_index;
            if (typeof idx === 'number' && idx >= 0 && idx < fetchList.length) {
                const inputItem = fetchList[idx];
                const resolvedSym = r.symbol; // e.g. NSE_ACI
                const price = r.price;

                const resultObj = { price, resolvedSymbol: resolvedSym };

                // key 1: The input symbol (e.g. ARCHEAN)
                if (inputItem.symbol) {
                    resultMap.set(inputItem.symbol, resultObj);
                }

                // key 2: The Resolved Symbol (e.g. NSE_ACI) 
                resultMap.set(resolvedSym, resultObj);
                const base = resolvedSym.replace(/^(NSE|BSE)_/, '');
                resultMap.set(base, resultObj);
                if (!resolvedSym.includes('_')) {
                    resultMap.set(`NSE_${resolvedSym}`, resultObj);
                }
            } else {
                // Fallback if index missing (shouldn't happen with new logic)
                const resultObj = { price: r.price, resolvedSymbol: r.symbol };
                resultMap.set(r.symbol, resultObj);
            }
        });

        return resultMap;
    }

    // Legacy support (the abstract method signature might require this?)
    static async resolveMetadata(params: any): Promise<any> {
        return { symbol: null, confidence: 0 };
    }
}
