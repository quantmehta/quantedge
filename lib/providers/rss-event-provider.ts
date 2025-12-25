// -----------------------------------------------------------------------------
// RSS EVENT PROVIDER - Fetches events from RSS feeds
// -----------------------------------------------------------------------------

import { EventProviderAdapter, EventProviderParams } from '@/lib/event-provider';
import { EventItem, EventSource, EventCategory, EventDirection } from '@/lib/event-types';

// Use native crypto for UUID generation

// Default demo RSS feeds (can be overridden via env)
const DEFAULT_RSS_FEEDS = [
    'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^NSEI&region=IN&lang=en-IN',
];

interface RssItem {
    title: string;
    link?: string;
    pubDate?: string;
    description?: string;
}

export class RssEventProvider implements EventProviderAdapter {
    name = 'rss';
    private feedUrls: string[];

    constructor() {
        const envFeeds = process.env.RSS_EVENT_FEEDS;
        this.feedUrls = envFeeds ? envFeeds.split(',').map(f => f.trim()) : DEFAULT_RSS_FEEDS;
    }

    isAvailable(): boolean {
        return this.feedUrls.length > 0;
    }

    async listEvents(params: EventProviderParams): Promise<EventItem[]> {
        const events: EventItem[] = [];
        const now = new Date().toISOString();

        for (const feedUrl of this.feedUrls) {
            try {
                const feedEvents = await this.fetchFeed(feedUrl, now);
                events.push(...feedEvents);
            } catch (error) {
                console.error(`RSS feed error for ${feedUrl}:`, error);
                // Continue to next feed on error (graceful degradation)
            }
        }

        // Apply filters if provided
        let filtered = events;
        if (params.category) {
            filtered = filtered.filter(e => e.category === params.category);
        }
        if (params.limit) {
            filtered = filtered.slice(0, params.limit);
        }

        return filtered;
    }

    private async fetchFeed(feedUrl: string, retrievedAt: string): Promise<EventItem[]> {
        // Fetch RSS XML
        const response = await fetch(feedUrl, {
            headers: { 'User-Agent': 'QuantEdge/1.0' }
        });

        if (!response.ok) {
            throw new Error(`RSS fetch failed: ${response.status}`);
        }

        const xmlText = await response.text();
        const items = this.parseRssXml(xmlText);

        return items.map(item => this.mapRssToEvent(item, feedUrl, retrievedAt));
    }

    private parseRssXml(xml: string): RssItem[] {
        const items: RssItem[] = [];

        // Simple regex-based XML parsing (for portability)
        const itemMatches = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];

        for (const itemXml of itemMatches) {
            const title = this.extractTag(itemXml, 'title');
            const link = this.extractTag(itemXml, 'link');
            const pubDate = this.extractTag(itemXml, 'pubDate');
            const description = this.extractTag(itemXml, 'description');

            if (title) {
                items.push({ title, link, pubDate, description });
            }
        }

        return items;
    }

    private extractTag(xml: string, tagName: string): string | undefined {
        const regex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>|<${tagName}[^>]*>([^<]*)<\\/${tagName}>`, 'i');
        const match = xml.match(regex);
        return match ? (match[1] || match[2])?.trim() : undefined;
    }

    private mapRssToEvent(item: RssItem, feedUrl: string, retrievedAt: string): EventItem {
        // Infer category from title keywords
        const category = this.inferCategory(item.title, item.description);

        // Infer direction from title sentiment (simplified)
        const direction = this.inferDirection(item.title, item.description);

        const source: EventSource = {
            provider: 'rss',
            url: item.link,
            headline: item.title,
            publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
            retrievedAt
        };

        return {
            id: crypto.randomUUID(),
            title: item.title,
            category,
            direction,
            magnitudePct: this.inferMagnitude(category, direction),
            confidence: 0.5, // Default confidence for RSS
            horizon: '1M',   // Default horizon
            affectedScope: {
                type: 'BENCHMARK',
                value: 'NSE_NIFTY' // Default to benchmark
            },
            sources: [source],
            observedAt: item.pubDate ? new Date(item.pubDate).toISOString() : retrievedAt,
            createdAt: retrievedAt,
            isActive: true
        };
    }

    private inferCategory(title: string, desc?: string): EventCategory {
        const text = `${title} ${desc || ''}`.toLowerCase();

        if (/\b(rbi|fed|rate|inflation|gdp|fiscal|monetary|central bank)\b/.test(text)) {
            return 'MACRO';
        }
        if (/\b(war|conflict|sanction|election|government|policy|trade)\b/.test(text)) {
            return 'GEOPOLITICAL';
        }
        if (/\b(tech|banking|pharma|auto|energy|sector|industry)\b/.test(text)) {
            return 'SECTOR';
        }
        if (/\b(results|earnings|profit|loss|dividend|merger|acquisition)\b/.test(text)) {
            return 'COMPANY';
        }

        return 'MACRO'; // Default
    }

    private inferDirection(title: string, desc?: string): EventDirection {
        const text = `${title} ${desc || ''}`.toLowerCase();

        const positiveWords = /\b(surge|rise|gain|profit|growth|rally|up|bull|high|beat|strong)\b/;
        const negativeWords = /\b(fall|drop|loss|decline|crash|bear|low|miss|weak|down)\b/;

        const hasPositive = positiveWords.test(text);
        const hasNegative = negativeWords.test(text);

        if (hasPositive && hasNegative) return 'MIXED';
        if (hasPositive) return 'POSITIVE';
        if (hasNegative) return 'NEGATIVE';
        return 'MIXED';
    }

    private inferMagnitude(category: EventCategory, direction: EventDirection): number {
        // Conservative default magnitudes
        const baseMagnitude = category === 'MACRO' ? 3.0 :
            category === 'GEOPOLITICAL' ? 4.0 :
                category === 'SECTOR' ? 2.0 :
                    1.5;

        return direction === 'NEGATIVE' ? -baseMagnitude :
            direction === 'POSITIVE' ? baseMagnitude :
                0;
    }
}

// Singleton instance
export const rssEventProvider = new RssEventProvider();
