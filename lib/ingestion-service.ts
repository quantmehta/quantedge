
import { prisma } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { parseFile } from '@/lib/ingestion/parseFile';
import { findTableRegion } from '@/lib/ingestion/tableRegion';
import { findHeaderRows, extractHeaders } from '@/lib/ingestion/headerDiscovery';
import { normalizeHeaderKey, ensureUniqueHeaders } from '@/lib/ingestion/normalize';
import { parseRows } from '@/lib/ingestion/rowParser';
import { identifyColumnRoles } from '@/lib/ingestion/columnRoles';
import { GrowwIngestionLookup } from '@/lib/ingestion/groww-lookup';
import { debugLog, getAndClearDebugLogs, clearDebugLogs, INGESTION_DEBUG } from '@/lib/ingestion/debug';
import { Decimal, toDecimal } from '@/lib/decimal-utils';

export interface IngestionProcessingResult {
    success: boolean;
    validationSummary: any;
    enrichedPreview: any[];
    uploadId: string;
    runId: string;
    debugInfo?: any;
}

export class IngestionService {
    /**
     * Main entry point for validating and enriching a portfolio upload.
     */
    static async validateAndEnrich(uploadId: string): Promise<IngestionProcessingResult> {
        clearDebugLogs();
        debugLog('IngestionService', 'Starting validation and enrichment', { uploadId });

        // 1. Retrieve Upload Record
        const upload = await prisma.portfolioUpload.findUnique({
            where: { id: uploadId }
        });

        if (!upload) throw new Error('Upload record not found');

        // 2. Read File
        const filePath = path.join(process.cwd(), upload.storedPath);
        if (!fs.existsSync(filePath)) throw new Error('Uploaded file not found on disk');
        const buffer = fs.readFileSync(filePath);

        // 3. Process Sheets & Regions
        const sheets = parseFile(buffer, upload.originalFilename);
        if (sheets.length === 0) throw new Error("No readable sheets found");
        const sheet = sheets[0];

        const tableStart = findTableRegion(sheet.grid);
        const headerInfo = findHeaderRows(sheet.grid, tableStart);
        const headerRowsUsed = headerInfo.headerRows;

        // 4. Extract and Normalize Headers
        const rawHeaders = extractHeaders(sheet.grid, headerRowsUsed);
        const normalizedKeys = ensureUniqueHeaders(rawHeaders.map(h => normalizeHeaderKey(h)));

        // 5. Parse All Data Rows
        const dataStartRow = Math.max(...headerRowsUsed) + 1;
        const parsedRows = parseRows(sheet.grid, dataStartRow, normalizedKeys, rawHeaders);

        if (parsedRows.length === 0) throw new Error('No valid data rows found after headers');

        // 6. Role Identification
        const roles = identifyColumnRoles(normalizedKeys, parsedRows);
        const instrumentKey = roles['instrument'] || normalizedKeys[0];

        // 7. Filter valid data
        const validRows = parsedRows.filter(r => {
            const val = r.fields[instrumentKey];
            return val !== null && val !== undefined && String(val).trim() !== '';
        });

        if (validRows.length === 0) throw new Error('No valid holdings found (instrument column empty)');

        const allRowsRaw = validRows.map(r => ({
            ...r.fields,
            _original_row_index: r.row_index
        }));

        // 8. Enrichment (Groww) - Enrich ALL rows for persistence
        let allEnriched: Record<string, any>[] = [];
        try {
            debugLog('IngestionService', `Enriching ALL ${allRowsRaw.length} rows for persistence...`);
            allEnriched = await GrowwIngestionLookup.enrichPreviewRows(allRowsRaw, roles);
        } catch (enrichError: any) {
            console.error('[IngestionService] Full Enrichment Failed:', enrichError);
            allEnriched = allRowsRaw.map(row => ({
                ...row,
                company_name: String((row as any)[instrumentKey] || 'Unknown'),
                _is_enriched: false
            }));
        }

        // 9. Post-Process for Precision and DB Consistency
        const qtyKey = roles['quantity'];
        const priceKey = roles['purchase_price'];

        const findRawValue = (row: any, primaryKey: string, keywords: string[]) => {
            if (primaryKey && row[primaryKey] !== undefined && row[primaryKey] !== null) return row[primaryKey];
            const keys = Object.keys(row);
            const altKey = keys.find(k => {
                const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                return keywords.some(kw => norm === kw || norm.includes(kw));
            });
            const val = altKey ? row[altKey] : 0;
            return (val !== undefined && val !== null) ? val : 0;
        };

        const processedRows = allEnriched.map((row, idx) => {
            const rawQty = (row._normalized_qty !== undefined && row._normalized_qty !== null)
                ? row._normalized_qty
                : findRawValue(row, qtyKey, ['qty', 'quantity', 'units']);

            const rawPrice = (row._normalized_price !== undefined && row._normalized_price !== null)
                ? row._normalized_price
                : findRawValue(row, priceKey, ['price', 'rate', 'cost', 'avg']);

            const qty = toDecimal(rawQty || 0);
            const purchasePrice = toDecimal(rawPrice || 0);
            const marketPrice = toDecimal(row.current_price || 0);

            const investmentValue = purchasePrice.mul(qty);
            const currentValue = marketPrice.mul(qty);
            const netGrowth = currentValue.minus(investmentValue);
            const netGrowthPercent = investmentValue.isZero() ? new Decimal(0) : netGrowth.div(investmentValue).mul(100);

            return {
                ...row,
                _normalized_qty: qty.toNumber(),
                _normalized_price: purchasePrice.toNumber(),
                quantity: qty.toNumber(),
                purchase_price: purchasePrice.toNumber(),
                market_price: marketPrice.toNumber(),
                investment_value: investmentValue.toNumber(),
                current_value: currentValue.toNumber(),
                net_growth: netGrowth.toNumber(),
                net_growth_percent: netGrowthPercent.toNumber(),
                company_name: row.company_name || String((row as any)[instrumentKey] || 'Unknown')
            };
        });

        // 10. Persist to DB
        const { runId } = await this.persistToDatabase(uploadId, processedRows, roles, instrumentKey);

        const validationSummary = {
            total: processedRows.length,
            valid: processedRows.length,
            merged: 0,
            errors: 0
        };

        await prisma.portfolioUpload.update({
            where: { id: uploadId },
            data: {
                status: 'VALIDATED',
                rowCount: processedRows.length,
                validationJson: JSON.stringify({ summary: validationSummary, issues: [] })
            }
        });

        debugLog('IngestionService', 'Validation complete', { rowCount: processedRows.length });

        return {
            success: true,
            validationSummary,
            enrichedPreview: processedRows.slice(0, 50),
            uploadId,
            runId,
            debugInfo: INGESTION_DEBUG ? {
                logs: getAndClearDebugLogs(),
                summary: {
                    headerRowsUsed,
                    dataStartRow,
                    roles,
                    instrumentKey,
                    parsedRowCount: parsedRows.length,
                    validRowCount: processedRows.length
                }
            } : undefined
        };
    }

    private static async persistToDatabase(
        uploadId: string,
        rows: any[],
        roles: any,
        instrumentKey: string
    ): Promise<{ runId: string }> {
        // A. Handle Instruments and Prices
        const symbolMap = new Map<string, { name: string, ltp: number }>();
        rows.forEach((r, idx) => {
            const sym = r._instrument_resolved;
            if (sym) {
                const standardizedSym = String(sym).toUpperCase().trim();
                const ltp = Number(r.market_price || r.current_price || 0);

                symbolMap.set(standardizedSym, {
                    name: r.company_name || r.name || standardizedSym,
                    ltp
                });
            }
        });

        const instrumentIdMap = new Map<string, string>();
        for (const [sym, data] of symbolMap.entries()) {
            try {
                const inst = await prisma.instrument.upsert({
                    where: { identifier: sym },
                    update: { displayName: data.name, updatedAt: new Date() },
                    create: {
                        identifier: sym,
                        identifierType: 'TICKER',
                        displayName: data.name,
                        exchange: sym.startsWith('BSE_') ? 'BSE' : 'NSE'
                    }
                });
                instrumentIdMap.set(sym, inst.id);

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
            } catch (err: any) {
                console.error(`[IngestionService] Failed to persist instrument ${sym}:`, err.message);
            }
        }

        // B. Clear old holdings for this upload
        await prisma.holding.deleteMany({ where: { portfolioUploadId: uploadId } });

        // C. Bulk create new holdings
        const holdingsData = rows.map((h, idx) => {
            const sym = h._instrument_resolved ? String(h._instrument_resolved).toUpperCase().trim() : null;
            const instId = sym ? instrumentIdMap.get(sym) : null;

            return {
                portfolioUploadId: uploadId,
                rowNumber: h._original_row_index || (idx + 1),
                rawIdentifier: String(h[instrumentKey] || ''),
                name: h.company_name || h.name || String(h[instrumentKey] || ''),
                quantity: h._normalized_qty || 0,
                costPrice: h._normalized_price || 0,
                isEnriched: !!h._is_enriched || !!instId,
                resolvedInstrumentId: instId || undefined
            };
        });

        const holdingTable = prisma.holding as any;
        await holdingTable.createMany({ data: holdingsData })
            .catch(async (e: any) => {
                console.warn('[IngestionService] createMany failed, fallback:', e.message);
                for (const hData of holdingsData) {
                    await prisma.holding.create({ data: hData }).catch(() => { });
                }
            });

        const run = await prisma.run.create({
            data: {
                portfolioUploadId: uploadId,
                status: 'VALIDATED',
                auditSummary: `Processed ${rows.length} rows. Resolved ${instrumentIdMap.size} instruments.`
            }
        });

        return { runId: run.id };
    }
}
