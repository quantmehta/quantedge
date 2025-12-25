# Groww Integration - Complete Setup Guide

## Overview
This integration provides full access to the Groww Trading API for:
- Live market data (LTP, OHLC, Quotes)
- Portfolio data (Holdings, Positions)
- Historical candle data
- Instrument resolution

## Quick Setup

### 1. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Credentials

You have **3 authentication options**. Choose one:

#### Option A: Direct Access Token (Easiest for testing)
Set in your `.env`:
```env
GROWW_ACCESS_TOKEN=eyJraWQiOiJaTUtjVXciLCJhb...
```

#### Option B: TOTP Flow (Recommended for production - No daily approval)
1. Go to https://cloud.groww.in
2. Click "Generate TOTP Token" (dropdown under Generate API Key)
3. Save the TOTP Token and Secret

Set in your `.env`:
```env
GROWW_TOTP_TOKEN=your_token
GROWW_TOTP_SECRET=your_secret
```

#### Option C: API Key + Secret (Requires daily approval on Groww Cloud)
1. Go to https://cloud.groww.in
2. Click "Generate API Key"
3. **Important**: You must approve this key daily on the website

Set in your `.env`:
```env
GROWW_API_KEY=your_key
GROWW_API_SECRET=your_secret
```

## API Reference

### Symbol Formats
- **For LTP/OHLC**: `"NSE_RELIANCE"`, `"BSE_TCS"` (Exchange underscore Symbol)
- **For Groww Symbol**: `"NSE-RELIANCE"`, `"NSE-BANKNIFTY-24Dec25-51000-CE"` (Hyphenated)
- **Exchange Token**: `2885` (Numeric ID from instruments CSV)

### Available Commands (CLI)

Test via command line:
```bash
# Get LTP for stocks
echo '{"command": "ltp_batch", "payload": {"symbols": ["NSE_RELIANCE", "NSE_TCS"]}}' | python -m python.quantedge_groww.cli

# Get holdings
echo '{"command": "holdings", "payload": {}}' | python -m python.quantedge_groww.cli

# Search instrument
echo '{"command": "search_instrument", "payload": {"query": "RELIANCE"}}' | python -m python.quantedge_groww.cli

# Get historical data
echo '{"command": "historical_daily", "payload": {"tradingSymbol": "RELIANCE", "start": "2025-01-01 09:00:00", "end": "2025-01-02 15:00:00"}}' | python -m python.quantedge_groww.cli
```

### Node.js API Endpoints

Once the app is running:

```bash
# Get LTP
curl -X POST http://localhost:3000/api/groww/ltp_bulk -H "Content-Type: application/json" -d '{"symbols": ["NSE_RELIANCE"]}'

# Get Holdings
curl -X POST http://localhost:3000/api/groww/holdings -H "Content-Type: application/json" -d '{}'

# Search Instrument
curl -X POST http://localhost:3000/api/groww/search -H "Content-Type: application/json" -d '{"query": "RELIANCE"}'
```

## Rate Limits

| Type | Limit | Endpoints |
|------|-------|-----------|
| Orders | 10/sec | place_order, modify_order, cancel_order |
| Live Data | 10/sec | get_ltp, get_ohlc, get_quote |
| Non-Trading | 10/sec | get_holdings, get_instruments |

The SDK automatically handles rate limiting with exponential backoff.

## Integration with Event Intelligence

The `/events` page now uses live Groww prices:
1. When you run impact calculations, it fetches real-time LTPs
2. Each holding impact shows the exact price timestamp
3. Stale prices (>24h old) are flagged in the UI

## Troubleshooting

### "Authentication failed"
- Check your credentials in `.env`
- For API Key flow, ensure you've approved it today on https://cloud.groww.in

### "Rate limit exceeded"
- The SDK retries automatically with backoff
- Wait 1-2 seconds and try again

### "Instrument not found"
- Use correct format: `"NSE_RELIANCE"` not `"RELIANCE"`
- Check the instruments CSV for exact symbol names
