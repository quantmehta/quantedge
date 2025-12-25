// -----------------------------------------------------------------------------
// RULES EVALUATOR - Deterministic constraint checking
// -----------------------------------------------------------------------------

import { RulesetDefinition } from './RulesTemplates';

export interface RuleCheck {
    ruleCode: string;
    severity: 'HARD' | 'SOFT';
    pass: boolean;
    currentValue: number;
    limitValue: number;
    message: string;
}

export interface EvaluationResult {
    checks: RuleCheck[];
    overall: {
        hardPass: boolean;
        softScore: number; // 0-1
    };
}

export interface PortfolioMetrics {
    maxDrawdownPct?: number;
    volatilityAnnualPct?: number;
    assetWeights: Record<string, number>; // instrumentId -> weight
    sectorWeights: Record<string, number>; // sector -> weight
    expectedCagrPct?: number;
    growthPct?: number;
}

export class RulesEvaluator {
    /**
     * Evaluate portfolio against ruleset definition.
     * Pure function - same inputs always produce same outputs.
     */
    static evaluate(
        portfolio: PortfolioMetrics,
        rules: RulesetDefinition
    ): EvaluationResult {
        const checks: RuleCheck[] = [];

        // Hard Rules
        const hardChecks = [
            this.checkMaxDrawdown(portfolio, rules),
            this.checkMaxVolatility(portfolio, rules),
            this.checkMaxSingleAssetWeight(portfolio, rules),
            this.checkMaxSectorWeight(portfolio, rules),
        ];

        checks.push(...hardChecks);

        // Soft Rules
        const softChecks = [
            this.checkMinExpectedCagr(portfolio, rules),
            this.checkGrowthTarget(portfolio, rules),
        ];

        checks.push(...softChecks);

        // Overall assessment
        const hardPass = hardChecks.every((c) => c.pass);
        const softScore = this.calculateSoftScore(softChecks, rules);

        return {
            checks,
            overall: { hardPass, softScore },
        };
    }

    private static checkMaxDrawdown(
        portfolio: PortfolioMetrics,
        rules: RulesetDefinition
    ): RuleCheck {
        const current = portfolio.maxDrawdownPct ?? 0;
        const limit = rules.hard.maxDrawdownPct;
        const pass = current <= limit;

        return {
            ruleCode: 'MAX_DRAWDOWN',
            severity: 'HARD',
            pass,
            currentValue: current,
            limitValue: limit,
            message: pass
                ? `Drawdown ${(current * 100).toFixed(1)}% within limit ${(limit * 100).toFixed(1)}%`
                : `Drawdown ${(current * 100).toFixed(1)}% exceeds limit ${(limit * 100).toFixed(1)}%`,
        };
    }

    private static checkMaxVolatility(
        portfolio: PortfolioMetrics,
        rules: RulesetDefinition
    ): RuleCheck {
        const current = portfolio.volatilityAnnualPct ?? 0;
        const limit = rules.hard.maxVolatilityAnnualPct;
        const pass = current <= limit;

        return {
            ruleCode: 'MAX_VOLATILITY',
            severity: 'HARD',
            pass,
            currentValue: current,
            limitValue: limit,
            message: pass
                ? `Volatility ${(current * 100).toFixed(1)}% within limit ${(limit * 100).toFixed(1)}%`
                : `Volatility ${(current * 100).toFixed(1)}% exceeds limit ${(limit * 100).toFixed(1)}%`,
        };
    }

    private static checkMaxSingleAssetWeight(
        portfolio: PortfolioMetrics,
        rules: RulesetDefinition
    ): RuleCheck {
        const weights = Object.values(portfolio.assetWeights);
        const current = weights.length > 0 ? Math.max(...weights) : 0;
        const limit = rules.hard.maxSingleAssetWeightPct;
        const pass = current <= limit;

        return {
            ruleCode: 'MAX_SINGLE_ASSET_WEIGHT',
            severity: 'HARD',
            pass,
            currentValue: current,
            limitValue: limit,
            message: pass
                ? `Max asset weight ${(current * 100).toFixed(1)}% within limit ${(limit * 100).toFixed(1)}%`
                : `Single asset exposure ${(current * 100).toFixed(1)}% exceeds cap ${(limit * 100).toFixed(1)}%`,
        };
    }

    private static checkMaxSectorWeight(
        portfolio: PortfolioMetrics,
        rules: RulesetDefinition
    ): RuleCheck {
        const weights = Object.values(portfolio.sectorWeights);
        const current = weights.length > 0 ? Math.max(...weights) : 0;
        const limit = rules.hard.maxSectorWeightPct;
        const pass = current <= limit;

        return {
            ruleCode: 'MAX_SECTOR_WEIGHT',
            severity: 'HARD',
            pass,
            currentValue: current,
            limitValue: limit,
            message: pass
                ? `Max sector weight ${(current * 100).toFixed(1)}% within limit ${(limit * 100).toFixed(1)}%`
                : `Sector exposure ${(current * 100).toFixed(1)}% exceeds cap ${(limit * 100).toFixed(1)}%`,
        };
    }

    private static checkMinExpectedCagr(
        portfolio: PortfolioMetrics,
        rules: RulesetDefinition
    ): RuleCheck {
        const current = portfolio.expectedCagrPct ?? 0;
        const limit = rules.soft.minExpectedCagrPct.value;
        const pass = current >= limit;

        return {
            ruleCode: 'MIN_EXPECTED_CAGR',
            severity: 'SOFT',
            pass,
            currentValue: current,
            limitValue: limit,
            message: pass
                ? `Expected CAGR ${(current * 100).toFixed(1)}% meets target ${(limit * 100).toFixed(1)}%`
                : `Expected CAGR ${(current * 100).toFixed(1)}% below target ${(limit * 100).toFixed(1)}%`,
        };
    }

    private static checkGrowthTarget(
        portfolio: PortfolioMetrics,
        rules: RulesetDefinition
    ): RuleCheck {
        const current = portfolio.growthPct ?? 0;
        const limit = rules.soft.growthTargetPct.value;
        const pass = current >= limit;

        return {
            ruleCode: 'GROWTH_TARGET',
            severity: 'SOFT',
            pass,
            currentValue: current,
            limitValue: limit,
            message: pass
                ? `Growth ${(current * 100).toFixed(1)}% meets target ${(limit * 100).toFixed(1)}%`
                : `Growth ${(current * 100).toFixed(1)}% below target ${(limit * 100).toFixed(1)}%`,
        };
    }

    private static calculateSoftScore(
        softChecks: RuleCheck[],
        rules: RulesetDefinition
    ): number {
        let totalScore = 0;
        let totalWeight = 0;

        for (const check of softChecks) {
            const weight =
                check.ruleCode === 'MIN_EXPECTED_CAGR'
                    ? rules.soft.minExpectedCagrPct.weight
                    : rules.soft.growthTargetPct.weight;

            // Score: 1 if pass, or ratio of current/limit if below
            const score = check.pass
                ? 1.0
                : Math.min(1.0, check.currentValue / check.limitValue);

            totalScore += score * weight;
            totalWeight += weight;
        }

        return totalWeight > 0 ? totalScore / totalWeight : 1.0;
    }
}
