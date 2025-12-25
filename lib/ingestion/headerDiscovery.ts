
import { Grid, HeaderCandidateDebug } from './types';
import { normalizeTextForDetection } from './normalize';
import { debugLog, formatForLog } from './debug';

const KEYWORDS: Record<string, string[]> = {
    instrument: ['instrument', 'security', 'company', 'name', 'scrip', 'stock', 'share', 'particulars', 'description', 'description_of_security', 'asset', 'script'],
    symbol: ['symbol', 'ticker', 'trading_symbol', 'code', 'isin', 'security_code', 'trading_symbol'],
    quantity: ['qty', 'quantity', 'units', 'shares', 'nos', 'number', 'volume', 'holding', 'balance', 'closing_balance', 'available_qty'],
    price: ['price', 'rate', 'cost', 'avg', 'average', 'value', 'amount', 'buy', 'purchase', 'entry', 'acquisition', 'purchase_price', 'avg_cost'],
    market_price: ['ltp', 'market_price', 'current_price', 'last_price', 'close_price', 'market_rate', 'cmp', 'last_traded_price']
};

export function scoreHeaderCandidate(row: unknown[], nextRow: unknown[] | null): HeaderCandidateDebug {
    const cells = row.map(c => normalizeTextForDetection(c));
    const nonEmpty = cells.filter(c => c !== '');

    // Immediate rejection for very sparse or empty rows
    if (nonEmpty.length < 3) return { row: -1, score: -100, reasons: ["Too sparse"], sample_cells: cells.slice(0, 5) };

    let score = 0;
    const reasons: string[] = [];

    // 1. String Ratio (Headers should be mostly text)
    const stringCount = nonEmpty.filter(c => {
        const clean = c.replace(/[%$,]/g, '').trim();
        return isNaN(Number(clean)) || clean === '';
    }).length;
    const stringRatio = stringCount / nonEmpty.length;

    if (stringRatio > 0.8) score += 30;
    else if (stringRatio > 0.5) score += 10;
    else score -= 30;

    reasons.push(`string_ratio=${stringRatio.toFixed(2)}`);

    // 2. Uniqueness Ratio (Headers are usually unique)
    const uniqueCount = new Set(nonEmpty.map(c => c.toLowerCase())).size;
    const uniqueRatio = uniqueCount / nonEmpty.length;
    score += uniqueRatio * 20;
    reasons.push(`unique_ratio=${uniqueRatio.toFixed(2)}`);

    // 3. Keyword Hits (The heavy hitter)
    let hits = 0;
    const allKw = Object.values(KEYWORDS).flat();
    nonEmpty.forEach(cell => {
        const norm = cell.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (norm === '') return;

        if (allKw.some(k => {
            const normK = k.replace(/[^a-z0-9]/g, '');
            // Exact match is always good
            if (norm === normK) return true;
            // Cell contains keyword (e.g. "Instrument Name" contains "instrument")
            if (norm.includes(normK)) return true;
            // Keyword contains cell (only if cell is reasonably long, e.g. "Instr" matches "Instrument")
            if (norm.length >= 4 && normK.includes(norm)) return true;
            return false;
        })) {
            hits++;
        }
    });
    score += hits * 20; // 20 points per hit (Strong signal)
    reasons.push(`keyword_hits=${hits}`);

    // 4. Numeric Penalty (Headers shouldn't be numbers)
    const numericCount = nonEmpty.filter(c => {
        const clean = c.replace(/[%$,]/g, '').trim();
        return clean !== '' && !isNaN(Number(clean));
    }).length;
    const numericRatio = numericCount / nonEmpty.length;
    if (numericRatio > 0.3) {
        score -= 60;
        reasons.push(`numeric_penalty=${numericRatio.toFixed(2)}`);
    }

    // 5. Data-likeness of next row (High bonus if next row is actual data)
    if (nextRow) {
        const nextCells = nextRow.map(c => normalizeTextForDetection(c));
        const nextNonEmpty = nextCells.filter(c => c !== '');
        if (nextNonEmpty.length >= 3) {
            const nextNumericCount = nextNonEmpty.filter(c => {
                const clean = c.replace(/[%$,]/g, '').trim();
                return clean !== '' && !isNaN(Number(clean));
            }).length;
            const nextNumericRatio = nextNumericCount / nextNonEmpty.length;

            // If next row is mostly numeric, this row is likely the header
            if (nextNumericRatio > 0.5) {
                score += 40;
                reasons.push(`next_row_numeric_ratio=${nextNumericRatio.toFixed(2)}`);
            }
        }
    }

    return { row: -1, score, reasons, sample_cells: cells.slice(0, 5) };
}

export function findHeaderRows(grid: Grid, tableStart: number): { headerRows: number[], debug: HeaderCandidateDebug[] } {
    debugLog('HeaderDiscovery', `Starting header discovery from tableStart=${tableStart}`, { gridRows: grid.length });

    // Scan around the tableStart which was pre-detected by finding dense data regions
    const startScan = Math.max(0, tableStart - 5);
    const endScan = Math.min(grid.length - 1, tableStart + 2);

    debugLog('HeaderDiscovery', `Scanning rows ${startScan} to ${endScan}`);

    const candidates: HeaderCandidateDebug[] = [];

    for (let r = startScan; r <= endScan; r++) {
        const scoring = scoreHeaderCandidate(grid[r], grid[r + 1] || null);
        scoring.row = r;
        candidates.push(scoring);
        debugLog('HeaderDiscovery', `Row ${r} scored: ${scoring.score}`, {
            reasons: scoring.reasons,
            sample: formatForLog(scoring.sample_cells)
        });
    }

    // Sort by score desc
    candidates.sort((a, b) => b.score - a.score);

    const best = candidates[0];
    debugLog('HeaderDiscovery', `Best candidate: row ${best?.row} with score ${best?.score}`);

    if (!best || best.score < 20) {
        // Fallback: If no good header, assume tableStart is header if reasonable
        debugLog('HeaderDiscovery', `No good header found (score < 20), falling back to tableStart=${tableStart}`);
        return { headerRows: [tableStart], debug: candidates };
    }

    const headerRows = [best.row];

    // Check for multi-row header (e.g., Row 1: Stock, Row 2: Details)
    if (best.row + 1 < grid.length) {
        const next = scoreHeaderCandidate(grid[best.row + 1], grid[best.row + 2] || null);
        const hasKeywords = next.reasons.some(r => r.startsWith('keyword_hits') && !r.endsWith('=0'));

        // Helper check: Is this row just single letters or formulas like "A", "B", "I=H-E"?
        const row = grid[best.row + 1];
        const looksLikeHelper = row.some(c => {
            const s = String(c || '').trim();
            return s.length === 1 || (s.includes('=') && s.length < 10);
        });

        debugLog('HeaderDiscovery', `Checking next row ${best.row + 1} for multi-row header`, {
            nextRowScore: next.score,
            hasKeywords,
            looksLikeHelper,
            sampleCells: formatForLog(row?.slice(0, 6))
        });

        if (!looksLikeHelper && hasKeywords && next.score > 20) {
            headerRows.push(best.row + 1);
            debugLog('HeaderDiscovery', `Added row ${best.row + 1} as part of multi-row header`);
        } else if (looksLikeHelper) {
            debugLog('HeaderDiscovery', `Row ${best.row + 1} detected as HELPER ROW - skipping`);
        }
    }

    debugLog('HeaderDiscovery', `Final header rows selected`, { headerRows });
    return { headerRows, debug: candidates };
}

export function extractHeaders(grid: Grid, headerRows: number[]): string[] {
    if (headerRows.length === 0) return [];
    const firstRow = grid[headerRows[0]];
    if (!firstRow) return [];

    const colCount = firstRow.length;
    const headers: string[] = [];

    for (let c = 0; c < colCount; c++) {
        const parts = headerRows
            .map(r => normalizeTextForDetection(grid[r][c]))
            .filter(v => v !== '');

        let header = parts.join(' - ');
        if (!header) header = `col_${c + 1}`;
        headers.push(header);
    }

    return headers;
}
