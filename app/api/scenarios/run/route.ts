import { NextResponse } from 'next/server';
import { ScenarioResult } from '@/lib/types';

export async function POST(request: Request) {
    await new Promise(resolve => setTimeout(resolve, 1200));

    // const body = await request.json(); // { scenarioId }

    // Mock results for a generic scenario run
    const results: ScenarioResult[] = [
        {
            scenarioId: 'market-drop-5',
            impactAbs: -62500,
            impactPct: -5.0,
            affectedHoldingsCount: 45
        },
        {
            scenarioId: 'sector-tech-drop-10',
            impactAbs: -85000,
            impactPct: -6.8,
            affectedHoldingsCount: 12
        }
    ];

    return NextResponse.json(results);
}
