
# Event Intelligence Wiring

## Concept
The Event Intelligence module (`/events`) now consumes **Live Market Data** from Groww during the Impact Computation phase.

## Data Flow
1. **User Action**: Click "Run Impact" or Load `/events` page (if auto-run).
2. **API Call**: `POST /api/events/run`
3. **Fetching Context**:
    - The API loads the Portfolio Snapshot (Holdings).
    - It extracts unique symbols (Trading Symbols).
4. **Live Price Injection**:
    - Calls `GrowwService.getLtp(symbols)`.
    - Returns a `Map<Symbol, { price, asOf }>`.
5. **Computation** (`EventImpactEngine`):
    - Accepts `livePrices` map.
    - Iterates holdings: if a live price exists, it **overrides** the DB snapshot price.
    - Sets `priceWasStale = false`.
6. **Traceability**:
    - `EventImpactRow` records are created in DB.
    - `priceTimestampMs` stores the exact `asOf` time from Groww.
    - `traceJson` includes full breakdown.

## Engine Fallbacks
If Groww API fails or rate limit is hit:
1. `GrowwService` throws or returns empty.
2. Route catches error, logs it to `providerErrors`.
3. Engine runs using **DB Snapshot Prices** (Last known good price).
4. UI shows "Stale Price" warning on specific holdings.

## Future: Autonomous Intelligence
- **News Ingestion**: We can add `NewsService` that calls `GrowwService` (if news API available) or external provider.
- **LLM Parsing**: Parse news -> `Event` object.
- **Auto-Run**: Schedule `POST /api/events/run` via generic Cron job, injecting the new Event.
