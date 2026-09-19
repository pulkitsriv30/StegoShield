// database.js
// Frontend data layer — talks to /api/db (handled by api/db.js).
export const appId = 'stego-live-v1';

async function apiCall(method, collectionName, params = {}) {
    let url = `/api/db`;
    try {
        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (method === 'GET') {
            const queryParams = new URLSearchParams({
                collectionName: collectionName,
                action: 'find',
                filter: JSON.stringify(params.where || {}),
                sort: JSON.stringify(params.sort || { _id: -1 })
            });
            url += `?${queryParams.toString()}`;
        } else {
            options.body = JSON.stringify({
                collectionName,
                action: params.action,
                payload: params.payload
            });
        }
        const response = await fetch(url, options);
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Server request failed (${response.status})`);
        }
        return await response.json();
    } catch (error) {
        console.error(`[DB Error ${method} ${collectionName}]:`, error.message);
        if (method === 'GET') return [];
        throw error;
    }
}

export const DB = {
    async adminLogin(username, password) {
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Invalid Admin Credentials');
        }
        return await response.json();
    },
    async checkUsername(username) {
        // Check both approved users and the pending-approval queue.
        try {
            const users = await apiCall('GET', 'users', { where: { username } });
            if (users && users.length > 0) return true;
            const pending = await apiCall('GET', 'pending', { where: { username } });
            return Boolean(pending && pending.length > 0);
        } catch (e) {
            console.warn('Error checking username:', e);
            return false;
        }
    },
    async createUser(userData) {
        // New signups go to "pending" until an admin approves them.
        return await apiCall('POST', 'pending', { action: 'insert', payload: userData });
    },
    async login(username, password) {
        // Only approved (isVerified) users in "users" can log in.
        const users = await apiCall('GET', 'users', { where: { username, password, isVerified: true } });
        return users[0] || null;
    },
    async getPendingUsers() {
        return await apiCall('GET', 'pending', {});
    },
    async approveUser(userId) {
        // Find user by _id or id in pending collection
        let pendingUsers = await apiCall('GET', 'pending', { where: { _id: userId } });
        if (!pendingUsers || !pendingUsers.length) {
            // Fallback: search all pending in case of ID field discrepancy
            const allPending = await apiCall('GET', 'pending', {});
            pendingUsers = allPending.filter(u => String(u._id) === String(userId) || String(u.id) === String(userId));
        }
        if (!pendingUsers.length) throw new Error('User not found in pending list');
        
        const user = pendingUsers[0];
        const targetId = user._id || user.id || userId;
        const { _id, id, ...userData } = user;
        
        // Insert into verified users
        await apiCall('POST', 'users', {
            action: 'insert',
            payload: { ...userData, isVerified: true, approvedAt: Date.now() }
        });
        
        // Remove from pending
        await apiCall('POST', 'pending', {
            action: 'delete',
            payload: { _id: targetId, id: targetId }
        });
        return true;
    },
    async rejectUser(userId) {
        return await apiCall('POST', 'pending', {
            action: 'delete',
            payload: { _id: userId, id: userId }
        });
    },
    async deleteUser(userId) {
        return await apiCall('POST', 'users', {
            action: 'delete',
            payload: { _id: userId, id: userId }
        });
    },
    async getVerifiedUsers() {
        return await apiCall('GET', 'users', { where: { isVerified: true } });
    },
    async sendMessage(msgData) {
        return await apiCall('POST', 'private_messages', { action: 'insert', payload: msgData });
    },
    async getMessages(chatId) {
        return await apiCall('GET', 'private_messages', { where: { chatId }, sort: { timestamp: 1 } });
    },
    async getGallery() {
        return await apiCall('GET', 'gallery', { sort: { timestamp: -1 } });
    },
    async addToGallery(item) {
        return await apiCall('POST', 'gallery', { action: 'insert', payload: item });
    },
    async getSettings() {
        const s = await apiCall('GET', 'settings', {});
        return s.length ? s[0] : null;
    },
    async updateSettings(id, newPass) {
        if (!id) {
            return await apiCall('POST', 'settings', { action: 'insert', payload: { decodePassword: newPass } });
        }
        return await apiCall('POST', 'settings', {
            action: 'update',
            payload: { id: id, _id: id, updateData: { decodePassword: newPass } }
        });
    }
};

