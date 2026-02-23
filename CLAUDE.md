# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack web app for managing luxury bag renovation and resale. Single admin user, JWT auth, before/after photo tracking, consumables/expense tracking, and business analytics.

## Commands

### Frontend (`/frontend`)
```bash
npm run dev       # Vite dev server on :5173 (proxies /api to :5000)
npm run build     # Production build → dist/
npm run lint      # ESLint check
npm run preview   # Serve production build locally
```

### Backend (`/backend`)
```bash
npm start         # Express server on :5000
```

### Full stack (recommended for development)
```bash
docker-compose up --build   # Frontend :8081 (Nginx) + Backend :5000
```

## Architecture

**Single-file backend:** All Express routes, DB queries, and file handling live in `backend/server.js`. No separate route files or controllers.

**Dual database mode:** Toggled via `USE_LOCAL_MODE=true` in `backend/.env`:
- Local: SQLite (`backend/database.sqlite`)
- Production: PostgreSQL (via `DATABASE_URL`)

**Image pipeline:** Client uploads → Multer buffer → Sharp (WebP resize) → local `/uploads` or Cloudinary CDN → URL stored in `images` table.

**Deployment:** Frontend on Vercel, backend on Koyeb. `frontend/vercel.json` rewrites `/api/*` to Koyeb. Vite dev proxy in `vite.config.js` handles local dev.

**Frontend state:** No global state manager. `App.jsx` orchestrates state via custom hooks in `frontend/src/hooks/`:
- `useAuth.js` — JWT token lifecycle + `authenticatedFetch()` wrapper
- `useProjectData.js` — centralized data fetching (bags, brands, item types, lists)
- `useBagActions.js` — bag CRUD and image operations
- `useBrandActions.js`, `useItemTypeActions.js`, `useDashboardListActions.js` — domain-specific mutations

## Key Files

| File | Purpose |
|------|---------|
| `backend/server.js` | Entire backend: routes, DB init, auth, file upload |
| `backend/.env` | `JWT_SECRET`, `ADMIN_PASSWORD`, `USE_LOCAL_MODE`, Cloudinary creds |
| `frontend/src/App.jsx` | Router, global state orchestration, hook composition |
| `frontend/vite.config.js` | Dev proxy: `/api` → `localhost:5000` |
| `frontend/vercel.json` | Prod rewrite: `/api/*` → Koyeb + SPA fallback |

## Database Schema (key tables)

`bags` — main inventory (name, brand, item_type, purchase/sell prices, status, margins)
`images` — before/after photos linked to bags (type: `before`|`after`)
`bag_logs` — activity history per bag
`bag_consumables` — many-to-many link between bags and consumables with cost
`consumables` — product inventory (supplies)
`expenses` — general business expenses
`dashboard_lists` — user-configured custom dashboard filters
`brands`, `item_types` — reference data
`users` — single admin account (hashed password)

## Authentication

Password-only login returns a 7-day JWT. All protected routes require `Authorization: Bearer <token>`. Token stored in `localStorage`. The `authenticatedFetch()` function in `useAuth.js` handles attachment automatically.

## Notes

- No test suite exists. No TypeScript — pure JavaScript throughout.
- Backend SQL queries use raw parameterized queries (no ORM).
- Sharp converts all uploads to WebP format before storage.
- The app manages a generic concept of "articles" (bags, shoes, clothes, etc.) — the codebase was recently refactored away from bags-only to a generic item model.
