
import { getLatestRecommendations } from './getRecommendations';
import { RecommendationsView } from './RecommendationsView';

export default async function RecommendationsPage() {
    const recommendations = await getLatestRecommendations();

    return (
        <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8 space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">Optimization Engine</h1>
                    <p className="text-neutral-400 mt-1">AI-driven portfolio rebalancing and actionable insights.</p>
                </div>
                <div className="flex gap-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2">
                        <div className="text-xs text-neutral-500 uppercase font-semibold">Actions</div>
                        <div className="text-xl font-bold">{recommendations.length}</div>
                    </div>
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2">
                        <div className="text-xs text-neutral-500 uppercase font-semibold">Version</div>
                        <div className="text-xl font-bold text-blue-400">V1.0</div>
                    </div>
                </div>
            </header>

            <RecommendationsView initialData={recommendations} />
        </main>
    );
}
