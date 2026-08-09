// api/db.js  — Vercel Serverless Function
import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI;

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
    if (cachedClient && cachedDb) return { client: cachedClient, db: cachedDb };
    if (!uri) throw new Error("MONGODB_URI environment variable is not set");
    const client = await MongoClient.connect(uri);
    const dbName = process.env.MONGODB_DB || 'stegosecure';
    const db = client.db(dbName);
    cachedClient = client;
    cachedDb = db;
    return { client, db };
}

export default async function handler(request, response) {
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') return response.status(200).end();

    try {
        const { db } = await connectToDatabase();

        const body = request.body || {};
        const query = request.query || {};
        const collectionName = body.collectionName || query.collectionName;
        const action = body.action || query.action;

        if (!collectionName) return response.status(400).json({ error: "Missing collectionName" });

        const collection = db.collection(collectionName);

        if (request.method === 'GET') {
            const filter = query.filter ? JSON.parse(query.filter) : {};
            const sort = query.sort ? JSON.parse(query.sort) : { _id: -1 };
            const results = await collection.find(filter).sort(sort).limit(500).toArray();
            return response.status(200).json(results.map(doc => ({ ...doc, id: doc._id.toString() })));
        }

        if (request.method === 'POST') {
            if (action === 'insert') {
                const newDoc = { ...body.payload, createdAt: Date.now() };
                const result = await collection.insertOne(newDoc);
                return response.status(200).json({ success: true, id: result.insertedId });
            }
            if (action === 'update') {
                const { id, updateData } = body.payload;
                await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateData });
                return response.status(200).json({ success: true });
            }
            if (action === 'delete') {
                const { _id } = body.payload;
                await collection.deleteOne({ _id: new ObjectId(_id) });
                return response.status(200).json({ success: true });
            }
        }

        return response.status(400).json({ error: "Invalid Action" });

    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: error.message });
    }
}
