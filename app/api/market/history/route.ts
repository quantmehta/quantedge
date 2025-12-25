import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { fetchHistory } from '@/lib/market-client';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const instrumentId = searchParams.get('instrumentId');
        const start = searchParams.get('start'); // YYYY-MM-DD
        const end = searchParams.get('end');     // YYYY-MM-DD

        if (!instrumentId || !start || !end) {
            return NextResponse.json({ error: 'Missing required params' }, { status: 400 });
        }

        const instrument = await prisma.instrument.findUnique({ where: { id: instrumentId } });
        if (!instrument) return NextResponse.json({ error: 'Instrument not found' }, { status: 404 });

        const startDate = new Date(start);
        const endDate = new Date(end);

        // 1. Fetch Existing Cache from DB
        // MarketPriceEod stores dates as DateTime (Midnight UTC)
        // We typically query range.

        const cachedCandles = await prisma.marketPriceEod.findMany({
            where: {
                instrumentId,
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: { date: 'asc' }
        });

        // 2. Check Gaps?
        // Basic implementation: If we have some data, check if it covers the full range or just refetch everything if sparse?
        // "Fetch only missing date ranges" is required.
        // For V1, simplest robust logic: 
        // If cached count < expected count (approx), fetch full range from Source and merging.
        // Better: Fetch full range from source if *any* significant gap, stick new ones in DB (ignore duplicate errors). 

        // Let's rely on source fetch if cache is empty or small.
        // For rigorous gap fill: we'd calculate date diffs. 
        // Simplification: If undefined in cache, fetch from source.

        // Let's start with: Fetch from source covering the requested range, upsert to DB.
        // Optimization: If `cachedCandles` covers the range, skip fetch.

        const daysRequested = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);
        // Rough check: do we have enough candles? (Trading days ~ 5/7 * days)
        const hasEnoughData = cachedCandles.length >= (daysRequested * 0.5);

        let sourceCandles = [];
        if (!hasEnoughData) {
            console.log(`Fetching history for ${instrument.identifier} from ${start} to ${end}`);
            try {
                const resp = await fetchHistory(instrument.identifier, start, end);
                // resp = { candles: [{date, close...}], source... }
                if (resp && resp.candles) {
                    sourceCandles = resp.candles;

                    // Upsert Logic
                    const upserts = sourceCandles.map((c: any) => {
                        return prisma.marketPriceEod.upsert({
                            where: {
                                instrumentId_date_source: {
                                    instrumentId: instrument.id,
                                    date: new Date(c.date),
                                    source: resp.source || 'groww'
                                }
                            },
                            update: { close: c.close },
                            create: {
                                instrumentId: instrument.id,
                                date: new Date(c.date),
                                close: c.close,
                                currency: 'INR', // Default or from resp
                                source: resp.source || 'groww'
                            }
                        });
                    });

                    await prisma.$transaction(upserts);
                }
            } catch (e) {
                console.error("History fetch failed:", e);
            }
        }

        // 3. Re-read from DB to return canonical set
        const finalCandles = await prisma.marketPriceEod.findMany({
            where: {
                instrumentId,
                date: { gte: startDate, lte: endDate }
            },
            orderBy: { date: 'asc' }
        });

        return NextResponse.json({
            instrumentId,
            candles: finalCandles.map(c => ({
                date: c.date.toISOString().split('T')[0],
                close: Number(c.close),
                source: c.source
            }))
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
