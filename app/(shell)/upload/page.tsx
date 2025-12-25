
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    UploadCloud,
    FileText,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    ArrowRight,
    Loader2,
    Download,
    Settings,
    ShieldAlert,
    BarChart3,
    Search,
    RefreshCw,
    Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { generateValidationPDF, generateValidationCSV } from "@/lib/reporting-client";

type UploadStep = "UPLOAD" | "VALIDATING" | "REVIEW" | "COMPLETE";

export default function UploadPage() {
    const router = useRouter();
    const [step, setStep] = useState<UploadStep>("UPLOAD");
    const [uploadId, setUploadId] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [statusMessage, setStatusMessage] = useState("Preparing engine...");
    const [showDebug, setShowDebug] = useState(false);

    // Results
    const [validationResult, setValidationResult] = useState<any>(null);
    const [runId, setRunId] = useState<string | null>(null);

    // 1. Handle File Selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    // 2. Main Upload & Process Flow
    const handleUpload = async () => {
        if (!file) return;

        const currentFile = file as File;
        setIsUploading(true);
        setStep("VALIDATING");
        setStatusMessage("Uploading high-resolution data...");

        try {
            // A. Upload File
            const formData = new FormData();
            formData.append("file", currentFile);

            const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            const uploadJson = await uploadRes.json();
            if (!uploadRes.ok) throw new Error(uploadJson.error?.message || "Upload failed");

            const uploadIdVal = uploadJson.data.uploadId;
            setUploadId(uploadIdVal);

            // B. Run Validation (Autonomous Header Discovery)
            setStatusMessage("Synchronizing with Groww Market Engine...");

            const validateRes = await fetch("/api/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uploadId: uploadIdVal }),
            });

            const validateJson = await validateRes.json();
            setValidationResult(validateJson.data);

            if (validateRes.ok && (validateJson.data?.runId)) {
                setStatusMessage("Finalizing portfolio snapshot...");
                setRunId(validateJson.data.runId);
                // Slight delay for visual confirmation of "Scanning"
                setTimeout(() => {
                    setStep("REVIEW");
                    setIsUploading(false);
                }, 1200);
            } else {
                if (!validateRes.ok && validateRes.status !== 422) {
                    throw new Error(validateJson.error?.message || "Validation process failed");
                }
                setStep("REVIEW");
                setIsUploading(false);
            }

        } catch (error: any) {
            console.error("Processing failed", error);
            alert(`Process Error: ${error.message}`);
            setStep("UPLOAD");
            setIsUploading(false);
        }
    };

    // 5. Download Reports
    const handleDownloadReport = (type: 'pdf' | 'csv') => {
        if (!validationResult) return;
        const issues = validationResult.validation?.issues || [];
        const summary = validationResult.validation?.summary || { total: 0, valid: 0, merged: 0, errors: 0 };
        if (type === 'pdf') generateValidationPDF(file?.name || "upload.csv", issues, summary);
        else generateValidationCSV(issues);
    };

    return (
        <div className="max-w-6xl mx-auto py-12 px-6 animate-in fade-in duration-700">
            {/* Header Area */}
            <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <Badge className="bg-primary/10 text-primary border-none text-[10px] font-black tracking-widest uppercase mb-2">
                        Intelligence Module
                    </Badge>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900 leading-tight">
                        Portfolio Maximizer
                    </h1>
                    <p className="text-slate-500 text-xl font-medium max-w-2xl">
                        Optimize your holdings with real-time Groww intelligence and automated rebalancing.
                    </p>
                </div>

                {step !== "UPLOAD" && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setStep("UPLOAD");
                            setFile(null);
                            setValidationResult(null);
                        }}
                        className="rounded-full shadow-sm hover:bg-slate-50 transition-all border-slate-200"
                    >
                        <RefreshCw size={14} className="mr-2" /> Start Over
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                {/* Main Action Area */}
                <div className="lg:col-span-3 space-y-8">
                    {step === "UPLOAD" && (
                        <div className="group relative">
                            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-indigo-500/20 rounded-3xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                            <Card className="relative border-none shadow-2xl bg-white/70 backdrop-blur-xl overflow-hidden rounded-3xl">
                                <CardContent className="p-12">
                                    <div className="flex flex-col items-center text-center space-y-8">
                                        <div className="w-24 h-24 bg-primary/5 rounded-3xl flex items-center justify-center border border-primary/10 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                            <UploadCloud className="text-primary w-12 h-12" />
                                        </div>

                                        <div className="space-y-3">
                                            <h3 className="text-3xl font-bold text-slate-900 tracking-tight">Import Financial Data</h3>
                                            <p className="text-slate-500 text-lg">Drop your spreadsheet here or browse to begin ingestion.</p>
                                        </div>

                                        <div className="w-full max-w-md space-y-6">
                                            <div className="relative group/input">
                                                <Input
                                                    type="file"
                                                    accept=".csv, .xlsx, .xls"
                                                    onChange={handleFileChange}
                                                    className="h-20 bg-slate-50 border-2 border-dashed border-slate-200 cursor-pointer text-slate-500 file:hidden pt-7 px-8 rounded-2xl group-hover/input:border-primary/30 transition-all focus-visible:ring-primary/20"
                                                />
                                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-slate-400 font-semibold text-sm flex items-center gap-2">
                                                    <Search size={16} /> {file ? file.name : "Select CSV / XLSX File"}
                                                </div>
                                            </div>

                                            <Button
                                                onClick={handleUpload}
                                                disabled={!file || isUploading}
                                                size="lg"
                                                className="w-full h-16 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all"
                                            >
                                                Initialize Optimization
                                                <ArrowRight size={20} className="ml-2" />
                                            </Button>
                                        </div>

                                        <div className="flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-4">
                                            <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Professional Grade</span>
                                            <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> SEC Compliant</span>
                                            <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Live Groww Link</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {step === "VALIDATING" && (
                        <div className="flex flex-col items-center justify-center py-32 space-y-8 text-center animate-in zoom-in-95 duration-500">
                            <div className="relative">
                                <div className="absolute inset-x-0 inset-y-0 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
                                <div className="relative w-32 h-32 flex items-center justify-center">
                                    <Loader2 size={64} className="text-primary animate-spin" strokeWidth={1.5} />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{statusMessage}</h3>
                                <p className="text-slate-500 text-lg flex items-center justify-center gap-2">
                                    Identifying column signatures and calculating sensitivities...
                                </p>
                            </div>
                            <div className="w-full max-w-sm h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-primary animate-infinite-scroll"></div>
                            </div>
                        </div>
                    )}

                    {step === "REVIEW" && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                            {!validationResult ? (
                                <Card className="border-none shadow-2xl bg-white/70 backdrop-blur-xl rounded-3xl overflow-hidden p-12 text-center space-y-6">
                                    <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500">
                                        <XCircle size={40} />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-bold text-slate-900">Validation System Error</h3>
                                        <p className="text-slate-500 max-w-sm mx-auto">The engine failed to interpret your spreadsheet. Please ensure the file contains valid holdings data and try again.</p>
                                    </div>
                                    <Button onClick={() => setStep("UPLOAD")} className="rounded-xl px-10">Return to Upload</Button>
                                </Card>
                            ) : (
                                <>
                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                        <ReviewStatCard
                                            label="Total Units"
                                            value={validationResult.validation?.summary?.total ?? 0}
                                            icon={<FileText size={18} />}
                                        />
                                        <ReviewStatCard
                                            label="Resolved"
                                            value={validationResult.validation?.summary?.valid ?? 0}
                                            icon={<Search size={18} />}
                                            color="indigo"
                                        />
                                        <ReviewStatCard label="Live Quote Accuracy" value="High" icon={<Sparkles size={18} />} color="emerald" />
                                        <ReviewStatCard
                                            label="Anomalies"
                                            value={validationResult.validation?.summary?.errors ?? 0}
                                            icon={<ShieldAlert size={18} />}
                                            color={(validationResult.validation?.summary?.errors ?? 0) > 0 ? "rose" : "slate"}
                                        />
                                    </div>

                                    {/* Main Preview Table */}
                                    {validationResult.enrichedPreview && (
                                        <Card className="border-none shadow-3xl bg-white rounded-3xl overflow-hidden ring-1 ring-slate-100">
                                            <div className="p-8 border-b bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <BarChart3 size={20} className="text-primary" />
                                                        <h3 className="text-2xl font-bold text-slate-900">Digital Copy Analysis</h3>
                                                    </div>
                                                    <p className="text-slate-500 font-medium">Verified data from Groww Market Engine</p>
                                                </div>
                                                <div className="flex gap-3">
                                                    <Button variant="outline" size="sm" onClick={() => handleDownloadReport('pdf')} className="rounded-xl font-bold px-5 bg-white border-slate-200">
                                                        <Download size={14} className="mr-2" /> Export Audit
                                                    </Button>
                                                    <Button
                                                        onClick={() => router.push(`/analysis?runId=${runId}`)}
                                                        className="bg-slate-900 hover:bg-black text-white rounded-xl px-8 font-bold shadow-xl shadow-slate-200 transition-all hover:-translate-y-0.5"
                                                    >
                                                        View Strategy <ArrowRight size={16} className="ml-2" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-50/30 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                                            <th className="px-8 py-6">Instrument Profile</th>
                                                            <th className="px-4 py-6 text-right">Qty</th>
                                                            <th className="px-4 py-6 text-right">Purchase Basis</th>
                                                            <th className="px-4 py-6 text-right text-slate-900">Value (INR)</th>
                                                            <th className="px-4 py-6 text-right text-indigo-600">Current Market LTP</th>
                                                            <th className="px-4 py-6 text-right text-slate-900">Current Value (INR)</th>
                                                            <th className="px-8 py-6 text-right">Net Growth</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {validationResult.enrichedPreview.map((row: any, i: number) => (
                                                            <tr key={i} className="group hover:bg-slate-50/50 transition-colors">
                                                                <td className="px-8 py-6 whitespace-nowrap">
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                                                            {(row.company_name || row.instrument_name || "U")[0]}
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <span className="font-bold text-slate-900 group-hover:text-primary transition-colors text-base">{row.company_name || row.instrument_name}</span>
                                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                                <span className="text-[10px] font-black font-mono text-slate-400 uppercase tracking-tighter">{row.symbol || row._instrument_resolved}</span>
                                                                                {(row.symbol || row._instrument_resolved) && <CheckCircle2 size={10} className="text-emerald-500" />}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-6 text-right font-mono font-medium text-slate-600 tabular-nums">
                                                                    {row.quantity?.toLocaleString() || 0}
                                                                </td>
                                                                <td className="px-4 py-6 text-right font-mono text-slate-500 tabular-nums">
                                                                    ₹{row.purchase_price?.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 }) || '0.0'}
                                                                </td>
                                                                <td className="px-4 py-6 text-right font-mono text-slate-900 font-bold tabular-nums">
                                                                    ₹{row.investment_value?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}
                                                                </td>
                                                                <td className="px-4 py-6 text-right font-mono text-indigo-600 font-bold tabular-nums">
                                                                    {row.market_price ? `₹${row.market_price.toLocaleString(undefined, { minimumFractionDigits: 1 })}` : <span className="text-slate-300 font-normal">--</span>}
                                                                </td>
                                                                <td className="px-4 py-6 text-right font-mono text-slate-900 font-bold tabular-nums">
                                                                    ₹{row.current_value?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}
                                                                </td>
                                                                <td className="px-8 py-6 text-right">
                                                                    <div className="flex flex-col items-end">
                                                                        <span className={cn("font-black tabular-nums font-mono text-base font-bold", (row.net_growth || 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                                                            {row.net_growth >= 0 ? '+' : ''}₹{row.net_growth?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}
                                                                        </span>
                                                                        <Badge className={cn(
                                                                            "mt-1.5 text-[9px] font-black border-none px-2 rounded-full",
                                                                            (row.net_growth || 0) >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                                                                        )}>
                                                                            {row.net_growth_percent ? `${row.net_growth_percent.toFixed(2)}%` : '0.00%'}
                                                                        </Badge>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </Card>
                                    )}

                                    {/* Debug Panel */}
                                    {validationResult?._debug?.enabled && (
                                        <Card className="border-none shadow-xl bg-slate-800 text-white rounded-3xl overflow-hidden mt-6">
                                            <div
                                                className="p-6 cursor-pointer flex items-center justify-between hover:bg-slate-700 transition-colors"
                                                onClick={() => setShowDebug(!showDebug)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                                                        <Settings size={16} className="text-amber-400" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-lg">Debug Panel</h4>
                                                        <p className="text-slate-400 text-sm">Ingestion pipeline trace logs</p>
                                                    </div>
                                                </div>
                                                <Badge className="bg-amber-500/20 text-amber-300 border-none">
                                                    {showDebug ? 'Hide' : 'Show'} Logs
                                                </Badge>
                                            </div>

                                            {showDebug && (
                                                <div className="px-6 pb-6 space-y-4">
                                                    {/* Summary */}
                                                    <div className="bg-slate-900/50 rounded-xl p-4 space-y-3">
                                                        <h5 className="text-xs font-black uppercase tracking-widest text-slate-400">Pipeline Summary</h5>
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                            <div className="bg-slate-700/50 rounded-lg p-3">
                                                                <div className="text-xs text-slate-400">Header Rows</div>
                                                                <div className="font-mono font-bold">{validationResult._debug.summary?.headerRowsUsed?.join(', ') || 'N/A'}</div>
                                                            </div>
                                                            <div className="bg-slate-700/50 rounded-lg p-3">
                                                                <div className="text-xs text-slate-400">Data Start Row</div>
                                                                <div className="font-mono font-bold">{validationResult._debug.summary?.dataStartRow ?? 'N/A'}</div>
                                                            </div>
                                                            <div className="bg-slate-700/50 rounded-lg p-3">
                                                                <div className="text-xs text-slate-400">Parsed Rows</div>
                                                                <div className="font-mono font-bold">{validationResult._debug.summary?.parsedRowCount ?? 'N/A'}</div>
                                                            </div>
                                                            <div className="bg-slate-700/50 rounded-lg p-3">
                                                                <div className="text-xs text-slate-400">Valid Rows</div>
                                                                <div className="font-mono font-bold">{validationResult._debug.summary?.validRowCount ?? 'N/A'}</div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Column Roles */}
                                                    <div className="bg-slate-900/50 rounded-xl p-4 space-y-3">
                                                        <h5 className="text-xs font-black uppercase tracking-widest text-slate-400">Column Role Assignments</h5>
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                            {Object.entries(validationResult._debug.summary?.roles || {}).map(([role, header]) => (
                                                                <div key={role} className="bg-slate-700/50 rounded-lg p-3">
                                                                    <div className="text-xs text-slate-400 capitalize">{role.replace('_', ' ')}</div>
                                                                    <div className="font-mono font-bold text-emerald-400 text-sm truncate">{header as string || 'NOT FOUND'}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Headers */}
                                                    <div className="bg-slate-900/50 rounded-xl p-4 space-y-3">
                                                        <h5 className="text-xs font-black uppercase tracking-widest text-slate-400">Extracted Headers</h5>
                                                        <div className="flex flex-wrap gap-2">
                                                            {(validationResult._debug.summary?.normalizedKeys || []).map((h: string, i: number) => (
                                                                <Badge key={i} className="bg-slate-700 text-slate-200 border-none font-mono text-xs">
                                                                    {h}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Log Entries */}
                                                    <div className="bg-slate-900/50 rounded-xl p-4 space-y-3">
                                                        <h5 className="text-xs font-black uppercase tracking-widest text-slate-400">
                                                            Trace Logs ({validationResult._debug.logs?.length || 0} entries)
                                                        </h5>
                                                        <div className="max-h-96 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-slate-600">
                                                            {(validationResult._debug.logs || []).map((log: any, i: number) => (
                                                                <div key={i} className="bg-slate-700/30 rounded-lg p-3 font-mono text-xs">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <Badge className="bg-indigo-500/30 text-indigo-300 border-none text-[10px]">
                                                                            {log.stage}
                                                                        </Badge>
                                                                        <span className="text-slate-500 text-[10px]">{log.timestamp?.split('T')[1]?.slice(0, 8)}</span>
                                                                    </div>
                                                                    <div className="text-slate-200">{log.message}</div>
                                                                    {log.data && (
                                                                        <pre className="mt-2 p-2 bg-slate-800 rounded text-[10px] text-slate-400 overflow-x-auto">
                                                                            {JSON.stringify(log.data, null, 2)}
                                                                        </pre>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </Card>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar Context */}
                <div className="hidden lg:block space-y-8">
                    <Card className="border-none shadow-xl bg-slate-900 text-white rounded-3xl overflow-hidden">
                        <CardContent className="p-8 space-y-6">
                            <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-widest text-primary">
                                <Settings size={14} /> Neural Configuration
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-xl font-bold leading-tight">Advanced Field Mapping</h4>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    Our proprietary discovery engine automatically identifies professional fund manager semantics including:
                                </p>
                                <ul className="space-y-3 text-sm font-medium">
                                    <li className="flex items-center gap-3 text-slate-200">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary ring-4 ring-primary/20" /> Multi-row Table Detection
                                    </li>
                                    <li className="flex items-center gap-3 text-slate-200">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary ring-4 ring-primary/20" /> Accounting Format Normalization
                                    </li>
                                    <li className="flex items-center gap-3 text-slate-200">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary ring-4 ring-primary/20" /> ISIN / Symbol Resolution
                                    </li>
                                </ul>
                            </div>

                            <div className="pt-4 border-t border-slate-800">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                                    <span>Engine Status</span>
                                    <span className="text-emerald-400">Optimal</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="bg-slate-50 border border-slate-100 p-8 rounded-3xl space-y-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-amber-600">
                            <ShieldAlert size={20} />
                        </div>
                        <h5 className="font-bold text-slate-900">Security & Integrity</h5>
                        <p className="text-slate-500 text-sm leading-relaxed">
                            In-memory processing ensures your financial data never touches long-term storage without encryption.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ReviewStatCard({ label, value, icon, color = "slate" }: { label: string, value: string | number, icon: React.ReactNode, color?: string }) {
    const colorMap: Record<string, string> = {
        slate: "from-slate-50 to-white text-slate-900 border-slate-100",
        indigo: "from-indigo-50 to-white text-indigo-900 border-indigo-100 shadow-indigo-100/50",
        emerald: "from-emerald-50 to-white text-emerald-900 border-emerald-100 shadow-emerald-100/50",
        rose: "from-rose-50 to-white text-rose-900 border-rose-100 shadow-rose-100/50",
    };

    const iconColorMap: Record<string, string> = {
        slate: "bg-slate-100 text-slate-600",
        indigo: "bg-indigo-100 text-indigo-600",
        emerald: "bg-emerald-100 text-emerald-600",
        rose: "bg-rose-100 text-rose-600",
    };

    return (
        <div className={cn("p-6 rounded-3xl border shadow-xl bg-gradient-to-br transition-all hover:scale-[1.02] duration-300", colorMap[color])}>
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-6 shadow-sm", iconColorMap[color])}>
                {icon}
            </div>
            <div className="text-3xl font-black tabular-nums tracking-tighter">
                {value}
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                {label}
            </div>
        </div>
    );
}
