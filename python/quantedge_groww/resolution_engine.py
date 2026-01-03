"""
Resolution Engine
Resolves raw user inputs to valid Groww instruments using local cache.
Prioritizes NSE over BSE when available on both.
"""
import pandas as pd
from .instruments import get_all_instruments, search_instrument
from .logging_config import setup_logging
import re

logger = setup_logging()

class ResolutionEngine:
    def __init__(self):
        self.isin_index = {}      # ISIN -> {'NSE': instr, 'BSE': instr}
        self.symbol_index = {}    # Symbol -> {'NSE': instr, 'BSE': instr}
        self.name_index = {}      # NormName -> {'NSE': instr, 'BSE': instr}
        self.df = None            # Cached DataFrame for fuzzy search
        self._initialized = False

    def initialize(self):
        """
        Builds in-memory indices from the full instrument list.
        """
        if self._initialized:
            return

        logger.info("ResolutionEngine: initializing indices...")
        data = get_all_instruments() # Cached call
        instruments = data.get('instruments', [])
        
        count = 0
        for instr in instruments:
            # Skip non-equity for now if needed, or keep all
            segment = instr.get('segment')
            if segment != 'CASH': 
                continue

            exchange = instr.get('exchange')
            isin = instr.get('isin')
            symbol = instr.get('trading_symbol')
            name = instr.get('name')
            
            # 1. Index by ISIN
            if isin:
                if isin not in self.isin_index: self.isin_index[isin] = {}
                self.isin_index[isin][exchange] = instr
            
            # 2. Index by Symbol
            if symbol:
                if symbol not in self.symbol_index: self.symbol_index[symbol] = {}
                self.symbol_index[symbol][exchange] = instr
                
            if name:
                norm = self._normalize_string(name)
                # Store strict collisions? For now last-write-wins per exchange, 
                # but usually names are unique per company.
                if norm not in self.name_index: self.name_index[norm] = {}
                self.name_index[norm][exchange] = instr

            count += 1
            
        # 4. Prepare DataFrame for Search
        # We filter duplicates logic or just use all instruments
        # We need a clean DataFrame with string columns for searching
        if instruments:
            logger.info("ResolutionEngine: Building search vectors...")
            self.df = pd.DataFrame(instruments)
            # Pre-compute upper case columns for speed
            self.df['search_name'] = self.df['name'].fillna('').astype(str).str.upper()
            self.df['search_symbol'] = self.df['trading_symbol'].fillna('').astype(str).str.upper()
            
        self._initialized = True
        logger.info(f"ResolutionEngine: Indexed {count} equity instruments.")

    def _normalize_string(self, s):
        if not s: return ""
        if not isinstance(s, str): return ""
        # Remove special chars, spaces, common suffixes
        s = s.upper()
        s = re.sub(r'[^A-Z0-9]', '', s) # Compact: "Adani Wilmar Ltd" -> "ADANIWILMARLTD"
        # Standardize suffixes
        for suffix in ['LIMITED', 'LTD', 'PVT', 'PRIVATE', 'INDIA', 'IND']:
            if s.endswith(suffix):
                s = s[:-len(suffix)]
        return s

    def resolve(self, query, enabled_exchanges=None):
        """
        Resolves a single query object to a target instrument.
        Query keys: 'isin', 'symbol' (tradingSymbol), 'name', 'exchange' (optional preference)
        enabled_exchanges: list of strings e.g. ['NSE', 'BSE'] to restrict results.
        
        Returns: { 'exchange': 'NSE', 'symbol': 'RELIANCE', ... } or None
        """
        if not self._initialized:
            self.initialize()
            
        # 1. ISIN Lookup (Highest Confidence)
        if query.get('isin'):
            match = self._pick_best(self.isin_index.get(query['isin']), query.get('exchange'), enabled_exchanges)
            if match: return match
            
        # 2. Symbol Lookup
        if query.get('symbol'):
            s = query['symbol'].strip()
            # Try raw
            match = self._pick_best(self.symbol_index.get(s), query.get('exchange'), enabled_exchanges)
            if match: return match
            
            # Try removing special chars if failed?
            # Maybe later.
            
        # 3. Name Lookup (Lowest Confidence)
        if query.get('name'):
            norm = self._normalize_string(query['name'])
            match = self._pick_best(self.name_index.get(norm), query.get('exchange'), enabled_exchanges)
            if match: return match
            
        # 3b. Fuzzy/Search Fallback
        # If we are here, strict name lookup failed.
        # Combine Name + Symbol for maximum context
        parts = []
        if query.get('name'): parts.append(query['name'])
        if query.get('symbol'): parts.append(query['symbol'])
        
        q_str = " ".join(parts)
        if q_str and self.df is not None:
             match = self._fuzzy_search_local(q_str, query.get('exchange') or 'NSE')
             if match:
                 logger.debug(f"ResolutionEngine: Fuzzy match found for '{q_str}': {match.get('trading_symbol')}")
                 return match
                 
        return None

    def _fuzzy_search_local(self, query, exchange_pref="NSE"):
        """
        Fast in-memory fuzzy search using cached DataFrame.
        """
        if not query: return None
        
        try:
            # 1. Clean Query
            clean_q = query.upper().strip()
            
            # 2. Tokenize
            tokens = [t for t in clean_q.split() if len(t) > 1]
            if not tokens: return None
            
            # 3. Vectorized Search
            # Uses pre-computed 'search_name' and 'search_symbol'
            
            # Create Mask
            escaped_tokens = [re.escape(t) for t in tokens]
            pattern = '|'.join(escaped_tokens)
            
            # Simple contains check on Name OR Symbol
            mask = self.df['search_name'].str.contains(pattern, regex=True, na=False) | \
                   self.df['search_symbol'].str.contains(pattern, regex=True, na=False)
                   
            if not mask.any():
                return None
                
            candidates = self.df[mask].copy()
            
            # 4. Score
            candidates['score'] = 0.0
            
            # Full token presence bonus
            for token in tokens:
                t_esc = re.escape(token)
                has_token = candidates['search_name'].str.contains(t_esc, regex=True) | \
                            candidates['search_symbol'].str.contains(t_esc, regex=True)
                candidates.loc[has_token, 'score'] += 1.0
                
            # Exact/Startswith Bonus
            candidates.loc[candidates['search_symbol'] == clean_q, 'score'] += 5.0
            candidates.loc[candidates['search_name'] == clean_q, 'score'] += 3.0
            candidates.loc[candidates['search_name'].str.startswith(clean_q), 'score'] += 2.0
            
            # Penalize Length Difference based on the closest match (Symbol OR Name)
            # We want to favor "AKSHARCHEM" (symbol len 10) for "ARCHEM" (len 6) 
            # over the full name "AKSHARCHEM INDIA LTD" (len 18)
            diff_name = (candidates['search_name'].str.len() - len(clean_q)).abs()
            diff_sym = (candidates['search_symbol'].str.len() - len(clean_q)).abs()
            
            # Element-wise min
            import numpy as np
            min_diff = np.minimum(diff_name, diff_sym)
            
            candidates.loc[:, 'score'] -= (min_diff * 0.05)
            
            # Sort
            candidates = candidates.sort_values(by='score', ascending=False)
            
            if candidates.empty:
                logger.debug(f"Fuzzy local: No candidates found for {clean_q}")
                return None
                
            # Log top 3 for debugging
            top_3 = candidates.head(3)[['search_symbol', 'score']].to_dict(orient='records')
            logger.debug(f"Fuzzy local top 3 for {clean_q}: {top_3}")

            # Pick best
            # Prefer preferred exchange if scores are close? 
            # For now just take top.
            top_rec = candidates.iloc[0].to_dict()
            
            # Low score cutoff?
            if top_rec['score'] < 0.5: # Arbitrary
                 logger.debug(f"Fuzzy local: Top match {top_rec.get('search_symbol')} score {top_rec['score']} < 0.5")
                 return None
                 
            # Remap keys to match internal dict format
            # Our DF comes from get_all_instruments list of dicts
            # Keys should match
            return top_rec
            
        except Exception as e:
            logger.error(f"Fuzzy search error: {e}")
            return None

    def _pick_best(self, exchange_map, preferred_exchange=None, enabled_exchanges=None):
        """
        Selects the best instrument from the available exchanges.
        Rule: Prefer NSE if available, unless preferred_exchange is strictly BSE.
        Respects enabled_exchanges if provided.
        """
        if not exchange_map:
            return None
        
        # Filter by enabled
        valid_map = exchange_map
        if enabled_exchanges:
            # Only keep exchanges that are in the enabled list
            valid_map = {k: v for k, v in exchange_map.items() if k in enabled_exchanges}
            if not valid_map: return None
            
        # If user explicitly asked for one
        if preferred_exchange:
            if preferred_exchange in valid_map:
                return valid_map[preferred_exchange]
        
        # Default Rule: NSE > BSE
        if 'NSE' in valid_map:
            return valid_map['NSE']
        if 'BSE' in valid_map:
            return valid_map['BSE']
            
        # Return whatever is there
        return next(iter(valid_map.values()))

# Global Instance
engine = ResolutionEngine()
