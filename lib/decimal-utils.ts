import Decimal from 'decimal.js';

// Configure Decimal for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export const toDecimal = (value: string | number | Decimal): Decimal => {
    return new Decimal(value);
};

export const formatCurrency = (value: Decimal | number, currencySymbol: string = '₹'): string => {
    const val = new Decimal(value);
    return `${currencySymbol}${val.toFixed(2)}`;
};

export const parseInputToDecimal = (input: string): Decimal => {
    // Remove currency symbols, commas, whitespace
    const cleaned = input.replace(/[₹$,\s]/g, '');

    // Check for percentage
    if (cleaned.endsWith('%')) {
        const numberPart = cleaned.slice(0, -1);
        if (numberPart === '' || isNaN(Number(numberPart))) {
            throw new Error(`Invalid percentage format: ${input}`);
        }
        return new Decimal(numberPart).div(100);
    }

    if (cleaned === '' || isNaN(Number(cleaned))) {
        throw new Error(`Invalid numeric input: ${input}`);
    }

    return new Decimal(cleaned);
};

export { Decimal };
