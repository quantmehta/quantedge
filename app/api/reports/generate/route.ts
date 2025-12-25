import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ArtifactAggregator } from '@/lib/reports/ArtifactAggregator';
import { PdfGenerator } from '@/lib/reports/PdfGeneratorV2';
import path from 'path';
import fs from 'fs';

export async function POST(request: Request) {
    try {
        const { runId } = await request.json();

        if (!runId) {
            return NextResponse.json({ ok: false, error: 'runId is required' }, { status: 400 });
        }

        // Verify run exists
        const run = await prisma.run.findUnique({ where: { id: runId } });
        if (!run) {
            return NextResponse.json({ ok: false, error: 'Run not found' }, { status: 404 });
        }

        // Check for existing READY report (idempotency)
        const existingReport = await prisma.report.findFirst({
            where: {
                runId,
                status: 'READY',
            },
            orderBy: { createdAt: 'desc' },
        });

        if (existingReport && existingReport.storedPath && fs.existsSync(existingReport.storedPath)) {
            // Return existing report
            return NextResponse.json({
                ok: true,
                reportId: existingReport.id,
                status: 'READY',
                message: 'Report already exists',
            });
        }

        // Create Report row (status: QUEUED)
        const report = await prisma.report.create({
            data: {
                runId,
                status: 'QUEUED',
            },
        });

        // Update to GENERATING
        await prisma.report.update({
            where: { id: report.id },
            data: { status: 'GENERATING' },
        });

        try {
            // Aggregate artifacts
            const reportData = await ArtifactAggregator.aggregateForRun(runId);
            reportData.metadata.reportId = report.id;

            // Generate PDF
            const reportsDir = path.join(process.cwd(), 'data', 'reports', runId);
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }

            const timestamp = Date.now();
            const filename = `report_${timestamp}.pdf`;
            const outputPath = path.join(reportsDir, filename);

            const generator = new PdfGenerator();
            await generator.generate(reportData, outputPath);

            // Update Report (status: READY)
            await prisma.report.update({
                where: { id: report.id },
                data: {
                    status: 'READY',
                    storedPath: outputPath,
                },
            });

            return NextResponse.json({
                ok: true,
                reportId: report.id,
                status: 'READY',
            });
        } catch (error: any) {
            // Update Report (status: FAILED)
            await prisma.report.update({
                where: { id: report.id },
                data: {
                    status: 'FAILED',
                    error: error.message,
                },
            });

            throw error;
        }
    } catch (error: any) {
        console.error('Report generation failed:', error);
        return NextResponse.json(
            { ok: false, error: error.message || 'Report generation failed' },
            { status: 500 }
        );
    }
}

