"use client";

import { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

// Re-using types from parent or redefining for component stability
interface HoldingImpactTrace {
    holdingId: string;
    symbol: string;
    holdingCurrentValue: number;
    sensitivityUsed: number;
    sensitivitySource: string;
    magnitudePct: number;
    impactValue: number;
    impactPct: number;
    directionSign: number;
    pricesAsOf: string;
}

interface EventImpactResult {
    eventId: string;
    eventTitle: string;
    topGainers: HoldingImpactTrace[];
    topLosers: HoldingImpactTrace[];
}

interface ShockLinkageViewProps {
    events: EventImpactResult[];
}

export function ShockLinkageView({ events }: ShockLinkageViewProps) {
    const [selectedCell, setSelectedCell] = useState<{ eventId: string, holdingId: string } | null>(null);

    // 1. Identify all unique holdings that appear in top gainers/losers across all events
    const uniqueHoldingsMap = new Map<string, { symbol: string, value: number }>();

    events.forEach(event => {
        [...event.topGainers, ...event.topLosers].forEach(h => {
            if (!uniqueHoldingsMap.has(h.holdingId)) {
                uniqueHoldingsMap.set(h.holdingId, {
                    symbol: h.symbol,
                    value: h.holdingCurrentValue
                });
            }
        });
    });

    // Sort holdings by symbol (or could be by total impact)
    const holdings = Array.from(uniqueHoldingsMap.entries()).map(([id, data]) => ({
        id,
        ...data
    })).sort((a, b) => a.symbol.localeCompare(b.symbol));

    // Helper to find impact for a specific cell
    const getImpact = (eventId: string, holdingId: string): HoldingImpactTrace | undefined => {
        const event = events.find(e => e.eventId === eventId);
        if (!event) return undefined;
        return [...event.topGainers, ...event.topLosers].find(h => h.holdingId === holdingId);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Event Shock Linkage <span className="text-sm font-normal text-slate-500 ml-2">(Top Impacted Holdings)</span></CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[150px] sticky left-0 bg-white z-10 font-bold">Holding</TableHead>
                            {events.map(event => (
                                <TableHead key={event.eventId} className="min-w-[200px] text-center">
                                    <div className="flex flex-col items-center">
                                        <span className="font-semibold text-slate-900 line-clamp-2 h-10 flex items-center">{event.eventTitle}</span>
                                    </div>
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {holdings.map(holding => (
                            <TableRow key={holding.id}>
                                <TableCell className="font-medium sticky left-0 bg-white z-10 border-r">
                                    <div>
                                        {holding.symbol}
                                        <div className="text-xs text-slate-500 font-normal">
                                            ₹{holding.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                        </div>
                                    </div>
                                </TableCell>
                                {events.map(event => {
                                    const impact = getImpact(event.eventId, holding.id);

                                    if (!impact) {
                                        return (
                                            <TableCell key={event.eventId} className="text-center text-slate-300">
                                                -
                                            </TableCell>
                                        );
                                    }

                                    const isNegative = impact.impactValue < 0;
                                    const bgColor = isNegative ? 'bg-red-50 hover:bg-red-100' : 'bg-emerald-50 hover:bg-emerald-100';
                                    const textColor = isNegative ? 'text-red-700' : 'text-emerald-700';

                                    return (
                                        <TableCell key={event.eventId} className="p-1">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <div
                                                        className={cn(
                                                            "h-full w-full p-2 rounded cursor-pointer transition-colors text-center",
                                                            bgColor
                                                        )}
                                                    >
                                                        <div className={cn("font-bold", textColor)}>
                                                            {isNegative ? '' : '+'}
                                                            ₹{Math.abs(impact.impactValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                        </div>
                                                        <div className={cn("text-xs opacity-80", textColor)}>
                                                            {(impact.impactPct * 100).toFixed(2)}%
                                                        </div>
                                                    </div>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-xs">
                                                    <DialogHeader>
                                                        <DialogTitle className="text-sm">Impact Formula</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-3 pt-2">
                                                        <div className="text-sm border-b pb-2">
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-500">Holding Value</span>
                                                                <span className="font-mono">₹{impact.holdingCurrentValue.toLocaleString()}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-center text-slate-400 text-xs">×</div>

                                                        <div className="text-sm border-b pb-2">
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-500">Event Magnitude</span>
                                                                <span className="font-mono text-blue-600 font-bold">{impact.magnitudePct > 0 ? '+' : ''}{impact.magnitudePct}%</span>
                                                            </div>
                                                            <div className="flex justify-between mt-1 text-xs">
                                                                <span className="text-slate-400">Direction Sign</span>
                                                                <span className="font-mono">{impact.directionSign > 0 ? '+1' : (impact.directionSign < 0 ? '-1' : '0')}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-center text-slate-400 text-xs">×</div>

                                                        <div className="text-sm border-b pb-2">
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-500">Sensitivity</span>
                                                                <span className="font-mono font-bold text-purple-600">{impact.sensitivityUsed.toFixed(2)}</span>
                                                            </div>
                                                            <div className="text-xs text-slate-400 mt-1 text-right italic">
                                                                Source: {impact.sensitivitySource}
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-center text-slate-400 text-xs">=</div>

                                                        <div className="text-lg font-bold text-center">
                                                            <span className={impact.impactValue < 0 ? "text-red-600" : "text-emerald-600"}>
                                                                {impact.impactValue < 0 ? '-' : '+'}₹{Math.abs(impact.impactValue).toLocaleString()}
                                                            </span>
                                                        </div>

                                                        <div className="text-[10px] text-center text-slate-400 pt-2">
                                                            Prices as of {new Date(impact.pricesAsOf).toLocaleString()}
                                                        </div>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {holdings.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                        No significant holding impacts found for these events.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
