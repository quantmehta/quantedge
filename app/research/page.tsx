import { TrendingUp, LayoutDashboard, Microscope } from "lucide-react";

export default function ResearchPage() {
    return (
        <div className="min-h-[calc(100vh-80px)] bg-slate-50 py-16 px-4">
            <div className="max-w-4xl mx-auto space-y-16">

                <div className="text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-primary text-sm font-semibold tracking-wide uppercase">
                        <Microscope size={16} />
                        <span>Quantitative Insights</span>
                    </div>
                    <h1 className="text-4xl font-bold text-slate-900">QuantEdge Research Insights</h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Deep dives into our methodology and the AI architecture powering our core engines.
                    </p>
                </div>

                {/* Portfolio Maximizer Writeup */}
                <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                            <TrendingUp size={28} />
                        </div>
                        <h2 className="text-3xl font-bold text-slate-900">Portfolio Maximizer</h2>
                    </div>
                    <p className="text-lg text-slate-700 leading-relaxed italic border-l-4 border-emerald-500 pl-6 bg-slate-50 py-4 rounded-r-lg">
                        "The Portfolio Maximizer represents the pinnacle of quantitative asset management. By synthesizing a decade of historical market data with real-time liquidity indicators and global macro shifts, our engine identifies the optimal efficient frontier for your holdings. It utilizes a multi-factor approach—monitoring volatility regimes, sectoral rotation, and institutional capital flows—to ensure that your portfolio remains resilient across diverse market cycles."
                    </p>
                    <div className="space-y-4 text-slate-600">
                        <p>Our research focuses on minimizing drawdown risk while maximizing capital efficiency through dynamic rebalancing. The engine processes over 150,000 instruments to detect alpha signals that remain invisible to traditional analysis.</p>
                    </div>
                </div>

                {/* Decision Maker Writeup */}
                <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                            <LayoutDashboard size={28} />
                        </div>
                        <h2 className="text-3xl font-bold text-slate-900">Decision Maker</h2>
                    </div>
                    <p className="text-lg text-slate-700 leading-relaxed italic border-l-4 border-primary pl-6 bg-slate-50 py-4 rounded-r-lg">
                        "The Decision Maker is our flagship probabilistic analysis engine designed for institutional-grade decision support. It bridges the gap between raw data and executive action by correlating historical structural shocks with current market conditions. Whether evaluating geopolitical tensions or subtle regulatory shifts, the Decision Maker provides a clear mathematical framework for assessing risk-adjusted outcomes, empowering you to move with confidence in uncertain environments."
                    </p>
                    <div className="space-y-4 text-slate-600">
                        <p>By leveraging game theory and Bayesian inference, the system simulates thousands of potential market trajectories. This allows us to provide prescriptive guidance that is not just data-backed, but context-aware.</p>
                    </div>
                </div>

            </div>
        </div>
    );
}
