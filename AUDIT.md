# Audit Complet — Atelier Rénov'

> **Date :** 24 mars 2026
> **Branche :** master (`bf43186`)
> **Périmètre :** Backend, Frontend, Sécurité, Infrastructure
> **Audit précédent :** 28 février 2026 (69 issues, plusieurs corrigées depuis)

Légende : 🔴 Critique · 🟠 Élevé · 🟡 Moyen · 🟢 Faible · ✅ Corrigé depuis dernier audit

---

## 0. Corrections depuis le dernier audit (28 février)

| Ancien # | Problème | Statut |
|----------|----------|--------|
| D1 | Pas de soft delete | ✅ `deleted_at` sur bags, consumables, expenses |
| P1 | Pas de pagination | ✅ `LIMIT ? OFFSET ?` avec max 500 |
| P2 | Pas de React.memo sur BagCard | ✅ `React.memo(BagCard)` |
| S1 | CSV injection | ✅ `csvEscape()` avec protection `=+-@` |
| I1 | Pas de `.env.example` | ✅ Fichier créé et documenté |
| U3 | `confirm()` natif | ✅ Composant `ConfirmDialog` custom |
| F3 | Pas de validation URL backend | ✅ `new URL(listing_url)` en backend |
| F7 | Pas de recherche consommables | ✅ `searchTerm` dans ConsumablesTab |

---

## 1. Résumé exécutif

| Domaine | Score | Verdict |
|---------|-------|---------|
| **Backend** | 7.5/10 | Requêtes 100% paramétrées, auth solide, rate limiting. Fichier monolithique mais cohérent. |
| **Frontend** | 6.5/10 | UX soignée (skeletons, toasts, onboarding). Composants surdimensionnés, re-renders excessifs. |
| **Sécurité** | 7/10 | Bons fondamentaux. Un point critique : SSL PostgreSQL désactivé en production. |
| **Infrastructure** | 7/10 | Docker propre, CI/CD fonctionnel. Tests frontend absents, vulnérabilités npm non corrigées. |

**À traiter immédiatement :**
1. 🔴 PostgreSQL SSL `rejectUnauthorized: false` en production (MITM)
2. 🔴 Vulnérabilités React Router XSS/CSRF (v7.0.0–7.11.0)

---

## 2. Sécurité

### 2.1 Points forts

- **SQL injection** : ✅ 100% des requêtes paramétrées. Whitelist pour tri (`SORT_MAP`) et statuts (`VALID_STATUSES`).
- **Auth** : bcrypt 10 rounds, JWT signé, rate limiting (10/15min login, 120/min API, 20/min upload).
- **Reset password** : token crypto 32 bytes, hashé SHA256, TTL 1h, usage unique, anti-énumération email (toujours 200).
- **Headers** : Helmet activé (CSP, HSTS, X-Frame-Options, etc.).
- **Uploads** : whitelist MIME (JPEG/PNG/WebP/GIF), 10 MB max, conversion Sharp WebP, noms = `Date.now()`.
- **Logs** : Pino structuré, `Authorization` redacté (`server.js:112`).
- **CSV** : `csvEscape()` protège contre l'injection de formules.

### 2.2 Vulnérabilités

| # | Sévérité | Problème | Fichier:Ligne | Action |
|---|----------|----------|---------------|--------|
| S1 | 🔴 | **PostgreSQL SSL désactivé en prod** : `rejectUnauthorized: false` → MITM possible | `server.js:276` | Changer en `true` |
| S2 | 🔴 | **React Router XSS/CSRF** : vulnérabilités connues dans v7.0.0–7.11.0 | `frontend/package.json` | Mettre à jour |
| S3 | 🟠 | **CORS wildcard sans garde** : `FRONTEND_URL='*'` accepte toutes les origines, même en prod | `server.js:96` | Ajouter `NODE_ENV !== 'production'` |
| S4 | 🟡 | **JWT en localStorage** : accessible par tout script XSS de la même origine | `useAuth.js:4,41` | Envisager httpOnly cookies |
| S5 | 🟡 | **loginLimiter désactivé si NODE_ENV=test** : risque si mal configuré en prod | `server.js:610` | Documenter + protéger |
| S6 | 🟡 | **Rate limiter en mémoire** : pas distribué, contournable en multi-instance | `server.js:618-628` | Redis store |
| S7 | 🟡 | **Upload sans validation frontend** : taille et type non vérifiés avant envoi | `BagModal.jsx:61-74` | Ajouter validation client |
| S8 | 🟡 | **JWT 7 jours** : durée longue pour une app financière | `server.js:57` | Réduire ou ajouter refresh token |
| S9 | 🟢 | **Pas de CSRF token** : opérations mutantes sans protection CSRF | global | Risque faible (API JSON + CORS) |

---

## 3. Backend (`backend/server.js` — 1 630 lignes)

### 3.1 Architecture

Fichier monolithique avec : init DB, middleware, 42 routes, gestion images, auth, export CSV. Choix assumé (doc CLAUDE.md) qui fonctionne pour single-admin mais complique la maintenance.

**Dual database** : SQLite (local) / PostgreSQL (prod) avec couche d'abstraction (lignes 138–160) convertissant `?` → `$N`.

### 3.2 Issues

| # | Sévérité | Problème | Fichier:Ligne |
|---|----------|----------|---------------|
| B1 | 🟠 | **server.js monolithique (1 630 lignes)** : routes, DB, auth, upload, migrations dans un fichier | `server.js` entier |
| B2 | 🟠 | **Pas de système de migration DB** : ALTER TABLE dans try-catch muets, pas de versioning | `server.js:406-465` |
| B3 | 🟡 | **Migrations silencieuses** : `catch(e) { /* already exists */ }` masque les vraies erreurs | `server.js:406-465` |
| B4 | 🟡 | **Messages d'erreur mixtes FR/EN** : incohérence entre routes | `server.js` (multiples) |
| B5 | 🟡 | **Pas de validation longueur** sur champs texte (name, description, notes) | `server.js` (multiples) |
| B6 | 🟡 | **`action` dans bag_logs non validé** : accepte n'importe quelle chaîne | `server.js:1010` |
| B7 | 🟡 | **`category` dans expenses non validé** : pas de whitelist | `server.js:1303` |
| B8 | 🟡 | **`remaining_percentage` corrigé silencieusement** au lieu de rejeté avec 400 | `server.js` |
| B9 | 🟡 | **Code dupliqué** : création brands/types quasi identique | `server.js:1459-1482` |
| B10 | 🟡 | **Connection pool PostgreSQL sans `max`** explicite | `server.js:276` |
| B11 | 🟢 | **Cloudinary delete silencieux** : erreurs logguées mais ignorées | `server.js:257` |
| B12 | 🟢 | **Sharp fallback** : si la conversion échoue, le buffer original est écrit sans avertissement | `server.js:224` |

### 3.3 Base de données (12 tables)

users, password_reset_tokens, bags, images, bag_logs, bag_consumables, consumables, expenses, brands, item_types, dashboard_lists, app_config.

**Multi-tenancy** : `user_id` sur toutes les tables de données. Correctement filtré dans toutes les requêtes.

**Soft deletes** : `deleted_at` sur bags, consumables, expenses. Filtré par `deleted_at IS NULL` dans les requêtes.

| # | Sévérité | Problème | Détail |
|---|----------|----------|--------|
| D1 | 🟡 | **Pas de contraintes CHECK** sur les prix | Valeurs négatives acceptées en DB |
| D2 | 🟡 | **`is_donation` type différent** selon le moteur | INTEGER (SQLite) vs BOOLEAN (PostgreSQL) |
| D3 | 🟡 | **Pas de contrainte NOT NULL** sur `purchase_price`, `actual_resale_price`, `fees` | Nulls possibles |
| D4 | 🟡 | **Arithmétique flottante** dans calculs de profit | `0.1 + 0.2 ≠ 0.3` |
| D5 | 🟢 | **Suppression marque/type sans vérification d'usage** | Orphelins possibles |

---

## 4. Frontend (`frontend/src/` — ~3 500 lignes)

### 4.1 Architecture

React 19 + React Router 7 + Vite 7. État orchestré dans App.jsx via custom hooks (useAuth, useProjectData, useBagActions, etc.). Pas de state manager global.

### 4.2 Composants critiques

| Composant | Lignes | Problème principal |
|-----------|--------|--------------------|
| `BagModal.jsx` | 488 | 15 props, mélange form/images/logs/consommables |
| `App.jsx` | 453 | Routing + state + filtres + pagination + onboarding |
| `BagConsumables.jsx` | 262 | Erreurs silencieuses (console.error uniquement) |
| `ConsumablesTab.jsx` | 200 | Modal inline, pas de composant réutilisable |
| `PerformanceChart.jsx` | 193 | Chart custom avec styles inline |
| `Login.jsx` | 212 | — |

### 4.3 Issues

| # | Sévérité | Problème | Fichier:Ligne |
|---|----------|----------|---------------|
| F1 | 🟠 | **BagModal surdimensionné** : 488 lignes, 15 props, mélange 4 responsabilités | `BagModal.jsx` |
| F2 | 🟠 | **App.jsx surdimensionné** : 453 lignes, routing + state + filtres + pagination | `App.jsx` |
| F3 | 🟠 | **useProjectData retourne 30+ valeurs** : tout re-render à chaque changement | `useProjectData.js:130-148` |
| F4 | 🟡 | **Callbacks recréés à chaque render** : `onClick={() => openModal(bag)}` annule React.memo | `App.jsx:342` |
| F5 | 🟡 | **Map imbriquées O(n×m)** : dashboardLists × dashboardBags à chaque render | `App.jsx:245-273` |
| F6 | 🟡 | **Pas de useMemo** sur les listes filtrées | `App.jsx` |
| F7 | 🟡 | **Pas de lazy loading** sur PerformanceChart | `App.jsx` |
| F8 | 🟡 | **Pas d'ErrorBoundary** : crash d'un composant → crash total de l'app | `App.jsx` |
| F9 | 🟡 | **Styles inline partout** : 50+ objets dans BagModal, mélange avec className | multiple |
| F10 | 🟡 | **Erreurs silencieuses** dans BagConsumables : `catch → console.error` sans toast | `BagConsumables.jsx:29` |
| F11 | 🟡 | **Prop drilling** : BagModal reçoit 15 props au lieu d'utiliser Context/hooks | `BagModal.jsx:39-54` |
| F12 | 🟡 | **Pas d'updates optimistes** : attente serveur systématique | global |
| F13 | 🟡 | **Pas de retry** sur erreur réseau | `useProjectData.js` |
| F14 | 🟢 | **ConfirmDialog** : state module-level non idiomatique | `ConfirmDialog.jsx:4-5` |
| F15 | 🟢 | **OnboardingTour** peut piéger le focus clavier | `OnboardingTour.jsx:15` |

### 4.4 Accessibilité

| # | Sévérité | Problème |
|---|----------|----------|
| A1 | 🟡 | Images cliquables sans `role="button"` ni handler clavier |
| A2 | 🟡 | Statuts différenciés par couleur uniquement (daltonisme) |
| A3 | 🟡 | Pas de skip links |
| A4 | 🟢 | Pas de dark mode (`prefers-color-scheme` ignoré) |

### 4.5 UX — Points forts

- Skeleton loaders pour le chargement
- Empty states bien designés par onglet
- Toast notifications (react-hot-toast)
- Confirmation avant suppression (ConfirmDialog custom)
- Onboarding tour pour les nouveaux utilisateurs
- Comparateur before/after (react-compare-slider)
- Images lazy-loaded (`loading="lazy"`)

---

## 5. Infrastructure

### 5.1 Docker

| Aspect | État |
|--------|------|
| Backend Dockerfile | ✅ node:20-alpine, user non-root, health check, `npm ci --omit=dev` |
| Frontend Dockerfile | ✅ Multi-stage (node:20-slim → nginx:alpine), SPA fallback |
| docker-compose.yml | ✅ Health check, depends_on, volumes SQLite/uploads |
| Nginx config | ⚠️ Inline dans Dockerfile (echo), pas de fichier séparé |

### 5.2 CI/CD

| Workflow | Trigger | Statut |
|----------|---------|--------|
| `deploy.yml` | Push master | ✅ Deploy Vercel + redeploy Koyeb |
| `tests.yml` | PR vers master | ⚠️ Frontend tests : 0 fichiers de test (le job passe sans rien tester) |
| `claude.yml` | @claude commentaire | ✅ Claude Code action |

### 5.3 Tests

| Cible | État | Détail |
|-------|------|--------|
| Backend | Partiel | 10 fichiers dans `__tests__/` (auth, bags, brands, consumables, expenses, health, multi-tenancy, onboarding, register, reset-password) |
| Frontend | **Aucun** | Vitest configuré, setup.js existe, mais 0 fichiers de test |

### 5.4 Vulnérabilités npm

**Backend (10 vulnérabilités) :**

| Sévérité | Count | Source | Fix |
|----------|-------|--------|-----|
| HIGH | 7 | tar via cacache/sqlite3 | sqlite3 → 6.0.1 (breaking) |
| MODERATE | 1 | lodash prototype pollution | — |
| LOW | 2 | @tootallnate/once | — |

**Frontend (6 vulnérabilités) :**

| Sévérité | Count | Source | Fix |
|----------|-------|--------|-----|
| HIGH | 2 | React Router XSS + CSRF | Mettre à jour react-router-dom |
| HIGH | 1 | Rollup path traversal | Mettre à jour vite/rollup |
| HIGH | 1 | flatted DoS | Mettre à jour flatted |
| MODERATE | 2 | ajv ReDoS, flatted prototype pollution | — |

### 5.5 Issues infra

| # | Sévérité | Problème | Détail |
|---|----------|----------|--------|
| I1 | 🟠 | **Migrations sans versioning** | Pas de rollback, schéma modifié au startup |
| I2 | 🟠 | **Frontend tests CI** : job passe sans rien tester | Faux sentiment de sécurité |
| I3 | 🟡 | **Logs non persistés** : Pino → stdout, perdus au restart | Pas de log aggregation |
| I4 | 🟡 | **Pas de monitoring** : aucune alerte 5xx, latence, downtime | Pas de Grafana/Sentry |
| I5 | 🟡 | **package-lock.json frontend périmé** (30 jours) | Risque de dérive |
| I6 | 🟢 | **Nginx config inline** dans Dockerfile | Maintenabilité |
| I7 | 🟢 | **Images Docker non épinglées** à un digest | Non reproductible |

---

## 6. Logique métier

| # | Sévérité | Problème | Fichier:Ligne |
|---|----------|----------|---------------|
| M1 | 🟡 | **Marge calculée différemment** dans BagCard, BagModal et BusinessTab | `BagCard.jsx:8`, `BagModal.jsx:290`, `BusinessTab.jsx:79` |
| M2 | 🟡 | **Frais plateforme non inclus** dans le profit estimé des articles non vendus | `BagCard.jsx:9` |
| M3 | 🟡 | **`time_spent` en base mais jamais affiché** ni éditable | `server.js:270` |
| M4 | 🟢 | **Profit net mensuel non calculé** (CA − coûts − dépenses) dans le graphique | `PerformanceChart.jsx` |
| M5 | 🟢 | **Pas d'analytics croisés** par type d'article ou marque | backlog |

---

## 7. Récapitulatif

| Volet | 🔴 | 🟠 | 🟡 | 🟢 | Total |
|-------|----|----|----|----|-------|
| Sécurité | 2 | 1 | 6 | 1 | **10** |
| Backend code | 0 | 2 | 9 | 2 | **13** |
| Base de données | 0 | 0 | 4 | 1 | **5** |
| Frontend code | 0 | 3 | 10 | 2 | **15** |
| Accessibilité | 0 | 0 | 3 | 1 | **4** |
| Infrastructure | 0 | 2 | 3 | 2 | **7** |
| Logique métier | 0 | 0 | 3 | 2 | **5** |
| **Total** | **2** | **8** | **38** | **11** | **59** |

**Progression** : 69 issues (fév.) → 59 issues (mars), avec correction de 8 problèmes majeurs.

---

## 8. Recommandations de refactorisation

### Phase 1 — Sécurité (immédiat)

| Action | Fichier | Effort |
|--------|---------|--------|
| Fix SSL PostgreSQL : `rejectUnauthorized: true` | `server.js:276` | 5 min |
| Garde CORS wildcard : bloquer `'*'` en production | `server.js:96` | 5 min |
| `npm audit fix` frontend (React Router, Rollup, flatted) | `frontend/` | 15 min |
| Évaluer sqlite3 → 6.x pour résoudre vulnérabilités tar | `backend/` | 1h+ |

### Phase 2 — Architecture frontend (court terme)

| Action | Détail | Effort |
|--------|--------|--------|
| Découper `BagModal.jsx` | → BagFormFields, BagImageSection, BagConsumablesSection, BagLogSection | 2-3h |
| Découper `App.jsx` en pages | → InventoryPage, DashboardPage, StocksPage, BusinessPage | 2-3h |
| Découper `useProjectData` | → useBags(), useConsumables(), useExpenses(), useReferenceData() | 1-2h |
| Ajouter `ErrorBoundary` | Wrapper autour des routes principales | 30 min |
| Ajouter validation upload client | Vérifier taille (< 10 MB) et type MIME avant envoi | 30 min |

### Phase 3 — Qualité & robustesse (moyen terme)

| Action | Détail | Effort |
|--------|--------|--------|
| Ajouter tests frontend | Hooks (useAuth, useProjectData) + composants (BagModal, Login) | 3-4h |
| Adopter un outil de migration DB | knex migrations ou db-migrate | 2-3h |
| Uniformiser messages d'erreur | Tout en français | 1h |
| Ajouter validation longueur backend | maxlength sur champs texte | 1h |
| Centraliser calculs de marge | Fonction partagée `calculateProfit()` | 1h |
| `useCallback` pour les handlers de App.jsx | Rendre React.memo efficace | 30 min |

### Phase 4 — Infrastructure (long terme)

| Action | Détail | Effort |
|--------|--------|--------|
| Redis store pour rate limiting | Nécessaire si multi-instance | 1-2h |
| Extraire nginx.conf du Dockerfile | Fichier séparé dans le repo | 15 min |
| Envisager httpOnly cookies pour JWT | Refonte auth backend + frontend | 3-4h |
| Ajouter monitoring (Sentry/Grafana) | Alertes 5xx et latence | 2-3h |
| Migrer styles inline → CSS modules | Cohérence styling | 4-5h |

---

## 9. Ce qui fonctionne bien

- **SQL** : 100% des requêtes paramétrées, aucune injection possible
- **Auth** : bcrypt, JWT signé, rate limiting, anti-énumération, reset token hashé
- **Uploads** : whitelist MIME, limite taille, conversion WebP, noms non prédictibles
- **Logging** : Pino structuré avec redaction Authorization
- **CSV** : Protection injection formule (`csvEscape`)
- **Soft deletes** : `deleted_at` sur les entités principales
- **Pagination** : `LIMIT/OFFSET` avec max 500 par page
- **Multi-tenancy** : `user_id` filtré sur toutes les requêtes
- **Docker** : User non-root, health checks, multi-stage build, `.dockerignore`
- **CI/CD** : Tests automatiques sur PR, deploy sur push master
- **UX** : Skeletons, empty states, toasts, confirmation dialogs, onboarding tour
- **Dépendances** : Lean et bien choisies (React 19, Express 5, Vite 7, Sharp, Pino)
