import { prisma } from "@/lib/db";
import { type Prisma } from "@prisma/client";
import { toDecimal, sumDecimals, Decimal } from "./decimal-utils";
import { identifySector, SECTOR_CATALYSTS } from "./market-constants";
import path from "path";
import fs from "fs";

export interface AnalysisSuggestion {
    symbol: string;
    signal: 'BUY' | 'HOLD' | 'SELL';
    reasoning: string;
    impactParameter: string;
    isActionable?: boolean;
}

export interface PortfolioAnalysis {
    realizedPnl: string; // Decimal string
    unrealizedPnl: string; // Decimal string
    totalPnl: string; // Decimal string
    suggestions: AnalysisSuggestion[];
}

const TRENDS_PATH = path.join(process.cwd(), 'python', 'market_trends');

interface IntelData {
    intel: any[];
    context: any[];
    indexPerf: any[];
}

function getIntelligenceData(): IntelData {
    try {
        const intel = JSON.parse(fs.readFileSync(path.join(TRENDS_PATH, 'FundManagerIntel.json'), 'utf8'));
        const context = JSON.parse(fs.readFileSync(path.join(TRENDS_PATH, 'market_context_map.json'), 'utf8'));
        const indexPerf = JSON.parse(fs.readFileSync(path.join(TRENDS_PATH, 'indices_analysis_summary.json'), 'utf8'));
        return { intel, context, indexPerf };
    } catch (e) {
        console.error("Failed to load intelligence data", e);
        return { intel: [], context: [], indexPerf: [] };
    }
}

// Define the complex include type for type safety
type HoldingWithInstrument = Prisma.HoldingGetPayload<{
    include: {
        instrument: {
            include: {
                prices: true
            }
        }
    }
}>;

export async function calculatePortfolioAnalysis(runId: string): Promise<PortfolioAnalysis> {
    console.log(`[Analysis Engine] starting multi-factor calculation for runId: ${runId}`);

    let run = await prisma.run.findUnique({
        where: { id: runId },
        include: { upload: true }
    });

    if (!run) {
        run = await prisma.run.findFirst({
            where: { upload: { status: 'VALIDATED' } },
            orderBy: { createdAt: 'desc' },
            include: { upload: true }
        });
    }

    if (!run) throw new Error("No portfolios found for analysis.");

    const { intel, context, indexPerf } = getIntelligenceData();
    let realizedPnl = new Decimal(0);

    // 5. Fetch Real Holdings with strict typing
    const holdingsDb = await prisma.holding.findMany({
        where: { portfolioUploadId: run.portfolioUploadId },
        include: {
            instrument: {
                include: {
                    prices: {
                        orderBy: { asOf: 'desc' },
                        take: 1
                    }
                }
            }
        }
    }) as HoldingWithInstrument[];

    let unrealizedPnlTotal = new Decimal(0);
    const allSuggestions: AnalysisSuggestion[] = [];

    holdingsDb.forEach((h) => {
        const qty = toDecimal(h.quantity);
        const cost = toDecimal(h.costPrice);

        // Use live price from DB (fetched during validation)
        const livePrice = h.instrument?.prices?.[0]?.price
            ? toDecimal(h.instrument.prices[0].price)
            : cost;

        if (qty.gt(0)) {
            const gainPerShare = livePrice.minus(cost);
            unrealizedPnlTotal = unrealizedPnlTotal.plus(gainPerShare.mul(qty));
        }

        const suggestion = generateAdvancedSuggestion(h, intel, context, indexPerf);

        if (suggestion.isActionable) {
            allSuggestions.push(suggestion);
        }
    });

    return {
        realizedPnl: realizedPnl.toString(),
        unrealizedPnl: unrealizedPnlTotal.toString(),
        totalPnl: realizedPnl.plus(unrealizedPnlTotal).toString(),
        suggestions: allSuggestions
    };
}

function generateAdvancedSuggestion(
    holding: HoldingWithInstrument,
    intel: any[],
    context: any[],
    indexPerf: any[]
): AnalysisSuggestion {
    const name = holding.name || holding.rawIdentifier || '';
    const symbol = holding.instrument?.identifier || holding.rawIdentifier;

    // 1. Determine Sector & Context using decoupled logic
    const { sector, indexKey } = identifySector(name);

    // 2. Fetch Latest Performance Data
    const perf = indexPerf.find(p => p.name === indexKey) || indexPerf[0] || { volatility_annualized_pct: 0 };
    const volatility = perf.volatility_annualized_pct;
    const isVolatile = volatility > 18;

    // 3. Current Factor Logic (using decoupled constants)
    const catalyst = SECTOR_CATALYSTS[sector];
    const holdingName = holding.name || holding.rawIdentifier;

    if (catalyst) {
        const isActionable = catalyst.signal !== 'HOLD' || isVolatile;

        return {
            symbol,
            signal: catalyst.signal,
            reasoning: `${holdingName}: ${catalyst.news}. Given the ${catalyst.policy}, our analysis suggests a ${catalyst.signal} position to align with current market momentum.`,
            impactParameter: `News Cycle / ${sector} Policy`,
            isActionable
        };
    }

    // Default if no specific catalyst but high volatility detected
    return {
        symbol,
        signal: 'HOLD',
        reasoning: `${holdingName}: Standard performance alignment. No major specific catalysts for this sector currently warrant a deviation from your core strategy.`,
        impactParameter: "General Context",
        isActionable: false
    };
}

