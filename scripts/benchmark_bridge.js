const { spawn } = require('child_process');
const crypto = require('crypto');
const path = require('path');

const PYTHON_MODULE = 'python.quantedge_groww.cli';

function callPython(command, payload) {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('py', ['-m', PYTHON_MODULE], {
            cwd: process.cwd(),
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });

        const input = JSON.stringify({
            command,
            payload,
            requestId: crypto.randomUUID()
        });

        pythonProcess.stdin.write(input);
        pythonProcess.stdin.end();

        let outputData = '';
        pythonProcess.stdout.on('data', (d) => outputData += d.toString());
        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Code ${code}`));
                return;
            }
            try {
                const jsonStart = outputData.indexOf('{');
                if (jsonStart === -1) throw new Error("No JSON found");
                const cleanData = outputData.substring(jsonStart);
                resolve(JSON.parse(cleanData));
            } catch (err) {
                reject(new Error(`Parse error: ${err.message}. Raw: ${outputData}`));
            }
        });
        pythonProcess.on('error', (err) => reject(err));
    });
}

async function run() {
    console.log("Benchmarking Process Spawning...");
    const levels = [5, 10, 15, 20, 25, 30, 40, 50];

    for (const level of levels) {
        console.log(`\nTesting Concurrency: ${level}`);
        const start = Date.now();
        const promises = Array(level).fill(0).map(() => callPython('search_instrument', { query: 'RELIANCE' }));

        try {
            const results = await Promise.all(promises);
            console.log(`  SUCCESS: ${results.length} processes in ${Date.now() - start}ms`);
        } catch (e) {
            console.error(`  FAILED at ${level}: ${e.message}`);
            break;
        }
    }
}

run();
