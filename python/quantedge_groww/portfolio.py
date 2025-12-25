"""
Groww Portfolio Module
Handles Holdings and Positions fetching.
"""
from .auth import get_groww_client
from .retry import exponential_backoff
from .errors import GrowwError, ErrorType
from .logging_config import setup_logging

logger = setup_logging()

@exponential_backoff()
def get_holdings():
    """
    Fetches user's holdings (long-term equity delivery stocks in DEMAT).
    """
    client = get_groww_client()
    
    try:
        logger.info("Fetching user holdings...")
        
        # Real SDK method
        response = client.get_holdings_for_user(timeout=10)
        
        # Response: {"holdings": [{...}, {...}]}
        holdings = response.get("holdings", [])
        
        logger.info(f"Holdings fetch successful: {len(holdings)} holdings found")
        return {"holdings": holdings}
        
    except Exception as e:
        if isinstance(e, GrowwError): raise e
        
        # Check strict permission error
        msg = str(e)
        if "Access forbidden" in msg:
             logger.warning("Holdings fetch forbidden - checking permissions")
             # In strict mode (production) we should raise PERMISSION_DENIED
             # But prompt says "resolve issues", so explicit error is better than empty list now
             raise GrowwError(ErrorType.PERMISSION_DENIED, f"Holdings access forbidden: {msg}", retryable=False)
             
        raise GrowwError(ErrorType.UPSTREAM_UNAVAILABLE, f"Holdings fetch failed: {msg}")


@exponential_backoff()
def get_positions(segment=None):
    """
    Fetches user's positions (intraday and carry-forward).
    """
    client = get_groww_client()
    
    try:
        logger.info(f"Fetching user positions (segment={segment})...")
        
        # Map segment string to SDK constant if provided
        seg = None
        if segment == "CASH":
            seg = client.SEGMENT_CASH
        elif segment == "FNO":
            seg = client.SEGMENT_FNO
        elif segment == "COMMODITY":
            seg = client.SEGMENT_COMMODITY
        
        # Real SDK method
        if seg:
            response = client.get_positions_for_user(segment=seg)
        else:
            response = client.get_positions_for_user()
        
        positions = response.get("positions", [])
        
        logger.info(f"Positions fetch successful: {len(positions)} positions found")
        return {"positions": positions}
        
    except Exception as e:
        if isinstance(e, GrowwError): raise e
        msg = str(e)
        if "Access forbidden" in msg:
             raise GrowwError(ErrorType.PERMISSION_DENIED, f"Positions access forbidden: {msg}", retryable=False)
             
        raise GrowwError(ErrorType.UPSTREAM_UNAVAILABLE, f"Positions fetch failed: {msg}")


@exponential_backoff()
def get_position_for_symbol(trading_symbol, segment="CASH"):
    """
    Fetches position for a specific symbol.
    """
    client = get_groww_client()
    
    try:
        seg = client.SEGMENT_CASH if segment == "CASH" else client.SEGMENT_FNO
        
        response = client.get_position_for_trading_symbol(
            trading_symbol=trading_symbol,
            segment=seg
        )
        
        return {"positions": response.get("positions", [])}
        
    except Exception as e:
         if isinstance(e, GrowwError): raise e
         raise GrowwError(ErrorType.UPSTREAM_UNAVAILABLE, f"Position fetch failed: {str(e)}")
