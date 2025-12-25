
import logging
import sys
import json

def setup_logging():
    """
    Configures logging to output JSON-formatted logs to stderr/stdout
    so Node.js parent process can parse them logically, or just standard text
    if we want human readability.
    For this integration, we'll use standard text with levels, allowing Node to capture stderr.
    """
    logger = logging.getLogger("quantedge_groww")
    logger.setLevel(logging.INFO)
    
    handler = logging.StreamHandler(sys.stderr)
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    handler.setFormatter(formatter)
    
    if not logger.handlers:
        logger.addHandler(handler)
        
    return logger
