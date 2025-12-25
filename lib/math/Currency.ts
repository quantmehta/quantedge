// -----------------------------------------------------------------------------
// DECIMAL CURRENCY - Wrapper for decimal.js with currency-specific operations
// -----------------------------------------------------------------------------

import Decimal from 'decimal.js';

// Configure Decimal.js for currency (2 decimal places, round half-up)
Decimal.config({
    precision: 20,           // Internal precision
    rounding: Decimal.ROUND_HALF_UP,
    toExpNeg: -7,
    toExpPos: 21,
});

export class Currency {
    /**
     * Add two currency values
     */
    static add(a: number | string, b: number | string): number {
        return new Decimal(a).plus(new Decimal(b)).toNumber();
    }

    /**
     * Subtract currency values
     */
    static subtract(a: number | string, b: number | string): number {
        return new Decimal(a).minus(new Decimal(b)).toNumber();
    }

    /**
     * Multiply currency by a factor
     */
    static multiply(a: number | string, b: number | string): number {
        return new Decimal(a).times(new Decimal(b)).toNumber();
    }

    /**
     * Divide currency values
     */
    static divide(a: number | string, b: number | string): number {
        if (new Decimal(b).isZero()) {
            throw new Error('Division by zero');
        }
        return new Decimal(a).dividedBy(new Decimal(b)).toNumber();
    }

    /**
     * Sum an array of currency values
     */
    static sum(values: (number | string)[]): number {
        return values
            .reduce((acc, val) => acc.plus(new Decimal(val)), new Decimal(0))
            .toNumber();
    }

    /**
     * Format currency value to 2 decimal places
     */
    static format(value: number | string, decimals: number = 2): string {
        return new Decimal(value).toFixed(decimals);
    }

    /**
     * Parse currency string to number
     */
    static parse(value: string): number {
        return new Decimal(value).toNumber();
    }

    /**
     * Round to 2 decimal places
     */
    static round(value: number | string, decimals: number = 2): number {
        return new Decimal(value).toDecimalPlaces(decimals).toNumber();
    }

    /**
     * Compare two currency values
     */
    static compare(a: number | string, b: number | string): number {
        return new Decimal(a).comparedTo(new Decimal(b));
    }

    /**
     * Check if value is zero
     */
    static isZero(value: number | string): boolean {
        return new Decimal(value).isZero();
    }

    /**
     * Convert to number (safe)
     */
    static toNumber(value: number | string): number {
        return new Decimal(value).toNumber();
    }
}
