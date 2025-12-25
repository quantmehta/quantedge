
import { Grid } from './types';

const SCAN_ROWS = 120; // Look deep into file for table
const MIN_NONEMPTY = 3; // Row must have 3+ items
const MIN_SPAN = 3;     // Items must span 3+ columns
const MIN_BLOCK_LEN = 8; // A table usually has at least 8 rows

/**
 * Detects where the main data table likely starts.
 * This helps skip logos, disclaimers, and title blocks.
 */
export function findTableRegion(grid: Grid): number {
    const limit = Math.min(grid.length, SCAN_ROWS);

    // 1. Identify "table-like" rows
    const tableLikeRows: boolean[] = new Array(limit).fill(false);

    for (let r = 0; r < limit; r++) {
        const row = grid[r] || [];
        let nonEmptyCount = 0;
        let minCol = 10000;
        let maxCol = -1;

        row.forEach((cell, cIdx) => {
            if (cell !== null && cell !== undefined && String(cell).trim() !== '') {
                nonEmptyCount++;
                if (cIdx < minCol) minCol = cIdx;
                if (cIdx > maxCol) maxCol = cIdx;
            }
        });

        const span = maxCol - minCol + 1;
        if (nonEmptyCount >= MIN_NONEMPTY && span >= MIN_SPAN) {
            tableLikeRows[r] = true;
        }
    }

    // 2. Find longest contiguous block of table-like rows
    let currentBlockStart = -1;
    let currentBlockLen = 0;

    let bestBlockStart = -1;
    let bestBlockLen = 0;

    for (let r = 0; r < limit; r++) {
        if (tableLikeRows[r]) {
            if (currentBlockStart === -1) currentBlockStart = r;
            currentBlockLen++;
        } else {
            if (currentBlockLen >= bestBlockLen) {
                bestBlockLen = currentBlockLen;
                bestBlockStart = currentBlockStart;
            }
            currentBlockStart = -1;
            currentBlockLen = 0;
        }
    }
    // Check final block
    if (currentBlockLen >= bestBlockLen) {
        bestBlockLen = currentBlockLen;
        bestBlockStart = currentBlockStart;
    }

    // 3. Decision
    if (bestBlockLen >= MIN_BLOCK_LEN && bestBlockStart !== -1) {
        return bestBlockStart;
    }

    // Fallback: First row that starts 5 consecutive reasonably dense rows
    for (let r = 0; r < limit - 5; r++) {
        let denseCount = 0;
        for (let k = 0; k < 5; k++) {
            if (tableLikeRows[r + k]) denseCount++;
        }
        if (denseCount >= 4) return r;
    }

    // Last resort: 0
    return 0;
}
