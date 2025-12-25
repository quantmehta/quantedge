"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
    Calendar, AlertCircle, TrendingUp, TrendingDown, Minus,
    Plus, RefreshCw, AlertTriangle, ChevronRight, X, Loader2
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ShockLinkageView } from "./shock-linkage-view";

// Types from event-types.ts (inline for client component)
interface EventItem {
    id: string;
    title: string;
    category: string;
    direction: string;
    magnitudePct: number;
    confidence: number;
    horizon: string;
    affectedScope: { type: string; value: string };
    observedAt: string;
}

interface EventImpactResult {
    eventId: string;
    eventTitle: string;
    portfolioImpactPct: number;
    portfolioImpactValue: number;
    pnlAtRiskValue: number;
    affectedHoldingsCount: number;
    topGainers: any[];
    topLosers: any[];
}

interface ImpactSummary {
    portfolioCurrentValue: number;
    totalPnlAtRisk: number;
    totalEventsProcessed: number;
    topEventsByRisk: EventImpactResult[];
    pricesAsOf: string;
}

const CATEGORIES = ['All', 'MACRO', 'GEOPOLITICAL', 'SECTOR', 'COMPANY'] as const;
const HORIZONS = ['All', '1W', '1M', '3M', '6M'] as const;

export default function EventsPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <Loader2 className="w-12 h-12 text-slate-300 animate-spin mb-4" />
                <p className="text-slate-500">Loading...</p>
            </div>
        }>
            <EventsPageContent />
        </Suspense>
    );
}

function EventsPageContent() {
    const searchParams = useSearchParams();
    const urlRunId = searchParams.get("runId");

    const [activeRunId, setActiveRunId] = useState<string | null>(urlRunId);
    const [isLoadingRun, setIsLoadingRun] = useState(!urlRunId);
    const [events, setEvents] = useState<EventItem[]>([]);
    const [impactSummary, setImpactSummary] = useState<ImpactSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isComputing, setIsComputing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [categoryFilter, setCategoryFilter] = useState<string>('All');
    const [horizonFilter, setHorizonFilter] = useState<string>('All');
    const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [viewMode, setViewMode] = useState<'LIST' | 'MATRIX'>('LIST');

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
                .catch(err => console.error('Events latest run fetch failed', err))
                .finally(() => setIsLoadingRun(false));
        }
    }, [urlRunId]);

    // Fetch events
    const fetchEvents = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/events/manage');
            const data = await res.json();
            if (data.ok) {
                setEvents(data.data.events || []);
            } else {
                setError(data.error?.message || 'Failed to fetch events');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Compute impacts
    const computeImpacts = async () => {
        if (!activeRunId) return;
        setIsComputing(true);
        try {
            const res = await fetch(`/api/events/run?runId=${activeRunId}`, { method: 'POST' });
            const data = await res.json();
            if (data.ok) {
                setImpactSummary(data.data.summary);
            } else {
                setError(data.error?.message || 'Failed to compute impacts');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsComputing(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    useEffect(() => {
        if (activeRunId && events.length > 0) {
            computeImpacts();
        }
    }, [activeRunId, events.length]);

    // Filter events
    const filteredEvents = events.filter(e => {
        if (categoryFilter !== 'All' && e.category !== categoryFilter) return false;
        if (horizonFilter !== 'All' && e.horizon !== horizonFilter) return false;
        return true;
    });

    // Get impact for an event
    const getEventImpact = (eventId: string): EventImpactResult | undefined => {
        return impactSummary?.topEventsByRisk.find(r => r.eventId === eventId);
    };

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
            <div className="p-8 text-center text-slate-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-400" />
                <p>Please upload a portfolio first to view event impacts.</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                        Event Intelligence
                    </h1>
                    <p className="text-slate-500">
                        Market events and their impact on your portfolio
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={computeImpacts}
                        disabled={isComputing}
                    >
                        <RefreshCw className={cn("w-4 h-4 mr-2", isComputing && "animate-spin")} />
                        Refresh Impacts
                    </Button>
                    <Button onClick={() => setShowAddModal(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Event
                    </Button>
                </div>
            </div>

            {/* PnL-at-Risk Summary */}
            {impactSummary && (
                <Card className="bg-gradient-to-r from-red-50 to-amber-50 border-red-200">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-red-600 font-medium">Portfolio PnL-at-Risk</p>
                                <p className="text-3xl font-bold text-red-700">
                                    ₹{impactSummary.totalPnlAtRisk.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    Confidence-weighted downside estimate from {impactSummary.totalEventsProcessed} events
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-slate-500">Portfolio Value</p>
                                <p className="text-xl font-semibold text-slate-700">
                                    ₹{impactSummary.portfolioCurrentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
                <div className="flex gap-2 items-center">
                    <span className="text-sm text-slate-500">Category:</span>
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                                categoryFilter === cat
                                    ? "bg-slate-900 text-white"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2 items-center">
                    <span className="text-sm text-slate-500">Horizon:</span>
                    {HORIZONS.map(h => (
                        <button
                            key={h}
                            onClick={() => setHorizonFilter(h)}
                            className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                                horizonFilter === h
                                    ? "bg-slate-900 text-white"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}
                        >
                            {h}
                        </button>
                    ))}
                </div>
            </div>



            {/* View API Toggle */}
            <div className="bg-slate-100 p-1 rounded-lg inline-flex">
                <button
                    onClick={() => setViewMode('LIST')}
                    className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                        viewMode === 'LIST' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    List View
                </button>
                <button
                    onClick={() => setViewMode('MATRIX')}
                    className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                        viewMode === 'MATRIX' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    Shock Matrix
                </button>
            </div>


            {/* Content Area */}
            {
                viewMode === 'MATRIX' && impactSummary ? (
                    <ShockLinkageView events={impactSummary.topEventsByRisk} />
                ) : (
                    /* Events List */
                    isLoading ? (
                        <div className="text-center py-12">Loading events...</div>
                    ) : error ? (
                        <div className="text-center py-12 text-red-500">{error}</div>
                    ) : (
                        <div className="space-y-3">
                            {filteredEvents.map(evt => {
                                const impact = getEventImpact(evt.id);
                                return (
                                    <Card
                                        key={evt.id}
                                        className="hover:shadow-md transition-shadow cursor-pointer"
                                        onClick={() => setSelectedEvent(evt)}
                                    >
                                        <CardContent className="p-5 flex items-center gap-4">
                                            {/* Direction Indicator */}
                                            <div className={cn(
                                                "w-12 h-12 rounded-lg flex items-center justify-center",
                                                evt.direction === 'POSITIVE' && "bg-emerald-100",
                                                evt.direction === 'NEGATIVE' && "bg-red-100",
                                                evt.direction === 'MIXED' && "bg-slate-100"
                                            )}>
                                                {evt.direction === 'POSITIVE' && <TrendingUp className="text-emerald-600" />}
                                                {evt.direction === 'NEGATIVE' && <TrendingDown className="text-red-600" />}
                                                {evt.direction === 'MIXED' && <Minus className="text-slate-600" />}
                                            </div>

                                            {/* Event Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold text-slate-900 truncate">{evt.title}</h3>
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                                        evt.category === 'MACRO' && "bg-blue-100 text-blue-700",
                                                        evt.category === 'SECTOR' && "bg-purple-100 text-purple-700",
                                                        evt.category === 'COMPANY' && "bg-emerald-100 text-emerald-700",
                                                        evt.category === 'GEOPOLITICAL' && "bg-amber-100 text-amber-700"
                                                    )}>
                                                        {evt.category}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                                    <span>Magnitude: {evt.magnitudePct > 0 ? '+' : ''}{evt.magnitudePct}%</span>
                                                    <span>Confidence: {(evt.confidence * 100).toFixed(0)}%</span>
                                                    <span>Horizon: {evt.horizon}</span>
                                                    <span>{evt.affectedScope.type}: {evt.affectedScope.value}</span>
                                                </div>
                                            </div>

                                            {/* Impact */}
                                            {impact && (
                                                <div className="text-right">
                                                    <p className="text-xs text-slate-400">PnL-at-Risk</p>
                                                    <p className={cn(
                                                        "font-bold",
                                                        impact.pnlAtRiskValue > 0 ? "text-red-600" : "text-slate-600"
                                                    )}>
                                                        ₹{impact.pnlAtRiskValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                    </p>
                                                </div>
                                            )}

                                            <ChevronRight className="text-slate-300" />
                                        </CardContent>
                                    </Card>
                                );
                            })}

                            {filteredEvents.length === 0 && (
                                <div className="text-center py-12 text-slate-400">
                                    No events found. Click "Add Event" to create one.
                                </div>
                            )}
                        </div>
                    )
                )
            }

            {/* Event Detail Drawer */}
            {
                selectedEvent && (
                    <EventDetailDrawer
                        event={selectedEvent}
                        impact={getEventImpact(selectedEvent.id)}
                        pricesAsOf={impactSummary?.pricesAsOf}
                        onClose={() => setSelectedEvent(null)}
                    />
                )
            }

            {/* Add Event Modal */}
            {
                showAddModal && (
                    <AddEventModal
                        onClose={() => setShowAddModal(false)}
                        onCreated={() => {
                            setShowAddModal(false);
                            fetchEvents();
                        }}
                    />
                )
            }
        </div >
    );
}

// Event Detail Drawer Component
function EventDetailDrawer({
    event,
    impact,
    pricesAsOf,
    onClose
}: {
    event: EventItem;
    impact?: EventImpactResult;
    pricesAsOf?: string;
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/30" onClick={onClose} />
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-xl overflow-y-auto">
                <div className="p-6 border-b sticky top-0 bg-white flex justify-between items-center">
                    <h2 className="text-xl font-bold">Event Details</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <h3 className="text-2xl font-bold text-slate-900">{event.title}</h3>
                        <div className="flex gap-2 mt-2">
                            <span className={cn(
                                "px-2 py-1 rounded text-xs font-bold uppercase",
                                event.category === 'MACRO' && "bg-blue-100 text-blue-700",
                                event.category === 'SECTOR' && "bg-purple-100 text-purple-700",
                                event.category === 'COMPANY' && "bg-emerald-100 text-emerald-700",
                                event.category === 'GEOPOLITICAL' && "bg-amber-100 text-amber-700"
                            )}>
                                {event.category}
                            </span>
                            <span className={cn(
                                "px-2 py-1 rounded text-xs font-bold",
                                event.direction === 'POSITIVE' && "bg-emerald-100 text-emerald-700",
                                event.direction === 'NEGATIVE' && "bg-red-100 text-red-700",
                                event.direction === 'MIXED' && "bg-slate-100 text-slate-700"
                            )}>
                                {event.direction}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-lg">
                            <p className="text-xs text-slate-500">Magnitude</p>
                            <p className="text-2xl font-bold">{event.magnitudePct > 0 ? '+' : ''}{event.magnitudePct}%</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg">
                            <p className="text-xs text-slate-500">Confidence</p>
                            <p className="text-2xl font-bold">{(event.confidence * 100).toFixed(0)}%</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg">
                            <p className="text-xs text-slate-500">Horizon</p>
                            <p className="text-2xl font-bold">{event.horizon}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg">
                            <p className="text-xs text-slate-500">Affected Scope</p>
                            <p className="text-lg font-bold">{event.affectedScope.type}</p>
                            <p className="text-sm text-slate-500">{event.affectedScope.value}</p>
                        </div>
                    </div>

                    {impact && (
                        <>
                            <div className="border-t pt-6">
                                <h4 className="font-bold text-lg mb-4">Computed Impact</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-red-50 p-4 rounded-lg">
                                        <p className="text-xs text-red-600">PnL-at-Risk</p>
                                        <p className="text-2xl font-bold text-red-700">
                                            ₹{impact.pnlAtRiskValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-lg">
                                        <p className="text-xs text-slate-500">Portfolio Impact</p>
                                        <p className="text-2xl font-bold">
                                            {(impact.portfolioImpactPct * 100).toFixed(2)}%
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {impact.topLosers.length > 0 && (
                                <div>
                                    <h4 className="font-bold mb-3">Most Impacted Holdings</h4>
                                    <div className="space-y-2">
                                        {impact.topLosers.slice(0, 5).map((h, i) => (
                                            <div key={i} className="flex justify-between items-center p-3 bg-red-50 rounded">
                                                <div>
                                                    <p className="font-medium">{h.symbol}</p>
                                                    <p className="text-xs text-slate-500">
                                                        Sensitivity: {h.sensitivityUsed.toFixed(2)} ({h.sensitivitySource})
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-red-600">
                                                        ₹{h.impactValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {(h.impactPct * 100).toFixed(2)}%
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <div className="text-xs text-slate-400 flex justify-between">
                        <p>Observed: {new Date(event.observedAt).toLocaleString()}</p>
                        {pricesAsOf && <p>Prices as of: {new Date(pricesAsOf).toLocaleString()}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Add Event Modal Component
function AddEventModal({
    onClose,
    onCreated
}: {
    onClose: () => void;
    onCreated: () => void;
}) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        title: '',
        category: 'MACRO',
        direction: 'NEGATIVE',
        magnitudePct: -2,
        confidence: 0.7,
        horizon: '1M',
        scopeType: 'BENCHMARK',
        scopeValue: 'NSE_NIFTY'
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const res = await fetch('/api/events/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: form.title,
                    category: form.category,
                    direction: form.direction,
                    magnitudePct: form.magnitudePct,
                    confidence: form.confidence,
                    horizon: form.horizon,
                    affectedScope: {
                        type: form.scopeType,
                        value: form.scopeValue
                    },
                    observedAt: new Date().toISOString()
                })
            });
            const data = await res.json();
            if (data.ok) {
                onCreated();
            } else {
                setError(data.error?.message || 'Failed to create event');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <h2 className="text-xl font-bold mb-4">Add Market Event</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Title</label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="e.g., RBI Rate Decision"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Category</label>
                            <select
                                value={form.category}
                                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                className="w-full px-3 py-2 border rounded-lg"
                            >
                                <option value="MACRO">Macro</option>
                                <option value="GEOPOLITICAL">Geopolitical</option>
                                <option value="SECTOR">Sector</option>
                                <option value="COMPANY">Company</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Direction</label>
                            <select
                                value={form.direction}
                                onChange={e => setForm(f => ({ ...f, direction: e.target.value }))}
                                className="w-full px-3 py-2 border rounded-lg"
                            >
                                <option value="POSITIVE">Positive</option>
                                <option value="NEGATIVE">Negative</option>
                                <option value="MIXED">Mixed</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Magnitude (%)</label>
                            <input
                                type="number"
                                value={form.magnitudePct}
                                onChange={e => setForm(f => ({ ...f, magnitudePct: parseFloat(e.target.value) }))}
                                className="w-full px-3 py-2 border rounded-lg"
                                step="0.5"
                                min="-30"
                                max="30"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Confidence (0-1)</label>
                            <input
                                type="number"
                                value={form.confidence}
                                onChange={e => setForm(f => ({ ...f, confidence: parseFloat(e.target.value) }))}
                                className="w-full px-3 py-2 border rounded-lg"
                                step="0.1"
                                min="0"
                                max="1"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Horizon</label>
                            <select
                                value={form.horizon}
                                onChange={e => setForm(f => ({ ...f, horizon: e.target.value }))}
                                className="w-full px-3 py-2 border rounded-lg"
                            >
                                <option value="1W">1 Week</option>
                                <option value="1M">1 Month</option>
                                <option value="3M">3 Months</option>
                                <option value="6M">6 Months</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Scope Type</label>
                            <select
                                value={form.scopeType}
                                onChange={e => setForm(f => ({ ...f, scopeType: e.target.value }))}
                                className="w-full px-3 py-2 border rounded-lg"
                            >
                                <option value="BENCHMARK">Benchmark</option>
                                <option value="SECTOR">Sector</option>
                                <option value="INSTRUMENT">Instrument</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Scope Value</label>
                        <input
                            type="text"
                            value={form.scopeValue}
                            onChange={e => setForm(f => ({ ...f, scopeValue: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="e.g., NSE_NIFTY, Technology, RELIANCE"
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="flex-1">
                            {isSubmitting ? 'Creating...' : 'Create Event'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
