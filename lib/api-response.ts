import { NextResponse } from 'next/server';

// -----------------------------------------------------------------------------
// STANDARDIZED API RESPONSE ENVELOPE
// -----------------------------------------------------------------------------

/**
 * Error codes used across all API endpoints.
 * Maps to specific HTTP status codes.
 */
export const ErrorCodes = {
    BAD_REQUEST: 'BAD_REQUEST',
    UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    CONFLICT: 'CONFLICT',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    FILE_IO_ERROR: 'FILE_IO_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export interface ApiError {
    code: ErrorCode;
    message: string;
    details?: any;
}

export interface ApiResponse<T = any> {
    ok: boolean;
    data: T | null;
    error: ApiError | null;
}

/**
 * Creates a successful API response envelope.
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse<ApiResponse<T>> {
    return NextResponse.json(
        { ok: true, data, error: null },
        { status }
    );
}

/**
 * Creates an error API response envelope.
 */
export function errorResponse(
    code: ErrorCode,
    message: string,
    status: number,
    details?: any
): NextResponse<ApiResponse<null>> {
    return NextResponse.json(
        {
            ok: false,
            data: null,
            error: { code, message, details }
        },
        { status }
    );
}

/**
 * Maps error codes to HTTP status codes.
 */
export function getStatusForCode(code: ErrorCode): number {
    switch (code) {
        case ErrorCodes.BAD_REQUEST:
            return 400;
        case ErrorCodes.UNSUPPORTED_MEDIA_TYPE:
            return 415;
        case ErrorCodes.NOT_FOUND:
            return 404;
        case ErrorCodes.VALIDATION_FAILED:
            return 422;
        case ErrorCodes.CONFLICT:
            return 409;
        case ErrorCodes.INTERNAL_ERROR:
        case ErrorCodes.FILE_IO_ERROR:
        default:
            return 500;
    }
}

/**
 * Helper to append an audit entry to a Run's auditJson field.
 */
export function appendAuditEntry(
    existingAuditJson: string | null,
    action: string,
    details: Record<string, any> = {}
): string {
    const audit = existingAuditJson ? JSON.parse(existingAuditJson) : [];
    audit.push({
        ts: new Date().toISOString(),
        action,
        ...details
    });
    return JSON.stringify(audit);
}
