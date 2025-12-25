"use client"

import * as React from "react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface PerformanceChartProps {
    data: {
        dates: string[];
        portfolio: number[];
        benchmark: number[];
    };
}

export function PerformanceChart({ data }: PerformanceChartProps) {
    if (!data || !data.dates || data.dates.length === 0) {
        return <div className="flex h-[300px] w-full items-center justify-center text-muted-foreground">No Performance Data</div>;
    }

    // Zip data
    const chartData = data.dates.map((d, i) => ({
        date: d,
        Portfolio: data.portfolio[i],
        Benchmark: data.benchmark[i]
    }));

    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                        dataKey="date"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={30}
                    />
                    <YAxis
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        domain={['auto', 'auto']}
                    />
                    <Tooltip
                        contentStyle={{ borderRadius: "8px" }}
                        formatter={(value: any) => typeof value === 'number' ? value.toFixed(2) : value}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Line
                        type="monotone"
                        dataKey="Portfolio"
                        stroke="#0d9488" // QuantEdge Teal
                        strokeWidth={2}
                        dot={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="Benchmark"
                        stroke="#64748b" // Slate 500
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
