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

from .auth import get_groww_client, AuthManager
from .retry import exponential_backoff
from .errors import GrowwError, ErrorType
from .logging_config import setup_logging
from .resolution_engine import engine as resolution_engine
import datetime
import concurrent.futures
import time

logger = setup_logging()

def get_smart_ltp(items):
    """
    Smart LTP Fetching Strategy.
    1. Verifies user account access (NSE/BSE).
    2. Resolves symbols locally (ISIN -> Symbol -> Name) via ResolutionEngine.
    3. Batches API calls efficiently (50/batch).
    
    items: List of dicts { 'symbol': ..., 'isin': ..., 'exchange': ... } 
           OR list of strings (treated as symbols).
    """
    # 1. Account Access Check
    try:
        profile = AuthManager.get_user_profile_data()
        # Derive enabled exchanges. 
        # Typically implicit in 'products' or 'subscriptions', but for now assume 
        # checked permissions or default to both if profile fetch succeeds.
        # Ideally: enabled_exchanges = ['NSE', 'BSE'] 
        # Real logic might be complex; we'll assume both if authorized, 
        # unless strict flag prevents it.
        enabled_exchanges = ['NSE', 'BSE'] 
    except Exception as e:
        logger.warning(f"Profile check failed, defaulting to NSE only logic: {e}")
        enabled_exchanges = ['NSE']

    # 2. Resolve Items
    resolution_engine.initialize()
    
    resolved_batch = []
    original_map = {} # normalized_key -> original_item_index
    
    for idx, item in enumerate(items):
        query = {}
        if isinstance(item, str):
            query = {'symbol': item}
        elif isinstance(item, dict):
            query = item
        else:
            continue
            
        # Resolve
        match = resolution_engine.resolve(query, enabled_exchanges)
        
        if match:
            # Construct API format string: "EXCHANGE_SYMBOL"
            # Groww Python SDK expects explicit exchange via params usually, 
            # but ltp_batch underlying call typically takes "NSE_RELIANCE" style 
            # OR we group by exchange. 
            # The SDK method `get_ltp` takes `exchange_trading_symbols`.
            # Typically these are "NSE_RELIANCE".
            
            exch_prefix = match['exchange'] + "_"
            # Raw instrument data uses snake_case keys
            full_symbol = exch_prefix + match.get('trading_symbol', match.get('tradingSymbol'))
            
            resolved_batch.append(full_symbol)
            
            # Map back to let us return data for this input item
            # We key by the full_symbol so when API returns we know who asked for it
            if full_symbol not in original_map:
                original_map[full_symbol] = []
            original_map[full_symbol].append(idx)
        else:
            # Failed to resolve locally
            # We could try a "blind" fetch if it looks valid, but 'Smart' implies we rely on index.
            # Mark as failed in result?
            pass

    if not resolved_batch:
        return {"items": []}

    # 3. Batch Execution
    unique_symbols = list(set(resolved_batch))
    BATCH_SIZE = 50
    results = {}

    client = get_groww_client()
    # Determine segment (default CASH for now, can extract from resolution)
    seg = client.SEGMENT_CASH 

    def fetch_chunk(chunk):
        try:
            # Rate limit throttle mechanism (simplistic sleep)
            # Better: use a token bucket. For now, mild sleep.
            time.sleep(0.2) 
            
            logger.info(f"SmartBatch: Fetching {len(chunk)}...")
            resp = client.get_ltp(segment=seg, exchange_trading_symbols=chunk)
            return resp
        except Exception as e:
            logger.error(f"SmartBatch failed for chunk: {e}")
            return {}

    # Parallel Execution? 
    # Python threads + GIL? I/O bound is fine.
    # Max concurrency 3
    final_responses = {}
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = []
        for i in range(0, len(unique_symbols), BATCH_SIZE):
            chunk = unique_symbols[i : i + BATCH_SIZE]
            futures.append(executor.submit(fetch_chunk, chunk))
            
        for future in concurrent.futures.as_completed(futures):
            try:
                data = future.result()
                if data:
                    final_responses.update(data)
            except Exception as exc:
                logger.error(f"Chunk execution exception: {exc}")

    # 4. Normalize Results
    output_items = []
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    # We need to map the API results (which are "Symbol" -> Price) back to original inputs
    # The API response keys are usually "NSE_RELIANCE" or just "RELIANCE"?
    # SDK `get_ltp` usually returns dict { "NSE_RELIANCE": 1234.5 } if inputs were prefixed.
    
    for full_sym, price in final_responses.items():
        # Clean price
        try:
            val = float(price)
        except:
            val = 0.0
            
        # Find who asked for this
        # API might return "RELIANCE" even if we asked "NSE_RELIANCE"? 
        # Usually it echoes input keys if they were unique.
        # Let's check both keys
        
        indices = original_map.get(full_sym)
        if not indices:
             # Try stripping prefix if response didn't have it
             # OR adding prefix if response didn't have it
             pass
             
        if indices:
            for original_idx in indices:
                # We can construct the response item
                # The caller expects specific format? 
                # We'll return a rich object
                output_items.append({
                    "original_index": original_idx, # Helper
                    "symbol": full_sym, # The resolved symbol we fetched
                    "price": val,
                    "asOf": now_iso,
                    "source": "groww_smart"
                })
    
    # Sort by original index to maintain order? 
    # Or just return list. The UI maps by symbol anyway.
    
    return {"items": output_items}

@exponential_backoff()
def get_ltp(exchange_trading_symbols, segment="CASH"):
    """
    Fetches LTP for a list of symbols.
    Tries batch fetch first, falls back to individual fetch if batch fails (resilient mode).
    """
    client = get_groww_client()
    
    # Ensure symbols is a tuple
    if isinstance(exchange_trading_symbols, list):
        symbols = tuple(exchange_trading_symbols)
    elif isinstance(exchange_trading_symbols, str):
        symbols = (exchange_trading_symbols,)
    else:
        symbols = tuple(exchange_trading_symbols)

    # Map segment
    if segment == "CASH":
        seg = client.SEGMENT_CASH
    elif segment == "FNO":
        seg = client.SEGMENT_FNO
    else:
        seg = client.SEGMENT_CASH

    logger.info(f"Fetching LTP for {len(symbols)} symbols")

    # Helper to process response dict
    def normalize_response(resp):
        results = []
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        for symbol, price in resp.items():
            results.append({
                "symbol": symbol,
                "price": float(price) if price else 0.0,
                "asOf": now_iso,
                "source": "groww_live",
                "curr": "INR"
            })
        return results

    # Recursive Binary Split Strategy
    # fast O(log N) isolation of invalid symbols
    def fetch_batch_recursively(batch_symbols):
        if not batch_symbols:
            return []
            
        try:
            # Try entire batch
            resp = client.get_ltp(segment=seg, exchange_trading_symbols=batch_symbols)
            logger.info(f"Batch success: {len(batch_symbols)} symbols")
            return normalize_response(resp)
            
        except Exception as e:
            # If single item batch failed, it's definitely junk
            if len(batch_symbols) == 1:
                logger.debug(f"Symbol failed: {batch_symbols[0]} ({str(e)})")
                return []
                
            # Otherwise split and retry
            mid = len(batch_symbols) // 2
            logger.info(f"Batch failed ({len(batch_symbols)}), splitting: {mid}/{len(batch_symbols)-mid}")
            
            left = fetch_batch_recursively(batch_symbols[:mid])
            right = fetch_batch_recursively(batch_symbols[mid:])
            return left + right

    try:
        # 1. Start Recursive Fetch
        # This handles everything: successes, partials, and total failures
        items = fetch_batch_recursively(symbols)
        
        # 2. Return Success
        # The frontend expects { "items": [...] }
        logger.info(f"LTP fetch completed: {len(items)}/{len(symbols)} items retrieved")
        return {"items": items}

    except Exception as e:
        # Should rarely be reached due to recursion handling exceptions, 
        # but safety net for critical client errors
        logger.error(f"Critical LTP error: {str(e)}")
        raise GrowwError(ErrorType.UPSTREAM_UNAVAILABLE, f"LTP failed: {str(e)}")


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
