import json
import os
import pandas as pd
from datetime import datetime, timedelta

DATA_DIR = "market_trends"
CONTEXT_FILE = os.path.join(DATA_DIR, "market_context_map.json")

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

def correlate_events(all_data, context):
    events = context.get("events", [])
    results = []
    
    nifty_df = all_data.get("NIFTY_50")
    if nifty_df is None:
        return []
        
    for event in events:
        event_date = pd.to_datetime(event["date"])
        
        # Performance Windows
        windows = [7, 30, 90]
        performance = {}
        
        # Get price at event date (or nearest following)
        mask = nifty_df['date'] >= event_date
        event_row = nifty_df[mask].iloc[0] if not nifty_df[mask].empty else None
        
        if event_row is not None:
            start_price = event_row['close']
            
            for days in windows:
                target_date = event_date + timedelta(days=days)
                t_mask = nifty_df['date'] >= target_date
                t_row = nifty_df[t_mask].iloc[0] if not nifty_df[t_mask].empty else None
                
                if t_row is not None:
                    ret = ((t_row['close'] - start_price) / start_price) * 100
                    performance[f"{days}d_return"] = round(ret, 2)
                else:
                    performance[f"{days}d_return"] = None
        
        results.append({
            **event,
            "performance": performance
        })
        
    return results

def aggregate_by_category(event_results):
    categories = {}
    for res in event_results:
        cat = res["category"]
        if cat not in categories:
            categories[cat] = {"count": 0, "avg_30d": 0, "positive_hits": 0}
        
        ret_30 = res["performance"].get("30d_return")
        if ret_30 is not None:
            categories[cat]["count"] += 1
            categories[cat]["avg_30d"] += ret_30
            if ret_30 > 0:
                categories[cat]["positive_hits"] += 1
                
    for cat in categories:
        if categories[cat]["count"] > 0:
            categories[cat]["avg_30d"] /= categories[cat]["count"]
            categories[cat]["avg_30d"] = round(categories[cat]["avg_30d"], 2)
            
    return categories

if __name__ == "__main__":
    all_data = load_data()
    with open(CONTEXT_FILE, "r") as f:
        context = json.load(f)
        
    event_correlations = correlate_events(all_data, context)
    cat_summary = aggregate_by_category(event_correlations)
    
    # Save results
    output = {
        "event_impact": event_correlations,
        "category_summary": cat_summary,
        "sectoral_themes": context.get("themes")
    }
    
    with open(os.path.join(DATA_DIR, "bifurcation_analysis.json"), "w") as f:
        json.dump(output, f, indent=2)
        
    print("Bifurcation Analysis Complete.")
    print("\nCategory Summary (30d Post-Event Avg Return):")
    for cat, stats in cat_summary.items():
        print(f"  {cat:15}: {stats['avg_30d']:>6}% | Prob. Positive: {stats['positive_hits']}/{stats['count']}")
