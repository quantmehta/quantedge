import json
import os
import pandas as pd
from datetime import datetime, timedelta

DATA_DIR = "market_trends"
INTEL_FILE = os.path.join(DATA_DIR, "FundManagerIntel.json")

def load_data():
    all_data = {}
    for file in os.listdir(DATA_DIR):
        if file.endswith("_10y.json"):
            name = file.replace("_10y.json", "")
            with open(os.path.join(DATA_DIR, file), "r") as f:
                data = json.load(f)
                df = pd.DataFrame(data)
                df['date'] = pd.to_datetime(df['timestamp'], unit='s')
                df = df.sort_values('date')
                all_data[name] = df
    return all_data

def analyze_shocks(all_data, intel):
    shocks = intel.get("corporate_crises_and_shocks", [])
    results = []
    
    for shock in shocks:
        date_str = shock["date"]
        # Format can be "YYYY-MM" or "YYYY-MM-DD"
        if len(date_str) == 7:
            shock_date = datetime.strptime(date_str, "%Y-%m")
        else:
            shock_date = datetime.strptime(date_str, "%Y-%m-%d")
            
        impacted_sector = shock.get("sector")
        
        # Performance analysis (30d and 90d)
        perf_data = {}
        for idx_name, df in all_data.items():
            mask = df['date'] >= shock_date
            if not df[mask].empty:
                start_row = df[mask].iloc[0]
                start_price = start_row['close']
                
                # Check 30d
                t30 = shock_date + timedelta(days=30)
                mask_30 = df['date'] >= t30
                if not df[mask_30].empty:
                    end_price = df[mask_30].iloc[0]['close']
                    perf_data[idx_name] = round(((end_price - start_price) / start_price) * 100, 2)
        
        results.append({
            "event": shock["event"],
            "date": date_str,
            "sector": impacted_sector,
            "performance_matrix": perf_data
        })
        
    return results

if __name__ == "__main__":
    all_data = load_data()
    with open(INTEL_FILE, "r") as f:
        intel = json.load(f)
        
    shock_analysis = analyze_shocks(all_data, intel)
    
    with open(os.path.join(DATA_DIR, "fund_manager_correlation.json"), "w") as f:
        json.dump(shock_analysis, f, indent=2)
        
    print("Fund Manager Correlation Analysis Complete.")
    print("\nShock Impact Matrix (30d Return After Event):")
    for res in shock_analysis:
        print(f"\nEvent: {res['event']} ({res['date']})")
        # Print top 3 indices impact
        sorted_perf = sorted(res["performance_matrix"].items(), key=lambda x: x[1])
        print(f"  Worst Hit: {sorted_perf[0] if sorted_perf else 'N/A'}")
        print(f"  Best Resilience: {sorted_perf[-1] if sorted_perf else 'N/A'}")
