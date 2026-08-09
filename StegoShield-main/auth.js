// api/auth.js
// Server-side admin login. Previously main.js checked
// `username === 'admin' && password === 'admin123'` directly in the browser,
// which means anyone could read the credentials straight out of the page
// source and didn't even need them — they could just forge the resulting
// state in devtools. This endpoint moves the check server-side so the
// credentials never ship to the client at all.

function timingSafeEqual(a, b) {
    // Avoid short-circuiting string comparison, which leaks timing info
    // about how many leading characters matched.
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) {
        // Still do a comparison of equal-ish length to keep timing roughly
        // constant regardless of whether lengths matched.
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
        console.warn(
            'WARNING: ADMIN_PASSWORD is not set in .env.local — using the default "admin123". ' +
            'Set ADMIN_USERNAME and ADMIN_PASSWORD before deploying this anywhere real.'
        );
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
