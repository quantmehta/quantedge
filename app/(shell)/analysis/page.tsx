"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
    TrendingUp, TrendingDown, DollarSign, Activity,
    Zap, AlertCircle, ShoppingCart, Info, Loader2,
    ChevronRight, ArrowRight, Table as TableIcon,
    PieChart, Briefcase, Filter
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    Table, TableBody, TableCell, TableHead,
    TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function AnalysisPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <Loader2 className="w-12 h-12 text-slate-300 animate-spin mb-4" />
                <p className="text-slate-500">Loading...</p>
            </div>
        }>
            <AnalysisPageContent />
        </Suspense>
    );
}

function AnalysisPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const urlRunId = searchParams.get("runId");

    const [activeRunId, setActiveRunId] = useState<string | null>(urlRunId);
    const [isLoadingRun, setIsLoadingRun] = useState(!urlRunId);
    const [analysisData, setAnalysisData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                .catch(err => console.error('Analysis latest run fetch failed', err))
                .finally(() => setIsLoadingRun(false));
        }
    }, [urlRunId]);

    useEffect(() => {
        if (!activeRunId) return;

        setIsLoading(true);
        setError(null);
        fetch(`/api/analysis?runId=${activeRunId}`)
            .then(res => res.json())
            .then(data => {
                if (data.ok) setAnalysisData(data.data.analysis);
                else {
                    setError(data.error?.message || 'Failed to load analysis');
                    // If run not found, it might be a stale URL param. Clear it.
                    if (data.error?.code === 'NOT_FOUND' && urlRunId) {
                        router.replace('/analysis');
                    }
                }
            })
            .catch(err => {
                console.error(err);
                setError('A network error occurred while loading the analysis.');
            })
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
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Portfolio Not Analyzed</h2>
                <p className="text-slate-500 mb-8 max-w-md">
                    Please upload a portfolio spreadsheet to initialize the analysis engine.
                </p>
                <Button onClick={() => router.push('/upload')} size="lg">
                    Go to Upload
                </Button>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 text-red-500">
                <AlertCircle className="w-12 h-12 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Analysis Failed</h2>
                <p className="max-w-md mb-8">{error}</p>
                <div className="flex gap-4">
                    <Button onClick={() => window.location.reload()}>Retry</Button>
                    <Button variant="outline" onClick={() => router.push('/upload')}>Back to Upload</Button>
                </div>
            </div>
        );
    }

    if (isLoading || !analysisData) {
        return (
            <div className="space-y-8 animate-pulse p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="h-40 bg-slate-100 rounded-xl" />
                    <div className="h-40 bg-slate-100 rounded-xl" />
                </div>
                <div className="h-96 bg-slate-100 rounded-xl" />
            </div>
        );
    }

    const realizedPnl = Number(analysisData.realizedPnl || 0);
    const unrealizedPnl = Number(analysisData.unrealizedPnl || 0);
    const totalPnl = Number(analysisData.totalPnl || 0);
    const suggestions = Array.isArray(analysisData.suggestions) ? analysisData.suggestions : [];

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 p-8">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Analysis Dashboard</h1>
                    <p className="text-slate-500 text-lg mt-2 flex items-center gap-2">
                        Intelligence-driven portfolio insights for <span className="font-mono text-primary font-bold">{activeRunId ? activeRunId.slice(0, 8) : 'N/A'}</span>
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={() => router.push('/upload')}>
                        Upload New File
                    </Button>
                </div>
            </div>

            {/* P&L Pulse Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="overflow-hidden border-none shadow-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                    <CardContent className="p-8">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Existing Gain/Loss (Sold)</p>
                                <h2 className={cn("text-4xl font-black", realizedPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                                    {realizedPnl >= 0 ? '+' : ''}₹{realizedPnl.toLocaleString('en-IN')}
                                </h2>
                            </div>
                            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                                <ShoppingCart className="text-slate-300 w-8 h-8" />
                            </div>
                        </div>
                        <div className="mt-8 flex items-center gap-2 text-slate-400 text-sm">
                            <span className="flex items-center gap-1"><Info size={14} /> Only captures shares with 'Sold' status.</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden border-none shadow-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white">
                    <CardContent className="p-8">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <p className="text-white/80 text-sm font-medium uppercase tracking-wider">New Combined Gain/Loss</p>
                                <h2 className="text-4xl font-black">
                                    ₹{totalPnl.toLocaleString('en-IN')}
                                </h2>
                            </div>
                            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                                <TrendingUp className="text-white w-8 h-8" />
                            </div>
                        </div>
                        <div className="mt-8 flex justify-between items-end">
                            <div className="space-y-1">
                                <p className="text-white/70 text-xs font-medium">Unrealized Growth</p>
                                <p className="font-bold text-xl">₹{unrealizedPnl.toLocaleString('en-IN')}</p>
                            </div>
                            <Badge className="bg-white/20 text-white border-none px-3 py-1">LIVE CONTEXT</Badge>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Actionable Intelligence Table */}
            <Card className="border-none shadow-2xl overflow-hidden bg-white">
                <CardHeader className="border-b bg-slate-50/50 p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                <Zap className="text-primary w-6 h-6 fill-primary" />
                                Actionable Portfolio Changes
                            </CardTitle>
                            <CardDescription className="text-base text-slate-500 mt-1">
                                Identifying shares where immediate rebalancing or action is recommended based on current news and policies.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                                {suggestions.length} Change{suggestions.length !== 1 ? 's' : ''} Detected
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        {suggestions.length === 0 ? (
                            <div className="p-12 text-center">
                                <Activity className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-slate-900">No Action Required</h3>
                                <p className="text-slate-500">Your current holdings align well with market trends. No immediate changes recommended.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="w-[200px] py-6 px-6 text-slate-900 font-bold uppercase text-[10px] tracking-widest">Share Name</TableHead>
                                        <TableHead className="py-6 text-slate-900 font-bold uppercase text-[10px] tracking-widest text-center">Recommended Action</TableHead>
                                        <TableHead className="py-6 text-slate-900 font-bold uppercase text-[10px] tracking-widest">Market Catalyst</TableHead>
                                        <TableHead className="py-6 px-6 text-slate-900 font-bold uppercase text-[10px] tracking-widest">Decision Reasoning</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {suggestions.map((item: any, i: number) => (
                                        <TableRow key={i} className="group hover:bg-slate-50/80 transition-all border-slate-100">
                                            <TableCell className="px-6 py-6 font-bold text-slate-900">
                                                <div className="flex flex-col">
                                                    <span className="text-lg">{item.symbol}</span>
                                                    <span className="text-slate-400 text-xs font-normal">Active Holding</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center py-6">
                                                <Badge className={cn(
                                                    "px-4 py-1 text-[10px] font-black tracking-wider uppercase border-none",
                                                    item.signal === 'BUY' && "bg-emerald-500 text-white shadow-lg shadow-emerald-200",
                                                    item.signal === 'HOLD' && "bg-amber-500 text-white shadow-lg shadow-amber-200",
                                                    item.signal === 'SELL' && "bg-red-500 text-white shadow-lg shadow-red-200"
                                                )}>
                                                    {item.signal}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-6 font-medium text-slate-600 text-sm">
                                                {item.impactParameter}
                                            </TableCell>
                                            <TableCell className="px-6 py-6 max-w-md text-slate-500 text-sm leading-relaxed">
                                                {item.reasoning}
                                            </TableCell>
                                            <TableCell className="pr-6 text-right">
                                                <Button variant="ghost" size="icon" className="group-hover:translate-x-1 transition-transform">
                                                    <ArrowRight className="w-4 h-4 text-primary" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Footer Disclaimer */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <div className="flex gap-4">
                    <div className="p-3 bg-amber-100 text-amber-700 rounded-xl h-fit">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 text-lg">Analysis Methodology</h4>
                        <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                            This report uses high-resolution historical market trends (2015-2025) and professional fund manager intelligence to provide predictive signals.
                            Signals are based on sector-level sensitivity to macro/geopolitical events. Use this as a decision-support tool, not as sole investment advice.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
