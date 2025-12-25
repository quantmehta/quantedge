// -----------------------------------------------------------------------------
// ARTIFACT AGGREGATOR - Fetches all persisted run artifacts (no recomputation)
// -----------------------------------------------------------------------------

import { prisma } from '../db';
import type { ReportData } from './ReportContracts';
import { ActionBucketing } from './ActionBucketing';
import type { Recommendation } from '../recommendations/RecommendationContracts';

export class ArtifactAggregator {
    /**
     * Aggregates all persisted artifacts for a run into ReportData structure.
     * NO RECOMPUTATION - pure transformation of stored JSON artifacts.
     */
    static async aggregateForRun(runId: string): Promise<ReportData> {
        // Fetch Run with all related data
        const run = await prisma.run.findUnique({
            where: { id: runId },
            include: {
                upload: true,
                rulesetVersion: {
                    include: { ruleset: true },
                },
                snapshots: { orderBy: { createdAt: 'desc' }, take: 1 },
                scenarios: { orderBy: { createdAt: 'desc' } },
                events: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
                recommendations: { orderBy: { createdAt: 'desc' } },
            },
        });

        if (!run) {
            throw new Error(`Run not found: ${runId}`);
        }

        const snapshot = run.snapshots[0];
        if (!snapshot) {
            throw new Error(`No snapshot found for run: ${runId}`);
        }

        // Parse snapshot JSON
        const snapshotData = JSON.parse(snapshot.snapshotJson);
        const eventImpact = run.events[0];
        const eventData = eventImpact
            ? {
                summary: JSON.parse(eventImpact.impactSummaryJson || '{}'),
                holdings: JSON.parse(eventImpact.holdingImpactJson || '{}'),
                trace: JSON.parse(eventImpact.traceJson || '{}'),
            }
            : null;

        // Parse recommendations and assign buckets
        const recommendations: (Recommendation & { bucket: string })[] = run.recommendations.map((rec) => {
            const recData = JSON.parse(rec.resultJson) as Recommendation;
            const bucket = ActionBucketing.assignBucket(recData);
            return { ...recData, bucket };
        });

        // Build metadata
        const metadata = {
            reportId: '', // Will be set by generator
            runId: run.id,
            generatedAt: new Date().toISOString(),
            marketDataAsOf: run.asOfMarketTimestamp?.toISOString() || new Date().toISOString(),
            rulesetName: run.rulesetVersion?.ruleset.name || 'Default Ruleset',
            rulesetVersionId: run.rulesetVersion?.id || '',
            rulesetVersionNumber: run.rulesetVersion?.version || 1,
            dataSources: ['Groww API'], // TODO: Track dynamically
        };

        // Build executive summary
        const executiveSummary = {
            topActions: recommendations
                .filter((r) => r.bucket === 'IMMEDIATE' || r.type !== 'HOLD')
                .slice(0, 3)
                .map((r) => ({
                    type: r.type,
                    symbol: r.target.symbol,
                    description: r.rationale.summary,
                    bucket: r.bucket as any,
                })),
            topRisks: this.extractTopRisks(snapshotData, eventData),
        };

        // Build portfolio snapshot
        const portfolioSnapshot = {
            investedCapital: +(snapshotData.summary?.invested || 0),
            currentValue: +(snapshotData.summary?.current || 0),
            unrealizedPnL: +(snapshotData.summary?.unrealizedPnL || 0),
            unrealizedPnLPct: +(snapshotData.summary?.unrealizedPnLPct || 0),
            assetAllocation: this.extractAllocation(snapshotData, 'asset'),
            sectorAllocation: this.extractAllocation(snapshotData, 'sector'),
            topGainers: this.extractTopMovers(snapshotData, 'gainers'),
            topLosers: this.extractTopMovers(snapshotData, 'losers'),
        };

        // Build risk diagnostics
        const riskDiagnostics = {
            concentration: this.extractConcentration(snapshotData),
            volatility: {
                portfolioVolatility: +(snapshotData.risk?.volatility || 0),
                limit: 0.25, // From ruleset - TODO: pull from actual ruleset
            },
            drawdown: {
                maxDrawdown: +(snapshotData.risk?.drawdown || 0),
                limit: 0.20, // From ruleset - TODO: pull from actual ruleset
            },
        };

        // Build scenarios
        const scenarios = run.scenarios.map((s) => {
            const params = JSON.parse(s.paramsJson);
            const result = JSON.parse(s.resultJson);
            return {
                scenarioType: s.scenarioType,
                parameters: params,
                portfolioImpact: +(result.portfolioImpact || 0),
                portfolioImpactPct: +(result.portfolioImpactPct || 0),
                description: result.description || '',
            };
        });

        // Build event impact
        const eventImpactSummary = eventData
            ? {
                totalPnLAtRisk: +(eventData.summary.totalPnLAtRisk || 0),
                portfolioValueAtRisk: +(eventData.summary.portfolioValueAtRisk || 0),
                topEvents: (eventData.summary.topEvents || []).slice(0, 5),
                traceabilityNote:
                    'Impact = Sensitivity × Magnitude × Confidence × Portfolio Weight',
            }
            : {
                totalPnLAtRisk: 0,
                portfolioValueAtRisk: 0,
                topEvents: [],
                traceabilityNote: 'No event impact data available',
            };

        // Fetch overrides separately (not in include due to Prisma cache)
        // TODO: Uncomment after dev server restart
        // const overrides = await prisma.runOverride.findMany({
        //   where: { runId },
        //   orderBy: { createdAt: 'desc' },
        // });
        const overrides: any[] = []; // Temporary workaround for Prisma client cache

        // Build action buckets
        const actions = {
            immediate: recommendations
                .filter((r) => r.bucket === 'IMMEDIATE')
                .map((r) => this.transformRecommendation(r, overrides)),
            nearTerm: recommendations
                .filter((r) => r.bucket === 'NEAR_TERM')
                .map((r) => this.transformRecommendation(r, overrides)),
            longTerm: recommendations
                .filter((r) => r.bucket === 'LONG_TERM')
                .map((r) => this.transformRecommendation(r, overrides)),
        };

        // Build assumptions and disclaimers
        const assumptionsAndDisclaimers = {
            assumptions: [
                'Market data sourced from Groww API with best-effort accuracy',
                'Corporate actions coverage may be limited to major events',
                'Recommendations based on historical patterns and current ruleset',
            ],
            dataFreshness: {
                pricingAsOf: metadata.marketDataAsOf,
                staleInstruments: { count: 0, valuePercent: 0 }, // TODO: Calculate from snapshot
                fallbackData: { count: 0, valuePercent: 0 },
            },
            disclaimers: [
                'This report is advisory only and does not constitute financial advice',
                'Investment decisions remain the sole responsibility of the user',
                'Past performance does not guarantee future returns',
                'Market conditions can change rapidly; act with appropriate caution',
            ],
            auditSummary: {
                runId: run.id,
                uploadHash: run.upload?.fileHashSha256 || 'N/A',
                rulesetVersionId: run.rulesetVersion?.id || '',
                scenariosUsed: scenarios.map((s) => s.scenarioType),
                overrides: overrides.map((o) => ({
                    recommendationId: o.recommendationId,
                    ruleCode: o.ruleCode,
                    actor: o.actor,
                    reason: o.reason,
                    timestamp: o.createdAt.toISOString(),
                })),
            },
        };

        return {
            metadata,
            executiveSummary,
            portfolioSnapshot,
            riskDiagnostics,
            scenarios,
            eventImpact: eventImpactSummary,
            actions,
            assumptionsAndDisclaimers,
        };
    }

    private static extractTopRisks(snapshotData: any, eventData: any) {
        const risks = [];

        // Concentration risk
        const maxWeight = Math.max(...Object.values(snapshotData.weights || {}).map((w: any) => +w));
        if (maxWeight > 0.15) {
            risks.push({
                category: 'Concentration',
                description: `Single asset exceeds 15% portfolio weight`,
                value: maxWeight,
                limitValue: 0.15,
            });
        }

        // Event PnL-at-risk
        if (eventData && eventData.summary.totalPnLAtRisk) {
            risks.push({
                category: 'Event PnL-at-risk',
                description: 'Portfolio at risk from identified market events',
                value: Math.abs(eventData.summary.totalPnLAtRisk),
            });
        }

        // Volatility/Drawdown
        if (snapshotData.risk?.volatility > 0.20) {
            risks.push({
                category: 'Volatility',
                description: 'Portfolio volatility elevated',
                value: snapshotData.risk.volatility,
                limitValue: 0.20,
            });
        }

        return risks.slice(0, 3);
    }

    private static extractAllocation(snapshotData: any, type: 'asset' | 'sector') {
        const allocations = snapshotData[type === 'asset' ? 'assetAllocation' : 'sectorAllocation'] || {};
        return Object.entries(allocations)
            .map(([name, data]: [string, any]) => ({
                name,
                value: +(data.value || 0),
                weight: +(data.weight || 0),
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }

    private static extractTopMovers(snapshotData: any, type: 'gainers' | 'losers') {
        const holdings = snapshotData.holdings || [];
        const sorted = [...holdings].sort((a: any, b: any) => {
            const aPnl = +(a.unrealizedPnLPct || 0);
            const bPnl = +(b.unrealizedPnLPct || 0);
            return type === 'gainers' ? bPnl - aPnl : aPnl - bPnl;
        });

        return sorted.slice(0, 5).map((h: any) => ({
            symbol: h.symbol || h.identifier,
            pnl: +(h.unrealizedPnL || 0),
            pnlPct: +(h.unrealizedPnLPct || 0),
        }));
    }

    private static extractConcentration(snapshotData: any) {
        const weights = snapshotData.weights || {};
        const sectorWeights = snapshotData.sectorWeights || {};

        const maxAsset = Object.entries(weights).reduce(
            (max: any, [symbol, weight]: [string, any]) => {
                return +weight > max.weight ? { symbol, weight: +weight } : max;
            },
            { symbol: '', weight: 0 }
        );

        const maxSector = Object.entries(sectorWeights).reduce(
            (max: any, [sector, weight]: [string, any]) => {
                return +weight > max.weight ? { sector, weight: +weight } : max;
            },
            { sector: '', weight: 0 }
        );

        return {
            maxSingleAsset: { ...maxAsset, limit: 0.15 },
            maxSector: { ...maxSector, limit: 0.30 },
        };
    }

    private static transformRecommendation(rec: Recommendation & { bucket: string }, overrides: any[]) {
        const override = overrides.find((o) => o.recommendationId === rec.id);

        return {
            id: rec.id,
            type: rec.type,
            symbol: rec.target.symbol,
            name: rec.target.name,
            rationale: rec.rationale.summary,
            confidenceScore: rec.confidence,
            contributingFactors: rec.rationale.drivers,
            ruleCompliance: {
                passed: rec.rules.passed,
                violations: rec.rules.violations,
            },
            override: override
                ? {
                    actor: override.actor,
                    reason: override.reason,
                    timestamp: override.createdAt.toISOString(),
                }
                : undefined,
        };
    }
}
