// server.js - simple Express wrapper so you can run the Vercel style API locally
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import fs from 'fs';
import apiHandler from './db.js'; // imports default export
import authHandler from './auth.js';

// Load .env.local if present (simple parser) so process.env.MONGODB_URI is populated
try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const eq = trimmed.indexOf('=');
            if (eq === -1) return;
            const key = trimmed.slice(0, eq).trim();
            let val = trimmed.slice(eq + 1).trim();
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            if (!(key in process.env)) process.env[key] = val;
        });
        console.log('Loaded .env.local into process.env');
    }
} catch (e) {
    console.warn('Could not load .env.local:', e.message);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (index.html, main.js, etc.)
app.use(express.static(path.join(__dirname)));

// Mount the API endpoint that mimics Vercel's serverless function interface.
app.all('/api/db', async (req, res) => {
    // the handler in api/db.js expects (request, response)-like objects.
    // our express req/res are compatible enough. Just call it.
    try {
        await apiHandler(req, res);
    } catch (err) {
        console.error('API handler error:', err);
        res.status(500).json({ error: String(err) });
    }
});

app.all('/api/auth', async (req, res) => {
    try {
        await authHandler(req, res);
    } catch (err) {
        console.error('Auth handler error:', err);
        res.status(500).json({ error: String(err) });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Local server running at http://localhost:${port}`);
});
