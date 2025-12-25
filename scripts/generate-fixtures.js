/* eslint-disable @typescript-eslint/no-require-imports */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const fixtureDir = path.join(__dirname, '../test-fixtures/ingestion');
if (!fs.existsSync(fixtureDir)) {
    fs.mkdirSync(fixtureDir, { recursive: true });
}

function generateCleanCSV() {
    const content = "symbol,company_name,quantity,avg_price\nTCS,Tata Consultancy Services Ltd,10,3500\nRELIANCE,Reliance Industries Ltd,5,2500";
    fs.writeFileSync(path.join(fixtureDir, 'clean.csv'), content);
}

function generateNoSymbolCSV() {
    const content = "company_name,quantity,avg_price\nTata Consultancy Services Ltd,10,3500\nReliance Industries Ltd,5,2500";
    fs.writeFileSync(path.join(fixtureDir, 'no_symbol.csv'), content);
}

function generateNoNameCSV() {
    const content = "symbol,quantity,avg_price\nTCS,10,3500\nRELIANCE,5,2500";
    fs.writeFileSync(path.join(fixtureDir, 'no_name.csv'), content);
}

function generateMessyXLSX() {
    const wb = XLSX.utils.book_new();
    const data = [
        ["Portfolio Report - Q3"],
        ["Generated: 2023-10-01"],
        [], // blank
        ["symbol", "company_name", "quantity", "avg_price"],
        ["TCS", "Tata Consultancy Services Ltd", 10, 3500],
        ["RELIANCE", "Reliance Industries Ltd", 5, 2500]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Portfolio");
    XLSX.writeFile(wb, path.join(fixtureDir, 'messy.xlsx'));
}

function generateTwoRowXLSX() {
    const wb = XLSX.utils.book_new();
    const data = [
        ["Instrument", "", "Position", "Pricing"],
        ["symbol", "name", "qty", "avg_cost"],
        ["TCS", "Tata Consultancy Services Ltd", 10, 3500],
        ["RELIANCE", "Reliance Industries Ltd", 5, 2500]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Details");
    XLSX.writeFile(wb, path.join(fixtureDir, 'two_row.xlsx'));
}

function generateMergedHeadersXLSX() {
    const wb = XLSX.utils.book_new();
    const data = [
        ["Asset Details", null, "Holdings", null],
        ["Symbol", "Name", "Qty", "Avg Price"],
        ["TCS", "Tata Consultancy Services Ltd", 10, 3500],
        ["RELIANCE", "Reliance Industries Ltd", 5, 2500]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    // Merges: Asset Details (A1:B1), Holdings (C1:D1)
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
        { s: { r: 0, c: 2 }, e: { r: 0, c: 3 } }
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Merged");
    XLSX.writeFile(wb, path.join(fixtureDir, 'merged_headers.xlsx'));
}

function generateSemicolonCSV() {
    const content = "symbol;company_name;quantity;avg_price\nTCS;Tata Consultancy Services Ltd;10;3500\nRELIANCE;Reliance Industries Ltd;5;2500";
    fs.writeFileSync(path.join(fixtureDir, 'semicolon.csv'), content);
}

function generateThreeRowHeaderXLSX() {
    const wb = XLSX.utils.book_new();
    const data = [
        ["Client Portfolio", null, null, null],
        ["Equity", null, "Stats", null],
        ["Symbol", "Name", "Volume", "Price"],
        ["TCS", "Tata Consultancy Services Ltd", 10, 3500],
        ["RELIANCE", "Reliance Industries Ltd", 5, 2500]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "ThreeRow");
    XLSX.writeFile(wb, path.join(fixtureDir, 'three_row_header.xlsx'));
}

generateCleanCSV();
generateNoSymbolCSV();
generateNoNameCSV();
generateMessyXLSX();
generateTwoRowXLSX();
generateMergedHeadersXLSX();
generateSemicolonCSV();
generateThreeRowHeaderXLSX();

console.log("Fixtures generated in", fixtureDir);
