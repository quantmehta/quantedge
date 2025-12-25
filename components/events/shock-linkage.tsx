"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface HoldingImpact {
    holdingId: string;
    symbol: string;
    impactValue: number;
    impactPct: number;
    sensitivityUsed: number;
    sensitivitySource: string;
}

interface EventImpactResult {
    eventId: string;
    eventTitle: string;
    portfolioImpactValue: number;
    topGainers: HoldingImpact[];
    topLosers: HoldingImpact[];
}

interface ShockLinkageViewProps {
    eventResults: EventImpactResult[];
    portfolioValue: number;
}

/**
 * Event Shock Linkage View - Heatmap matrix showing Events × Holdings impacts
 */
export function ShockLinkageView({ eventResults, portfolioValue }: ShockLinkageViewProps) {
    // Extract unique holdings from all results
    const { holdings, matrix } = useMemo(() => {
        const holdingMap = new Map<string, { symbol: string; totalImpact: number }>();

        // Gather all holdings
        for (const result of eventResults) {
            for (const h of [...result.topGainers, ...result.topLosers]) {
                if (!holdingMap.has(h.symbol)) {
                    holdingMap.set(h.symbol, { symbol: h.symbol, totalImpact: 0 });
                }
                holdingMap.get(h.symbol)!.totalImpact += h.impactValue;
            }
        }

        // Sort by total absolute impact
        const holdings = Array.from(holdingMap.values())
            .sort((a, b) => Math.abs(b.totalImpact) - Math.abs(a.totalImpact))
            .slice(0, 10);

        // Build impact matrix: event × holding
        const matrix: Map<string, Map<string, HoldingImpact>> = new Map();
        for (const result of eventResults) {
            const eventMap = new Map<string, HoldingImpact>();
            for (const h of [...result.topGainers, ...result.topLosers]) {
                eventMap.set(h.symbol, h);
            }
            matrix.set(result.eventId, eventMap);
        }

        return { holdings, matrix };
    }, [eventResults]);

    if (eventResults.length === 0 || holdings.length === 0) {
        return (
            <div className="text-center py-12 text-slate-400">
                No event impacts computed yet. Run impact analysis first.
            </div>
        );
    }

    // Color scale for heatmap
    const getColor = (value: number) => {
        if (value === 0) return 'bg-slate-50';
        const maxAbs = Math.max(
            ...eventResults.flatMap(e =>
                [...e.topGainers, ...e.topLosers].map(h => Math.abs(h.impactValue))
            )
        );
        const intensity = Math.min(Math.abs(value) / maxAbs, 1);

        if (value > 0) {
            // Green gradient
            if (intensity > 0.7) return 'bg-emerald-500 text-white';
            if (intensity > 0.4) return 'bg-emerald-300';
            return 'bg-emerald-100';
        } else {
            // Red gradient  
            if (intensity > 0.7) return 'bg-red-500 text-white';
            if (intensity > 0.4) return 'bg-red-300';
            return 'bg-red-100';
        }
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
                <thead>
                    <tr>
                        <th className="p-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b">
                            Event / Holding
                        </th>
                        {holdings.map(h => (
                            <th
                                key={h.symbol}
                                className="p-2 text-center text-xs font-medium text-slate-700 border-b min-w-[80px]"
                            >
                                {h.symbol}
                            </th>
                        ))}
                        <th className="p-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wider border-b">
                            Total
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {eventResults.map(result => (
                        <tr key={result.eventId} className="hover:bg-slate-50">
                            <td className="p-2 text-sm font-medium text-slate-900 border-b max-w-[200px] truncate">
                                {result.eventTitle}
                            </td>
                            {holdings.map(h => {
                                const impact = matrix.get(result.eventId)?.get(h.symbol);
                                const value = impact?.impactValue || 0;
                                return (
                                    <td
                                        key={h.symbol}
                                        className={cn(
                                            "p-2 text-center text-xs font-medium border-b cursor-pointer transition-all",
                                            getColor(value),
                                            "hover:ring-2 hover:ring-slate-400"
                                        )}
                                        title={impact ?
                                            `${h.symbol}: ₹${value.toLocaleString('en-IN')} (${(impact.impactPct * 100).toFixed(2)}%)\nSensitivity: ${impact.sensitivityUsed.toFixed(2)} (${impact.sensitivitySource})` :
                                            'No impact'
                                        }
                                    >
                                        {value !== 0 ? (
                                            <span>
                                                {value > 0 ? '+' : ''}{(value / 1000).toFixed(1)}K
                                            </span>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </td>
                                );
                            })}
                            <td className={cn(
                                "p-2 text-center text-xs font-bold border-b",
                                result.portfolioImpactValue > 0 ? "text-emerald-600" : "text-red-600"
                            )}>
                                {result.portfolioImpactValue > 0 ? '+' : ''}
                                ₹{(result.portfolioImpactValue / 1000).toFixed(1)}K
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="bg-slate-50">
                        <td className="p-2 text-sm font-bold text-slate-700">
                            Total by Holding
                        </td>
                        {holdings.map(h => (
                            <td
                                key={h.symbol}
                                className={cn(
                                    "p-2 text-center text-xs font-bold",
                                    h.totalImpact > 0 ? "text-emerald-600" : "text-red-600"
                                )}
                            >
                                {h.totalImpact > 0 ? '+' : ''}
                                {(h.totalImpact / 1000).toFixed(1)}K
                            </td>
                        ))}
                        <td className="p-2 text-center text-xs font-bold text-slate-700">
                            ₹{(portfolioValue / 100000).toFixed(1)}L
                        </td>
                    </tr>
                </tfoot>
            </table>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-4 text-xs">
                <span className="text-slate-500">Impact Scale:</span>
                <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-red-500 rounded" />
                    <span>Strong Negative</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-red-100 rounded" />
                    <span>Weak Negative</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-slate-50 border rounded" />
                    <span>None</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-emerald-100 rounded" />
                    <span>Weak Positive</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-emerald-500 rounded" />
                    <span>Strong Positive</span>
                </div>
            </div>
        </div>
    );
}
