// -----------------------------------------------------------------------------
// METRICS ENDPOINT - System metrics for observability
// -----------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        // Get counts from last hour (simplified for V1)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        // Count recent runs
        const recentRuns = await prisma.run.count({
            where: {
                createdAt: { gte: oneHourAgo },
            },
        });

        // Count failures
        const failedRuns = await prisma.run.count({
            where: {
                createdAt: { gte: oneHourAgo },
                status: { contains: 'FAILED' },
            },
        });

        // Count reports generated
        const reportsGenerated = await prisma.report.count({
            where: {
                createdAt: { gte: oneHourAgo },
                status: 'READY',
            },
        });

        // Error rate
        const errorRate = recentRuns > 0 ? (failedRuns / recentRuns) * 100 : 0;

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            window: '1 hour',
            runs: {
                total: recentRuns,
                failed: failedRuns,
                errorRate: errorRate.toFixed(2) + '%',
            },
            reports: {
                generated: reportsGenerated,
            },
            // Placeholder for future enhancements
            latency: {
                p50: null,
                p95: null,
                p99: null,
            },
            cache: {
                hitRate: null,
            },
            external: {
                growwFailures: null,
            },
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Failed to fetch metrics',
            },
            { status: 500 }
        );
    }
}
