// api/auth.js  — Vercel Serverless Function

function timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) {
        let diff = 0;
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
        }
        return false;
    }
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

    if (!process.env.ADMIN_PASSWORD) {
        console.warn('WARNING: ADMIN_PASSWORD is not set — using default "admin123". Set it in Vercel Environment Variables.');
    }

    const usernameOk = timingSafeEqual(username, adminUser);
    const passwordOk = timingSafeEqual(password, adminPass);

    if (!usernameOk || !passwordOk) {
        return res.status(401).json({ error: 'Invalid Admin Credentials' });
    }

    return res.status(200).json({
        username: 'Admin',
        role: 'admin',
        isVerified: true,
        id: 'admin_root'
    });
}
