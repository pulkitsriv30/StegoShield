# StegoShield

A full-stack steganography tool: hide and extract secret messages inside images, with an admin-gated user system, private messaging, and a public gallery of encoded images.

**Stack:** vanilla JS (frontend, no framework/build step) + Express + MongoDB. *(The previous README described Next.js/TypeScript/Postgres — that didn't match the actual code, which is what's below.)*

---

## 1. Install dependencies

Requires Node.js 18+.

```bash
npm install
```

## 2. Database setup (MongoDB)

You need a MongoDB connection string. The free tier of MongoDB Atlas is the easiest way to get one:

1. Go to https://www.mongodb.com/cloud/atlas/register and create a free account.
2. Create a free **M0 cluster** (any region is fine).
3. Under **Database Access**, create a database user with a username/password.
4. Under **Network Access**, add `0.0.0.0/0` (allow from anywhere) — fine for local dev.
5. Click **Connect → Drivers**, copy the connection string. It looks like:
   `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/`

You don't need to create any collections or run any SQL/migration scripts — `api/db.js` creates collections automatically the first time something is inserted into them.

## 3. Set environment variables

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` and paste in your `MONGODB_URI` from step 2.

## 4. Run it

```bash
npm run dev     # auto-restarts on file changes
# or
npm start
```

Open http://localhost:3000.

---

## Features

- User signup with admin approval (new accounts sit in a "pending" queue until an admin approves them)
- Admin console for approving users and setting the global decode key
- Private messaging between users and the admin (polls every 3s — no websockets)
- Steganography encoding (hide a message in an image, LSB technique) — admin only, publishes to the public gallery
- Steganography decoding (extract a hidden message, requires the current global key)
- Client-side statistical steganalysis (chi-square, RS, and correlation-drop heuristics) to flag likely-stego images
- Public gallery of published, encoded images

## Default admin login

```
Username: admin
Password: admin123
```

Checked server-side now, in `api/auth.js` — the browser never sees the real credentials, it just gets back a session object if they're correct. **Change the defaults** by setting `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env.local` before showing this to anyone else; if unset, it silently falls back to `admin`/`admin123` and logs a warning to the server console.

Note this is still a simple shared-password login, not per-admin accounts with hashed credentials — fine for a class project, not something to reuse for anything with real users.

## Project structure

```
index.html        Entry point, loads Tailwind (CDN) + main.js
styles.css         Custom classes Tailwind doesn't provide (glass panel, spinner, nav buttons)
main.js            App state + UI wiring (client-side "router")
frontend.js        HTML-string templates for each screen
backend.js         Steganalysis math + image helpers (runs in-browser despite the name)
database.js        Frontend data-access layer — calls /api/db and /api/auth
api/db.js           The actual MongoDB handler that /api/db is mounted to
api/auth.js         Server-side admin login handler that /api/auth is mounted to
server.js          Local Express server that serves static files + mounts api/db.js and api/auth.js
```

## Database collections (created automatically)

| Collection         | Fields |
|---------------------|--------|
| `pending`           | username, password, role, isVerified: false |
| `users`             | username, password, role, isVerified: true |
| `private_messages`  | chatId, sender, text or imageUrl, type, timestamp |
| `gallery`           | imageUrl, title, timestamp |
| `settings`          | decodePassword |

## Known limitations (not fixed, worth knowing about)

- Passwords are stored and compared in plaintext — fine for a demo, not for production.
- Chat is poll-based, not real-time — up to a 3s delay.
- No pagination on gallery/messages (capped at 500 docs server-side).
