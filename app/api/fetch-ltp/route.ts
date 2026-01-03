
import { NextRequest, NextResponse } from 'next/server';
import { GrowwConnector } from '@/lib/groww/GrowwConnector';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { symbols, items } = body;

        // Support both simple symbol list and rich item list
        let payloadItems: any[] = [];
        if (Array.isArray(items)) {
            payloadItems = items;
        } else if (Array.isArray(symbols)) {
            payloadItems = symbols;
        } else {
            return NextResponse.json(
                { ok: false, error: 'Invalid payload: items or symbols array required' },
                { status: 400 }
            );
        }

        console.log(`[API] Fetching Smart LTP for ${payloadItems.length} items`);

        try {
            const response = await GrowwConnector.callPython('smart_ltp', { items: payloadItems });

            // Transform response to simple Map { symbol: price } expected by UI
            const priceMap: Record<string, number> = {};
            const data = response.data || response; // Handle wrapped or direct

            // Handle "items" list format from Python SDK
            const items = data.items || [];
            if (Array.isArray(items)) {
                for (const item of items) {
                    if (item.symbol && typeof item.price === 'number') {
                        // 1. Store the exact returned symbol (e.g. NSE_RELIANCE)
                        priceMap[item.symbol] = item.price;

                        // 2. Store the bare symbol (e.g. RELIANCE) so UI can match it
                        // The UI likely possesses the bare symbol from the spreadsheet
                        const bare = item.symbol.replace(/^(NSE|BSE)_/, '');
                        if (bare !== item.symbol) {
                            priceMap[bare] = item.price;
                        }
                    }
                }
            }

            return NextResponse.json({ ok: true, prices: priceMap });

        } catch (pyError: any) {
            console.error('[API] Python Bridge Error:', pyError);
            // Fallback: Return empty prices so UI doesn't crash, but mark as failed
            return NextResponse.json({ ok: false, error: pyError.message || 'Python bridge failed', prices: {} });
        }

    } catch (error: any) {
        console.error('[API] Fetch LTP Error:', error);
        return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
        );
    }
}
