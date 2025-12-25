import { NextRequest, NextResponse } from 'next/server';
import { computeDecision, DecisionPayload, Criterion } from '@/lib/decision-compute-engine';
import { z } from 'zod';

// Zod Schema for strict validation
const PayloadSchema = z.object({
    criterion: z.nativeEnum(Criterion),
    alternatives: z.array(z.string()).min(2),
    states: z.array(z.string()).min(2),
    payoffs: z.array(z.array(z.string())), // Check dimensions in logic or refine schema
    probabilities: z.array(z.string()).optional(),
    alpha: z.string().optional()
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Validate Schema
        const parseResult = PayloadSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json({
                error: "Invalid Payload",
                details: parseResult.error.issues
            }, { status: 400 });
        }

        const payload = parseResult.data as DecisionPayload;

        // Additional Logic Validation (Dimensions)
        if (payload.payoffs.length !== payload.alternatives.length) {
            return NextResponse.json({ error: "Payoff rows must match alternatives count" }, { status: 400 });
        }
        if (payload.payoffs[0].length !== payload.states.length) {
            return NextResponse.json({ error: "Payoff columns must match states count" }, { status: 400 });
        }

        // Compute
        const result = computeDecision(payload);

        return NextResponse.json(result);

    } catch (e: any) {
        console.error("Computation Error", e);
        return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 });
    }
}
