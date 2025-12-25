"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Updated Header with Freshness
export function AppHeader() {
    const searchParams = useSearchParams();
    const urlRunId = searchParams.get("runId");
    const [activeRunId, setActiveRunId] = useState<string | null>(urlRunId);

    useEffect(() => {
        if (urlRunId) {
            setActiveRunId(urlRunId);
        } else {
            // Fetch latest run if not in URL
            fetch('/api/runs/latest')
                .then(res => res.json())
                .then(json => {
                    if (json.ok && json.data.runId) {
                        setActiveRunId(json.data.runId);
                    }
                })
                .catch(err => console.error('Header latest run fetch failed', err));
        }
    }, [urlRunId]);

    return (
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-md px-6">
            <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium">
                    <span className="text-slate-500">Active Run:</span>
                    <span className="font-mono text-slate-900">{activeRunId ? activeRunId.slice(0, 8) + '...' : 'None'}</span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <span className="text-xs text-slate-500 hidden sm:inline-block">
                    Powering Real Decisions
                </span>

                {process.env.NEXT_PUBLIC_GROWW_MOCK === 'true' && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                        Mock Mode
                    </span>
                )}

                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                    DM
                </div>
            </div>
        </header >
    );
}

