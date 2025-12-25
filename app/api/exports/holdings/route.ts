import { NextResponse } from 'next/server';
import { CsvExporter } from '@/lib/reports/CsvExporter';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const runId = searchParams.get('runId');

        if (!runId) {
            return NextResponse.json({ ok: false, error: 'runId is required' }, { status: 400 });
        }

        // Generate CSV
        const csv = await CsvExporter.generateHoldingsCsv(runId);

        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="holdings_${runId}.csv"`,
            },
        });
    } catch (error: any) {
        console.error('CSV export failed:', error);
        return NextResponse.json(
            { ok: false, error: error.message || 'CSV export failed' },
            { status: 500 }
        );
    }
}
