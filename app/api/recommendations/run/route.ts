
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { GrowwService } from '@/lib/groww/GrowwService';
import { SignalEngine } from '@/lib/recommendations/SignalEngine';
import { OptimizationEngine } from '@/lib/recommendations/OptimizationEngine';
import { SignalProfile } from '@/lib/recommendations/RecommendationContracts';
import path from 'path';
import fs from 'fs/promises';

// Helper to load universe
async function loadUniverse() {
    try {
        const p = path.join(process.cwd(), 'data/universe/universe.json');
        const data = await fs.readFile(p, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.warn("Failed to load universe seed", e);
        return [];
    }
}

export async function POST(req: NextRequest) {
    try {
        const { runId } = await req.json();

        if (!runId) {
            return NextResponse.json({ ok: false, error: "Missing runId" }, { status: 400 });
        }

        console.log(`[Recs] Starting run for ${runId}`);

        // 1. Load Run & Holdings
        const run = await prisma.run.findUnique({
            where: { id: runId },
            include: {
                upload: {
                    include: { holdings: true }
                }
            }
        });

        if (!run || !run.upload) {
            return NextResponse.json({ ok: false, error: "Run not found" }, { status: 404 });
        }

        const holdings = run.upload.holdings;
        console.log(`[Recs] Found ${holdings.length} holdings`);

        // 2. Fetch Prices (Live or Snapshot - use Live for Recs usually)
        // We need EOD history for signals
        const signals: Record<string, SignalProfile> = {};
        const latestPrices: Record<string, number> = {};

        // Unique symbols
        const symbols = Array.from(new Set(holdings.map(h => h.rawIdentifier).filter(Boolean)));

        // TODO: Batch this properly. For now, sequential to avoid rate limits
        for (const sym of symbols) {
            try {
                // History (last 300 days for 100D calc overlap)
                const end = new Date();
                const start = new Date();
                start.setDate(start.getDate() - 365); // 1 year

                const candles = await GrowwService.getHistoricalCandles(
                    sym,
                    start.toISOString().split('T')[0],
                    end.toISOString().split('T')[0]
                );

                // Sort ASC
                candles.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                const closes = candles.map(c => c.close); // GrowwCandle has close

                // Compute Signal
                const sig = SignalEngine.computeSignals(sym, closes);
                signals[sym] = sig;

                // Latest Price (from history or fetch fresh LTP if market open)
                if (candles.length > 0) {
                    latestPrices[sym] = candles[candles.length - 1].close;
                }
            } catch (e) {
                console.error(`[Recs] Failed metrics for ${sym}`, e);
            }
        }

        // Also fetch fresh LTP to be sure
        try {
            const growwSyms = symbols.map(s => `NSE_${s}`); // Quick hack assumption
            const ltps = await GrowwService.getLtp(growwSyms);
            ltps.forEach(l => {
                latestPrices[l.symbol.replace("NSE_", "")] = l.price;
            });
        } catch (e) { console.warn("LTP refresh failed, using history closes"); }


        // 3. Load Event Impacts
        const eventRun = await prisma.runEventImpact.findFirst({
            where: { runId: runId },
            orderBy: { createdAt: 'desc' }
        });

        let impacts: any[] = [];
        if (eventRun) {
            // TS Error workaround: prisma.eventImpactRow might be missing in client
            try {
                // @ts-ignore
                impacts = await prisma.eventImpactRow.findMany({
                    where: { runEventImpactId: eventRun.id }
                });
            } catch (e) { console.warn("Impact rows fetch failed", e); }
        }

        // 4. Load Universe
        const universe = await loadUniverse();

        // 5. Run Optimization
        // Estimate portfolio value
        let totalVal = 0;
        for (const h of holdings) {
            totalVal += Number(h.quantity) * (latestPrices[h.rawIdentifier] || Number(h.costPrice));
        }

        console.log("[Recs] Running Optimization Engine...");
        const recs = OptimizationEngine.generateRecommendations(
            holdings,
            latestPrices,
            signals,
            impacts,
            totalVal,
            universe
        );

        console.log(`[Recs] Generated ${recs.length} recommendations`);

        // 6. Persist
        // Delete old recs for this run?
        await prisma.runRecommendation.deleteMany({ where: { runId } });

        // 6. Persist
        // Delete old recs for this run
        await prisma.runRecommendation.deleteMany({ where: { runId } });

        // SQLite might not support createMany in old Prisma versions
        for (const r of recs) {
            await prisma.runRecommendation.create({
                data: {
                    runId: runId,
                    recommendationType: r.type,
                    assetInstrumentId: r.target.instrumentId,
                    resultJson: JSON.stringify(r)
                }
            });
        }

        return NextResponse.json({ ok: true, count: recs.length });

    } catch (error: any) {
        console.error("[Recs] Fatal error", error);
        await fs.writeFile('rec-error.log', `[${new Date().toISOString()}] ${error.stack || error.message}\n`, { flag: 'a' });
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
