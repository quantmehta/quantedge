// -----------------------------------------------------------------------------
// HEALTH ENDPOINT - System health check
// -----------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
    const startTime = Date.now();

    try {
        // Check database connectivity
        await prisma.$queryRaw`SELECT 1`;

        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();

        return NextResponse.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: Math.floor(uptime),
            memory: {
                heapUsed: Math.floor(memoryUsage.heapUsed / 1024 / 1024), // MB
                heapTotal: Math.floor(memoryUsage.heapTotal / 1024 / 1024),
                rss: Math.floor(memoryUsage.rss / 1024 / 1024),
            },
            database: 'connected',
            responseTime: Date.now() - startTime,
        });
    } catch (error) {
        return NextResponse.json(
            {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                database: 'disconnected',
            },
            { status: 503 }
        );
    }
}
