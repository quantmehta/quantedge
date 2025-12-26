
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import fs from 'fs';
import path from 'path';

// Modular Ingestion Pipeline
import { parseFile } from '@/lib/ingestion/parseFile';
import { findTableRegion } from '@/lib/ingestion/tableRegion';
import { findHeaderRows, extractHeaders } from '@/lib/ingestion/headerDiscovery';
import { normalizeHeaderKey, ensureUniqueHeaders } from '@/lib/ingestion/normalize';
import { parseRows } from '@/lib/ingestion/rowParser';
import { determineInstrumentColumn } from '@/lib/ingestion/instrumentColumn';
import { GrowwEnricher } from '@/lib/groww/enrichment';
import { IngestionResult, ParsedRow } from '@/lib/ingestion/types';
import { toDecimal, Decimal } from '@/lib/decimal-utils';

export const runtime = "nodejs"; // Force Node.js runtime for Buffer support

export async function POST(req: NextRequest) {
    const trace_id = crypto.randomUUID();
    console.log(`[${trace_id}] Starting ingestion process`);

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded", trace_id }, { status: 400 });
        }

        const fileName = file.name;
        const extension = fileName.split('.').pop()?.toLowerCase();
        if (!['csv', 'xlsx', 'xls'].includes(extension || '')) {
            return NextResponse.json({ error: "Invalid file type", trace_id }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const upload_id = crypto.createHash('sha256').update(buffer).digest('hex');

        // Idempotency Check
        const existing = await prisma.portfolioUpload.findFirst({ where: { fileHashSha256: upload_id } });
        if (existing && existing.validationJson) {
            console.log(`[${trace_id}] Cache hit for ${upload_id}`);
            return NextResponse.json(JSON.parse(existing.validationJson));
        }

        // --- SAVE FILE TO DISK (Critical Fix) ---
        const uploadPath = path.join(process.cwd(), 'data', 'uploads', upload_id);
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        const filePath = path.join(uploadPath, fileName);
        fs.writeFileSync(filePath, buffer);
        const storedPath = path.relative(process.cwd(), filePath);
        // ----------------------------------------

        // 1. Parse File
        const sheets = parseFile(buffer, fileName);
        if (sheets.length === 0) {
            throw new Error("No readable sheets found");
        }
        const sheet = sheets[0]; // Process first sheet only for now

        // 2. Detect Table Region
        const tableStart = findTableRegion(sheet.grid);
        console.log(`[${trace_id}] Table start detected at row ${tableStart}`);

        // 3. Header Discovery
        const headerInfo = findHeaderRows(sheet.grid, tableStart);
        const headerRowsUsed = headerInfo.headerRows;

        // 4. Extract and Normalize Headers
        const rawHeaders = extractHeaders(sheet.grid, headerRowsUsed);
        const normalizedKeys = ensureUniqueHeaders(rawHeaders.map(h => normalizeHeaderKey(h)));

        // 5. Parse Data Rows
        const dataStartRow = Math.max(...headerRowsUsed) + 1;
        const parsedRows = parseRows(
            sheet.grid,
            dataStartRow,
            normalizedKeys,
            rawHeaders
        );

        if (parsedRows.length === 0) {
            throw new Error("No valid data rows parsed");
        }

        // 6. Identify Instrument Column
        const instrumentKey = determineInstrumentColumn(normalizedKeys, parsedRows);
        console.log(`[${trace_id}] Instrument column identified: ${instrumentKey}`);

        // 7. Enrich Rows (Groww Integration)
        // Optimization: For UI response we might want to enrich ALL or just Top X?
        // Let's enrich Top 50 for speed, similar to validate.
        const PREVIEW_LIMIT = 50;
        const uniqueNames = [...new Set(parsedRows.slice(0, PREVIEW_LIMIT).map(r => String(r.fields[instrumentKey] || '')).filter(Boolean))];

        const enrichmentMap = await GrowwEnricher.enrichRows(
            uniqueNames.map((n) => ({ id: n, name: n })),
            20 // Concurrency
        );

        // Identify Quantity and Price Columns
        const qtyKey = normalizedKeys.find(k => /qty|quantity|units|shares|no_of/.test(k)) || '';
        const priceKey = normalizedKeys.find(k => /price|rate|average|avg|cost|basis|purchase/.test(k)) || '';
        const existingLtpKey = normalizedKeys.find(k => /market|ltp|current|cmp/.test(k));

        const finalRows: ParsedRow[] = parsedRows.map((row, idx) => {
            const name = String(row.fields[instrumentKey] || '');
            const enrich = enrichmentMap[name];

            // 1. Resolve Metrics
            const qtyRaw = row.fields[qtyKey];
            const priceRaw = row.fields[priceKey];
            const ltpRaw = existingLtpKey ? row.fields[existingLtpKey] : undefined;

            const cleanNumberToDecimal = (v: any): Decimal => {
                if (!v) return new Decimal(0);
                const cleaned = String(v).replace(/[^0-9.-]/g, '');
                if (cleaned === '' || isNaN(Number(cleaned))) return new Decimal(0);
                return new Decimal(cleaned);
            };

            const qty = cleanNumberToDecimal(qtyRaw);
            const purchasePrice = cleanNumberToDecimal(priceRaw);

            // Prioritize Groww LTP, fallback to file
            let marketLtp = toDecimal(enrich?.ltp || 0);
            if (marketLtp.isZero() && ltpRaw) {
                marketLtp = cleanNumberToDecimal(ltpRaw);
            }

            // 2. Perform Calculations (User Requested)
            const investmentValue = purchasePrice.mul(qty);
            const currentValue = marketLtp.mul(qty);
            const netGrowth = currentValue.minus(investmentValue);
            const netGrowthPercent = investmentValue.isZero() ? new Decimal(0) : netGrowth.div(investmentValue).mul(100);

            return {
                ...row,
                instrument_name: name,
                symbol: enrich?.symbol || '',
                // Standardized fields for UI
                quantity: qty.toNumber(),
                purchase_price: purchasePrice.toNumber(),
                market_price: marketLtp.toNumber(),
                investment_value: investmentValue.toNumber(),
                current_value: currentValue.toNumber(),
                net_growth: netGrowth.toNumber(),
                net_growth_percent: netGrowthPercent.toNumber(),

                fields: {
                    ...row.fields,
                    symbol: enrich?.symbol || '',
                    quantity: qty.toNumber(),
                    purchase_price: purchasePrice.toNumber(),
                    market_price: marketLtp.toNumber(),
                    investment_value: investmentValue.toNumber(),
                    current_value: currentValue.toNumber(),
                    net_growth: netGrowth.toNumber(),
                    net_growth_percent: netGrowthPercent.toNumber(),
                    _instrument_resolved: enrich?.symbol || ''
                }
            };
        });

        // 8. Result Construction
        const enrichedPreview = finalRows.slice(0, PREVIEW_LIMIT);
        const result = {
            upload_id,
            detected_format: extension || 'unknown',
            sheet_name: sheet.sheetName,
            header_rows_used: headerRowsUsed,
            data_start_row: dataStartRow,
            original_headers: rawHeaders,
            normalized_headers: [...normalizedKeys, 'symbol', 'market_price'],
            instrument_name_key: instrumentKey,
            rows: finalRows,
            enrichedPreview, // Add explicitly for frontend
            validation: { // Mock validation summary for frontend compat
                summary: {
                    total: parsedRows.length,
                    valid: parsedRows.length,
                    errors: 0,
                    warnings: 0,
                    merged: 0
                },
                issues: []
            },
            warnings: [],
            errors: [],
            debug: {
                table_block_start: tableStart,
                header_candidates: headerInfo.debug,
                groww: {
                    symbol_lookups: uniqueNames.length,
                    price_lookups: uniqueNames.length,
                    cache_hits: 0,
                    failures: 0
                }
            }
        };

        // 9. Cache Result
        await prisma.portfolioUpload.upsert({
            where: { id: existing?.id || crypto.randomUUID() },
            update: {
                validationJson: JSON.stringify(result),
                status: 'VALIDATED'
            },
            create: {
                id: crypto.randomUUID(),
                originalFilename: fileName,
                storedPath: storedPath,
                fileHashSha256: upload_id,
                fileType: extension?.toUpperCase() || 'UNKNOWN',
                status: 'VALIDATED',
                validationJson: JSON.stringify(result)
            }
        });

        return NextResponse.json(result);

    } catch (error: any) {
        console.error(`[${trace_id}] Fatal Ingestion Error:`, error);
        return NextResponse.json({
            error: "Ingestion failed",
            message: error.message,
            trace_id,
            debug: { stack: error.stack }
        }, { status: 500 });
    }
}
