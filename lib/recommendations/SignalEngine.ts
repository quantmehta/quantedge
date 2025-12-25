import { SignalProfile } from './RecommendationContracts';

export class SignalEngine {

    /**
     * Computes signals based on historical prices.
     * Expects prices sorted ASCENDING by date (oldest -> newest).
     */
    static computeSignals(symbol: string, prices: number[]): SignalProfile {
        if (!prices || prices.length < 20) {
            return {
                symbol,
                momentumScore: 0,
                volatilityTrend: 0,
                drawdownSeverity: 0,
                recoveryScore: 0,
                dataPoints: prices ? prices.length : 0
            };
        }

        const momentum = this.computeMomentum(prices);
        const volTrend = this.computeVolatilityTrend(prices);
        const drawdown = this.computeDrawdown(prices);

        // Simple recovery proxy: inverse of drawdown if recent
        const recovery = 1 - drawdown;

        return {
            symbol,
            momentumScore: momentum,
            volatilityTrend: volTrend,
            drawdownSeverity: drawdown,
            recoveryScore: recovery,
            dataPoints: prices.length
        };
    }

    private static computeMomentum(prices: number[]): number {
        // 20D vs 100D return difference scaled
        const n = prices.length;
        const pCurrent = prices[n - 1];

        // 20D Return
        const idx20 = Math.max(0, n - 20);
        const p20 = prices[idx20];
        const ret20 = (pCurrent - p20) / p20;

        // 100D Return (use what we have if < 100)
        const idx100 = Math.max(0, n - 100);
        const p100 = prices[idx100];
        const ret100 = (pCurrent - p100) / p100;

        // Momentum Score: Is short term trend outpacing long term?
        // Simple heuristic: ret20 * 2 (annualized proxy) - ret100
        // Clamped -1 to 1
        const rawScore = (ret20 - (ret100 / 5)); // Just a heuristic

        return Math.max(-1, Math.min(1, rawScore * 5)); // Scaling factor
    }

    private static computeVolatilityTrend(prices: number[]): number {
        // Vol 20 vs Vol 100
        const n = prices.length;
        if (n < 30) return 0;

        const returns = [];
        for (let i = 1; i < n; i++) {
            returns.push(Math.log(prices[i] / prices[i - 1]));
        }

        const vol20 = this.stdDev(returns.slice(-20));
        const vol100 = this.stdDev(returns.slice(-100));

        // Positive score = Rising Volatility (Bad usually)
        // Negative score = Falling Volatility (Good usually, stabilization)

        return vol20 - vol100; // Raw delta
    }

    private static computeDrawdown(prices: number[]): number {
        let peak = -Infinity;
        let maxDD = 0;

        // Look at last 252 days
        const effectivePrices = prices.slice(-252);

        for (const p of effectivePrices) {
            if (p > peak) peak = p;
            const dd = (peak - p) / peak;
            if (dd > maxDD) maxDD = dd;
        }

        return maxDD;
    }

    private static stdDev(data: number[]): number {
        if (data.length === 0) return 0;
        const mean = data.reduce((a, b) => a + b, 0) / data.length;
        const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
        return Math.sqrt(variance);
    }
}
