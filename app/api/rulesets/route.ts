import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/rulesets - List all rulesets with their active version
export async function GET() {
    try {
        const rulesets = await prisma.ruleset.findMany({
            include: {
                versions: {
                    where: { isActive: true },
                    take: 1,
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ ok: true, data: rulesets });
    } catch (error: any) {
        console.error('[Rulesets] GET error:', error);
        return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST /api/rulesets - Create a new ruleset
export async function POST(req: NextRequest) {
    try {
        const { name, description } = await req.json();

        if (!name) {
            return NextResponse.json(
                { ok: false, error: 'Name is required' },
                { status: 400 }
            );
        }

        const ruleset = await prisma.ruleset.create({
            data: {
                name,
                description: description || null,
            },
        });

        return NextResponse.json({ ok: true, data: ruleset });
    } catch (error: any) {
        console.error('[Rulesets] POST error:', error);
        return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
        );
    }
}
