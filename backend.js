// backend.js
// Steganalysis math + image helpers — runs in-browser

// --- Steganalysis Math ---
export const clamp01 = (x) => Math.max(0, Math.min(1, x));

export function chiSquareLSBScore(gray) {
    const n = gray.length;
    if (n === 0) return 0;
    let ones = 0;
    for (let i = 0; i < n; i++) ones += (gray[i] & 1);
    const zeros = n - ones;
    const exp = n / 2;
    if (exp === 0) return 0;
    const chi = ((zeros - exp) ** 2) / exp + ((ones - exp) ** 2) / exp;
    const p_tail = Math.exp(-chi / 2);
    return clamp01(1 - p_tail);
}

export function rsFlipScore(gray, width, height) {
    let base = 0, flipped = 0;
    for (let y = 0; y < height; y++) {
        const rowStart = y * width;
        for (let x = 0; x < width - 1; x++) {
            const i = rowStart + x;
            const a = gray[i];
            const b = gray[i + 1];
            base += Math.abs(a - b);
            const af = (i % 2 === 0) ? (a ^ 1) : a;
            const bf = ((i + 1) % 2 === 0) ? (b ^ 1) : b;
            flipped += Math.abs(af - bf);
        }
    }
    if (base <= 0) return 0;
    const rel = (flipped - base) / base;
    return clamp01((rel - 0.02) / (0.15 - 0.02));
}

export function correlationDropScore(gray, width, height) {
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0, n = 0;
    for (let y = 0; y < height; y++) {
        const rowStart = y * width;
        for (let x = 0; x < width - 1; x++) {
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
    return clamp01((0.95 - r) / (0.95 - 0.60));
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

export function escapeHtml(t) {
    return t ? t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
}

export function handleResizeAndSend(base64, sendCallback) {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
        const MAX_W = 600;
        let w = img.width, h = img.height;
        if (w > MAX_W) { h *= MAX_W / w; w = MAX_W; }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        sendCallback(null, c.toDataURL('image/jpeg', 0.8));
    };
}
