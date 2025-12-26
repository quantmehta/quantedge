import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { GrowwIngestionLookup } from '@/lib/ingestion/groww-lookup';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const uploadId = searchParams.get('uploadId');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    if (!uploadId) {
        return NextResponse.json({ error: "Missing uploadId" }, { status: 400 });
    }

    try {
        // 1. Fetch Request Page of Holdings
        const skip = (page - 1) * pageSize;
        const [holdings, totalCount] = await Promise.all([
            prisma.holding.findMany({
                where: { portfolioUploadId: uploadId },
                orderBy: { rowNumber: 'asc' },
                skip,
                take: pageSize,
                include: { instrument: { include: { prices: { orderBy: { asOf: 'desc' }, take: 1 } } } }
            }),
            prisma.holding.count({ where: { portfolioUploadId: uploadId } })
        ]);

        // 2. Identify Non-Enriched, ID-Missing, or Price-Missing Holdings
        const toEnrich = (holdings as any[]).filter(h =>
            !h.isEnriched ||
            !h.resolvedInstrumentId ||
            !h.instrument?.prices?.length
        );

        if (toEnrich.length > 0) {
            console.log(`[Enrich API] Processing ${toEnrich.length} rows for Page ${page}`);

            // Convert to format expected by GrowwIngestionLookup
            const roles = { instrument: 'rawIdentifier', quantity: 'quantity', purchase_price: 'costPrice' };
            const rowsToEnrich = toEnrich.map(h => ({
                rawIdentifier: h.rawIdentifier,
                quantity: h.quantity?.toString(),
                costPrice: h.costPrice?.toString(),
                id: h.id
            }));

            // Call Enrichment (Concurrency of 10 handled inside)
            const enriched = await GrowwIngestionLookup.enrichPreviewRows(rowsToEnrich, roles);

            // 3. Persist Enrichment back to DB
            for (const item of enriched) {
                // Find corresponding holding id from rowsToEnrich
                const original = toEnrich.find(h => h.rawIdentifier === item.rawIdentifier);
                if (!original) continue;

                let instrumentId = original.resolvedInstrumentId;

                // Sync Instrument if newly resolved
                if (item._instrument_resolved && !instrumentId) {
                    const inst = await prisma.instrument.upsert({
                        where: { identifier: item._instrument_resolved },
                        update: { displayName: item.company_name },
                        create: {
                            identifier: item._instrument_resolved,
                            identifierType: 'TICKER',
                            displayName: item.company_name,
                            exchange: item._instrument_resolved.startsWith('BSE_') ? 'BSE' : 'NSE'
                        }
                    });
                    instrumentId = inst.id;
                }

                // Update Market Price if available
                if (instrumentId && item.current_price > 0) {
                    await prisma.marketPrice.upsert({
                        where: {
                            instrumentId_asOf_source: {
                                instrumentId,
                                asOf: new Date(),
                                source: 'GROWW'
                            }
                        },
                        update: { price: item.current_price },
                        create: {
                            instrumentId,
                            price: item.current_price,
                            asOf: new Date(),
                            source: 'GROWW'
                        }
                    });
                }

                // Update Holding
                await (prisma.holding as any).update({
                    where: { id: original.id },
                    data: {
                        name: item.company_name,
                        resolvedInstrumentId: instrumentId,
                        isEnriched: true
                    }
                });
            }
        }

        // 4. Final Data Fetch (Refreshed)
        const finalHoldings = await (prisma.holding as any).findMany({
            where: { portfolioUploadId: uploadId },
            orderBy: { rowNumber: 'asc' },
            skip,
            take: pageSize,
            include: { instrument: { include: { prices: { orderBy: { asOf: 'desc' }, take: 1 } } } }
        });

        // Map to UI-friendly format
        const rows = (finalHoldings as any[]).map(h => {
            const ltp = h.instrument?.prices[0]?.price || null;
            return {
                ...h,
                instrument_name: h.rawIdentifier,
                company_name: h.name || h.rawIdentifier,
                symbol: h.instrument?.identifier || '',
                quantity: h.quantity?.toNumber ? h.quantity.toNumber() : (typeof h.quantity === 'number' ? h.quantity : 0),
                purchase_price: h.costPrice?.toNumber ? h.costPrice.toNumber() : (typeof h.costPrice === 'number' ? h.costPrice : 0),
                market_price: ltp?.toNumber ? ltp.toNumber() : (typeof ltp === 'number' ? ltp : null),
                _is_enriched: h.isEnriched
            };
        });

        return NextResponse.json({
            rows,
            pagination: {
                total: totalCount,
                page,
                pageSize,
                totalPages: Math.ceil(totalCount / pageSize)
            }
        });

    } catch (error: any) {
        console.error("[Holdings Preview API] Error:", error);
        return NextResponse.json({ error: "Failed to fetch holdings", message: error.message }, { status: 500 });
    }
}
