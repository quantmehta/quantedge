// -----------------------------------------------------------------------------
// INVARIANTS - Validation functions for math correctness
// -----------------------------------------------------------------------------

import { Currency } from './Currency';

export class Invariants {
    /**
     * Assert value is not NaN or Infinity
     */
    static assertValidNumber(value: number, label: string = 'value'): void {
        if (Number.isNaN(value)) {
            throw new Error(`${label} is NaN`);
        }
        if (!Number.isFinite(value)) {
            throw new Error(`${label} is Infinity`);
        }
    }

    /**
     * Assert holdings reconcile to portfolio total
     */
    static assertReconciliation(
        holdings: { currentValue: number }[],
        portfolioTotal: number,
        tolerance: number = 0.01
    ): void {
        const sum = Currency.sum(holdings.map((h) => h.currentValue));
        const diff = Math.abs(Currency.subtract(sum, portfolioTotal));

        if (diff > tolerance) {
            throw new Error(
                `Reconciliation failed: holdings sum (${sum}) != portfolio total (${portfolioTotal}), diff=${diff}`
            );
        }
    }

    /**
     * Assert market value is non-negative (unless explicitly allowed)
     */
    static assertNonNegativeMarketValue(value: number, allowNegative: boolean = false): void {
        if (!allowNegative && value < 0) {
            throw new Error(`Market value cannot be negative: ${value}`);
        }
    }

    /**
     * Assert weights sum to 100% (within tolerance)
     */
    static assertWeightsSum(weights: number[], tolerance: number = 0.1): void {
        const sum = Currency.sum(weights);
        const diff = Math.abs(Currency.subtract(sum, 100));

        if (diff > tolerance) {
            throw new Error(
                `Weights do not sum to 100%: sum=${sum}, diff=${diff}`
            );
        }
    }

    /**
     * Assert all values in array are valid numbers
     */
    static assertArrayValid(values: number[], label: string = 'array'): void {
        values.forEach((val, idx) => {
            this.assertValidNumber(val, `${label}[${idx}]`);
        });
    }

    /**
     * Assert percentage is in valid range
     */
    static assertValidPercentage(value: number, min: number = -100, max: number = 100): void {
        this.assertValidNumber(value, 'percentage');
        if (value < min || value > max) {
            throw new Error(`Percentage out of range: ${value} (min=${min}, max=${max})`);
        }
    }

    /**
     * Warn if value seems suspicious (for logging, not throwing)
     */
    static warnIfSuspicious(value: number, threshold: number, label: string): string | null {
        if (Math.abs(value) > threshold) {
            return `WARNING: ${label} exceeds threshold: ${value} > ${threshold}`;
        }
        return null;
    }
}
