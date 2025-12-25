import { parseInputToDecimal, Decimal } from './decimal-utils';
import { Criterion } from './decision-compute-engine';

export type CommandType =
    | 'SET_CRITERION'
    | 'SET_CONTEXT'
    | 'SET_ALTERNATIVES'
    | 'SET_STATES'
    | 'SET_PAYOFF'
    | 'SET_PROBABILITY'
    | 'SET_ALPHA'
    | 'ADD_ALTERNATIVE'
    | 'REMOVE_ALTERNATIVE'
    | 'ADD_STATE'
    | 'REMOVE_STATE'
    | 'RESET'
    | 'NORMALIZE_PROBS'
    | 'UNKNOWN';

export interface CommandPayload {
    type: CommandType;
    value?: any;
    target?: string; // For alt/state names
    row?: number | string;
    col?: number | string;
    raw: string;
}

export const parseCommand = (input: string): CommandPayload | null => {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) return null;

    const parts = trimmed.slice(1).split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(' '); // rudimentary, will need regex for better arg parsing

    if (cmd === 'reset') return { type: 'RESET', raw: input };
    if (cmd === 'normalize' && args.includes('probabilities')) return { type: 'NORMALIZE_PROBS', raw: input };

    // /set criterion = EMV
    if (cmd === 'set') {
        if (args.startsWith('criterion')) {
            const val = args.split('=')[1]?.trim().toUpperCase();
            if (val && Object.values(Criterion).includes(val as any)) {
                return { type: 'SET_CRITERION', value: val, raw: input };
            }
        }
        if (args.startsWith('context')) {
            // simplistic quote handling
            const match = args.match(/context\s*=\s*["'](.+)["']/);
            if (match) return { type: 'SET_CONTEXT', value: match[1], raw: input };
        }
        if (args.startsWith('alternatives')) {
            // expected format: = [A, B, C]
            const match = args.match(/alternatives\s*=\s*\[(.+)\]/);
            if (match) {
                const list = match[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
                return { type: 'SET_ALTERNATIVES', value: list, raw: input };
            }
        }
        if (args.startsWith('states')) {
            const match = args.match(/states\s*=\s*\[(.+)\]/);
            if (match) {
                const list = match[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
                return { type: 'SET_STATES', value: list, raw: input };
            }
        }
        // /set payoff alt="A" state="S" value=10
        if (args.startsWith('payoff')) {
            const altMatch = args.match(/alt=["'](.+?)["']/);
            const stateMatch = args.match(/state=["'](.+?)["']/);
            const valMatch = args.match(/value=([0-9.-]+)/);

            if (altMatch && stateMatch && valMatch) {
                return {
                    type: 'SET_PAYOFF',
                    row: altMatch[1],
                    col: stateMatch[1],
                    value: valMatch[1],
                    raw: input
                };
            }
        }
        // /set probability state="S" value=0.5
        if (args.startsWith('probability')) {
            const stateMatch = args.match(/state=["'](.+?)["']/);
            const valMatch = args.match(/value=([0-9.-]+)/);
            if (stateMatch && valMatch) {
                return {
                    type: 'SET_PROBABILITY',
                    col: stateMatch[1],
                    value: valMatch[1],
                    raw: input
                };
            }
        }
        // /set alpha value=0.5
        if (args.startsWith('alpha')) {
            const valMatch = args.match(/value=([0-9.-]+)/);
            if (valMatch) {
                return {
                    type: 'SET_ALPHA',
                    value: valMatch[1],
                    raw: input
                };
            }
        }
    }

    if (cmd === 'add') {
        if (args.startsWith('alternative')) {
            const match = args.match(/alternative\s+["'](.+)["']/);
            if (match) return { type: 'ADD_ALTERNATIVE', value: match[1], raw: input };
        }
        if (args.startsWith('state')) {
            const match = args.match(/state\s+["'](.+)["']/);
            if (match) return { type: 'ADD_STATE', value: match[1], raw: input };
        }
    }

    if (cmd === 'remove') {
        if (args.startsWith('alternative')) {
            const match = args.match(/alternative\s+["'](.+)["']/);
            if (match) return { type: 'REMOVE_ALTERNATIVE', value: match[1], raw: input };
        }
        if (args.startsWith('state')) {
            const match = args.match(/state\s+["'](.+)["']/);
            if (match) return { type: 'REMOVE_STATE', value: match[1], raw: input };
        }
    }

    return { type: 'UNKNOWN', raw: input };
};

// Heuristic parser for matrix rows
// "100, 200, -50" -> Decimal[]
export const parseNumericRow = (input: string, expectedLength?: number): Decimal[] | null => {
    // Split by comma or space
    const items = input.split(/[,	\s]+/).filter(x => x.trim() !== '');

    if (expectedLength && items.length !== expectedLength) {
        return null; // Strict length check often helps avoid misparsing text as numbers
    }

    try {
        return items.map(i => parseInputToDecimal(i));
    } catch {
        return null;
    }
}
