// -----------------------------------------------------------------------------
// PDF GENERATOR v2 - Using pdf-lib (Next.js compatible, no font dependencies)
// -----------------------------------------------------------------------------

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import type { ReportData } from './ReportContracts';

export class PdfGenerator {
    private doc!: PDFDocument;
    private currentPage: any;
    private yPosition: number = 0;
    private readonly pageMargin = 50;
    private readonly pageWidth = 595.28 - 2 * 50; // A4 width minus margins
    private readonly pageHeight = 841.89;
    private font: any;
    private boldFont: any;

    async generate(data: ReportData, outputPath: string): Promise<void> {
        // Create PDF document
        this.doc = await PDFDocument.create();
        this.font = await this.doc.embedFont(StandardFonts.Helvetica);
        this.boldFont = await this.doc.embedFont(StandardFonts.HelveticaBold);

        // Create first page
        this.addPage();

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

        // Save PDF
        const pdfBytes = await this.doc.save();

        // Ensure output directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, pdfBytes);
    }

    private addPage() {
        this.currentPage = this.doc.addPage([595.28, 841.89]); // A4
        this.yPosition = this.pageHeight - this.pageMargin;
    }

    private checkPageBreak(requiredSpace: number): boolean {
        if (this.yPosition - requiredSpace < this.pageMargin) {
            this.addPage();
            return true;
        }
        return false;
    }

    private addHeading(text: string, size: number, color: [number, number, number] = [0, 0, 0]) {
        this.checkPageBreak(size + 10);
        this.currentPage.drawText(text, {
            x: this.pageMargin,
            y: this.yPosition,
            size,
            font: this.boldFont,
            color: rgb(color[0], color[1], color[2]),
        });
        this.yPosition -= size + 5;
    }

    private addText(text: string, size: number = 10, color: [number, number, number] = [0, 0, 0]) {
        this.checkPageBreak(20);

        // Handle long text wrapping
        const maxWidth = this.pageWidth;
        const words = text.split(' ');
        let line = '';

        for (const word of words) {
            const testLine = line + word + ' ';
            const textWidth = this.font.widthOfTextAtSize(testLine, size);

            if (textWidth > maxWidth && line !== '') {
                this.currentPage.drawText(line.trim(), {
                    x: this.pageMargin,
                    y: this.yPosition,
                    size,
                    font: this.font,
                    color: rgb(color[0], color[1], color[2]),
                });
                this.yPosition -= 15;
                this.checkPageBreak(20);
                line = word + ' ';
            } else {
                line = testLine;
            }
        }

        if (line.trim()) {
            this.currentPage.drawText(line.trim(), {
                x: this.pageMargin,
                y: this.yPosition,
                size,
                font: this.font,
                color: rgb(color[0], color[1], color[2]),
            });
            this.yPosition -= 15;
        }
    }

    private renderCover(data: ReportData) {
        this.addHeading('QuantEdge Portfolio Report', 24);
        this.yPosition -= 20;
        this.addText(`Run ID: ${data.metadata.runId}`, 10, [0.4, 0.4, 0.4]);
        this.addText(`Generated: ${new Date(data.metadata.generatedAt).toLocaleString()}`, 10, [0.4, 0.4, 0.4]);
        this.addText(`Market Data As Of: ${new Date(data.metadata.marketDataAsOf).toLocaleString()}`, 10, [0.4, 0.4, 0.4]);
        this.yPosition -= 20;
        this.addHeading('Ruleset', 14);
        this.addText(`Name: ${data.metadata.rulesetName}`);
        this.addText(`Version: ${data.metadata.rulesetVersionNumber}`);
        this.yPosition -= 20;
        this.addHeading('Data Sources', 14);
        data.metadata.dataSources.forEach((source) => {
            this.addText(`- ${source}`);
        });
    }

    private renderExecutiveSummary(data: ReportData) {
        this.addHeading('Executive Summary', 18);
        this.yPosition -= 10;
        this.addHeading('Top 3 Actions', 14);
        data.executiveSummary.topActions.forEach((action, idx) => {
            this.addText(`${idx + 1}. [${action.type}] ${action.symbol}: ${action.description}`);
            this.addText(`   Timeframe: ${action.bucket.replace('_', ' ')}`, 9, [0.4, 0.4, 0.4]);
        });

        this.yPosition -= 15;
        this.addHeading('Top 3 Risks', 14);
        data.executiveSummary.topRisks.forEach((risk, idx) => {
            this.addText(`${idx + 1}. ${risk.category}: ${risk.description}`);
            const riskText = risk.limitValue !== undefined
                ? `   Current: ${(risk.value * 100).toFixed(2)}% | Limit: ${(risk.limitValue * 100).toFixed(2)}%`
                : `   Value: Rs ${this.formatMoney(risk.value)}`;
            this.addText(riskText, 9, [0.8, 0, 0]);
        });
    }

    private renderPortfolioSnapshot(data: ReportData) {
        this.addHeading('Portfolio Snapshot', 18);
        this.yPosition -= 10;
        this.addHeading('Capital Overview', 14);
        const snap = data.portfolioSnapshot;
        this.addText(`Invested Capital: Rs ${this.formatMoney(snap.investedCapital)}`);
        this.addText(`Current Value: Rs ${this.formatMoney(snap.currentValue)}`);
        const pnlColor: [number, number, number] = snap.unrealizedPnL >= 0 ? [0, 0.6, 0] : [0.8, 0, 0];
        this.addText(
            `Unrealized P&L: Rs ${this.formatMoney(snap.unrealizedPnL)} (${(snap.unrealizedPnLPct * 100).toFixed(2)}%)`,
            10,
            pnlColor
        );

        this.yPosition -= 15;
        this.addHeading('Top Gainers', 14);
        snap.topGainers.slice(0, 5).forEach((g) => {
            this.addText(`${g.symbol}: Rs ${this.formatMoney(g.pnl)} (${(g.pnlPct * 100).toFixed(2)}%)`, 10, [0, 0.6, 0]);
        });

        this.yPosition -= 10;
        this.addHeading('Top Losers', 14);
        snap.topLosers.slice(0, 5).forEach((l) => {
            this.addText(`${l.symbol}: Rs ${this.formatMoney(l.pnl)} (${(l.pnlPct * 100).toFixed(2)}%)`, 10, [0.8, 0, 0]);
        });
    }

    private renderRiskDiagnostics(data: ReportData) {
        this.addHeading('Risk Diagnostics', 18);
        this.yPosition -= 10;
        const risk = data.riskDiagnostics;

        this.addHeading('Concentration Risk', 14);
        this.addText(`Max Single Asset: ${risk.concentration.maxSingleAsset.symbol} - ${(risk.concentration.maxSingleAsset.weight * 100).toFixed(2)}%`);
        this.addText(`   Limit: ${(risk.concentration.maxSingleAsset.limit * 100).toFixed(2)}%`, 9, [0.4, 0.4, 0.4]);

        this.yPosition -= 10;
        this.addHeading('Volatility', 14);
        this.addText(`Portfolio Volatility: ${(risk.volatility.portfolioVolatility * 100).toFixed(2)}%`);
        this.addText(`Limit: ${(risk.volatility.limit * 100).toFixed(2)}%`, 9, [0.4, 0.4, 0.4]);

        this.yPosition -= 15;
        this.addHeading('Drawdown', 14);
        this.addText(`Max Drawdown: ${(risk.drawdown.maxDrawdown * 100).toFixed(2)}%`);
        this.addText(`Limit: ${(risk.drawdown.limit * 100).toFixed(2)}%`, 9, [0.4, 0.4, 0.4]);
    }

    private renderScenarios(data: ReportData) {
        this.addHeading('Scenario Analysis', 18);
        this.yPosition -= 10;

        if (data.scenarios.length === 0) {
            this.addText('No scenarios executed for this run.', 10, [0.4, 0.4, 0.4]);
            return;
        }

        data.scenarios.forEach((scenario) => {
            this.addHeading(`Scenario: ${scenario.scenarioType}`, 14);
            this.addText(`Impact: Rs ${this.formatMoney(scenario.portfolioImpact)} (${(scenario.portfolioImpactPct * 100).toFixed(2)}%)`);
            if (scenario.description) {
                this.addText(scenario.description, 9, [0.4, 0.4, 0.4]);
            }
            this.yPosition -= 10;
        });
    }

    private renderEventImpact(data: ReportData) {
        this.addHeading('Event Impact Analysis', 18);
        this.yPosition -= 10;
        const event = data.eventImpact;

        this.addHeading('PnL-at-Risk Summary', 14);
        this.addText(`Total PnL-at-Risk: Rs ${this.formatMoney(event.totalPnLAtRisk)}`, 10, [0.8, 0, 0]);
        this.addText(`Portfolio Value at Risk: Rs ${this.formatMoney(event.portfolioValueAtRisk)}`);

        this.yPosition -= 15;
        this.addText(`Traceability: ${event.traceabilityNote}`, 9, [0.4, 0.4, 0.4]);
    }

    private renderRecommendations(data: ReportData) {
        this.addHeading('Recommended Actions', 18);
        this.yPosition -= 10;

        const buckets = [
            { name: 'IMMEDIATE (0-2 weeks)', data: data.actions.immediate, color: [0.8, 0, 0] as [number, number, number] },
            { name: 'NEAR-TERM (1-6 months)', data: data.actions.nearTerm, color: [0.9, 0.5, 0] as [number, number, number] },
            { name: 'LONG-TERM (6+ months)', data: data.actions.longTerm, color: [0, 0.5, 0] as [number, number, number] },
        ];

        buckets.forEach(({ name, data: actions, color }) => {
            this.checkPageBreak(100);
            this.addHeading(name, 14, color);
            this.yPosition -= 5;

            if (actions.length === 0) {
                this.addText('No actions in this timeframe.', 9, [0.4, 0.4, 0.4]);
                this.yPosition -= 10;
                return;
            }

            actions.forEach((rec) => {
                this.addText(`[${rec.type}] ${rec.symbol} - ${rec.name}`, 10, color);
                this.addText(`Rationale: ${rec.rationale}`, 9, [0.4, 0.4, 0.4]);
                this.addText(`Confidence: ${(rec.confidenceScore * 100).toFixed(0)}%`);

                if (rec.override) {
                    this.addText(`[OVERRIDDEN] by ${rec.override.actor}: ${rec.override.reason}`, 9, [1, 0, 0]);
                }

                this.yPosition -= 8;
                this.checkPageBreak(50);
            });

            this.yPosition -= 10;
        });
    }

    private renderAssumptionsAndAudit(data: ReportData) {
        this.addHeading('Assumptions & Disclaimers', 18);
        this.yPosition -= 10;

        this.addHeading('Assumptions', 14);
        data.assumptionsAndDisclaimers.assumptions.forEach((a) => {
            this.addText(`- ${a}`, 9, [0.4, 0.4, 0.4]);
        });

        this.yPosition -= 15;
        this.addHeading('Disclaimers', 14);
        data.assumptionsAndDisclaimers.disclaimers.forEach((d) => {
            this.addText(`- ${d}`, 9, [0.8, 0, 0]);
        });

        this.checkPageBreak(100);

        this.yPosition -= 15;
        this.addHeading('Audit Summary', 14);
        const audit = data.assumptionsAndDisclaimers.auditSummary;
        this.addText(`Run ID: ${audit.runId}`);
        this.addText(`Upload Hash: ${audit.uploadHash.slice(0, 16)}...`);
        this.addText(`Ruleset Version: ${audit.rulesetVersionId}`);

        if (audit.overrides.length > 0) {
            this.yPosition -= 10;
            this.addText(`Overrides Applied: ${audit.overrides.length}`, 10, [0.9, 0.5, 0]);
            audit.overrides.forEach((o) => {
                this.addText(`  - ${o.ruleCode} by ${o.actor}`, 8, [0.4, 0.4, 0.4]);
            });
        }
    }

    private formatMoney(value: number): string {
        return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}
