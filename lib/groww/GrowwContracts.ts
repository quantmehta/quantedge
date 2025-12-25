/**
 * Groww API Type Definitions
 * Matches the actual SDK response structures
 */

export interface GrowwInstrument {
    exchange: string;           // NSE, BSE
    segment: string;            // CASH, FNO, COMMODITY
    tradingSymbol: string;      // RELIANCE, TCS
    growwSymbol?: string;       // NSE-RELIANCE
    name?: string;              // Reliance Industries
    instrumentType?: string;    // EQ, CE, PE, FUT
    isin?: string;              // INE002A01018
    exchangeToken?: number;     // 2885
    lotSize?: number;           // 1 for cash, varies for FNO
    tickSize?: number;          // 0.05
    searchScore?: number;       // Optional relevance score from search
}

export interface GrowwLtpResponse {
    symbol: string;             // NSE_RELIANCE
    price: number;              // 2500.50
    asOf: string;               // ISO timestamp
    source: string;             // groww_live
    curr: string;               // INR
}

export interface GrowwOhlc {
    open: number;
    high: number;
    low: number;
    close: number;
}

export interface GrowwCandle {
    timestamp: number;          // Epoch seconds
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface GrowwQuote {
    average_price: number;
    bid_quantity: number;
    bid_price: number;
    day_change: number;
    day_change_perc: number;
    upper_circuit_limit: number;
    lower_circuit_limit: number;
    ohlc: GrowwOhlc;
    last_price: number;
    volume: number;
    week_52_high: number;
    week_52_low: number;
    open_interest?: number;
}

export interface GrowwHolding {
    isin: string;               // INE545U01014
    trading_symbol: string;     // RELIANCE
    quantity: number;           // 10
    average_price: number;      // 100.00
    pledge_quantity?: number;
    t1_quantity?: number;
    demat_free_quantity?: number;
}

export interface GrowwPosition {
    trading_symbol: string;
    segment: string;            // CASH, FNO
    exchange: string;           // NSE, BSE
    quantity: number;
    product: string;            // CNC, MIS, NRML
    credit_quantity: number;
    debit_quantity: number;
    net_price: number;
    realised_pnl: number;
}

// Python CLI Response Envelope
export interface PythonResponse<T> {
    // Success fields
    items?: GrowwLtpResponse[];
    ohlc?: Record<string, GrowwOhlc>;
    quote?: GrowwQuote;
    candles?: GrowwCandle[];
    holdings?: GrowwHolding[];
    positions?: GrowwPosition[];
    result?: T;
    instruments?: GrowwInstrument[];
    count?: number;

    // Error fields
    error?: string;
    code?: string;
}
