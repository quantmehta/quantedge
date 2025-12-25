"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts"

interface WaterfallChartProps {
    data: Array<{ name: string; value: number; runningTotal: number; isTotal?: boolean }>;
}

export function WaterfallChart({ data }: WaterfallChartProps) {
    // Transform data for Recharts (Stacked Bar Logic)
    const chartData = data.map(d => {
        let start = 0;
        let pnl = 0;

        if (d.isTotal) {
            start = 0;
            pnl = d.value;
        } else {
            // If positive: start from runningTotal - value
            // If negative: start from runningTotal
            if (d.value >= 0) {
                start = d.runningTotal - d.value;
                pnl = d.value;
            } else {
                start = d.runningTotal;
                pnl = Math.abs(d.value); // Bar height is always positive
            }
        }

        return {
            name: d.name,
            start, // Transparent bottom
            pnl,   // Visible bar
            isTotal: d.isTotal,
            positive: d.value >= 0,
            originalValue: d.value
        };
    });

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const d = payload[1]?.payload || payload[0]?.payload; // 0 is start, 1 is pnl
            return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                                {label}
                            </span>
                            <span className="font-bold text-muted-foreground">
                                {d.originalValue.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                        dataKey="name"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                    />
                    <YAxis
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
                    <ReferenceLine y={0} stroke="#000" />

                    {/* Transparent Stack Base */}
                    <Bar dataKey="start" stackId="a" fill="transparent" />

                    {/* Visible Bar */}
                    <Bar dataKey="pnl" stackId="a" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={
                                    entry.isTotal
                                        ? "#3b82f6" // Blue for Total
                                        : entry.positive
                                            ? "#22c55e" // Green
                                            : "#ef4444" // Red
                                }
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
