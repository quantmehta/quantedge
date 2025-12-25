
'use client';
import { useState, useMemo, useEffect } from 'react';
import { Recommendation } from '@/lib/recommendations/RecommendationContracts';
import {
    TrendingUp, TrendingDown, Minus, Activity, Target, ShieldAlert, CheckCircle, AlertTriangle
} from 'lucide-react';

interface Props {
    initialData: Recommendation[];
}

export function RecommendationsView({ initialData }: Props) {
    const [filter, setFilter] = useState<string>('ALL');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [overrideModal, setOverrideModal] = useState<{
        open: boolean;
        recommendationId: string | null;
        ruleCode: string | null;
    }>({ open: false, recommendationId: null, ruleCode: null });
    const [overrideForm, setOverrideForm] = useState({ actor: '', reason: '' });
    const [overriddenRecs, setOverriddenRecs] = useState<Set<string>>(new Set());

    useEffect(() => {
        const name = localStorage.getItem('operatorName') || 'Operator';
        setOverrideForm((prev) => ({ ...prev, actor: name }));
    }, []);

    // Calculate Stats
    const stats = useMemo(() => {
        const buy = initialData.filter(r => ['BUY', 'DIVERSIFY'].includes(r.type)).length;
        const sell = initialData.filter(r => ['EXIT', 'REDUCE'].includes(r.type)).length;
        const hold = initialData.filter(r => r.type === 'HOLD').length;
        return { buy, sell, hold };
    }, [initialData]);

    const filteredData = useMemo(() => {
        if (filter === 'ALL') return initialData;
        if (filter === 'BUY') return initialData.filter(r => ['BUY', 'DIVERSIFY'].includes(r.type));
        if (filter === 'SELL') return initialData.filter(r => ['EXIT', 'REDUCE'].includes(r.type));
        return initialData.filter(r => r.type === filter);
    }, [initialData, filter]);

    const getActionColor = (type: string) => {
        switch (type) {
            case 'BUY':
            case 'DIVERSIFY': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
            case 'EXIT': return 'text-red-400 bg-red-400/10 border-red-400/20';
            case 'REDUCE': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
            default: return 'text-neutral-400 bg-neutral-800 border-neutral-700';
        }
    };

    const getActionIcon = (type: string) => {
        switch (type) {
            case 'BUY': return <TrendingUp className="w-4 h-4" />;
            case 'DIVERSIFY': return <Activity className="w-4 h-4" />;
            case 'EXIT': return <Target className="w-4 h-4" />;
            case 'REDUCE': return <TrendingDown className="w-4 h-4" />;
            default: return <Minus className="w-4 h-4" />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard label="Buy Opportunities" value={stats.buy} color="text-emerald-400" />
                <MetricCard label="Reduce / Exit Actions" value={stats.sell} color="text-orange-400" />
                <MetricCard label="Hold Positions" value={stats.hold} color="text-neutral-400" />
            </div>

            {/* Filter Bar */}
            <div className="flex gap-2 border-b border-neutral-800 pb-4">
                <FilterButton label="All" active={filter === 'ALL'} onClick={() => setFilter('ALL')} />
                <FilterButton label="Buys" active={filter === 'BUY'} onClick={() => setFilter('BUY')} />
                <FilterButton label="Sells" active={filter === 'SELL'} onClick={() => setFilter('SELL')} />
                <FilterButton label="Holds" active={filter === 'HOLD'} onClick={() => setFilter('HOLD')} />
            </div>

            {/* Table */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden backdrop-blur-sm">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-400 text-sm">
                            <th className="p-4 font-medium">Action</th>
                            <th className="p-4 font-medium">Instrument</th>
                            <th className="p-4 font-medium">Reasoning</th>
                            <th className="p-4 font-medium text-right">Confidence</th>
                            <th className="p-4 font-medium text-right">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                        {filteredData.map(rec => (
                            <>
                                <tr key={rec.id}
                                    onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                                    className="hover:bg-neutral-800/50 cursor-pointer transition-colors group"
                                >
                                    <td className="p-4">
                                        <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold border ${getActionColor(rec.type)}`}>
                                            {getActionIcon(rec.type)}
                                            {rec.type}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-medium text-neutral-200">{rec.target.symbol}</div>
                                        <div className="text-xs text-neutral-500">{rec.target.name}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="text-sm text-neutral-300 line-clamp-1">{rec.rationale.summary}</div>
                                        {rec.rules.violations.length > 0 && (
                                            <div className="flex items-center gap-1 text-xs text-red-400 mt-1">
                                                <ShieldAlert className="w-3 h-3" />
                                                Breached: {rec.rules.violations[0]}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="inline-flex items-center justify-end gap-2">
                                            <div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${rec.confidence * 100}%` }} />
                                            </div>
                                            <span className="text-xs font-mono text-neutral-500">{(rec.confidence * 100).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className="text-xs text-neutral-600 group-hover:text-blue-400 transition-colors">
                                            {expandedId === rec.id ? 'Close' : 'View'}
                                        </span>
                                    </td>
                                </tr>
                                {expandedId === rec.id && (
                                    <tr className="bg-neutral-900/30">
                                        <td colSpan={5} className="p-0">
                                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-neutral-800 animate-in slide-in-from-top-2 duration-200">
                                                <div className="space-y-4">
                                                    <h4 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                                                        <Activity className="w-4 h-4" /> Analysis Drivers
                                                    </h4>
                                                    <ul className="space-y-2">
                                                        {rec.rationale.drivers.map((d, i) => (
                                                            <li key={i} className="flex items-start gap-2 text-sm text-neutral-300">
                                                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                                {d}
                                                            </li>
                                                        ))}
                                                    </ul>

                                                    <div className="pt-4">
                                                        <div className="text-xs font-mono text-neutral-500 bg-neutral-950 p-3 rounded border border-neutral-800">
                                                            {JSON.stringify(rec.trace.signalScores, null, 2)}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <h4 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                                                        <Target className="w-4 h-4" /> Proposed Action
                                                    </h4>
                                                    <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4">
                                                        <div className="text-lg font-medium text-neutral-200">{rec.action.description}</div>
                                                        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-neutral-800">
                                                            <div>
                                                                <div className="text-xs text-neutral-500">Weight Delta</div>
                                                                <div className={`font-mono font-medium ${rec.action.weightDelta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                    {rec.action.weightDelta > 0 ? '+' : ''}{(rec.action.weightDelta * 100).toFixed(2)}%
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-xs text-neutral-500">Target</div>
                                                                <div className="font-mono font-medium text-neutral-300">
                                                                    {(rec.action.suggestedWeight * 100).toFixed(2)}%
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2 pt-2">
                                                        {rec.rules.passed || overriddenRecs.has(rec.id) ? (
                                                            <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-400/5 px-3 py-1.5 rounded-full border border-emerald-400/10">
                                                                <CheckCircle className="w-3 h-3" /> {overriddenRecs.has(rec.id) ? 'Overridden' : 'Compliant with Ruleset'}
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/5 px-3 py-1.5 rounded-full border border-red-400/10">
                                                                    <AlertTriangle className="w-3 h-3" /> Violation Detected
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        setOverrideModal({
                                                                            open: true,
                                                                            recommendationId: rec.id,
                                                                            ruleCode: rec.rules.violations[0] || 'UNKNOWN',
                                                                        });
                                                                    }}
                                                                    className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 rounded-full text-xs font-medium transition-colors"
                                                                >
                                                                    Override
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </>
                        ))}
                        {filteredData.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-neutral-500 italic">
                                    No recommendations found matching filter.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Override Modal */}
            {overrideModal.open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-bold mb-4">Override Rule Violation</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-neutral-400 mb-2">Rule Code</label>
                                <input
                                    type="text"
                                    value={overrideModal.ruleCode || ''}
                                    disabled
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-neutral-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-neutral-400 mb-2">Actor</label>
                                <input
                                    type="text"
                                    value={overrideForm.actor}
                                    onChange={(e) => setOverrideForm({ ...overrideForm, actor: e.target.value })}
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-neutral-100"
                                    placeholder="Your name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-neutral-400 mb-2">Reason (min 10 chars)</label>
                                <textarea
                                    value={overrideForm.reason}
                                    onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-neutral-100 h-24"
                                    placeholder="Why is this override necessary?"
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={async () => {
                                        if (overrideForm.reason.length < 10) {
                                            alert('Reason must be at least 10 characters');
                                            return;
                                        }
                                        // Submit override
                                        const res = await fetch('/api/overrides', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                runId: 'PLACEHOLDER_RUN_ID',
                                                recommendationId: overrideModal.recommendationId,
                                                ruleCode: overrideModal.ruleCode,
                                                ruleSeverity: 'HARD',
                                                reason: overrideForm.reason,
                                                actor: overrideForm.actor,
                                            }),
                                        });
                                        const json = await res.json();
                                        if (json.ok) {
                                            setOverriddenRecs((prev) => new Set(prev).add(overrideModal.recommendationId!));
                                            setOverrideModal({ open: false, recommendationId: null, ruleCode: null });
                                            setOverrideForm({ ...overrideForm, reason: '' });
                                            alert('Override logged successfully');
                                        } else {
                                            alert(`Error: ${json.error}`);
                                        }
                                    }}
                                    className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 rounded font-medium transition-colors"
                                >
                                    Submit Override
                                </button>
                                <button
                                    onClick={() => {
                                        setOverrideModal({ open: false, recommendationId: null, ruleCode: null });
                                        setOverrideForm({ ...overrideForm, reason: '' });
                                    }}
                                    className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 rounded font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MetricCard({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div className="bg-neutral-900/50 border border-neutral-800 p-4 rounded-xl backdrop-blur-md">
            <div className="text-sm text-neutral-500">{label}</div>
            <div className={`text-3xl font-bold mt-1 ${color}`}>{value}</div>
        </div>
    );
}

function FilterButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${active
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
                }`}
        >
            {label}
        </button>
    );
}
