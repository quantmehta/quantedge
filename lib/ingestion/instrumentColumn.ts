
import { ParsedRow } from './types';

const INSTRUMENT_KEYWORDS = ['instrument', 'security', 'company', 'name', 'scrip', 'stock', 'particulars', 'description'];
const SYMBOL_KEYWORDS = ['symbol', 'ticker', 'trading_symbol', 'isin', 'code'];
const IGNORE_KEYWORDS = ['date', 'time', 'remarks', 'comment', 'sr', 'no', 'serial', 'index', 'id', 'type', 'status'];

export function determineInstrumentColumn(headers: string[], firstRows: ParsedRow[]): string {
    // 1. Check Headers
    let bestCol = '';
    let maxScore = -100;

    headers.forEach((h, index) => {
        let score = 0;
        const norm = h.toLowerCase();

        // Negative Keywords (Strong veto)
        if (IGNORE_KEYWORDS.some(k => norm === k || norm.includes(`_${k}`) || norm.includes(`${k}_`))) {
            score -= 50;
        }

        // Exact keyword match
        if (INSTRUMENT_KEYWORDS.some(k => norm === k || norm === `${k}_name` || norm.includes(k))) {
            score += 20;
        }
        // Symbol keyword match (also good source)
        else if (SYMBOL_KEYWORDS.some(k => norm === k || norm.includes(k))) {
            score += 15;
        }

        // Left-most bias (Columns 0-2 are highly likely to be the name)
        if (index < 3) {
            score += (3 - index) * 2; // +6, +4, +2
        }

        // Data Check
        let stringCount = 0;
        let _numericCount = 0;
        let nonEmpty = 0;
        let shortStringCount = 0; // Tickers are usually short

        const sample = firstRows.slice(0, 20);
        sample.forEach(r => {
            const val = r.fields[h];
            if (val !== null && val !== undefined && val !== '') {
                nonEmpty++;
                const sVal = String(val).trim();
                const num = Number(sVal.replace(/[%$,]/g, ''));
                if (isNaN(num)) {
                    stringCount++;
                    if (sVal.length <= 10 && sVal.length > 1) shortStringCount++;
                } else {
                    // It's a number, but check if it's alphanumeric mixed (like some ISINs or codes)
                    // Actually ISIN is alphanumeric, so isNaN would be true.
                    _numericCount++;
                }
            }
        });

        if (nonEmpty > 0) {
            const strRatio = stringCount / nonEmpty;
            // Must be mostly strings
            if (strRatio > 0.8) {
                score += 10;
                // Bonus if it looks like a ticker (short strings) and header was symbol-like
                if (shortStringCount / nonEmpty > 0.5) {
                    score += 5;
                }
            } else {
                score -= 30; // Mostly numbers = bad candidate
            }
        } else {
            score -= 10; // Empty column
        }

        if (score > maxScore) {
            maxScore = score;
            bestCol = h;
        }
    });

    if (maxScore > 0) return bestCol;

    // Fallback: First string-dense column in first 5 cols
    for (const h of headers.slice(0, 5)) {
        let stringCount = 0;
        let nonEmpty = 0;
        firstRows.slice(0, 20).forEach(r => {
            const val = r.fields[h];
            if (val != null && val !== '') {
                nonEmpty++;
                if (isNaN(Number(String(val).replace(/[%$,]/g, '')))) stringCount++;
            }
        });
        if (nonEmpty > 0 && (stringCount / nonEmpty) > 0.7) return h;
    }

    return headers[0] || 'col_1';
}
