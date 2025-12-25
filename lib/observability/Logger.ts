// -----------------------------------------------------------------------------
// STRUCTURED LOGGER - JSON logging with correlation IDs
// -----------------------------------------------------------------------------

export interface LogContext {
    runId?: string;
    sessionId?: string;
    requestId?: string;
    [key: string]: unknown;
}

export class Logger {
    private static isDevelopment = process.env.NODE_ENV !== 'production';

    /**
     * Log info message
     */
    static info(message: string, context: LogContext = {}): void {
        this.log('INFO', message, context);
    }

    /**
     * Log warning message
     */
    static warn(message: string, context: LogContext = {}): void {
        this.log('WARN', message, context);
    }

    /**
     * Log error message
     */
    static error(message: string, error?: Error, context: LogContext = {}): void {
        const errorContext = error
            ? {
                ...context,
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                },
            }
            : context;

        this.log('ERROR', message, errorContext);
    }

    /**
     * Log debug message (development only)
     */
    static debug(message: string, context: LogContext = {}): void {
        if (this.isDevelopment) {
            this.log('DEBUG', message, context);
        }
    }

    /**
     * Internal log function
     */
    private static log(level: string, message: string, context: LogContext): void {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...context,
        };

        if (this.isDevelopment) {
            // Pretty print in development
            console.log(`[${level}] ${message}`, context);
        } else {
            // JSON in production
            console.log(JSON.stringify(logEntry));
        }
    }

    /**
     * Create child logger with fixed context
     */
    static child(fixedContext: LogContext): {
        info: (msg: string, ctx?: LogContext) => void;
        warn: (msg: string, ctx?: LogContext) => void;
        error: (msg: string, err?: Error, ctx?: LogContext) => void;
        debug: (msg: string, ctx?: LogContext) => void;
    } {
        return {
            info: (msg, ctx = {}) => this.info(msg, { ...fixedContext, ...ctx }),
            warn: (msg, ctx = {}) => this.warn(msg, { ...fixedContext, ...ctx }),
            error: (msg, err, ctx = {}) => this.error(msg, err, { ...fixedContext, ...ctx }),
            debug: (msg, ctx = {}) => this.debug(msg, { ...fixedContext, ...ctx }),
        };
    }
}
