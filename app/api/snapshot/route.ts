import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { SnapshotEngine, HoldingInput, PriceInput, HistoryInput } from '@/lib/snapshot-engine';
import { successResponse, errorResponse, ErrorCodes, appendAuditEntry } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const runId = searchParams.get('runId');

        if (!runId) {
            return errorResponse(ErrorCodes.BAD_REQUEST, 'runId is required', 400);
        }

        // 1. Fetch Data
        const run = await prisma.run.findUnique({
            where: { id: runId },
            include: {
                upload: {
                    include: {
                        holdings: { include: { instrument: true } }
                    }
                }
            }
        });

        if (!run) {
            return errorResponse(ErrorCodes.NOT_FOUND, 'Run not found', 404);
        }

        if (!run.upload) {
            return errorResponse(ErrorCodes.NOT_FOUND, 'Upload not found for run', 404);
        }

        const holdings = run.upload.holdings;
        const instrumentIds = holdings
            .map(h => h.resolvedInstrumentId)
            .filter((id): id is string => !!id);

        const uniqueInstIds = Array.from(new Set(instrumentIds));

        // Find Benchmark
        const benchmarkInstrument = await prisma.instrument.findFirst({
            where: { identifier: 'NSE_NIFTY' }
        });
        const benchmarkId = benchmarkInstrument?.id;
        const fetchIds = benchmarkId ? [...uniqueInstIds, benchmarkId] : uniqueInstIds;

        // 2. Fetch Market Data
        const [pricesRaw, historyRaw] = await Promise.all([
            prisma.marketPrice.findMany({
                where: { instrumentId: { in: fetchIds } },
                orderBy: { asOf: 'desc' }
            }),
            prisma.marketPriceEod.findMany({
                where: { instrumentId: { in: fetchIds } },
                orderBy: { date: 'asc' }
            })
        ]);

        // Process Prices (Latest per Instrument)
        const priceMap: Record<string, PriceInput> = {};
        pricesRaw.forEach(p => {
            if (!priceMap[p.instrumentId]) {
                priceMap[p.instrumentId] = {
                    instrumentId: p.instrumentId,
                    price: Number(p.price),
                    asOf: p.asOf,
                    source: p.source
                };
            }
        });

        // Process Histories
        const historyMap: Record<string, HistoryInput> = {};
        historyRaw.forEach(h => {
            if (!historyMap[h.instrumentId]) {
                historyMap[h.instrumentId] = { instrumentId: h.instrumentId, candles: [] };
            }
            historyMap[h.instrumentId].candles.push({
                date: h.date,
                close: Number(h.close)
            });
        });

        // Prepare Engine Inputs
        const engineHoldings: HoldingInput[] = holdings.map(h => ({
            id: h.id,
            identifier: h.rawIdentifier,
            quantity: Number(h.quantity),
            costPrice: Number(h.costPrice),
            assetClass: h.assetClass || 'Equity',
            sector: h.sector || 'Unknown',
            resolvedInstrumentId: h.resolvedInstrumentId || undefined
        }));

        // 3. Run Engine
        // Extract Realized PnL from Audit Legacy
        const audit = run.auditJson ? JSON.parse(run.auditJson) : [];
        const validateEntry = audit.find((a: any) => a.action === 'VALIDATE');
        const realizedPnl = validateEntry?.totalRealizedPnl || 0;

        const snapshot = SnapshotEngine.calculate(
            runId,
            engineHoldings,
            priceMap,
            historyMap,
            benchmarkId ? historyMap[benchmarkId] : undefined,
            realizedPnl
        );

        // 4. Persist Snapshot (APPEND ONLY - never overwrite)
        await prisma.runSnapshot.create({
            data: {
                runId,
                snapshotJson: JSON.stringify(snapshot)
            }
        });

        // 5. Update Run with audit entry and status
        const updatedAuditJson = appendAuditEntry(run.auditJson, 'SNAPSHOT', {
            holdingsCount: holdings.length,
            pricesCount: Object.keys(priceMap).length,
            historyDays: Object.values(historyMap).reduce((sum, h) => sum + h.candles.length, 0)
        });

        await prisma.run.update({
            where: { id: runId },
            data: {
                status: 'SNAPSHOT_DONE',
                auditJson: updatedAuditJson,
                asOfMarketTimestamp: new Date()
            }
        });

        // 6. Return
        return successResponse({
            runId,
            snapshot,
            createdAt: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('Snapshot Error:', error);
        return errorResponse(ErrorCodes.INTERNAL_ERROR, error.message || 'Failed to generate snapshot', 500);
    }
}
