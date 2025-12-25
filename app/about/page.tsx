import { Button } from "@/components/ui/button";
import Link from "next/link";
import { TrendingUp, Award, Users } from "lucide-react";

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <section className="relative py-20 overflow-hidden">
                <div className="absolute inset-0 bg-secondary/30 -skew-y-3 origin-top-left scale-110" />

                <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-primary/20 text-primary text-sm font-semibold mb-6 shadow-sm">
                        <Users size={16} />
                        <span>Leadership Team</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-6">
                        Meet the Visionary Behind <span className="text-primary">QuantEdge</span>
                    </h1>
                    <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
                        We are dedicated to transforming complex uncertainty into clear, actionable financial intelligence for the modern world.
                    </p>
                </div>
            </section>

            {/* CEO Profile */}
            <section className="max-w-5xl mx-auto px-6 pb-24">
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col md:flex-row">
                    {/* Image / Gradient Placeholder Side */}
                    <div className="md:w-2/5 bg-gradient-to-br from-primary to-emerald-600 relative min-h-[300px] flex items-center justify-center">
                        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay" />
                        <div className="text-white text-center p-8">
                            <div className="w-32 h-32 bg-white/20 backdrop-blur-md rounded-full mx-auto mb-4 flex items-center justify-center border-2 border-white/30">
                                <span className="text-4xl font-bold">DM</span>
                            </div>
                            <h2 className="text-2xl font-bold">Divit Mehta</h2>
                            <p className="text-emerald-100 font-medium">Chief Executive Officer</p>
                        </div>
                    </div>

                    {/* Content Side */}
                    <div className="md:w-3/5 p-8 md:p-12">
                        <div className="flex items-center gap-2 text-primary font-bold mb-4">
                            <Award className="w-5 h-5" />
                            <span>Founder's Story</span>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-4">Driving the Future of Decision Science</h3>
                        <div className="space-y-4 text-slate-600 leading-relaxed">
                            <p>
                                As the CEO of QuantEdge, <strong>Divit Mehta</strong> is responsible for the strategic direction and product vision that powers our analytics engine.
                            </p>
                            <p>
                                With a deep passion for quantitative finance and user experience, Divit identified a critical gap in the market: the lack of accessible, professional-grade tools for decision theory. He founded QuantEdge to bridge this divide, combining rigorous mathematical models with intuitive, world-class design.
                            </p>
                            <p>
                                Under Divit's leadership, QuantEdge has evolved from a concept into a robust platform used to model high-stakes financial scenarios with confidence and precision.
                            </p>
                        </div>


                    </div>
                </div>
            </section>
        </div>
    );
}
