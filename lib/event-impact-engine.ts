// -----------------------------------------------------------------------------
// EVENT IMPACT ENGINE - Core computation with full traceability
// -----------------------------------------------------------------------------

import { prisma } from '@/lib/db';
import {
    EventItem,
    HoldingImpactTrace,
    EventImpactResult,
    EventImpactSummary,
    getDirectionSign,
    SensitivitySource
} from '@/lib/event-types';

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

interface HoldingSnapshot {
    id: string;
    instrumentId?: string;
    symbol: string;
    quantity: number;
    currentPrice: number;
    currentValue: number;
    sector?: string;
    assetClass?: string;
    beta?: number;
    priceAsOf: Date;
    priceWasStale: boolean;
}

interface PortfolioContext {
    runId: string;
    portfolioCurrentValue: number;
    pricesAsOf: string;
    holdings: HoldingSnapshot[];
    benchmarkId?: string;
}

// Max cap for PnL-at-risk to avoid runaway stacking
const PNL_AT_RISK_CAP = 0.30; // 30% of portfolio

// -----------------------------------------------------------------------------
// SENSITIVITY CALCULATION
// -----------------------------------------------------------------------------

function calculateSensitivity(
    holding: HoldingSnapshot,
    event: EventItem,
    portfolioBetas: Map<string, number>
): { sensitivity: number; source: SensitivitySource; betaValue?: number } {

    switch (event.affectedScope.type) {
        case 'BENCHMARK': {
            // Use holding's beta if available
            if (holding.instrumentId && portfolioBetas.has(holding.instrumentId)) {
                const beta = portfolioBetas.get(holding.instrumentId)!;
                return { sensitivity: beta, source: 'BETA_COMPUTED', betaValue: beta };
            }

            // Fallback based on asset class
            if (holding.assetClass === 'Equity' || !holding.assetClass) {
                return { sensitivity: 1.0, source: 'BETA_FALLBACK_EQUITY', betaValue: 1.0 };
            }
            return { sensitivity: 0.5, source: 'BETA_FALLBACK_OTHER', betaValue: 0.5 };
        }

        case 'SECTOR': {
            // Exact sector match
            const holdingSector = (holding.sector || '').toLowerCase().trim();
            const eventSector = event.affectedScope.value.toLowerCase().trim();

            if (holdingSector && holdingSector === eventSector) {
                return { sensitivity: 1.0, source: 'SECTOR_MATCH' };
            }
            return { sensitivity: 0.0, source: 'SECTOR_NO_MATCH' };
        }

        case 'INSTRUMENT': {
            // Direct instrument match
            if (holding.instrumentId === event.affectedScope.value) {
                return { sensitivity: 1.0, source: 'INSTRUMENT_DIRECT' };
            }
            return { sensitivity: 0.0, source: 'INSTRUMENT_NO_MATCH' };
        }

        default:
            return { sensitivity: 0.0, source: 'BETA_FALLBACK_OTHER' };
    }
}

// -----------------------------------------------------------------------------
// IMPACT COMPUTATION
// -----------------------------------------------------------------------------

function computeHoldingImpact(
    holding: HoldingSnapshot,
    event: EventItem,
    portfolioValue: number,
    portfolioBetas: Map<string, number>,
    benchmarkId?: string
): HoldingImpactTrace {

    const weight = portfolioValue > 0 ? holding.currentValue / portfolioValue : 0;
    const { sensitivity, source, betaValue } = calculateSensitivity(holding, event, portfolioBetas);
    const directionSign = getDirectionSign(event.direction);

    // Impact formula: sign × (magnitude/100) × sensitivity × holdingValue
    const impactPct = directionSign * (event.magnitudePct / 100) * sensitivity;
    const impactValue = impactPct * holding.currentValue;

    return {
        holdingId: holding.id,
        instrumentId: holding.instrumentId,
        symbol: holding.symbol,
        holdingCurrentValue: holding.currentValue,
        weight,
        sensitivityUsed: sensitivity,
        sensitivitySource: source,
        betaValue: source.startsWith('BETA_') ? betaValue : undefined,
        betaWindowDays: source === 'BETA_COMPUTED' ? 252 : undefined,
        benchmarkId: event.affectedScope.type === 'BENCHMARK' ? benchmarkId : undefined,
        eventId: event.id,
        magnitudePct: event.magnitudePct,
        confidence: event.confidence,
        horizon: event.horizon,
        direction: event.direction,
        directionSign,
        impactPct,
        impactValue,
        pricesAsOf: holding.priceAsOf.toISOString(),
        priceWasStale: holding.priceWasStale,
        fallbackBetaUsed: source.includes('FALLBACK')
    };
}

function computeEventImpact(
    event: EventItem,
    context: PortfolioContext,
    portfolioBetas: Map<string, number>
): EventImpactResult {

    const holdingImpacts: HoldingImpactTrace[] = [];
    let portfolioImpactValue = 0;
    let affectedCount = 0;
    let holdingsWithStalePrice = 0;
    let coveredValue = 0;

    for (const holding of context.holdings) {
        const impact = computeHoldingImpact(
            holding,
            event,
            context.portfolioCurrentValue,
            portfolioBetas,
            context.benchmarkId
        );

        holdingImpacts.push(impact);
        portfolioImpactValue += impact.impactValue;

        if (impact.sensitivityUsed > 0) {
            affectedCount++;
        }
        if (impact.priceWasStale) {
            holdingsWithStalePrice++;
        }
        coveredValue += holding.currentValue;
    }

    const portfolioImpactPct = context.portfolioCurrentValue > 0
        ? portfolioImpactValue / context.portfolioCurrentValue
        : 0;

    // PnL-at-Risk: confidence-weighted downside
    const downsideImpactValue = Math.min(0, portfolioImpactValue);
    const pnlAtRiskValue = Math.abs(downsideImpactValue) * event.confidence;

    // Sort for top gainers/losers
    const sortedByImpact = [...holdingImpacts].sort((a, b) => b.impactValue - a.impactValue);
    const topGainers = sortedByImpact.filter(h => h.impactValue > 0).slice(0, 10);
    const topLosers = sortedByImpact.filter(h => h.impactValue < 0).slice(-10).reverse();

    const coveragePct = context.portfolioCurrentValue > 0
        ? (coveredValue / context.portfolioCurrentValue) * 100
        : 0;

    return {
        eventId: event.id,
        eventTitle: event.title,
        portfolioImpactPct,
        portfolioImpactValue,
        downsideImpactValue,
        pnlAtRiskValue,
        affectedHoldingsCount: affectedCount,
        topGainers,
        topLosers,
        coveragePct,
        holdingsWithStalePrice
    };
}

// -----------------------------------------------------------------------------
// MAIN ENGINE
// -----------------------------------------------------------------------------

export class EventImpactEngine {

    /**
     * Compute impacts for all events against a run's portfolio.
     */
    static async computeImpacts(
        runId: string,
        events: EventItem[],
        livePrices?: Map<string, { price: number; asOf: string }>
    ): Promise<EventImpactSummary> {

        // 1. Load portfolio context
        const context = await this.loadPortfolioContext(runId, livePrices);

        // 2. Load betas from snapshot if available
        const portfolioBetas = await this.loadPortfolioBetas(runId);

        // 3. Compute impact for each event
        const eventResults: EventImpactResult[] = [];
        let totalPnlAtRisk = 0;
        let totalFallbackBetaUsed = 0;
        let totalStaleHoldings = 0;

        for (const event of events) {
            const result = computeEventImpact(event, context, portfolioBetas);
            eventResults.push(result);
            totalPnlAtRisk += result.pnlAtRiskValue;
            totalStaleHoldings = Math.max(totalStaleHoldings, result.holdingsWithStalePrice);
        }

        // Count fallback beta usage
        for (const holding of context.holdings) {
            if (!portfolioBetas.has(holding.instrumentId || '')) {
                totalFallbackBetaUsed++;
            }
        }

        // Cap total PnL-at-risk at 30%
        const cappedPnlAtRisk = Math.min(
            totalPnlAtRisk,
            context.portfolioCurrentValue * PNL_AT_RISK_CAP
        );

        // Sort events by risk
        const topEventsByRisk = [...eventResults]
            .sort((a, b) => b.pnlAtRiskValue - a.pnlAtRiskValue)
            .slice(0, 5);

        // Calculate average coverage
        const avgCoverage = eventResults.length > 0
            ? eventResults.reduce((sum, r) => sum + r.coveragePct, 0) / eventResults.length
            : 0;

        return {
            runId,
            computedAt: new Date().toISOString(),
            pricesAsOf: context.pricesAsOf,
            portfolioCurrentValue: context.portfolioCurrentValue,
            totalEventsProcessed: events.length,
            totalPnlAtRisk: cappedPnlAtRisk,
            topEventsByRisk,
            averageCoveragePct: avgCoverage,
            holdingsWithMissingPrices: totalStaleHoldings,
            fallbackBetaUsedCount: totalFallbackBetaUsed
        };
    }

    /**
     * Load portfolio holdings with current prices from most recent snapshot.
     */
    private static async loadPortfolioContext(
        runId: string,
        livePrices?: Map<string, { price: number; asOf: string }>
    ): Promise<PortfolioContext> {
        // Get run with upload and holdings
        const run = await prisma.run.findUnique({
            where: { id: runId },
            include: {
                upload: {
                    include: {
                        holdings: {
                            include: { instrument: true }
                        }
                    }
                },
                snapshots: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        if (!run || !run.upload) {
            throw new Error(`Run ${runId} not found or has no upload`);
        }

        const priceMap = new Map<string, { price: number; asOf: Date; stale: boolean }>();
        const now = new Date();
        const STALE_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours

        // 1. Use Live Prices if provided
        if (livePrices) {
            for (const [symbol, data] of livePrices.entries()) {
                // Map symbol to instrument ID if possible, or assume symbol is the key
                // Ideally we'd map holding.resolvedInstrumentId -> price
                // For now, let's look for matching holdings
                // This matching logic depends on what keys are in livePrices. 
                // Assuming livePrices keyed by "Exchange:Symbol" or similar.

                // We will populate priceMap by instrumentId later loop
            }
        }

        // Get latest prices from DB as backup
        const instrumentIds = run.upload.holdings
            .filter(h => h.resolvedInstrumentId)
            .map(h => h.resolvedInstrumentId!);

        const dbPrices = await prisma.marketPrice.findMany({
            where: { instrumentId: { in: instrumentIds } },
            orderBy: { asOf: 'desc' }
        });

        for (const p of dbPrices) {
            if (!priceMap.has(p.instrumentId)) {
                const stale = (now.getTime() - p.asOf.getTime()) > STALE_THRESHOLD;
                priceMap.set(p.instrumentId, { price: Number(p.price), asOf: p.asOf, stale });
            }
        }

        // OVERRIDE with live prices if available and match found
        if (livePrices) {
            // Need to match provided live prices to holdings
            for (const h of run.upload.holdings) {
                if (h.resolvedInstrumentId && h.instrument) {
                    // Try to find by symbol
                    const sym = h.instrument.identifier; // e.g. NSE_RELIANCE
                    // The livePrices keys likely need to match this or we need a map
                    if (livePrices.has(sym)) {
                        const lp = livePrices.get(sym)!;
                        priceMap.set(h.resolvedInstrumentId, {
                            price: lp.price,
                            asOf: new Date(lp.asOf),
                            stale: false // It's live
                        });
                    }
                }
            }
        }

        // Build holdings snapshot
        const holdings: HoldingSnapshot[] = [];
        let portfolioValue = 0;
        let latestPriceDate = new Date(0);

        for (const h of run.upload.holdings) {
            const priceInfo = h.resolvedInstrumentId ? priceMap.get(h.resolvedInstrumentId) : null;
            const currentPrice = priceInfo?.price || Number(h.costPrice);
            const currentValue = Number(h.quantity) * currentPrice;

            holdings.push({
                id: h.id,
                instrumentId: h.resolvedInstrumentId || undefined,
                symbol: h.rawIdentifier,
                quantity: Number(h.quantity),
                currentPrice,
                currentValue,
                sector: h.sector || undefined,
                assetClass: h.assetClass || undefined,
                priceAsOf: priceInfo?.asOf || new Date(),
                priceWasStale: priceInfo?.stale || !priceInfo
            });

            portfolioValue += currentValue;
            if (priceInfo?.asOf && priceInfo.asOf > latestPriceDate) {
                latestPriceDate = priceInfo.asOf;
            }
        }

        // Find benchmark
        const benchmark = await prisma.instrument.findFirst({
            where: { identifier: 'NSE_NIFTY' }
        });

        return {
            runId,
            portfolioCurrentValue: portfolioValue,
            pricesAsOf: latestPriceDate.toISOString(),
            holdings,
            benchmarkId: benchmark?.id
        };
    }

    /**
     * Load beta values from the most recent snapshot.
     */
    private static async loadPortfolioBetas(runId: string): Promise<Map<string, number>> {
        const betas = new Map<string, number>();

        // Get latest snapshot
        const snapshot = await prisma.runSnapshot.findFirst({
            where: { runId },
            orderBy: { createdAt: 'desc' }
        });

        if (snapshot?.snapshotJson) {
            try {
                const data = JSON.parse(snapshot.snapshotJson);
                // If snapshot has per-holding betas, load them
                if (data.holdingBetas) {
                    for (const [instId, beta] of Object.entries(data.holdingBetas)) {
                        if (typeof beta === 'number') {
                            betas.set(instId, beta);
                        }
                    }
                }
                // Use portfolio beta as fallback
                if (data.riskMetrics?.beta != null) {
                    // Store as default for all holdings without specific beta
                    // This is used if no per-holding betas available
                }
            } catch { }
        }

        return betas;
    }
}
