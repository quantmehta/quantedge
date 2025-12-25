// -----------------------------------------------------------------------------
// RULESET TEMPLATES - Predefined conservative/balanced/growth profiles
// -----------------------------------------------------------------------------

export type RiskProfile = 'CONSERVATIVE' | 'BALANCED' | 'GROWTH';

export interface RulesetDefinition {
    profile: RiskProfile;
    hard: {
        maxDrawdownPct: number;
        maxVolatilityAnnualPct: number;
        maxSingleAssetWeightPct: number;
        maxSectorWeightPct: number;
    };
    soft: {
        minExpectedCagrPct: { value: number; weight: number };
        growthTargetPct: { value: number; weight: number };
    };
    meta: {
        createdBy: string;
        notes: string;
    };
}

export const RULESET_TEMPLATES: Record<RiskProfile, RulesetDefinition> = {
    CONSERVATIVE: {
        profile: 'CONSERVATIVE',
        hard: {
            maxDrawdownPct: 0.10,
            maxVolatilityAnnualPct: 0.15,
            maxSingleAssetWeightPct: 0.10,
            maxSectorWeightPct: 0.25,
        },
        soft: {
            minExpectedCagrPct: { value: 0.08, weight: 0.6 },
            growthTargetPct: { value: 0.10, weight: 0.4 },
        },
        meta: {
            createdBy: 'System',
            notes: 'Conservative template with lower risk tolerance',
        },
    },
    BALANCED: {
        profile: 'BALANCED',
        hard: {
            maxDrawdownPct: 0.20,
            maxVolatilityAnnualPct: 0.25,
            maxSingleAssetWeightPct: 0.15,
            maxSectorWeightPct: 0.30,
        },
        soft: {
            minExpectedCagrPct: { value: 0.12, weight: 0.6 },
            growthTargetPct: { value: 0.15, weight: 0.4 },
        },
        meta: {
            createdBy: 'System',
            notes: 'Balanced risk-return profile',
        },
    },
    GROWTH: {
        profile: 'GROWTH',
        hard: {
            maxDrawdownPct: 0.30,
            maxVolatilityAnnualPct: 0.35,
            maxSingleAssetWeightPct: 0.20,
            maxSectorWeightPct: 0.35,
        },
        soft: {
            minExpectedCagrPct: { value: 0.15, weight: 0.6 },
            growthTargetPct: { value: 0.20, weight: 0.4 },
        },
        meta: {
            createdBy: 'System',
            notes: 'Growth-oriented with higher risk tolerance',
        },
    },
};

export function getTemplate(profile: RiskProfile): RulesetDefinition {
    return JSON.parse(JSON.stringify(RULESET_TEMPLATES[profile]));
}
