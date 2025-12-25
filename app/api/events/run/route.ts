import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, ErrorCodes, appendAuditEntry } from '@/lib/api-response';
import { manualEventProvider } from '@/lib/providers/manual-event-provider';
import { rssEventProvider } from '@/lib/providers/rss-event-provider';
import { mergeEvents } from '@/lib/event-provider';
import { EventImpactEngine } from '@/lib/event-impact-engine';
import { GrowwService } from '@/lib/groww/GrowwService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/events/run?runId=...
 * Compute event impacts for a run and persist RunEventImpact artifact
 */
export async function POST(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const runId = searchParams.get('runId');

        if (!runId) {
            return errorResponse(ErrorCodes.BAD_REQUEST, 'runId is required', 400);
        }

        // Verify run exists
        const run = await prisma.run.findUnique({ where: { id: runId } });
        if (!run) {
            return errorResponse(ErrorCodes.NOT_FOUND, 'Run not found', 404);
        }

        // 1. Gather events from all providers
        const allEvents = [];
        const providerErrors: string[] = [];

        // Manual events
        try {
            const manual = await manualEventProvider.listEvents({ limit: 100 });
            allEvents.push(...manual);
        } catch (e: any) {
            providerErrors.push(`Manual: ${e.message}`);
        }

        // RSS events
        if (rssEventProvider.isAvailable()) {
            try {
                const rss = await rssEventProvider.listEvents({ limit: 50 });
                allEvents.push(...rss);
            } catch (e: any) {
                providerErrors.push(`RSS: ${e.message}`);
            }
        }

        // Deduplicate
        const events = mergeEvents(allEvents);

        if (events.length === 0) {
            // Still create artifact but with empty results
            const emptyResult = {
                runId,
                computedAt: new Date().toISOString(),
                pricesAsOf: new Date().toISOString(),
                portfolioCurrentValue: 0,
                totalEventsProcessed: 0,
                totalPnlAtRisk: 0,
                topEventsByRisk: [],
                averageCoveragePct: 0,
                holdingsWithMissingPrices: 0,
                fallbackBetaUsedCount: 0
            };

            await prisma.runEventImpact.create({
                data: {
                    runId,
                    eventListJson: '[]',
                    impactSummaryJson: JSON.stringify(emptyResult),
                    holdingImpactJson: '[]',
                    traceJson: JSON.stringify({ providerErrors })
                }
            });

            const updatedAudit = appendAuditEntry(run.auditJson, 'EVENT_IMPACT_COMPUTE', {
                eventsProcessed: 0,
                providerErrors
            });

            await prisma.run.update({
                where: { id: runId },
                data: { auditJson: updatedAudit }
            });

            return successResponse({
                summary: emptyResult,
                events: [],
                providerErrors
            });
        }

        // 2. Fetch Live Prices if requested (Default: true)
        const useCache = searchParams.get('useCache') === 'true';
        let livePrices: Map<string, { price: number; asOf: string }> | undefined;

        if (!useCache) {
            try {
                // We need holdings to know what to fetch
                const runWithHoldings = await prisma.run.findUnique({
                    where: { id: runId },
                    include: {
                        upload: {
                            include: {
                                holdings: {
                                    include: { instrument: true }
                                }
                            }
                        }
                    }
                });

                if (runWithHoldings?.upload?.holdings) {
                    // Extract symbols (Assuming instrument.identifier or rawIdentifier is the trading key)
                    // We need valid exchange:symbol format ideally. 
                    // Using rawIdentifier as fallback
                    const symbols = new Set<string>();
                    runWithHoldings.upload.holdings.forEach(h => {
                        if (h.instrument?.identifier) symbols.add(h.instrument.identifier);
                        else if (h.rawIdentifier) symbols.add(h.rawIdentifier);
                    });

                    const symbolsList = Array.from(symbols);
                    if (symbolsList.length > 0) {
                        const ltpResults = await GrowwService.getLtp(symbolsList);
                        if (ltpResults.length > 0) {
                            livePrices = new Map();
                            ltpResults.forEach(r => {
                                livePrices!.set(r.symbol, { price: r.price, asOf: r.asOf });
                            });
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to fetch live prices:", e);
                // We minimize failure impact by just proceeding with undefined livePrices (Engine falls back to DB)
                // But we should log it technically.
                providerErrors.push(`Live Price Fetch: ${(e as Error).message}`);
            }
        }

        // 3. Compute impacts
        const summary = await EventImpactEngine.computeImpacts(runId, events, livePrices);

        // 3. Collect all holding impacts for traceability
        const allHoldingImpacts = summary.topEventsByRisk.flatMap(e =>
            [...e.topGainers, ...e.topLosers]
        );

        // 4. Persist RunEventImpact artifact (append-only)
        await prisma.runEventImpact.create({
            data: {
                runId,
                eventListJson: JSON.stringify(events),
                impactSummaryJson: JSON.stringify(summary),
                holdingImpactJson: JSON.stringify(allHoldingImpacts),
                traceJson: JSON.stringify({
                    providerErrors,
                    computedAt: summary.computedAt,
                    pricesAsOf: summary.pricesAsOf,
                    fallbackBetaUsedCount: summary.fallbackBetaUsedCount
                }),
                // Requirement 12: Persist rows
                impactRows: {
                    create: allHoldingImpacts.map(h => ({
                        eventId: h.eventId,
                        holdingId: h.holdingId,
                        holdingValue: h.holdingCurrentValue,
                        sensitivity: h.sensitivityUsed,
                        magnitudePct: h.magnitudePct,
                        rawImpact: h.impactValue,
                        confidenceWeightedImpact: h.impactValue * h.confidence, // Downside or Upside weighted
                        priceTimestampMs: h.pricesAsOf ? BigInt(new Date(h.pricesAsOf).getTime()) : null
                    }))
                }
            }
        });

        // 5. Append audit entry
        const updatedAudit = appendAuditEntry(run.auditJson, 'EVENT_IMPACT_COMPUTE', {
            eventsProcessed: events.length,
            totalPnlAtRisk: summary.totalPnlAtRisk,
            portfolioValue: summary.portfolioCurrentValue,
            fallbackBetaUsed: summary.fallbackBetaUsedCount,
            providerErrors: providerErrors.length > 0 ? providerErrors : undefined
        });

        await prisma.run.update({
            where: { id: runId },
            data: {
                auditJson: updatedAudit,
                status: 'EVENTS_COMPUTED'
            }
        });

        // 6. Return response
        return successResponse({
            summary,
            events: events.map(e => ({
                id: e.id,
                title: e.title,
                category: e.category,
                direction: e.direction,
                magnitudePct: e.magnitudePct,
                confidence: e.confidence,
                horizon: e.horizon,
                affectedScope: e.affectedScope
            })),
            providerErrors: providerErrors.length > 0 ? providerErrors : undefined
        });

    } catch (error: any) {
        console.error('Event run computation error:', error);
        return errorResponse(ErrorCodes.INTERNAL_ERROR, error.message, 500);
    }
}
