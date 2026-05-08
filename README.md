# Aura — Privacy-First Messenger

> *Your space. Your rules. Your aura.*

End-to-end encrypted web messenger built with React, Node.js, and SQLite.

## Quick Start

```bash
# Backend
cd server
npm install
npm run dev    # → http://localhost:3001

# Frontend (in another terminal)
cd client
npm install
npm run dev    # → http://localhost:5173
```

Open http://localhost:5173, register an account, and start chatting.

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** — пошаговая инструкция как залить на Netlify (frontend) + Render.com (backend).

## Features

### Core
- Direct & group chats, Spaces (channels)
- Real-time messaging via WebSockets
- File & image sharing
- Reactions & typing indicators
- Read receipts

### Unique to Aura
- **Aura Modes** — `available`, `ghost` (read invisibly), `dnd`
- **Echo Messages** — self-destructing messages (5s → 24h timers)
- **Mood Status** — custom emoji + text status
- **Spaces** — channel/forum hybrid
- **Themes** — Dark, Midnight, Aurora

### Privacy
- E2E encryption with NaCl Curve25519 keypairs
- Private keys stored locally, never sent to server
- No phone number required for registration
- No ads, no tracking, no data selling

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + Socket.io |
| Database | `node:sqlite` (built-in to Node 22.5+) |
| Auth | JWT + bcryptjs |
| Encryption | tweetnacl (NaCl Curve25519) |
| Real-time | Socket.io |

## Project structure

```
Aura/
├── README.md             You are here
├── DEPLOYMENT.md         How to publish on Netlify + Render
├── .gitignore
├── server/               Backend (deploy to Render.com)
│   ├── render.yaml       Render config
│   ├── src/
│   │   ├── index.ts      Express + Socket.io entry
│   │   ├── db/           SQLite schema
│   │   ├── routes/       REST API (auth, users, chats, files)
│   │   ├── socket/       WebSocket handlers
│   │   └── middleware/   JWT auth
│   ├── package.json
│   └── tsconfig.json
└── client/               Frontend (deploy to Netlify)
    ├── netlify.toml      Netlify config
    ├── public/_redirects SPA routing
    ├── .env.example      Set VITE_API_URL for prod
    ├── src/
    │   ├── App.tsx
    │   ├── components/
    │   ├── contexts/
    │   ├── services/     api.ts, socket.ts, crypto.ts
    │   └── types/
    ├── index.html
    ├── vite.config.ts
    ├── tailwind.config.js
    └── package.json
```

## Requirements

- **Node.js 22.5+** (uses built-in `node:sqlite`, available since 22.5.0)
- npm

## Team

- **Founder & Lead Developer:** Angela Erar

## Roadmap

- [x] Phase 1 — Foundation (auth, direct chats, real-time)
- [x] Phase 2 — Core (groups, files, reactions, typing)
- [x] Phase 3 — Unique features (Aura Modes, Echo, Mood, Spaces, Themes)
- [ ] Phase 4 — Voice/video calls (WebRTC)
- [ ] Phase 5 — Mobile app (React Native)
- [ ] Phase 6 — Bot platform & Premium
