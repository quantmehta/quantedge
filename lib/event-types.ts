// -----------------------------------------------------------------------------
// EVENT TYPES FOR PHASE 6: EVENT INTELLIGENCE
// -----------------------------------------------------------------------------

// Enums
export type EventCategory = 'MACRO' | 'GEOPOLITICAL' | 'SECTOR' | 'COMPANY';
export type EventDirection = 'POSITIVE' | 'NEGATIVE' | 'MIXED';
export type EventHorizon = '1W' | '1M' | '3M' | '6M';
export type AffectedScopeType = 'BENCHMARK' | 'SECTOR' | 'INSTRUMENT';

// Event Source (provenance tracking)
export interface EventSource {
    provider: string;
    url?: string;
    headline?: string;
    publishedAt?: string; // ISO timestamp
    retrievedAt: string;  // ISO timestamp
}

// Affected Scope Definition
export interface AffectedScope {
    type: AffectedScopeType;
    value: string; // benchmarkId, sector name, or instrumentId
}

// Core Event Item
export interface EventItem {
    id: string;
    title: string;
    category: EventCategory;
    direction: EventDirection;
    magnitudePct: number; // Expected % move [-30, +30]
    confidence: number;   // 0-1
    horizon: EventHorizon;
    affectedScope: AffectedScope;
    sources: EventSource[];
    observedAt: string;   // ISO timestamp
    createdAt: string;    // ISO timestamp
    isActive?: boolean;
}

// Sensitivity source for traceability
export type SensitivitySource =
    | 'BETA_COMPUTED'      // Beta from snapshot calculation
    | 'BETA_FALLBACK_EQUITY' // Fallback beta=1.0 for equities
    | 'BETA_FALLBACK_OTHER'  // Fallback beta=0.5 for others
    | 'SECTOR_MATCH'       // Sector match (sensitivity=1.0)
    | 'SECTOR_NO_MATCH'    // Sector mismatch (sensitivity=0.0)
    | 'INSTRUMENT_DIRECT'  // Direct instrument match (sensitivity=1.0)
    | 'INSTRUMENT_NO_MATCH'; // Instrument mismatch (sensitivity=0.0)

// Per-holding impact trace (full traceability)
export interface HoldingImpactTrace {
    holdingId: string;
    instrumentId?: string;
    symbol: string;
    holdingCurrentValue: number;
    weight: number;           // holdingValue / portfolioValue

    // Sensitivity breakdown
    sensitivityUsed: number;
    sensitivitySource: SensitivitySource;
    betaValue?: number;
    betaWindowDays?: number;
    benchmarkId?: string;

    // Event parameters used
    eventId: string;
    magnitudePct: number;
    confidence: number;
    horizon: EventHorizon;
    direction: EventDirection;
    directionSign: number;    // +1, -1, or 0

    // Computed impact
    impactPct: number;
    impactValue: number;

    // Data quality flags
    pricesAsOf: string;       // ISO timestamp
    priceWasStale: boolean;
    fallbackBetaUsed: boolean;
}

// Portfolio-level impact summary per event
export interface EventImpactResult {
    eventId: string;
    eventTitle: string;

    // Portfolio impact
    portfolioImpactPct: number;
    portfolioImpactValue: number;

    // PnL-at-Risk
    downsideImpactValue: number;
    pnlAtRiskValue: number;

    // Breakdown
    affectedHoldingsCount: number;
    topGainers: HoldingImpactTrace[];
    topLosers: HoldingImpactTrace[];

    // Coverage
    coveragePct: number;      // % of portfolio value covered
    holdingsWithStalePrice: number;
}

// Aggregate summary across all events
export interface EventImpactSummary {
    runId: string;
    computedAt: string;       // ISO timestamp
    pricesAsOf: string;       // Snapshot price timestamp

    // Portfolio metrics
    portfolioCurrentValue: number;

    // Aggregate event impacts
    totalEventsProcessed: number;
    totalPnlAtRisk: number;   // Capped at 30% of portfolio
    topEventsByRisk: EventImpactResult[];

    // Coverage metrics
    averageCoveragePct: number;
    holdingsWithMissingPrices: number;
    fallbackBetaUsedCount: number;
}

// Provider response
export interface EventProviderResult {
    provider: string;
    events: EventItem[];
    errors?: string[];
    fetchedAt: string;
}

// Validation result for event creation
export interface EventValidationResult {
    isValid: boolean;
    warnings: string[];
    errors: string[];
}

// Direction sign helper
export function getDirectionSign(direction: EventDirection): number {
    switch (direction) {
        case 'POSITIVE': return 1;
        case 'NEGATIVE': return -1;
        case 'MIXED': return 0;
    }
}

// Magnitude validation
export function validateMagnitude(pct: number): EventValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (pct < -30 || pct > 30) {
        warnings.push(`Magnitude ${pct}% is outside typical range [-30%, +30%]. Consider if this is intentional.`);
    }

    return { isValid: errors.length === 0, warnings, errors };
}

// Confidence validation
export function validateConfidence(conf: number): EventValidationResult {
    const errors: string[] = [];

    if (conf < 0 || conf > 1) {
        errors.push('Confidence must be between 0 and 1');
    }

    return { isValid: errors.length === 0, warnings: [], errors };
}
