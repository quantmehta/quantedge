import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, BarChart3, TrendingUp } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-80px)] w-full bg-slate-50 text-slate-900 font-sans selection:bg-primary/20">

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 lg:pt-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left Column: Text Content */}
          <div className="space-y-8 animate-in slide-in-from-left-4 duration-700 fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-primary text-sm font-semibold tracking-wide uppercase">
              <TrendingUp size={16} />
              <span>AI-Powered Quantitative Analysis</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 leading-[1.1]">
              Data-Driven <br />
              <span className="text-primary">Investment Edge</span>
            </h1>

            <p className="text-xl text-slate-600 max-w-lg leading-relaxed">
              We combine cutting-edge algorithms with deep market expertise to deliver alpha-generating strategies using Decision Theory frameworks.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link href="/upload">
                <Button size="lg" className="h-14 px-8 text-lg bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 text-white rounded-lg w-full sm:w-auto flex items-center gap-2">
                  <TrendingUp size={20} /> Portfolio Maximizer
                </Button>
              </Link>

              <Link href="/research">
                <Button variant="outline" size="lg" className="h-14 px-8 text-lg border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg w-full sm:w-auto">
                  View Research
                </Button>
              </Link>
            </div>

            <div className="flex items-center gap-6 pt-8 text-sm font-medium text-slate-500">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-primary" />
                <span>Verified Models</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-primary" />
                <span>$2.8B analyzed</span>
              </div>
            </div>
          </div>

          {/* Right Column: Dashboard Visualization */}
          <div className="relative animate-in slide-in-from-right-4 duration-1000 fade-in delay-200">
            {/* Main Card */}
            <div className="bg-white rounded-2xl shadow-2xl shadow-slate-200/50 p-8 border border-slate-100 relative z-10 w-full">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <p className="text-slate-500 text-sm font-medium mb-1">Portfolio Returns YTD</p>
                  <h3 className="text-4xl font-bold text-slate-900">$847M</h3>
                </div>
                <div className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm font-bold">
                  +24.8%
                </div>
              </div>

              {/* Chart Area */}
              <div className="h-32 w-full relative mb-8">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#00c08b" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="1" />
                    </linearGradient>
                  </defs>
                  {/* Trend Line */}
                  <path
                    d="M0 35 C 20 32, 40 30, 60 15 S 80 10, 100 5"
                    fill="none"
                    stroke="url(#gradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  {/* Area under curve (fade) */}
                  <path
                    d="M0 35 C 20 32, 40 30, 60 15 S 80 10, 100 5 L 100 40 L 0 40 Z"
                    fill="url(#gradient)"
                    fillOpacity="0.1"
                  />
                </svg>
              </div>
            </div>

            {/* Floating Cards */}
            <div className="grid grid-cols-2 gap-4 mt-4 relative z-10">
              <div className="bg-[#bef264] rounded-2xl p-6 shadow-lg border border-[#a3e635]">
                <p className="text-slate-800 text-sm font-medium mb-1">Sharpe Ratio</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-slate-900">2.4</span>
                  <div className="w-12 h-1 bg-slate-900 mb-2 rounded-full opacity-20"></div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
                <p className="text-slate-500 text-sm font-medium mb-1">Win Rate</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-slate-900">68%</span>
                  <span className="text-primary text-xs font-bold mb-1.5">↑ 3.2%</span>
                </div>
              </div>
            </div>

            {/* Background Blur Blob */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary/5 rounded-full blur-3xl -z-0 pointer-events-none" />
          </div>

        </div>
      </section>
    </div>
  );
}
