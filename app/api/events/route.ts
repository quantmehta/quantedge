import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, ErrorCodes, appendAuditEntry } from '@/lib/api-response';
import { EventItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const runId = searchParams.get('runId');

        if (!runId) {
            return errorResponse(ErrorCodes.BAD_REQUEST, 'runId is required', 400);
        }

        // Verify run exists
        const run = await prisma.run.findUnique({ where: { id: runId } });
        if (!run) {
            return errorResponse(ErrorCodes.NOT_FOUND, 'Run not found', 404);
        }

        // Mock events (deterministic based on runId seed)
        const events: EventItem[] = [
            {
                id: `evt-${runId.substring(0, 4)}-1`,
                title: 'Fed Rate Decision',
                category: 'Macro',
                direction: 'Neutral',
                magnitude: 'High',
                confidence: 90,
                horizon: 'Short',
                date: '2025-12-18'
            },
            {
                id: `evt-${runId.substring(0, 4)}-2`,
                title: 'Tech Earnings Season',
                category: 'Earnings',
                direction: 'Positive',
                magnitude: 'Medium',
                confidence: 75,
                horizon: 'Short',
                date: '2026-01-15'
            },
            {
                id: `evt-${runId.substring(0, 4)}-3`,
                title: 'Geopolitical Tensions in EMEA',
                category: 'Geopolitical',
                direction: 'Negative',
                magnitude: 'Medium',
                confidence: 60,
                horizon: 'Medium',
                date: '2026-02-01'
            }
        ];

        // Persist event impacts (APPEND ONLY)
        for (const event of events) {
            await prisma.runEventImpact.create({
                data: {
                    runId,
                    eventJson: JSON.stringify(event),
                    impactJson: JSON.stringify({
                        affectedHoldings: [],
                        estimatedImpact: event.direction === 'Positive' ? 0.02 : event.direction === 'Negative' ? -0.02 : 0
                    })
                }
            });
        }

        // Update Run with audit entry and status
        const updatedAuditJson = appendAuditEntry(run.auditJson, 'EVENTS', {
            eventsCount: events.length
        });

        await prisma.run.update({
            where: { id: runId },
            data: {
                status: 'EVENTS_DONE',
                auditJson: updatedAuditJson
            }
        });

        return successResponse({
            runId,
            events,
            createdAt: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('Events Error:', error);
        return errorResponse(ErrorCodes.INTERNAL_ERROR, error.message || 'Failed to fetch events', 500);
    }
}
