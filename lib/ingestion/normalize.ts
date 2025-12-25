
/**
 * Cleans a cell string for detection purposes.
 * Removes zero-width chars, NBSP, and collapses whitespace.
 */
export function normalizeTextForDetection(s: unknown): string {
    if (s === null || s === undefined) return '';
    let str = String(s);
    // NBSP (\u00A0), zero-width space (\u200B), etc. -> normal space
    str = str.replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ');
    str = str.trim();
    // Collapse multiple spaces
    str = str.replace(/\s+/g, ' ');
    return str;
}

/**
 * Normalizes a header string into a consistent key.
 * e.g., "Instrument Name" -> "instrument_name"
 * e.g., "Buy / Sell" -> "buy_sell"
 */
export function normalizeHeaderKey(s: string): string {
    let str = normalizeTextForDetection(s).toLowerCase();
    // Replace spaces and slashes with underscore
    str = str.replace(/[\/ ]/g, '_');
    // Remove all non-alphanumeric except underscore
    str = str.replace(/[^a-z0-9_]/g, '');
    // Collapse multiple underscores
    str = str.replace(/_+/g, '_');
    // Trim leading/trailing underscores
    str = str.replace(/^_+|_+$/g, '');
    return str;
}

/**
 * Ensures uniqueness of headers by appending _2, _3, etc.
 */
export function ensureUniqueHeaders(headers: string[]): string[] {
    const seen: Record<string, number> = {};
    return headers.map((h, i) => {
        let base = h;
        if (!base) base = `col_${i + 1}`; // Fallback for empty headers

        if (seen[base] !== undefined) {
            seen[base]++;
            return `${base}_${seen[base]}`;
        } else {
            seen[base] = 1;
            return base;
        }
    });
}
