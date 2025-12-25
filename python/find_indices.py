import os
import datetime
from dotenv import load_dotenv
from quantedge_groww.instruments import get_all_instruments
from quantedge_groww.market_data import get_historical_candles

# Load environment variables from .env in the parent directory
load_dotenv(dotenv_path="../.env")

def find_indices():
    results = get_all_instruments()
    instruments = results.get("instruments", [])
    
    # Indices are usually in NSE or BSE
    # We look for NIFTY 50, NIFTY BANK, SENSEX
    target_indices = ["NIFTY 50", "NIFTY BANK", "SENSEX", "NIFTY IT", "NIFTY NEXT 50"]
    found = []
    
    for inst in instruments:
        ts = inst.get("trading_symbol", "").upper()
        if ts in target_indices:
            found.append(inst)
            
    return found

if __name__ == "__main__":
    indices = find_indices()
    for idx in indices:
        print(f"Found: {idx['trading_symbol']} | Exchange: {idx['exchange']} | GrowwSymbol: {idx['groww_symbol']}")
