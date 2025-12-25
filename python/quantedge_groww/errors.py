from enum import Enum

class ErrorType(Enum):
    AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED"
    AUTHORIZATION_FAILED = "AUTHORIZATION_FAILED"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    RATE_LIMITED = "RATE_LIMITED"
    TIMEOUT = "TIMEOUT"
    UPSTREAM_UNAVAILABLE = "UPSTREAM_UNAVAILABLE"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNKNOWN = "UNKNOWN"

class GrowwError(Exception):
    def __init__(self, error_type: ErrorType, message: str, retryable: bool = False, debug_hints: list = None, upstream_status: int = None):
        super().__init__(message)
        self.error_type = error_type
        self.message = message
        self.retryable = retryable
        self.debug_hints = debug_hints or []
        self.upstream_status = upstream_status

    def to_dict(self):
        return {
            "type": self.error_type.value,
            "safeMessage": self.message,
            "retryable": self.retryable,
            "debugHints": self.debug_hints,
            "upstreamStatus": self.upstream_status
        }
