// -----------------------------------------------------------------------------
// ACTION BUCKETING - Deterministic assignment of recommendations to time horizons
// -----------------------------------------------------------------------------

import { Recommendation } from '../recommendations/RecommendationContracts';
import { ActionBucket } from './ReportContracts';

/**
 * Deterministically assigns a recommendation to a time bucket based on:
 * - Recommendation type (BUY, REDUCE, EXIT, etc.)
 * - Rule violations
 * - Event-driven signals
 * - Signal characteristics
 * 
 * Rules (as per BRD requirements):
 * - IMMEDIATE (0-2 weeks): Rule breaches, high event downside, EXIT actions
 * - NEAR_TERM (1-6 months): Diversification adds, most BUY/ADD actions
 * - LONG_TERM (6+ months): Trend-driven BUY actions with low urgency
 */
export class ActionBucketing {
    static assignBucket(recommendation: Recommendation): ActionBucket {
        const { type, rules, rationale: _rationale, trace } = recommendation;

        // Rule 1: Hard rule violations → IMMEDIATE
        if (!rules.passed && rules.violations.length > 0) {
            // Any hard constraint breach requires immediate action
            return 'IMMEDIATE';
        }

        // Rule 2: EXIT actions → IMMEDIATE
        if (type === 'EXIT') {
            return 'IMMEDIATE';
        }

        // Rule 3: REDUCE actions → Check urgency
        if (type === 'REDUCE') {
            // If driven by high event downside or severe breach, immediate
            const hasHighEventImpact = trace.eventImpact && trace.eventImpact < -0.10; // >10% downside
            if (hasHighEventImpact) {
                return 'IMMEDIATE';
            }
            // Otherwise near-term rebalancing
            return 'NEAR_TERM';
        }

        // Rule 4: DIVERSIFY actions → NEAR_TERM (concentration fixes)
        if (type === 'DIVERSIFY') {
            return 'NEAR_TERM';
        }

        // Rule 5: BUY actions → Check signal characteristics
        if (type === 'BUY') {
            // If momentum-driven with positive short-term signals → NEAR_TERM
            const hasMomentum = trace.signalScores?.momentum && trace.signalScores.momentum > 0;

            // If purely long-term trend-based with no immediate catalysts → LONG_TERM
            const hasOnlyLongTermSignals =
                !hasMomentum &&
                !trace.eventImpact &&
                trace.signalScores?.recovery && trace.signalScores.recovery > 0;

            if (hasOnlyLongTermSignals) {
                return 'LONG_TERM';
            }

            // Default BUY/ADD → NEAR_TERM
            return 'NEAR_TERM';
        }

        // Rule 6: HOLD actions → LONG_TERM (monitoring)
        if (type === 'HOLD') {
            return 'LONG_TERM';
        }

        // Default fallback → NEAR_TERM
        return 'NEAR_TERM';
    }

    /**
     * Get human-readable bucket description
     */
    static getBucketDescription(bucket: ActionBucket): string {
        switch (bucket) {
            case 'IMMEDIATE':
                return 'Immediate (0-2 weeks)';
            case 'NEAR_TERM':
                return 'Near-term (1-6 months)';
            case 'LONG_TERM':
                return 'Long-term (6+ months)';
        }
    }

    /**
     * Get bucket priority (for sorting)
     */
    static getBucketPriority(bucket: ActionBucket): number {
        switch (bucket) {
            case 'IMMEDIATE':
                return 1;
            case 'NEAR_TERM':
                return 2;
            case 'LONG_TERM':
                return 3;
        }
    }
}
