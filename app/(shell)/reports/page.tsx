"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, Download, RefreshCw, CheckCircle, Clock, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Report } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <Loader2 className="w-12 h-12 text-slate-300 animate-spin mb-4" />
                <p className="text-slate-500">Loading...</p>
            </div>
        }>
            <ReportsPageContent />
        </Suspense>
    );
}

function ReportsPageContent() {
    const searchParams = useSearchParams();
    const urlRunId = searchParams.get("runId");

    const [activeRunId, setActiveRunId] = useState<string | null>(urlRunId);
    const [isLoadingRun, setIsLoadingRun] = useState(!urlRunId);
    const [isGenerating, setIsGenerating] = useState(false);
    const [report, setReport] = useState<Report | null>(null);

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
                .catch(err => console.error('Reports latest run fetch failed', err))
                .finally(() => setIsLoadingRun(false));
        }
    }, [urlRunId]);

    const generateReport = async () => {
        if (!activeRunId) return;
        setIsGenerating(true);
        try {
            const res = await fetch(`/api/reports/generate?runId=${activeRunId}`, { method: 'POST' });
            const data = await res.json();
            setReport(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsGenerating(false);
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

    if (!activeRunId) return <div className="p-8 text-center text-slate-500">Please upload a portfolio first.</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reporting</h1>
                <p className="text-slate-500">Generate professional PDFs for client presentations and internal audit.</p>
            </div>

            <Card className="border-l-4 border-l-primary shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="text-primary" />
                        Executive Summary Report
                    </CardTitle>
                    <CardDescription>
                        Includes Portfolio Snapshot, Top Movers, Scenario Analysis, and Strategic Recommendations.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-sm space-y-2">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Data Source:</span>
                            <span className="font-mono text-slate-900">{activeRunId}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">As Of:</span>
                            <span className="text-slate-900">{new Date().toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Format:</span>
                            <span className="text-slate-900">PDF (Standard A4)</span>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="bg-slate-50/50 border-t border-slate-100 px-6 py-4 flex justify-between items-center">
                    {!report ? (
                        <div className="flex gap-4 w-full justify-end">
                            <Button disabled variant="ghost">Preview</Button>
                            <Button onClick={generateReport} disabled={isGenerating}>
                                {isGenerating ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Generating...
                                    </>
                                ) : (
                                    "Generate Report"
                                )}
                            </Button>
                        </div>
                    ) : (
                        <div className="w-full flex items-center justify-between animate-in fade-in duration-300">
                            <div className="flex items-center gap-2 text-emerald-600 font-medium">
                                <CheckCircle size={20} />
                                Report Ready
                            </div>
                            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                <Download className="mr-2 h-4 w-4" /> Download PDF
                            </Button>
                        </div>
                    )}
                </CardFooter>
            </Card>

            {/* Disclaimer Placeholder */}
            <div className="text-xs text-slate-400 mt-8 text-center max-w-2xl mx-auto leading-relaxed">
                DISCLAIMER: This report is generated by QuantEdge Phase 0 Mock Engine. Data is simulated and should not be used for actual investment decisions. Past performance is not indicative of future results.
            </div>
        </div>
    );
}
