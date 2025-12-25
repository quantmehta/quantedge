import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/overrides - Create an override log entry
export async function POST(req: NextRequest) {
    try {
        const { runId, recommendationId, ruleCode, ruleSeverity, reason, actor } =
            await req.json();

        // Validation
        if (!runId || !recommendationId || !ruleCode || !reason || !actor) {
            return NextResponse.json(
                { ok: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        if (reason.length < 10) {
            return NextResponse.json(
                { ok: false, error: 'Reason must be at least 10 characters' },
                { status: 400 }
            );
        }

        if (!['HARD', 'SOFT'].includes(ruleSeverity)) {
            return NextResponse.json(
                { ok: false, error: 'ruleSeverity must be HARD or SOFT' },
                { status: 400 }
            );
        }

        // Verify run exists
        const run = await prisma.run.findUnique({ where: { id: runId } });
        if (!run) {
            return NextResponse.json(
                { ok: false, error: 'Run not found' },
                { status: 404 }
            );
        }

        // Create override
        const override = await prisma.runOverride.create({
            data: {
                runId,
                recommendationId,
                ruleCode,
                ruleSeverity,
                reason,
                actor,
            },
        });

        // Append to Run audit log
        const auditEntry = {
            timestamp: new Date().toISOString(),
            action: 'OVERRIDE_CREATED',
            ruleCode,
            severity: ruleSeverity,
            actor,
            reason,
            recommendationId,
        };

        const currentAudit = run.auditJson ? JSON.parse(run.auditJson) : [];
        currentAudit.push(auditEntry);

        await prisma.run.update({
            where: { id: runId },
            data: { auditJson: JSON.stringify(currentAudit) },
        });

        return NextResponse.json({ ok: true, data: override });
    } catch (error: any) {
        console.error('[Overrides] POST error:', error);
        return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
        );
    }
}

// GET /api/overrides?runId=... - Get overrides for a run
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const runId = searchParams.get('runId');

        if (!runId) {
            return NextResponse.json(
                { ok: false, error: 'runId is required' },
                { status: 400 }
            );
        }

        const overrides = await prisma.runOverride.findMany({
            where: { runId },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ ok: true, data: overrides });
    } catch (error: any) {
        console.error('[Overrides] GET error:', error);
        return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
        );
    }
}
