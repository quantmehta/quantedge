
import { Holding, EventImpactRow } from '@prisma/client';
import { Recommendation, SignalProfile } from './RecommendationContracts';
import { toDecimal, Decimal } from '../decimal-utils';
// We should import the seed universe but it's a JSON file. 
// We will load it inside the class or pass it in.

interface RulesetLimits {
    maxSingleAssetWeight: number; // e.g. 0.20
    maxSectorWeight: number;      // e.g. 0.35
    minAssetWeight: number;       // e.g. 0.02
}

const DEFAULT_RULESET: RulesetLimits = {
    maxSingleAssetWeight: 0.20,
    maxSectorWeight: 0.35,
    minAssetWeight: 0.02
};

export class OptimizationEngine {

    static generateRecommendations(
        holdings: Holding[],
        prices: Record<string, number>, // symbol -> price
        signals: Record<string, SignalProfile>,
        eventImpacts: EventImpactRow[],
        portfolioValue: number,
        universe: any[] // Seed data
    ): Recommendation[] {
        const recommendations: Recommendation[] = [];
        const rules = DEFAULT_RULESET;

        // 1. Calculate Current Weights
        const weights = new Map<string, number>();
        const sectorWeights = new Map<string, number>();

        for (const h of holdings) {
            if (!h.resolvedInstrumentId) continue;

            const qty = toDecimal(h.quantity);
            const price = toDecimal(prices[h.rawIdentifier] || h.costPrice);
            const val = qty.mul(price);
            const w = val.div(toDecimal(portfolioValue)).toNumber();

            weights.set(h.id, w);

            const sector = h.sector || 'Unclassified';
            sectorWeights.set(sector, (sectorWeights.get(sector) || 0) + w);
        }

        // 2. Evaluate Each Holding
        for (const h of holdings) {
            const symbol = h.rawIdentifier; // Or resolved symbol from instrument
            const signal = signals[symbol];
            const weight = weights.get(h.id) || 0;
            const impactRow = eventImpacts.find(r => r.holdingId === h.id);
            const price = toDecimal(prices[symbol] || h.costPrice).toNumber();


            // A. SCORING (-10 to +10)
            let score = 0;
            const drivers: string[] = [];

            // Momentum (+3 max)
            if (signal) {
                if (signal.momentumScore > 0.1) { score += 2; drivers.push("Positive Momentum"); }
                else if (signal.momentumScore < -0.1) { score -= 2; drivers.push("Negative Momentum"); }

                // Volatility (-2 max)
                if (signal.volatilityTrend > 0.05) { score -= 1; drivers.push("Rising Volatility"); }

                // Drawdown (-3 max)
                if (signal.drawdownSeverity > 0.2) { score -= 2; drivers.push("Significant Drawdown"); }
            }

            // Event Impact (+/- 5 max)
            // Using rawImpact or confidenceWeightedImpact
            if (impactRow) {
                if (impactRow.rawImpact < -1000) { score -= 3; drivers.push("High Event Risk"); } // Arbitrary threshold for MVP
                else if (impactRow.rawImpact > 1000) { score += 2; drivers.push("Positive Event Tailwinds"); }
            }

            // B. BREACH CHECK -> MANDATORY ACTION
            const isConcentrated = weight > rules.maxSingleAssetWeight;
            if (isConcentrated) {
                score = -10; // Force Action
                drivers.push(`Position Weight ${(weight * 100).toFixed(1)}% > Cap ${(rules.maxSingleAssetWeight * 100)}%`);
            }

            // C. ACTION MAPPING
            // Default HOLD
            let type: any = 'HOLD';
            let actionDesc = "Maintains target allocation";
            let delta = 0;

            if (score <= -5 || isConcentrated) {
                if (isConcentrated) {
                    type = 'REDUCE';
                    // Reduce to cap - buffer
                    const targetW = rules.maxSingleAssetWeight - 0.01;
                    delta = targetW - weight;
                    actionDesc = `Reduce to ${(targetW * 100).toFixed(1)}% to fix breach`;
                } else {
                    // Signal based exit/reduce
                    if (score < -8) {
                        type = 'EXIT';
                        actionDesc = "Full Exit due to negative signals";
                        delta = -weight;
                    } else {
                        type = 'REDUCE';
                        delta = -0.05; // Step down 5%
                        actionDesc = "Reduce exposure due to weak outlook";
                    }
                }
            } else if (score >= 5) {
                // Buy/Add
                if (weight < rules.maxSingleAssetWeight) {
                    type = 'BUY'; // "Add"
                    actionDesc = "Increase weight on high conviction";
                    delta = 0.02; // Step up 2%
                }
            }

            recommendations.push({
                id: crypto.randomUUID ? crypto.randomUUID() : `rec-${Date.now()}-${Math.random()}`,
                type: type,
                target: {
                    instrumentId: h.resolvedInstrumentId || undefined,
                    symbol: symbol,
                    name: h.name || symbol,
                    currentPrice: price
                },
                action: {
                    type: type,
                    description: actionDesc,
                    weightDelta: delta,
                    suggestedWeight: Math.max(0, weight + delta)
                },
                rationale: {
                    summary: drivers.join(', ') || "Assessment Neutral",
                    drivers: drivers,
                    quantitative: [`Score: ${score}/10`, `Weight: ${(weight * 100).toFixed(1)}%`]
                },
                impact: {
                    returnEstimate: score > 5 ? "Positive" : (score < -5 ? "Negative" : "Neutral"),
                    riskImpact: isConcentrated ? "Reduces Concentration Risk" : "Maintains Risk Profile"
                },
                confidence: 0.85, // Placeholder for MVP
                rules: {
                    passed: !isConcentrated,
                    violations: isConcentrated ? [`Max Weight > ${(rules.maxSingleAssetWeight * 100)}%`] : []
                },
                trace: {
                    priceAsOf: new Date().toISOString(),
                    signalScores: { finalScore: score, mom: signal?.momentumScore || 0 }
                }
            });
        }

        // 3. Diversification / Buy New
        // Simple Logic: If cash available (conceptually) or highly concentrated, suggest 1 diversifier
        if (recommendations.some(r => r.type === 'REDUCE' || r.type === 'EXIT')) {
            // Find a candidate from Universe that is NOT in current holdings
            const candidate = universe.find(u => !holdings.some(h => h.rawIdentifier === u.symbol));
            if (candidate) {
                recommendations.push({
                    id: crypto.randomUUID ? crypto.randomUUID() : `rec-div-${Date.now()}`,
                    type: 'DIVERSIFY',
                    target: {
                        universeId: candidate.id,
                        symbol: candidate.symbol,
                        name: candidate.name,
                        currentPrice: 0 // Would need lookup
                    },
                    action: {
                        type: 'BUY',
                        description: "Add to diversify portfolio",
                        weightDelta: 0.05,
                        suggestedWeight: 0.05
                    },
                    rationale: {
                        summary: "Suggesting Asset to improve diversification",
                        drivers: ["Diversification", "Uncorrelated Asset"],
                        quantitative: ["Sector: " + candidate.sector]
                    },
                    impact: {
                        returnEstimate: "Market Perform",
                        riskImpact: "Improves Diversification"
                    },
                    confidence: 0.7,
                    rules: { passed: true, violations: [] },
                    trace: { priceAsOf: new Date().toISOString(), signalScores: {} }
                });
            }
        }

        return recommendations;
    }
}
