// -----------------------------------------------------------------------------
// SESSION MANAGER - Client-side session ID generation and persistence
// -----------------------------------------------------------------------------

const SESSION_KEY = 'quantedge_session_id';

export class SessionManager {
    private static sessionId: string | null = null;

    /**
     * Get or create session ID (browser-side only)
     */
    static getSessionId(): string {
        if (typeof window === 'undefined') {
            // Server-side: return empty or from header
            return '';
        }

        // Check memory cache
        if (this.sessionId) {
            return this.sessionId;
        }

        // Check localStorage
        let storedId = localStorage.getItem(SESSION_KEY);

        if (!storedId) {
            // Generate new UUID
            storedId = this.generateUUID();
            localStorage.setItem(SESSION_KEY, storedId);
        }

        this.sessionId = storedId;
        return storedId;
    }

    /**
     * Clear session (for testing or logout)
     */
    static clearSession(): void {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(SESSION_KEY);
            this.sessionId = null;
        }
    }

    /**
     * Generate UUID v4
     */
    private static generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    /**
     * Extract session ID from request headers (server-side)
     */
    static extractFromHeaders(headers: Headers): string | null {
        return headers.get('x-session-id');
    }
}
