"""
Groww Market Data Module
Handles LTP, OHLC, Quote, and Historical data fetching.
"""
from .auth import get_groww_client
from .retry import exponential_backoff
from .errors import GrowwError, ErrorType
from .logging_config import setup_logging
import datetime

logger = setup_logging()

@exponential_backoff()
def get_ltp(exchange_trading_symbols, segment="CASH"):
    """
    Fetches LTP for a list of symbols.
    """
    client = get_groww_client()
    
    try:
        # Ensure symbols is a tuple (SDK requirement)
        if isinstance(exchange_trading_symbols, list):
            symbols = tuple(exchange_trading_symbols)
        elif isinstance(exchange_trading_symbols, str):
            symbols = (exchange_trading_symbols,)
        else:
            symbols = tuple(exchange_trading_symbols)
        
        # Map segment string to SDK constant
        if segment == "CASH":
            seg = client.SEGMENT_CASH
        elif segment == "FNO":
            seg = client.SEGMENT_FNO
        elif segment == "COMMODITY":
            seg = client.SEGMENT_COMMODITY
        else:
            seg = client.SEGMENT_CASH
        
        logger.info(f"Fetching LTP for {len(symbols)} symbols")
        
        # Call the real SDK method
        response = client.get_ltp(segment=seg, exchange_trading_symbols=symbols)
        
        # Normalize to our standard format
        items = []
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        for symbol, price in response.items():
            items.append({
                "symbol": symbol,
                "price": float(price) if price else 0.0,
                "asOf": now_iso,
                "source": "groww_live",
                "curr": "INR"
            })
        
        logger.info(f"LTP fetch successful: {len(items)} prices retrieved")
        # Return strict envelope data only here, wrapper handles header
        return {"items": items}
        
    except Exception as e:
        if isinstance(e, GrowwError): raise e
        raise GrowwError(ErrorType.UPSTREAM_UNAVAILABLE, f"LTP batch failed: {str(e)}")


@exponential_backoff()
def get_ohlc(exchange_trading_symbols, segment="CASH"):
    """
    Fetches OHLC for a list of symbols.
    """
    client = get_groww_client()
    
    try:
        if isinstance(exchange_trading_symbols, list):
            symbols = tuple(exchange_trading_symbols) if len(exchange_trading_symbols) > 1 else exchange_trading_symbols[0]
        else:
            symbols = exchange_trading_symbols
        
        seg = client.SEGMENT_CASH if segment == "CASH" else client.SEGMENT_FNO
        
        response = client.get_ohlc(segment=seg, exchange_trading_symbols=symbols)
        return {"ohlc": response}
        
    except Exception as e:
         if isinstance(e, GrowwError): raise e
         raise GrowwError(ErrorType.UPSTREAM_UNAVAILABLE, f"OHLC failed: {str(e)}")


@exponential_backoff()
def get_quote(trading_symbol, exchange="NSE", segment="CASH"):
    """
    Fetches full quote data for a single instrument.
    """
    client = get_groww_client()
    
    try:
        exc = client.EXCHANGE_NSE if exchange == "NSE" else client.EXCHANGE_BSE
        seg = client.SEGMENT_CASH if segment == "CASH" else client.SEGMENT_FNO
        
        response = client.get_quote(
            exchange=exc,
            segment=seg,
            trading_symbol=trading_symbol
        )
        return {"quote": response}
        
    except Exception as e:
         if isinstance(e, GrowwError): raise e
         raise GrowwError(ErrorType.UPSTREAM_UNAVAILABLE, f"Quote failed: {str(e)}")


@exponential_backoff()
def get_historical_candles(trading_symbol, start_time, end_time, exchange="NSE", segment="CASH", interval_in_minutes=5):
    """
    Fetches historical candle data.
    """
    client = get_groww_client()
    
    try:
        exc = client.EXCHANGE_NSE if exchange == "NSE" else client.EXCHANGE_BSE
        seg = client.SEGMENT_CASH if segment == "CASH" else client.SEGMENT_FNO
        
        # Ensure start_time and end_time are valid strings for SDK
        
        response = client.get_historical_candle_data(
            trading_symbol=trading_symbol,
            exchange=exc,
            segment=seg,
            start_time=start_time,
            end_time=end_time,
            interval_in_minutes=interval_in_minutes
        )
        
        # Response: {"candles": [[timestamp, open, high, low, close, volume], ...]}
        candles = []
        for c in response.get("candles", []):
            candles.append({
                "timestamp": c[0],
                "open": c[1],
                "high": c[2],
                "low": c[3],
                "close": c[4],
                "volume": c[5]
            })
        
        return {"candles": candles, "source": "groww_historical"}
        
    except Exception as e:
         if isinstance(e, GrowwError): raise e
         # Check for specific "Access forbidden" in history
         if "Access forbidden" in str(e):
              raise GrowwError(ErrorType.PERMISSION_DENIED, "Access forbidden for historical data", retryable=False)
              
         raise GrowwError(ErrorType.UPSTREAM_UNAVAILABLE, f"Historical data failed: {str(e)}")
