
import { Grid, ParsedRow, CellValue } from './types';
import { debugLog, formatForLog } from './debug';

export function parseRows(
    grid: Grid,
    dataStartRow: number,
    normalizedHeaders: string[],
    _originalHeaders: string[] // unused, kept for API compatibility
): ParsedRow[] {
    debugLog('RowParser', 'Starting row parsing', {
        dataStartRow,
        headers: formatForLog(normalizedHeaders),
        gridRowCount: grid.length
    });

    const rows: ParsedRow[] = [];
    const limit = Math.min(grid.length, 5000);

    let consecutiveEmpty = 0;
    let firstRowLogged = false;

    for (let r = dataStartRow; r < limit; r++) {
        const rowCells = grid[r];
        if (!rowCells) continue;

        // Validation: Is row empty?
        const isEmpty = rowCells.every(c => c === null || c === undefined || String(c).trim() === '');
        if (isEmpty) {
            consecutiveEmpty++;
            if (consecutiveEmpty >= 30) break;
            continue;
        }
        consecutiveEmpty = 0;

        const fields: Record<string, CellValue> = {};
        const parseDetails: Record<string, { raw: unknown; parsed: CellValue }> = {};

        normalizedHeaders.forEach((key, colIdx) => {
            let val = rowCells[colIdx];
            const rawVal = val;

            // Numeric parsing for price/qty
            if (key.includes('price') || key.includes('cost') || key.includes('qty') || key.includes('quantity') || key.includes('value') || key.includes('pnl') || key.includes('rate')) {
                if (val !== null && val !== undefined) {
                    let str = String(val).trim();

                    // Handle accounting format: (123.45) -> -123.45
                    if (str.startsWith('(') && str.endsWith(')')) {
                        str = '-' + str.slice(1, -1);
                    }

                    // Remove currency, commas, and percentage
                    const clean = str.replace(/[₹$,%\s]/g, '').replace(/,/g, '');
                    const num = parseFloat(clean);
                    if (!isNaN(num)) val = num;
                }
            }

            fields[key] = val;

            // Track parse details for first few rows
            if (rows.length < 3) {
                parseDetails[key] = { raw: rawVal, parsed: val };
            }
        });

        // Log first few rows in detail
        if (!firstRowLogged && rows.length < 3) {
            debugLog('RowParser', `Row ${r} parsed values`, {
                rowIndex: r,
                sampleFields: formatForLog(Object.fromEntries(
                    Object.entries(parseDetails).slice(0, 6)
                ))
            });
        }
        if (rows.length === 2) firstRowLogged = true;

        // Create flattened object for UI convenience + strict fields map
        const parsedRow: ParsedRow = {
            row_index: r,
            fields: fields,
            // We populate these convenience fields later via enrichment or simple mapping
            // But having them on top level helps standard algorithms
        };

        // Basic mapping for convenience
        // This is a naive pass; `instrumentColumn.ts` does the smart detection
        // parsedRow.instrument_name = ... (handled by caller using identified keys)

        rows.push(parsedRow);
    }

    debugLog('RowParser', 'Row parsing complete', {
        totalRowsParsed: rows.length,
        firstRowFields: rows[0] ? formatForLog(Object.keys(rows[0].fields)) : []
    });

    return rows;
}
