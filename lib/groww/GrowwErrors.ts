export enum GrowwErrorType {
    AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
    AUTHORIZATION_FAILED = "AUTHORIZATION_FAILED",
    PERMISSION_DENIED = "PERMISSION_DENIED",
    RATE_LIMITED = "RATE_LIMITED",
    TIMEOUT = "TIMEOUT",
    UPSTREAM_UNAVAILABLE = "UPSTREAM_UNAVAILABLE",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    UNKNOWN = "UNKNOWN"
}

export interface GrowwErrorDetail {
    type: GrowwErrorType;
    safeMessage: string;
    retryable: boolean;
    debugHints?: string[];
    upstreamStatus?: number;
}

export class GrowwClientError extends Error {
    public readonly type: GrowwErrorType;
    public readonly retryable: boolean;
    public readonly debugHints: string[];
    public readonly upstreamStatus?: number;

    constructor(detail: GrowwErrorDetail) {
        super(detail.safeMessage);
        this.name = 'GrowwClientError';
        this.type = detail.type;
        this.retryable = detail.retryable;
        this.debugHints = detail.debugHints || [];
        this.upstreamStatus = detail.upstreamStatus;
    }
}
