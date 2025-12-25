// -----------------------------------------------------------------------------
// AUDIT LOGGER - Centralized audit event logging with structured schema
// -----------------------------------------------------------------------------

import { prisma } from '../db';

export interface AuditEvent {
    ts: string;                    // ISO timestamp
    sessionId: string;             // Browser session UUID
    runId: string;                 // Run being audited
    action: string;                // SNAPSHOT_RUN, RECOMMENDATIONS_RUN, etc.
    inputs: Record<string, any>;   // uploadId, fileHash, rulesetVersionId, params
    dataRefs: Record<string, any>; // pricesAsOf, priceSource, historyCoverage
    outputs: Record<string, any>;  // artifactIds, summary
    warnings: string[];            // Non-fatal issues
    errors: string[];              // Fatal errors
}

export class AuditLogger {
    /**
     * Append audit event to Run.auditJson
     */
    static async appendAuditEvent(runId: string, event: Omit<AuditEvent, 'ts' | 'runId'>): Promise<void> {
        try {
            // Get current audit log
            const run = await prisma.run.findUnique({
                where: { id: runId },
                select: { auditJson: true },
            });

            if (!run) {
                throw new Error(`Run not found: ${runId}`);
            }

            // Parse existing events
            const existingEvents: AuditEvent[] = run.auditJson ? JSON.parse(run.auditJson) : [];

            // Create new event with timestamp
            const newEvent: AuditEvent = {
                ...event,
                ts: new Date().toISOString(),
                runId,
            };

            // Append and save
            existingEvents.push(newEvent);

            await prisma.run.update({
                where: { id: runId },
                data: {
                    auditJson: JSON.stringify(existingEvents, null, 2),
                },
            });
        } catch (error) {
            console.error('Failed to append audit event:', error);
            // Don't throw - audit failures shouldn't break the main flow
        }
    }

    /**
     * Get complete audit log for a run
     */
    static async getAuditLog(runId: string): Promise<AuditEvent[]> {
        const run = await prisma.run.findUnique({
            where: { id: runId },
            select: { auditJson: true },
        });

        if (!run || !run.auditJson) {
            return [];
        }

        return JSON.parse(run.auditJson);
    }

    /**
     * Validate audit log completeness (FR-10.1 checklist)
     */
    static validateAuditCompleteness(events: AuditEvent[]): {
        complete: boolean;
        missing: string[];
    } {
        const requiredActions = [
            'UPLOAD_CREATED',
            'SNAPSHOT_RUN',
            // Optional: SCENARIO_RUN, EVENT_IMPACT_RUN, RECOMMENDATIONS_RUN, REPORT_GENERATE
        ];

        const missing: string[] = [];
        const presentActions = new Set(events.map((e) => e.action));

        for (const action of requiredActions) {
            if (!presentActions.has(action)) {
                missing.push(action);
            }
        }

        return {
            complete: missing.length === 0,
            missing,
        };
    }

    /**
     * Create audit event helper for common actions
     */
    static createEvent(
        action: string,
        sessionId: string,
        inputs: Record<string, any>,
        dataRefs: Record<string, any> = {},
        outputs: Record<string, any> = {},
        warnings: string[] = [],
        errors: string[] = []
    ): Omit<AuditEvent, 'ts' | 'runId'> {
        return {
            sessionId,
            action,
            inputs,
            dataRefs,
            outputs,
            warnings,
            errors,
        };
    }
}

/**
 * Audit action constants
 */
export const AUDIT_ACTIONS = {
    UPLOAD_CREATED: 'UPLOAD_CREATED',
    SNAPSHOT_RUN: 'SNAPSHOT_RUN',
    SCENARIO_RUN: 'SCENARIO_RUN',
    EVENT_IMPACT_RUN: 'EVENT_IMPACT_RUN',
    RECOMMENDATIONS_RUN: 'RECOMMENDATIONS_RUN',
    REPORT_GENERATE: 'REPORT_GENERATE',
    OVERRIDE_CREATED: 'OVERRIDE_CREATED',
    RULESET_ACTIVATED: 'RULESET_ACTIVATED',
} as const;
