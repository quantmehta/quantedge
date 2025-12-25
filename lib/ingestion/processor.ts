/**
 * Legacy IngestionProcessor - Stub for backward compatibility.
 * This file exists to prevent build errors from older API routes.
 * The main ingestion logic has been modularized into separate files.
 */

import { parseFile } from './parseFile';
import { findTableRegion } from './tableRegion';
import { findHeaderRows, extractHeaders } from './headerDiscovery';
import { normalizeHeaderKey, ensureUniqueHeaders } from './normalize';
import { parseRows } from './rowParser';
import { identifyColumnRoles } from './columnRoles';

export interface SheetIngestionResult {
    sheetName: string;
    header_rows_used: number[];
    data_start_row: number;
    original_headers: string[];
    normalized_headers: string[];
    column_roles: Record<string, string>;
    preview: {
        rows: Record<string, unknown>[];
    };
}

export interface IngestionResult {
    sheets: SheetIngestionResult[];
    warnings: string[];
    errors: string[];
}

export class IngestionProcessor {
    static process(buffer: Buffer, originalFilename: string): IngestionResult {
        const sheets = parseFile(buffer, originalFilename);

        if (sheets.length === 0) {
            return { sheets: [], warnings: [], errors: ['No readable sheets found'] };
        }

        const results: SheetIngestionResult[] = sheets.map(sheet => {
            const tableStart = findTableRegion(sheet.grid);
            const headerInfo = findHeaderRows(sheet.grid, tableStart);
            const headerRowsUsed = headerInfo.headerRows;

            const rawHeaders = extractHeaders(sheet.grid, headerRowsUsed);
            const normalizedKeys = ensureUniqueHeaders(rawHeaders.map(h => normalizeHeaderKey(h)));

            const dataStartRow = Math.max(...headerRowsUsed) + 1;
            const parsedRows = parseRows(sheet.grid, dataStartRow, normalizedKeys, rawHeaders);

            const roles = identifyColumnRoles(normalizedKeys, parsedRows);

            // Convert parsed rows to preview format
            const previewRows = parsedRows.slice(0, 50).map(r => r.fields);

            return {
                sheetName: sheet.sheetName,
                header_rows_used: headerRowsUsed,
                data_start_row: dataStartRow,
                original_headers: rawHeaders,
                normalized_headers: normalizedKeys,
                column_roles: roles,
                preview: {
                    rows: previewRows
                }
            };
        });

        return {
            sheets: results,
            warnings: [],
            errors: []
        };
    }
}
