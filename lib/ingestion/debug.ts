/**
 * Debug configuration for the ingestion pipeline.
 * Set INGESTION_DEBUG = true to enable detailed logging.
 */

// ==================== DEBUG FLAG ====================
// Set to true to enable debug logging, false to disable
export const INGESTION_DEBUG = true;
// ====================================================

export interface DebugLogEntry {
    timestamp: string;
    stage: string;
    message: string;
    data?: unknown;
}

// Collector for UI-visible debug logs
const debugLogs: DebugLogEntry[] = [];

/**
 * Log debug message to console and collector (for UI visibility)
 */
export function debugLog(stage: string, message: string, data?: unknown): void {
    if (!INGESTION_DEBUG) return;

    const entry: DebugLogEntry = {
        timestamp: new Date().toISOString(),
        stage,
        message,
        data
    };

    debugLogs.push(entry);

    // Console output with color coding
    const prefix = `[INGESTION DEBUG][${stage}]`;
    if (data !== undefined) {
        console.log(prefix, message, JSON.stringify(data, null, 2));
    } else {
        console.log(prefix, message);
    }
}

/**
 * Get all collected debug logs and clear the buffer
 */
export function getAndClearDebugLogs(): DebugLogEntry[] {
    const logs = [...debugLogs];
    debugLogs.length = 0; // Clear buffer
    return logs;
}

/**
 * Get collected debug logs without clearing
 */
export function getDebugLogs(): DebugLogEntry[] {
    return [...debugLogs];
}

/**
 * Clear debug logs
 */
export function clearDebugLogs(): void {
    debugLogs.length = 0;
}

/**
 * Helper to format an object for logging (truncates large arrays)
 */
export function formatForLog(obj: unknown, maxArrayLength = 5): unknown {
    if (!INGESTION_DEBUG) return null;

    if (Array.isArray(obj)) {
        if (obj.length > maxArrayLength) {
            return [...obj.slice(0, maxArrayLength), `... and ${obj.length - maxArrayLength} more`];
        }
        return obj;
    }
    if (typeof obj === 'object' && obj !== null) {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = formatForLog(value, maxArrayLength);
        }
        return result;
    }
    return obj;
}
