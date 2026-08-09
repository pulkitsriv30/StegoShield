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
    else if (activeTab === 'encode' && currentUserData.role === 'admin') renderEncode(c);
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

// --- Tab: Classifier ---
function renderClassifier(c) {
    c.innerHTML = `<div class="p-8 max-w-2xl mx-auto"><h2 class="text-2xl font-bold text-white mb-4">AI Steganalysis</h2><input type="file" id="cl-f" class="hidden" accept="image/*" /><label for="cl-f" class="cursor-pointer block p-8 border-2 border-dashed border-slate-600 rounded-xl text-center hover:border-blue-500 transition-colors"><div class="text-slate-400">Click to upload image</div></label><div id="cl-r" class="hidden mt-6 text-center"></div></div>`;
    const f = document.getElementById('cl-f');
    if (f) f.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const img = new Image();
        img.src = URL.createObjectURL(file);
        const r = document.getElementById('cl-r');
        r.classList.remove('hidden');
        r.innerHTML = '<span class="text-blue-400">ANALYZING...</span>';
        img.onload = () => {
            const cv = document.createElement('canvas');
            cv.width = img.width; cv.height = img.height;
            const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, cv.width, cv.height);
            const stride = (cv.width * cv.height > 1_500_000) ? 2 : 1;
            const { gray, width, height } = Backend.rgbaToGrayscale(imgData.data, cv.width, cv.height, stride);
            const sChi = Backend.chiSquareLSBScore(gray);
            const sRS = Backend.rsFlipScore(gray, width, height);
            const sCorr = Backend.correlationDropScore(gray, width, height);
            const prob = Backend.clamp01(0.45 * sChi + 0.35 * sRS + 0.20 * sCorr);
            const isStego = prob >= 0.5;
            r.innerHTML = `<div class="text-xl font-bold ${isStego ? 'text-red-400' : 'text-green-400'}">${isStego ? 'STEGO DETECTED' : 'CLEAN'} (${(prob * 100).toFixed(1)}%)</div>`;
        };
    };
}

// --- Tab: Decoder ---
function renderDecoder(c) {
    c.innerHTML = `<div class="p-8 max-w-xl mx-auto"><div class="bg-slate-800/50 p-6 rounded-xl"><h2 class="text-xl font-bold text-white mb-4">Decrypt</h2><input type="password" id="dec-pass" class="w-full p-2 bg-slate-900 border border-slate-600 rounded mb-4 text-white" placeholder="Key"><input type="file" id="dec-in" class="block w-full mb-4 text-slate-400" accept="image/*"/><button id="dec-btn" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded font-bold">DECRYPT</button><div id="dec-out" class="mt-4 hidden p-4 rounded bg-slate-900 border border-slate-700 text-slate-300 break-all"></div></div></div>`;
    const btn = document.getElementById('dec-btn');
    if (btn) btn.onclick = async () => {
        const p = document.getElementById('dec-pass').value;
        const f = document.getElementById('dec-in').files[0];
        const o = document.getElementById('dec-out');
        if (!p || !f) return;
        await fetchGlobalSettings();
        if (p !== globalSettings.decodePassword) { o.innerHTML = 'INVALID KEY'; o.classList.remove('hidden'); return; }
        const i = new Image(); i.src = URL.createObjectURL(f);
        i.onload = () => {
            const cv = document.createElement('canvas'); cv.width = i.width; cv.height = i.height;
            const ctx = cv.getContext('2d'); ctx.drawImage(i, 0, 0);
            const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
            let b = "", m = ""; for (let j = 0; j < d.length; j += 4) for (let k = 0; k < 3; k++) b += (d[j + k] & 1);
            for (let j = 0; j < b.length; j += 8) { const v = parseInt(b.substr(j, 8), 2); if (v === 0) break; m += String.fromCharCode(v); }
            const e = m.indexOf("###END###");
            o.innerHTML = e !== -1 ? m.substring(0, e) : 'NO DATA';
            o.classList.remove('hidden');
        };
    };
}

// --- Tab: Admin Controls ---
async function renderAdminControls(c) {
    c.innerHTML = `<div class="p-6 grid md:grid-cols-2 gap-6"><div class="bg-slate-800/50 p-6 rounded"><h3 class="font-bold text-white mb-4">Pending Users</h3><div id="adm-list" class="space-y-2">Loading...</div></div><div class="bg-slate-800/50 p-6 rounded"><h3 class="font-bold text-white mb-4">Global Key</h3><input id="gk-in" class="w-full p-2 bg-slate-900 border border-slate-600 rounded mb-3 text-white" placeholder="New Key" value="${globalSettings.decodePassword || ''}"><button id="gk-save" class="w-full bg-blue-600 text-white py-2 rounded font-bold">SAVE</button></div></div>`;
    const refreshList = async () => {
        const l = document.getElementById('adm-list');
        if (!l) return;
        try {
            const pending = await DB.getPendingUsers();
            l.innerHTML = pending.length ? pending.map(x => `<div class="flex justify-between items-center p-3 bg-slate-900 rounded border border-slate-700"><span class="font-mono text-slate-300">${x.username}</span><button onclick="window.verify('${x._id}')" class="text-[10px] font-bold bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded">APPROVE</button></div>`).join('') : '<p class="text-slate-500 text-sm">No pending requests</p>';
        } catch (e) { l.innerHTML = `<p class="text-red-400 text-sm">${e.message}</p>`; }
    };
    window.verify = async (id) => {
        try {
            await DB.approveUser(id);
            await refreshList();
        } catch (e) { console.error(e); alert('Error approving user: ' + e.message); }
    };
    const saveBtn = document.getElementById('gk-save');
    if (saveBtn) saveBtn.onclick = async () => {
        const v = document.getElementById('gk-in').value;
        if (v) {
            try {
                await DB.updateSettings(globalSettings._id || globalSettings.id, v);
                await fetchGlobalSettings();
                alert('Saved');
            } catch (e) { alert('Error: ' + e.message); }
        }
    };
    await refreshList();
}

// --- Tab: Encode & Publish ---
function renderEncode(c) {
    c.innerHTML = `<div class="p-8 max-w-xl mx-auto"><div class="bg-slate-800/50 p-6 rounded"><h2 class="font-bold text-white mb-4">Encode & Publish</h2><input type="file" id="enc-f" class="block w-full mb-4 text-slate-400" accept="image/*"><textarea id="enc-m" class="w-full bg-slate-900 border border-slate-600 rounded p-2 mb-4 text-white" rows="3" placeholder="Secret message..."></textarea><button id="enc-btn" class="w-full bg-blue-600 text-white py-2 rounded font-bold">ENCODE</button><div id="enc-stat" class="mt-4 text-center text-sm text-slate-400"></div></div></div>`;
    const btn = document.getElementById('enc-btn');
    if (btn) btn.onclick = () => {
        const f = document.getElementById('enc-f').files[0];
        const m = document.getElementById('enc-m').value;
        if (!f || !m) return;
        const img = new Image();
        img.src = URL.createObjectURL(f);
        img.onload = async () => {
            const cv = document.createElement('canvas');
            const w = img.width > 800 ? 800 : img.width;
            const h = img.width > 800 ? img.height * (800 / img.width) : img.height;
            cv.width = w; cv.height = h;
            const ctx = cv.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const d = ctx.getImageData(0, 0, w, h).data;
            const bin = m.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join('') + "001000110010001100100011010001010100111001000100001000110010001100100011";
            let idx = 0;
            for (let i = 0; i < d.length; i += 4) for (let j = 0; j < 3; j++) { if (idx < bin.length) d[i + j] = (d[i + j] & 0xFE) | parseInt(bin[idx++]); }
            ctx.putImageData(new ImageData(d, w, h), 0, 0);
            const url = cv.toDataURL('image/png');
            const item = { imageUrl: url, timestamp: Date.now(), title: "Artifact" };
            try {
                await DB.addToGallery(item);
                const stat = document.getElementById('enc-stat');
                stat.innerHTML = "PUBLISHED";
                stat.className = "mt-4 text-center text-sm text-green-400";
            } catch (e) { console.error(e); }
        };
    };
}

window.onload = initApp;
