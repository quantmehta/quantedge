
export interface Catalyst {
    news: string;
    policy: string;
    signal: 'BUY' | 'HOLD' | 'SELL';
}

export const SECTOR_CATALYSTS: Record<string, Catalyst> = {
    'DEFENSE': { news: "Increasing capital outlay in 2024-25 budget; strong export pipeline.", policy: "Indigenization focus", signal: 'BUY' },
    'FINANCIAL': { news: "Credit growth remains robust; NPA cycles at decadal lows.", policy: "RBI Repo stability", signal: 'BUY' },
    'AUTO': { news: "EV adaptation slowing in some segments; raw material costs stable.", policy: "FAME-III rumors", signal: 'BUY' },
    'METALS': { news: "Global demand softening; China economic slowdown impact.", policy: "Anti-dumping duties", signal: 'SELL' },
    'FMCG': { news: "Rural demand bottoming out; inflation stabilizing.", policy: "MSP hikes", signal: 'BUY' },
    'ENERGY': { news: "Renewable transition accelerating; green hydrogen subsidies.", policy: "National Green Hydrogen Mission", signal: 'BUY' },
    'PHARMA': { news: "Export volumes to US rising; generic pricing stabilized.", policy: "PLI Scheme for API", signal: 'BUY' },
    'INFRA': { news: "National Infrastructure Pipeline Execution; highway construction peak.", policy: "PM Gati Shakti", signal: 'BUY' },
    'IT': { news: "AI spending ramp-up by clients; margin pressure easing.", policy: "Digital India focus", signal: 'BUY' },
    'GROWTH': { news: "Indian economy projected to grow at 7%+; broad-based recovery.", policy: "Fiscal discipline", signal: 'BUY' }
};

export function identifySector(name: string): { sector: string; indexKey: string } {
    const ucName = name.toUpperCase();
    if (ucName.includes('BANK') || ucName.includes('FIN') || ucName.includes('SBI') || ucName.includes('HDFC')) return { sector: 'FINANCIAL', indexKey: 'NIFTY_BANK' };
    if (ucName.includes('AUTO') || ucName.includes('MOTORS') || ucName.includes('M&M')) return { sector: 'AUTO', indexKey: 'NIFTY_AUTO' };
    if (ucName.includes('STEEL') || ucName.includes('METAL') || ucName.includes('TATA')) return { sector: 'METALS', indexKey: 'NIFTY_METAL' };
    if (ucName.includes('TECH') || ucName.includes('SOFT') || ucName.includes('TCS') || ucName.includes('INFY')) return { sector: 'IT', indexKey: 'NIFTY_AUTO' };
    if (ucName.includes('DEFENCE') || ucName.includes('HAL') || ucName.includes('BEL') || ucName.includes('NAVY')) return { sector: 'DEFENSE', indexKey: 'NIFTY_NEXT_50' };
    if (ucName.includes('FMCG') || ucName.includes('HUL') || ucName.includes('ITC') || ucName.includes('FOOD')) return { sector: 'FMCG', indexKey: 'NIFTY_FMCG' };
    if (ucName.includes('POWER') || ucName.includes('ENERGY') || ucName.includes('ADANI') || ucName.includes('OIL')) return { sector: 'ENERGY', indexKey: 'NIFTY_NEXT_50' };
    if (ucName.includes('PHARMA') || ucName.includes('HEALTH') || ucName.includes('DR')) return { sector: 'PHARMA', indexKey: 'NIFTY_NEXT_50' };
    if (ucName.includes('INFRA') || ucName.includes('L&T') || ucName.includes('CONST')) return { sector: 'INFRA', indexKey: 'NIFTY_NEXT_50' };

    return { sector: 'GROWTH', indexKey: 'NIFTY_NEXT_50' };
}
