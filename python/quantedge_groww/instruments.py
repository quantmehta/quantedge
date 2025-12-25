"""
Groww Instruments Module
Handles instrument lookup and resolution.
"""
from .auth import get_groww_client
from .retry import exponential_backoff
from .errors import GrowwError, ErrorType
from .logging_config import setup_logging

logger = setup_logging()

@exponential_backoff()
def get_instrument_by_groww_symbol(groww_symbol):
    """
    Resolves an instrument using its Groww symbol.
    """
    client = get_groww_client()
    
    try:
        logger.info(f"Looking up instrument: {groww_symbol}")
        
        # Real SDK method
        instrument = client.get_instrument_by_groww_symbol(groww_symbol=groww_symbol)
        
        if instrument:
            logger.info(f"Found instrument: {instrument.get('trading_symbol')}")
            return {
                "exchange": instrument.get("exchange"),
                "segment": instrument.get("segment"),
                "tradingSymbol": instrument.get("trading_symbol"),
                "growwSymbol": instrument.get("groww_symbol"),
                "name": instrument.get("name"),
                "instrumentType": instrument.get("instrument_type"),
                "isin": instrument.get("isin"),
                "exchangeToken": instrument.get("exchange_token"),
                "lotSize": instrument.get("lot_size"),
                "tickSize": instrument.get("tick_size")
            }
        
        return None
        
    except Exception as e:
        if isinstance(e, GrowwError): raise e
        logger.error(f"Instrument lookup failed for {groww_symbol}: {str(e)}")
        raise GrowwError(ErrorType.UPSTREAM_UNAVAILABLE, f"Instrument lookup failed: {str(e)}")


@exponential_backoff()
def get_instrument_by_trading_symbol(trading_symbol, exchange="NSE"):
    """
    Resolves an instrument using exchange and trading symbol.
    """
    client = get_groww_client()
    
    try:
        exc = client.EXCHANGE_NSE if exchange == "NSE" else client.EXCHANGE_BSE
        
        instrument = client.get_instrument_by_exchange_and_trading_symbol(
            exchange=exc,
            trading_symbol=trading_symbol
        )
        
        if instrument:
            return {
                "exchange": instrument.get("exchange"),
                "segment": instrument.get("segment"),
                "tradingSymbol": instrument.get("trading_symbol"),
                "growwSymbol": instrument.get("groww_symbol"),
                "name": instrument.get("name"),
                "isin": instrument.get("isin"),
                "exchangeToken": instrument.get("exchange_token"),
                "lotSize": instrument.get("lot_size")
            }
        
        return None
        
    except Exception as e:
        if isinstance(e, GrowwError): raise e
        logger.error(f"Instrument lookup failed for {exchange}:{trading_symbol}: {str(e)}")
        raise GrowwError(ErrorType.UPSTREAM_UNAVAILABLE, f"Instrument lookup failed: {str(e)}")


@exponential_backoff()
def get_all_instruments():
    """
    Returns all available instruments as a list.
    Uses file-based caching (pickle) to avoid repeated API calls.
    """
    import os
    import time
    import tempfile
    import pandas as pd
    
    CACHE_FILE = os.path.join(tempfile.gettempdir(), 'groww_instruments_cache.pkl')
    CACHE_TTL = 3600 * 4 # 4 hours
    
    try:
        # Try to load from cache
        if os.path.exists(CACHE_FILE):
             mtime = os.path.getmtime(CACHE_FILE)
             if time.time() - mtime < CACHE_TTL:
                 try:
                     logger.info("Loading instruments from cache...")
                     df = pd.read_pickle(CACHE_FILE)
                     instruments = df.to_dict(orient="records")
                     return {"instruments": instruments, "count": len(instruments)}
                 except Exception as cache_err:
                     logger.warning(f"Failed to read cache: {cache_err}")
    
    except Exception as e:
        logger.warning(f"Cache check failed: {e}")

    # Fetch from API
    client = get_groww_client()
    
    try:
        logger.info("Fetching all instruments from API (this may take a moment)...")
        
        # Returns a pandas DataFrame
        df = client.get_all_instruments()
        
        # Save to cache
        try:
            df.to_pickle(CACHE_FILE)
            logger.info(f"Saved instruments to cache: {CACHE_FILE}")
        except Exception as save_err:
            logger.warning(f"Failed to save cache: {save_err}")
        
        # Convert to list of dicts for JSON serialization
        instruments = df.to_dict(orient="records")
        
        logger.info(f"Fetched {len(instruments)} instruments")
        return {"instruments": instruments, "count": len(instruments)}
        
    except Exception as e:
        if isinstance(e, GrowwError): raise e
        logger.error(f"All instruments fetch failed: {str(e)}")
        raise GrowwError(ErrorType.UPSTREAM_UNAVAILABLE, f"Instruments sync failed: {str(e)}")


def search_instrument(query, exchange="NSE", segment="CASH"):
    """
    Searches for an instrument by partial name/symbol using the full instrument list.
    Simulates a 'Database Search' with Robust Token Overlap Scoring.
    """
    if not query or not isinstance(query, str):
        return []
    
    # Clean Query
    # Synonym / Alias Map
    # Map common user names to:
    # 1. Trading Symbol (e.g., "AWL")
    # 2. Or a specific search token that works better
    
    SYNONYM_MAP = {
        "ADANI WILMAR": "AWL",
        "ADANI WILMAR LIMITED": "AWL",
        "ADANI WILMAR LTD": "AWL",
        "IRCTC": "IRCTC", # Example
    }
    
    clean_q = query.upper().strip()
    
    # Check map
    if clean_q in SYNONYM_MAP:
        # Replace query with the mapped symbol logic
        remapped = SYNONYM_MAP[clean_q]
        logger.info(f"Remapped query '{clean_q}' to '{remapped}'")
        # Direct return if it's a symbol-like match?
        # Let's just set query_norm to this and let the Exact Symbol logic (step 1) handle it
        query_norm = remapped
    else:
        # Standard cleaning
        # Remove common business suffixes noise for cleaner searching
        # But be careful not to remove 'India' if it's key.
        # "LTD", "LIMITED", "PVT" are safe to remove.
        query_norm = clean_q
        for suffix in [" LIMITED", " LTD", " PVT", " PRIVATE"]:
             if query_norm.endswith(suffix):
                 query_norm = query_norm[:-len(suffix)].strip()
                 break
    
    # 1. Try exact symbol lookup first (fast path)
    if len(query_norm) < 15:
        try:
            res = get_instrument_by_trading_symbol(query_norm, exchange)
            if res:
                return [res]
        except:
            pass

    # 2. Database Search
    try:
        import pandas as pd
        # Use our wrapper to get cached data
        # It returns dict with 'instruments' list
        data = get_all_instruments()
        if not data or 'instruments' not in data:
            return []
            
        # Convert back to DataFrame for vectorization
        # This is fast locally
        df = pd.DataFrame(data['instruments'])
        
        # --- SANITY & SAFETY ---
        # 1. Deduplicate columns to prevent DataFrame-on-Series access errors
        df = df.loc[:, ~df.columns.duplicated()]
        
        # 2. Reset index to ensure standard unique RangeIndex (0, 1, 2...)
        df = df.reset_index(drop=True)
        
        import re
        import pandas as pd
        import numpy as np
        
        # Tokenize
        tokens = [t for t in query_norm.split() if len(t) > 1]
        
        # If no tokens (e.g. query was "."), return empty
        if not tokens: return []
        
        # Create Regex Pattern from Tokens (OR Logic)
        escaped_tokens = [re.escape(t) for t in tokens]
        pattern = '|'.join(escaped_tokens)
        
        # --- ROBUST MASK CREATION ---
        
        # Ensure we have string series. fillna('') prevents object-nan issues.
        # astype(str) converts everything to string.
        try:
            name_s = df['name'].fillna('').astype(str)
            sym_s = df['trading_symbol'].fillna('').astype(str)
            
            # contains() returns Boolean Series (or NaN if na=np.nan). We enforce na=False.
            # We explicitly cast to bool to be paranoid.
            name_mask = name_s.str.contains(pattern, case=False, regex=True, na=False).astype(bool)
            symbol_mask = sym_s.str.contains(pattern, case=False, regex=True, na=False).astype(bool)
            
            # Combine
            or_mask = (name_mask | symbol_mask)
        except Exception as mask_error:
            logger.error(f"Mask creation failed: {mask_error}")
            # Fallback: specific logging?
            # return [] to allow retry or graceful fail
            return []

        if not or_mask.any():
            return []
            
        # Use simple boolean masking on the sanitized DF
        candidates = df[or_mask].copy()
        
        # --- SCORING & RANKING ---
        candidates['match_count'] = 0
        upper_names = candidates['name'].fillna('').astype(str).str.upper()
        upper_symbols = candidates['trading_symbol'].fillna('').astype(str).str.upper()
        
        for token in tokens:
             # Check token presence (1 point per token)
             found_mask = upper_names.str.contains(re.escape(token), regex=True, na=False) | \
                          upper_symbols.str.contains(re.escape(token), regex=True, na=False)
             candidates.loc[found_mask, 'match_count'] += 1
             
        # Overlap Ratio
        candidates['overlap_score'] = candidates['match_count'] / len(tokens)
        
        # Bonuses
        candidates['bonus_score'] = 0.0
        
        # Exact Matches (highest priority)
        candidates.loc[upper_symbols == query_norm, 'bonus_score'] += 3.0
        candidates.loc[upper_names == query_norm, 'bonus_score'] += 2.0
        
        # Starts With (medium priority)
        first_token = tokens[0]
        # Regex anchor ^
        candidates.loc[upper_names.str.contains('^' + re.escape(first_token), regex=True, na=False), 'bonus_score'] += 0.5
        
        # Length Penalty (prefer concise matches)
        candidates['len_diff'] = (candidates['name'].str.len() - len(query_norm)).abs()
        candidates['len_penalty'] = candidates['len_diff'].clip(upper=50) / 100.0
        
        # Final Score
        candidates['final_score'] = candidates['overlap_score'] + candidates['bonus_score'] - candidates['len_penalty']
        
        # Sort
        candidates = candidates.sort_values(by='final_score', ascending=False)
        
        # Return Top 20
        results = candidates.head(20).to_dict(orient="records")
        
        normalized_results = []
        for r in results:
            normalized_results.append({
                "exchange": r.get("exchange"),
                "segment": r.get("segment"),
                "tradingSymbol": r.get("trading_symbol"),
                "growwSymbol": r.get("groww_symbol"),
                "name": r.get("name"),
                "searchScore": r.get("final_score")
            })
            
        return normalized_results

    except Exception as e:
        logger.error(f"Search failed: {e}")
        return []
