import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        const { id: runId } = await params;

        if (!runId) {
            return errorResponse(ErrorCodes.BAD_REQUEST, 'Run ID is required', 400);
        }

        // Fetch run with all related data
        const run = await prisma.run.findUnique({
            where: { id: runId },
            include: {
                upload: {
                    select: {
                        id: true,
                        originalFilename: true,
                        fileHashSha256: true,
                        storedPath: true,
                        createdAt: true
                    }
                },
                snapshots: {
                    select: { id: true, createdAt: true },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                },
                scenarios: {
                    select: { id: true, createdAt: true },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                },
                events: {
                    select: { id: true, createdAt: true },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                },
                recommendations: {
                    select: { id: true, createdAt: true },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                },
                reports: {
                    select: { id: true, createdAt: true },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        if (!run) {
            return errorResponse(ErrorCodes.NOT_FOUND, 'Run not found', 404);
        }

        // Parse audit log
        let audit: any[] = [];
        if (run.auditJson) {
            try {
                audit = JSON.parse(run.auditJson);
            } catch {
                audit = [];
            }
        }

        // Build presence objects with timestamps
        const buildPresence = (items: { id: string; createdAt: Date }[]) => ({
            exists: items.length > 0,
            latestAt: items.length > 0 ? items[0].createdAt.toISOString() : null
        });

        const response = {
            run: {
                runId: run.id,
                createdAt: run.createdAt.toISOString(),
                status: run.status,
                asOfMarketTimestamp: run.asOfMarketTimestamp?.toISOString() || null,
                audit,
                upload: run.upload ? {
                    uploadId: run.upload.id,
                    originalFilename: run.upload.originalFilename,
                    fileHashSha256: run.upload.fileHashSha256,
                    storedPath: run.upload.storedPath,
                    createdAt: run.upload.createdAt.toISOString()
                } : null,
                presence: {
                    snapshot: buildPresence(run.snapshots),
                    scenarios: buildPresence(run.scenarios),
                    events: buildPresence(run.events),
                    recommendations: buildPresence(run.recommendations),
                    report: buildPresence(run.reports)
                }
            }
        };

        return successResponse(response);

    } catch (error: any) {
        console.error('Run detail error:', error);
        return errorResponse(ErrorCodes.INTERNAL_ERROR, error.message || 'Failed to fetch run', 500);
    }
}
