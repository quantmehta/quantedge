import { Decimal, parseInputToDecimal } from './decimal-utils';
import { Criterion, DecisionPayload } from './decision-compute-engine';
import { parseCommand, parseNumericRow, CommandPayload } from './input-parser';

export enum ChatState {
    S0_INTRO = 'S0_INTRO',
    S1_CRITERION = 'S1_CRITERION',
    S2_CONTEXT = 'S2_CONTEXT',
    S3_ALTERNATIVES = 'S3_ALTERNATIVES',
    S4_STATES = 'S4_STATES',
    S5_PAYOFFS = 'S5_PAYOFFS',
    S6_PROBABILITIES = 'S6_PROBABILITIES',
    S6B_ALPHA = 'S6B_ALPHA', // For Hurwicz
    S7_CONFIRM = 'S7_CONFIRM',
    S8_COMPUTE = 'S8_COMPUTE', // Waiting for result
    S9_RESULT = 'S9_RESULT'
}

export interface ChatContext {
    criterion?: Criterion;
    contextText?: string;
    alternatives: string[];
    states: string[];
    payoffs: string[][]; // using strings for Serializable safety
    probabilities: string[];
    alpha?: string;
    // Payoff entry tracking
    currentPayoffRowIndex: number;
}

export interface MachineState {
    state: ChatState;
    context: ChatContext;
    history: { role: 'user' | 'assistant', content: string }[];
    error?: string;
}

const INITIAL_CONTEXT: ChatContext = {
    alternatives: [],
    states: [],
    payoffs: [],
    probabilities: [],
    currentPayoffRowIndex: 0
};

export const INITIAL_STATE: MachineState = {
    state: ChatState.S0_INTRO,
    context: { ...INITIAL_CONTEXT },
    history: [{ role: 'assistant', content: "Welcome! I'm your Decision Assistant. To help you choose the best option, I need to know your preference. Are you feeling:\n- **Optimistic** (focus on best-case payouts)\n- **Conservative** (focus on avoiding the worst)\n- **Balanced** (use probabilities/EMV)\n- **Regret-Minimizing** (focus on minimizing missed opportunities)" }]
};

export const transition = (current: MachineState, input: string): MachineState => {
    // 1. Check for Commands (/reset, /set, etc)
    const command = parseCommand(input);
    if (command) {
        return handleCommand(current, command);
    }

    // 2. State-based transitions
    const next = { ...current, error: undefined };
    next.history = [...current.history, { role: 'user', content: input }];

    let response = "";

    // PROACTIVE EXTRACTION:
    // Try to find alternatives/states in the input early to skip steps.
    const extracted = extractEntities(input);

    switch (current.state) {
        case ChatState.S0_INTRO:
            // Expecting Criterion or Contextual Intro
            const crit = checkCriterion(input);
            if (crit) {
                next.context.criterion = crit;
                next.state = ChatState.S2_CONTEXT;
                response = `Criterion set to **${getFriendlyName(crit)}**. Briefly describe the decision context (e.g. "Choosing a new vendor").`;
            } else {
                // If they just started talking, maybe they gave context/alts already?
                if (extracted.alternatives.length >= 2) {
                    next.context.alternatives = extracted.alternatives;
                    if (extracted.states.length >= 2) {
                        next.context.states = extracted.states;
                        // Default to EMV if fuzzy, or ask?
                        // For now, let's just use the extracted alts/states and move to payoffs if we have both, 
                        // but we still need a criterion.
                        response = "I see your options and scenarios! Before we proceed, which approach should I take?\n- **Optimistic** (Maximize best-case)\n- **Conservative** (Minimize worst-case)\n- **Balanced** (Weighted average/EMV)\n- **Regret-Minimizing** (Minimax Regret)";
                        next.state = ChatState.S1_CRITERION;
                    } else {
                        next.state = ChatState.S4_STATES;
                        response = `I've noted your options: ${extracted.alternatives.join(', ')}. What are the different **scenarios** or **states of nature** that could happen? (e.g. "Market Boom, Market Bust")`;
                    }
                } else {
                    response = "Welcome! I'm your Decision Assistant. To help you choose the best option, I need to know your preference. Are you feeling:\n- **Optimistic** (focus on best-case payouts)\n- **Conservative** (focus on avoiding the worst)\n- **Balanced** (use probabilities/EMV)\n- **Regret-Minimizing** (focus on minimizing missed opportunities)";
                    next.state = ChatState.S0_INTRO;
                }
            }
            break;

        case ChatState.S1_CRITERION:
            const s1Crit = checkCriterion(input);
            if (s1Crit) {
                next.context.criterion = s1Crit;
                if (next.context.states.length >= 2 && next.context.alternatives.length >= 2) {
                    // We already have matrix, go to payoffs
                    next.context.payoffs = Array(next.context.alternatives.length).fill(null).map(() => Array(next.context.states.length).fill("0"));
                    next.context.currentPayoffRowIndex = 0;
                    next.state = ChatState.S5_PAYOFFS;
                    response = `Great! Let's get to the numbers. Enter payoffs for **${next.context.alternatives[0]}** for the states [${next.context.states.join(', ')}].`;
                } else {
                    next.state = ChatState.S2_CONTEXT;
                    response = `Perfect. Briefly describe the context, or just tell me your **Alternatives** (options).`;
                }
            } else {
                response = "Please pick a style: Optimistic, Conservative, Balanced, or Regret-Minimizing.";
            }
            break;

        case ChatState.S2_CONTEXT:
            next.context.contextText = input;
            // Check if input contained alts
            if (extracted.alternatives.length >= 2) {
                next.context.alternatives = extracted.alternatives;
                next.state = ChatState.S4_STATES;
                response = `Got it. Options: ${extracted.alternatives.join(', ')}. Now, what are the different **scenarios** you're considering?`;
            } else {
                next.state = ChatState.S3_ALTERNATIVES;
                response = "Got it. Now, list your **Alternatives** (options). (e.g. 'Gold, Stocks, Savings').";
            }
            break;

        case ChatState.S3_ALTERNATIVES:
            const alts = extracted.alternatives.length >= 2 ? extracted.alternatives : input.split(',').map(s => s.trim()).filter(s => s.length > 0);
            if (alts.length >= 2) {
                next.context.alternatives = alts;
                if (extracted.states.length >= 2) {
                    next.context.states = extracted.states;
                    next.context.payoffs = Array(next.context.alternatives.length).fill(null).map(() => Array(next.context.states.length).fill("0"));
                    next.context.currentPayoffRowIndex = 0;
                    next.state = ChatState.S5_PAYOFFS;
                    response = `Registered alternatives and states. Enter payoffs for **${next.context.alternatives[0]}** [${next.context.states.join(', ')}].`;
                } else {
                    next.state = ChatState.S4_STATES;
                    response = `Registered ${alts.length} alternatives. Now list the **States of Nature** (future scenarios).`;
                }
            } else {
                response = "Please provide at least 2 alternatives.";
            }
            break;

        case ChatState.S4_STATES:
            const states = extracted.states.length >= 2 ? extracted.states : input.split(',').map(s => s.trim()).filter(s => s.length > 0);
            if (states.length >= 2) {
                next.context.states = states;
                // Initialize payoffs grid
                next.context.payoffs = Array(next.context.alternatives.length).fill(null).map(() => Array(states.length).fill("0"));
                next.context.currentPayoffRowIndex = 0;

                next.state = ChatState.S5_PAYOFFS;
                const firstAlt = next.context.alternatives[0];
                response = `Registered ${states.length} states. Now let's enter payoffs.\n\nEnter payoffs for **${firstAlt}** for [${states.join(', ')}].`;
            } else {
                response = "Please provide at least 2 states.";
            }
            break;

        case ChatState.S5_PAYOFFS:
            const rowIdx = next.context.currentPayoffRowIndex;
            const rowVals = parseNumericRow(input, next.context.states.length);

            if (rowVals) {
                // Save row
                next.context.payoffs[rowIdx] = rowVals.map(d => d.toString());
                next.context.currentPayoffRowIndex++;

                if (next.context.currentPayoffRowIndex < next.context.alternatives.length) {
                    // Next row
                    const nextAlt = next.context.alternatives[next.context.currentPayoffRowIndex];
                    response = `Saved. Next, enter payoffs for **${nextAlt}** [${next.context.states.join(', ')}].`;
                } else {
                    // Done with payoffs
                    if (next.context.criterion === Criterion.EMV || next.context.criterion === Criterion.EVWPI_EVPI) {
                        next.state = ChatState.S6_PROBABILITIES;
                        response = `Payoffs recorded. Since you chose **${getFriendlyName(next.context.criterion)}**, I need **Probabilities** for the states [${next.context.states.join(', ')}]. \nEnter ${next.context.states.length} decimal values summing to 1.`;
                    } else if (next.context.criterion === Criterion.HURWICZ) {
                        next.state = ChatState.S6B_ALPHA;
                        response = `Payoffs recorded. For the **Hurwicz** approach, I need your **Alpha** (optimism coefficient). \n\n- **1.0** is completely optimistic (Maximax)\n- **0.0** is completely conservative (Maximin)\n- **0.5** is exactly in the middle.\n\nWhat's your alpha? (0 to 1)`;
                    } else {
                        next.state = ChatState.S7_CONFIRM;
                        response = generateSummary(next.context);
                    }
                }
            } else {
                response = `Invalid input. Please enter exactly ${next.context.states.length} numbers separated by commas for **${next.context.alternatives[rowIdx]}**.`;
            }
            break;

        case ChatState.S6_PROBABILITIES:
            const probs = parseNumericRow(input, next.context.states.length);
            if (probs) {
                const sum = probs.reduce((a, b) => a.plus(b), new Decimal(0));
                if (sum.equals(1) || (sum.gt(0.99) && sum.lt(1.01))) {
                    next.context.probabilities = probs.map(p => p.toString());
                    next.state = ChatState.S7_CONFIRM;
                    response = generateSummary(next.context);
                } else {
                    response = `Probabilities sum to **${sum.toString()}**, but must equal 1. Please re-enter exactly ${next.context.states.length} numbers summing to 1, or type **/normalize** to have me fix it.`;
                }
            } else {
                response = `Invalid input. Please enter ${next.context.states.length} probabilities separated by commas.`;
            }
            break;

        case ChatState.S6B_ALPHA:
            try {
                const alphaVal = parseInputToDecimal(input);
                if (alphaVal.lt(0) || alphaVal.gt(1)) {
                    response = "Alpha must be between 0 and 1. Please re-enter.";
                } else {
                    next.context.alpha = alphaVal.toString();
                    next.state = ChatState.S7_CONFIRM;
                    response = generateSummary(next.context);
                }
            } catch (e) {
                response = "Invalid number. Please enter a value between 0 and 1 for Alpha.";
            }
            break;

        case ChatState.S7_CONFIRM:
            if (input.toLowerCase() === 'yes' || input.toLowerCase() === 'run' || input.toLowerCase() === 'compute') {
                next.state = ChatState.S8_COMPUTE;
                response = "Computing...";
                // In UI, useEffect will trigger API call when state is S8_COMPUTE
            } else {
                response = generateSummary(next.context) + "\n\n(Type 'run' to compute, or use /set commands to edit info)";
            }
            break;

        // S9_RESULT is terminal-ish, but user can assume edits.
        case ChatState.S9_RESULT:
            response = "You can edit the matrix using /set commands, or /reset to start over.";
            break;

        default:
            response = "I'm not sure what to do in this state. Try /reset.";
    }

    next.history.push({ role: 'assistant', content: response });
    return next;
};

// --- Helpers ---

const getFriendlyName = (crit: Criterion): string => {
    switch (crit) {
        case Criterion.MAXIMAX: return "Optimistic (Maximax)";
        case Criterion.MAXIMIN: return "Conservative (Maximin)";
        case Criterion.EMV: return "Balanced (EMV)";
        case Criterion.MINIMAX_REGRET: return "Regret-Minimizing (Minimax Regret)";
        case Criterion.LAPLACE: return "Equally Likely (Laplace)";
        case Criterion.HURWICZ: return "Weighted (Hurwicz)";
        case Criterion.EVWPI_EVPI: return "Value of Information (EVPI)";
        default: return crit;
    }
};

const checkCriterion = (input: string): Criterion | null => {
    const norm = input.toUpperCase();
    if (norm.includes('OPTIMIST') || norm.includes('MAXIMAX')) return Criterion.MAXIMAX;
    if (norm.includes('CONSERVATIVE') || norm.includes('PESSIMIST') || norm.includes('CAUTIOUS') || norm.includes('MAXIMIN')) return Criterion.MAXIMIN;
    if (norm.includes('REGRET')) return Criterion.MINIMAX_REGRET;
    if (norm.includes('BALANCED') || norm.includes('EMV')) return Criterion.EMV;
    if (norm.includes('LAPLACE') || norm.includes('EQUALLY') || norm.includes('AVERAGE')) return Criterion.LAPLACE;
    if (norm.includes('HURWICZ') || norm.includes('COEFFICIENT')) return Criterion.HURWICZ;
    if (norm.includes('EVPI') || norm.includes('INFORMATION VALUE') || norm.includes('EVWPI')) return Criterion.EVWPI_EVPI;

    // Direct matches
    if (Object.values(Criterion).includes(norm.replace(/\s/g, '_') as any)) return norm.replace(/\s/g, '_') as Criterion;

    return null;
};

/**
 * Rudimentary Entity Extraction
 * Looks for patterns like "between X and Y" or lists.
 */
function extractEntities(text: string): { alternatives: string[], states: string[] } {
    const alts: string[] = [];
    const states: string[] = [];

    const norm = text.toLowerCase();

    // 1. Alternatives check: "between A and B" or "Options: A, B"
    const betweenMatch = norm.match(/between\s+([\w\s,]+)\s+and\s+([\w\s]+)/i);
    if (betweenMatch) {
        const list = betweenMatch[1].split(',').concat(betweenMatch[2]);
        list.forEach(item => alts.push(item.trim()));
    }

    // 2. States check: "if X happens" or "scenario Y"
    const scenarioMatches = norm.matchAll(/scenario\s+([\w\s]+)|if\s+([\w\s]+)\s+(happens|occurs|is)/gi);
    for (const match of scenarioMatches) {
        states.push((match[1] || match[2]).trim());
    }

    // fallback: if it's a comma separated list without "between", check if it looks like alts or states
    if (alts.length < 2 && text.includes(',')) {
        const potential = text.split(',').map(s => s.trim()).filter(s => s.length > 3);
        if (potential.length >= 2) {
            // Heuristic: if they mention "market" or "demand" it's likely states
            if (norm.includes('market') || norm.includes('demand') || norm.includes('interest')) {
                states.push(...potential);
            } else {
                alts.push(...potential);
            }
        }
    }

    return {
        alternatives: Array.from(new Set(alts)).slice(0, 10),
        states: Array.from(new Set(states)).slice(0, 10)
    };
}

const handleCommand = (current: MachineState, cmd: CommandPayload): MachineState => {
    const next = { ...current };

    if (cmd.type === 'RESET') {
        return {
            ...INITIAL_STATE,
            history: [...current.history,
            { role: 'user', content: cmd.raw },
            { role: 'assistant', content: "Assistant reset. Please choose your style: **Optimistic**, **Conservative**, **Balanced**, or **Regret-Minimizing**." }]
        };
    }

    // Logic for other commands
    let reply = `Command ${cmd.type} received.`;

    if (cmd.type === 'NORMALIZE_PROBS' && current.state === ChatState.S6_PROBABILITIES) {
        // Simple normalization
        const probs = current.history[current.history.length - 1].content.split(',').map(s => {
            try { return parseInputToDecimal(s); } catch { return new Decimal(0); }
        }).filter(d => !d.isZero());

        if (probs.length === current.context.states.length) {
            const sum = probs.reduce((a, b) => a.plus(b), new Decimal(0));
            next.context.probabilities = probs.map(p => p.div(sum).toString());
            next.state = ChatState.S7_CONFIRM;
            reply = "Probabilities normalized to sum to 1. " + generateSummary(next.context);
        } else {
            reply = `Normalization failed. I need exactly ${current.context.states.length} numbers to normalize.`;
        }
    }

    if (cmd.type === 'SET_CRITERION') {
        const crit = checkCriterion(cmd.value);
        if (crit) {
            next.context.criterion = crit;
            reply = `Criterion updated to **${getFriendlyName(crit)}**.`;
            // If we were at summary, regenerate it
            if (next.state === ChatState.S7_CONFIRM || next.state === ChatState.S9_RESULT) {
                reply += "\n\n" + generateSummary(next.context);
            }
        } else {
            reply = `Unknown criterion: ${cmd.value}`;
        }
    }

    if (cmd.type === 'SET_PAYOFF') {
        // Logic for setting specific payoff
        // row: string (alt), col: string (state), value: string
        const { row: alt, col: state, value } = cmd;
        const aIdx = next.context.alternatives.findIndex(a => a.toLowerCase() === (alt as string)?.toLowerCase());
        const sIdx = next.context.states.findIndex(s => s.toLowerCase() === (state as string)?.toLowerCase());

        if (aIdx !== -1 && sIdx !== -1) {
            try {
                const dec = parseInputToDecimal(value);
                next.context.payoffs[aIdx][sIdx] = dec.toString();
                reply = `Updated payoff for ${next.context.alternatives[aIdx]} in ${next.context.states[sIdx]} to ${dec.toString()}.`;
                if (next.state === ChatState.S7_CONFIRM || next.state === ChatState.S9_RESULT) {
                    reply += "\n\n" + generateSummary(next.context);
                }
            } catch (e) {
                reply = "Invalid value for payoff.";
            }
        } else {
            reply = `Could not find alternative "${alt}" or state "${state}".`;
        }
    }

    if (cmd.type === 'SET_CONTEXT') {
        next.context.contextText = cmd.value;
        reply = "Context updated.";
    }

    next.history.push({ role: 'assistant', content: reply });
    return next;
};

const generateSummary = (ctx: ChatContext): string => {
    let s = `**Decision Summary**\n\n`;
    s += `**Approach**: ${getFriendlyName(ctx.criterion!)}\n`;
    if (ctx.alpha) s += `**Alpha (α)**: ${ctx.alpha}\n`;
    s += `**Options**: ${ctx.alternatives.join(', ')}\n`;
    s += `**Scenarios**: ${ctx.states.join(', ')}\n`;
    if (ctx.probabilities.length > 0) s += `**Probabilities**: [${ctx.probabilities.join(', ')}]\n`;
    s += "\nEverything look correct?";
    return s + "\nType **run** to compute.";
};
