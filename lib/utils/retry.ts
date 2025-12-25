
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: {
        maxAttempts?: number;
        baseDelayMs?: number;
        shouldRetry?: (error: unknown) => boolean;
    } = {}
): Promise<T> {
    const {
        maxAttempts = 5,
        baseDelayMs = 250,
        shouldRetry = (err: unknown) => {
            // Retry network errors, 429, 5xx
            // Don't retry generic 4xx (except 429)
            const status = (err as { status?: number; response?: { status?: number } })?.status ||
                (err as { status?: number; response?: { status?: number } })?.response?.status;
            if (status === 429) return true;
            if (status && status >= 500) return true;
            // Detect fetch/network errors (usually no status)
            if (!status && err instanceof Error && (err.message.includes('fetch') || err.message.includes('network'))) return true;
            return false;
        }
    } = options;

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error: unknown) {
            lastError = error;
            if (attempt === maxAttempts || !shouldRetry(error)) {
                throw error;
            }

            // Exponential backoff
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            // Jitter: 0-100ms
            const jitter = Math.random() * 100;
            const fullDelay = delay + jitter;

            // console.log(`[Retry] Attempt ${attempt} failed. Retrying in ${Math.round(fullDelay)}ms...`, error.message);
            await new Promise(resolve => setTimeout(resolve, fullDelay));
        }
    }

    throw lastError;
}

