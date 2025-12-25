// -----------------------------------------------------------------------------
// CSV EXPORTER - Generates holdings CSV from RunSnapshot
// -----------------------------------------------------------------------------

import { prisma } from '../db';

export class CsvExporter {
    /**
     * Generate holdings CSV for a run
     */
    static async generateHoldingsCsv(runId: string): Promise<string> {
        // Fetch latest snapshot
        const snapshot = await prisma.runSnapshot.findFirst({
            where: { runId },
            orderBy: { createdAt: 'desc' },
        });

        if (!snapshot) {
            throw new Error(`No snapshot found for run: ${runId}`);
        }

        const data = JSON.parse(snapshot.snapshotJson);
        const holdings = data.holdings || [];

        // Define columns
        const columns = [
            'identifier',
            'name',
            'quantity',
            'costPrice',
            'lastPrice',
            'invested',
            'currentValue',
            'unrealizedPnL',
            'unrealizedPnLPct',
            'weight',
            'sector',
            'asset Class',
            'priceAsOf',
            'freshness',
        ];

        // Build CSV
        const rows = [columns.join(',')];

        holdings.forEach((h: any) => {
            const row = [
                this.escapeCsv(h.identifier || h.symbol || ''),
                this.escapeCsv(h.name || ''),
                h.quantity || 0,
                this.formatNumber(h.costPrice || 0),
                this.formatNumber(h.lastPrice || 0),
                this.formatNumber(h.invested || 0),
                this.formatNumber(h.currentValue || 0),
                this.formatNumber(h.unrealizedPnL || 0),
                this.formatNumber((h.unrealizedPnLPct || 0) * 100), // Convert to percentage
                this.formatNumber((h.weight || 0) * 100), // Convert to percentage
                this.escapeCsv(h.sector || 'Unknown'),
                this.escapeCsv(h.assetClass || 'Equity'),
                h.priceAsOf || '',
                h.freshness || 'fresh',
            ];
            rows.push(row.join(','));
        });

        // Add summary row
        const summary = data.summary || {};
        rows.push('');
        rows.push('SUMMARY');
        rows.push(`Total Invested,${this.formatNumber(summary.invested || 0)}`);
        rows.push(`Total Current Value,${this.formatNumber(summary.current || 0)}`);
        rows.push(`Total Unrealized P&L,${this.formatNumber(summary.unrealizedPnL || 0)}`);
        rows.push(`Total Unrealized P&L %,${this.formatNumber((summary.unrealizedPnLPct || 0) * 100)}`);

        return rows.join('\n');
    }

    private static escapeCsv(value: string): string {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }

    private static formatNumber(value: number): string {
        return value.toFixed(2);
    }
}
