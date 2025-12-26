
import { NextResponse } from 'next/server';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { IngestionService } from '@/lib/ingestion-service';

export const runtime = "nodejs";

/**
 * Validates a portfolio upload by discovering headers, parsing rows, 
 * resolving instruments via Groww, and persisting to the database.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { uploadId } = body;

        if (!uploadId) {
            return errorResponse(ErrorCodes.BAD_REQUEST, 'Missing uploadId', 400);
        }

        const result = await IngestionService.validateAndEnrich(uploadId);

        return successResponse({
            success: true,
            validation: {
                summary: result.validationSummary,
                issues: []
            },
            enrichedPreview: result.enrichedPreview,
            uploadId: result.uploadId,
            runId: result.runId,
            _debug: result.debugInfo
        });

    } catch (error: any) {
        console.error('[API/Validate] Fatal Error:', error);
        return errorResponse(
            ErrorCodes.INTERNAL_ERROR,
            error.message || 'Internal Validation Error',
            500
        );
    }
}
