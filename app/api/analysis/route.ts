import { NextRequest, NextResponse } from "next/server";
import { calculatePortfolioAnalysis } from "@/lib/analysis-engine";
import { successResponse, errorResponse, ErrorCodes } from "@/lib/api-response";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("runId");

    if (!runId) {
        return errorResponse(ErrorCodes.BAD_REQUEST, "runId is required", 400);
    }

    console.log(`[Analysis API] Processing runId: "${runId}"`);

    try {
        const analysis = await calculatePortfolioAnalysis(runId);
        return successResponse({ analysis });
    } catch (error: any) {
        console.error("[Analysis API Error]", error);
        return errorResponse(ErrorCodes.INTERNAL_ERROR, error.message, 500);
    }
}
