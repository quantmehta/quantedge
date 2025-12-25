/* eslint-disable @typescript-eslint/no-require-imports */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { IngestionProcessor } = require('../lib/ingestion/processor');

const fixtureDir = path.join(__dirname, '../test-fixtures/ingestion');

async function runTests() {
    console.log("--- Starting Ingestion Processor Tests ---");

    const tests: { file: string; expectedRows: number[]; expectError?: boolean }[] = [
        { file: 'clean.csv', expectedRows: [0] },
        { file: 'messy.xlsx', expectedRows: [3] },
        { file: 'two_row.xlsx', expectedRows: [0, 1] },
        { file: 'merged_headers.xlsx', expectedRows: [0, 1] },
        { file: 'semicolon.csv', expectedRows: [0] },
        { file: 'three_row_header.xlsx', expectedRows: [1, 2] },
        { file: 'no_symbol.csv', expectedRows: [0] },
        { file: 'no_name.csv', expectedRows: [0] }
    ];

    for (const test of tests) {
        console.log(`\nTesting: ${test.file}`);
        const filePath = path.join(fixtureDir, test.file);
        if (!fs.existsSync(filePath)) {
            console.error(`Missing fixture: ${test.file}`);
            continue;
        }

        const buffer = fs.readFileSync(filePath);
        let workbook;
        if (test.file.endsWith('.csv')) {
            const delimiter = IngestionProcessor.detectCSVDelimiter(buffer);
            console.log(`- Detected Delimiter: ${delimiter}`);
            workbook = XLSX.read(buffer, { type: 'buffer', FS: delimiter });
        } else {
            workbook = XLSX.read(buffer, { type: 'buffer' });
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const result = IngestionProcessor.processSheet(sheet, sheetName);

        console.log(`- Header Rows: ${result.header_rows_used.join(', ')}`);
        console.log(`- Confidence: ${result.header_confidence.toFixed(2)}`);
        console.log(`- Table Body Start: ${result.debug.table_block_start}`);
        console.log(`- Normalized Headers: ${result.normalized_headers.join(', ')}`);
        console.log(`- Identified Symbol: ${result.identified_columns.symbol_key}`);
        console.log(`- Identified Name: ${result.identified_columns.company_name_key}`);

        // Scored Candidates Debug
        console.log("- Top Candidates:");
        result.debug.candidate_rows.sort((a: any, b: any) => b.score - a.score).slice(0, 3).forEach((c: any) => {
            console.log(`  Row ${c.row_index}: Score ${c.score.toFixed(1)} [${c.reasons.join(', ')}]`);
        });

        // Basic Assertions
        const rowsMatch = JSON.stringify(result.header_rows_used) === JSON.stringify(test.expectedRows);
        if (!rowsMatch) {
            console.error(`FAIL: Expected header rows ${test.expectedRows}, got ${result.header_rows_used}`);
        } else {
            console.log("PASS: Header rows match.");
        }

        if (result.errors.length > 0 && !test.expectError) {
            console.error(`FAIL: Errors found: ${result.errors.join(', ')}`);
            if (result.debug.sanity_checks) {
                console.log(`  Sanity Fails: ${result.debug.sanity_checks.fail_reasons.join(', ')}`);
            }
        }
    }

    console.log("\n--- Ingestion Processor Tests Complete ---");
}

runTests().catch(console.error);
