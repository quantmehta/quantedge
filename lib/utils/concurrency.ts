
/**
 * Runs a list of async items with a concurrency limit.
 */
export async function mapConcurrency<T, R>(
    items: T[],
    fn: (item: T, index: number) => Promise<R>,
    concurrency: number
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    const executing: Promise<void>[] = [];

    let index = 0;

    const runNext = async (): Promise<void> => {
        while (index < items.length) {
            const i = index++;
            const item = items[i];
            try {
                results[i] = await fn(item, i);
            } catch (err) {
                // Determine how to handle errors. For now, we allow individual item failure 
                // but usually we might want to throw or return null. 
                // Let's assume the fn handles its own errors or we bubble up.
                // To prevent one failure stopping all, we catch here if needed, 
                // but for strict pipelines, maybe throwing is better?
                // The prompt says "flawless", usually implies soft failure for rows.
                // Let's rethrow to let caller decide, but this breaks the loop.
                throw err;
            }
        }
    };

    for (let i = 0; i < concurrency; i++) {
        executing.push(runNext());
    }

    await Promise.all(executing);
    return results;
}
