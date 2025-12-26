import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { fetchLtpBatch } from '@/lib/market-client';
import { toDecimal, Decimal } from '@/lib/decimal-utils';

// Configurable TTL
const TTL_SECONDS = 30;

type Freshness = 'FRESH' | 'STALE' | 'FALLBACK_STALE' | 'NO_DATA';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const runId = searchParams.get('runId');

        if (!runId) {
            return NextResponse.json({ error: 'runId is required' }, { status: 400 });
        }

        const run = await prisma.run.findUnique({
            where: { id: runId },
            include: {
                upload: {
                    include: {
                        holdings: {
                            include: {
                                instrument: true
                            }
                        }
                    }
                }
            }
        });

        if (!run || !run.upload) {
            return NextResponse.json({ error: 'Run or Upload not found' }, { status: 404 });
        }

        const holdings = run.upload.holdings;
        const instrumentIds: string[] = [];
        const symbolToInstId: Record<string, string> = {};
        const instIdToSymbol: Record<string, string> = {};

        // Filter holdings that have a resolved instrument
        for (const h of holdings) {
            if (h.resolvedInstrumentId && h.instrument?.identifier) {
                instrumentIds.push(h.resolvedInstrumentId);
                symbolToInstId[h.instrument.identifier] = h.resolvedInstrumentId;
                instIdToSymbol[h.resolvedInstrumentId] = h.instrument.identifier;
            }
        }

        const uniqueInstIds = Array.from(new Set(instrumentIds));

        // 1. Check DB Cache
        const now = new Date();
        const cutoff = new Date(now.getTime() - TTL_SECONDS * 1000);

        const latestPrices = await prisma.marketPrice.findMany({
            where: {
                instrumentId: { in: uniqueInstIds }
            },
            orderBy: { asOf: 'desc' },
            // distinct: ['instrumentId'] // Optional optimization
        });

        // Group locally to find latest
        const cacheMap: Record<string, any> = {};
        for (const p of latestPrices) {
            if (!cacheMap[p.instrumentId] || new Date(p.asOf) > new Date(cacheMap[p.instrumentId].asOf)) {
                cacheMap[p.instrumentId] = p;
            }
        }

        // 2. Identify Stale
        const staleSymbols: string[] = [];
        for (const instId of uniqueInstIds) {
            const cached = cacheMap[instId];
            if (!cached || new Date(cached.asOf) < cutoff) {
                const sym = instIdToSymbol[instId];
                if (sym) staleSymbols.push(sym);
            }
        }

        // 3. Fetch Stale from Groww via Adapter
        let debugFetchResult: any = "Not Fetched";
        let upsertResult: any = "Not Attempted";

        if (staleSymbols.length > 0) {
            console.log(`Fetching live prices for ${staleSymbols.length} symbols...`);
            try {
                const fetchedItems = await fetchLtpBatch(staleSymbols);
                debugFetchResult = fetchedItems;

                // 4. Upsert to DB
                const itemsToCreate = [];
                // Normalize fetched items
                const items = fetchedItems.items || []; // fetchLtpBatch returns { items: [] }

                // If fetchedItems is just array (due to my previous debug?), let's handle both.
                // market-client.ts returns { items: results }.
                // So items is fetchedItems.items.

                const itemList = Array.isArray(fetchedItems) ? fetchedItems : (fetchedItems.items || []);

                for (const item of itemList) {
                    const instId = symbolToInstId[item.symbol];
                    if (instId && item.price) {
                        itemsToCreate.push({
                            instrumentId: instId,
                            price: toDecimal(item.price).toNumber(),

                            currency: item.curr || 'INR',
                            asOf: new Date(item.asOf || now),
                            source: item.source || 'groww'
                        });
                    }
                }

                if (itemsToCreate.length > 0) {
                    try {
                        await prisma.$transaction(
                            itemsToCreate.map(data => prisma.marketPrice.create({ data }))
                        );
                        upsertResult = `Success: ${itemsToCreate.length} items`;

                        // Update cacheMap with new values
                        for (const item of itemsToCreate) {
                            cacheMap[item.instrumentId] = item;
                        }
                    } catch (txErr: any) {
                        upsertResult = `Tx Error: ${txErr.message}`;
                        console.error("Tx Error", txErr);
                    }
                } else {
                    upsertResult = "No valid items to create (instId lookup failed?)";
                }

            } catch (err: any) {
                console.error("Failed to fetch fresh prices:", err);
                debugFetchResult = `Fetch Error: ${err.message}`;
            }
        }

        // 5. Construct Response
        const responseHoldings = holdings.map(h => {
            let priceData = null;
            let freshness: Freshness = 'NO_DATA';

            if (h.resolvedInstrumentId) {
                const cached = cacheMap[h.resolvedInstrumentId];
                if (cached) {
                    priceData = {
                        value: toDecimal(cached.price).toNumber(),

                        asOf: cached.asOf,
                        source: cached.source
                    };

                    const ageSeconds = (now.getTime() - new Date(cached.asOf).getTime()) / 1000;
                    if (ageSeconds <= TTL_SECONDS) {
                        freshness = 'FRESH';
                    } else {
                        freshness = 'FALLBACK_STALE';
                    }
                }
            } else {
                freshness = 'NO_DATA';
            }

            return {
                holdingId: h.id,
                instrumentId: h.resolvedInstrumentId,
                symbol: h.instrument?.identifier,
                quantity: toDecimal(h.quantity).toNumber(),
                price: priceData,
                freshness,
                marketValue: priceData ? toDecimal(h.quantity).mul(toDecimal(priceData.value)).toNumber() : null
            };

        });

        const meta = {
            totalHoldings: holdings.length,
            freshCount: responseHoldings.filter(h => h.freshness === 'FRESH').length,
            staleCount: responseHoldings.filter(h => h.freshness === 'FALLBACK_STALE').length,
            noDataCount: responseHoldings.filter(h => h.freshness === 'NO_DATA').length,
            timestamp: now.toISOString(),
            debug: holdings.length > 0 ? {
                firstId: holdings[0].id,
                resId: holdings[0].resolvedInstrumentId,
                instPresent: !!holdings[0].instrument,
                fetchResult: debugFetchResult,
                upsertResult: upsertResult
            } : "No Holdings"
        };

        return NextResponse.json({
            meta,
            holdings: responseHoldings
        });

    } catch (e: any) {
        console.error("LTP API Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
// Force Rebuild - 2025-12-16T05:20:00
