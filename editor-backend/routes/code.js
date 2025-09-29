// editor-backend/routes/code.js
const router = require('express').Router();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { connection, ensureSessionExists } = require('../websockets/share');

const WORKSPACES_ROOT = path.resolve(__dirname, '..', 'workspaces');

if (!fs.existsSync(WORKSPACES_ROOT)) {
    fs.mkdirSync(WORKSPACES_ROOT, { recursive: true });
}

function runProcess(cmd, args = [], cwd, timeoutMs = 10000, opts = {}) {
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        const proc = spawn(cmd, args, { cwd, shell: true, detached: true, ...opts });

        if (opts.inputFile && fs.existsSync(path.join(cwd, opts.inputFile))) {
            const inputStream = fs.createReadStream(path.join(cwd, opts.inputFile));
            inputStream.pipe(proc.stdin);
        }

        const killTimer = setTimeout(() => {
            try {
                process.kill(-proc.pid, 'SIGKILL');
            } catch (e) {
            }
            reject(new Error('Process timed out.'));
        }, timeoutMs);

        proc.stdout.on('data', (d) => (stdout += d.toString()));
        proc.stderr.on('data', (d) => (stderr += d.toString()));

        proc.on('close', (code) => {
            clearTimeout(killTimer);
            if (code !== 0) {
                return reject(new Error(stderr || `Process exited with code ${code}`));
            }
            resolve(stdout);
        });

        proc.on('error', (err) => {
            clearTimeout(killTimer);
            reject(new Error(`Failed to start process: ${err.message}`));
        });
    });
}

router.post('/run', async (req, res) => {
    const { sessionId, lang, entrypointFile, input, files } = req.body;

    if (!sessionId || !lang) {
        return res.status(400).json('Missing sessionId or lang.');
    }

    // Check session config to enforce allowRun
    try {
        const doc = connection.get('examples', sessionId);
        await new Promise((resolve, reject) => doc.fetch(err => err ? reject(err) : resolve()));
        const cfg = (doc.data && doc.data.config) || {};
        const allowRun = (typeof cfg.allowRun === 'boolean') ? cfg.allowRun : true;
        if (!allowRun) {
            return res.status(403).json('Run is disabled by room configuration.');
        }
    } catch (e) {
        console.warn('[code/run] failed to fetch doc for run-check, proceeding (server fetch error):', e);
        // fallback: allow run (safer than rejecting); if you want stricter policy, change this
    }

    const workspacePath = path.join(WORKSPACES_ROOT, sessionId);
    const inputFilePath = path.join(workspacePath, 'input.txt');

    try {
        if (!fs.existsSync(workspacePath)) {
             return res.status(404).json('Workspace not found. Please click "Save to Workspace" first.');
        }

        await fs.promises.writeFile(inputFilePath, input || '', 'utf8');

        let output;
        if (lang === 'cpp') {
            await runProcess('g++', ['-std=c++17', '*.cpp', '-o', 'a.out'], workspacePath, 15000);
            output = await runProcess(path.join(workspacePath, 'a.out'), [], workspacePath, 5000, { inputFile: 'input.txt' });
        } else if (lang === 'python') {
            if (!entrypointFile) throw new Error('Missing entrypoint for Python.');
            output = await runProcess('python3', [entrypointFile], workspacePath, 5000, { inputFile: 'input.txt' });
        } else if (lang === 'java') {
            if (!entrypointFile) throw new Error('Missing entrypoint for Java.');
            const mainClass = path.basename(entrypointFile, '.java');
            await runProcess('javac', ['-cp', '.', '*.java'], workspacePath, 20000);
            output = await runProcess('java', ['-cp', '.', mainClass], workspacePath, 5000, { inputFile: 'input.txt' });
        } else {
            return res.status(400).json('Unsupported language.');
        }

        res.send(output);

    } catch (err) {
        console.error(`[Run Error] Session: ${sessionId}, Lang: ${lang}, Error: ${err.message}`);
        res.status(500).send(err.message || 'An unexpected error occurred during execution.');
    }
});

module.exports = router;
