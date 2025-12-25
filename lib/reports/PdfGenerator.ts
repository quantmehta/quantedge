// -----------------------------------------------------------------------------
// PDF GENERATOR - Renders ReportData into formatted PDF document
// -----------------------------------------------------------------------------

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import type { ReportData } from './ReportContracts';

export class PdfGenerator {
    private doc: PDFKit.PDFDocument;
    private yPosition: number = 0;
    private readonly pageMargin = 50;
    private readonly pageWidth = 595.28 - 2 * 50; // A4 width minus margins

    constructor() {
        this.doc = new PDFDocument({
            size: 'A4',
            margins: {
                top: this.pageMargin,
                bottom: this.pageMargin,
                left: this.pageMargin,
                right: this.pageMargin,
            },
        });
        this.yPosition = this.pageMargin;
    }

    /**
     * Generate PDF from ReportData and save to file
     */
    async generate(data: ReportData, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Ensure output directory exists
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const stream = fs.createWriteStream(outputPath);
            this.doc.pipe(stream);

            try {
                // Render all sections
                this.renderCover(data);
                this.addPage();
                this.renderExecutiveSummary(data);
                this.addPage();
                this.renderPortfolioSnapshot(data);
                this.addPage();
                this.renderRiskDiagnostics(data);
                this.addPage();
                this.renderScenarios(data);
                this.addPage();
                this.renderEventImpact(data);
                this.addPage();
                this.renderRecommendations(data);
                this.addPage();
                this.renderAssumptionsAndAudit(data);

                this.doc.end();
                stream.on('finish', () => resolve());
                stream.on('error', (err) => reject(err));
            } catch (error) {
                reject(error);
            }
        });
    }

    private renderCover(data: ReportData) {
        this.doc.fontSize(28).text('QuantEdge Portfolio Report', {
            align: 'center',
        });
        this.yPosition += 60;

        this.doc.fontSize(12).fillColor('#666');
        this.addText(`Run ID: ${data.metadata.runId}`);
        this.addText(`Generated: ${new Date(data.metadata.generatedAt).toLocaleString()}`);
        this.addText(`Market Data As Of: ${new Date(data.metadata.marketDataAsOf).toLocaleString()}`);
        this.yPosition += 20;

        this.addHeading('Ruleset', 14);
        this.addText(`Name: ${data.metadata.rulesetName}`);
        this.addText(`Version: ${data.metadata.rulesetVersionNumber}`);
        this.yPosition += 20;

        this.addHeading('Data Sources', 14);
        data.metadata.dataSources.forEach((source) => {
            this.addText(`• ${source}`);
        });
    }

    private renderExecutiveSummary(data: ReportData) {
        this.addHeading('Executive Summary', 18);
        this.yPosition += 10;

        this.addHeading('Top 3 Actions', 14);
        data.executiveSummary.topActions.forEach((action, idx) => {
            this.addText(`${idx + 1}. [${action.type}] ${action.symbol}: ${action.description}`);
            this.addText(`   Timeframe: ${action.bucket.replace('_', ' ')}`, '#666');
            this.yPosition += 5;
        });

        this.yPosition += 15;
        this.addHeading('Top 3 Risks', 14);
        data.executiveSummary.topRisks.forEach((risk, idx) => {
            this.addText(`${idx + 1}. ${risk.category}: ${risk.description}`);
            if (risk.limitValue !== undefined) {
                this.addText(
                    `   Current: ${(risk.value * 100).toFixed(2)}% | Limit: ${(risk.limitValue * 100).toFixed(2)}%`,
                    '#c00'
                );
            } else {
                this.addText(`   Value: ₹${this.formatMoney(risk.value)}`, '#c00');
            }
            this.yPosition += 5;
        });
    }

    private renderPortfolioSnapshot(data: ReportData) {
        this.addHeading('Portfolio Snapshot', 18);
        this.yPosition += 10;

        this.addHeading('Capital Overview', 14);
        const snap = data.portfolioSnapshot;
        this.addText(`Invested Capital: ₹${this.formatMoney(snap.investedCapital)}`);
        this.addText(`Current Value: ₹${this.formatMoney(snap.currentValue)}`);
        this.addText(
            `Unrealized P&L: ₹${this.formatMoney(snap.unrealizedPnL)} (${(snap.unrealizedPnLPct * 100).toFixed(2)}%)`,
            snap.unrealizedPnL >= 0 ? '#0a0' : '#c00'
        );

        this.yPosition += 15;
        this.addHeading('Asset Allocation (Top 10)', 14);
        this.renderTable(
            ['Asset', 'Value (₹)', 'Weight (%)'],
            snap.assetAllocation.slice(0, 10).map((a) => [
                a.name,
                this.formatMoney(a.value),
                (a.weight * 100).toFixed(2),
            ])
        );

        if (this.checkPageBreak(200)) this.addPage();

        this.yPosition += 15;
        this.addHeading('Top Gainers', 14);
        snap.topGainers.slice(0, 5).forEach((g) => {
            this.addText(`${g.symbol}: ₹${this.formatMoney(g.pnl)} (${(g.pnlPct * 100).toFixed(2)}%)`, '#0a0');
        });

        this.yPosition += 10;
        this.addHeading('Top Losers', 14);
        snap.topLosers.slice(0, 5).forEach((l) => {
            this.addText(`${l.symbol}: ₹${this.formatMoney(l.pnl)} (${(l.pnlPct * 100).toFixed(2)}%)`, '#c00');
        });
    }

    private renderRiskDiagnostics(data: ReportData) {
        this.addHeading('Risk Diagnostics', 18);
        this.yPosition += 10;

        const risk = data.riskDiagnostics;

        this.addHeading('Concentration Risk', 14);
        this.addText(
            `Max Single Asset: ${risk.concentration.maxSingleAsset.symbol} - ${(risk.concentration.maxSingleAsset.weight * 100).toFixed(2)}%`
        );
        this.addText(`   Limit: ${(risk.concentration.maxSingleAsset.limit * 100).toFixed(2)}%`, '#666');

        this.yPosition += 10;
        this.addText(
            `Max Sector: ${risk.concentration.maxSector.sector} - ${(risk.concentration.maxSector.weight * 100).toFixed(2)}%`
        );
        this.addText(`   Limit: ${(risk.concentration.maxSector.limit * 100).toFixed(2)}%`, '#666');

        this.yPosition += 15;
        this.addHeading('Volatility', 14);
        this.addText(`Portfolio Volatility: ${(risk.volatility.portfolioVolatility * 100).toFixed(2)}%`);
        this.addText(`Limit: ${(risk.volatility.limit * 100).toFixed(2)}%`, '#666');

        this.yPosition += 15;
        this.addHeading('Drawdown', 14);
        this.addText(`Max Drawdown: ${(risk.drawdown.maxDrawdown * 100).toFixed(2)}%`);
        this.addText(`Limit: ${(risk.drawdown.limit * 100).toFixed(2)}%`, '#666');
    }

    private renderScenarios(data: ReportData) {
        this.addHeading('Scenario Analysis', 18);
        this.yPosition += 10;

        if (data.scenarios.length === 0) {
            this.addText('No scenarios executed for this run.', '#666');
            return;
        }

        data.scenarios.forEach((scenario) => {
            this.addHeading(`Scenario: ${scenario.scenarioType}`, 14);
            this.addText(`Impact: ₹${this.formatMoney(scenario.portfolioImpact)} (${(scenario.portfolioImpactPct * 100).toFixed(2)}%)`);
            if (scenario.description) {
                this.addText(scenario.description, '#666');
            }
            this.yPosition += 10;
        });
    }

    private renderEventImpact(data: ReportData) {
        this.addHeading('Event Impact Analysis', 18);
        this.yPosition += 10;

        const event = data.eventImpact;
        this.addHeading('PnL-at-Risk Summary', 14);
        this.addText(`Total PnL-at-Risk: ₹${this.formatMoney(event.totalPnLAtRisk)}`, '#c00');
        this.addText(`Portfolio Value at Risk: ₹${this.formatMoney(event.portfolioValueAtRisk)}`);

        this.yPosition += 15;
        if (event.topEvents.length > 0) {
            this.addHeading('Top Events', 14);
            this.renderTable(
                ['Event', 'Category', 'Impacted Holdings', 'Est. Impact (₹)'],
                event.topEvents.map((e) => [
                    e.title.slice(0, 40),
                    e.category,
                    e.impactedHoldings.toString(),
                    this.formatMoney(e.estimatedImpact),
                ])
            );
        }

        this.yPosition += 15;
        this.addText(`Traceability: ${event.traceabilityNote}`, '#666');
    }

    private renderRecommendations(data: ReportData) {
        this.addHeading('Recommended Actions', 18);
        this.yPosition += 10;

        const buckets = [
            { name: 'IMMEDIATE (0-2 weeks)', data: data.actions.immediate, color: '#c00' },
            { name: 'NEAR-TERM (1-6 months)', data: data.actions.nearTerm, color: '#f80' },
            { name: 'LONG-TERM (6+ months)', data: data.actions.longTerm, color: '#080' },
        ];

        buckets.forEach(({ name, data: actions, color }) => {
            if (this.checkPageBreak(250)) this.addPage();

            this.addHeading(name, 14, color);
            this.yPosition += 5;

            if (actions.length === 0) {
                this.addText('No actions in this timeframe.', '#666');
                this.yPosition += 10;
                return;
            }

            actions.forEach((rec) => {
                this.addText(`[${rec.type}] ${rec.symbol} - ${rec.name}`, color);
                this.addText(`Rationale: ${rec.rationale}`, '#666');
                this.addText(`Confidence: ${(rec.confidenceScore * 100).toFixed(0)}%`);

                if (rec.override) {
                    this.addText(`⚠ OVERRIDDEN by ${rec.override.actor}: ${rec.override.reason}`, '#f00');
                    this.addText(`   Override timestamp: ${new Date(rec.override.timestamp).toLocaleString()}`, '#f00');
                }

                this.yPosition += 8;
                if (this.checkPageBreak(100)) this.addPage();
            });

            this.yPosition += 10;
        });
    }

    private renderAssumptionsAndAudit(data: ReportData) {
        this.addHeading('Assumptions & Disclaimers', 18);
        this.yPosition += 10;

        this.addHeading('Assumptions', 14);
        data.assumptionsAndDisclaimers.assumptions.forEach((a) => {
            this.addText(`• ${a}`, '#666');
        });

        this.yPosition += 15;
        this.addHeading('Data Freshness', 14);
        const fresh = data.assumptionsAndDisclaimers.dataFreshness;
        this.addText(`Pricing As Of: ${new Date(fresh.pricingAsOf).toLocaleString()}`);
        this.addText(`Stale Instruments: ${fresh.staleInstruments.count} (${fresh.staleInstruments.valuePercent}% of portfolio)`);

        this.yPosition += 15;
        this.addHeading('Disclaimers', 14);
        data.assumptionsAndDisclaimers.disclaimers.forEach((d) => {
            this.addText(`• ${d}`, '#c00');
        });

        if (this.checkPageBreak(200)) this.addPage();

        this.yPosition += 15;
        this.addHeading('Audit Summary', 14);
        const audit = data.assumptionsAndDisclaimers.auditSummary;
        this.addText(`Run ID: ${audit.runId}`);
        this.addText(`Upload Hash: ${audit.uploadHash.slice(0, 16)}...`);
        this.addText(`Ruleset Version: ${audit.rulesetVersionId}`);

        if (audit.overrides.length > 0) {
            this.yPosition += 10;
            this.addText(`Overrides Applied: ${audit.overrides.length}`, '#f80');
            audit.overrides.forEach((o) => {
                this.addText(`  • ${o.ruleCode} by ${o.actor} at ${new Date(o.timestamp).toLocaleString()}`, '#666');
            });
        }
    }

    // Helper methods
    private addHeading(text: string, size: number, color: string = '#000') {
        this.checkPageBreak(size + 10);
        this.doc.fontSize(size).fillColor(color).text(text, this.pageMargin, this.yPosition);
        this.yPosition += size + 5;
    }

    private addText(text: string, color: string = '#000') {
        this.checkPageBreak(20);
        this.doc.fontSize(10).fillColor(color).text(text, this.pageMargin, this.yPosition);
        this.yPosition += 15;
    }

    private renderTable(headers: string[], rows: string[][]) {
        const colWidth = this.pageWidth / headers.length;

        // Headers
        this.checkPageBreak(rows.length * 20 + 30);
        let x = this.pageMargin;
        headers.forEach((header) => {
            this.doc.fontSize(10).text(header, x, this.yPosition, { width: colWidth, align: 'left' });
            x += colWidth;
        });
        this.yPosition += 20;

        // Rows
        rows.forEach((row) => {
            x = this.pageMargin;
            row.forEach((cell) => {
                this.doc.fontSize(9).text(cell, x, this.yPosition, { width: colWidth, align: 'left' });
                x += colWidth;
            });
            this.yPosition += 18;
        });
    }

    private checkPageBreak(requiredSpace: number): boolean {
        if (this.yPosition + requiredSpace > 792 - this.pageMargin) {
            this.addPage();
            return true;
        }
        return false;
    }

    private addPage() {
        this.doc.addPage();
        this.yPosition = this.pageMargin;
    }

    private formatMoney(value: number): string {
        return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}
