import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { mappings } = body; // Array of { rawIdentifier, instrumentId (or new name) }

        if (!Array.isArray(mappings)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        // Ideally we would upsert InstrumentMappings
        // For Phase 2, we just create them.

        const createdMappings = [];

        for (const m of mappings) {
            // Check if instrument exists, if not create dummy one (since Phase 3 enriches)
            // Or just check if instrumentId is provided.

            // Simplified Logic: 
            // If instrumentId provided, use it.
            // If not, find or create Instrument by identifier=m.canonicalName

            let instrumentId = m.instrumentId;
            const canonicalIdentifier = m.canonicalIdentifier || m.rawIdentifier; // Fallback

            if (!instrumentId) {
                // Find or Create Instrument
                const instr = await prisma.instrument.upsert({
                    where: { identifier: canonicalIdentifier },
                    update: {},
                    create: {
                        identifier: canonicalIdentifier,
                        identifierType: 'TICKER',
                        displayName: m.displayName || canonicalIdentifier,
                        sector: 'Unknown',
                        assetClass: 'Equity' // Default
                    }
                });
                instrumentId = instr.id;
            }

            // Create Mapping
            const mapping = await prisma.instrumentMapping.create({
                data: {
                    rawIdentifier: m.rawIdentifier,
                    instrumentId: instrumentId,
                    matchType: 'USER_CONFIRMED',
                    confidence: 1.0,
                    source: 'UserResolve'
                }
            });
            createdMappings.push(mapping);
        }

        return NextResponse.json({ success: true, count: createdMappings.length });

    } catch (error) {
        console.error("Resolve error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
