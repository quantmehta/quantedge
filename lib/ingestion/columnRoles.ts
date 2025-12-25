
import { ParsedRow } from './types';
import { debugLog, formatForLog } from './debug';

// Billion-dollar quality keyword dictionary
const ROLE_KEYWORDS: Record<string, string[]> = {
    instrument: [
        'instrument', 'security', 'company', 'name', 'scrip', 'stock', 'particulars', 'description',
        'asset', 'equity', 'share_name', 'stock_name', 'company_name', 'identifier', 'description_of_security',
        'script', 'trading_symbol', 'symbol', 'ticker'
    ],
    quantity: [
        'qty', 'quantity', 'units', 'shares', 'nos', 'number', 'volume', 'holding', 'balance',
        'available_qty', 'total_qty', 'current_qty', 'position', 'size', 'lot_size', 'closing_balance'
    ],
    purchase_price: [
        'price', 'rate', 'cost', 'avg', 'average', 'buy', 'purchase', 'entry', 'acquisition',
        'buy_price', 'purchase_rate', 'avg_cost', 'average_price', 'book_value', 'cost_price',
        'unit_cost', 'investment_price', 'avg_rate', 'acq_price'
    ],
    market_price: [
        'ltp', 'market_price', 'current_price', 'last_price', 'close_price', 'market_rate', 'cmp',
        'last_traded_price', 'live_price', 'valuation_price', 'market_val', 'closing_price', 'price_as_on'
    ]
};

export function identifyColumnRoles(headers: string[], firstRows: ParsedRow[]): Record<string, string> {
    debugLog('ColumnRoles', 'Starting column role identification', {
        headers: formatForLog(headers),
        sampleRowCount: firstRows.length
    });

    const roles: Record<string, string> = {};
    const usedHeaders = new Set<string>();

    const roleOrder = ['instrument', 'quantity', 'purchase_price', 'market_price'];

    roleOrder.forEach(role => {
        let bestCol = '';
        let maxScore = -100;
        const scoreBreakdown: Record<string, { score: number; details: string[] }> = {};

        headers.forEach((h, index) => {
            if (usedHeaders.has(h)) return;

            let score = 0;
            const details: string[] = [];
            const norm = h.toLowerCase().replace(/[^a-z0-9]/g, '');
            const keywords = ROLE_KEYWORDS[role];

            // 1b. Negative keyword penalty (e.g. 'date' in a price column)
            if (['quantity', 'purchase_price', 'market_price'].includes(role)) {
                if (norm.includes('date') || norm.includes('time') || norm.includes('folio')) {
                    score -= 80;
                    details.push(`date/time penalty: -80`);
                }
            }

            // 1. Keyword Match
            keywords.forEach(kw => {
                const normKw = kw.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (norm === normKw) {
                    score += 60; // Exact match is high
                    details.push(`exact keyword match '${kw}': +60`);
                } else if (norm.includes(normKw)) {
                    // Match quality depends on how much of the header is matched
                    const matchRatio = normKw.length / norm.length;
                    const bonus = 20 + (matchRatio * 20);
                    score += bonus;
                    details.push(`partial keyword match '${kw}': +${bonus.toFixed(1)}`);
                } else if (normKw.includes(norm) && norm.length > 2) {
                    score += 15;
                    details.push(`reverse keyword match '${kw}': +15`);
                }
            });

            // 2. Position Bias (Higher for instruments early on)
            if (role === 'instrument' && index < 2) {
                score += 15;
                details.push(`position bias (index ${index}): +15`);
            }
            if (role === 'instrument' && index < 5) {
                score += 5;
                details.push(`position bias (index ${index} < 5): +5`);
            }

            // 3. Data Check (The most reliable signal)
            let nonNullCount = 0;
            let numericCount = 0;
            let stringCount = 0;
            let currencyCount = 0;
            let dateLikeCount = 0;

            const sample = firstRows.slice(0, 30);
            sample.forEach(r => {
                const val = r.fields[h];
                if (val !== null && val !== undefined && val !== '') {
                    nonNullCount++;
                    const sVal = String(val).trim();

                    // Check for currency symbols or commas
                    if (sVal.includes('₹') || sVal.includes('$') || (sVal.includes(',') && !isNaN(Number(sVal.replace(/,/g, ''))))) {
                        currencyCount++;
                    }

                    const cleanNum = sVal.replace(/[%$,]/g, '');
                    const num = Number(cleanNum);
                    if (!isNaN(num) && cleanNum !== '') {
                        numericCount++;
                        // Excel dates are large numbers (e.g. 45000+). 
                        // If values look like Excel dates or have date patterns
                        if (num > 30000 && num < 60000) dateLikeCount++;
                    } else {
                        stringCount++;
                    }
                }
            });

            if (nonNullCount > 0) {
                const numericRatio = numericCount / nonNullCount;
                const stringRatio = stringCount / nonNullCount;
                const currencyRatio = currencyCount / nonNullCount;
                const dateRatio = dateLikeCount / nonNullCount;

                details.push(`data: numeric=${numericRatio.toFixed(2)}, string=${stringRatio.toFixed(2)}, date=${dateRatio.toFixed(2)}, currency=${currencyRatio.toFixed(2)}`);

                if (role === 'instrument') {
                    if (stringRatio > 0.8) {
                        score += 40;
                        details.push(`high string ratio: +40`);
                    }
                    else if (stringRatio > 0.5) {
                        score += 10;
                        details.push(`medium string ratio: +10`);
                    }
                    else {
                        score -= 50; // Instruments are rarely numbers
                        details.push(`low string ratio penalty: -50`);
                    }
                } else if (['quantity', 'purchase_price', 'market_price'].includes(role)) {
                    if (numericRatio > 0.8) {
                        score += 30; // Strong numeric presence
                        details.push(`high numeric ratio: +30`);
                        if (dateRatio > 0.5) {
                            score -= 100; // Veto if it looks like a date column
                            details.push(`DATE COLUMN VETO: -100`);
                        }
                    }
                    else if (numericRatio > 0.4) {
                        score += 10;
                        details.push(`medium numeric ratio: +10`);
                    }
                    else {
                        score -= 40;
                        details.push(`low numeric ratio penalty: -40`);
                    }

                    // Prices/Quantities often have currency or decimals
                    if (currencyRatio > 0.2) {
                        score += 15;
                        details.push(`currency detected: +15`);
                    }
                }
            }

            scoreBreakdown[h] = { score, details };

            if (score > maxScore && score > 20) {
                maxScore = score;
                bestCol = h;
            }
        });

        debugLog('ColumnRoles', `Role '${role}' scoring complete`, {
            bestCol: bestCol || 'NONE',
            maxScore,
            allScores: Object.fromEntries(
                Object.entries(scoreBreakdown)
                    .sort((a, b) => b[1].score - a[1].score)
                    .slice(0, 5)
                    .map(([k, v]) => [k, { score: v.score, details: v.details }])
            )
        });

        if (bestCol) {
            roles[role] = bestCol;
            usedHeaders.add(bestCol);
        }
    });

    debugLog('ColumnRoles', 'Final role assignments', roles);
    return roles;
}
