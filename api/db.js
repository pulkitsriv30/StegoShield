// api/db.js — Dual-Mode Database Handler (MongoDB + Local JSON Store)
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI;
let cachedClient = null;
let cachedDb = null;
let useLocalDb = false;

// --- Local JSON Database Fallback ---
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
        const initial = {
            users: [],
            pending: [],
            private_messages: [],
            gallery: [],
            settings: [
                { _id: 'settings_root', id: 'settings_root', decodePassword: 'default', createdAt: Date.now() }
            ]
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
    }
}

function readLocalDb() {
    ensureDataDir();
    try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (!data.settings || data.settings.length === 0) {
            data.settings = [{ _id: 'settings_root', id: 'settings_root', decodePassword: 'default', createdAt: Date.now() }];
        }
        return data;
    } catch (err) {
        console.error('[DB] Error reading local db.json:', err);
        return { users: [], pending: [], private_messages: [], gallery: [], settings: [{ _id: 'settings_root', id: 'settings_root', decodePassword: 'default' }] };
    }
}

function writeLocalDb(data) {
    ensureDataDir();
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
}

// Check MongoDB connection or fallback
async function getDatabase() {
    if (useLocalDb) return { type: 'local' };
    if (cachedClient && cachedDb) return { type: 'mongo', db: cachedDb };

    if (!uri) {
        if (process.env.VERCEL) {
            throw new Error("MONGODB_URI environment variable is missing on Vercel. Please set MONGODB_URI in Vercel Project Settings -> Environment Variables and Redeploy.");
        }
        console.log('[DB] MONGODB_URI not provided. Using local persistent JSON database (data/db.json).');
        useLocalDb = true;
        return { type: 'local' };
    }

    try {
        const client = await MongoClient.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });
        const dbName = process.env.MONGODB_DB || 'stegosecure';
        const db = client.db(dbName);
        cachedClient = client;
        cachedDb = db;
        console.log(`[DB] Connected to MongoDB Atlas (${dbName}).`);
        return { type: 'mongo', db };
    } catch (err) {
        if (process.env.VERCEL) {
            throw new Error(`Failed to connect to MongoDB Atlas: ${err.message}. Please verify: 1) MongoDB Atlas -> Network Access allows 0.0.0.0/0, 2) MONGODB_URI username and password are correct (no angle brackets, special characters URL-encoded).`);
        }
        console.warn(`[DB] Could not connect to MongoDB Atlas (${err.message}). Falling back to local JSON database.`);
        useLocalDb = true;
        return { type: 'local' };
    }
}

function normalizeMongoFilter(filter) {
    if (!filter || typeof filter !== 'object') return {};
    const normalized = { ...filter };
    if (normalized._id && typeof normalized._id === 'string' && ObjectId && ObjectId.isValid(normalized._id)) {
        normalized._id = new ObjectId(normalized._id);
    }
    if (normalized.id) {
        const idVal = normalized.id;
        delete normalized.id;
        if (typeof idVal === 'string' && ObjectId && ObjectId.isValid(idVal)) {
            normalized._id = new ObjectId(idVal);
        } else {
            normalized._id = idVal;
        }
    }
    return normalized;
}

export default async function handler(request, response) {
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') return response.status(200).end();

    try {
        const backend = await getDatabase();
        const body = request.body || {};
        const query = request.query || {};
        const collectionName = body.collectionName || query.collectionName;
        const action = body.action || query.action;

        if (!collectionName) {
            return response.status(400).json({ error: "Missing collectionName" });
        }

        // ======================== LOCAL JSON DB HANDLER ========================
        if (backend.type === 'local') {
            const data = readLocalDb();
            if (!data[collectionName]) data[collectionName] = [];
            const col = data[collectionName];

            if (request.method === 'GET') {
                const filter = query.filter ? JSON.parse(query.filter) : {};
                const sort = query.sort ? JSON.parse(query.sort) : { _id: -1 };

                let results = col.filter(doc => {
                    for (const [k, v] of Object.entries(filter)) {
                        if (k === '_id' || k === 'id') {
                            const target = String(v);
                            if (String(doc._id) !== target && String(doc.id) !== target) return false;
                        } else {
                            if (doc[k] !== v) return false;
                        }
                    }
                    return true;
                });

                // Sorting
                const sortKey = Object.keys(sort)[0];
                if (sortKey) {
                    const dir = sort[sortKey] === -1 ? -1 : 1;
                    results.sort((a, b) => {
                        const valA = a[sortKey] !== undefined ? a[sortKey] : '';
                        const valB = b[sortKey] !== undefined ? b[sortKey] : '';
                        if (valA < valB) return -1 * dir;
                        if (valA > valB) return 1 * dir;
                        return 0;
                    });
                }

                results = results.slice(0, 500).map(doc => ({
                    ...doc,
                    id: String(doc._id || doc.id),
                    _id: String(doc._id || doc.id)
                }));

                return response.status(200).json(results);
            }

            if (request.method === 'POST') {
                if (action === 'insert') {
                    const id = crypto.randomBytes(12).toString('hex');
                    const newDoc = {
                        ...body.payload,
                        _id: id,
                        id: id,
                        createdAt: Date.now()
                    };
                    col.push(newDoc);
                    writeLocalDb(data);
                    return response.status(200).json({ success: true, id: id });
                }

                if (action === 'update') {
                    const payload = body.payload || {};
                    const targetId = String(payload.id || payload._id);
                    const updateData = payload.updateData || {};

                    const idx = col.findIndex(doc => String(doc._id) === targetId || String(doc.id) === targetId);
                    if (idx !== -1) {
                        col[idx] = { ...col[idx], ...updateData };
                        writeLocalDb(data);
                        return response.status(200).json({ success: true });
                    } else {
                        // If updating settings and none exists yet, create it
                        if (collectionName === 'settings') {
                            const id = targetId && targetId !== 'undefined' ? targetId : crypto.randomBytes(12).toString('hex');
                            col.push({ _id: id, id, ...updateData, createdAt: Date.now() });
                            writeLocalDb(data);
                            return response.status(200).json({ success: true });
                        }
                        return response.status(404).json({ error: "Document not found for update" });
                    }
                }

                if (action === 'delete') {
                    const payload = body.payload || {};
                    const targetId = String(payload._id || payload.id);
                    const originalLength = col.length;
                    data[collectionName] = col.filter(doc => String(doc._id) !== targetId && String(doc.id) !== targetId);
                    writeLocalDb(data);
                    return response.status(200).json({ success: true, deleted: originalLength - data[collectionName].length });
                }
            }

            return response.status(400).json({ error: "Invalid Action" });
        }

        // ======================== MONGODB HANDLER ========================
        const { db } = backend;
        const collection = db.collection(collectionName);

        if (request.method === 'GET') {
            const rawFilter = query.filter ? JSON.parse(query.filter) : {};
            const sort = query.sort ? JSON.parse(query.sort) : { _id: -1 };
            const filter = normalizeMongoFilter(rawFilter);

            const results = await collection.find(filter).sort(sort).limit(500).toArray();
            return response.status(200).json(results.map(doc => ({
                ...doc,
                id: doc._id.toString(),
                _id: doc._id.toString()
            })));
        }

        if (request.method === 'POST') {
            if (action === 'insert') {
                const newDoc = { ...body.payload, createdAt: Date.now() };
                const result = await collection.insertOne(newDoc);
                return response.status(200).json({ success: true, id: result.insertedId.toString() });
            }

            if (action === 'update') {
                const { id, _id, updateData } = body.payload || {};
                const targetId = id || _id;
                const filter = ObjectId && ObjectId.isValid(targetId) ? { _id: new ObjectId(targetId) } : { _id: targetId };
                await collection.updateOne(filter, { $set: updateData }, { upsert: collectionName === 'settings' });
                return response.status(200).json({ success: true });
            }

            if (action === 'delete') {
                const { _id, id } = body.payload || {};
                const targetId = _id || id;
                const filter = ObjectId && ObjectId.isValid(targetId) ? { _id: new ObjectId(targetId) } : { _id: targetId };
                await collection.deleteOne(filter);
                return response.status(200).json({ success: true });
            }
        }

        return response.status(400).json({ error: "Invalid Action" });

    } catch (error) {
        console.error('[DB] API handler error:', error);
        return response.status(500).json({ error: error.message });
    }
}
