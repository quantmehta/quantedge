
import sys
import os
import json
from quantedge_groww.instruments import search_instrument, get_all_instruments

def debug_search():
    print("--- Python Instrument Search Debug ---")
    
    # 1. Check all instruments count
    print("Fetching all instruments...")
    data = get_all_instruments()
    if data and 'instruments' in data:
        print(f"Total instruments in cache/API: {len(data['instruments'])}")
        # Print a few samples
        for i, inst in enumerate(data['instruments'][:3]):
            print(f"  Sample {i+1}: {inst.get('trading_symbol')} - {inst.get('name')}")
    else:
        print("  FAILED to fetch instruments or empty list.")

    # 2. Test specific searches
    test_queries = ["ADANI WILMAR", "RELIANCE", "ARCHEM"]
    for q in test_queries:
        print(f"\nSearching for: '{q}'")
        results = search_instrument(q)
        print(f"  Found {len(results)} results")
        for r in results[:3]:
            print(f"    - {r.get('tradingSymbol')} | {r.get('name')} | Score: {r.get('searchScore')}")

if __name__ == "__main__":
    debug_search()
