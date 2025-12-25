
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

// Modular Ingestion Pipeline
import { parseFile } from '@/lib/ingestion/parseFile';
import { findTableRegion } from '@/lib/ingestion/tableRegion';
import { findHeaderRows, extractHeaders } from '@/lib/ingestion/headerDiscovery';
import { normalizeHeaderKey, ensureUniqueHeaders } from '@/lib/ingestion/normalize';
import { parseRows } from '@/lib/ingestion/rowParser';
import { identifyColumnRoles } from '@/lib/ingestion/columnRoles';
import { GrowwIngestionLookup } from '@/lib/ingestion/groww-lookup';
import { ParsedRow, IngestionResult } from '@/lib/ingestion/types';
import { debugLog, formatForLog, getAndClearDebugLogs, clearDebugLogs, INGESTION_DEBUG } from '@/lib/ingestion/debug';

export const runtime = "nodejs";

export async function POST(request: Request) {
    // Clear any previous debug logs
    clearDebugLogs();

    try {
        const body = await request.json();
        const { uploadId } = body;

        debugLog('Validate', 'Starting validation', { uploadId, debugEnabled: INGESTION_DEBUG });

        if (!uploadId) {
            return errorResponse(ErrorCodes.BAD_REQUEST, 'Missing uploadId', 400);
        }

        // 1. Retrieve Upload Record
        const upload = await prisma.portfolioUpload.findUnique({
            where: { id: uploadId }
        });

        if (!upload) {
            return errorResponse(ErrorCodes.NOT_FOUND, 'Upload not found', 404);
        }

        // 2. Read File and Process
        const filePath = path.join(process.cwd(), upload.storedPath);
        if (!fs.existsSync(filePath)) {
            return errorResponse(ErrorCodes.FILE_IO_ERROR, 'Uploaded file not found on disk', 500);
        }

        const buffer = fs.readFileSync(filePath);

        // --- NEW PIPELINE START ---
        debugLog('Validate', 'File loaded', { filename: upload.originalFilename, bufferSize: buffer.length });

        // 1. Parse Sheets
        const sheets = parseFile(buffer, upload.originalFilename);
        if (sheets.length === 0) {
            throw new Error("No readable sheets found");
        }
        const sheet = sheets[0];
        debugLog('Validate', 'Sheet parsed', {
            sheetName: sheet.sheetName,
            gridSize: { rows: sheet.grid.length, cols: sheet.grid[0]?.length || 0 },
            firstRowSample: formatForLog(sheet.grid[0]?.slice(0, 6)),
            secondRowSample: formatForLog(sheet.grid[1]?.slice(0, 6)),
            thirdRowSample: formatForLog(sheet.grid[2]?.slice(0, 6))
        });

        // 2. Detect Table Region
        const tableStart = findTableRegion(sheet.grid);
        debugLog('Validate', 'Table region detected', { tableStart });

        // 3. Header Discovery
        const headerInfo = findHeaderRows(sheet.grid, tableStart);
        const headerRowsUsed = headerInfo.headerRows;

        // 4. Extract Headers
        const rawHeaders = extractHeaders(sheet.grid, headerRowsUsed);
        const normalizedKeys = ensureUniqueHeaders(rawHeaders.map(h => normalizeHeaderKey(h)));

        debugLog('Validate', 'Headers extracted and normalized', {
            headerRows: headerRowsUsed,
            rawHeaders: formatForLog(rawHeaders),
            normalizedKeys: formatForLog(normalizedKeys)
        });

        // 5. Parse Data Rows (Top 50 for preview - optimized)
        const dataStartRow = Math.max(...headerRowsUsed) + 1;
        // Optimization: parse all needed for stats, limit for preview
        const parsedRows = parseRows(
            sheet.grid,
            dataStartRow,
            normalizedKeys,
            rawHeaders
        );

        if (parsedRows.length === 0) {
            return errorResponse(ErrorCodes.VALIDATION_FAILED, 'No valid data rows found', 422);
        }

        // 6. Identify Column Roles (Instrument, Qty, Price)
        const roles = identifyColumnRoles(normalizedKeys, parsedRows);
        const instrumentKey = roles['instrument'] || normalizedKeys[0];

        debugLog('Validate', 'Column roles identified', {
            roles,
            instrumentKey,
            qtyKey: roles['quantity'],
            priceKey: roles['purchase_price']
        });

        // Log sample row with extracted values
        if (parsedRows.length > 0) {
            const sampleRow = parsedRows[0];
            debugLog('Validate', 'Sample row field values', {
                rowIndex: sampleRow.row_index,
                instrumentValue: sampleRow.fields[instrumentKey],
                qtyValue: roles['quantity'] ? sampleRow.fields[roles['quantity']] : 'NO_QTY_KEY',
                priceValue: roles['purchase_price'] ? sampleRow.fields[roles['purchase_price']] : 'NO_PRICE_KEY',
                allFields: formatForLog(sampleRow.fields)
            });
        }

        // 6b. Filter out Junk Rows (rows with no instrument name)
        const validRows = parsedRows.filter(r => {
            const val = r.fields[instrumentKey];
            return val !== null && val !== undefined && String(val).trim() !== '';
        });

        if (validRows.length === 0) {
            return errorResponse(ErrorCodes.VALIDATION_FAILED, 'No valid holdings found (instruments missing)', 422);
        }

        const filteredRowCount = validRows.length;
        debugLog('Validate', 'Rows filtered', {
            totalParsed: parsedRows.length,
            validAfterFilter: filteredRowCount
        });

        // 7. Validation Logic (Stats)
        const rowCount = filteredRowCount;
        const validationSummary = {
            total: rowCount,
            valid: rowCount,
            merged: 0,
            errors: 0,
            warnings: 0,
            duplicatesCount: 0,
            unresolvedCount: 0
        };

        // 8. Enrich Rows (Groww Integration)
        const PREVIEW_LIMIT = 50; // Increased limit for better preview
        const allRowsRaw = validRows.map(r => ({
            ...r.fields,
            _original_row_index: r.row_index
        }));

        let allEnriched: Record<string, any>[] = [];
        try {
            // Optimization: enrichPreviewRows handles caching internally, but we'll 
            // limit the scope if we detect a huge file, or just trust the concurrency limit.
            allEnriched = await GrowwIngestionLookup.enrichPreviewRows(allRowsRaw, roles);
        } catch (enrichError: any) {
            console.error('[API/Validate] Enrichment Failed:', enrichError);
            allEnriched = allRowsRaw.map(row => ({
                ...row,
                company_name: String((row as any)[instrumentKey] || 'Unknown')
            }));
        }

        // 8b. Post-process ALL rows for UI/DB consistency
        // Map internal field names to UI-expected field names
        allEnriched = allEnriched.map((row, idx) => {
            // Extract normalized values
            const qty = parseFloat(String(row._normalized_qty || 0)) || 0;
            const purchasePrice = parseFloat(String(row._normalized_price || 0)) || 0;
            const marketPrice = parseFloat(String(row.current_price || 0)) || 0;

            // Calculate derived values
            const investmentValue = purchasePrice * qty;
            const currentValue = marketPrice * qty;
            const netGrowth = currentValue - investmentValue;
            const netGrowthPercent = investmentValue !== 0 ? (netGrowth / investmentValue) * 100 : 0;

            return {
                ...row,
                // Internal fields (for DB/debugging)
                _instrument_resolved: row._instrument_resolved || '',
                _normalized_qty: qty,
                _normalized_price: purchasePrice,

                // UI-expected field names (THIS WAS THE MISSING MAPPING!)
                quantity: qty,
                purchase_price: purchasePrice,
                market_price: marketPrice,
                investment_value: investmentValue,
                current_value: currentValue,
                net_growth: netGrowth,
                net_growth_percent: netGrowthPercent,

                // Legacy fields for compatibility
                current_price: marketPrice,
                market_value: row.market_value || currentValue,
                pnl: row.pnl || netGrowth,
                pnl_percentage: row.pnl_percentage || netGrowthPercent,
                company_name: row.company_name || String((row as any)[instrumentKey] || 'Unknown')
            };
        });

        debugLog('Validate', 'Post-processing complete - sample enriched row', {
            sampleRow: allEnriched[0] ? {
                quantity: allEnriched[0].quantity,
                purchase_price: allEnriched[0].purchase_price,
                investment_value: allEnriched[0].investment_value,
                current_value: allEnriched[0].current_value,
                net_growth: allEnriched[0].net_growth
            } : null
        });

        // 9. Database Persistence (Instruments, Prices, Holdings)
        try {
            // A. Ensure Instruments exist (Unique set)
            const uniqueResolvedItems = allEnriched.filter(h => h._instrument_resolved);
            const symbolToData = new Map<string, { name: string, ltp: number }>();

            uniqueResolvedItems.forEach(h => {
                if (!symbolToData.has(h._instrument_resolved)) {
                    symbolToData.set(h._instrument_resolved, {
                        name: h.company_name,
                        ltp: h.current_price
                    });
                }
            });

            // Upsert instruments sequentially or in small batches to avoid lock contention
            const instrumentMap = new Map<string, string>(); // identifier -> id
            for (const [sym, data] of symbolToData.entries()) {
                const inst = await prisma.instrument.upsert({
                    where: { identifier: sym },
                    update: { displayName: data.name },
                    create: {
                        identifier: sym,
                        identifierType: 'TICKER',
                        displayName: data.name,
                        exchange: sym.startsWith('BSE_') ? 'BSE' : 'NSE'
                    }
                });
                instrumentMap.set(sym, inst.id);

                if (data.ltp > 0) {
                    await prisma.marketPrice.upsert({
                        where: {
                            instrumentId_asOf_source: {
                                instrumentId: inst.id,
                                asOf: new Date(),
                                source: 'GROWW'
                            }
                        },
                        update: { price: data.ltp },
                        create: {
                            instrumentId: inst.id,
                            price: data.ltp,
                            asOf: new Date(),
                            source: 'GROWW'
                        }
                    });
                }
            }

            // B. Clear and Create Holdings in Bulk
            await prisma.holding.deleteMany({ where: { portfolioUploadId: uploadId } });

            const holdingsData = allEnriched.map((h, idx) => ({
                portfolioUploadId: uploadId,
                rowNumber: h._original_row_index || (idx + 1),
                rawIdentifier: String((h as any)[instrumentKey] || ''),
                name: h.company_name,
                quantity: h._normalized_qty,
                costPrice: h._normalized_price,
                resolvedInstrumentId: h._instrument_resolved ? instrumentMap.get(h._instrument_resolved) : undefined
            }));

            // Perform batch creation (using individual creates if createMany is unsupported or fails)
            try {
                await (prisma.holding as any).createMany({
                    data: holdingsData
                });
            } catch (createManyErr) {
                // Fallback to sequential individual creates
                for (const hData of holdingsData) {
                    await prisma.holding.create({ data: hData });
                }
            }

        } catch (dbError) {
            console.error('[API/Validate] Database Persistence Warning:', dbError);
            // Non-blocking for preview, but log it
        }

        // 10. Create Run Record
        const run = await prisma.run.create({
            data: {
                portfolioUploadId: uploadId,
                status: 'VALIDATED',
                auditSummary: `Parsed ${rowCount} rows. Enriched ${allEnriched.filter(h => h._instrument_resolved).length} holdings.`
            }
        });

        // 11. Update Upload Record
        await prisma.portfolioUpload.update({
            where: { id: uploadId },
            data: {
                status: 'VALIDATED',
                rowCount: rowCount,
                validationJson: JSON.stringify({
                    summary: validationSummary,
                    issues: []
                })
            }
        });

        // Collect debug logs for UI
        const debugLogs = INGESTION_DEBUG ? getAndClearDebugLogs() : [];

        debugLog('Validate', 'Validation complete', {
            totalRows: rowCount,
            enrichedCount: allEnriched.length,
            sampleEnrichedRow: allEnriched[0] ? {
                company_name: allEnriched[0].company_name,
                _normalized_qty: allEnriched[0]._normalized_qty,
                _normalized_price: allEnriched[0]._normalized_price,
                current_price: allEnriched[0].current_price
            } : null
        });

        return successResponse({
            success: true,
            validation: {
                summary: validationSummary,
                issues: []
            },
            enrichedPreview: allEnriched.slice(0, 50),
            uploadId,
            runId: run.id,
            // Include debug info for UI visibility
            _debug: INGESTION_DEBUG ? {
                enabled: true,
                logs: debugLogs,
                summary: {
                    headerRowsUsed,
                    dataStartRow,
                    rawHeaders: rawHeaders.slice(0, 10),
                    normalizedKeys: normalizedKeys.slice(0, 10),
                    roles,
                    instrumentKey,
                    parsedRowCount: parsedRows.length,
                    validRowCount: filteredRowCount
                }
            } : undefined
        });

    } catch (error: any) {
        console.error('[API/Validate] Fatal Error:', error);
        return errorResponse(
            ErrorCodes.INTERNAL_ERROR,
            error.message || 'Internal Validation Error',
            500
        );
    }
}
