# CS2 Gambler Frontend

Next.js frontend for the CS2 Gambler skin upgrader app. It provides the Steam-authenticated player UI for browsing skins, buying inventory items, topping up a wallet, running upgrade attempts, and managing profile actions.

## Stack

- Next.js 16.2.6 with the App Router
- React 19.2.4
- TypeScript
- CSS Modules plus global styles
- Session-based API calls to the NestJS backend

## Features

- Steam login and logout flow through the backend
- Wallet balance display and crypto top-up modal
- Public skins catalog with pagination and filtering
- User inventory with search, sorting, and pagination
- Skin upgrader game with 10%, 25%, 50%, and 75% displayed chance tiers
- Live drops sidebar polling recent upgrader wins
- Profile page with trade URL management, inventory sell/withdraw actions, and upgrade history
- Free/demo mode UI that hides deposits and withdrawals when enabled

## Prerequisites

- Node.js compatible with Next.js 16
- npm
- The backend running locally or a deployed backend API URL

This repository has separate `backend/` and `frontend/` projects. Run frontend commands from `frontend/`.

## Environment

Create `frontend/.env.local` when you need values different from the defaults:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_FREE_MODE=true
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3000` | Backend API origin used by browser `fetch` calls and Steam redirects. |
| `NEXT_PUBLIC_FREE_MODE` | `false` | When `true`, hides real-money top-up and withdrawal UI and shows free-mode messaging. |

Keep `NEXT_PUBLIC_FREE_MODE` aligned with the backend `FREE_MODE` setting. If they disagree, the UI can hide actions that the API still allows, or show actions that the API rejects.

## Local Development

Install dependencies:

```bash
npm install
```

Start the frontend dev server:

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

The frontend defaults to backend API requests at [http://localhost:3000](http://localhost:3000). Start the backend separately from `../backend`:

```bash
npm run start:dev
```

For local protected-flow testing without Steam, enable the backend development login route with `ENABLE_DEV_LOGIN=true`, then call `POST /auth/dev-login` against the backend before using authenticated frontend flows.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts Next.js on port `3001`. |
| `npm run build` | Builds the production app. |
| `npm run start` | Starts the production server on port `3001`. |
| `npm run lint` | Runs ESLint. |

There is no frontend test script. Use `npm run lint` and `npm run build` for verification.

## Project Structure

```text
frontend/
├── app/
│   ├── components/          # Navbar, top-up modal, live drops sidebar
│   ├── lib/                 # Shared UI helpers such as rarity and sound effects
│   ├── profile/page.tsx     # Profile, trade URL, inventory actions, history
│   ├── globals.css          # Global styling and CSS variables
│   ├── layout.tsx           # Fonts and metadata
│   └── page.tsx             # Main shop, inventory, and upgrader UI
├── public/                  # Static assets
├── next.config.ts           # Remote image host allowlist
└── package.json             # Scripts and dependencies
```

## Backend API Usage

The frontend currently calls these backend routes:

- `GET /auth/me`
- `GET /auth/steam`
- `POST /auth/logout`
- `PUT /auth/me/trade-url`
- `GET /wallet`
- `POST /wallet/deposits`
- `GET /skins`
- `GET /inventory`
- `POST /inventory/buy-bulk`
- `POST /inventory/sell`
- `POST /inventory/withdraw`
- `GET /upgrader/options`
- `POST /upgrader/attempt`
- `GET /upgrader/history`
- `GET /upgrader/drops`

Authenticated requests use `credentials: "include"`, so the backend must allow the frontend origin in CORS and session cookies must be accepted by the browser.

## Images

`next.config.ts` allows remote images from Steam and Waxpeer hosts used for avatars and skin artwork. Add new image domains there before rendering them with `next/image`.

## Production Notes

- Set `NEXT_PUBLIC_API_BASE_URL` to the public backend origin before building.
- Make sure backend `FRONTEND_URL`, Steam callback URLs, CORS, and cookie settings match the deployed frontend origin.
- Run `npm run build` before deployment.
