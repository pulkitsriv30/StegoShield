// frontend.js
import { escapeHtml } from './backend.js';

export function renderIcon(name, cls = "w-5 h-5") {
    return `<i data-lucide="${name}" class="${cls}"></i>`;
}

export function AuthPage(state) {
    const isLogin = state.loginMode === 'login';
    const isAdminAuth = state.authTab === 'admin';
    return `
    <div class="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black">
        <div class="w-full max-w-md glass-panel rounded-2xl shadow-2xl overflow-hidden relative z-10 fade-in">
            <div class="p-8 text-center border-b border-slate-700/50">
                <div class="w-16 h-16 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                    ${renderIcon('Shield', 'w-8 h-8 text-blue-400')}
                </div>
                <h1 class="text-2xl font-bold text-white tracking-tight mb-1">StegoShield</h1>
                <p class="text-slate-400 text-xs font-mono uppercase tracking-widest">End-to-End Encryption</p>
            </div>

            <div class="flex p-1 bg-slate-800/80 mx-6 mt-6 rounded-lg border border-slate-700">
                <button onclick="window.setAuthTab('user')" class="flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-md transition-all ${!isAdminAuth ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}">User</button>
                <button onclick="window.setAuthTab('admin')" class="flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-md transition-all ${isAdminAuth ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}">Admin</button>
            </div>

            <div class="p-8 pt-6">
                ${!isAdminAuth ? `
                <div class="flex gap-4 mb-6 text-sm border-b border-slate-700 pb-1">
                    <button onclick="window.setLoginMode('login')" class="pb-2 transition-colors ${isLogin ? 'text-white border-b-2 border-blue-500 -mb-1.5' : 'text-slate-500 hover:text-slate-300'}">Login</button>
                    <button onclick="window.setLoginMode('signup')" class="pb-2 transition-colors ${!isLogin ? 'text-white border-b-2 border-blue-500 -mb-1.5' : 'text-slate-500 hover:text-slate-300'}">Register</button>
                </div>` : ''}

                <div class="space-y-4">
                    <div>
                        <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Username</label>
                        <input id="u-in" type="text" class="w-full px-4 py-2.5 bg-slate-950/50 border border-slate-700 rounded-lg text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" placeholder="Enter ID..." />
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Password</label>
                        <input id="p-in" type="password" class="w-full px-4 py-2.5 bg-slate-950/50 border border-slate-700 rounded-lg text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" placeholder="Enter Key..." />
                    </div>
                    <button id="auth-action-btn" class="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold text-sm transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                        ${renderIcon('LogIn', 'w-4 h-4')}
                        ${isAdminAuth ? 'Access Console' : (isLogin ? 'Establish Link' : 'Register Identity')}
                    </button>
                </div>

                ${state.error ? `<div class="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg flex items-center gap-2">${renderIcon('AlertCircle', 'w-4 h-4')} ${state.error}</div>` : ''}
                ${state.success ? `<div class="mt-4 p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-lg flex items-center gap-2">${renderIcon('CheckCircle', 'w-4 h-4')} ${state.success}</div>` : ''}
                ${isAdminAuth ? `<div class="mt-6 text-center text-[10px] text-slate-600 font-mono">DEFAULT: admin / admin123</div>` : ''}
            </div>
        </div>
    </div>`;
}

export function DashboardPage(currentUserData, activeTab) {
    const isAdmin = currentUserData.role === 'admin';
    return `
    <div class="flex h-screen bg-slate-950 overflow-hidden">
        <aside class="w-64 bg-slate-900 border-r border-slate-800 flex-col shrink-0 hidden md:flex">
            <div class="p-6 border-b border-slate-800 flex items-center gap-3">
                <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                    ${renderIcon('Shield', 'w-5 h-5')}
                </div>
                <div>
                    <div class="font-bold text-white text-lg tracking-tight">StegoShield</div>
                    <div class="text-[10px] text-slate-400 font-mono">${isAdmin ? 'ADMIN_CONSOLE' : 'USER_TERMINAL'}</div>
                </div>
            </div>

            <nav class="flex-1 p-4 space-y-2 overflow-y-auto">
                <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Comms & Data</div>
                <button onclick="window.setActiveTab('chat')" class="nav-btn ${activeTab === 'chat' ? 'active' : ''}">
                    ${renderIcon('MessageSquare')} Private Chat
                </button>
                <button onclick="window.setActiveTab('downloads')" class="nav-btn ${activeTab === 'downloads' ? 'active' : ''}">
                    ${renderIcon('Download')} Public Gallery
                </button>

                <div class="mt-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Analysis Tools</div>
                <button onclick="window.setActiveTab('classifier')" class="nav-btn ${activeTab === 'classifier' ? 'active' : ''}">
                    ${renderIcon('Brain')} AI Steganalysis
                </button>
                <button onclick="window.setActiveTab('decode')" class="nav-btn ${activeTab === 'decode' ? 'active' : ''}">
                    ${renderIcon('Unlock')} Decrypt Tool
                </button>

                ${isAdmin ? `
                <div class="mt-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Administration</div>
                <button onclick="window.setActiveTab('encode')" class="nav-btn ${activeTab === 'encode' ? 'active' : ''}">
                    ${renderIcon('Lock')} Encode & Publish
                </button>
                <button onclick="window.setActiveTab('admin')" class="nav-btn ${activeTab === 'admin' ? 'active' : ''}">
                    ${renderIcon('Settings')} Admin Controls
                </button>` : ''}
            </nav>

            <div class="p-4 border-t border-slate-800 bg-slate-900/50">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-white border border-slate-600">
                        ${currentUserData.username.charAt(0).toUpperCase()}
                    </div>
                    <div class="flex-1 overflow-hidden">
                        <div class="text-sm font-medium text-white truncate">${currentUserData.username}</div>
                        <div class="text-[10px] text-green-400 flex items-center gap-1">
                            <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Online
                        </div>
                    </div>
                </div>
                <button onclick="window.handleLogout()" class="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs font-bold transition-all">
                    ${renderIcon('LogOut', 'w-3 h-3')} DISCONNECT
                </button>
            </div>
        </aside>

        <main class="flex-1 flex flex-col overflow-hidden relative bg-slate-950" id="tab-content"></main>

        <div class="md:hidden bg-slate-900 border-t border-slate-800 flex justify-around p-3 shrink-0 fixed bottom-0 w-full z-50">
            <button onclick="window.setActiveTab('chat')" class="${activeTab === 'chat' ? 'text-blue-500' : 'text-slate-500'}">${renderIcon('MessageSquare')}</button>
            <button onclick="window.setActiveTab('downloads')" class="${activeTab === 'downloads' ? 'text-blue-500' : 'text-slate-500'}">${renderIcon('Download')}</button>
            <button onclick="window.setActiveTab('decode')" class="${activeTab === 'decode' ? 'text-blue-500' : 'text-slate-500'}">${renderIcon('Unlock')}</button>
            <button onclick="window.handleLogout()" class="text-red-500">${renderIcon('LogOut')}</button>
        </div>
    </div>`;
}

export function renderChatTemplate(selectedChatUser, messages, currentUserData) {
    if (!selectedChatUser) {
        return `
        <div class="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
            <div class="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-800">
                ${renderIcon('MessageSquare', 'w-10 h-10 text-slate-600')}
            </div>
            <h3 class="text-lg font-medium text-slate-400 mb-1">Secure Channel Idle</h3>
            <p class="text-sm max-w-xs text-slate-600">Select a contact from the sidebar to establish an encrypted link.</p>
        </div>`;
    }

    const messagesHTML = messages.length === 0
        ? `<div class="text-center py-10 text-slate-600 text-sm">No history found. Start a new session.</div>`
        : messages.map(m => `
        <div class="flex flex-col ${m.sender === currentUserData.username ? 'items-end' : 'items-start'} mb-3">
            <div class="flex items-center gap-2 mb-1 px-1">
                <span class="text-[10px] text-slate-500 font-bold">${m.sender === currentUserData.username ? 'YOU' : m.sender.toUpperCase()}</span>
                <span class="text-[10px] text-slate-600 font-mono">${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="chat-bubble ${m.sender === currentUserData.username ? 'mine' : 'theirs'} shadow-sm">
                ${m.type === 'image'
                    ? `<div class="space-y-2">
                        <img src="${m.imageUrl}" class="rounded-lg max-w-full max-h-60 border border-white/10">
                        <a href="${m.imageUrl}" download="received.png" class="flex items-center justify-center gap-2 w-full py-1.5 bg-black/30 hover:bg-black/50 rounded text-xs font-bold text-white no-underline">
                            ${renderIcon('Download', 'w-3 h-3')} Save Image
                        </a>
                       </div>`
                    : `<span class="break-words">${escapeHtml(m.text)}</span>`}
            </div>
        </div>`).join('');

    return `
    <div class="h-16 bg-slate-900/80 border-b border-slate-800 flex items-center px-4 shrink-0 shadow-sm z-10 backdrop-blur-md">
        <div class="flex items-center gap-3">
            <button class="md:hidden p-2 -ml-2 text-slate-400 hover:text-white rounded-full" onclick="window.selectUser(null)">
                ${renderIcon('ArrowLeft')}
            </button>
            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                ${selectedChatUser.username.charAt(0).toUpperCase()}
            </div>
            <div>
                <div class="font-bold text-white leading-tight">${selectedChatUser.username}</div>
                <div class="text-[10px] text-green-400 flex items-center gap-1 font-mono tracking-wide">
                    <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span> ENCRYPTED
                </div>
            </div>
        </div>
    </div>
    <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-4">${messagesHTML}</div>
    <div class="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
        <form id="chat-form" class="flex items-end gap-2 max-w-4xl mx-auto">
            <label class="p-3 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors" title="Send Image">
                <input type="file" id="img-input" class="hidden" accept="image/*">
                ${renderIcon('Paperclip', 'w-5 h-5')}
            </label>
            <div class="flex-1 bg-slate-800 rounded-xl p-2 focus-within:ring-1 focus-within:ring-blue-500 transition-all border border-slate-700">
                <input id="text-input" type="text" class="w-full bg-transparent border-none focus:ring-0 px-2 py-1 text-sm outline-none text-white placeholder:text-slate-500" placeholder="Message..." autocomplete="off">
            </div>
            <button type="submit" class="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-all active:scale-95">
                ${renderIcon('Send', 'w-5 h-5')}
            </button>
        </form>
    </div>`;
}
