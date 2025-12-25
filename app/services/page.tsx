import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TrendingUp, LayoutDashboard } from "lucide-react";

export default function ServicesPage() {
    return (
        <div className="min-h-[calc(100vh-80px)] bg-slate-50 py-16 px-4">
            <div className="max-w-4xl mx-auto space-y-12">
                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold text-slate-900">Our Services</h1>
                    <p className="text-lg text-slate-600">Choose a specialized tool to enhance your financial decision-making.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Portfolio Maximizer Card */}
                    <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow flex flex-col justify-between">
                        <div className="space-y-4">
                            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                                <TrendingUp size={24} />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900">Portfolio Maximizer</h2>
                            <p className="text-slate-600 leading-relaxed">
                                Optimize your asset allocation using advanced risk-parity and momentum-based algorithms.
                            </p>
                        </div>
                        <Link href="http://localhost:3000/upload" className="mt-8">
                            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-lg">
                                Launch Maximizer
                            </Button>
                        </Link>
                    </div>

                    {/* Decision Maker Card */}
                    <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow flex flex-col justify-between">
                        <div className="space-y-4">
                            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                                <LayoutDashboard size={24} />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900">Decision Maker</h2>
                            <p className="text-slate-600 leading-relaxed">
                                Navigate complex market scenarios with high-resolution probabilistic modeling.
                            </p>
                        </div>
                        <Link href="/decision-matrix" className="mt-8">
                            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 text-lg">
                                Launch Decision Maker
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
