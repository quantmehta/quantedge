import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, ErrorCodes, appendAuditEntry } from '@/lib/api-response';
import { Recommendation } from '@/lib/types';

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

        // Mock recommendations (deterministic based on runId seed)
        const recommendations: Recommendation[] = [
            {
                id: `rec-${runId.substring(0, 4)}-1`,
                type: 'Hedge',
                asset: 'SPY Puts',
                rationale: 'High volatility expected in upcoming Fed meeting.',
                confidence: 85,
                expectedImpact: '-15% Downside Risk',
                actionable: true
            },
            {
                id: `rec-${runId.substring(0, 4)}-2`,
                type: 'Rebalance',
                asset: 'Technology Sector',
                rationale: 'Portfolio overweight in Tech (>65%). exposure limit exceeded.',
                confidence: 95,
                expectedImpact: 'Improved Diversification',
                actionable: true
            },
            {
                id: `rec-${runId.substring(0, 4)}-3`,
                type: 'Buy',
                asset: 'TLT',
                rationale: 'Yields expected to stabilize, offering attractive entry point.',
                confidence: 60,
                expectedImpact: '+4% Yield',
                actionable: true
            }
        ];

        // Persist recommendations (APPEND ONLY)
        for (const rec of recommendations) {
            await prisma.runRecommendation.create({
                data: {
                    runId,
                    recommendationType: rec.type,
                    resultJson: JSON.stringify(rec)
                }
            });
        }

        // Update Run with audit entry and status
        const updatedAuditJson = appendAuditEntry(run.auditJson, 'RECOMMENDATIONS', {
            recommendationsCount: recommendations.length
        });

        await prisma.run.update({
            where: { id: runId },
            data: {
                status: 'RECS_DONE',
                auditJson: updatedAuditJson
            }
        });

        return successResponse({
            runId,
            recommendations,
            createdAt: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('Recommendations Error:', error);
        return errorResponse(ErrorCodes.INTERNAL_ERROR, error.message || 'Failed to fetch recommendations', 500);
    }
}
