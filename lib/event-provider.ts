// -----------------------------------------------------------------------------
// EVENT PROVIDER ADAPTER INTERFACE
// -----------------------------------------------------------------------------

import { EventItem } from './event-types';

export interface EventProviderParams {
    horizon?: string;
    category?: string;
    limit?: number;
}

export interface EventProviderAdapter {
    name: string;

    /**
     * Fetch events from this provider.
     * Each provider is responsible for deduping within its own source.
     */
    listEvents(params: EventProviderParams): Promise<EventItem[]>;

    /**
     * Check if provider is available/configured.
     */
    isAvailable(): boolean;
}

/**
 * Deduplication rule: Two events are duplicates if:
 * - Normalized titles match (lowercase, trim, remove special chars)
 * - publishedAt within 24 hours
 * - Same category and scope type
 */
export function normalizeTitle(title: string): string {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ');
}

export function areEventsDuplicates(a: EventItem, b: EventItem): boolean {
    // Check normalized titles
    if (normalizeTitle(a.title) !== normalizeTitle(b.title)) {
        return false;
    }

    // Check category and scope type
    if (a.category !== b.category) return false;
    if (a.affectedScope.type !== b.affectedScope.type) return false;

    // Check time proximity (within 24 hours)
    const timeA = new Date(a.observedAt).getTime();
    const timeB = new Date(b.observedAt).getTime();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    return Math.abs(timeA - timeB) <= TWENTY_FOUR_HOURS;
}

/**
 * Merge duplicate events, keeping the newest and combining sources.
 */
export function mergeEvents(events: EventItem[]): EventItem[] {
    const merged: EventItem[] = [];

    for (const event of events) {
        const existingIdx = merged.findIndex(e => areEventsDuplicates(e, event));

        if (existingIdx >= 0) {
            const existing = merged[existingIdx];
            const keepNewer = new Date(event.observedAt) > new Date(existing.observedAt);

            if (keepNewer) {
                // Replace with newer, merge sources
                merged[existingIdx] = {
                    ...event,
                    sources: [...event.sources, ...existing.sources]
                };
            } else {
                // Keep existing, add new sources
                merged[existingIdx] = {
                    ...existing,
                    sources: [...existing.sources, ...event.sources]
                };
            }
        } else {
            merged.push(event);
        }
    }

    return merged;
}
