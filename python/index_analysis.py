import json
import os
import pandas as pd
from datetime import datetime

os.makedirs("market_trends", exist_ok=True)

def analyze_index(name, data):
    if not data or len(data) < 2:
        return None
        
    df = pd.DataFrame(data)
    # Groww timestamps are in seconds
    df['date'] = pd.to_datetime(df['timestamp'], unit='s')
    df = df.sort_values('date')
    
    start_price = df.iloc[0]['close']
    end_price = df.iloc[-1]['close']
    total_return = ((end_price - start_price) / start_price) * 100
    
    # CAGR
    days_diff = (df.iloc[-1]['date'] - df.iloc[0]['date']).days
    if days_diff == 0:
        return None
        
    years = days_diff / 365.25
    cagr = (((end_price / start_price) ** (1/years)) - 1) * 100
    
    # Max Drawdown
    df['peak'] = df['close'].cummax()
    df['drawdown'] = (df['close'] - df['peak']) / df['peak']
    max_drawdown = df['drawdown'].min() * 100
    
    # Volatility (Annualized)
    df['daily_return'] = df['close'].pct_change()
    volatility = df['daily_return'].std() * (252**0.5) * 100
    
    return {
        "name": name,
        "period": f"{df.iloc[0]['date'].date()} to {df.iloc[-1]['date'].date()}",
        "start_price": round(start_price, 2),
        "end_price": round(end_price, 2),
        "total_return_pct": round(total_return, 2),
        "cagr_pct": round(cagr, 2),
        "max_drawdown_pct": round(max_drawdown, 2),
        "volatility_annualized_pct": round(volatility, 2)
    }

if __name__ == "__main__":
    files = [f for f in os.listdir("market_trends") if f.endswith("_10y.json")]
    summaries = []
    
    for file in files:
        filepath = os.path.join("market_trends", file)
        with open(filepath, "r") as f:
            data = json.load(f)
            name = file.replace("_10y.json", "")
            summary = analyze_index(name, data)
            if summary:
                summaries.append(summary)
                
    # Save summary
    with open("market_trends/indices_analysis_summary.json", "w") as f:
        json.dump(summaries, f, indent=2)
        
    print("Market Index Analysis (10-Year View):")
    print("-" * 80)
    for s in summaries:
        print(f"Index: {s['name']}")
        print(f"  Period: {s['period']}")
        print(f"  Return: {s['total_return_pct']}% | CAGR: {s['cagr_pct']}%")
        print(f"  Max Drawdown: {s['max_drawdown_pct']}%")
        print(f"  Volatility: {s['volatility_annualized_pct']}%")
        print("-" * 80)
