export type RecommendationType = 'BUY' | 'SELL' | 'HOLD' | 'REDUCE' | 'EXIT' | 'DIVERSIFY';

export interface Recommendation {
    id: string;
    type: RecommendationType;
    target: {
        instrumentId?: string; // For existing holdings
        universeId?: string;   // For new candidates
        symbol: string;
        name: string;
        currentPrice: number;
    };
    action: {
        type: string;
        description: string; // "Reduce to 6% weight"
        weightDelta: number; // e.g. -0.02
        valueDelta?: number;
        suggestedWeight: number;
    };
    rationale: {
        summary: string;
        drivers: string[]; // ["High Momentum", "Sector Overweight"]
        quantitative: string[]; // ["Momentum: 0.8", "Concentration: 12% > 10%"]
    };
    impact: {
        returnEstimate: string; // "-1% to +2%"
        riskImpact: string; // "Lowers Portfolio Volatility"
        beforeMetrics?: {
            assetWeight: number;
            sectorWeight: number;
        };
        afterMetrics?: {
            assetWeight: number;
            sectorWeight: number;
        };
    };
    confidence: number; // 0-1
    rules: {
        passed: boolean;
        violations: string[]; // List of broken hard constraints
    };
    trace: {
        priceAsOf: string;
        signalScores: Record<string, number>;
        eventId?: string;
        eventImpact?: number;
    };
}

export interface SignalProfile {
    symbol: string;
    momentumScore: number;   // -1 to +1 (20D vs 100D)
    volatilityTrend: number; // -1 to +1 (Rising vs Falling Vol)
    drawdownSeverity: number; // 0 to 1 (0 = No DD, 1 = Max DD)
    recoveryScore: number;    // 0 to 1
    dataPoints: number;
}
