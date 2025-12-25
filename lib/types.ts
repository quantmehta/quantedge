export type ValidationStatus = 'pending' | 'valid' | 'invalid';
export type RunStatus = 'active' | 'archived';
export type ReportStatus = 'queued' | 'generating' | 'ready';

// --- Portfolio & Holdings ---
export interface Holding {
    identifier: string; // Ticker or ISIN
    name: string;
    quantity: number;
    costPrice: number;
    marketPrice?: number;
    exchange?: string;
    sector?: string;
    assetClass?: string;
}

export interface PortfolioUpload {
    id: string; // UUID
    filename: string;
    filesize: number; // in bytes
    rowCount: number;
    uploadedAt: string; // ISO Date
    validationStatus: ValidationStatus;
}

export interface ValidationResult {
    isValid: boolean;
    errors: Array<{ row: number; column: string; message: string }>;
    warnings: Array<{ row: number; column: string; message: string }>;
    summary: {
        totalRows: number;
        validRows: number;
        errorRows: number;
    };
}

// --- Snapshot ---
export interface MarketSnapshot {
    runId: string;
    portfolioValue: number;
    investedCapital: number;
    pnlAbs: number;
    pnlPct: number;
    realizedPnl?: number;
    unrealizedPnl?: number;
    updatedAt: string; // ISO Date of last market price
    holdingsBreakdown: Array<{ assetClass: string; percentage: number }>;
    topContributors: Array<{ symbol: string; contribution: number }>;
    freshnessStats: {
        fresh: number;
        stale: number;
        fallback: number;
        noData: number;
    };

    // Risk Metrics
    riskMetrics?: {
        volatility: number | null; // Annualized
        maxDrawdown: number | null;
        beta: number | null;
        sharpeRatio: number | null;
    };

    // Chart Datasets
    waterfallChart?: Array<{ name: string; value: number; runningTotal: number; isTotal?: boolean }>;
    performanceChart?: {
        dates: string[];
        portfolio: number[];
        benchmark: number[];
    };
}

// --- Scenarios ---
export interface Scenario {
    id: string;
    name: string;
    description: string;
    params: Record<string, number>; // e.g., { 'SPX': -0.05, 'Rates': 0.01 }
    createdAt: string;
}

export interface ScenarioResult {
    scenarioId: string;
    impactAbs: number;
    impactPct: number;
    affectedHoldingsCount: number;
}

// --- Events ---
export interface EventItem {
    id: string;
    title: string;
    category: 'Macro' | 'Earnings' | 'Geopolitical' | 'Regulatory';
    direction: 'Positive' | 'Negative' | 'Neutral';
    magnitude: 'Low' | 'Medium' | 'High';
    confidence: number; // 0-100
    horizon: 'Short' | 'Medium' | 'Long';
    date: string;
}

// --- Recommendations ---
export interface Recommendation {
    id: string;
    type: 'Buy' | 'Sell' | 'Hold' | 'Rebalance' | 'Hedge';
    asset?: string;
    rationale: string;
    confidence: number; // 0-100
    expectedImpact: string; // e.g., "+1.2% Risk Adj. Return"
    actionable: boolean;
}

// --- Reports ---
export interface Report {
    id: string;
    runId: string;
    type: 'Executive' | 'Detailed' | 'Risk';
    createdAt: string;
    status: ReportStatus;
    downloadUrl?: string; // Placeholder for Phase 0
}

// --- Runs / Audit ---
export interface Run {
    id: string;
    createdAt: string;
    portfolioUploadId?: string;
    status: RunStatus;
    user: string; // Mock "Divit Mehta"
    auditSummary?: string;
}
