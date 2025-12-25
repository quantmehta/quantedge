import { NextRequest } from 'next/server';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { manualEventProvider } from '@/lib/providers/manual-event-provider';
import { rssEventProvider } from '@/lib/providers/rss-event-provider';
import { mergeEvents } from '@/lib/event-provider';
import { EventItem, validateMagnitude, validateConfidence } from '@/lib/event-types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/events/manage
 * List all events from all providers (manual + RSS)
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const category = searchParams.get('category') || undefined;
        const horizon = searchParams.get('horizon') || undefined;
        const source = searchParams.get('source'); // 'manual', 'rss', or undefined for all
        const limit = parseInt(searchParams.get('limit') || '50', 10);

        const allEvents: EventItem[] = [];
        const providerErrors: string[] = [];

        // Fetch from manual provider
        if (!source || source === 'manual') {
            try {
                const manualEvents = await manualEventProvider.listEvents({ category, horizon, limit });
                allEvents.push(...manualEvents);
            } catch (error: any) {
                providerErrors.push(`Manual: ${error.message}`);
            }
        }

        // Fetch from RSS provider
        if (!source || source === 'rss') {
            if (rssEventProvider.isAvailable()) {
                try {
                    const rssEvents = await rssEventProvider.listEvents({ category, horizon, limit });
                    allEvents.push(...rssEvents);
                } catch (error: any) {
                    providerErrors.push(`RSS: ${error.message}`);
                }
            }
        }

        // Deduplicate across providers
        const mergedEvents = mergeEvents(allEvents);

        // Sort by observedAt descending
        mergedEvents.sort((a, b) =>
            new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime()
        );

        // Apply limit
        const limitedEvents = mergedEvents.slice(0, limit);

        return successResponse({
            events: limitedEvents,
            total: limitedEvents.length,
            providerErrors: providerErrors.length > 0 ? providerErrors : undefined
        });

    } catch (error: any) {
        console.error('Events manage GET error:', error);
        return errorResponse(ErrorCodes.INTERNAL_ERROR, error.message, 500);
    }
}

/**
 * POST /api/events/manage
 * Create a new manual event
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { title, category, direction, magnitudePct, confidence, horizon, affectedScope, sources, observedAt } = body;

        // Validation
        if (!title?.trim()) {
            return errorResponse(ErrorCodes.BAD_REQUEST, 'Title is required', 400);
        }
        if (!category) {
            return errorResponse(ErrorCodes.BAD_REQUEST, 'Category is required', 400);
        }
        if (!direction) {
            return errorResponse(ErrorCodes.BAD_REQUEST, 'Direction is required', 400);
        }
        if (magnitudePct === undefined || magnitudePct === null) {
            return errorResponse(ErrorCodes.BAD_REQUEST, 'Magnitude percentage is required', 400);
        }
        if (confidence === undefined || confidence === null) {
            return errorResponse(ErrorCodes.BAD_REQUEST, 'Confidence is required', 400);
        }
        if (!horizon) {
            return errorResponse(ErrorCodes.BAD_REQUEST, 'Horizon is required', 400);
        }
        if (!affectedScope?.type || !affectedScope?.value) {
            return errorResponse(ErrorCodes.BAD_REQUEST, 'Affected scope (type and value) is required', 400);
        }

        // Validate magnitude and confidence
        const magnitudeValidation = validateMagnitude(magnitudePct);
        const confidenceValidation = validateConfidence(confidence);

        if (!confidenceValidation.isValid) {
            return errorResponse(ErrorCodes.VALIDATION_FAILED, confidenceValidation.errors[0], 422);
        }

        // Create event
        const event = await manualEventProvider.createEvent({
            title: title.trim(),
            category,
            direction,
            magnitudePct,
            confidence,
            horizon,
            affectedScope,
            sources: sources || [{ provider: 'manual', retrievedAt: new Date().toISOString() }],
            observedAt: observedAt || new Date().toISOString(),
            isActive: true
        });

        return successResponse({
            event,
            warnings: magnitudeValidation.warnings
        }, 201);

    } catch (error: any) {
        console.error('Events manage POST error:', error);
        return errorResponse(ErrorCodes.INTERNAL_ERROR, error.message, 500);
    }
}

/**
 * PUT /api/events/manage
 * Update an existing manual event
 */
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, ...updates } = body;

        if (!id) {
            return errorResponse(ErrorCodes.BAD_REQUEST, 'Event ID is required', 400);
        }

        // Validate if magnitude/confidence provided
        if (updates.magnitudePct !== undefined) {
            const magVal = validateMagnitude(updates.magnitudePct);
            if (!magVal.isValid) {
                return errorResponse(ErrorCodes.VALIDATION_FAILED, magVal.errors[0], 422);
            }
        }
        if (updates.confidence !== undefined) {
            const confVal = validateConfidence(updates.confidence);
            if (!confVal.isValid) {
                return errorResponse(ErrorCodes.VALIDATION_FAILED, confVal.errors[0], 422);
            }
        }

        const event = await manualEventProvider.updateEvent(id, updates);

        return successResponse({ event });

    } catch (error: any) {
        console.error('Events manage PUT error:', error);
        if (error.code === 'P2025') {
            return errorResponse(ErrorCodes.NOT_FOUND, 'Event not found', 404);
        }
        return errorResponse(ErrorCodes.INTERNAL_ERROR, error.message, 500);
    }
}

/**
 * DELETE /api/events/manage
 * Soft-delete a manual event
 */
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return errorResponse(ErrorCodes.BAD_REQUEST, 'Event ID is required', 400);
        }

        await manualEventProvider.deleteEvent(id);

        return successResponse({ deleted: true });

    } catch (error: any) {
        console.error('Events manage DELETE error:', error);
        if (error.code === 'P2025') {
            return errorResponse(ErrorCodes.NOT_FOUND, 'Event not found', 404);
        }
        return errorResponse(ErrorCodes.INTERNAL_ERROR, error.message, 500);
    }
}
