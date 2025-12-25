import { useState, useEffect, useCallback, useRef } from 'react';
import {
    INITIAL_STATE,
    transition,
    MachineState,
    ChatState
} from '@/lib/chatbot-state-machine';
import { ComputeResult } from '@/lib/decision-compute-engine';

const STORAGE_KEY = 'decision-chatbot-v1';

export function useDecisionChatbot() {
    const [machine, setMachine] = useState<MachineState>(INITIAL_STATE);
    const [isComputing, setIsComputing] = useState(false);
    const [computeResult, setComputeResult] = useState<ComputeResult | null>(null);

    // Initial Load
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Basic schema check could go here
                setMachine(parsed);
            } catch (e) {
                console.error("Failed to load state", e);
            }
        }
    }, []);

    // Persistence
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(machine));
    }, [machine]);

    // Computation Trigger
    useEffect(() => {
        if (machine.state === ChatState.S8_COMPUTE && !isComputing && !computeResult) {
            runComputation();
        }
    }, [machine.state]);

    const runComputation = async () => {
        setIsComputing(true);
        try {
            const res = await fetch('/api/decision/compute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(machine.context)
            });
            const data = await res.json();

            if (res.ok) {
                setComputeResult(data as ComputeResult);

                // Advance to S9
                setMachine(prev => ({
                    ...prev,
                    state: ChatState.S9_RESULT,
                    history: [
                        ...prev.history,
                        { role: 'assistant', content: "Computation Complete! Here are the results:" },
                        // We can render the full result in the UI via a special component, 
                        // or serialized markdown here.
                        { role: 'assistant', content: (data as ComputeResult).trace }
                    ]
                }));
            } else {
                setMachine(prev => ({
                    ...prev,
                    state: ChatState.S7_CONFIRM, // go back
                    history: [...prev.history, { role: 'assistant', content: `Error: ${data.error}` }]
                }));
            }
        } catch (e) {
            setMachine(prev => ({
                ...prev,
                state: ChatState.S7_CONFIRM,
                history: [...prev.history, { role: 'assistant', content: "Network Error during computation." }]
            }));
        } finally {
            setIsComputing(false);
        }
    };

    const sendMessage = useCallback((text: string) => {
        setMachine(prev => transition(prev, text));
        // Clear result if we are modifying (basic logic, maybe improve later)
        if (machine.state === ChatState.S9_RESULT) {
            setComputeResult(null);
        }
    }, [machine.state]);

    const reset = useCallback(() => {
        setMachine(INITIAL_STATE);
        setComputeResult(null);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    return {
        history: machine.history,
        currentState: machine.state,
        context: machine.context,
        sendMessage,
        reset,
        isComputing,
        computeResult
    };
}
