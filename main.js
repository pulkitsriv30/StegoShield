// main.js
import { DB } from './database.js';
import * as Backend from './backend.js';
import * as UI from './frontend.js';

// --- Global State ---
let currentUserData = null;
let globalSettings = { decodePassword: "default" };
let activeTab = "chat";
let authTab = "user";
let loginMode = "login";
let selectedChatUser = null;
let error = "";
let success = "";
let chatInterval = null;
let lastMessageCount = 0;

// --- Window Helpers (called from inline onclick handlers in rendered HTML) ---
window.setAuthTab = (tab) => { authTab = tab; error = ''; renderApp(); };
window.setLoginMode = (mode) => { loginMode = mode; error = ''; success = ''; renderApp(); };
window.setActiveTab = (tab) => { activeTab = tab; renderApp(); };
window.handleLogout = () => {
    if (chatInterval) clearInterval(chatInterval);
    currentUserData = null;
    activeTab = "chat"; authTab = "user"; loginMode = "login"; selectedChatUser = null;
    error = ""; success = "";
    renderApp();
};
window.selectUser = (username) => {
    selectedChatUser = username ? { username } : null;
    renderApp();
};

// --- Initialization ---
async function initApp() { renderApp(); }

// --- AUTH LOGIC ---
async function handleAuth(type, username, password) {
    renderLoading();
    error = ""; success = "";

    try {
        if (authTab === 'admin') {
            currentUserData = await DB.adminLogin(username, password);
            activeTab = "admin";
            await fetchGlobalSettings();
        } else {
            if (type === 'signup') {
                const userExists = await DB.checkUsername(username);
                if (userExists) throw new Error("Username already taken.");
                await DB.createUser({ username, password, role: 'user', isVerified: false });
                success = "Request sent to Admin. Please wait for approval.";
                loginMode = "login";
            } else {
                const user = await DB.login(username, password);
                if (!user) throw new Error("Invalid credentials, or your account is still pending approval.");
                currentUserData = user;
                activeTab = "chat";
                await fetchGlobalSettings();
            }
        }
    } catch (e) {
        console.error(e);
        error = e.message;
    }
    renderApp();
}

async function fetchGlobalSettings() {
    try { const s = await DB.getSettings(); if (s) globalSettings = s; } catch (e) { console.warn(e); }
}

function renderLoading() {
    document.getElementById('app-root').innerHTML = `<div class="flex-1 flex items-center justify-center flex-col gap-4 bg-slate-900 min-h-screen"><div class="spinner w-10 h-10"></div><p class="text-slate-400 font-mono text-sm">CONNECTING TO SECURE SERVER...</p></div>`;
}

// --- Main Render ---
function renderApp() {
    const appRoot = document.getElementById('app-root');

    if (!currentUserData) {
        appRoot.innerHTML = UI.AuthPage({ loginMode, authTab, error, success });
    } else {
        appRoot.innerHTML = UI.DashboardPage(currentUserData, activeTab);
        renderTabContent();
    }

    if (window.lucide) window.lucide.createIcons();

    const btn = document.getElementById('auth-action-btn');
    if (btn) btn.onclick = () => {
        const u = document.getElementById('u-in').value.trim();
        const p = document.getElementById('p-in').value.trim();
        if (!u || !p) { error = "All fields required"; renderApp(); return; }
        handleAuth(loginMode === 'login' || authTab === 'admin' ? 'login' : 'signup', u, p);
    };
}

function renderTabContent() {
    const c = document.getElementById('tab-content'); c.innerHTML = '';
    if (activeTab === 'chat') renderPrivateChat(c);
    else if (activeTab === 'downloads') renderDownloads(c);
    else if (activeTab === 'classifier') renderClassifier(c);
    else if (activeTab === 'decode') renderDecoder(c);
    else if (activeTab === 'encode') renderEncode(c);
    else if (activeTab === 'admin' && currentUserData.role === 'admin') renderAdminControls(c);
    if (window.lucide) window.lucide.createIcons();
}

// --- Tab: Private Chat ---
function chatIdFor(userA, userB) {
    return [userA, userB].sort().join('::');
}

async function renderPrivateChat(container) {
    if (chatInterval) { clearInterval(chatInterval); chatInterval = null; }
    lastMessageCount = 0;

    container.innerHTML = `
        <div class="flex h-full w-full pb-16 md:pb-0">
            <div class="w-80 bg-slate-900 border-r border-slate-800 flex-col shrink-0 transition-all ${selectedChatUser ? 'hidden md:flex' : 'flex w-full'}">
                <div class="p-4 border-b border-slate-800">
                    <h2 class="font-bold text-white text-lg">Contacts</h2>
                    <p class="text-xs text-slate-400 mt-1">Select a verified channel</p>
                </div>
                <div id="users-list" class="flex-1 overflow-y-auto p-2 space-y-1">
                    <div class="text-slate-500 text-sm p-4">Loading...</div>
                </div>
            </div>
            <div class="flex-1 flex-col bg-slate-950 ${!selectedChatUser ? 'hidden md:flex' : 'flex w-full'}">
                ${UI.renderChatTemplate(selectedChatUser, [], currentUserData)}
            </div>
        </div>`;

    // Fetch contacts
    const list = document.getElementById('users-list');
    if (list) {
        try {
            let contacts = [];
            if (currentUserData.role === 'admin') {
                const verified = await DB.getVerifiedUsers();
                contacts = verified.filter(u => u.username !== currentUserData.username);
            } else {
                // Regular users chat through the admin hub.
                contacts = [{ username: 'Admin', role: 'admin' }];
            }

            if (contacts.length === 0) {
                list.innerHTML = `<div class="p-4 text-center text-sm text-slate-500 border border-dashed border-slate-800 rounded mx-2 mt-2">No verified contacts yet.</div>`;
            } else {
                list.innerHTML = contacts.map(u => `
                    <div onclick="window.selectUser('${u.username}')" class="p-3 rounded-lg cursor-pointer flex items-center gap-3 border-l-4 ${selectedChatUser?.username === u.username ? 'bg-slate-800 border-blue-500' : 'border-transparent hover:bg-slate-800/50'}">
                        <div class="w-10 h-10 rounded-full ${u.role === 'admin' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'bg-slate-800 text-slate-300 border border-slate-700'} flex items-center justify-center font-bold text-sm">
                            ${u.username.charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-medium text-slate-200 truncate">${u.username}</div>
                            <div class="text-xs text-slate-500 truncate">Tap to open</div>
                        </div>
                    </div>`).join('');
            }
        } catch (e) {
            console.error('Error fetching contacts:', e);
            list.innerHTML = `<div class="p-4 text-red-400 text-sm">${e.message}</div>`;
        }
    }

    if (selectedChatUser) {
        await loadAndRenderMessages(true);
        setupChatForm();
        chatInterval = setInterval(() => loadAndRenderMessages(false), 3000);
    }
}

async function loadAndRenderMessages(scrollToBottom) {
    if (!selectedChatUser) return;
    const chatId = chatIdFor(currentUserData.username, selectedChatUser.username);
    try {
        const messages = await DB.getMessages(chatId);
        if (messages.length === lastMessageCount) return; // no change, skip re-render
        lastMessageCount = messages.length;

        const pane = document.querySelector('#tab-content .flex-1.flex-col.bg-slate-950, #tab-content .flex-1.flex.flex-col.bg-slate-950');
        const target = pane || document.getElementById('tab-content');
        if (target) target.innerHTML = UI.renderChatTemplate(selectedChatUser, messages, currentUserData);
        setupChatForm();
        if (window.lucide) window.lucide.createIcons();

        const msgBox = document.getElementById('chat-messages');
        if (msgBox && scrollToBottom !== false) msgBox.scrollTop = msgBox.scrollHeight;
    } catch (e) {
        console.error('Error loading messages:', e);
    }
}

function setupChatForm() {
    const chatId = chatIdFor(currentUserData.username, selectedChatUser.username);

    const form = document.getElementById('chat-form');
    if (form) form.onsubmit = async (e) => {
        e.preventDefault();
        const input = document.getElementById('text-input');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        try {
            await DB.sendMessage({ chatId, text, sender: currentUserData.username, timestamp: Date.now(), type: 'text' });
            await loadAndRenderMessages(true);
        } catch (err) {
            console.error('Error sending message:', err);
        }
    };

    const imgInput = document.getElementById('img-input');
    if (imgInput) imgInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            Backend.handleResizeAndSend(reader.result, async (err, resizedDataUrl) => {
                if (err) return console.error(err);
                try {
                    await DB.sendMessage({ chatId, imageUrl: resizedDataUrl, sender: currentUserData.username, timestamp: Date.now(), type: 'image' });
                    await loadAndRenderMessages(true);
                } catch (sendErr) {
                    console.error('Error sending image:', sendErr);
                }
            });
        };
        reader.readAsDataURL(file);
        imgInput.value = '';
    };
}

// --- Tab: Downloads (Gallery) ---
async function renderDownloads(c) {
    c.innerHTML = `<div class="p-8 max-w-6xl mx-auto"><h2 class="text-2xl font-bold text-white mb-8">Public Gallery</h2><div id="gallery-grid" class="grid grid-cols-1 md:grid-cols-3 gap-6"><div class="col-span-full text-center text-slate-500 py-10">Loading...</div></div></div>`;
    try {
        const items = await DB.getGallery();
        const g = document.getElementById('gallery-grid');
        if (g) g.innerHTML = items.length
            ? items.map(i => `<div class="bg-slate-800 rounded-xl overflow-hidden border border-slate-700"><img src="${i.imageUrl}" class="w-full h-48 object-cover"><div class="p-4"><div class="font-bold text-white">${i.title || 'Artifact'}</div><a href="${i.imageUrl}" download="stego_${i.timestamp}.png" class="text-xs text-blue-400 hover:underline">Download</a></div></div>`).join('')
            : '<div class="col-span-full text-center text-slate-500 py-10">No artifacts found</div>';
    } catch (e) { console.error(e); }
}

// --- Tab: Classifier (AI Steganalysis) ---
function renderClassifier(c) {
    c.innerHTML = `
        <div class="p-8 max-w-2xl mx-auto">
            <h2 class="text-2xl font-bold text-white mb-2">AI Steganalysis</h2>
            <p class="text-slate-400 text-sm mb-6">Deep statistical anomaly and LSB payload detection engine.</p>
            <div class="bg-slate-800/50 rounded-2xl border border-slate-700 p-8">
                <input type="file" id="cl-f" class="hidden" accept="image/*" />
                <label for="cl-f" class="cursor-pointer flex flex-col items-center gap-4 py-8 border-2 border-dashed border-slate-600 rounded-xl hover:bg-slate-700/50 hover:border-blue-500 transition-colors">
                    <div class="w-16 h-16 bg-slate-700 text-blue-400 rounded-full flex items-center justify-center">
                        ${UI.renderIcon('Scan', 'w-8 h-8')}
                    </div>
                    <div class="text-center">
                        <p class="font-bold text-slate-300">Select Image to Analyze</p>
                        <p class="text-xs text-slate-500 mt-1">PNG, JPG, WEBP formats supported</p>
                    </div>
                </label>
                <div id="cl-r" class="hidden mt-6 pt-6 border-t border-slate-700"></div>
            </div>
        </div>`;

    const f = document.getElementById('cl-f');
    if (f) f.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const img = new Image();
        img.src = URL.createObjectURL(file);
        const r = document.getElementById('cl-r');
        r.classList.remove('hidden');
        r.innerHTML = '<div class="text-center py-4"><span class="text-blue-400 animate-pulse font-mono font-bold">ANALYZING LSB PLANES & METRICS...</span></div>';

        img.onload = () => {
            const cv = document.createElement('canvas');
            cv.width = img.width;
            cv.height = img.height;
            const ctx = cv.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, cv.width, cv.height);

            const result = Backend.detectStego(imgData.data, cv.width, cv.height);
            const isStego = result.isStego;
            const pct = (result.prob * 100).toFixed(1);

            r.innerHTML = `
                <div class="flex flex-col items-center text-center">
                    <div class="w-16 h-16 rounded-full flex items-center justify-center mb-3 ${isStego ? 'bg-red-500/10 text-red-500 border border-red-500/30' : 'bg-green-500/10 text-green-500 border border-green-500/30'}">
                        ${UI.renderIcon(isStego ? 'AlertTriangle' : 'CheckCircle', 'w-8 h-8')}
                    </div>
                    <h3 class="text-2xl font-bold ${isStego ? 'text-red-400' : 'text-green-400'}">
                        ${isStego ? 'STEGO DETECTED' : 'CLEAN IMAGE'}
                    </h3>
                    <p class="text-sm text-slate-300 mt-1 font-mono">Confidence: <span class="font-bold">${pct}%</span></p>
                    <p class="text-xs text-slate-400 mt-1">${result.reason}</p>

                    <div class="w-full mt-6 grid grid-cols-3 gap-3 text-left">
                        <div class="p-3 bg-slate-900/80 rounded-lg border border-slate-700">
                            <div class="text-[10px] uppercase font-bold text-slate-500">LSB Signature</div>
                            <div class="text-xs font-mono font-bold mt-1 ${result.hasSignature ? 'text-red-400' : 'text-slate-300'}">
                                ${result.hasSignature ? 'FOUND' : 'NONE'}
                            </div>
                        </div>
                        <div class="p-3 bg-slate-900/80 rounded-lg border border-slate-700">
                            <div class="text-[10px] uppercase font-bold text-slate-500">PoV χ² Equalization</div>
                            <div class="text-xs font-mono font-bold mt-1 text-slate-300">
                                ${result.details ? (result.details.sChi * 100).toFixed(0) + '%' : (result.hasSignature ? '100%' : '0%')}
                            </div>
                        </div>
                        <div class="p-3 bg-slate-900/80 rounded-lg border border-slate-700">
                            <div class="text-[10px] uppercase font-bold text-slate-500">RS Anomaly</div>
                            <div class="text-xs font-mono font-bold mt-1 text-slate-300">
                                ${result.details ? (result.details.sRS * 100).toFixed(0) + '%' : (result.hasSignature ? '100%' : '0%')}
                            </div>
                        </div>
                    </div>
                </div>`;
            if (window.lucide) window.lucide.createIcons();
        };

        img.onerror = () => {
            r.innerHTML = '<div class="text-red-400 text-center text-sm py-2">Error loading image for analysis.</div>';
        };
    };
}

// --- Tab: Decoder (Decrypt Tool) ---
function renderDecoder(c) {
    c.innerHTML = `
        <div class="p-8 max-w-xl mx-auto">
            <div class="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                <h2 class="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    ${UI.renderIcon('Unlock')} Steganography Decryption
                </h2>
                <p class="text-xs text-slate-400 mb-6">Extract and decrypt secret messages hidden within image pixels.</p>

                <div class="space-y-4">
                    <div>
                        <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Decryption Key</label>
                        <input type="password" id="dec-pass" class="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-blue-500 outline-none" placeholder="Enter key (or leave empty for Global Key)">
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Source Stego Image</label>
                        <input type="file" id="dec-in" class="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer" accept="image/*"/>
                    </div>
                    <button id="dec-btn" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold text-sm transition-all shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2">
                        ${UI.renderIcon('Unlock', 'w-4 h-4')} DECRYPT & EXTRACT
                    </button>
                </div>

                <div id="dec-out" class="mt-6 hidden"></div>
            </div>
        </div>`;

    if (window.lucide) window.lucide.createIcons();

    const btn = document.getElementById('dec-btn');
    if (btn) btn.onclick = async () => {
        const p = document.getElementById('dec-pass').value;
        const file = document.getElementById('dec-in').files[0];
        const o = document.getElementById('dec-out');

        if (!file) {
            o.className = "mt-4 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-lg";
            o.innerHTML = "Please select a source image to decrypt.";
            o.classList.remove('hidden');
            return;
        }

        o.className = "mt-4 p-4 bg-slate-900 border border-slate-700 text-blue-400 text-sm font-mono rounded-lg text-center animate-pulse";
        o.innerHTML = "EXTRACTING LSB BITS...";
        o.classList.remove('hidden');

        await fetchGlobalSettings();
        const keyToUse = (p && p.trim()) ? p.trim() : (globalSettings.decodePassword || 'default');

        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const cv = document.createElement('canvas');
            cv.width = img.width;
            cv.height = img.height;
            const ctx = cv.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const d = ctx.getImageData(0, 0, cv.width, cv.height).data;

            // Fast LSB extraction directly into byte array
            let currentByte = 0;
            let bitCount = 0;
            const chars = [];
            let foundEnd = false;

            for (let j = 0; j < d.length; j += 4) {
                for (let k = 0; k < 3; k++) {
                    currentByte = (currentByte << 1) | (d[j + k] & 1);
                    bitCount++;
                    if (bitCount === 8) {
                        if (currentByte === 0) {
                            foundEnd = true;
                            break;
                        }
                        chars.push(String.fromCharCode(currentByte));
                        currentByte = 0;
                        bitCount = 0;

                        if (chars.length >= 9 && chars.slice(-9).join('') === '###END###') {
                            foundEnd = true;
                            break;
                        }
                    }
                }
                if (foundEnd) break;
            }

            const rawString = chars.join('');
            const endIdx = rawString.indexOf('###END###');

            if (endIdx === -1 && chars.length === 0) {
                o.className = "mt-4 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm rounded-lg";
                o.innerHTML = "<strong>No StegoShield Data:</strong> No hidden message or delimiter was found in this image.";
                return;
            }

            const payload = endIdx !== -1 ? rawString.substring(0, endIdx) : rawString;
            const decResult = Backend.decryptMessage(payload, keyToUse);

            if (decResult.success) {
                o.className = "mt-4 p-4 bg-green-500/10 border border-green-500/30 text-slate-200 text-sm rounded-lg";
                o.innerHTML = `
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-bold text-green-400 uppercase font-mono flex items-center gap-1">
                            ${UI.renderIcon('CheckCircle', 'w-4 h-4')} DECRYPTION SUCCESSFUL
                        </span>
                        <button onclick="navigator.clipboard.writeText(document.getElementById('dec-msg-val').innerText); alert('Copied to clipboard!');" class="text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded border border-slate-600 transition-colors">
                            COPY
                        </button>
                    </div>
                    <div id="dec-msg-val" class="font-mono text-sm bg-slate-950 p-3 rounded border border-slate-800 text-white break-words select-all">${Backend.escapeHtml(decResult.text)}</div>`;
            } else {
                o.className = "mt-4 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg";
                o.innerHTML = `
                    <div class="font-bold flex items-center gap-1 mb-1">
                        ${UI.renderIcon('AlertCircle', 'w-4 h-4')} INVALID DECRYPTION KEY
                    </div>
                    <p class="text-xs text-red-300/80">The provided key does not match the key used to encrypt this artifact.</p>`;
            }
            if (window.lucide) window.lucide.createIcons();
        };

        img.onerror = () => {
            o.className = "mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg";
            o.innerHTML = "Error loading the selected image file.";
        };
    };
}

// --- Tab: Encode & Encrypt Tool ---
function renderEncode(c) {
    const isAdmin = currentUserData.role === 'admin';
    c.innerHTML = `
        <div class="p-8 max-w-xl mx-auto">
            <div class="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                <h2 class="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    ${UI.renderIcon('Lock')} Encrypt & Hide Payload
                </h2>
                <p class="text-xs text-slate-400 mb-6">Embed an encrypted secret message into image pixels using LSB steganography.</p>

                <div class="space-y-4">
                    <div>
                        <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cover Image</label>
                        <input type="file" id="enc-f" class="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer" accept="image/*">
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Secret Message</label>
                        <textarea id="enc-m" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white outline-none focus:border-blue-500" rows="3" placeholder="Enter secret message to hide..."></textarea>
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Encryption Key / Password</label>
                        <input type="password" id="enc-pass" class="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-blue-500 outline-none" placeholder="Enter custom key (or leave empty for Global Key)">
                    </div>

                    ${isAdmin ? `
                    <div class="flex items-center gap-2 pt-1">
                        <input type="checkbox" id="enc-pub" checked class="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-blue-500">
                        <label for="enc-pub" class="text-xs text-slate-300 cursor-pointer">Also publish artifact to Public Gallery</label>
                    </div>` : ''}

                    <button id="enc-btn" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold text-sm transition-all shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2">
                        ${UI.renderIcon('Lock', 'w-4 h-4')} ENCODE & ENCRYPT
                    </button>
                </div>

                <div id="enc-stat" class="mt-6 hidden"></div>
            </div>
        </div>`;

    if (window.lucide) window.lucide.createIcons();

    const btn = document.getElementById('enc-btn');
    if (btn) btn.onclick = () => {
        const file = document.getElementById('enc-f').files[0];
        const m = document.getElementById('enc-m').value;
        const pass = document.getElementById('enc-pass').value;
        const stat = document.getElementById('enc-stat');

        if (!file) {
            stat.className = "mt-4 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-lg block";
            stat.innerHTML = "Please select a cover image.";
            return;
        }
        if (!m || !m.trim()) {
            stat.className = "mt-4 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-lg block";
            stat.innerHTML = "Please enter a secret message to hide.";
            return;
        }

        stat.className = "mt-4 p-3 bg-slate-900 border border-slate-700 text-blue-400 text-xs font-mono rounded-lg block text-center animate-pulse";
        stat.innerHTML = "ENCRYPTING & EMBEDDING PAYLOAD...";

        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = async () => {
            await fetchGlobalSettings();
            const effectiveKey = (pass && pass.trim()) ? pass.trim() : (globalSettings.decodePassword || 'default');

            // 1. Encrypt message with key
            const encryptedPayload = Backend.encryptMessage(m.trim(), effectiveKey) + '###END###';

            // 2. Prepare integer dimensions
            const MAX_DIM = 1200;
            let w = img.width, h = img.height;
            if (w > MAX_DIM) {
                h = Math.round(h * (MAX_DIM / w));
                w = MAX_DIM;
            } else {
                w = Math.round(w);
                h = Math.round(h);
            }

            const cv = document.createElement('canvas');
            cv.width = w;
            cv.height = h;
            const ctx = cv.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const imgData = ctx.getImageData(0, 0, w, h);
            const d = imgData.data;

            // Capacity check: 3 bits per pixel (R, G, B channels)
            const availableBits = (d.length / 4) * 3;
            const neededBits = encryptedPayload.length * 8;
            if (neededBits > availableBits) {
                stat.className = "mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg block";
                stat.innerHTML = `Message too large for this image! Needed: ${neededBits} bits, Available: ${availableBits} bits.`;
                return;
            }

            // 3. Convert payload to bit string
            const bin = encryptedPayload.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join('');

            // 4. Embed bits into LSBs
            let idx = 0;
            for (let i = 0; i < d.length && idx < bin.length; i += 4) {
                for (let k = 0; k < 3 && idx < bin.length; k++) {
                    d[i + k] = (d[i + k] & 0xFE) | parseInt(bin[idx++]);
                }
            }

            ctx.putImageData(imgData, 0, 0);
            const url = cv.toDataURL('image/png');
            const downloadFilename = `stego_shield_${Date.now()}.png`;

            // 5. Optional gallery publication for admin
            const publishCheckbox = document.getElementById('enc-pub');
            let publishedText = '';
            if (isAdmin && publishCheckbox && publishCheckbox.checked) {
                try {
                    await DB.addToGallery({
                        imageUrl: url,
                        timestamp: Date.now(),
                        title: `Artifact (${new Date().toLocaleDateString()})`
                    });
                    publishedText = '<span class="text-green-400">Published to Public Gallery.</span>';
                } catch (e) {
                    console.error('Gallery publish error:', e);
                }
            }

            stat.className = "mt-4 p-4 bg-green-500/10 border border-green-500/30 text-slate-200 text-sm rounded-xl block";
            stat.innerHTML = `
                <div class="font-bold text-green-400 mb-2 flex items-center gap-1 font-mono text-xs uppercase">
                    ${UI.renderIcon('CheckCircle', 'w-4 h-4')} ENCODING & ENCRYPTION COMPLETE
                </div>
                <div class="flex items-center gap-4 mb-4">
                    <img src="${url}" class="w-20 h-20 object-cover rounded-lg border border-slate-700 shrink-0">
                    <div class="text-xs text-slate-300">
                        <p class="font-bold text-white">Payload Embedded Successfully</p>
                        <p class="text-[11px] text-slate-400 mt-0.5">Size: ${w}x${h} · LSB plane</p>
                        ${publishedText ? `<p class="mt-1">${publishedText}</p>` : ''}
                    </div>
                </div>
                <a href="${url}" download="${downloadFilename}" class="w-full bg-green-600 hover:bg-green-500 text-white py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-900/20 no-underline">
                    ${UI.renderIcon('Download', 'w-4 h-4')} DOWNLOAD ENCODED PNG
                </a>`;
            if (window.lucide) window.lucide.createIcons();
        };

        img.onerror = () => {
            stat.className = "mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg block";
            stat.innerHTML = "Error processing selected cover image.";
        };
    };
}

// --- Tab: Admin Controls ---
async function renderAdminControls(c) {
    c.innerHTML = `
        <div class="p-6 grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <div class="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                <h3 class="font-bold text-white mb-2 flex items-center gap-2">
                    ${UI.renderIcon('Clock', 'w-5 h-5 text-amber-400')} Pending User Approvals
                </h3>
                <p class="text-xs text-slate-400 mb-4">New registration requests requiring admin verification.</p>
                <div id="adm-list" class="space-y-2">Loading...</div>
            </div>

            <div class="space-y-6">
                <div class="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                    <h3 class="font-bold text-white mb-2 flex items-center gap-2">
                        ${UI.renderIcon('Key', 'w-5 h-5 text-blue-400')} Global Security Key
                    </h3>
                    <p class="text-xs text-slate-400 mb-4">Default key used for encrypting and decrypting artifacts.</p>
                    <input id="gk-in" class="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg mb-3 text-white text-sm outline-none focus:border-blue-500" placeholder="New Global Key" value="${globalSettings.decodePassword || ''}">
                    <button id="gk-save" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg shadow-blue-900/30">
                        UPDATE GLOBAL KEY
                    </button>
                </div>

                <div class="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                    <h3 class="font-bold text-white mb-2 flex items-center gap-2">
                        ${UI.renderIcon('Users', 'w-5 h-5 text-green-400')} Verified Users
                    </h3>
                    <p class="text-xs text-slate-400 mb-4">Currently active accounts in the system.</p>
                    <div id="verified-list" class="space-y-2 max-h-48 overflow-y-auto">Loading...</div>
                </div>
            </div>
        </div>`;

    if (window.lucide) window.lucide.createIcons();

    const refreshList = async () => {
        const l = document.getElementById('adm-list');
        const vl = document.getElementById('verified-list');
        if (!l) return;

        try {
            const pending = await DB.getPendingUsers();
            if (pending.length === 0) {
                l.innerHTML = '<p class="text-slate-500 text-sm p-4 text-center border border-dashed border-slate-700/50 rounded-xl">No pending approval requests.</p>';
            } else {
                l.innerHTML = pending.map(x => {
                    const id = x._id || x.id;
                    return `
                    <div class="flex justify-between items-center p-3 bg-slate-900 rounded-xl border border-slate-700/80">
                        <div>
                            <span class="font-mono text-white text-sm font-medium">${Backend.escapeHtml(x.username)}</span>
                            <span class="text-[10px] text-amber-400 block font-mono">Pending Approval</span>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="window.verify('${id}')" class="text-xs font-bold bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg shadow-sm transition-all">
                                APPROVE
                            </button>
                            <button onclick="window.reject('${id}')" class="text-xs font-bold bg-red-600/80 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg shadow-sm transition-all">
                                REJECT
                            </button>
                        </div>
                    </div>`;
                }).join('');
            }

            if (vl) {
                const verified = await DB.getVerifiedUsers();
                if (verified.length === 0) {
                    vl.innerHTML = '<p class="text-slate-500 text-sm p-3 text-center">No verified users found.</p>';
                } else {
                    vl.innerHTML = verified.map(u => {
                        const id = u._id || u.id;
                        return `
                        <div class="flex justify-between items-center p-2.5 bg-slate-900/60 rounded-lg border border-slate-700/40 text-xs">
                            <span class="font-mono text-slate-200">${Backend.escapeHtml(u.username)}</span>
                            <button onclick="window.removeVerifiedUser('${id}')" class="text-[10px] text-red-400 hover:text-red-300 font-bold px-2 py-1 hover:bg-red-500/10 rounded transition-all">
                                REMOVE
                            </button>
                        </div>`;
                    }).join('');
                }
            }
        } catch (e) {
            l.innerHTML = `<p class="text-red-400 text-sm">${e.message}</p>`;
        }
    };

    window.verify = async (id) => {
        try {
            await DB.approveUser(id);
            await refreshList();
        } catch (e) {
            console.error(e);
            alert('Error approving user: ' + e.message);
        }
    };

    window.reject = async (id) => {
        if (!confirm('Reject and delete this registration request?')) return;
        try {
            await DB.rejectUser(id);
            await refreshList();
        } catch (e) {
            console.error(e);
            alert('Error rejecting user: ' + e.message);
        }
    };

    window.removeVerifiedUser = async (id) => {
        if (!confirm('Remove this verified user account?')) return;
        try {
            await DB.deleteUser(id);
            await refreshList();
        } catch (e) {
            console.error(e);
            alert('Error deleting user: ' + e.message);
        }
    };

    const saveBtn = document.getElementById('gk-save');
    if (saveBtn) saveBtn.onclick = async () => {
        const v = document.getElementById('gk-in').value.trim();
        if (v) {
            try {
                await DB.updateSettings(globalSettings._id || globalSettings.id, v);
                await fetchGlobalSettings();
                alert('Global Security Key updated successfully.');
            } catch (e) {
                alert('Error updating key: ' + e.message);
            }
        }
    };

    await refreshList();
}

window.onload = initApp;

