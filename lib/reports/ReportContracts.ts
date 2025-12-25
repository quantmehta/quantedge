// -----------------------------------------------------------------------------
// REPORT DATA CONTRACTS - Strict interfaces for PDF/CSV generation
// -----------------------------------------------------------------------------

export type ActionBucket = 'IMMEDIATE' | 'NEAR_TERM' | 'LONG_TERM';

export interface ReportMetadata {
    reportId: string;
    runId: string;
    generatedAt: string; // ISO timestamp
    marketDataAsOf: string; // ISO timestamp
    rulesetName: string;
    rulesetVersionId: string;
    rulesetVersionNumber: number;
    dataSources: string[]; // e.g., ['Groww API', 'Manual Events']
}

export interface TopAction {
    type: string; // BUY, REDUCE, etc.
    symbol: string;
    description: string;
    bucket: ActionBucket;
}

export interface TopRisk {
    category: string; // 'Concentration', 'Volatility', 'Event PnL-at-risk'
    description: string;
    value: number;
    limitValue?: number;
}

export interface ExecutiveSummary {
    topActions: TopAction[];
    topRisks: TopRisk[];
}

export interface PortfolioSnapshot {
    investedCapital: number;
    currentValue: number;
    unrealizedPnL: number;
    unrealizedPnLPct: number;
    assetAllocation: Array<{ name: string; value: number; weight: number }>;
    sectorAllocation: Array<{ name: string; value: number; weight: number }>;
    topGainers: Array<{ symbol: string; pnl: number; pnlPct: number }>;
    topLosers: Array<{ symbol: string; pnl: number; pnlPct: number }>;
}

export interface RiskDiagnostics {
    concentration: {
        maxSingleAsset: { symbol: string; weight: number; limit: number };
        maxSector: { sector: string; weight: number; limit: number };
    };
    volatility: {
        portfolioVolatility: number;
        limit: number;
    };
    drawdown: {
        maxDrawdown: number;
        limit: number;
    };
}

export interface ScenarioResult {
    scenarioType: string;
    parameters: Record<string, any>;
    portfolioImpact: number;
    portfolioImpactPct: number;
    description: string;
}

export interface EventImpactSummary {
    totalPnLAtRisk: number;
    portfolioValueAtRisk: number;
    topEvents: Array<{
        title: string;
        category: string;
        impactedHoldings: number;
        estimatedImpact: number;
    }>;
    traceabilityNote: string;
}

export interface BucketedRecommendation {
    id: string;
    type: string;
    symbol: string;
    name: string;
    rationale: string;
    confidenceScore: number;
    contributingFactors: string[];
    ruleCompliance: {
        passed: boolean;
        violations: string[];
    };
    override?: {
        actor: string;
        reason: string;
        timestamp: string;
    };
}

export interface ActionBuckets {
    immediate: BucketedRecommendation[];
    nearTerm: BucketedRecommendation[];
    longTerm: BucketedRecommendation[];
}

export interface DataFreshness {
    pricingAsOf: string;
    staleInstruments: {
        count: number;
        valuePercent: number;
    };
    fallbackData: {
        count: number;
        valuePercent: number;
    };
}

export interface AuditSummary {
    runId: string;
    uploadHash: string;
    rulesetVersionId: string;
    scenariosUsed: string[];
    overrides: Array<{
        recommendationId: string;
        ruleCode: string;
        actor: string;
        reason: string;
        timestamp: string;
    }>;
}

export interface AssumptionsAndDisclaimers {
    assumptions: string[];
    dataFreshness: DataFreshness;
    disclaimers: string[];
    auditSummary: AuditSummary;
}

export interface ReportData {
    metadata: ReportMetadata;
    executiveSummary: ExecutiveSummary;
    portfolioSnapshot: PortfolioSnapshot;
    riskDiagnostics: RiskDiagnostics;
    scenarios: ScenarioResult[];
    eventImpact: EventImpactSummary;
    actions: ActionBuckets;
    assumptionsAndDisclaimers: AssumptionsAndDisclaimers;
}
