
import { NextRequest } from 'next/server';
import { GrowwService } from '@/lib/groww/GrowwService';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ operation: string }> }) {
    try {
        const { operation } = await params;
        const body = await req.json();

        // Dispatch based on operation
        // Operations: ltp_bulk, history, holdings, positions, search

        switch (operation) {
            case 'ltp_bulk':
                // expect { symbols: [] }
                // normalize "symbols" or "exchangeTradingSymbols"
                const symbols = body.symbols || body.exchangeTradingSymbols || [];
                const ltpData = await GrowwService.getLtp(symbols);
                return successResponse({ items: ltpData });

            case 'history':
                // expect { symbol, start, end, interval }
                const histData = await GrowwService.getHistoricalCandles(
                    body.symbol || body.tradingSymbol,
                    body.start,
                    body.end,
                    body.interval
                );
                return successResponse({ candles: histData });

            case 'holdings':
                // no params needed
                const holdings = await GrowwService.getHoldings();
                return successResponse({ holdings });

            case 'search':
                // expect { query }
                const searchRes = await GrowwService.searchInstrument(body.query);
                return successResponse({ result: searchRes });

            default:
                return errorResponse(ErrorCodes.BAD_REQUEST, `Unknown operation: ${operation}`, 400);
        }

    } catch (error: any) {
        console.error('Groww API Error:', error);
        return errorResponse(ErrorCodes.INTERNAL_ERROR, error.message, 500);
    }
}
