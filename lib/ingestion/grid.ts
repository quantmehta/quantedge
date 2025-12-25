
import { Grid, MergeRange } from './types';

/**
 * Creates an empty grid of dimensions.
 */
export function createGrid(rows: number, cols: number): Grid {
    return Array.from({ length: rows }, () => Array(cols).fill(null));
}

/**
 * Applies merged cell values to all cells within the merge range.
 * This is crucial for header detection where a label might scan multiple columns.
 * Only overwrites null/undefined cells to avoid data loss (though merges usually imply emptiness).
 */
export function applyMergedHeaderFill(grid: Grid, merges: MergeRange[], scanRowLimit: number): void {
    if (!merges || merges.length === 0) return;

    for (const merge of merges) {
        // Optimization: Only care about merges that touch the header scan zone
        if (merge.r1 >= scanRowLimit) continue;

        // Get the value from the top-left cell
        const startVal = grid[merge.r1]?.[merge.c1];
        if (startVal === undefined || startVal === null) continue;

        for (let r = merge.r1; r <= merge.r2; r++) {
            if (r >= grid.length) break;
            for (let c = merge.c1; c <= merge.c2; c++) {
                // Skip the source cell itself
                if (r === merge.r1 && c === merge.c1) continue;

                // Set if currently empty
                if (grid[r][c] === null || grid[r][c] === undefined || grid[r][c] === '') {
                    grid[r][c] = startVal;
                }
            }
        }
    }
}
