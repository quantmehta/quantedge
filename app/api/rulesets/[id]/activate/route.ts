import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/rulesets/:id/activate - Set active version (atomic)
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { rulesetVersionId } = await req.json();

        if (!rulesetVersionId) {
            return NextResponse.json(
                { ok: false, error: 'rulesetVersionId is required' },
                { status: 400 }
            );
        }

        // Verify version belongs to this ruleset
        const version = await prisma.rulesetVersion.findUnique({
            where: { id: rulesetVersionId },
        });

        if (!version || version.rulesetId !== id) {
            return NextResponse.json(
                { ok: false, error: 'Version not found or does not belong to this ruleset' },
                { status: 404 }
            );
        }

        // Atomic transaction: deactivate all, activate one
        await prisma.$transaction(async (tx) => {
            // Deactivate all versions for this ruleset
            await tx.rulesetVersion.updateMany({
                where: { rulesetId: id },
                data: { isActive: false },
            });

            // Activate the selected version
            await tx.rulesetVersion.update({
                where: { id: rulesetVersionId },
                data: { isActive: true },
            });
        });

        return NextResponse.json({ ok: true, message: 'Version activated' });
    } catch (error: any) {
        console.error('[Ruleset Activate] POST error:', error);
        return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
        );
    }
}
