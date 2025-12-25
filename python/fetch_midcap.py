import os
import json
import datetime
import time
from dotenv import load_dotenv
from quantedge_groww.market_data import get_historical_candles

# Load environment variables
load_dotenv(dotenv_path="../.env")

def fetch_index_data_in_chunks(symbol, exchange="NSE"):
    print(f"Fetching 10 years of data for {symbol} in yearly chunks...")
    
    end_date_total = datetime.datetime.now()
    start_date_total = end_date_total - datetime.timedelta(days=10*365)
    
    all_candles = []
    current_end = end_date_total
    
    for i in range(10):
        current_start = current_end - datetime.timedelta(days=365)
        st = current_start.strftime("%Y-%m-%d %H:%M:%S")
        et = current_end.strftime("%Y-%m-%d %H:%M:%S")
        
        try:
            result = get_historical_candles(
                trading_symbol=symbol,
                start_time=st,
                end_time=et,
                exchange=exchange,
                segment="CASH",
                interval_in_minutes=1440
            )
            candles = result.get("candles", [])
            all_candles.extend(candles)
            current_end = current_start
            time.sleep(0.5)
        except Exception:
            break
            
    all_candles.sort(key=lambda x: x['timestamp'])
    print(f"  Total Success: Retrieved {len(all_candles)} candles for {symbol}")
    return all_candles

if __name__ == "__main__":
    indices_to_fetch = [
        {"symbol": "NIFTYMIDCAP", "exchange": "NSE", "name": "NIFTY_MIDCAP_100"}
    ]
    
    os.makedirs("market_trends", exist_ok=True)
    
    for idx in indices_to_fetch:
        data = fetch_index_data_in_chunks(idx["symbol"], idx["exchange"])
        if data:
            filename = f"market_trends/{idx['name']}_10y.json"
            with open(filename, "w") as f:
                json.dump(data, f, indent=2)
            print(f"  Saved to {filename}")
