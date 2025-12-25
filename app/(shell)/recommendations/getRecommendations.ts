
import { prisma } from '@/lib/db';
import { Recommendation } from '@/lib/recommendations/RecommendationContracts';

export async function getLatestRecommendations(): Promise<Recommendation[]> {
    const run = await prisma.run.findFirst({
        where: { status: { in: ['EVENTS_DONE', 'RECS_DONE'] } },
        orderBy: { createdAt: 'desc' }
    });

    if (!run) return [];

    const rows = await prisma.runRecommendation.findMany({
        where: { runId: run.id }
    });

    return rows.map(r => {
        try {
            return JSON.parse(r.resultJson) as Recommendation;
        } catch (e) {
            return null;
        }
    }).filter(x => x !== null) as Recommendation[];
}
