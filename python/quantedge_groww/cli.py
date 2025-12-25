"""
Groww CLI Entry Point
Single JSON-in/JSON-out interface for Node.js to Python communication.
"""
import sys
import json
from dotenv import load_dotenv
import os

# Load .env explicitly if available (for manual testing/CLI usage)
load_dotenv(".env")
load_dotenv("../.env")

from .logging_config import setup_logging
from .errors import GrowwError
from .auth import AuthManager

logger = setup_logging()

def main():
    try:
        # Read entire stdin buffer
        input_str = sys.stdin.read()
        if not input_str:
            print(json.dumps({"ok": False, "error": {"type": "VALIDATION_ERROR", "safeMessage": "No input"}}))
            return

        request = json.loads(input_str)
        command = request.get("command") or request.get("operation") # Support both
        payload = request.get("payload", {})
        req_id = request.get("requestId", "cli-direct")
        
        logger.info(f"Received command: {command} [{req_id}]")

        response_data = {}
        
        # --- COMMAND DISPATCH ---
        
        if command == "AUTH_DIAGNOSE":
            from .health import diagnose_auth
            response_data = diagnose_auth()
            
        elif command == "ltp_batch":
            from .market_data import get_ltp
            symbols = payload.get("exchangeTradingSymbols", payload.get("symbols", []))
            segment = payload.get("segment", "CASH")
            response_data = get_ltp(symbols, segment)
            
        elif command == "ohlc_batch":
            from .market_data import get_ohlc
            symbols = payload.get("exchangeTradingSymbols", payload.get("symbols", []))
            segment = payload.get("segment", "CASH")
            response_data = get_ohlc(symbols, segment)
            
        elif command == "quote":
            from .market_data import get_quote
            response_data = get_quote(
                payload.get("tradingSymbol"),
                payload.get("exchange", "NSE"),
                payload.get("segment", "CASH")
            )
            
        elif command == "historical_daily":
            from .market_data import get_historical_candles
            response_data = get_historical_candles(
                payload.get("tradingSymbol"),
                payload.get("start"),
                payload.get("end"),
                payload.get("exchange", "NSE"),
                payload.get("segment", "CASH"),
                payload.get("intervalMinutes", 1440)
            )
            
        elif command == "holdings":
            from .portfolio import get_holdings
            response_data = get_holdings()
            
        elif command == "positions":
            from .portfolio import get_positions
            segment = payload.get("segment")
            response_data = get_positions(segment)
            
        elif command == "search_instrument":
            from .instruments import search_instrument
            result = search_instrument(
                payload.get("query"),
                payload.get("exchange", "NSE"),
                payload.get("segment", "CASH")
            )
            response_data = {"result": result}
            
        elif command == "get_instrument":
            from .instruments import get_instrument_by_groww_symbol
            result = get_instrument_by_groww_symbol(payload.get("growwSymbol"))
            response_data = {"result": result}
            
        elif command == "get_all_instruments":
            from .instruments import get_all_instruments
            response_data = get_all_instruments()
            
        else:
            raise GrowwError(
                error_type="VALIDATION_ERROR", # String literal handled by catch-all? No, strictly use Enum in python
                message=f"Unknown command: {command}",
                retryable=False
            )

        # Success Envelope
        final_response = {
            "ok": True,
            "requestId": req_id,
            "operation": command,
            "data": response_data, # Legacy wrappers might nest keys, we'll fix strict envelope later or adapt Node side
            # For now, response_data is often {"items": ...} or {"holdings": ...} which fits 'data'
            "items": response_data.get("items"), # Backwards compat
            "holdings": response_data.get("holdings"), # Backwards compat
            "candles": response_data.get("candles"), # Backwards compat
            "meta": {
                "tsMs": 0, # TODO: real timestamp
            }
        }
        # Merge dicts to support legacy fields at root if needed by old Node connector
        # But new Node connector should look at 'data' or specific fields.
        # We will keep root fields for safety with existing code.
        final_response.update(response_data)
        
        print(json.dumps(final_response))

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON input: {str(e)}")
        print(json.dumps({
            "ok": False,
            "error": {
                "type": "VALIDATION_ERROR",
                "safeMessage": f"Invalid JSON: {str(e)}",
                "retryable": False
            }
        }))
        sys.exit(1)
        
    except GrowwError as e:
        logger.error(f"Groww Error: {e.message}")
        print(json.dumps({
            "ok": False,
            "requestId": req_id if 'req_id' in locals() else "unknown",
            "operation": command if 'command' in locals() else "unknown",
            "error": e.to_dict()
        }))
        sys.exit(1)
        
    except Exception as e:
        logger.error(f"CLI Root Error: {str(e)}")
        print(json.dumps({
            "ok": False,
            "requestId": req_id if 'req_id' in locals() else "unknown",
            "operation": command if 'command' in locals() else "unknown",
            "error": {
                "type": "UNKNOWN",
                "safeMessage": str(e),
                "retryable": False,
                "debugHints": ["Check CLI logs"]
            }
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
