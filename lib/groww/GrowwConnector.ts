/**
 * Groww Connector - Handles Python CLI communication
 * Uses child_process to spawn Python and exchange JSON payloads
 */
import { spawn } from 'child_process';
import path from 'path';
import crypto from 'crypto';
import { PythonResponse } from './GrowwContracts';
import { GrowwClientError, GrowwErrorType } from './GrowwErrors';

// Path to the Python CLI module (run as module, not script)
const PYTHON_MODULE = 'python.quantedge_groww.cli';
const TIMEOUT_MS = 60000; // 60s timeout for network calls (increased for cold cache)

export class GrowwConnector {

    /**
     * Sends a command to the Python CLI and returns the parsed response.
     * @param command - The command name (e.g., 'ltp_batch', 'holdings')
     * @param payload - The command parameters
     */
    static async callPython(command: string, payload: any): Promise<any> {
        return new Promise((resolve, reject) => {
            // Use 'py -m' to run as a module (handles imports correctly)
            const pythonProcess = spawn('py', ['-m', PYTHON_MODULE], {
                cwd: process.cwd(),
                env: { ...process.env, PYTHONIOENCODING: 'utf-8' } // Ensure UTF-8
            });

            let outputData = '';
            let errorData = '';
            let completed = false;

            const input = JSON.stringify({
                command,
                payload,
                requestId: crypto.randomUUID ? crypto.randomUUID() : `req_${Date.now()}`
            });

            const timer = setTimeout(() => {
                if (!completed) {
                    completed = true;

                    // On Windows, child_process.kill() might not kill the entire tree (py -> python)
                    // We use taskkill /F /T as a more aggressive backup if it's still alive after a brief delay
                    pythonProcess.kill();
                    if (process.platform === 'win32' && pythonProcess.pid) {
                        try {
                            const { exec } = require('child_process');
                            exec(`taskkill /F /T /PID ${pythonProcess.pid}`, (err: any) => {
                                if (err) console.warn(`[GrowwConnector] taskkill failed: ${err.message}`);
                            });
                        } catch (e) { }
                    }

                    reject(new GrowwClientError({
                        type: GrowwErrorType.TIMEOUT,
                        safeMessage: `Timeout after ${TIMEOUT_MS}ms for command: ${command}`,
                        retryable: true
                    }));
                }
            }, TIMEOUT_MS);

            // Send the JSON command to stdin
            pythonProcess.stdin.write(input);
            pythonProcess.stdin.end();

            pythonProcess.stdout.on('data', (data) => {
                outputData += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorData += data.toString();
                // Log stderr but don't fail - it contains logging output
                // console.log(`[Groww Python]: ${data.toString().trim()}`);
            });

            pythonProcess.on('close', (code) => {
                if (completed) return;
                completed = true;
                clearTimeout(timer);

                if (code !== 0) {
                    // Try to parse partial JSON from stdout even if code != 0
                    const jsonStart = outputData.indexOf('{');
                    if (jsonStart !== -1) {
                        const cleanData = outputData.substring(jsonStart);
                        try {
                            const result = JSON.parse(cleanData);
                            if (result.ok === false) {
                                reject(new GrowwClientError(result.error));
                                return;
                            }
                        } catch (ignore) { }
                    }

                    reject(new GrowwClientError({
                        type: GrowwErrorType.UNKNOWN,
                        safeMessage: `Python exited with code ${code}. Stderr: ${errorData}`,
                        retryable: false
                    }));
                } else {
                    try {
                        const jsonStart = outputData.indexOf('{');
                        if (jsonStart === -1) {
                            throw new Error("No JSON object found in output");
                        }
                        const cleanData = outputData.substring(jsonStart);
                        const result = JSON.parse(cleanData);

                        if (result.ok === false) {
                            reject(new GrowwClientError(result.error));
                        } else {
                            resolve(result);
                        }
                    } catch (e) {
                        console.error("Failed JSON parse", outputData);
                        reject(new GrowwClientError({
                            type: GrowwErrorType.VALIDATION_ERROR,
                            safeMessage: `Failed to parse Python output. Raw: ${outputData.substring(0, 200)}...`,
                            retryable: false
                        }));
                    }
                }
            });

            pythonProcess.on('error', (err) => {
                if (completed) return;
                completed = true;
                clearTimeout(timer);
                reject(new GrowwClientError({
                    type: GrowwErrorType.UNKNOWN,
                    safeMessage: `Spawn error: ${err.message}`,
                    retryable: true
                }));
            });
        });
    }

    // Alias for backwards compatibility
    static async paramsToPython(command: string, payload: any): Promise<any> {
        return this.callPython(command, payload);
    }
}
