
export type CellValue = string | number | boolean | Date | null;
export type Grid = CellValue[][];

export interface MergeRange {
    r1: number;
    c1: number;
    r2: number;
    c2: number;
}

export interface SheetData {
    sheetName: string;
    grid: Grid;
    merges?: MergeRange[];
}

export interface ParsedRow {
    row_index: number;
    fields: Record<string, CellValue>;
    // Convenience typed fields (optional, populated if columns found)
    instrument_name?: string;
    symbol?: string;
    market_price?: number;
    purchase_price?: number;
    quantity?: number;
    investment_value?: number;
    current_value?: number;
    net_growth?: number;
    net_growth_percent?: number;
}

export interface HeaderCandidateDebug {
    row: number;
    score: number;
    reasons: string[];
    sample_cells: string[];
}

export interface IngestionDebugInfo {
    table_block_start: number;
    header_candidates: HeaderCandidateDebug[];
    groww: {
        symbol_lookups: number;
        price_lookups: number;
        cache_hits: number;
        failures: number;
    };
}

export interface IngestionResult {
    upload_id: string;
    detected_format: string;
    sheet_name: string;
    header_rows_used: number[];
    data_start_row: number;
    original_headers: string[];
    normalized_headers: string[];
    instrument_name_key?: string;
    rows: ParsedRow[];
    warnings: string[];
    errors: string[];
    debug: IngestionDebugInfo;
}
