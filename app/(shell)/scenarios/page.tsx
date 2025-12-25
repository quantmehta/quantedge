"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Play, TrendingDown, Info, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScenarioResult } from "@/lib/types";
import { cn } from "@/lib/utils";

// Mock assumptions
const ASSUMPTIONS = "Assumptions: Beta-weighted portfolio correlation. 95% Confidence Interval. Volatility based on 30-day VIX avg.";

export default function ScenariosPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <Loader2 className="w-12 h-12 text-slate-300 animate-spin mb-4" />
                <p className="text-slate-500">Loading...</p>
            </div>
        }>
            <ScenariosPageContent />
        </Suspense>
    );
}

function ScenariosPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const urlRunId = searchParams.get("runId");

    const [activeRunId, setActiveRunId] = useState<string | null>(urlRunId);
    const [isLoadingRun, setIsLoadingRun] = useState(!urlRunId);
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<ScenarioResult[] | null>(null);

    useEffect(() => {
        if (urlRunId) {
            setActiveRunId(urlRunId);
            setIsLoadingRun(false);
        } else {
            setIsLoadingRun(true);
            fetch('/api/runs/latest')
                .then(res => res.json())
                .then(json => {
                    if (json.ok && json.data.runId) {
                        setActiveRunId(json.data.runId);
                    }
                })
                .catch(err => console.error('Scenarios latest run fetch failed', err))
                .finally(() => setIsLoadingRun(false));
        }
    }, [urlRunId]);

    const runScenarios = async () => {
        if (!activeRunId) return;
        setIsRunning(true);
        try {
            const res = await fetch(`/api/scenarios/run?runId=${activeRunId}`, { method: 'POST' });
            const data = await res.json();
            setResults(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsRunning(false);
        }
    };

    if (isLoadingRun) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <Loader2 className="w-12 h-12 text-slate-300 animate-spin mb-4" />
                <p className="text-slate-500">Identifying active portfolio...</p>
            </div>
        );
    }

    if (!activeRunId) return <div className="p-8 text-center text-slate-500">Please upload a portfolio run first.</div>;

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Stress Testing</h1>
                <p className="text-slate-500">Simulate market shocks to evaluate portfolio resilience.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* CONTROLS */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>1-Click Scenarios</CardTitle>
                            <CardDescription>Standard stress tests</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <Button onClick={runScenarios} disabled={isRunning} variant="outline" className="justify-start h-auto py-4 px-4">
                                <TrendingDown className="mr-3 h-5 w-5 text-red-500" />
                                <div className="text-left">
                                    <div className="font-semibold text-slate-900">Market Crash (-5%)</div>
                                    <div className="text-xs text-slate-500">Broad equity market decline</div>
                                </div>
                            </Button>
                            <Button onClick={runScenarios} disabled={isRunning} variant="outline" className="justify-start h-auto py-4 px-4">
                                <TrendingDown className="mr-3 h-5 w-5 text-amber-500" />
                                <div className="text-left">
                                    <div className="font-semibold text-slate-900">Tech Correction (-10%)</div>
                                    <div className="text-xs text-slate-500">Sector specific rotation</div>
                                </div>
                            </Button>
                            <Button onClick={runScenarios} disabled={isRunning} variant="outline" className="justify-start h-auto py-4 px-4">
                                <Info className="mr-3 h-5 w-5 text-blue-500" />
                                <div className="text-left">
                                    <div className="font-semibold text-slate-900">Rate Hike (+50bps)</div>
                                    <div className="text-xs text-slate-500">Impact on Fixed Income</div>
                                </div>
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="bg-slate-100 p-4 rounded-lg text-xs text-slate-500 font-mono leading-relaxed border border-slate-200">
                        {ASSUMPTIONS}
                    </div>
                </div>

                {/* RESULTS */}
                <div className="lg:col-span-2">
                    {results ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-xl font-bold text-slate-900 pb-2 border-b border-slate-200">Simulation Results</h2>

                            {results.map((res) => (
                                <Card key={res.scenarioId} className="border-l-4 border-l-red-500 overflow-hidden">
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200">
                                                    {res.scenarioId}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-slate-500">
                                                Affected Holdings: <span className="font-mono font-medium text-slate-900">{res.affectedHoldingsCount}</span>
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-red-600">
                                                {res.impactPct}%
                                            </div>
                                            <div className="text-sm text-red-800 font-mono">
                                                ${res.impactAbs.toLocaleString()}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12 border-2 border-dashed border-slate-200 rounded-xl">
                            <ShieldAlert className="w-12 h-12 mb-4 opacity-50" />
                            <p>Select a scenario to run simulation</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

