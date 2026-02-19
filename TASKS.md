# TASKS — Atelier Rénov'

Suivi du refactoring incrémental. Chaque tâche est liée à une GitHub Issue.
Attaquer par priorité : Critique → Élevé → Moyen → Faible.

---

## 🔴 Critique

- [ ] Créer `useItemTypeActions.js` — l'app ne charge pas sans ce hook (#2)
  - `frontend/src/hooks/useItemTypeActions.js` (à créer)
  - `frontend/src/App.jsx`

- [ ] CORS whitelist + rate limiting login + helmet (#3)
  - `backend/server.js`
  - `backend/package.json`

- [ ] Supprimer `.env` / `database.sqlite` de git + créer `.env.example` (#4)
  - `.gitignore`
  - `backend/.env.example` (à créer)

---

## 🟠 Élevé

- [ ] Fail fast si `JWT_SECRET` / `ADMIN_PASSWORD` absents au démarrage (#5)
  - `backend/server.js`

- [ ] `await setupDb()` avant `app.listen()` (#6)
  - `backend/server.js`

- [ ] Transactions SQL sur opérations consommables (#7)
  - `backend/server.js` (routes consommables)

- [ ] Foreign keys + ON DELETE CASCADE en PostgreSQL (#8)
  - `backend/server.js` (setupDb)

- [ ] Docker — `.dockerignore`, `restart: unless-stopped`, healthcheck, `npm ci`, non-root user (#9)
  - `Dockerfile`
  - `docker-compose.yml`
  - `.dockerignore` (à créer)

---

## 🟡 Moyen

- [ ] Éliminer N+1 queries sur `GET /api/bags` — remplacer par JOIN (#10)
  - `backend/server.js` (route GET /api/bags)

- [ ] Indexes manquants sur colonnes FK (#11)
  - `backend/server.js` (setupDb)

- [ ] Centraliser `STATUSES`, factory fetch, labels "sac" stale (#12)
  - `frontend/src/constants.js` (à créer)
  - `frontend/src/hooks/*.js`

- [ ] Fix magic number image ID + supprimer images Cloudinary orphelines (#13)
  - `backend/server.js` (route DELETE /api/bags/:id)

- [ ] Toasts d'erreur manquants — BusinessTab, ConsumablesTab, etc. (#14)
  - `frontend/src/hooks/*.js`
  - `frontend/src/App.jsx`

- [ ] UX — filtres item_type/statut, tri inventaire, loading states, empty states (#15)
  - Composant inventaire
  - `frontend/src/hooks/useProjectData.js`

---

## 🔵 Faible

- [ ] Routes API manquantes — `GET /bags/:id`, `DELETE/PUT brands & item_types` (#16)
  - `backend/server.js`

- [ ] Logging structuré (pino/winston) + Sentry + stratégie backup (#17)
  - `backend/server.js`
  - `backend/package.json`
  - `frontend/package.json`

---

## Légende

| Symbole | Signification |
|---------|---------------|
| `[ ]` | À faire |
| `[x]` | Terminé |
| `(#N)` | GitHub Issue liée |
