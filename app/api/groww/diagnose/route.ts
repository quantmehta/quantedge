import { NextRequest, NextResponse } from 'next/server';
import { GrowwConnector } from '@/lib/groww/GrowwConnector';
import { GrowwClientError } from '@/lib/groww/GrowwErrors';

export const dynamic = 'force-dynamic';

/**
 * POST /api/groww/diagnose
 * Runs the Auth & Permission Diagnostic suite.
 */
export async function POST(req: NextRequest) {
    try {
        const result = await GrowwConnector.callPython('AUTH_DIAGNOSE', {});

        return NextResponse.json({
            ok: true,
            data: result.data || result
        });

    } catch (error: any) {
        console.error("Diagnosis Error:", error);

        if (error instanceof GrowwClientError) {
            return NextResponse.json({
                ok: false,
                error: {
                    type: error.type,
                    message: error.message,
                    hints: error.debugHints
                }
            }, { status: 500 });
        }

        return NextResponse.json({
            ok: false,
            error: {
                type: "UNKNOWN",
                message: error.message || "Unknown server error"
            }
        }, { status: 500 });
    }
}
