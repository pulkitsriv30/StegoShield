// backend.js
// Steganalysis math, cryptographic ciphers, and image helpers

export const clamp01 = (x) => Math.max(0, Math.min(1, x));

// --- SHA-256 Pure JS Implementation (RFC 6234 compliant) ---
export function sha256(str) {
    function rightRotate(v, a) { return (v >>> a) | (v << (32 - a)); }
    let i, j;
    const words = [];
    let hash = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    const k = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    let strCopy = unescape(encodeURIComponent(str || ''));
    const len = strCopy.length;
    for (i = 0; i < len; i++) {
        words[i >> 2] |= (strCopy.charCodeAt(i) & 255) << (8 * (3 - (i % 4)));
    }
    words[len >> 2] |= 128 << (8 * (3 - (len % 4)));
    words[((len + 8) >> 6 << 4) + 15] = len * 8;

    const w = new Array(64);
    for (i = 0; i < words.length; i += 16) {
        let a = hash[0], b = hash[1], c = hash[2], d = hash[3];
        let e = hash[4], f = hash[5], g = hash[6], h = hash[7];
        for (j = 0; j < 64; j++) {
            if (j < 16) w[j] = words[i + j] | 0;
            else {
                const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
                const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
                w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
            }
            const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
            const ch = (e & f) ^ ((~e) & g);
            const temp1 = (h + S1 + ch + k[j] + w[j]) | 0;
            const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (S0 + maj) | 0;
            h = g; g = f; f = e; e = (d + temp1) | 0;
            d = c; c = b; b = a; a = (temp1 + temp2) | 0;
        }
        hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0; hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0;
        hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0; hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0;
    }
    return hash.map(x => ('00000000' + (x >>> 0).toString(16)).slice(-8)).join('');
}

function getKeystream(key, length) {
    const bytes = [];
    let counter = 0;
    while (bytes.length < length) {
        const h = sha256(key + ':' + counter);
        for (let i = 0; i < h.length && bytes.length < length; i += 2) {
            bytes.push(parseInt(h.substring(i, i + 2), 16));
        }
        counter++;
    }
    return bytes;
}

// --- Steganographic Encryption / Decryption ---
export function encryptMessage(text, key) {
    const effectiveKey = key && key.trim() ? key.trim() : 'default';
    const textBytes = new TextEncoder().encode(text);
    const keystream = getKeystream(effectiveKey, textBytes.length);
    const checksum = sha256(text).slice(0, 8);
    const cipherHex = [];
    for (let i = 0; i < textBytes.length; i++) {
        cipherHex.push(('00' + (textBytes[i] ^ keystream[i]).toString(16)).slice(-2));
    }
    return 'ENC:' + checksum + ':' + cipherHex.join('');
}

export function decryptMessage(payload, key) {
    if (!payload) return { success: false, error: 'NO_PAYLOAD' };
    const effectiveKey = key && key.trim() ? key.trim() : 'default';

    // Legacy or unencrypted payload
    if (!payload.startsWith('ENC:')) {
        return { success: true, text: payload, legacy: true };
    }

    const parts = payload.split(':');
    if (parts.length !== 3) {
        return { success: false, error: 'MALFORMED_PAYLOAD' };
    }

    const expectedChecksum = parts[1];
    const cipherHex = parts[2];
    const cipherBytes = [];
    for (let i = 0; i < cipherHex.length; i += 2) {
        cipherBytes.push(parseInt(cipherHex.substring(i, i + 2), 16));
    }

    const keystream = getKeystream(effectiveKey, cipherBytes.length);
    const decryptedBytes = new Uint8Array(cipherBytes.length);
    for (let i = 0; i < cipherBytes.length; i++) {
        decryptedBytes[i] = cipherBytes[i] ^ keystream[i];
    }

    let decryptedText = '';
    try {
        decryptedText = new TextDecoder().decode(decryptedBytes);
    } catch (e) {
        return { success: false, error: 'INVALID_KEY' };
    }

    const actualChecksum = sha256(decryptedText).slice(0, 8);
    if (actualChecksum !== expectedChecksum) {
        return { success: false, error: 'INVALID_KEY' };
    }

    return { success: true, text: decryptedText };
}

// --- Steganalysis Algorithms ---

// 1. Direct Signature Detection in LSB Plane
export function checkLsbSignature(rgbaData) {
    let currentByte = 0;
    let bitCount = 0;
    let text = '';
    const maxBytesToCheck = Math.min(rgbaData.length, 120000);

    for (let j = 0; j < maxBytesToCheck; j += 4) {
        for (let k = 0; k < 3; k++) {
            currentByte = (currentByte << 1) | (rgbaData[j + k] & 1);
            bitCount++;
            if (bitCount === 8) {
                if (currentByte >= 32 && currentByte <= 126) {
                    text += String.fromCharCode(currentByte);
                } else {
                    text = '';
                }
                if (text.includes('###END###') || text.includes('ENC:')) {
                    return true;
                }
                if (text.length > 50) text = text.slice(-20);
                currentByte = 0;
                bitCount = 0;
            }
        }
    }
    return false;
}

// 2. Westfeld Pairs-of-Values (PoV) Chi-Square
export function povChiSquareScore(gray) {
    const counts = new Array(256).fill(0);
    const sampleSize = Math.min(gray.length, 100000);
    for (let i = 0; i < sampleSize; i++) {
        counts[gray[i]]++;
    }
    let chi = 0;
    let kCount = 0;
    for (let k = 0; k < 128; k++) {
        const c0 = counts[2 * k];
        const c1 = counts[2 * k + 1];
        const sum = c0 + c1;
        if (sum > 10) {
            const diff = c0 - c1;
            chi += (diff * diff) / sum;
            kCount++;
        }
    }
    const rChi = kCount > 0 ? chi / kCount : 10;
    // For random LSB, rChi approaches ~1.0; natural images typically have rChi > 2.5
    return { rChi, kCount };
}

export function chiSquareLSBScore(gray) {
    const { rChi } = povChiSquareScore(gray);
    // In random LSB replacement, rChi clusters tightly around 1.0 (e.g. 0.8 to 1.25).
    // In natural images, rChi is typically > 1.4 or higher.
    const diff = Math.abs(rChi - 1.0);
    if (diff < 0.20) {
        return clamp01(0.85 + (0.20 - diff) * 0.75); // 0.85 to 1.0
    } else if (diff < 0.40) {
        return clamp01((0.40 - diff) / 0.20 * 0.50); // 0.0 to 0.50
    }
    return 0;
}

export function rsFlipScore(gray, width, height) {
    let Rm = 0, Sm = 0, R_m = 0, S_m = 0;
    const mask = [0, 1, 1, 0];
    function f(g) { return Math.abs(g[0] - g[1]) + Math.abs(g[1] - g[2]) + Math.abs(g[2] - g[3]); }
    function flipP(val) { return val ^ 1; }
    function flipN(val) { return (val % 2 === 0) ? val - 1 : val + 1; }

    const maxH = Math.min(height, 200);
    const maxW = Math.min(width, 200);
    for (let y = 0; y < maxH; y++) {
        for (let x = 0; x < maxW - 4; x += 4) {
            const idx = y * width + x;
            const g = [gray[idx], gray[idx + 1], gray[idx + 2], gray[idx + 3]];
            const base = f(g);

            const gM = [mask[0] ? flipP(g[0]) : g[0], mask[1] ? flipP(g[1]) : g[1], mask[2] ? flipP(g[2]) : g[2], mask[3] ? flipP(g[3]) : g[3]];
            const fM = f(gM);
            if (fM > base) Rm++; else if (fM < base) Sm++;

            const g_M = [mask[0] ? flipN(g[0]) : g[0], mask[1] ? flipN(g[1]) : g[1], mask[2] ? flipN(g[2]) : g[2], mask[3] ? flipN(g[3]) : g[3]];
            const f_M = f(g_M);
            if (f_M > base) R_m++; else if (f_M < base) S_m++;
        }
    }
    const diffM = Rm - Sm;
    const diff_M = R_m - S_m;
    const asymmetry = Math.abs(diffM - diff_M) / Math.max(1, Rm + Sm);
    // In clean image, asymmetry is tiny (< 0.05). In stego, asymmetry is large (> 0.25).
    return clamp01(asymmetry * 2.5);
}

export function correlationDropScore(gray, width, height) {
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0, n = 0;
    const maxH = Math.min(height, 200);
    const maxW = Math.min(width, 200);
    for (let y = 0; y < maxH; y++) {
        const rowStart = y * width;
        for (let x = 0; x < maxW - 1; x++) {
            const a = gray[rowStart + x];
            const b = gray[rowStart + x + 1];
            sumX += a; sumY += b;
            sumXY += a * b;
            sumX2 += a * a; sumY2 += b * b;
            n++;
        }
    }
    if (n === 0) return 0;
    const cov = sumXY / n - (sumX / n) * (sumY / n);
    const varX = sumX2 / n - (sumX / n) ** 2;
    const varY = sumY2 / n - (sumY / n) ** 2;
    const denom = Math.sqrt(Math.max(varX, 0) * Math.max(varY, 0));
    const r = denom > 0 ? cov / denom : 0;
    return clamp01((0.95 - r) / 0.4);
}

export function rgbaToGrayscale(data, width, height, sampleStride = 1) {
    const gray = [];
    const total = width * height;
    for (let i = 0; i < total; i += sampleStride) {
        const idx = i * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        gray.push(Math.round(0.299 * r + 0.587 * g + 0.114 * b));
    }
    const eff = Math.round(Math.sqrt(gray.length));
    let w = Math.max(2, Math.round(eff));
    let h = Math.max(2, Math.round(gray.length / w));
    return { gray, width: w, height: h };
}

// Master Steganalysis Detector
export function detectStego(rgbaData, width, height) {
    // 1. Direct LSB StegoShield signature / marker scan
    const hasSig = checkLsbSignature(rgbaData);
    if (hasSig) {
        return {
            isStego: true,
            prob: 0.99,
            hasSignature: true,
            reason: 'StegoShield payload & LSB marker detected'
        };
    }

    // 2. Statistical analysis
    const stride = (width * height > 1500000) ? 2 : 1;
    const { gray, width: gw, height: gh } = rgbaToGrayscale(rgbaData, width, height, stride);
    const sChi = chiSquareLSBScore(gray);
    const sRS = rsFlipScore(gray, gw, gh);
    const sCorr = correlationDropScore(gray, gw, gh);
    const prob = clamp01(0.60 * sChi + 0.25 * sRS + 0.15 * sCorr);

    return {
        isStego: prob >= 0.45,
        prob: prob,
        hasSignature: false,
        reason: prob >= 0.45 ? 'Statistical LSB equalized anomaly detected' : 'Normal natural pixel distribution',
        details: { sChi, sRS, sCorr }
    };
}

export function escapeHtml(t) {
    return t ? String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : "";
}

// Resizes (if needed) and returns LOSSLESS PNG to preserve LSB steganography in chat
export function handleResizeAndSend(base64, sendCallback) {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
        const MAX_W = 800;
        let w = img.width, h = img.height;
        if (w > MAX_W) {
            h = Math.round(h * (MAX_W / w));
            w = MAX_W;
        } else {
            w = Math.round(w);
            h = Math.round(h);
        }
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        // CRITICAL: PNG format is required to preserve LSB bits!
        sendCallback(null, c.toDataURL('image/png'));
    };
    img.onerror = (err) => sendCallback(err);
}

