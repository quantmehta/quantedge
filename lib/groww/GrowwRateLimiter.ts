
type BucketType = 'LIVE_DATA' | 'ORDERS' | 'NON_TRADING';

interface BucketConfig {
    maxTokens: number;
    refillRate: number; // tokens per second
}

const BUCKETS: Record<BucketType, BucketConfig> = {
    'LIVE_DATA': { maxTokens: 10, refillRate: 5 },  // High throughput
    'ORDERS': { maxTokens: 2, refillRate: 0.5 },    // Low throughput, critical
    'NON_TRADING': { maxTokens: 5, refillRate: 2 }  // Metadata sync
};

class RateLimiter {
    private tokens: Record<BucketType, number>;
    private lastRefill: Record<BucketType, number>;

    constructor() {
        this.tokens = {
            'LIVE_DATA': BUCKETS.LIVE_DATA.maxTokens,
            'ORDERS': BUCKETS.ORDERS.maxTokens,
            'NON_TRADING': BUCKETS.NON_TRADING.maxTokens
        };
        this.lastRefill = {
            'LIVE_DATA': Date.now(),
            'ORDERS': Date.now(),
            'NON_TRADING': Date.now()
        };
    }

    private refill(type: BucketType) {
        const now = Date.now();
        const elapsed = (now - this.lastRefill[type]) / 1000;
        const config = BUCKETS[type];

        if (elapsed > 0) {
            const added = elapsed * config.refillRate;
            this.tokens[type] = Math.min(config.maxTokens, this.tokens[type] + added);
            this.lastRefill[type] = now;
        }
    }

    async waitForToken(type: BucketType): Promise<void> {
        return new Promise((resolve) => {
            const tryAcquire = () => {
                this.refill(type);
                if (this.tokens[type] >= 1) {
                    this.tokens[type] -= 1;
                    resolve();
                } else {
                    setTimeout(tryAcquire, 200); // Poll every 200ms
                }
            };
            tryAcquire();
        });
    }
}

export const growwRateLimiter = new RateLimiter();
