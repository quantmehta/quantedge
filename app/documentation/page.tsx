import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Documentation() {
    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-4xl mx-auto space-y-8">

                <div className="flex justify-between items-center">
                    <h1 className="text-4xl font-bold tracking-tight text-slate-900">Documentation</h1>
                    <Link href="/">
                        <Button variant="outline">Back to Home</Button>
                    </Link>
                </div>

                <p className="text-lg text-slate-600">
                    Welcome to the Financial Decision Maker. This simple yet powerful tool helps you choose the best course of action under uncertainty.
                </p>

                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-blue-600">🚀 Maximax (Optimistic)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-slate-600 mb-2">
                                The <strong>Maximax</strong> criterion is for the optimistic decision maker.
                                It assumes the best possible outcome will occur for each alternative.
                            </p>
                            <ul className="list-disc pl-5 text-sm text-slate-500 space-y-1">
                                <li>Logic: Find the maximum payoff for each alternative, then choose the maximum of those maximums.</li>
                                <li>Use case: High-risk, high-reward scenarios like startups or venture capital.</li>
                            </ul>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-indigo-600">🛡️ Maximin (Pessimistic)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-slate-600 mb-2">
                                The <strong>Maximin</strong> (or Wald) criterion is for the conservative decision maker.
                                It maximizes the minimum gain.
                            </p>
                            <ul className="list-disc pl-5 text-sm text-slate-500 space-y-1">
                                <li>Logic: Find the minimum payoff for each alternative, then choose the maximum of those minimums.</li>
                                <li>Use case: Protecting against worst-case scenarios, insurance, safety-critical systems.</li>
                            </ul>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-emerald-600">⚖️ EMV (Expected Monetary Value)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-slate-600 mb-2">
                                The <strong>EMV</strong> criterion is for the risk-neutral decision maker who knows the probabilities of each state.
                            </p>
                            <ul className="list-disc pl-5 text-sm text-slate-500 space-y-1">
                                <li>Logic: Multiply each payoff by its probability and sum them up for each alternative. Choose the highest weighted sum.</li>
                                <li>Use case: Stock market analysis, recurring business decisions where probabilities are known.</li>
                            </ul>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-rose-600">📉 Minimax Regret</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-slate-600 mb-2">
                                This criterion minimizes the "opportunity loss" or regret of making the wrong decision.
                            </p>
                            <ul className="list-disc pl-5 text-sm text-slate-500 space-y-1">
                                <li>Logic: Calculate how much you would regret not choosing the best option for each state. Then choose the option that minimizes your maximum regret.</li>
                                <li>Use case: Decisions where avoiding post-decision regret is crucial.</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex justify-center pt-8">
                    <Link href="/decision-matrix">
                        <Button size="lg" variant="premium">Start Analysis Now</Button>
                    </Link>
                </div>

            </div>
        </div>
    );
}
