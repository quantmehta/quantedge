'use client';
import { useState, useEffect } from 'react';
import { getTemplate, RiskProfile, RulesetDefinition } from '@/lib/rules/RulesTemplates';
import { Settings, TrendingUp, Shield, AlertTriangle, CheckCircle } from 'lucide-react';

interface Ruleset {
    id: string;
    name: string;
    description: string | null;
    versions: RulesetVersion[];
}

interface RulesetVersion {
    id: string;
    version: number;
    definitionJson: string;
    isActive: boolean;
    createdAt: string;
}

export default function RulesPage() {
    const [rulesets, setRulesets] = useState<Ruleset[]>([]);
    const [selectedRuleset, setSelectedRuleset] = useState<Ruleset | null>(null);
    const [selectedProfile, setSelectedProfile] = useState<RiskProfile>('BALANCED');
    const [formData, setFormData] = useState<RulesetDefinition>(getTemplate('BALANCED'));
    const [versions, setVersions] = useState<RulesetVersion[]>([]);
    const [loading, setLoading] = useState(false);
    const [operatorName, setOperatorName] = useState('');

    useEffect(() => {
        // Load operator name from localStorage
        const name = localStorage.getItem('operatorName') || '';
        setOperatorName(name);
        loadRulesets();
    }, []);

    async function loadRulesets() {
        const res = await fetch('/api/rulesets');
        const json = await res.json();
        if (json.ok) {
            setRulesets(json.data);
            if (json.data.length > 0) {
                selectRuleset(json.data[0]);
            }
        }
    }

    async function selectRuleset(ruleset: Ruleset) {
        setSelectedRuleset(ruleset);
        const res = await fetch(`/api/rulesets/${ruleset.id}/versions`);
        const json = await res.json();
        if (json.ok) {
            setVersions(json.data);
            const active = json.data.find((v: RulesetVersion) => v.isActive);
            if (active) {
                const def = JSON.parse(active.definitionJson);
                setFormData(def);
                setSelectedProfile(def.profile);
            }
        }
    }

    async function createRuleset() {
        const name = prompt('Enter ruleset name:');
        if (!name) return;

        const res = await fetch('/api/rulesets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description: '' }),
        });

        const json = await res.json();
        if (json.ok) {
            await loadRulesets();
        }
    }

    async function saveVersion() {
        if (!selectedRuleset) {
            alert('Please select a ruleset first');
            return;
        }

        setLoading(true);
        const res = await fetch(`/api/rulesets/${selectedRuleset.id}/versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ definitionJson: formData }),
        });

        const json = await res.json();
        if (json.ok) {
            await selectRuleset(selectedRuleset);
            alert('Version created successfully');
        } else {
            alert(`Error: ${json.error}`);
        }
        setLoading(false);
    }

    async function activateVersion(versionId: string) {
        if (!selectedRuleset) return;

        const res = await fetch(`/api/rulesets/${selectedRuleset.id}/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rulesetVersionId: versionId }),
        });

        const json = await res.json();
        if (json.ok) {
            await selectRuleset(selectedRuleset);
            alert('Version activated');
        } else {
            alert(`Error: ${json.error}`);
        }
    }

    function loadTemplate(profile: RiskProfile) {
        setSelectedProfile(profile);
        const template = getTemplate(profile);
        setFormData({ ...template, meta: { ...template.meta, createdBy: operatorName } });
    }

    function updateHard(field: string, value: number) {
        setFormData({
            ...formData,
            hard: { ...formData.hard, [field]: value },
        });
    }

    function updateSoft(field: string, key: 'value' | 'weight', value: number) {
        setFormData({
            ...formData,
            soft: {
                ...formData.soft,
                [field]: { ...formData.soft[field as keyof typeof formData.soft], [key]: value },
            },
        });
    }

    return (
        <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8 space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                        Rules Engine
                    </h1>
                    <p className="text-neutral-400 mt-1">Define constraints and risk parameters for your portfolio</p>
                </div>
                <button
                    onClick={createRuleset}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                >
                    + New Ruleset
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Ruleset Selector */}
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">
                        Rulesets
                    </h3>
                    <div className="space-y-2">
                        {rulesets.map((rs) => (
                            <button
                                key={rs.id}
                                onClick={() => selectRuleset(rs)}
                                className={`w-full text-left p-3 rounded-lg transition-colors ${selectedRuleset?.id === rs.id
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                                    }`}
                            >
                                <div className="font-medium">{rs.name}</div>
                                {rs.versions[0] && (
                                    <div className="text-xs mt-1 opacity-70">v{rs.versions[0].version} (Active)</div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Middle: Form */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Template Selector */}
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
                        <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">
                            Template
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            {(['CONSERVATIVE', 'BALANCED', 'GROWTH'] as RiskProfile[]).map((profile) => (
                                <button
                                    key={profile}
                                    onClick={() => loadTemplate(profile)}
                                    className={`p-3 rounded-lg border transition-all ${selectedProfile === profile
                                            ? 'bg-blue-600 border-blue-500 text-white'
                                            : 'bg-neutral-800 border-neutral-700 hover:border-neutral-600 text-neutral-300'
                                        }`}
                                >
                                    {profile}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Hard Constraints */}
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Shield className="w-5 h-5 text-red-400" />
                            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
                                Hard Constraints
                            </h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                label="Max Drawdown"
                                value={formData.hard.maxDrawdownPct * 100}
                                onChange={(v) => updateHard('maxDrawdownPct', v / 100)}
                                unit="%"
                            />
                            <FormField
                                label="Max Volatility"
                                value={formData.hard.maxVolatilityAnnualPct * 100}
                                onChange={(v) => updateHard('maxVolatilityAnnualPct', v / 100)}
                                unit="%"
                            />
                            <FormField
                                label="Max Single Asset Weight"
                                value={formData.hard.maxSingleAssetWeightPct * 100}
                                onChange={(v) => updateHard('maxSingleAssetWeightPct', v / 100)}
                                unit="%"
                            />
                            <FormField
                                label="Max Sector Weight"
                                value={formData.hard.maxSectorWeightPct * 100}
                                onChange={(v) => updateHard('maxSectorWeightPct', v / 100)}
                                unit="%"
                            />
                        </div>
                    </div>

                    {/* Soft Goals */}
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-5 h-5 text-emerald-400" />
                            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
                                Soft Goals
                            </h3>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    label="Min Expected CAGR"
                                    value={formData.soft.minExpectedCagrPct.value * 100}
                                    onChange={(v) => updateSoft('minExpectedCagrPct', 'value', v / 100)}
                                    unit="%"
                                />
                                <FormField
                                    label="Weight"
                                    value={formData.soft.minExpectedCagrPct.weight * 100}
                                    onChange={(v) => updateSoft('minExpectedCagrPct', 'weight', v / 100)}
                                    unit="%"
                                    max={100}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    label="Growth Target"
                                    value={formData.soft.growthTargetPct.value * 100}
                                    onChange={(v) => updateSoft('growthTargetPct', 'value', v / 100)}
                                    unit="%"
                                />
                                <FormField
                                    label="Weight"
                                    value={formData.soft.growthTargetPct.weight * 100}
                                    onChange={(v) => updateSoft('growthTargetPct', 'weight', v / 100)}
                                    unit="%"
                                    max={100}
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={saveVersion}
                        disabled={loading || !selectedRuleset}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                    >
                        {loading ? 'Saving...' : 'Save New Version'}
                    </button>
                </div>
            </div>

            {/* Version History */}
            {selectedRuleset && (
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">
                        Version History
                    </h3>
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-neutral-800 text-neutral-400 text-sm">
                                <th className="p-3 font-medium">Version</th>
                                <th className="p-3 font-medium">Created</th>
                                <th className="p-3 font-medium">Profile</th>
                                <th className="p-3 font-medium">Status</th>
                                <th className="p-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800">
                            {versions.map((v) => {
                                const def = JSON.parse(v.definitionJson);
                                return (
                                    <tr key={v.id} className="hover:bg-neutral-800/50">
                                        <td className="p-3 font-mono">v{v.version}</td>
                                        <td className="p-3 text-sm text-neutral-400">
                                            {new Date(v.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="p-3">
                                            <span className="px-2 py-1 bg-neutral-800 rounded text-xs">
                                                {def.profile}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            {v.isActive ? (
                                                <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                                                    <CheckCircle className="w-3 h-3" /> Active
                                                </span>
                                            ) : (
                                                <span className="text-neutral-500 text-xs">Inactive</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-right">
                                            {!v.isActive && (
                                                <button
                                                    onClick={() => activateVersion(v.id)}
                                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition-colors"
                                                >
                                                    Set Active
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </main>
    );
}

function FormField({
    label,
    value,
    onChange,
    unit,
    max = 100,
}: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    unit: string;
    max?: number;
}) {
    return (
        <div>
            <label className="block text-sm text-neutral-400 mb-2">{label}</label>
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    value={value.toFixed(1)}
                    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                    max={max}
                    min={0}
                    step={0.1}
                    className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-neutral-100 focus:border-blue-500 focus:outline-none"
                />
                <span className="text-neutral-500 text-sm">{unit}</span>
            </div>
        </div>
    );
}
