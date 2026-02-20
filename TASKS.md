# TASKS — Atelier Rénov'

Suivi des issues GitHub. Attaquer par priorité : Critique → Élevé → Moyen → Faible.
Toutes les issues ont un numéro GitHub associé.

---

## ✅ Terminé (Issues #1–#46)

| # | Titre |
|---|-------|
| #2 | App ne charge pas — créer useItemTypeActions.js |
| #3 | CORS cassé + rate limiting login + helmet |
| #4 | Supprimer .env et database.sqlite de git |
| #5 | Fail fast si JWT_SECRET / ADMIN_PASSWORD absents |
| #6 | await setupDb() avant app.listen() |
| #7 | Transactions SQL sur opérations consommables |
| #8 | Foreign keys + ON DELETE CASCADE en PostgreSQL |
| #9 | Docker — dockerignore, restart, healthcheck, npm ci, non-root |
| #10 | N+1 queries sur GET /api/bags — remplacer par JOIN |
| #11 | Indexes manquants sur colonnes FK |
| #12 | Centraliser STATUSES, factory fetch, labels "sac" stale |
| #13 | Fix magic number image ID + images orphelines Cloudinary |
| #14 | Toasts d'erreur manquants — BusinessTab, ConsumablesTab |
| #15 | UX — filtres item_type/statut, tri inventaire, loading + empty states |
| #16 | Routes API manquantes — GET /bags/:id, DELETE/PUT brands & item_types |
| #17 | Logging structuré avec pino |
| #18 | Tests automatisés + GitHub Actions CI + auto-merge |
| #33 | CORS trop permissif — `startsWith()` → `===` |
| #34 | Validation absente sur `/api/change-password` |
| #35 | `resp.ok` non vérifié avant `.json()` dans useProjectData.js |
| #36 | Memory leak — `createObjectURL` sans `revokeObjectURL` |
| #37 | `JSON.parse` sans try-catch — crash serveur possible |
| #38 | `remaining_percentage` peut devenir négatif |
| #39 | `useEffect` dépendances manquantes — BagConsumables + BagLog |
| #40 | Calculs financiers non défensifs — NaN possible |
| #41 | Rate limiting absent sur routes sensibles |
| #42 | Multer — aucune validation MIME type |
| #43 | Erreurs de fetch silencieuses — `toast.error()` manquant |
| #44 | Dead code + `err.message` exposé dans server.js |
| #45 | Header — label "Nouveau sac" stale |
| #46 | `==` au lieu de `===` dans BagConsumables.jsx |

---

## Légende

| Symbole | Signification |
|---------|---------------|
| `[ ]` | À faire |
| `[x]` | Terminé |
| `(#N)` | GitHub Issue liée |
