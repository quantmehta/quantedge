import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        // Parse pagination params
        const limitParam = searchParams.get('limit');
        const offsetParam = searchParams.get('offset');

        let limit = limitParam ? parseInt(limitParam, 10) : 50;
        if (isNaN(limit) || limit < 1) limit = 50;
        if (limit > 200) limit = 200; // Max limit

        let offset = offsetParam ? parseInt(offsetParam, 10) : 0;
        if (isNaN(offset) || offset < 0) offset = 0;

        // Fetch runs with related data for presence flags
        const runs = await prisma.run.findMany({
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit,
            include: {
                upload: {
                    select: {
                        id: true,
                        originalFilename: true
                    }
                },
                snapshots: {
                    select: { id: true },
                    take: 1
                },
                scenarios: {
                    select: { id: true },
                    take: 1
                },
                events: {
                    select: { id: true },
                    take: 1
                },
                recommendations: {
                    select: { id: true },
                    take: 1
                },
                reports: {
                    select: { id: true },
                    take: 1
                }
            }
        });

        // Map to response format
        const items = runs.map(run => ({
            runId: run.id,
            createdAt: run.createdAt.toISOString(),
            status: run.status,
            upload: run.upload ? {
                uploadId: run.upload.id,
                originalFilename: run.upload.originalFilename
            } : null,
            presence: {
                snapshot: run.snapshots.length > 0,
                scenarios: run.scenarios.length > 0,
                events: run.events.length > 0,
                recommendations: run.recommendations.length > 0,
                report: run.reports.length > 0
            }
        }));

        return successResponse({
            items,
            paging: { limit, offset }
        });

    } catch (error: any) {
        console.error('Runs fetch error:', error);
        return errorResponse(ErrorCodes.INTERNAL_ERROR, error.message || 'Failed to fetch runs', 500);
    }
}
