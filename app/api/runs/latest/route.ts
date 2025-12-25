import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const latestRun = await prisma.run.findFirst({
            where: {
                upload: {
                    status: 'VALIDATED'
                }
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true }
        });

        console.log(`[Latest Run API] Found: ${latestRun?.id}`);

        if (!latestRun) {
            return errorResponse(ErrorCodes.NOT_FOUND, 'No active runs found', 404);
        }

        return successResponse({ runId: latestRun.id });

    } catch (error: any) {
        console.error('Latest run fetch error:', error);
        return errorResponse(ErrorCodes.INTERNAL_ERROR, error.message || 'Failed to fetch latest run', 500);
    }
}
