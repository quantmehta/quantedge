import { MarketSnapshot } from './types';

// Constants
const MIN_HISTORY_DAYS = 60;

// Helper Types
export interface AssetReturn {
    date: string; // YYYY-MM-DD
    return: number;
}

export interface HoldingInput {
    id: string;
    identifier: string;
    quantity: number;
    costPrice: number;
    assetClass?: string;
    sector?: string;
    resolvedInstrumentId?: string;
}

export interface PriceInput {
    instrumentId: string;
    price: number; // Latest price
    asOf: Date;
    source: string;
}

export interface HistoryInput {
    instrumentId: string;
    candles: { date: Date; close: number }[];
}

export class SnapshotEngine {

    static calculate(
        runId: string,
        holdings: HoldingInput[],
        prices: Record<string, PriceInput>,
        histories: Record<string, HistoryInput>, // instrumentId -> history
        benchmarkHistory?: HistoryInput,
        realizedPnl: number = 0
    ): MarketSnapshot {

        const now = new Date();

        // 1. Valuation & Aggregation
        let portfolioValue = 0;
        let investedCapital = 0;
        const processedHoldings: any[] = [];

        const assetAlloc: Record<string, number> = {};
        const contributors: { symbol: string, pnl: number, pnlAbs: number }[] = [];

        const freshnessStats = { fresh: 0, stale: 0, fallback: 0, noData: 0 };
        const TTL_MS = 30 * 1000;

        for (const h of holdings) {
            const qty = h.quantity;
            const cost = h.costPrice * qty;
            investedCapital += cost;

            let marketPrice = 0;
            let val = 0;

            // Resolve Price
            if (h.resolvedInstrumentId && prices[h.resolvedInstrumentId]) {
                const p = prices[h.resolvedInstrumentId];
                marketPrice = p.price;
                val = marketPrice * qty;

                // Freshness
                const age = now.getTime() - new Date(p.asOf).getTime();
                if (age <= TTL_MS) freshnessStats.fresh++;
                else freshnessStats.stale++; // Simplification: Stale vs Fallback logic in caller, but here we count cache hits
            } else {
                freshnessStats.noData++;
                // Fallback val = 0 or cost? Requirements say "Using 0 might tank value". 
                // But for strict numeric consistency, if no price, value is 0 (or strictly undefined).
                // Let's use 0 and rely on Warning Banners.
                val = 0;
            }

            portfolioValue += val;

            // Track for Risk Props
            const _weight = portfolioValue > 0 ? val / portfolioValue : 0; // Final weights calc after loop? No, need sum first.
            // Loop 1 is for Sums. Loop 2 for weights? Yes.

            processedHoldings.push({ ...h, value: val, marketPrice });

            // Asset Alloc
            const ac = h.assetClass || 'Equity';
            assetAlloc[ac] = (assetAlloc[ac] || 0) + val;

            // PnL
            const pnl = val - cost;
            if (h.identifier) {
                contributors.push({ symbol: h.identifier, pnl, pnlAbs: Math.abs(pnl) });
            }
        }

        // 2. Metrics
        const unrealizedPnl = portfolioValue - investedCapital;
        const pnlAbs = unrealizedPnl + realizedPnl;
        const pnlPct = investedCapital > 0 ? (pnlAbs / investedCapital) * 100 : 0;

        // 3. Allocations
        const holdingsBreakdown = Object.keys(assetAlloc).map(ac => ({
            assetClass: ac,
            percentage: portfolioValue > 0 ? Number(((assetAlloc[ac] / portfolioValue) * 100).toFixed(2)) : 0
        }));

        // 4. Top Contributors
        contributors.sort((a, b) => b.pnl - a.pnl); // Highest PnL first
        const topContributors = contributors.slice(0, 5).map(c => ({
            symbol: c.symbol,
            contribution: c.pnl
        }));

        // 5. Risk Engine (Vol, Beta, Drawdown)
        // Construct Portfolio History
        // We need weights. For V1 approximation: Fixed current weights.
        // Identify common date range (Intersection of available histories).

        // Flatten histories to align dates
        // Map: Date -> { sumWeightedReturn: 0, count: 0 }

        const returnSeries: Record<string, number> = {}; // Date -> Portfolio Return
        const benchmarkReturns: Record<string, number> = {};

        // Pre-calc weights
        const weights: Record<string, number> = {};
        for (const ph of processedHoldings) {
            if (ph.resolvedInstrumentId && portfolioValue > 0) {
                weights[ph.resolvedInstrumentId] = ph.value / portfolioValue;
            }
        }

        // A. Portfolio Returns
        // Iterate all histories. For each instrument, calc daily return, add weight * return to that date.
        // Robustness: Only include date if > X% of portfolio has data? 
        // Simple V1: Sum available. (Implicit rebalancing). 
        // e.g. Day T, we have AAPL (50% portfolio). AAPL up 1%. Port up 0.5% (assuming other 50% flat).
        // Correct approach: Re-normalize weights for available subset? 
        // Yes, Re-normalize weights of *available* instruments for that day to sum to 1.

        const dateToWeightedSum: Record<string, { sumWtRet: number, sumWt: number }> = {};

        // Helper: Daily Returns
        // Returns: Record<DateString, number>
        const getReturns = (candles: { date: Date; close: number }[]) => {
            const rets: Record<string, number> = {};
            // Sort by date asc
            candles.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            for (let i = 1; i < candles.length; i++) {
                const prev = candles[i - 1].close;
                const curr = candles[i].close;
                if (prev > 0) {
                    const r = (curr - prev) / prev;
                    const d = candles[i].date.toISOString().split('T')[0];
                    rets[d] = r;
                }
            }
            return rets;
        };

        Object.keys(histories).forEach(instId => {
            const h = histories[instId];
            if (!weights[instId]) return;

            const rets = getReturns(h.candles);
            Object.keys(rets).forEach(date => {
                if (!dateToWeightedSum[date]) dateToWeightedSum[date] = { sumWtRet: 0, sumWt: 0 };
                dateToWeightedSum[date].sumWtRet += rets[date] * weights[instId];
                dateToWeightedSum[date].sumWt += weights[instId];
            });
        });

        // Construct Portfolio Return Series
        const portDates = Object.keys(dateToWeightedSum).sort();
        const portDailyReturns: number[] = [];
        const portDatesSorted: string[] = [];

        for (const d of portDates) {
            const data = dateToWeightedSum[d];
            if (data.sumWt > 0.5) { // Threshold: At least 50% of portfolio must exist to count the day
                // Renormalize
                // const r = data.sumWtRet / data.sumWt; 
                // Wait, if we just hold Cash for the rest, Cash return is 0. 
                // So sumWtRet is essentially return relative to Total Portfolio assumes Cash=0 return.
                // Which is correct. Returns are additive. 
                // r_p = w1*r1 + w2*r2 ... 
                // If w2 missing (history missing), assume r2=0? 
                // If we treat missing as 0 return, we use `sumWtRet` directly (since weights sum to 1 total).
                // If we renormalize, we assume missing assets behaved like present assets.
                // Safest/Standard: Use `sumWtRet` (Missing = Cash/Flat).

                portDailyReturns.push(data.sumWtRet);
                portDatesSorted.push(d);
                returnSeries[d] = data.sumWtRet;
            }
        }

        // Benchmark Returns
        if (benchmarkHistory) {
            const bRets = getReturns(benchmarkHistory.candles);
            Object.assign(benchmarkReturns, bRets);
        }

        // Metrics Calc
        let volatility: number | null = null;
        let beta: number | null = null;
        let maxDrawdown: number | null = null;

        if (portDailyReturns.length >= MIN_HISTORY_DAYS) {
            // Vol
            const mean = portDailyReturns.reduce((a, b) => a + b, 0) / portDailyReturns.length;
            const variance = portDailyReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / portDailyReturns.length;
            const stdDev = Math.sqrt(variance);
            volatility = stdDev * Math.sqrt(252); // Annualized

            // Drawdown
            // Construct Equity Curve
            let equity = 100;
            let peak = 100;
            let maxDD = 0;

            for (const r of portDailyReturns) {
                equity = equity * (1 + r);
                if (equity > peak) peak = equity;
                const dd = (equity - peak) / peak;
                if (dd < maxDD) maxDD = dd;
            }
            maxDrawdown = maxDD;

            // Beta
            // Cov(Rp, Rb) / Var(Rb)
            // Union Dates
            const commonDates = portDatesSorted.filter(d => benchmarkReturns[d] !== undefined);
            if (commonDates.length >= MIN_HISTORY_DAYS) {
                const rp_common = commonDates.map(d => returnSeries[d]);
                const rb_common = commonDates.map(d => benchmarkReturns[d]);

                const meanP = rp_common.reduce((a, b) => a + b, 0) / rp_common.length;
                const meanB = rb_common.reduce((a, b) => a + b, 0) / rb_common.length;

                let cov = 0;
                let varB = 0;
                for (let i = 0; i < commonDates.length; i++) {
                    const dp = rp_common[i] - meanP;
                    const db = rb_common[i] - meanB;
                    cov += dp * db;
                    varB += db * db;
                }

                if (varB > 0) beta = cov / varB;
            }
        }

        // 6. Charts
        // Performance
        const _perfDates = portDatesSorted; // Already sorted, kept for reference
        // Normalized 100 start
        const _pfSeries = [100];
        const _bmSeries = [100];

        // Align Benchmark Series to Portfolio Start
        // If benchmark has history before portfolio, ignore.
        // If portfolio starts, we define t=0 as 100.
        // Actually, we align matching dates.

        // Let's take the graph window as the Portfolio Window.
        // Benchmark starts at 100 on the same first day.

        let currPf = 100;
        let currBm = 100;
        const chartDataPf = [100];
        const chartDataBm = [100];
        const chartDates = [portDatesSorted[0] || new Date().toISOString().split('T')[0]];
        // Need to check if length > 0

        if (portDatesSorted.length > 0) {
            // Reset
            // We need to iterate dates.
            // Actually `portDailyReturns` corresponds to `portDatesSorted`.
            // But r[i] is return from date[i-1] to date[i]?
            // Our getReturns maps date[i] -> (close[i]-close[i-1])/close[i-1].
            // So return at date T is the return realized ON date T.

            chartDates.shift(); // remove placeholder
            // We start at day 0 (before first return) = 100?
            // Usually Line charts show T0..Tn.
            // If we have Returns R1..Rn.
            // V0 = 100.
            // V1 = V0 * (1+R1).

            // Let's verify dates. `dateToWeightedSum` keys are the "Close Date".
            // So R1 is at D1.
            // We can prepend D0 (D1 - 1 day) or just start D1 at 100*(1+R1). 
            // Simple: D0=100.
            const firstDate = new Date(portDatesSorted[0]);
            firstDate.setDate(firstDate.getDate() - 1);
            chartDates.push(firstDate.toISOString().split('T')[0]);

            for (let i = 0; i < portDatesSorted.length; i++) {
                const d = portDatesSorted[i];
                const rp = portDailyReturns[i];
                const rb = benchmarkReturns[d] || 0;

                currPf = currPf * (1 + rp);
                currBm = currBm * (1 + rb);

                chartDataPf.push(Number(currPf.toFixed(2)));
                chartDataBm.push(Number(currBm.toFixed(2)));
                chartDates.push(d);
            }
        }

        const performanceChart = {
            dates: chartDates,
            portfolio: chartDataPf,
            benchmark: chartDataBm
        };

        // Waterfall
        const waterfallChart: Array<{ name: string; value: number; runningTotal: number; isTotal?: boolean }> = contributors.slice(0, 15).map(c => ({
            name: c.symbol,
            value: Number(c.pnl.toFixed(2)),
            runningTotal: 0 // Frontend often calcs this or we do.
        }));
        // Add "Others"
        const top15Sum = waterfallChart.reduce((s, c) => s + c.value, 0);
        const othersSum = pnlAbs - top15Sum;
        if (Math.abs(othersSum) > 1) {
            waterfallChart.push({ name: 'Others', value: Number(othersSum.toFixed(2)), runningTotal: 0 });
        }

        // Calc running totals
        let running = 0;
        waterfallChart.forEach(c => {
            running += c.value;
            c.runningTotal = Number(running.toFixed(2));
        });

        // Total bar? 
        waterfallChart.push({ name: 'Total Unrl. P&L', value: Number(pnlAbs.toFixed(2)), runningTotal: Number(pnlAbs.toFixed(2)), isTotal: true });

        // Result
        return {
            runId,
            portfolioValue: Number(portfolioValue.toFixed(2)),
            investedCapital: Number(investedCapital.toFixed(2)),
            pnlAbs: Number(pnlAbs.toFixed(2)),
            pnlPct: Number(pnlPct.toFixed(2)),
            realizedPnl: Number(realizedPnl.toFixed(2)),
            unrealizedPnl: Number(unrealizedPnl.toFixed(2)),
            updatedAt: now.toISOString(),
            freshnessStats,
            holdingsBreakdown,
            topContributors,
            riskMetrics: {
                volatility: volatility ? Number(volatility.toFixed(4)) : null,
                maxDrawdown: maxDrawdown ? Number(maxDrawdown.toFixed(4)) : null,
                beta: beta ? Number(beta.toFixed(4)) : null,
                sharpeRatio: null // Placeholder
            },
            performanceChart,
            waterfallChart
        };
    }
}
