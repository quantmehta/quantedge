import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { IngestionProcessor } from '@/lib/ingestion/processor';
import { GrowwIngestionLookup } from '@/lib/ingestion/groww-lookup';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const upload = await prisma.portfolioUpload.findUnique({ where: { id } });
        if (!upload) return NextResponse.json({ error: "Upload not found" }, { status: 404 });

        const fullPath = path.resolve(process.cwd(), upload.storedPath);
        if (!fs.existsSync(fullPath)) {
            return NextResponse.json({ error: "File not found on server" }, { status: 500 });
        }

        const fileBuffer = fs.readFileSync(fullPath);
        const ingestionResult = IngestionProcessor.process(fileBuffer, upload.originalFilename);

        // For the preview, we enrich the first sheet's rows
        const firstSheet = ingestionResult.sheets[0];
        if (firstSheet && firstSheet.header_rows_used.length > 0) {
            const enrichedRows = await GrowwIngestionLookup.enrichPreviewRows(
                firstSheet.preview.rows,
                firstSheet.column_roles
            );
            firstSheet.preview.rows = enrichedRows;
        }

        return NextResponse.json(ingestionResult);

    } catch (error) {
        console.error("Preview error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
