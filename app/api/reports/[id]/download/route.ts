import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import fs from 'fs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: reportId } = await params;

        // Fetch report
        const report = await prisma.report.findUnique({
            where: { id: reportId },
        });

        if (!report) {
            return NextResponse.json({ ok: false, error: 'Report not found' }, { status: 404 });
        }

        if (report.status !== 'READY') {
            return NextResponse.json(
                { ok: false, error: `Report status is ${report.status}` },
                { status: 400 }
            );
        }

        if (!report.storedPath || !fs.existsSync(report.storedPath)) {
            return NextResponse.json({ ok: false, error: 'Report file not found' }, { status: 404 });
        }

        // Read file and stream
        const fileBuffer = fs.readFileSync(report.storedPath);

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="quantedge_report_${reportId}.pdf"`,
                'Content-Length': fileBuffer.length.toString(),
            },
        });
    } catch (error: any) {
        console.error('Report download failed:', error);
        return NextResponse.json(
            { ok: false, error: error.message || 'Download failed' },
            { status: 500 }
        );
    }
}
