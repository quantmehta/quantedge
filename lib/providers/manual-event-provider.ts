// -----------------------------------------------------------------------------
// MANUAL EVENT PROVIDER - Reads from DB Event table
// -----------------------------------------------------------------------------

import { prisma } from '@/lib/db';
import { EventProviderAdapter, EventProviderParams } from '@/lib/event-provider';
import { EventItem, EventSource } from '@/lib/event-types';

export class ManualEventProvider implements EventProviderAdapter {
    name = 'manual';

    isAvailable(): boolean {
        return true; // Always available
    }

    async listEvents(params: EventProviderParams): Promise<EventItem[]> {
        const where: any = { isActive: true };

        if (params.horizon) {
            where.horizon = params.horizon;
        }
        if (params.category) {
            where.category = params.category;
        }

        const dbEvents = await prisma.event.findMany({
            where,
            orderBy: { observedAt: 'desc' },
            take: params.limit || 100
        });

        return dbEvents.map(e => this.mapDbToEventItem(e));
    }

    private mapDbToEventItem(db: any): EventItem {
        let sources: EventSource[] = [];
        try {
            sources = JSON.parse(db.sourcesJson || '[]');
        } catch { }

        return {
            id: db.id,
            title: db.title,
            category: db.category as EventItem['category'],
            direction: db.direction as EventItem['direction'],
            magnitudePct: db.magnitudePct,
            confidence: db.confidence,
            horizon: db.horizon as EventItem['horizon'],
            affectedScope: {
                type: db.affectedScopeType as EventItem['affectedScope']['type'],
                value: db.affectedScopeValue
            },
            sources,
            observedAt: db.observedAt.toISOString(),
            createdAt: db.createdAt.toISOString(),
            isActive: db.isActive
        };
    }

    // CRUD Operations for manual events

    async createEvent(data: Omit<EventItem, 'id' | 'createdAt'>): Promise<EventItem> {
        const created = await prisma.event.create({
            data: {
                title: data.title,
                category: data.category,
                direction: data.direction,
                magnitudePct: data.magnitudePct,
                confidence: data.confidence,
                horizon: data.horizon,
                affectedScopeType: data.affectedScope.type,
                affectedScopeValue: data.affectedScope.value,
                sourcesJson: JSON.stringify(data.sources || []),
                observedAt: new Date(data.observedAt),
                isActive: data.isActive ?? true
            }
        });

        return this.mapDbToEventItem(created);
    }

    async updateEvent(id: string, data: Partial<EventItem>): Promise<EventItem> {
        const updateData: any = {};

        if (data.title !== undefined) updateData.title = data.title;
        if (data.category !== undefined) updateData.category = data.category;
        if (data.direction !== undefined) updateData.direction = data.direction;
        if (data.magnitudePct !== undefined) updateData.magnitudePct = data.magnitudePct;
        if (data.confidence !== undefined) updateData.confidence = data.confidence;
        if (data.horizon !== undefined) updateData.horizon = data.horizon;
        if (data.affectedScope !== undefined) {
            updateData.affectedScopeType = data.affectedScope.type;
            updateData.affectedScopeValue = data.affectedScope.value;
        }
        if (data.sources !== undefined) updateData.sourcesJson = JSON.stringify(data.sources);
        if (data.observedAt !== undefined) updateData.observedAt = new Date(data.observedAt);
        if (data.isActive !== undefined) updateData.isActive = data.isActive;

        const updated = await prisma.event.update({
            where: { id },
            data: updateData
        });

        return this.mapDbToEventItem(updated);
    }

    async deleteEvent(id: string): Promise<void> {
        // Soft delete by marking inactive
        await prisma.event.update({
            where: { id },
            data: { isActive: false }
        });
    }

    async hardDeleteEvent(id: string): Promise<void> {
        await prisma.event.delete({ where: { id } });
    }
}

// Singleton instance
export const manualEventProvider = new ManualEventProvider();
