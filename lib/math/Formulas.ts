// -----------------------------------------------------------------------------
// FORMULA REGISTRY - Single source of truth for all financial formulas
// -----------------------------------------------------------------------------

export interface FormulaDefinition {
    key: string;
    name: string;
    definition: string;
    inputs: string[];
    rounding: string;
    edgeCases: string[];
    example?: string;
}

export const FORMULAS: Record<string, FormulaDefinition> = {
    UNREALIZED_PNL: {
        key: 'unrealizedPnL',
        name: 'Unrealized P&L',
        definition: '(currentPrice - costPrice) × quantity',
        inputs: ['currentPrice', 'costPrice', 'quantity'],
        rounding: '2 decimals',
        edgeCases: ['Zero quantity returns 0', 'Missing price treated as 0'],
        example: '(100 - 80) × 10 = 200',
    },
    UNREALIZED_PNL_PCT: {
        key: 'unrealizedPnLPct',
        name: 'Unrealized P&L %',
        definition: '((currentPrice - costPrice) / costPrice) × 100',
        inputs: ['currentPrice', 'costPrice'],
        rounding: '2 decimals',
        edgeCases: ['Cost price = 0 returns 0', 'Infinite returns capped at ±999%'],
        example: '((100 - 80) / 80) × 100 = 25%',
    },
    INVESTED_CAPITAL: {
        key: 'investedCapital',
        name: 'Invested Capital',
        definition: 'Σ (costPrice × quantity) for all holdings',
        inputs: ['costPrice', 'quantity'],
        rounding: '2 decimals',
        edgeCases: ['Empty portfolio returns 0'],
        example: '(80 × 10) + (50 × 20) = 1800',
    },
    CURRENT_VALUE: {
        key: 'currentValue',
        name: 'Current Value',
        definition: 'Σ (currentPrice × quantity) for all holdings',
        inputs: ['currentPrice', 'quantity'],
        rounding: '2 decimals',
        edgeCases: ['Missing prices excluded from sum', 'Zero price treated as 0'],
        example: '(100 × 10) + (60 × 20) = 2200',
    },
    PORTFOLIO_WEIGHT: {
        key: 'portfolioWeight',
        name: 'Portfolio Weight',
        definition: '(holdingValue / portfolioValue) × 100',
        inputs: ['holdingValue', 'portfolioValue'],
        rounding: '2 decimals',
        edgeCases: ['Portfolio value = 0 returns 0', 'Sum of weights may not equal 100% if missing prices'],
        example: '(1000 / 10000) × 100 = 10%',
    },
    CONCENTRATION_MAX_SINGLE: {
        key: 'concentrationMaxSingle',
        name: 'Max Single Asset Concentration',
        definition: 'max(weight) across all holdings',
        inputs: ['weights[]'],
        rounding: '2 decimals',
        edgeCases: ['Empty portfolio returns 0'],
        example: 'max([10%, 5%, 3%]) = 10%',
    },
    SECTOR_CONCENTRATION: {
        key: 'sectorConcentration',
        name: 'Sector Concentration',
        definition: 'Σ (weight) for holdings in sector',
        inputs: ['weights[]', 'sector'],
        rounding: '2 decimals',
        edgeCases: ['Unknown sector grouped as "Other"'],
        example: 'Σ weights where sector=IT = 35%',
    },
    PORTFOLIO_VOLATILITY: {
        key: 'portfolioVolatility',
        name: 'Portfolio Volatility (Annualized)',
        definition: 'σ(returns) × sqrt(252) where returns = daily % changes',
        inputs: ['dailyReturns[]'],
        rounding: '2 decimals',
        edgeCases: ['< 30 days history returns null', 'Gaps in price data skipped'],
        example: 'stddev([0.01, -0.02, 0.015]) × 15.87 = 0.12 (12%)',
    },
    MAX_DRAWDOWN: {
        key: 'maxDrawdown',
        name: 'Maximum Drawdown',
        definition: 'max((peak - trough) / peak) over rolling window',
        inputs: ['prices[]'],
        rounding: '2 decimals',
        edgeCases: ['< 30 days history returns null', 'Only one price returns 0%'],
        example: 'peak=1000, trough=800 → (1000-800)/1000 = 20%',
    },
    EVENT_IMPACT_PNL_AT_RISK: {
        key: 'pnlAtRisk',
        name: 'PnL-at-Risk from Events',
        definition: 'Σ (holdingValue × eventMagnitude × confidence × sensitivity) capped at 30% portfolio',
        inputs: ['holdingValue', 'eventMagnitude', 'confidence', 'sensitivity'],
        rounding: '2 decimals',
        edgeCases: ['Positive events contribute 0', 'Cap prevents runaway estimates'],
        example: '(1000 × -0.10 × 0.8 × 1.0) = -80',
    },
    MOMENTUM_SIGNAL: {
        key: 'momentum',
        name: 'Momentum Signal',
        definition: '(currentPrice - MA50) / MA50 where MA50 = 50-day moving average',
        inputs: ['currentPrice', 'prices[]'],
        rounding: '4 decimals',
        edgeCases: ['< 50 days history returns null'],
        example: '(105 - 100) / 100 = 0.05 (5%)',
    },
    VOLATILITY_TREND: {
        key: 'volatilityTrend',
        name: 'Volatility Trend',
        definition: 'Recent 30d volatility / Historical 90d volatility',
        inputs: ['prices[]'],
        rounding: '2 decimals',
        edgeCases: ['< 90 days history returns null', 'Ratio > 2 indicates spike'],
        example: '0.15 / 0.10 = 1.5 (50% increase)',
    },
};

/**
 * Get formula definition by key
 */
export function getFormula(key: string): FormulaDefinition | undefined {
    return FORMULAS[key];
}

/**
 * Generate glossary for PDF/UI
 */
export function generateGlossary(): string {
    const entries = Object.values(FORMULAS).map((formula) => {
        return `**${formula.name}**: ${formula.definition}\n  - Inputs: ${formula.inputs.join(', ')}\n  - Rounding: ${formula.rounding}`;
    });
    return entries.join('\n\n');
}

/**
 * Get formula for UI tooltip
 */
export function getFormulaTooltip(key: string): string {
    const formula = getFormula(key);
    if (!formula) return '';

    return `${formula.name}\n\nFormula: ${formula.definition}\n\nInputs: ${formula.inputs.join(', ')}\nRounding: ${formula.rounding}`;
}
