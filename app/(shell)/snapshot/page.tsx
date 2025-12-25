"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { ArrowUpRight, ArrowDownRight, DollarSign, Activity, PieChart as PieChartIcon, TrendingUp, AlertCircle, Percent, Zap, BarChart2, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MarketSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { WaterfallChart } from "@/components/charts/waterfall-chart";
import { PerformanceChart } from "@/components/charts/performance-chart";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export default function SnapshotPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <Loader2 className="w-12 h-12 text-slate-300 animate-spin mb-4" />
                <p className="text-slate-500">Loading...</p>
            </div>
        }>
            <SnapshotPageContent />
        </Suspense>
    );
}

function SnapshotPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const urlRunId = searchParams.get("runId");
    const [activeRunId, setActiveRunId] = useState<string | null>(urlRunId);
    const [isLoadingRun, setIsLoadingRun] = useState(!urlRunId);
    const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
    const [isLoading, setIsLoading] = useState(false);

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
                .catch(err => console.error('Snapshot latest run fetch failed', err))
                .finally(() => setIsLoadingRun(false));
        }
    }, [urlRunId]);

    useEffect(() => {
        if (!activeRunId) return;

        setIsLoading(true);
        fetch(`/api/snapshot?runId=${activeRunId}`)
            .then(res => res.json())
            .then(data => {
                if (data.ok) setSnapshot(data.data.snapshot);
                else setSnapshot(data); // Legacy handling
            })
            .catch(err => console.error(err))
            .finally(() => setIsLoading(false));
    }, [activeRunId]);

    if (isLoadingRun) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <Loader2 className="w-12 h-12 text-slate-300 animate-spin mb-4" />
                <p className="text-slate-500">Identifying active portfolio...</p>
            </div>
        );
    }

    if (!activeRunId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                    <AlertCircle className="w-12 h-12 text-slate-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">No Active Portfolio Run</h2>
                <p className="text-slate-500 mb-8 max-w-md">
                    You need to upload and validate a portfolio file to view the snapshot dashboard.
                </p>
                <Button onClick={() => router.push('/upload')} size="lg">
                    Go to Upload
                </Button>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-32 bg-slate-200 rounded-xl" />
                ))}
                <div className="col-span-1 md:col-span-2 lg:col-span-3 h-96 bg-slate-200 rounded-xl" />
            </div>
        );
    }

    if (!snapshot) return null;

    // Formatting Helpers
    const formatCurrency = (val: number) => `$${(val / 1000).toFixed(1)}k`;
    const formatPct = (val: number | null) => val ? `${val.toFixed(2)}%` : 'N/A';

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">

            {/* Header Area */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Market Snapshot</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Run ID: <span className="font-mono text-slate-700 bg-slate-100 px-1 rounded">{activeRunId}</span> •
                        Generated: {new Intl.DateTimeFormat('en-US', { timeStyle: 'medium', dateStyle: 'medium' }).format(new Date(snapshot.updatedAt))}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => router.push(`/scenarios?runId=${activeRunId}`)}>
                        Run Scenarios →
                    </Button>
                </div>
            </div>

            {/* DATA QUALITY MONITOR */}
            {snapshot.freshnessStats && (
                <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex-1">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Data Quality Monitor</h4>
                        <div className="flex h-2 w-full rounded-full overflow-hidden bg-slate-200">
                            <div style={{ width: `${(snapshot.freshnessStats.fresh / (snapshot.freshnessStats.fresh + snapshot.freshnessStats.stale + snapshot.freshnessStats.noData || 1)) * 100}%` }} className="bg-emerald-500" />
                            <div style={{ width: `${(snapshot.freshnessStats.stale / (snapshot.freshnessStats.fresh + snapshot.freshnessStats.stale + snapshot.freshnessStats.noData || 1)) * 100}%` }} className="bg-amber-500" />
                            <div style={{ width: `${(snapshot.freshnessStats.noData / (snapshot.freshnessStats.fresh + snapshot.freshnessStats.stale + snapshot.freshnessStats.noData || 1)) * 100}%` }} className="bg-red-500" />
                        </div>
                    </div>
                    <div className="flex gap-4 text-xs mt-6">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Fresh: {snapshot.freshnessStats.fresh}</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /> Stale: {snapshot.freshnessStats.stale}</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> No Data: {snapshot.freshnessStats.noData}</div>
                    </div>
                </div>
            )}


            {/* PRIMARY METRICS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Portfolio Value</p>
                                <h3 className="text-2xl font-bold text-slate-900 mt-2">
                                    ${(snapshot.portfolioValue).toLocaleString()}
                                </h3>
                            </div>
                            <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                <DollarSign size={20} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Invested Capital</p>
                                <h3 className="text-2xl font-bold text-slate-900 mt-2">
                                    ${(snapshot.investedCapital).toLocaleString()}
                                </h3>
                            </div>
                            <div className="p-2 bg-slate-100 text-slate-500 rounded-lg">
                                <Activity size={20} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Net P&L (Unrealized)</p>
                                <h3 className={cn("text-2xl font-bold mt-2", snapshot.pnlAbs >= 0 ? "text-emerald-600" : "text-red-600")}>
                                    {snapshot.pnlAbs >= 0 ? '+' : ''}${(snapshot.pnlAbs).toLocaleString()}
                                </h3>
                            </div>
                            <div className={cn("p-2 rounded-lg", snapshot.pnlAbs >= 0 ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600")}>
                                {snapshot.pnlAbs >= 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Return %</p>
                                <h3 className={cn("text-2xl font-bold mt-2", snapshot.pnlPct >= 0 ? "text-emerald-600" : "text-red-600")}>
                                    {snapshot.pnlPct >= 0 ? '+' : ''}{snapshot.pnlPct.toFixed(2)}%
                                </h3>
                            </div>
                            <div className="p-2 bg-slate-100 text-slate-500 rounded-lg">
                                <TrendingUp size={20} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* RISK METRICS ROW */}
            {snapshot.riskMetrics && (
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Risk Profile</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Zap size={18} /></div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold">Volatility (Ann)</p>
                                    <p className="text-lg font-bold">{formatPct(snapshot.riskMetrics.volatility)}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Activity size={18} /></div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold">Beta (vs Nifty)</p>
                                    <p className="text-lg font-bold">{snapshot.riskMetrics.beta?.toFixed(2) || 'N/A'}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="p-2 bg-red-100 text-red-600 rounded-lg"><ArrowDownRight size={18} /></div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold">Max Drawdown</p>
                                    <p className="text-lg font-bold text-red-600">{snapshot.riskMetrics.maxDrawdown ? (snapshot.riskMetrics.maxDrawdown * 100).toFixed(2) + '%' : 'N/A'}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="p-2 bg-green-100 text-green-600 rounded-lg"><Percent size={18} /></div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold">Sharpe Ratio</p>
                                    <p className="text-lg font-bold">{snapshot.riskMetrics.sharpeRatio?.toFixed(2) || 'N/A'}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* PERFORMANCE & WATERFALL */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-slate-500" />
                            Performance History
                        </CardTitle>
                        <CardDescription>Portfolio vs Benchmark (Rebased to 100)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {snapshot.performanceChart && <PerformanceChart data={snapshot.performanceChart} />}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart2 className="w-5 h-5 text-slate-500" />
                            P&L Waterfall
                        </CardTitle>
                        <CardDescription>Top contributors to unrealized gain/loss</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {snapshot.waterfallChart && <WaterfallChart data={snapshot.waterfallChart} />}
                    </CardContent>
                </Card>
            </div>

            {/* ALLOCATION & CONTRIBUTORS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PieChartIcon className="w-5 h-5 text-slate-500" />
                            Asset Allocation
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={snapshot.holdingsBreakdown}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="percentage"
                                >
                                    {snapshot.holdingsBreakdown.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center gap-4 text-xs flex-wrap">
                            {snapshot.holdingsBreakdown.map((entry, index) => (
                                <div key={index} className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                    <span>{entry.assetClass} ({entry.percentage}%)</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-slate-500" />
                            Top Contributors
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={snapshot.topContributors} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis dataKey="symbol" type="category" width={80} tick={{ fontSize: 12 }} />
                                <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(val: any) => typeof val === 'number' ? val.toLocaleString() : val} />
                                <Bar dataKey="contribution" fill="#00C08B" radius={[0, 4, 4, 0]} barSize={20}>
                                    {snapshot.topContributors.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.contribution >= 0 ? "#10b981" : "#ef4444"} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
