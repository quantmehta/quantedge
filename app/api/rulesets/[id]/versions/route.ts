import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/rulesets/:id/versions - List all versions for a ruleset
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const versions = await prisma.rulesetVersion.findMany({
            where: { rulesetId: id },
            orderBy: { version: 'desc' },
        });

        return NextResponse.json({ ok: true, data: versions });
    } catch (error: any) {
        console.error('[Ruleset Versions] GET error:', error);
        return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST /api/rulesets/:id/versions - Create a new version
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { definitionJson } = await req.json();

        if (!definitionJson) {
            return NextResponse.json(
                { ok: false, error: 'definitionJson is required' },
                { status: 400 }
            );
        }

        // Validate JSON structure
        const def = typeof definitionJson === 'string'
            ? JSON.parse(definitionJson)
            : definitionJson;

        // Basic validation
        if (!def.profile || !def.hard || !def.soft) {
            return NextResponse.json(
                { ok: false, error: 'Invalid ruleset definition structure' },
                { status: 400 }
            );
        }

        // Validate percentage ranges (0-1)
        const hardFields = Object.values(def.hard) as number[];
        const softFields = [
            def.soft.minExpectedCagrPct?.value,
            def.soft.growthTargetPct?.value,
            def.soft.minExpectedCagrPct?.weight,
            def.soft.growthTargetPct?.weight,
        ].filter((v) => v !== undefined) as number[];

        const allPercentages = [...hardFields, ...softFields];
        if (allPercentages.some((v) => v < 0 || v > 1)) {
            return NextResponse.json(
                { ok: false, error: 'All percentage/weight values must be between 0 and 1' },
                { status: 400 }
            );
        }

        // Get latest version number
        const latestVersion = await prisma.rulesetVersion.findFirst({
            where: { rulesetId: id },
            orderBy: { version: 'desc' },
        });

        const newVersionNumber = (latestVersion?.version ?? 0) + 1;

        const newVersion = await prisma.rulesetVersion.create({
            data: {
                rulesetId: id,
                version: newVersionNumber,
                definitionJson: JSON.stringify(def),
                isActive: false, // New versions are inactive by default
            },
        });

        return NextResponse.json({ ok: true, data: newVersion });
    } catch (error: any) {
        console.error('[Ruleset Versions] POST error:', error);
        return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
        );
    }
}
