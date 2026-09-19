// main.js - Complete Working Version
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

// --- Window Helpers ---
window.setAuthTab = (tab) => { authTab = tab; error=''; renderApp(); };
window.setLoginMode = (mode) => { loginMode = mode; error=''; success=''; renderApp(); };
window.setActiveTab = (tab) => { activeTab = tab; renderApp(); };
window.handleLogout = () => {
    if(chatInterval) clearInterval(chatInterval);
    currentUserData = null;
    activeTab = "chat"; authTab = "user"; loginMode = "login"; selectedChatUser = null;
    error = ""; success = "";
    renderApp();
};
window.selectUser = (username) => { selectedChatUser = username ? { username } : null; renderApp(); };

// --- Initialization ---
async function initApp() { renderApp(); }

// --- AUTH LOGIC ---
async function handleAuth(type, username, password) {
    renderLoading();
    error = ""; success = "";

    try {
        if (authTab === 'admin') {
            // Admin Logic
            if (username === 'admin' && password === 'admin123') {
                currentUserData = { username: 'Admin', role: 'admin', isVerified: true, id: 'admin_root' };
                activeTab = "admin";
                await fetchGlobalSettings();
            } else {
                throw new Error("Invalid Admin Credentials");
            }
        } else {
            // User Logic
            if (type === 'signup') {
                // 1. Check if user already exists
                const userExists = await DB.checkUsername(username);
                if(userExists) throw new Error("Username already taken. Please Login.");
                
                // 2. Add to pending (not users)
                await DB.createUser({ username, password, role: 'user', isVerified: false });
                success = "Request sent to Admin. Please wait for approval.";
                loginMode = "login";
            } else {
                // Login Logic
                // 1. Check if user exists
                const exists = await DB.checkUsername(username);
                if (!exists) {
                    throw new Error("User not found. Please Register first.");
                }

                // 2. Check Password & Verification
                const user = await DB.login(username, password);
                if (!user) {
                    throw new Error("Invalid Password/Key.");
                }

                // 3. Success
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
    try { const s = await DB.getSettings(); if(s) globalSettings = s; } catch(e) { console.warn(e); }
}

function renderLoading() {
    document.getElementById('app-root').innerHTML = `<div class="flex-1 flex items-center justify-center flex-col gap-4 bg-slate-900"><div class="spinner"></div><p class="text-slate-400 font-mono text-sm">CONNECTING TO SECURE SERVER...</p></div>`;
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
    
    if(window.lucide) window.lucide.createIcons();
    
    const btn = document.getElementById('auth-action-btn');
    if (btn) btn.onclick = () => {
        const u = document.getElementById('u-in').value.trim();
        const p = document.getElementById('p-in').value.trim();
        if(!u || !p) { error="All fields required"; renderApp(); return; }
        handleAuth(loginMode === 'login' || authTab === 'admin' ? 'login' : 'signup', u, p);
    };
}

function renderTabContent() {
    const c = document.getElementById('tab-content'); c.innerHTML = '';
    if(activeTab === 'chat') renderPrivateChat(c);
    else if(activeTab === 'downloads') renderDownloads(c);
    else if(activeTab === 'classifier') renderClassifier(c);
    else if(activeTab === 'decode') renderDecoder(c);
    else if(activeTab === 'encode' && currentUserData.role === 'admin') renderEncode(c);
    else if(activeTab === 'admin' && currentUserData.role === 'admin') renderAdminControls(c);
    if(window.lucide) window.lucide.createIcons();
}

// --- Tab: Private Chat ---
async function renderPrivateChat(container) {
    if(chatInterval) { clearInterval(chatInterval); chatInterval = null; }

    container.innerHTML = `
        <div class="flex h-full w-full pb-16 md:pb-0">
            <div class="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 transition-all ${selectedChatUser ? 'hidden md:flex' : 'flex w-full'}">
                <div class="p-4 border-b border-slate-800">
                    <h2 class="font-bold text-white text-lg">Communications</h2>
                    <p class="text-xs text-slate-400 mt-1">Select a verified channel</p>
                </div>
                <div id="users-list" class="flex-1 overflow-y-auto p-2 space-y-1">
                    <div class="flex items-center justify-center h-40 text-slate-500"><div class="spinner w-6 h-6 border-slate-600 border-t-blue-500"></div></div>
                </div>
            </div>
            <div class="flex-1 flex flex-col bg-slate-950 ${!selectedChatUser ? 'hidden md:flex' : 'flex w-full'}">
                ${UI.renderChatTemplate(selectedChatUser, [], currentUserData)}
            </div>
        </div>`;

    // Fetch Users
    const list = document.getElementById('users-list');
    if(list) {
        try {
            let users = [];
            const adminUser = { username: 'Admin', role: 'admin', isVerified: true };
            if (currentUserData.role === 'user') {
                users.push(adminUser);
            }

            if(users.length === 0) {
                list.innerHTML = `<div class="p-4 text-center text-sm text-slate-500 border border-dashed border-slate-800 rounded mx-4 mt-4">No verified contacts.</div>`;
            } else {
                list.innerHTML = users.map(u => `
                    <div onclick="window.selectUser('${u.username}')" class="user-item p-3 rounded-lg cursor-pointer flex items-center gap-3 border-l-4 border-transparent ${selectedChatUser?.username === u.username ? 'active bg-slate-800 border-blue-500' : 'hover:bg-slate-800/50'}">
                        <div class="w-10 h-10 rounded-full ${u.role==='admin'||u.username==='Admin' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'bg-slate-800 text-slate-300 border border-slate-700'} flex items-center justify-center font-bold text-sm">
                            ${u.username.charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-medium text-slate-200 truncate flex items-center gap-2">
                                ${u.username} ${u.role === 'admin' || u.username === 'Admin' ? '<span class="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold">HQ</span>' : ''}
                            </div>
                            <div class="text-xs text-slate-500 truncate">Tap to open secure link</div>
                        </div>
                    </div>`).join('');
            }
        } catch(e) { 
            console.error('Error fetching users:', e);
            list.innerHTML = `<div class="p-4 text-center text-sm text-red-500">Error loading contacts</div>`; 
        }
    }
}

// --- Tab: Downloads (Gallery) ---
async function renderDownloads(c) {
    c.innerHTML = `<div class="p-8 max-w-6xl mx-auto"><div class="flex items-center justify-between mb-8"><div><h2 class="text-2xl font-bold text-white">Public Gallery</h2><p class="text-slate-400 text-sm">Artifacts published by HQ.</p></div></div><div id="gallery-grid" class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6"><div class="col-span-full py-20 text-center text-slate-500">Loading...</div></div></div>`;
    
    try {
        const items = await DB.getGallery();
        const g = document.getElementById('gallery-grid');
        if(!g) return;
        
        g.innerHTML = items.length ? items.map(i => `<div class="group bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-blue-500/50 transition-all"><div class="h-48 bg-slate-900 relative overflow-hidden flex items-center justify-center"><img src="${i.imageUrl}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"><div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><a href="${i.imageUrl}" download="stego_${i.timestamp}.png" class="bg-blue-600 text-white px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 hover:bg-blue-500">${UI.renderIcon('Download')} DOWNLOAD</a></div></div><div class="p-4"><div class="font-bold text-slate-200 truncate">${i.title||'Artifact'}</div><div class="text-xs text-slate-500 mt-1">${new Date(i.timestamp).toLocaleDateString()}</div></div></div>`).join('') : '<div class="col-span-full text-center text-slate-500 py-10">No public artifacts found.</div>';
    } catch(e) {
        console.error('Error fetching gallery:', e);
        const g = document.getElementById('gallery-grid');
        if(g) g.innerHTML = `<div class="col-span-full text-center text-red-500">Error loading gallery</div>`;
    }
}

// --- Tab: Classifier ---
function renderClassifier(c) {
    c.innerHTML = `<div class="p-8 max-w-2xl mx-auto text-center"><h2 class="text-2xl font-bold text-white mb-2">AI Steganalysis</h2><p class="text-slate-400 mb-8">Statistical anomaly detection system.</p><div class="bg-slate-800/50 rounded-2xl border border-slate-700 p-8"><input type="file" id="cl-f" class="hidden" accept="image/*" /><label for="cl-f" class="cursor-pointer flex flex-col items-center gap-4 py-10 border-2 border-dashed border-slate-600 rounded-xl hover:bg-slate-700/50 hover:border-blue-500 transition-colors"><div class="w-16 h-16 bg-slate-700 text-blue-400 rounded-full flex items-center justify-center">${UI.renderIcon('Scan', 'w-8 h-8')}</div><div class="text-center"><p class="font-bold text-slate-300">Initialize Scan</p><p class="text-xs text-slate-500 mt-1">Upload Image</p></div></label><div id="cl-r" class="hidden mt-6 pt-6 border-t border-slate-700"></div></div></div>`;
    
    document.getElementById('cl-f').onchange = e => {
        const f = e.target.files[0];
        if (!f) return;
        const i = new Image();
        i.src = URL.createObjectURL(f);
        const r = document.getElementById('cl-r');
        r.classList.remove('hidden');
        r.innerHTML = '<span class="text-blue-400 animate-pulse">ANALYZING...</span>';

        i.onload = () => {
            const cv = document.createElement('canvas');
            cv.width = i.width; cv.height = i.height;
            const ctx = cv.getContext('2d'); ctx.drawImage(i, 0, 0);
            const img = ctx.getImageData(0, 0, cv.width, cv.height);
            const stride = (cv.width * cv.height > 1_500_000) ? 2 : 1;
            const { gray, width, height } = Backend.rgbaToGrayscale(img.data, cv.width, cv.height, stride);

            const sChi = Backend.chiSquareLSBScore(gray);
            const sRS  = Backend.rsFlipScore(gray, width, height);
            const sCorr = Backend.correlationDropScore(gray, width, height);
            const prob = Backend.clamp01(0.45 * sChi + 0.35 * sRS + 0.20 * sCorr);
            const isStego = prob >= 0.5;
            
            r.innerHTML = `<div class="flex flex-col items-center"><div class="w-16 h-16 rounded-full flex items-center justify-center mb-3 ${isStego ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}">${UI.renderIcon(isStego ? 'AlertTriangle' : 'CheckCircle','w-8 h-8')}</div><h3 class="text-xl font-bold ${isStego ? 'text-red-400' : 'text-green-400'}">${isStego ? 'ANOMALY DETECTED' : 'CLEAN'}</h3><p class="text-xs text-slate-500 mt-1">CONFIDENCE: ${(prob * 100).toFixed(1)}%</p><div class="mt-4 text-[10px] text-slate-500 font-mono">χ²:${(sChi*100).toFixed(0)} · RS:${(sRS*100).toFixed(0)} · Corr:${(sCorr*100).toFixed(0)}</div></div>`;
        };
    };
}

// --- Tab: Decoder ---
function renderDecoder(c) {
    c.innerHTML = `<div class="p-8 max-w-xl mx-auto"><div class="bg-slate-800/50 rounded-2xl border border-slate-700 p-6"><h2 class="text-xl font-bold text-white mb-6 flex items-center gap-2">${UI.renderIcon('Unlock')} Decryption Module</h2><div class="space-y-4"><div><label class="text-[10px] font-bold text-slate-500 uppercase">Global Key</label><input type="password" id="dec-pass" class="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white focus:border-blue-500 outline-none"></div><div><label class="text-[10px] font-bold text-slate-500 uppercase">Source Image</label><input type="file" id="dec-in" class="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500"/></div><button id="dec-btn" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded font-bold text-sm">EXECUTE DECRYPT</button></div><div id="dec-out" class="mt-6 hidden p-4 rounded bg-slate-900 border border-slate-700 text-sm font-mono break-all text-slate-300"></div></div></div>`;
    
    document.getElementById('dec-btn').onclick = async () => {
        const p=document.getElementById('dec-pass').value, f=document.getElementById('dec-in').files[0], o=document.getElementById('dec-out');
        if(!p||!f)return; 
        
        await fetchGlobalSettings();
        if(p !== globalSettings.decodePassword){o.innerHTML='<span class="text-red-500">INVALID KEY</span>'; o.classList.remove('hidden'); return;}
        
        const i=new Image(); i.src=URL.createObjectURL(f);
        i.onload=()=>{
            const cv=document.createElement('canvas'); cv.width=i.width; cv.height=i.height;
            const ctx=cv.getContext('2d'); ctx.drawImage(i,0,0);
            const d=ctx.getImageData(0,0,cv.width,cv.height).data;
            let b="",m=""; for(let j=0;j<d.length;j+=4)for(let k=0;k<3;k++)b+=(d[j+k]&1);
            for(let j=0;j<b.length;j+=8){const v=parseInt(b.substr(j,8),2); if(v===0)break; m+=String.fromCharCode(v);}
            const e=m.indexOf("###END###");
            o.innerHTML=e!==-1?`<span class="text-green-400">DECRYPTED:</span><br>${m.substring(0,e)}`:'<span class="text-amber-500">NO DATA FOUND</span>';
            o.classList.remove('hidden');
        }
    }
}

// --- Tab: Admin Controls ---
async function renderAdminControls(c) {
    c.innerHTML = `<div class="p-6 grid md:grid-cols-2 gap-6"><div class="bg-slate-800/50 p-6 rounded-xl border border-slate-700"><h3 class="font-bold text-white mb-4 flex gap-2">${UI.renderIcon('Shield')} Pending Verification</h3><div id="adm-list" class="space-y-2 text-sm">Loading...</div></div><div class="bg-slate-800/50 p-6 rounded-xl border border-slate-700 h-fit"><h3 class="font-bold text-white mb-4 flex gap-2">${UI.renderIcon('Key')} Security Config</h3><input id="gk-in" class="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white mb-3" placeholder="New Global Key" value="${globalSettings.decodePassword || ''}"><button id="gk-save" class="bg-blue-600 hover:bg-blue-500 text-white w-full py-2 rounded text-sm font-bold">UPDATE KEY</button></div></div>`;

    const refreshList = async () => {
        const l = document.getElementById('adm-list'); if(!l) return;
        try {
            const pending = await DB.getPendingUsers();
            l.innerHTML = pending.length ? pending.map(x=>`<div class="flex justify-between items-center p-3 bg-slate-900 rounded border border-slate-700"><span class="font-mono text-slate-300">${x.username}</span><button onclick="window.verify('${x._id}')" class="text-[10px] font-bold bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded">APPROVE</button></div>`).join('') : '<p class="text-slate-500">No pending requests.</p>';
        } catch(e) {
            console.error('Error fetching pending users:', e);
            l.innerHTML = `<p class="text-red-500">Error loading pending users</p>`;
        }
    };

    window.verify = async (id) => {
        try {
            await DB.approveUser(id);
            refreshList();
        } catch(e) {
            console.error('Error approving user:', e);
            alert('Error approving user: ' + e.message);
        }
    };

    document.getElementById('gk-save').onclick = async () => {
        const v = document.getElementById('gk-in').value;
        if(v) {
            try {
                await DB.updateSettings(globalSettings.id || globalSettings._id, v);
                alert('Saved');
            } catch(e) {
                console.error('Error updating settings:', e);
                alert('Error updating settings: ' + e.message);
            }
        }
    };

    refreshList();
}

// --- Tab: Encode & Publish ---
function renderEncode(c) {
    c.innerHTML = `<div class="p-8 max-w-xl mx-auto"><div class="bg-slate-800/50 p-6 rounded-2xl border border-slate-700"><h2 class="font-bold text-white text-lg mb-4">Encoder Station</h2><div class="space-y-4"><input type="file" id="enc-f" class="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500"><textarea id="enc-m" class="w-full bg-slate-900 border border-slate-600 rounded p-3 text-sm text-white" rows="3" placeholder="Secret payload..."></textarea><button id="enc-btn" class="bg-blue-600 hover:bg-blue-500 text-white w-full py-2.5 rounded font-bold text-sm">ENCODE & PUBLISH</button></div><div id="enc-stat" class="mt-4 text-center text-xs font-mono text-slate-400"></div></div></div>`;
    
    document.getElementById('enc-btn').onclick = () => {
        const f=document.getElementById('enc-f').files[0], m=document.getElementById('enc-m').value;
        if(!f||!m) return;
        const img=new Image(); img.src=URL.createObjectURL(f);
        img.onload= async ()=>{
            const cv=document.createElement('canvas');
            const w=img.width>800?800:img.width; const h=img.width>800?img.height*(800/img.width):img.height; cv.width=w;cv.height=h; const ctx=cv.getContext('2d'); ctx.drawImage(img,0,0,w,h);
            const d=ctx.getImageData(0,0,w,h).data; const bin=m.split('').map(c=>c.charCodeAt(0).toString(2).padStart(8,'0')).join('')+"001000110010001100100011010001010100111001000100001000110010001100100011";
            let idx=0;
            for(let i=0;i<d.length;i+=4)for(let j=0;j<3;j++){if(idx<bin.length)d[i+j]=(d[i+j]&0xFE)|parseInt(bin[idx++]);}
            ctx.putImageData(new ImageData(d,w,h),0,0);
            
            const url=cv.toDataURL('image/png'); 
            const item={imageUrl:url, timestamp:Date.now(), title:"Payload "+Date.now().toString().slice(-4)};
            
            try {
                await DB.addToGallery(item);
                const stat = document.getElementById('enc-stat');
                stat.innerText = "ARTIFACT_PUBLISHED_SUCCESSFULLY";
                stat.className = "mt-4 text-center text-xs font-mono text-green-400";
            } catch(e) {
                console.error('Error publishing:', e);
                const stat = document.getElementById('enc-stat');
                stat.innerText = "ERROR: " + e.message;
                stat.className = "mt-4 text-center text-xs font-mono text-red-400";
            }
        }
    }
}

// Start the app
window.onload = initApp;
