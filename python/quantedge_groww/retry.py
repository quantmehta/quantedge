
import time
import random
import functools
import os
from .errors import GrowwError
from .logging_config import setup_logging

logger = setup_logging()

def exponential_backoff(base_delay=None, max_delay=None, max_retries=None):
    """
    Decorator for exponential backoff with jitter using Environment Variables.
    """
    # Load defaults from env or prompt constants
    _base = float(os.getenv("GROWW_RETRY_BASE_DELAY_MS", 250)) / 1000.0
    _max = float(os.getenv("GROWW_RETRY_MAX_DELAY_MS", 5000)) / 1000.0
    _retries = int(os.getenv("GROWW_RETRY_MAX_ATTEMPTS", 5))

    base_delay = base_delay if base_delay else _base
    max_delay = max_delay if max_delay else _max
    max_retries = max_retries if max_retries else _retries

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            retries = 0
            while True:
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    # Retry Logic based on unified taxonomy
                    should_retry = False
                    
                    if isinstance(e, GrowwError):
                        if e.retryable:
                            should_retry = True
                    else:
                        # Unclassified exceptions (network, etc) - retry conservatively
                        # Unless clearly auth related in message
                        msg = str(e).lower()
                        if "auth" in msg or "permission" in msg or "forbidden" in msg:
                            should_retry = False
                        else:
                            should_retry = True
                    
                    if not should_retry or retries >= max_retries:
                        if retries > 0:
                            logger.error(f"Operation failed after {retries} retries: {str(e)}")
                        raise e
                    
                    # Full jitter
                    sleep_time = random.uniform(0, min(base_delay * (2 ** retries), max_delay))
                    
                    logger.warning(f"Operation failed, retrying in {sleep_time:.2f}s ({retries+1}/{max_retries}). Error: {str(e)}")
                    time.sleep(sleep_time)
                    retries += 1
        return wrapper
    return decorator
