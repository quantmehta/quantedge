"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { History, ArrowRight, Copy, Check, FileSpreadsheet, PlayCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge"; // Using simple mock or assuming existence
import { Run } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function RunsPage() {
    const router = useRouter();
    const [runs, setRuns] = useState<Run[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/runs')
            .then(res => res.json())
            .then(data => setRuns(data))
            .catch(err => console.error(err))
            .finally(() => setIsLoading(false));
    }, []);

    const copyToClipboard = (id: string) => {
        navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const reopenRun = (id: string) => {
        router.push(`/snapshot?runId=${id}`);
    };

    if (isLoading) return <div className="p-8 text-center">Loading run history...</div>;

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Run History</h1>
                <p className="text-slate-500">Audit trail of all portfolio analyses performed by your team.</p>
            </div>

            <div className="space-y-4">
                {runs.map((run) => (
                    <Card key={run.id} className="hover:border-primary/50 transition-colors">
                        <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                                {/* Identifier & Status */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded">
                                            {run.id}
                                        </span>
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-full text-xs font-bold uppercase",
                                            run.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                                        )}>
                                            {run.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <History size={14} /> {new Date(run.createdAt).toLocaleString()}
                                        </span>
                                        <span>•</span>
                                        <span>User: {run.user}</span>
                                    </div>
                                </div>

                                {/* Audit Info */}
                                <div className="hidden md:block flex-1 border-l border-slate-100 pl-6">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Audit Log</p>
                                    <p className="text-sm text-slate-600">{run.auditSummary}</p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-3">
                                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(run.id)}>
                                        {copiedId === run.id ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                                    </Button>
                                    <Button onClick={() => reopenRun(run.id)} className="bg-primary hover:bg-primary/90 text-white">
                                        Open Snapshot <ArrowRight size={16} className="ml-2" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
